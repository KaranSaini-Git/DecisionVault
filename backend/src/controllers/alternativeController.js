import prisma from "../db/prisma.js";
import { logActivity } from "../services/activityService.js";
import { canManageDecision } from "../services/authorizationService.js";

const getOwnedDecision = async (decisionId, userId) => {
  return prisma.decision.findFirst({
    where: {
      id: Number(decisionId),
      createdById: userId,
    },
  });
};

const createAlternative = async (req, res) => {
  try {
    const {
      name,
      pros = "",
      cons = "",
      cost = "",
      feasibility = "",
      risk = "",
    } = req.body;
    const { decisionId } = req.params;

    if (!name?.trim()) {
      return res.status(400).json({
        message: "Alternative name is required",
      });
    }

    const decision = await prisma.decision.findUnique({
      where: { id: Number(decisionId) },
    });

    if (!decision) {
      return res.status(404).json({ message: "Decision not found" });
    }

    if (!(await canManageDecision(decision, req.user))) {
      return res.status(403).json({
        message:
          "You do not have permission to modify alternatives for this decision",
      });
    }

    const alternative = await prisma.alternative.create({
      data: {
        name: name.trim(),
        pros,
        cons,
        cost,
        feasibility,
        risk,
        decisionId: decision.id,
      },
    });

    await logActivity({
      userId: req.user.userId,
      action: "ALTERNATIVE_CREATED",
      entityType: "Alternative",
      entityId: alternative.id,
      decisionId: decision.id,
      metadata: { name: alternative.name },
    });

    return res.status(201).json(alternative);
  } catch (error) {
    console.error("Create alternative error:", error);

    return res.status(500).json({
      message: "Failed to create alternative",
    });
  }
};

const getAlternative = async (req, res) => {
  try {
    const { decisionId } = req.params;

    const decision = await prisma.decision.findUnique({
      where: { id: Number(decisionId) },
      select: { id: true },
    });

    if (!decision) {
      return res.status(404).json({
        message: "Decision not found",
      });
    }

    const alternatives = await prisma.alternative.findMany({
      where: {
        decisionId: decision.id,
      },
      orderBy: {
        id: "asc",
      },
    });

    return res.status(200).json(alternatives);
  } catch (error) {
    console.error("Get alternatives error:", error);

    return res.status(500).json({
      message: "Failed to fetch alternatives",
    });
  }
};

const updateAlternative = async (req, res) => {
  try {
    const { decisionId, alternativeId } = req.params;
    const { name, pros, cons, cost, feasibility, risk } = req.body;

    const decision = await prisma.decision.findUnique({
      where: { id: Number(decisionId) },
    });

    if (!decision) {
      return res.status(404).json({ message: "Decision not found" });
    }

    if (!(await canManageDecision(decision, req.user))) {
      return res.status(403).json({
        message:
          "You do not have permission to modify alternatives for this decision",
      });
    }

    const existingAlternative = await prisma.alternative.findFirst({
      where: {
        id: Number(alternativeId),
        decisionId: decision.id,
      },
    });

    if (!existingAlternative) {
      return res.status(404).json({
        message: "Alternative not found",
      });
    }

    const data = {};

    if (name !== undefined) {
      if (!name.trim()) {
        return res.status(400).json({
          message: "Alternative name cannot be empty",
        });
      }
      data.name = name.trim();
    }

    if (pros !== undefined) data.pros = pros;
    if (cons !== undefined) data.cons = cons;
    if (cost !== undefined) data.cost = cost;
    if (feasibility !== undefined) data.feasibility = feasibility;
    if (risk !== undefined) data.risk = risk;

    const alternative = await prisma.alternative.update({
      where: {
        id: existingAlternative.id,
      },
      data,
    });

    await logActivity({
      userId: req.user.userId,
      action: "ALTERNATIVE_UPDATED",
      entityType: "Alternative",
      entityId: alternative.id,
      decisionId: decision.id,
      metadata: { name: alternative.name },
    });

    return res.status(200).json(alternative);
  } catch (error) {
    console.error("Update alternative error:", error);

    return res.status(500).json({
      message: "Failed to update alternative",
    });
  }
};

const deleteAlternative = async (req, res) => {
  try {
    const { decisionId, alternativeId } = req.params;

    const decision = await prisma.decision.findUnique({
      where: { id: Number(decisionId) },
    });

    if (!decision) {
      return res.status(404).json({ message: "Decision not found" });
    }

    if (!(await canManageDecision(decision, req.user))) {
      return res.status(403).json({
        message:
          "You do not have permission to modify alternatives for this decision",
      });
    }

    const existingAlternative = await prisma.alternative.findFirst({
      where: {
        id: Number(alternativeId),
        decisionId: decision.id,
      },
    });

    if (!existingAlternative) {
      return res.status(404).json({
        message: "Alternative not found",
      });
    }

    await prisma.alternative.delete({
      where: {
        id: existingAlternative.id,
      },
    });

    await logActivity({
      userId: req.user.userId,
      action: "ALTERNATIVE_DELETED",
      entityType: "Alternative",
      entityId: existingAlternative.id,
      decisionId: decision.id,
      metadata: { name: existingAlternative.name },
    });

    return res.status(200).json({
      message: "Alternative deleted successfully",
    });
  } catch (error) {
    console.error("Delete alternative error:", error);

    return res.status(500).json({
      message: "Failed to delete alternative",
    });
  }
};

export {
  createAlternative,
  getAlternative,
  updateAlternative,
  deleteAlternative,
};
