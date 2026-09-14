import prisma from "../db/prisma.js";
import { logActivity } from "../services/activityService.js";

const VALID_STATUSES = ["Draft", "UnderReview", "Approved", "Rejected", "Archived"];
const getUserId = (req) => req.user?.userId;
const parseDecisionId = (value) => {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
};

const getOwnedDecision = async (decisionId, userId) => {
  const id = parseDecisionId(decisionId);
  if (!id || !userId) return null;
  return prisma.decision.findFirst({ where: { id, createdById: userId } });
};

const snapshotDecision = async (tx, decision, userId) => {
  const previous = await tx.decisionVersion.findFirst({ where: { decisionId: decision.id }, orderBy: { version: "desc" } });
  await tx.decisionVersion.create({
    data: {
      decisionId: decision.id,
      version: (previous?.version || 0) + 1,
      title: decision.title,
      problemStatement: decision.problemStatement,
      status: decision.status,
      changedById: userId,
    },
  });
};

const resolveTeam = async (teamId, userId) => {
  if (teamId === undefined || teamId === null || teamId === "") return null;
  const parsed = Number(teamId);
  if (!Number.isInteger(parsed) || parsed <= 0) return null;
  const membership = await prisma.teamMember.findUnique({ where: { teamId_userId: { teamId: parsed, userId } } });
  return membership ? parsed : null;
};

const createDecision = async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Authentication required" });

    const { title, problemStatement, status = "Draft", teamId } = req.body;
    if (!title?.trim()) return res.status(400).json({ message: "Decision title is required" });
    if (!problemStatement?.trim()) return res.status(400).json({ message: "Problem statement is required" });
    if (!VALID_STATUSES.includes(status)) return res.status(400).json({ message: "Invalid decision status" });

    const resolvedTeamId = await resolveTeam(teamId, userId);
    const decision = await prisma.$transaction(async (tx) => {
      const created = await tx.decision.create({
        data: {
          title: title.trim(),
          problemStatement: problemStatement.trim(),
          status,
          createdById: userId,
          teamId: resolvedTeamId,
        },
        include: { createdBy: { select: { id: true, name: true, email: true, role: true } }, alternatives: true, team: { select: { id: true, name: true } } },
      });
      await tx.decisionVersion.create({
        data: {
          decisionId: created.id,
          version: 1,
          title: created.title,
          problemStatement: created.problemStatement,
          status: created.status,
          changedById: userId,
        },
      });
      return created;
    });

    await logActivity({ userId, action: "DECISION_CREATED", entityType: "Decision", entityId: decision.id, decisionId: decision.id, teamId: decision.teamId, metadata: { title: decision.title } });
    res.status(201).json({ message: "Decision created successfully", decision });
  } catch (error) {
    console.error("Create decision error:", error);
    res.status(500).json({ message: "Failed to create decision" });
  }
};

const getDecisions = async (req, res) => {
  try {
    if (!getUserId(req)) return res.status(401).json({ message: "Authentication required" });
    const decisions = await prisma.decision.findMany({
      include: { createdBy: { select: { id: true, name: true, email: true, role: true } }, alternatives: true, team: { select: { id: true, name: true } }, _count: { select: { documents: true, discussions: true, approvals: true } } },
      orderBy: { updatedAt: "desc" },
    });
    res.status(200).json({ decisions });
  } catch (error) {
    console.error("Get decisions error:", error);
    res.status(500).json({ message: "Failed to fetch decisions" });
  }
};

