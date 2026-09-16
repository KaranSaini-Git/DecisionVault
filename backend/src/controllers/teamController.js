import prisma from "../db/prisma.js";
import { logActivity, createNotification } from "../services/activityService.js";
import { canManageTeam, MANAGE_TEAM_ROLES } from "../services/authorizationService.js";

const teamInclude = {
  members: {
    orderBy: { joinedAt: "asc" },
    include: {
      user: {
        select: { id: true, name: true, email: true, role: true },
      },
    },
  },
};

const requireTeamAccess = async (teamId, userId) => {
  return prisma.teamMember.findUnique({
    where: { teamId_userId: { teamId, userId } },
  });
};

const listTeams = async (req, res) => {
  try {
    const userId = req.user.userId;
    const role = req.user.role;

    const where = role === "Administrator" ? {} : { members: { some: { userId } } };

    const teams = await prisma.team.findMany({
      where,
      include: {
        ...teamInclude,
        _count: { select: { members: true, decisions: true } },
      },
      orderBy: { name: "asc" },
    });

    const enrichedTeams = await Promise.all(
      teams.map(async (team) => {
        const decisionIds = (
          await prisma.decision.findMany({
            where: { teamId: team.id },
            select: { id: true },
          })
        ).map((item) => item.id);

        const contributionCount = await prisma.auditLog.count({
          where: {
            userId,
            OR: [
              { teamId: team.id },
              { decisionId: { in: decisionIds.length ? decisionIds : [-1] } },
            ],
          },
        });

        const creatorContribution = decisionIds.length
          ? await prisma.decision.count({ where: { id: { in: decisionIds }, createdById: userId } })
          : 0;

        return {
          ...team,
          userMembership: team.members.find((member) => member.userId === userId) || null,
          contributionCount: contributionCount + creatorContribution,
        };
      }),
    );

    res.status(200).json({ teams: enrichedTeams });
  } catch (error) {
    console.error("List teams error:", error);
    res.status(500).json({ message: "Failed to fetch teams" });
  }
};

const getTeam = async (req, res) => {
  try {
    const teamId = Number(req.params.teamId);
    const userId = req.user.userId;

    if (!Number.isInteger(teamId) || teamId <= 0) {
      return res.status(400).json({ message: "Invalid team ID" });
    }

    if (req.user.role !== "Administrator" && !(await requireTeamAccess(teamId, userId))) {
      return res.status(403).json({ message: "You are not a member of this team" });
    }

    const team = await prisma.team.findUnique({
      where: { id: teamId },
      include: {
        ...teamInclude,
        decisions: {
          orderBy: { updatedAt: "desc" },
          include: { createdBy: { select: { id: true, name: true, role: true } } },
        },
        _count: { select: { members: true, decisions: true } },
      },
    });

    if (!team) return res.status(404).json({ message: "Team not found" });

    const decisionIds = team.decisions.map((decision) => decision.id);
    const [contributionLogs, discussions, documents, approvals] = decisionIds.length
      ? await Promise.all([
          prisma.auditLog.findMany({ where: { decisionId: { in: decisionIds } }, include: { user: { select: { id: true, name: true, role: true } } }, orderBy: { createdAt: "desc" } }),
          prisma.discussion.findMany({ where: { decisionId: { in: decisionIds } }, select: { id: true, decisionId: true, createdById: true, createdAt: true } }),
          prisma.document.findMany({ where: { decisionId: { in: decisionIds } }, select: { id: true, decisionId: true, uploadedById: true, createdAt: true } }),
          prisma.approval.findMany({ where: { decisionId: { in: decisionIds } }, select: { id: true, decisionId: true, reviewerId: true, requestedById: true, createdAt: true } }),
        ])
      : [[], [], [], []];

    const memberContributions = team.members.map((member) => {
      const memberLogs = contributionLogs.filter((log) => log.userId === member.userId);
      const createdDecisionIds = team.decisions.filter((decision) => decision.createdById === member.userId).map((decision) => decision.id);
      const discussionCount = discussions.filter((item) => item.createdById === member.userId).length;
      const documentCount = documents.filter((item) => item.uploadedById === member.userId).length;
      const approvalCount = approvals.filter((item) => item.reviewerId === member.userId || item.requestedById === member.userId).length;
      const memberDecisionIds = new Set([
        ...memberLogs.map((log) => log.decisionId).filter(Boolean),
        ...createdDecisionIds,
        ...discussions.filter((item) => item.createdById === member.userId).map((item) => item.decisionId),
        ...documents.filter((item) => item.uploadedById === member.userId).map((item) => item.decisionId),
        ...approvals.filter((item) => item.reviewerId === member.userId || item.requestedById === member.userId).map((item) => item.decisionId),
      ]);
      const auditContribution = memberLogs.length;
      const creatorContribution = createdDecisionIds.filter((id) => !memberLogs.some((log) => log.decisionId === id && log.action === "DECISION_CREATED")).length;
      return {
        user: member.user,
        teamRole: member.teamRole,
        joinedAt: member.joinedAt,
        contributions: auditContribution + creatorContribution + discussionCount + documentCount + approvalCount,
        decisionsContributed: memberDecisionIds.size,
        breakdown: { decisions: createdDecisionIds.length, discussions: discussionCount, documents: documentCount, approvals: approvalCount },
      };
    }).sort((a, b) => b.contributions - a.contributions);

    const myLogs = contributionLogs.filter((log) => log.userId === userId);
    const myCreatedDecisionIds = team.decisions.filter((decision) => decision.createdById === userId).map((decision) => decision.id);
    const myDecisionIds = [...new Set([...myLogs.map((log) => log.decisionId).filter(Boolean), ...myCreatedDecisionIds])];

    res.status(200).json({
      team: {
        ...team,
        contributionSummary: {
          totalActivity: contributionLogs.length,
          membersActive: new Set(contributionLogs.map((log) => log.userId).filter(Boolean)).size,
          myContributions: myLogs.length + myCreatedDecisionIds.filter((id) => !myLogs.some((log) => log.decisionId === id && log.action === "DECISION_CREATED")).length,
          myDecisions: myDecisionIds.length,
        },
        memberContributions,
        recentActivity: contributionLogs.slice(0, 12),
      },
    });
  } catch (error) {
    console.error("Get team error:", error);
    res.status(500).json({ message: "Failed to fetch team" });
  }
};

