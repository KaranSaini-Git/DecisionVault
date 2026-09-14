import prisma from "../db/prisma.js";

const getAnalytics = async (req, res) => {
  try {
    if (!["Manager", "Administrator"].includes(req.user.role)) return res.status(403).json({ message: "Manager or Administrator access required" });

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
      prisma.decision.count(),
      prisma.decision.count({ where: { status: "Approved" } }),
      prisma.decision.count({ where: { status: "Rejected" } }),
      prisma.decision.count({ where: { status: "UnderReview" } }),
      prisma.decision.count({ where: { status: "Draft" } }),
      prisma.user.count(),
      prisma.team.count(),
      prisma.document.count(),
      prisma.discussion.count(),
      prisma.approval.count({ where: { status: "Pending" } }),
      prisma.approval.count({ where: { status: { in: ["Approved", "Rejected"] } } }),
    ]);

    const recent = await prisma.decision.findMany({
      take: 8,
      orderBy: { updatedAt: "desc" },
      include: { createdBy: { select: { id: true, name: true, role: true } }, team: { select: { id: true, name: true } } },
    });

    const teamBreakdown = await prisma.team.findMany({
      include: {
        _count: { select: { members: true, decisions: true } },
      },
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
        approvalRate: totalDecisions ? Math.round((approved / totalDecisions) * 100) : 0,
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
