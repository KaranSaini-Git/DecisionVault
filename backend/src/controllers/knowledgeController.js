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
      ...(search
        ? {
            OR: [
              { filename: { contains: search, mode: "insensitive" } },
              { tags: { contains: search, mode: "insensitive" } },
              {
                decision: {
                  title: { contains: search, mode: "insensitive" },
                },
              },
            ],
          }
        : {}),
    };

    const decisionWhere = {
      ...(teamId ? { teamId } : {}),
      ...(search
        ? {
            OR: [
              { title: { contains: search, mode: "insensitive" } },
              {
                problemStatement: {
                  contains: search,
                  mode: "insensitive",
                },
              },
            ],
          }
        : {}),
    };

    const peopleWhere = search
      ? {
          OR: [
            { name: { contains: search, mode: "insensitive" } },
            { email: { contains: search, mode: "insensitive" } },
          ],
        }
      : {};

    let documents = [];
    let total = 0;
    let decisions = [];
    let people = [];

    if (tab === "documents" || tab === "all") {
      [documents, total] = await Promise.all([
        prisma.document.findMany({
          where: documentWhere,
          include: {
            decision: {
              select: {
                id: true,
                title: true,
                status: true,
                team: {
                  select: {
                    id: true,
                    name: true,
                  },
                },
              },
            },
            uploadedBy: {
              select: {
                id: true,
                name: true,
                role: true,
              },
            },
          },
          orderBy: {
            createdAt: "desc",
          },
          skip: (page - 1) * pageSize,
          take: pageSize,
        }),
        prisma.document.count({
          where: documentWhere,
        }),
      ]);
    }

    if (tab === "decisions" || tab === "all") {
      decisions = await prisma.decision.findMany({
        where: decisionWhere,
        include: {
          createdBy: {
            select: {
              id: true,
              name: true,
              role: true,
            },
          },
          team: {
            select: {
              id: true,
              name: true,
            },
          },
          documents: {
            include: {
              uploadedBy: {
                select: {
                  id: true,
                  name: true,
                  role: true,
                },
              },
            },
            orderBy: {
              createdAt: "desc",
            },
          },
          _count: {
            select: {
              documents: true,
              discussions: true,
              alternatives: true,
            },
          },
        },
        orderBy: {
          updatedAt: "desc",
        },
        take: tab === "all" ? 8 : pageSize,
        skip: tab === "all" ? 0 : (page - 1) * pageSize,
      });
    }

    if (tab === "people" || tab === "all") {
      people = await prisma.user.findMany({
        where: peopleWhere,
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          _count: {
            select: {
              decisions: true,
              discussions: true,
              approvalsToReview: true,
            },
          },
        },
        orderBy: {
          name: "asc",
        },
        take: tab === "all" ? 8 : pageSize,
        skip: tab === "all" ? 0 : (page - 1) * pageSize,
      });
    }

    const [
      categories,
      tagsData,
      topics,
      recentActivity,
      insightDecisions,
      decisionCount,
      documentCount,
      teamCount,
    ] = await Promise.all([
      prisma.document.findMany({
        distinct: ["category"],
        select: {
          category: true,
        },
        orderBy: {
          category: "asc",
        },
      }),
      prisma.document.findMany({
        select: {
          tags: true,
        },
        where: {
          NOT: {
            tags: "",
          },
        },
        take: 500,
      }),
      prisma.decision.findMany({
        select: {
          id: true,
          title: true,
          status: true,
          _count: {
            select: {
              alternatives: true,
              documents: true,
              discussions: true,
            },
          },
        },
        orderBy: {
          updatedAt: "desc",
        },
        take: 10,
      }),
      prisma.auditLog.findMany({
        take: 8,
        orderBy: {
          createdAt: "desc",
        },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              role: true,
            },
          },
        },
      }),
      prisma.decision.findMany({
        select: {
          id: true,
          title: true,
          status: true,
          _count: {
            select: {
              alternatives: true,
              documents: true,
              discussions: true,
            },
          },
        },
        orderBy: {
          updatedAt: "desc",
        },
        take: 8,
      }),
      prisma.decision.count({
        where: decisionWhere,
      }),
      prisma.document.count({
        where: documentWhere,
      }),
      prisma.team.count(),
    ]);

    const tagSet = new Set();

    tagsData.forEach((item) => {
      item.tags
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean)
        .forEach((tag) => tagSet.add(tag));
    });

    res.status(200).json({
      documents,
      decisions,
      people,
      pagination: {
        page,
        pageSize,
        total:
          tab === "documents"
            ? total
            : tab === "decisions"
              ? decisionCount
              : tab === "people"
                ? await prisma.user.count({
                    where: peopleWhere,
                  })
                : total,
      },
      filters: {
        categories: categories.map((item) => item.category),
        tags: [...tagSet],
      },
      topics,
      insights: insightDecisions.map((decision) => ({
        id: decision.id,
        title: decision._count.documents
          ? "Evidence-backed decision"
          : decision._count.alternatives
            ? "Options worth revisiting"
            : "Decision record",
        detail: `${decision.title} · ${decision._count.alternatives} alternatives · ${decision._count.documents} documents · ${decision._count.discussions} discussion entries`,
        status: decision.status,
      })),
      recentActivity,
      stats: {
        documents: documentCount,
        decisions: decisionCount,
        teams: teamCount,
        recent: recentActivity.length,
      },
    });
  } catch (error) {
    console.error("Knowledge error:", error);
    res.status(500).json({
      message: "Failed to fetch knowledge repository",
    });
  }
};

