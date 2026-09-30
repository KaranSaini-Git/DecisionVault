import crypto from "crypto";

import prisma from "../db/prisma.js";
import { logActivity } from "../services/activityService.js";
import { canManageDecision } from "../services/authorizationService.js";
import { supabase, bucketName } from "../services/supabaseStorage.js";

const createStorageFilename = (originalFilename) => {
  const extensionMatch = originalFilename.match(/\.[^./\\]+$/);
  const extension = extensionMatch ? extensionMatch[0].toLowerCase() : "";

  const baseName = originalFilename
    .replace(/\.[^./\\]+$/, "")
    .replace(/[^a-zA-Z0-9-_ ]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .slice(0, 120);

  const safeBaseName = baseName || "document";

  return `${crypto.randomUUID()}-${safeBaseName}${extension}`;
};

const uploadDocument = async (req, res) => {
  let storagePath = null;

  try {
    const decisionId = Number(req.params.decisionId);

    if (!Number.isInteger(decisionId) || decisionId <= 0) {
      return res.status(400).json({
        message: "Invalid decision ID",
      });
    }

    if (!req.file) {
      return res.status(400).json({
        message: "No file uploaded",
      });
    }

    const decision = await prisma.decision.findUnique({
      where: { id: decisionId },
      select: {
        id: true,
        createdById: true,
        teamId: true,
      },
    });

    if (!decision) {
      return res.status(404).json({
        message: "Decision not found",
      });
    }

    if (!(await canManageDecision(decision, req.user))) {
      return res.status(403).json({
        message:
          "You do not have permission to upload documents to this decision",
      });
    }

    const storageFilename = createStorageFilename(req.file.originalname);

    storagePath = `decisions/${decisionId}/${storageFilename}`;

    const { error: uploadError } = await supabase.storage
      .from(bucketName)
      .upload(storagePath, req.file.buffer, {
        contentType: req.file.mimetype || "application/octet-stream",
        cacheControl: "3600",
        upsert: false,
      });

    if (uploadError) {
      console.error("Supabase upload error:", uploadError);

      return res.status(500).json({
        message: "Failed to store document in cloud storage",
      });
    }

    const document = await prisma.document.create({
      data: {
        filename: req.file.originalname,
        filePath: storagePath,
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
      metadata: {
        filename: document.filename,
        category: document.category,
        tags: document.tags,
      },
    });

    return res.status(201).json(document);
  } catch (error) {
    console.error("Upload document error:", error);

    if (storagePath) {
      const { error: cleanupError } = await supabase.storage
        .from(bucketName)
        .remove([storagePath]);

      if (cleanupError) {
        console.error("Supabase cleanup error:", cleanupError);
      }
    }

    return res.status(500).json({
      message: "Failed to upload document",
    });
  }
};

const getDocuments = async (req, res) => {
  try {
    const decisionId = Number(req.params.decisionId);

    if (!Number.isInteger(decisionId) || decisionId <= 0) {
      return res.status(400).json({
        message: "Invalid decision ID",
      });
    }

    const documents = await prisma.document.findMany({
      where: { decisionId },
      include: {
        uploadedBy: {
          select: {
            id: true,
            name: true,
            role: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return res.status(200).json(documents);
  } catch (error) {
    console.error("Get documents error:", error);

    return res.status(500).json({
      message: "Failed to fetch documents",
    });
  }
};

const getDocumentUrl = async (req, res) => {
  try {
    const decisionId = Number(req.params.decisionId);
    const documentId = Number(req.params.documentId);

    if (
      !Number.isInteger(decisionId) ||
      decisionId <= 0 ||
      !Number.isInteger(documentId) ||
      documentId <= 0
    ) {
      return res.status(400).json({
        message: "Invalid document or decision ID",
      });
    }

    const document = await prisma.document.findFirst({
      where: {
        id: documentId,
        decisionId,
      },
    });

    if (!document) {
      return res.status(404).json({
        message: "Document not found",
      });
    }

    const filePath = String(document.filePath || "").replaceAll("\\", "/");

    if (!filePath) {
      return res.status(404).json({
        message: "Document does not have a stored file",
      });
    }

    // Keep support for old documents stored in backend/uploads.
    if (filePath.startsWith("uploads/")) {
      return res.status(200).json({
        url: `/uploads/${filePath.replace(/^uploads\//, "")}`,
        storage: "local",
      });
    }

    const { data, error } = await supabase.storage
      .from(bucketName)
      .createSignedUrl(filePath, 300);

    if (error) {
      console.error("Supabase signed URL error:", error);

      return res.status(500).json({
        message: "Failed to create document access URL",
      });
    }

    return res.status(200).json({
      url: data.signedUrl,
      storage: "supabase",
      expiresIn: 300,
    });
  } catch (error) {
    console.error("Get document URL error:", error);

    return res.status(500).json({
      message: "Failed to get document URL",
    });
  }
};

export { uploadDocument, getDocuments, getDocumentUrl };
