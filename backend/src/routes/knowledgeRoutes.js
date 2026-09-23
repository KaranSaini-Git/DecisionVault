import { Router } from "express";
import authMiddleware from "../middleware/authMiddleware.js";
import {
  getKnowledge,
  getKnowledgeGraph,
} from "../controllers/knowledgeController.js";

const router = Router();

router.get("/knowledge", authMiddleware, getKnowledge);
router.get("/knowledge/graph", authMiddleware, getKnowledgeGraph);

export default router;