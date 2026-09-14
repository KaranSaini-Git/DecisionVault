import express from "express";
import cors from "cors";
import path from "path";
import authRouter from "./routes/authRouter.js";
import decisionRouter from "./routes/decisionRouter.js";
import alternativeRouter from "./routes/alterantiveRoutes.js";
import documentRouter from "./routes/documentRoutes.js";
import discussionRouter from "./routes/discussionRoutes.js";
import approvalRouter from "./routes/approvalRoutes.js";
import userRouter from "./routes/userRoutes.js";
import teamRouter from "./routes/teamRoutes.js";
import notificationRouter from "./routes/notificationRoutes.js";
import auditRouter from "./routes/auditRoutes.js";
import analyticsRouter from "./routes/analyticsRoutes.js";
import knowledgeRouter from "./routes/knowledgeRoutes.js";
import reportRouter from "./routes/reportRoutes.js";

const app = express();

app.use(cors());
app.use(express.json({ limit: "2mb" }));
app.use("/uploads", express.static(path.resolve("uploads")));

app.get("/api/health", (req, res) => {
  res.status(200).json({ status: "ok" });
});

app.use("/api/auth", authRouter);
app.use("/api/decisions", decisionRouter);
app.use("/api/decisions", alternativeRouter);
app.use("/api/decisions", documentRouter);
app.use("/api", discussionRouter);
app.use("/api", approvalRouter);
app.use("/api", userRouter);
app.use("/api", teamRouter);
app.use("/api", notificationRouter);
app.use("/api", auditRouter);
app.use("/api", analyticsRouter);
app.use("/api", knowledgeRouter);
app.use("/api", reportRouter);

export default app;
