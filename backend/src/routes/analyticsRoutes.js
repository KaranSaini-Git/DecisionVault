import { Router } from "express";
import authMiddleware from "../middleware/authMiddleware.js";
import { getAnalytics } from "../controllers/analyticsController.js";

const router = Router();
router.get("/analytics", authMiddleware, getAnalytics);
export default router;
