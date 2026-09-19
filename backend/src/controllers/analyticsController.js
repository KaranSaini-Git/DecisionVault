import prisma from "../db/prisma.js";

const getAnalytics = async (req, res) => {
  try {
    if (!["Manager", "Administrator"].includes(req.user.role)) {
      return res
        .status(403)
        .json({ message: "Manager or Administrator access required" });
    }

    let decisionWhere = {};
    let teamWhere = {};
    let teamIds = [];

    if (req.user.role === "Manager") {
      const memberships = await prisma.teamMember.findMany({
        where: {
          userId: req.user.userId,
          teamRole: { in: ["Owner", "Manager", "Lead"] },
        },
        select: { teamId: true },
      });
      teamIds = memberships.map((item) => item.teamId);
      decisionWhere = {
        OR: [
          { createdById: req.user.userId },
          ...(teamIds.length ? [{ teamId: { in: teamIds } }] : []),
        ],
      };
      teamWhere = teamIds.length ? { id: { in: teamIds } } : { id: -1 };
    }

    const [
      totalDecisions,
      approved,
      rejected,
      underReview,
      drafts,
      totalUsers,
      totalTeams,
      totalDocuments,
      totalDiscussions,
      pendingApprovals,
      decidedApprovals,
    ] = await Promise.all([
      prisma.decision.count({ where: decisionWhere }),
      prisma.decision.count({
        where: { ...decisionWhere, status: "Approved" },
      }),
      prisma.decision.count({
        where: { ...decisionWhere, status: "Rejected" },
      }),
      prisma.decision.count({
        where: { ...decisionWhere, status: "UnderReview" },
      }),
      prisma.decision.count({ where: { ...decisionWhere, status: "Draft" } }),
      req.user.role === "Administrator"
        ? prisma.user.count()
        : teamIds.length
          ? prisma.user.count({
              where: { teamMemberships: { some: { teamId: { in: teamIds } } } },
            })
          : prisma.user.count({ where: { id: req.user.userId } }),
      prisma.team.count({ where: teamWhere }),
      prisma.document.count({ where: { decision: decisionWhere } }),
      prisma.discussion.count({ where: { decision: decisionWhere } }),
      prisma.approval.count({
        where: { status: "Pending", decision: decisionWhere },
      }),
      prisma.approval.count({
        where: {
          status: { in: ["Approved", "Rejected"] },
          decision: decisionWhere,
        },
      }),
    ]);

    const recent = await prisma.decision.findMany({
      where: decisionWhere,
      take: 8,
      orderBy: { updatedAt: "desc" },
      include: {
        createdBy: { select: { id: true, name: true, role: true } },
        team: { select: { id: true, name: true } },
      },
    });

    const teamBreakdown = await prisma.team.findMany({
      where: teamWhere,
      include: { _count: { select: { members: true, decisions: true } } },
      orderBy: { name: "asc" },
      take: 20,
    });

    res.status(200).json({
      summary: {
        totalDecisions,
        approved,
        rejected,
        underReview,
        drafts,
        approvalRate: totalDecisions
          ? Math.round((approved / totalDecisions) * 100)
          : 0,
        totalUsers,
        totalTeams,
        totalDocuments,
        totalDiscussions,
        pendingApprovals,
        decidedApprovals,
      },
      recent,
      teamBreakdown,
    });
  } catch (error) {
    console.error("Analytics error:", error);
    res.status(500).json({ message: "Failed to fetch analytics" });
  }
};

export { getAnalytics };
