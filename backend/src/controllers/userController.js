import prisma from "../db/prisma.js";
import { logActivity } from "../services/activityService.js";

const listUsers = async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      where:
        req.user.role === "Administrator" || req.user.role === "Manager"
          ? {}
          : { role: { in: ["Reviewer", "Manager", "Administrator"] } },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        _count: {
          select: {
            decisions: true,
            discussions: true,
            approvalsToReview: true,
          },
        },
      },
      orderBy: { name: "asc" },
    });

    res.status(200).json({
      users,
      scope:
        req.user.role === "Administrator" || req.user.role === "Manager"
          ? "organization"
          : "approvers",
    });
  } catch (error) {
    console.error("List users error:", error);
    res.status(500).json({ message: "Failed to fetch users" });
  }
};

const updateUserRole = async (req, res) => {
  try {
    if (req.user?.role !== "Administrator") {
      return res.status(403).json({ message: "Administrator access required" });
    }

    const userId = Number(req.params.userId);
    const { role } = req.body;
    const validRoles = ["Employee", "Reviewer", "Manager", "Administrator"];

    if (!Number.isInteger(userId) || userId <= 0) {
      return res.status(400).json({ message: "Invalid user ID" });
    }

    if (!validRoles.includes(role)) {
      return res.status(400).json({ message: "Invalid role" });
    }

    const user = await prisma.user.update({
      where: { id: userId },
      data: { role },
      select: { id: true, name: true, email: true, role: true },
    });

    await logActivity({
      userId: req.user.userId,
      action: "USER_ROLE_UPDATED",
      entityType: "User",
      entityId: user.id,
      metadata: { role },
    });

    res.status(200).json({ user });
  } catch (error) {
    console.error("Update user role error:", error);
    res.status(500).json({ message: "Failed to update user role" });
  }
};

const updateProfile = async (req, res) => {
  try {
    const userId = req.user?.userId;
    const name = req.body?.name?.trim();
    const email = req.body?.email?.trim()?.toLowerCase();
    if (!userId)
      return res.status(401).json({ message: "Authentication required" });
    if (!name || !email)
      return res.status(400).json({ message: "Name and email are required" });
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing && existing.id !== userId)
      return res.status(409).json({ message: "Email already exists" });
    const user = await prisma.user.update({
      where: { id: userId },
      data: { name, email },
      select: { id: true, name: true, email: true, role: true },
    });
    await logActivity({
      userId,
      action: "USER_PROFILE_UPDATED",
      entityType: "User",
      entityId: user.id,
    });
    res.status(200).json({ user });
  } catch (error) {
    console.error("Update profile error:", error);
    res.status(500).json({ message: "Failed to update profile" });
  }
};

export { listUsers, updateUserRole, updateProfile };
