import { Router } from "express";
import authMiddleware from "../middleware/authMiddleware.js";
import { getKnowledge } from "../controllers/knowledgeController.js";

const router = Router();
router.get("/knowledge", authMiddleware, getKnowledge);
export default router;
