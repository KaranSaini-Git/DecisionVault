import prisma from "../db/prisma.js";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { logActivity } from "../services/activityService.js";

const register = async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name?.trim() || !email?.trim() || !password) {
      return res.status(400).json({ message: "Name, email and password are required" });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const existingUser = await prisma.user.findUnique({ where: { email: normalizedEmail } });

    if (existingUser) {
      return res.status(409).json({ message: "Email already exists" });
    }

    // Public self-registration must never grant a privileged role.
    const role = "Employee";
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: {
        name: name.trim(),
        email: normalizedEmail,
        password: hashedPassword,
        role,
      },
      select: { id: true, name: true, email: true, role: true },
    });

    await logActivity({ userId: user.id, action: "USER_REGISTERED", entityType: "User", entityId: user.id });
    return res.status(201).json({ message: "User registered successfully", user });
  } catch (error) {
    console.error("Register error:", error);
    return res.status(500).json({ message: "Failed to register user" });
  }
};

const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email?.trim() || !password) {
      return res.status(400).json({ message: "Email and password are required" });
    }

    const existingUser = await prisma.user.findUnique({ where: { email: email.trim().toLowerCase() } });

    if (!existingUser || !(await bcrypt.compare(password, existingUser.password))) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    const token = jwt.sign(
      { userId: existingUser.id, role: existingUser.role },
      process.env.JWT_SECRET,
      { expiresIn: "24h" },
    );

    await logActivity({ userId: existingUser.id, action: "USER_LOGGED_IN", entityType: "User", entityId: existingUser.id });

    return res.status(200).json({
      message: "Login successful",
      token,
      user: {
        id: existingUser.id,
        name: existingUser.name,
        email: existingUser.email,
        role: existingUser.role,
      },
    });
  } catch (error) {
    console.error("Login error:", error);
    return res.status(500).json({ message: "Failed to login" });
  }
};

const getMe = async (req, res) => {
  try {
    const userId = req.user?.userId;

    if (!userId) return res.status(401).json({ message: "Authentication required" });

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        teamMemberships: {
          include: { team: { select: { id: true, name: true } } },
          orderBy: { joinedAt: "asc" },
        },
      },
    });

    if (!user) return res.status(404).json({ message: "User not found" });
    return res.status(200).json({ user });
  } catch (error) {
    console.error("Get current user error:", error);
    return res.status(500).json({ message: "Failed to fetch current user" });
  }
};

export { register, login, getMe };
