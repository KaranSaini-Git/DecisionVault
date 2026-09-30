import { Router } from "express";
import authMiddleware from "../middleware/authMiddleware.js";
import upload from "../middleware/uploadMiddleware.js";
import {
  uploadDocument,
  getDocuments,
  getDocumentUrl,
} from "../controllers/documentController.js";

const documentRouter = Router();

documentRouter.post(
  "/:decisionId/documents",
  authMiddleware,
  upload.single("file"),
  uploadDocument,
);

documentRouter.get("/:decisionId/documents", authMiddleware, getDocuments);

documentRouter.get(
  "/:decisionId/documents/:documentId/url",
  authMiddleware,
  getDocumentUrl,
);

export default documentRouter;
