import prisma from "../db/prisma.js";

const getKnowledge = async (req, res) => {
  try {
    const search = req.query.search?.trim() || "";
    const tab = req.query.tab || "all";
    const category = req.query.category?.trim() || "";
    const teamId = req.query.teamId ? Number(req.query.teamId) : null;
    const page = Math.max(1, Number(req.query.page) || 1);
    const pageSize = Math.min(50, Math.max(5, Number(req.query.pageSize) || 8));

    const documentWhere = {
      ...(category ? { category } : {}),
      ...(teamId ? { decision: { teamId } } : {}),
      ...(search ? {
        OR: [
          { filename: { contains: search, mode: "insensitive" } },
          { tags: { contains: search, mode: "insensitive" } },
          { decision: { title: { contains: search, mode: "insensitive" } } },
        ],
      } : {}),
    };

    const decisionWhere = {
      ...(teamId ? { teamId } : {}),
      ...(search ? {
        OR: [
          { title: { contains: search, mode: "insensitive" } },
          { problemStatement: { contains: search, mode: "insensitive" } },
        ],
      } : {}),
    };

    const peopleWhere = search ? {
      OR: [
        { name: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
      ],
    } : {};

    let documents = [];
    let total = 0;
    let decisions = [];
    let people = [];

    if (tab === "documents" || tab === "all") {
      [documents, total] = await Promise.all([
        prisma.document.findMany({
          where: documentWhere,
          include: {
            decision: { select: { id: true, title: true, status: true, team: { select: { id: true, name: true } } } },
            uploadedBy: { select: { id: true, name: true, role: true } },
          },
          orderBy: { createdAt: "desc" },
          skip: (page - 1) * pageSize,
          take: pageSize,
        }),
        prisma.document.count({ where: documentWhere }),
      ]);
    }

    if (tab === "decisions" || tab === "all") {
      decisions = await prisma.decision.findMany({
        where: decisionWhere,
        include: { createdBy: { select: { id: true, name: true, role: true } }, team: { select: { id: true, name: true } }, _count: { select: { documents: true, discussions: true, alternatives: true } } },
        orderBy: { updatedAt: "desc" },
        take: tab === "all" ? 8 : pageSize,
        skip: tab === "all" ? 0 : (page - 1) * pageSize,
      });
    }

    if (tab === "people" || tab === "all") {
      people = await prisma.user.findMany({
        where: peopleWhere,
        select: { id: true, name: true, email: true, role: true, _count: { select: { decisions: true, discussions: true, approvalsToReview: true } } },
        orderBy: { name: "asc" },
        take: tab === "all" ? 8 : pageSize,
        skip: tab === "all" ? 0 : (page - 1) * pageSize,
      });
    }

    const [categories, tagsData, topics, recentActivity, insightDecisions, decisionCount, documentCount, teamCount] = await Promise.all([
      prisma.document.findMany({ distinct: ["category"], select: { category: true }, orderBy: { category: "asc" } }),
      prisma.document.findMany({ select: { tags: true }, where: { NOT: { tags: "" } }, take: 500 }),
      prisma.decision.findMany({ select: { id: true, title: true, status: true, _count: { select: { alternatives: true, documents: true, discussions: true } } }, orderBy: { updatedAt: "desc" }, take: 10 }),
      prisma.auditLog.findMany({ take: 8, orderBy: { createdAt: "desc" }, include: { user: { select: { id: true, name: true, role: true } } } }),
      prisma.decision.findMany({ select: { id: true, title: true, status: true, _count: { select: { alternatives: true, documents: true, discussions: true } } }, orderBy: { updatedAt: "desc" }, take: 8 }),
      prisma.decision.count({ where: decisionWhere }),
      prisma.document.count({ where: documentWhere }),
      prisma.team.count(),
    ]);

    const tagSet = new Set();
    tagsData.forEach((item) => item.tags.split(",").map((tag) => tag.trim()).filter(Boolean).forEach((tag) => tagSet.add(tag)));

    res.status(200).json({
      documents,
      decisions,
      people,
      pagination: { page, pageSize, total: tab === "documents" ? total : tab === "decisions" ? decisionCount : tab === "people" ? await prisma.user.count({ where: peopleWhere }) : total },
      filters: { categories: categories.map((item) => item.category), tags: [...tagSet] },
      topics,
      insights: insightDecisions.map((decision) => ({
        id: decision.id,
        title: decision._count.documents ? "Evidence-backed decision" : decision._count.alternatives ? "Options worth revisiting" : "Decision record",
        detail: `${decision.title} · ${decision._count.alternatives} alternatives · ${decision._count.documents} documents · ${decision._count.discussions} discussion entries`,
        status: decision.status,
      })),
      recentActivity,
      stats: { documents: documentCount, decisions: decisionCount, teams: teamCount, recent: recentActivity.length },
    });
  } catch (error) {
    console.error("Knowledge error:", error);
    res.status(500).json({ message: "Failed to fetch knowledge repository" });
  }
};

export { getKnowledge };
