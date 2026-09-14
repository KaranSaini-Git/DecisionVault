import { Router } from "express";
import authMiddleware from "../middleware/authMiddleware.js";
import { listNotifications, markNotificationRead, markAllNotificationsRead } from "../controllers/notificationController.js";

const router = Router();
router.get("/notifications", authMiddleware, listNotifications);
router.patch("/notifications/:notificationId/read", authMiddleware, markNotificationRead);
router.patch("/notifications/read-all", authMiddleware, markAllNotificationsRead);
export default router;