const createTeam = async (req, res) => {
  try {
    const role = String(req.user.role || "").trim().toLowerCase();
    if (!["manager", "administrator"].includes(role)) {
      return res.status(403).json({ message: "Only managers and administrators can create teams" });
    }

    const userId = req.user.userId;
    const { name, description = "" } = req.body;

    if (!name?.trim()) return res.status(400).json({ message: "Team name is required" });

    const team = await prisma.team.create({
      data: {
        name: name.trim(),
        description: description.trim(),
        members: { create: { userId, teamRole: role === "manager" ? "Manager" : "Owner" } },
      },
      include: teamInclude,
    });

    await logActivity({
      userId,
      action: "TEAM_CREATED",
      entityType: "Team",
      entityId: team.id,
      teamId: team.id,
    });

    res.status(201).json({ team });
  } catch (error) {
    console.error("Create team error:", error);
    if (error?.code === "P2002") return res.status(409).json({ message: "A team with this name already exists" });
    res.status(500).json({ message: "Failed to create team" });
  }
};

const addTeamMember = async (req, res) => {
  try {
    const teamId = Number(req.params.teamId);
    const userId = Number(req.body.userId);
    const teamRole = req.body.teamRole?.trim() || "Member";

    if (!Number.isInteger(teamId) || !Number.isInteger(userId)) return res.status(400).json({ message: "Invalid team or user ID" });

    const validTeamRoles = ["Member", "Lead", "Manager"];
    if (!validTeamRoles.includes(teamRole)) {
      return res.status(400).json({ message: "Invalid team role" });
    }

    if (!(await canManageTeam(teamId, req.user))) {
      return res.status(403).json({ message: "You do not have permission to manage this team" });
    }

    const member = await prisma.teamMember.create({
      data: { teamId, userId, teamRole },
      include: { user: { select: { id: true, name: true, email: true, role: true } } },
    });

    await createNotification({
      userId,
      type: "TEAM",
      title: "You were added to a team",
      message: "You have been added to a DecisionVault team.",
      entityType: "Team",
      entityId: teamId,
    });

    await logActivity({
      userId: req.user.userId,
      action: "TEAM_MEMBER_ADDED",
      entityType: "TeamMember",
      entityId: member.id,
      teamId,
      metadata: { addedUserId: userId, teamRole },
    });

    res.status(201).json({ member });
  } catch (error) {
    console.error("Add team member error:", error);
    if (error?.code === "P2002") return res.status(409).json({ message: "User is already a member of this team" });
    res.status(500).json({ message: "Failed to add team member" });
  }
};

const removeTeamMember = async (req, res) => {
  try {
    const teamId = Number(req.params.teamId);
    const userId = Number(req.params.userId);
    if (!(await canManageTeam(teamId, req.user))) {
      return res.status(403).json({ message: "You do not have permission to manage this team" });
    }

    const targetMembership = await requireTeamAccess(teamId, userId);
    if (!targetMembership) return res.status(404).json({ message: "Team member not found" });

    const remainingManagers = await prisma.teamMember.count({
      where: {
        teamId,
        id: { not: targetMembership.id },
        teamRole: { in: MANAGE_TEAM_ROLES },
      },
    });
    if (remainingManagers === 0) {
      return res.status(409).json({ message: "A team must retain at least one team manager" });
    }

    await prisma.teamMember.delete({
      where: { teamId_userId: { teamId, userId } },
    });

    await logActivity({
      userId: req.user.userId,
      action: "TEAM_MEMBER_REMOVED",
      entityType: "TeamMember",
      teamId,
      metadata: { removedUserId: userId },
    });

    res.status(200).json({ message: "Team member removed" });
  } catch (error) {
    console.error("Remove team member error:", error);
    res.status(500).json({ message: "Failed to remove team member" });
  }
};

export { listTeams, getTeam, createTeam, addTeamMember, removeTeamMember };
