import { Router } from "express";

import authMiddleware from "../middleware/authMiddleware.js";
import upload from "../middleware/uploadMiddleware.js";

import {
  uploadDocument,
  getDocuments,
  getDocumentUrl,
  getDocumentContent,
} from "../controllers/documentController.js";

const documentRouter = Router();

/*
 * Upload document
 */
documentRouter.post(
  "/:decisionId/documents",
  authMiddleware,
  upload.single("file"),
  uploadDocument,
);

/*
 * Get all documents belonging to a decision
 */
documentRouter.get("/:decisionId/documents", authMiddleware, getDocuments);

/*
 * NEW:
 * Open/download the actual document.
 *
 * Example:
 * GET /api/decisions/12/documents/45/content
 */
documentRouter.get(
  "/:decisionId/documents/:documentId/content",
  authMiddleware,
  getDocumentContent,
);

/*
 * Existing signed URL route.
 *
 * Keep this because other parts of the application may still use it.
 */
documentRouter.get(
  "/:decisionId/documents/:documentId/url",
  authMiddleware,
  getDocumentUrl,
);

export default documentRouter;
