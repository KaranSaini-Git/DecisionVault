import prisma from "../db/prisma.js";

const logActivity = async ({
  userId,
  action,
  entityType,
  entityId = null,
  decisionId = null,
  teamId = null,
  metadata = {},
}) => {
  try {
    await prisma.auditLog.create({
      data: {
        userId: userId || null,
        action,
        entityType,
        entityId,
        decisionId,
        teamId,
        metadata: JSON.stringify(metadata),
      },
    });
  } catch (error) {
    console.error("Activity log error:", error);
  }
};

const createNotification = async ({
  userId,
  type,
  title,
  message,
  entityType = null,
  entityId = null,
}) => {
  if (!userId) return null;

  return prisma.notification.create({
    data: {
      userId,
      type,
      title,
      message,
      entityType,
      entityId,
    },
  });
};

export { logActivity, createNotification };
