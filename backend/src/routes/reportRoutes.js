import { Router } from "express";
import authMiddleware from "../middleware/authMiddleware.js";
import { getReport, downloadReport } from "../controllers/reportController.js";

const router = Router();
router.get("/reports/:type", authMiddleware, getReport);
router.get("/reports/:type/download", authMiddleware, downloadReport);
export default router;
