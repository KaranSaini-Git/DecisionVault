import crypto from "crypto";
import fs from "fs";
import path from "path";

import prisma from "../db/prisma.js";
import { logActivity } from "../services/activityService.js";
import { canManageDecision } from "../services/authorizationService.js";
import { supabase, bucketName } from "../services/supabaseStorage.js";

const MIME_TYPES = {
  pdf: "application/pdf",
  txt: "text/plain; charset=utf-8",
  csv: "text/csv; charset=utf-8",

  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  svg: "image/svg+xml",

  html: "text/html; charset=utf-8",
  htm: "text/html; charset=utf-8",
  css: "text/css; charset=utf-8",
  js: "text/javascript; charset=utf-8",
  json: "application/json; charset=utf-8",

  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",

  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",

  ppt: "application/vnd.ms-powerpoint",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
};

const getMimeType = (filename) => {
  const extension = String(filename || "")
    .split(".")
    .pop()
    .toLowerCase();

  return MIME_TYPES[extension] || "application/octet-stream";
};

const sanitizeFilename = (filename) => {
  return (
    String(filename || "document")
      .replace(/[\r\n"]/g, "")
      .replace(/[\\/]/g, "-")
      .trim() || "document"
  );
};

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
      console.error("Supabase upload error:", {
        message: uploadError.message,
        name: uploadError.name,
        statusCode: uploadError.statusCode,
        storagePath,
      });

      return res.status(502).json({
        message:
          uploadError.message || "Failed to store document in cloud storage",
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
      message: error?.message || "Failed to upload document",
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
      orderBy: {
        createdAt: "desc",
      },
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

    if (filePath.startsWith("uploads/")) {
      return res.status(200).json({
        url: `/${filePath}`,
        storage: "local",
      });
    }

    const { data, error } = await supabase.storage
      .from(bucketName)
      .createSignedUrl(filePath, 300);

    if (error || !data?.signedUrl) {
      console.error("Supabase signed URL error:", error);

      return res.status(500).json({
        message: error?.message || "Failed to create document access URL",
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
      message: error?.message || "Failed to get document URL",
    });
  }
};

/*
 * Returns the actual file bytes.
 *
 * This is the endpoint used by the new frontend document opener.
 */
const getDocumentContent = async (req, res) => {
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

    const filename = sanitizeFilename(document.filename);
    const mimeType = getMimeType(document.filename);

    /*
     * Support legacy local files.
     */
    if (filePath.startsWith("uploads/")) {
      const localPath = path.resolve(filePath);

      if (!fs.existsSync(localPath)) {
        return res.status(404).json({
          message:
            "The document exists in the database, but the local file is missing from the backend.",
        });
      }

      res.setHeader("Content-Type", mimeType);
      res.setHeader("Content-Disposition", `inline; filename="${filename}"`);

      return res.sendFile(localPath);
    }

    /*
     * Current files are stored in:
     *
     * decision-documents/
     *   decisions/
     *     <decisionId>/
     *       <generated-file-name>
     */
    const { data: fileData, error: downloadError } = await supabase.storage
      .from(bucketName)
      .download(filePath);

    if (downloadError || !fileData) {
      console.error("Supabase document download error:", {
        message: downloadError?.message,
        name: downloadError?.name,
        statusCode: downloadError?.statusCode,
        bucketName,
        filePath,
      });

      return res.status(404).json({
        message: "The document file could not be found in Supabase Storage.",
      });
    }

    const buffer = Buffer.from(await fileData.arrayBuffer());

    if (!buffer.length) {
      return res.status(404).json({
        message: "The document file is empty.",
      });
    }

    res.setHeader("Content-Type", mimeType);
    res.setHeader("Content-Length", String(buffer.length));
    res.setHeader("Content-Disposition", `inline; filename="${filename}"`);

    return res.status(200).send(buffer);
  } catch (error) {
    console.error("Get document content error:", error);

    return res.status(500).json({
      message: error?.message || "Failed to open document",
    });
  }
};

export { uploadDocument, getDocuments, getDocumentUrl, getDocumentContent };
