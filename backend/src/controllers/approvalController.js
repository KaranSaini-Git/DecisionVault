import prisma from "../db/prisma.js";
import { createNotification, logActivity } from "../services/activityService.js";

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
    const decisionId = Number(req.params.decisionId);
    const reviewerId = Number(req.body.reviewerId);
    const level = Number(req.body.level || 1);
    const requesterId = req.user.userId;

    if (!Number.isInteger(decisionId) || decisionId <= 0) return res.status(400).json({ message: "Invalid decision ID" });
    if (!Number.isInteger(reviewerId) || reviewerId <= 0) return res.status(400).json({ message: "Invalid reviewer ID" });
    if (!Number.isInteger(level) || level < 1) return res.status(400).json({ message: "Invalid approval level" });

    const decision = await prisma.decision.findUnique({ where: { id: decisionId } });
    if (!decision) return res.status(404).json({ message: "Decision not found" });

    const canRequest = decision.createdById === requesterId || ["Manager", "Administrator"].includes(req.user.role);
    if (!canRequest) return res.status(403).json({ message: "You are not allowed to request approval for this decision" });
    if (reviewerId === requesterId) return res.status(400).json({ message: "You cannot assign yourself as reviewer" });

    const reviewer = await prisma.user.findUnique({ where: { id: reviewerId }, select: { id: true, name: true, role: true } });
    if (!reviewer) return res.status(404).json({ message: "Reviewer not found" });
    if (!["Reviewer", "Manager", "Administrator"].includes(reviewer.role)) return res.status(400).json({ message: "Selected user cannot be an approver" });
    if (level >= 2 && !["Manager", "Administrator"].includes(reviewer.role)) return res.status(400).json({ message: "Level 2 and higher approvals require a manager or administrator" });

    const existingApproval = await prisma.approval.findUnique({ where: { decisionId_reviewerId_level: { decisionId, reviewerId, level } } });
    if (existingApproval) return res.status(409).json({ message: "Approval request already exists for this reviewer and level" });

    const result = await prisma.$transaction(async (tx) => {
      const approval = await tx.approval.create({
        data: { decisionId, reviewerId, requestedById: requesterId, level, status: "Pending" },
        include: { reviewer: { select: { id: true, name: true, email: true, role: true } }, requestedBy: { select: { id: true, name: true, email: true, role: true } } },
      });
      await tx.decision.update({ where: { id: decisionId }, data: { status: "UnderReview" } });
      return approval;
    });

    await createNotification({ userId: reviewerId, type: "APPROVAL_REQUESTED", title: "Approval requested", message: `You have a new Level ${level} approval request for ${decision.title}.`, entityType: "Decision", entityId: decisionId });
    await logActivity({ userId: requesterId, action: "APPROVAL_REQUESTED", entityType: "Approval", entityId: result.id, decisionId, teamId: decision.teamId, metadata: { reviewerId, level } });

    res.status(201).json({ message: "Approval requested successfully", approval: result });
  } catch (error) {
    console.error("Request approval error:", error);
    res.status(500).json({ message: "Failed to request approval" });
  }
};

const actOnApproval = async (req, res) => {
  try {
    const approvalId = Number(req.params.approvalId);
    const { status, comments } = req.body;
    const userId = req.user.userId;

    if (!Number.isInteger(approvalId) || approvalId <= 0) return res.status(400).json({ message: "Invalid approval ID" });
    if (!["Approved", "Rejected"].includes(status)) return res.status(400).json({ message: "Status must be Approved or Rejected" });

    const approval = await prisma.approval.findUnique({ where: { id: approvalId }, include: { decision: true } });
    if (!approval) return res.status(404).json({ message: "Approval not found" });
    if (approval.reviewerId !== userId) return res.status(403).json({ message: "You are not assigned to this approval" });
    if (approval.status !== "Pending") return res.status(400).json({ message: "This approval has already been processed" });

    const result = await prisma.$transaction(async (tx) => {
      const updatedApproval = await tx.approval.update({
        where: { id: approvalId },
        data: { status, comments: comments?.trim() || null, actedAt: new Date() },
        include: { reviewer: { select: { id: true, name: true, email: true, role: true } }, requestedBy: { select: { id: true, name: true, email: true, role: true } } },
      });

      if (status === "Rejected") {
        await tx.decision.update({ where: { id: approval.decisionId }, data: { status: "Rejected" } });
        return updatedApproval;
      }

      const currentLevel = await tx.approval.findMany({ where: { decisionId: approval.decisionId, level: approval.level } });
      const currentLevelComplete = currentLevel.length > 0 && currentLevel.every((item) => item.status === "Approved");
      const nextLevelPending = await tx.approval.findFirst({ where: { decisionId: approval.decisionId, level: { gt: approval.level }, status: "Pending" } });

      if (currentLevelComplete && !nextLevelPending) await tx.decision.update({ where: { id: approval.decisionId }, data: { status: "Approved" } });
      else await tx.decision.update({ where: { id: approval.decisionId }, data: { status: "UnderReview" } });

      return updatedApproval;
    });

    await createNotification({ userId: approval.requestedById, type: `APPROVAL_${status.toUpperCase()}`, title: `Approval ${status.toLowerCase()}`, message: `${approval.decision.title} was ${status.toLowerCase()} by the assigned reviewer.`, entityType: "Decision", entityId: approval.decisionId });
    await logActivity({ userId, action: `APPROVAL_${status.toUpperCase()}`, entityType: "Approval", entityId: approvalId, decisionId: approval.decisionId, teamId: approval.decision.teamId, metadata: { level: approval.level, comments: comments || "" } });

    res.status(200).json({ message: `Approval ${status.toLowerCase()} successfully`, approval: result });
  } catch (error) {
    console.error("Act on approval error:", error);
    res.status(500).json({ message: "Failed to process approval" });
  }
};

const getMyPendingApprovals = async (req, res) => {
  try {
    const approvals = await prisma.approval.findMany({
      where: { reviewerId: req.user.userId, status: "Pending" },
      include: {
        decision: { select: { id: true, title: true, status: true, teamId: true, team: { select: { id: true, name: true } }, createdAt: true, updatedAt: true } },
        requestedBy: { select: { id: true, name: true, email: true } },
      },
      orderBy: { createdAt: "desc" },
    });
    res.status(200).json(approvals);
  } catch (error) {
    console.error("Pending approvals error:", error);
    res.status(500).json({ message: "Failed to fetch pending approvals" });
  }
};

export { listApprovals, requestApproval, actOnApproval, getMyPendingApprovals };
