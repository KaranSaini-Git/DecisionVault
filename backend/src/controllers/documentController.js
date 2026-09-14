import prisma from "../db/prisma.js";
import { logActivity } from "../services/activityService.js";

const uploadDocument = async (req, res) => {
  try {
    const decisionId = Number(req.params.decisionId);
    if (!Number.isInteger(decisionId) || decisionId <= 0) return res.status(400).json({ message: "Invalid decision ID" });
    if (!req.file) return res.status(400).json({ message: "No file uploaded" });

    const decision = await prisma.decision.findUnique({ where: { id: decisionId }, select: { id: true, teamId: true } });
    if (!decision) return res.status(404).json({ message: "Decision not found" });

    const document = await prisma.document.create({
      data: {
        filename: req.file.originalname,
        filePath: req.file.path,
        uploadedById: req.user.userId,
        category: req.body.category?.trim() || "General",
        tags: req.body.tags?.trim() || "",
        decisionId,
      },
    });

    await logActivity({
      userId: req.user.userId,
      action: "DOCUMENT_UPLOADED",
      entityType: "Document",
      entityId: document.id,
      decisionId,
      teamId: decision.teamId,
      metadata: { filename: document.filename, category: document.category, tags: document.tags },
    });

    res.status(201).json(document);
  } catch (error) {
    console.error("Upload document error:", error);
    res.status(500).json({ message: "Failed to upload document" });
  }
};

const getDocuments = async (req, res) => {
  try {
    const decisionId = Number(req.params.decisionId);
    if (!Number.isInteger(decisionId) || decisionId <= 0) return res.status(400).json({ message: "Invalid decision ID" });

    const documents = await prisma.document.findMany({
      where: { decisionId },
      include: { uploadedBy: { select: { id: true, name: true, role: true } } },
      orderBy: { createdAt: "desc" },
    });

    res.status(200).json(documents);
  } catch (error) {
    console.error("Get documents error:", error);
    res.status(500).json({ message: "Failed to fetch documents" });
  }
};

export { uploadDocument, getDocuments };
