import { Router } from "express";
import authMiddleware from "../middleware/authMiddleware.js";
import { listTeams, getTeam, createTeam, addTeamMember, removeTeamMember } from "../controllers/teamController.js";

const router = Router();
router.get("/teams", authMiddleware, listTeams);
router.get("/teams/:teamId", authMiddleware, getTeam);
router.post("/teams", authMiddleware, createTeam);
router.post("/teams/:teamId/members", authMiddleware, addTeamMember);
router.delete("/teams/:teamId/members/:userId", authMiddleware, removeTeamMember);
export default router;
