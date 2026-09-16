import prisma from "../db/prisma.js";
import { createNotification, logActivity } from "../services/activityService.js";
import { canManageDecision } from "../services/authorizationService.js";

const listApprovals = async (req, res) => {
  try {
    const decisionId = Number(req.params.decisionId);
    if (!Number.isInteger(decisionId) || decisionId <= 0) return res.status(400).json({ message: "Invalid decision ID" });

    const approvals = await prisma.approval.findMany({
      where: { decisionId },
      include: {
        reviewer: { select: { id: true, name: true, email: true, role: true } },
        requestedBy: { select: { id: true, name: true, email: true, role: true } },
      },
      orderBy: [{ level: "asc" }, { createdAt: "asc" }],
    });

    res.status(200).json(approvals);
  } catch (error) {
    console.error("List approvals error:", error);
    res.status(500).json({ message: "Failed to fetch approvals" });
  }
};

const requestApproval = async (req, res) => {
  try {
    if (!["Manager", "Administrator"].includes(req.user.role)) {
      return res.status(403).json({ message: "Only managers or administrators can manually request approvals" });
    }

    const decisionId = Number(req.params.decisionId);
    const reviewerId = Number(req.body.reviewerId);
    const level = Number(req.body.level || 1);
    const requesterId = req.user.userId;

    if (!Number.isInteger(decisionId) || decisionId <= 0) return res.status(400).json({ message: "Invalid decision ID" });
    if (!Number.isInteger(reviewerId) || reviewerId <= 0) return res.status(400).json({ message: "Invalid approver ID" });
    if (![1, 2].includes(level)) return res.status(400).json({ message: "Approval level must be 1 or 2" });

    const decision = await prisma.decision.findUnique({ where: { id: decisionId } });
    if (!decision) return res.status(404).json({ message: "Decision not found" });

    if (!(await canManageDecision(decision, req.user))) {
      return res.status(403).json({ message: "You do not have permission to request approval for this decision" });
    }

    if (reviewerId === requesterId) return res.status(400).json({ message: "You cannot assign yourself" });

    const requiredRole = level === 1 ? "Reviewer" : "Manager";
    const reviewer = await prisma.user.findUnique({ where: { id: reviewerId }, select: { id: true, name: true, role: true } });
    if (!reviewer) return res.status(404).json({ message: "Approver not found" });
    if (reviewer.role !== requiredRole) return res.status(400).json({ message: `Level ${level} approvals require a ${requiredRole}` });

    if (decision.teamId) {
      const reviewerMembership = await prisma.teamMember.findUnique({
        where: { teamId_userId: { teamId: decision.teamId, userId: reviewerId } },
      });
      if (!reviewerMembership) {
        return res.status(400).json({ message: "The assigned approver must belong to the decision's team" });
      }
    }

    if (level === 2) {
      const levelOneApprovals = await prisma.approval.findMany({
        where: { decisionId, level: 1 },
        select: { status: true },
      });
      if (!levelOneApprovals.length || levelOneApprovals.some((item) => item.status !== "Approved")) {
        return res.status(409).json({ message: "Level 1 reviewer approval must be completed before requesting Level 2 approval" });
      }
    }

    const existingApproval = await prisma.approval.findUnique({ where: { decisionId_reviewerId_level: { decisionId, reviewerId, level } } });
    if (existingApproval) return res.status(409).json({ message: "Approval request already exists" });

    const approval = await prisma.$transaction(async (tx) => {
      const created = await tx.approval.create({
        data: { decisionId, reviewerId, requestedById: requesterId, level, status: "Pending" },
        include: { reviewer: { select: { id: true, name: true, email: true, role: true } }, requestedBy: { select: { id: true, name: true, email: true, role: true } } },
      });
      await tx.decision.update({ where: { id: decisionId }, data: { status: "UnderReview" } });
      return created;
    });

    await createNotification({ userId: reviewerId, type: "APPROVAL_REQUESTED", title: "Approval requested", message: `You have a Level ${level} approval request for ${decision.title}.`, entityType: "Decision", entityId: decisionId });
    await logActivity({ userId: requesterId, action: "APPROVAL_REQUESTED", entityType: "Approval", entityId: approval.id, decisionId, teamId: decision.teamId, metadata: { reviewerId, level, automatic: false } });

    res.status(201).json({ message: "Approval requested successfully", approval });
  } catch (error) {
    console.error("Request approval error:", error);
    res.status(500).json({ message: "Failed to request approval" });
  }
};

const findNextManager = async (decision, excludeId) => {
  const where = { role: "Manager", id: { not: excludeId }, ...(decision.teamId ? { teamMemberships: { some: { teamId: decision.teamId } } } : {}) };
  return (await prisma.user.findFirst({ where, select: { id: true, name: true, email: true, role: true }, orderBy: { id: "asc" } })) || prisma.user.findFirst({ where: { role: "Manager", id: { not: excludeId } }, select: { id: true, name: true, email: true, role: true }, orderBy: { id: "asc" } });
};

