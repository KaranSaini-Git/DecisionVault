import prisma from "../db/prisma.js";

const MANAGE_TEAM_ROLES = ["Owner", "Manager", "Lead"];

const getTeamMembership = async (teamId, userId) => {
  if (!Number.isInteger(Number(teamId)) || !Number.isInteger(Number(userId))) return null;
  return prisma.teamMember.findUnique({
    where: { teamId_userId: { teamId: Number(teamId), userId: Number(userId) } },
  });
};

const canManageTeam = async (teamId, user) => {
  if (!user?.userId) return false;
  if (user.role === "Administrator") return true;

  const membership = await getTeamMembership(teamId, user.userId);
  return Boolean(membership && MANAGE_TEAM_ROLES.includes(membership.teamRole));
};

const canManageDecision = async (decision, user) => {
  if (!decision || !user?.userId) return false;
  if (user.role === "Administrator") return true;
  if (Number(decision.createdById) === Number(user.userId)) return true;

  if (user.role === "Manager" && decision.teamId) {
    return canManageTeam(decision.teamId, user);
  }

  return false;
};

const canManageDecisionId = async (decisionId, user) => {
  const decision = await prisma.decision.findUnique({
    where: { id: Number(decisionId) },
    select: { id: true, createdById: true, teamId: true },
  });

  if (!decision) return { decision: null, allowed: false };
  return { decision, allowed: await canManageDecision(decision, user) };
};

export { MANAGE_TEAM_ROLES, getTeamMembership, canManageTeam, canManageDecision, canManageDecisionId };
