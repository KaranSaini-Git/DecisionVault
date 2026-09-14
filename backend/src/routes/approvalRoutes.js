import { Router } from "express";
import authMiddleware from "../middleware/authMiddleware.js";
import { listApprovals, requestApproval, actOnApproval, getMyPendingApprovals } from "../controllers/approvalController.js";

const router = Router();
router.get("/approvals/pending", authMiddleware, getMyPendingApprovals);
router.get("/decisions/:decisionId/approvals", authMiddleware, listApprovals);
router.post("/decisions/:decisionId/approvals", authMiddleware, requestApproval);
router.patch("/approvals/:approvalId", authMiddleware, actOnApproval);
export default router;
