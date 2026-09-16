import jwt from "jsonwebtoken";
import prisma from "../db/prisma.js";

const authMiddleware = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res.status(401).json({ message: "Authentication required" });
  }

  const [scheme, token] = authHeader.trim().split(/\s+/);

  if (scheme !== "Bearer" || !token) {
    return res.status(401).json({ message: "Authentication required" });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userId = Number(decoded?.userId);

    if (!Number.isInteger(userId) || userId <= 0) {
      return res.status(401).json({ message: "Invalid authentication token" });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, email: true, role: true },
    });

    if (!user) {
      return res.status(401).json({ message: "Account no longer exists" });
    }

    // The database is authoritative for the current role. This prevents a
    // stale JWT from retaining privileges after an administrator changes them.
    req.user = {
      ...decoded,
      userId: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
    };

    next();
  } catch (error) {
    console.error("Authentication middleware error:", error);
    return res.status(401).json({ message: "Invalid or expired token" });
  }
};

export default authMiddleware;
