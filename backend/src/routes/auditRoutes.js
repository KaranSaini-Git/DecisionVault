import { Router } from "express";
import authMiddleware from "../middleware/authMiddleware.js";
import { listAuditLogs } from "../controllers/auditController.js";

const router = Router();
router.get("/audit-logs", authMiddleware, listAuditLogs);
export default router;