const actOnApproval = async (req, res) => {
  try {
    const approvalId = Number(req.params.approvalId);
    const { status, comments } = req.body;
    const userId = req.user.userId;

    if (!Number.isInteger(approvalId) || approvalId <= 0) return res.status(400).json({ message: "Invalid approval ID" });
    if (!["Approved", "Rejected"].includes(status)) return res.status(400).json({ message: "Status must be Approved or Rejected" });

    const approval = await prisma.approval.findUnique({
      where: { id: approvalId },
      include: { decision: { include: { team: { select: { id: true, name: true } } } }, reviewer: { select: { id: true, name: true, role: true } } },
    });
    if (!approval) return res.status(404).json({ message: "Approval not found" });
    if (approval.reviewerId !== userId) return res.status(403).json({ message: "You are not assigned to this approval" });
    if (approval.status !== "Pending") return res.status(400).json({ message: "This approval has already been processed" });

    const requiredRole = approval.level === 1 ? "Reviewer" : "Manager";
    if (req.user.role !== requiredRole) return res.status(403).json({ message: `${requiredRole}s are the only users who can complete Level ${approval.level} approvals` });

    let nextManager = null;
    let nextApproval = null;

    const updatedApproval = await prisma.$transaction(async (tx) => {
      if (status === "Approved" && approval.level > 1) {
        const levelOne = await tx.approval.findMany({ where: { decisionId: approval.decisionId, level: 1 } });
        if (!levelOne.length || levelOne.some((item) => item.status !== "Approved")) {
          throw new Error("EARLIER_STAGE_NOT_COMPLETE");
        }
      }

      const updated = await tx.approval.update({
        where: { id: approvalId },
        data: { status, comments: comments?.trim() || null, actedAt: new Date() },
        include: { reviewer: { select: { id: true, name: true, email: true, role: true } }, requestedBy: { select: { id: true, name: true, email: true, role: true } } },
      });

      if (status === "Rejected") {
        await tx.decision.update({ where: { id: approval.decisionId }, data: { status: "Rejected" } });
        return updated;
      }

      if (approval.level === 1) {
        const managerWhere = { role: "Manager", id: { not: approval.decision.createdById }, ...(approval.decision.teamId ? { teamMemberships: { some: { teamId: approval.decision.teamId } } } : {}) };
        nextManager = await tx.user.findFirst({ where: managerWhere, select: { id: true, name: true, email: true, role: true }, orderBy: { id: "asc" } });
        if (!nextManager && !approval.decision.teamId) {
          nextManager = await tx.user.findFirst({ where: { role: "Manager", id: { not: approval.decision.createdById } }, select: { id: true, name: true, email: true, role: true }, orderBy: { id: "asc" } });
        }
        if (!nextManager) throw new Error("NO_MANAGER_AVAILABLE");

        nextApproval = await tx.approval.create({
          data: { decisionId: approval.decisionId, reviewerId: nextManager.id, requestedById: userId, level: 2, status: "Pending" },
          include: { reviewer: { select: { id: true, name: true, email: true, role: true } } },
        });
        await tx.decision.update({ where: { id: approval.decisionId }, data: { status: "UnderReview" } });
      } else {
        await tx.decision.update({ where: { id: approval.decisionId }, data: { status: "Approved" } });
      }

      return updated;
    });

    await createNotification({ userId: approval.requestedById, type: `APPROVAL_${status.toUpperCase()}`, title: `Approval ${status.toLowerCase()}`, message: `${approval.decision.title} was ${status.toLowerCase()} by ${approval.reviewer?.name || "the assigned approver"}.`, entityType: "Decision", entityId: approval.decisionId });

    if (status === "Approved" && approval.level === 1 && nextManager && nextApproval) {
      await createNotification({ userId: nextManager.id, type: "APPROVAL_REQUESTED", title: "Manager approval required", message: `${approval.decision.title} passed reviewer approval and is now waiting for your final approval.`, entityType: "Decision", entityId: approval.decisionId });
      await logActivity({ userId, action: "APPROVAL_ESCALATED", entityType: "Approval", entityId: nextApproval.id, decisionId: approval.decisionId, teamId: approval.decision.teamId, metadata: { fromLevel: 1, toLevel: 2, managerId: nextManager.id } });
    }

    await logActivity({ userId, action: `APPROVAL_${status.toUpperCase()}`, entityType: "Approval", entityId: approvalId, decisionId: approval.decisionId, teamId: approval.decision.teamId, metadata: { level: approval.level, comments: comments || "" } });

    res.status(200).json({ message: `Approval ${status.toLowerCase()} successfully`, approval: updatedApproval });
  } catch (error) {
    console.error("Act on approval error:", error);
    if (error?.message === "EARLIER_STAGE_NOT_COMPLETE") return res.status(409).json({ message: "Earlier approval stages must be completed first" });
    if (error?.message === "NO_MANAGER_AVAILABLE") return res.status(409).json({ message: "No Manager is available to receive the final approval" });
    res.status(500).json({ message: "Failed to process approval" });
  }
};

const getMyPendingApprovals = async (req, res) => {
  try {
    const approvals = await prisma.approval.findMany({
      where: { reviewerId: req.user.userId, status: "Pending" },
      include: {
        decision: { select: { id: true, title: true, status: true, teamId: true, team: { select: { id: true, name: true } }, createdAt: true, updatedAt: true, createdById: true, createdBy: { select: { id: true, name: true, role: true } } } },
        requestedBy: { select: { id: true, name: true, email: true } },
      },
      orderBy: [{ level: "asc" }, { createdAt: "desc" }],
    });

    const allowed = approvals.filter((approval) => (approval.level === 1 && req.user.role === "Reviewer") || (approval.level === 2 && req.user.role === "Manager"));
    res.status(200).json(allowed);
  } catch (error) {
    console.error("Pending approvals error:", error);
    res.status(500).json({ message: "Failed to fetch pending approvals" });
  }
};

export { listApprovals, requestApproval, actOnApproval, getMyPendingApprovals };
