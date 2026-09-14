import prisma from "../db/prisma.js";

const listNotifications = async (req, res) => {
  try {
    const userId = req.user.userId;
    const notifications = await prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    const unreadCount = notifications.filter((notification) => !notification.isRead).length;

    res.status(200).json({ notifications, unreadCount });
  } catch (error) {
    console.error("List notifications error:", error);
    res.status(500).json({ message: "Failed to fetch notifications" });
  }
};

const markNotificationRead = async (req, res) => {
  try {
    const id = Number(req.params.notificationId);
    const notification = await prisma.notification.updateMany({
      where: { id, userId: req.user.userId },
      data: { isRead: true },
    });

    if (!notification.count) return res.status(404).json({ message: "Notification not found" });
    res.status(200).json({ message: "Notification marked as read" });
  } catch (error) {
    console.error("Mark notification read error:", error);
    res.status(500).json({ message: "Failed to update notification" });
  }
};

const markAllNotificationsRead = async (req, res) => {
  try {
    await prisma.notification.updateMany({
      where: { userId: req.user.userId, isRead: false },
      data: { isRead: true },
    });
    res.status(200).json({ message: "Notifications marked as read" });
  } catch (error) {
    console.error("Mark all notifications error:", error);
    res.status(500).json({ message: "Failed to update notifications" });
  }
};

export { listNotifications, markNotificationRead, markAllNotificationsRead };