const getDecisionById = async (req, res) => {
  try {
    const userId = getUserId(req);
    const decisionId = parseDecisionId(req.params.decisionId);
    if (!userId) return res.status(401).json({ message: "Authentication required" });
    if (!decisionId) return res.status(400).json({ message: "Invalid decision ID" });

    const decision = await prisma.decision.findUnique({
      where: { id: decisionId },
      include: {
        createdBy: { select: { id: true, name: true, email: true, role: true } },
        team: { select: { id: true, name: true } },
        alternatives: { orderBy: { id: "asc" } },
        approvals: { orderBy: [{ level: "asc" }, { createdAt: "asc" }], include: { reviewer: { select: { id: true, name: true, email: true, role: true } }, requestedBy: { select: { id: true, name: true, email: true, role: true } } } },
        versions: { orderBy: { version: "desc" }, take: 20, include: { changedBy: { select: { id: true, name: true, role: true } } } },
      },
    });

    if (!decision) return res.status(404).json({ message: "Decision not found" });
    res.status(200).json({ decision });
  } catch (error) {
    console.error("Get decision error:", error);
    res.status(500).json({ message: "Failed to fetch decision" });
  }
};

const updateDecision = async (req, res) => {
  try {
    const userId = getUserId(req);
    const decisionId = parseDecisionId(req.params.decisionId);
    if (!userId) return res.status(401).json({ message: "Authentication required" });
    if (!decisionId) return res.status(400).json({ message: "Invalid decision ID" });

    const existingDecision = ["Manager", "Administrator"].includes(req.user.role)
      ? await prisma.decision.findUnique({ where: { id: decisionId } })
      : await getOwnedDecision(decisionId, userId);
    if (!existingDecision) return res.status(404).json({ message: "Decision not found" });

    const { title, problemStatement, status, teamId } = req.body;
    const data = {};

    if (title !== undefined) {
      if (!title.trim()) return res.status(400).json({ message: "Decision title cannot be empty" });
      data.title = title.trim();
    }
    if (problemStatement !== undefined) {
      if (!problemStatement.trim()) return res.status(400).json({ message: "Problem statement cannot be empty" });
      data.problemStatement = problemStatement.trim();
    }
    if (status !== undefined) {
      if (!VALID_STATUSES.includes(status)) return res.status(400).json({ message: "Invalid decision status" });
      data.status = status;
    }
    if (teamId !== undefined) data.teamId = await resolveTeam(teamId, userId);
    if (!Object.keys(data).length) return res.status(400).json({ message: "No changes provided" });

    const decision = await prisma.$transaction(async (tx) => {
      const updated = await tx.decision.update({ where: { id: decisionId }, data, include: { createdBy: { select: { id: true, name: true, email: true, role: true } }, team: { select: { id: true, name: true } }, alternatives: { orderBy: { id: "asc" } } } });
      await snapshotDecision(tx, updated, userId);
      return updated;
    });

    await logActivity({ userId, action: "DECISION_UPDATED", entityType: "Decision", entityId: decision.id, decisionId: decision.id, teamId: decision.teamId, metadata: data });
    res.status(200).json({ message: "Decision updated successfully", decision });
  } catch (error) {
    console.error("Update decision error:", error);
    res.status(500).json({ message: "Failed to update decision" });
  }
};

const deleteDecision = async (req, res) => {
  try {
    const userId = getUserId(req);
    const decisionId = parseDecisionId(req.params.decisionId);
    if (!userId) return res.status(401).json({ message: "Authentication required" });
    if (!decisionId) return res.status(400).json({ message: "Invalid decision ID" });

    const existingDecision = ["Manager", "Administrator"].includes(req.user.role)
      ? await prisma.decision.findUnique({ where: { id: decisionId } })
      : await getOwnedDecision(decisionId, userId);
    if (!existingDecision) return res.status(404).json({ message: "Decision not found" });

    await prisma.decision.delete({ where: { id: decisionId } });
    await logActivity({ userId, action: "DECISION_DELETED", entityType: "Decision", entityId: decisionId, teamId: existingDecision.teamId, metadata: { title: existingDecision.title } });
    res.status(200).json({ message: "Decision deleted successfully" });
  } catch (error) {
    console.error("Delete decision error:", error);
    res.status(500).json({ message: "Failed to delete decision" });
  }
};

export { createDecision, getDecisions, getDecisionById, updateDecision, deleteDecision };