const getKnowledgeGraph = async (req, res) => {
  try {
    const decisionId = req.query.decisionId
      ? Number(req.query.decisionId)
      : null;
    const search = String(req.query.search || "").trim();

    if (
      decisionId !== null &&
      (!Number.isInteger(decisionId) || decisionId <= 0)
    ) {
      return res.status(400).json({
        message: "Invalid decision ID",
      });
    }

    const optionWhere = search
      ? {
          OR: [
            {
              title: {
                contains: search,
                mode: "insensitive",
              },
            },
            {
              problemStatement: {
                contains: search,
                mode: "insensitive",
              },
            },
            {
              team: {
                name: {
                  contains: search,
                  mode: "insensitive",
                },
              },
            },
            {
              createdBy: {
                name: {
                  contains: search,
                  mode: "insensitive",
                },
              },
            },
          ],
        }
      : {};

    const decisionOptions = await prisma.decision.findMany({
      where: optionWhere,
      select: {
        id: true,
        title: true,
        status: true,
        updatedAt: true,
        team: {
          select: {
            id: true,
            name: true,
          },
        },
        createdBy: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: {
        updatedAt: "desc",
      },
      take: 30,
    });

    if (decisionId === null) {
      return res.status(200).json({
        decisionOptions,
        recommendedDecisionId: decisionOptions[0]?.id || null,
        focusDecisionId: null,
        focusDecision: null,
        nodes: [],
        edges: [],
      });
    }

    const decision = await prisma.decision.findUnique({
      where: {
        id: decisionId,
      },
      include: {
        createdBy: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
          },
        },
        team: {
          include: {
            _count: {
              select: {
                members: true,
                decisions: true,
              },
            },
          },
        },
        documents: {
          include: {
            uploadedBy: {
              select: {
                id: true,
                name: true,
                role: true,
              },
            },
          },
          orderBy: {
            createdAt: "desc",
          },
          take: 20,
        },
        discussions: {
          include: {
            createdBy: {
              select: {
                id: true,
                name: true,
                role: true,
              },
            },
          },
          orderBy: {
            createdAt: "desc",
          },
          take: 20,
        },
        alternatives: {
          orderBy: {
            id: "asc",
          },
          take: 20,
        },
      },
    });

    if (!decision) {
      return res.status(404).json({
        message: "Decision not found",
        decisionOptions,
        nodes: [],
        edges: [],
      });
    }

    const [documentCount, alternativeCount, discussionCount] =
      await Promise.all([
        prisma.document.count({
          where: { decisionId: decision.id },
        }),
        prisma.alternative.count({
          where: { decisionId: decision.id },
        }),
        prisma.discussion.count({
          where: { decisionId: decision.id },
        }),
      ]);

    const nodes = [];
    const edges = [];
    const nodeIds = new Set();
    const edgeIds = new Set();

    const addNode = (node) => {
      if (!node?.id || nodeIds.has(node.id)) {
        return;
      }

      nodeIds.add(node.id);
      nodes.push(node);
    };

    const addEdge = (source, target, relationship, type) => {
      if (!source || !target || source === target) {
        return;
      }

      if (!nodeIds.has(source) || !nodeIds.has(target)) {
        return;
      }

      const id = `${source}:${target}:${type}`;

      if (edgeIds.has(id)) {
        return;
      }

      edgeIds.add(id);

      edges.push({
        id,
        source,
        target,
        relationship,
        type,
      });
    };

    const decisionNodeId = `decision:${decision.id}`;

    addNode({
      id: decisionNodeId,
      type: "decision",
      label: decision.title,
      subtitle: decision.status,
      entityId: decision.id,
      priority: 100,
      metadata: {
        decisionId: decision.id,
        decisionTitle: decision.title,
        status: decision.status,
        problemStatement: decision.problemStatement,
        createdAt: decision.createdAt,
        updatedAt: decision.updatedAt,
        createdBy: decision.createdBy?.name || "Unknown",
        createdById: decision.createdBy?.id || null,
        teamName: decision.team?.name || "Unassigned",
        teamId: decision.team?.id || null,
        documents: documentCount,
        alternatives: alternativeCount,
        discussions: discussionCount,
      },
    });

    if (decision.createdBy) {
      const id = `person:${decision.createdBy.id}`;

      addNode({
        id,
        type: "person",
        label: decision.createdBy.name,
        subtitle: decision.createdBy.role || "Employee",
        entityId: decision.createdBy.id,
        priority: 95,
        metadata: {
          name: decision.createdBy.name,
          role: decision.createdBy.role || "Employee",
          email: decision.createdBy.email,
          decisionId: decision.id,
          decisionTitle: decision.title,
        },
      });

      addEdge(
        decisionNodeId,
        id,
        "created by",
        "created",
      );
    }

    if (decision.team) {
      const id = `team:${decision.team.id}`;

      addNode({
        id,
        type: "team",
        label: decision.team.name,
        subtitle: `${decision.team._count.members} members`,
        entityId: decision.team.id,
        priority: 92,
        metadata: {
          name: decision.team.name,
          description: decision.team.description || "",
          memberCount: decision.team._count.members,
          decisionCount: decision.team._count.decisions,
          decisionId: decision.id,
          decisionTitle: decision.title,
        },
      });

      addEdge(
        decisionNodeId,
        id,
        "belongs to",
        "team",
      );
    }

    const groups = [
      {
        key: "documents",
        label: "Documents",
        subtitle: `${documentCount} ${documentCount === 1 ? "document" : "documents"}`,
        iconType: "document",
        count: documentCount,
        relationship: "has documents",
      },
      {
        key: "alternatives",
        label: "Alternatives",
        subtitle: `${alternativeCount} ${alternativeCount === 1 ? "alternative" : "alternatives"}`,
        iconType: "alternative",
        count: alternativeCount,
        relationship: "has alternatives",
      },
      {
        key: "discussions",
        label: "Discussions",
        subtitle: `${discussionCount} ${discussionCount === 1 ? "discussion" : "discussions"}`,
        iconType: "discussion",
        count: discussionCount,
        relationship: "has discussions",
      },
    ];

    groups.forEach((group) => {
      const id = `group:${group.key}:${decision.id}`;

      addNode({
        id,
        type:
          group.iconType === "document"
            ? "document"
            : group.iconType === "alternative"
              ? "alternative"
              : "discussion",
        label: group.label,
        subtitle: group.subtitle,
        entityId: decision.id,
        priority: 90,
        metadata: {
          group: group.key,
          count: group.count,
          decisionId: decision.id,
          decisionTitle: decision.title,
        },
      });

      addEdge(
        decisionNodeId,
        id,
        group.relationship,
        group.key,
      );
    });

    decision.documents.forEach((document) => {
      const id = `document:${document.id}`;
      const groupId = `group:documents:${decision.id}`;

      addNode({
        id,
        type: "document",
        label: document.filename,
        subtitle: document.category || "General",
        entityId: document.id,
        priority: 70,
        metadata: {
          filename: document.filename,
          filePath: document.filePath,
          fileType:
            String(document.filename)
              .split(".")
              .pop()
              ?.toUpperCase() || "FILE",
          category: document.category || "General",
          tags: document.tags || "",
          uploadedBy:
            document.uploadedBy?.name ||
            "Workspace member",
          uploadedById:
            document.uploadedBy?.id || null,
          createdAt: document.createdAt,
          decisionId: decision.id,
          decisionTitle: decision.title,
        },
      });

      addEdge(
        groupId,
        id,
        "contains",
        "document-item",
      );
    });

    decision.alternatives.forEach((alternative) => {
      const id = `alternative:${alternative.id}`;
      const groupId = `group:alternatives:${decision.id}`;

      addNode({
        id,
        type: "alternative",
        label: alternative.name,
        subtitle: "Alternative",
        entityId: alternative.id,
        priority: 68,
        metadata: {
          name: alternative.name,
          pros: alternative.pros || "",
          cons: alternative.cons || "",
          risk: alternative.risk || "",
          feasibility: alternative.feasibility || "",
          cost: alternative.cost || "",
          decisionId: decision.id,
          decisionTitle: decision.title,
        },
      });

      addEdge(
        groupId,
        id,
        "contains",
        "alternative-item",
      );
    });

    decision.discussions.forEach((discussion) => {
      const id = `discussion:${discussion.id}`;
      const groupId = `group:discussions:${decision.id}`;

      const typeLabel =
        discussion.type === "MeetingNote"
          ? "Meeting note"
          : discussion.type === "Rationale"
            ? "Rationale"
            : "Discussion";

      addNode({
        id,
        type: "discussion",
        label: typeLabel,
        subtitle:
          discussion.createdBy?.name ||
          "Workspace member",
        entityId: discussion.id,
        priority: 66,
        metadata: {
          type: discussion.type,
          content: discussion.content || "",
          createdBy:
            discussion.createdBy?.name ||
            "Workspace member",
          createdById:
            discussion.createdBy?.id || null,
          createdAt: discussion.createdAt,
          decisionId: decision.id,
          decisionTitle: decision.title,
        },
      });

      addEdge(
        groupId,
        id,
        "contains",
        "discussion-item",
      );
    });

    return res.status(200).json({
      decisionOptions,
      recommendedDecisionId:
        decisionOptions[0]?.id || decision.id,
      focusDecisionId: decision.id,
      focusDecision: {
        id: decision.id,
        title: decision.title,
        status: decision.status,
      },
      nodes,
      edges,
    });
  } catch (error) {
    console.error("Knowledge graph error:", error);
    return res.status(500).json({
      message: "Failed to build knowledge graph",
    });
  }
};
export { getKnowledge, getKnowledgeGraph };
