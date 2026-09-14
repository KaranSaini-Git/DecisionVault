import prisma from "../db/prisma.js";

const listAuditLogs = async (req, res) => {
  try {
    if (req.user.role !== "Administrator") return res.status(403).json({ message: "Administrator access required" });

    const search = req.query.search?.trim() || "";
    const action = req.query.action?.trim() || "";
    const userId = req.query.userId ? Number(req.query.userId) : null;

    const logs = await prisma.auditLog.findMany({
      where: {
        ...(userId ? { userId } : {}),
        ...(action ? { action } : {}),
        ...(search ? {
          OR: [
            { action: { contains: search, mode: "insensitive" } },
            { entityType: { contains: search, mode: "insensitive" } },
            { metadata: { contains: search, mode: "insensitive" } },
            { user: { name: { contains: search, mode: "insensitive" } } },
          ],
        } : {}),
      },
      include: { user: { select: { id: true, name: true, email: true, role: true } } },
      orderBy: { createdAt: "desc" },
      take: 200,
    });

    const actions = await prisma.auditLog.findMany({ distinct: ["action"], select: { action: true }, orderBy: { action: "asc" } });

    res.status(200).json({ logs, actions: actions.map((item) => item.action) });
  } catch (error) {
    console.error("List audit logs error:", error);
    res.status(500).json({ message: "Failed to fetch audit logs" });
  }
};

export { listAuditLogs };
