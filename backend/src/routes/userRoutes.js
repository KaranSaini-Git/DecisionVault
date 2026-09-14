import { Router } from "express";
import authMiddleware from "../middleware/authMiddleware.js";
import { listUsers, updateUserRole } from "../controllers/userController.js";

const router = Router();
router.get("/users", authMiddleware, listUsers);
router.patch("/users/:userId/role", authMiddleware, updateUserRole);
export default router;
