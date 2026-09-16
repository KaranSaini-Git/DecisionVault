import prisma from "../db/prisma.js";

const csvEscape = (value) => `"${String(value ?? "").replaceAll('"', '""')}"`;

const buildReportRows = async (type, user) => {
  let decisionWhere = {};
  let teamWhere = {};

  if (user?.role === "Manager") {
    const memberships = await prisma.teamMember.findMany({
      where: { userId: user.userId, teamRole: { in: ["Owner", "Manager", "Lead"] } },
      select: { teamId: true },
    });
    const teamIds = memberships.map((item) => item.teamId);
    decisionWhere = { OR: [{ createdById: user.userId }, ...(teamIds.length ? [{ teamId: { in: teamIds } }] : [])] };
    teamWhere = teamIds.length ? { id: { in: teamIds } } : { id: -1 };
  }

  if (type === "decisions") {
    const rows = await prisma.decision.findMany({ where: decisionWhere, include: { createdBy: { select: { name: true } }, team: { select: { name: true } }, _count: { select: { alternatives: true, documents: true, discussions: true, approvals: true } } }, orderBy: { updatedAt: "desc" } });
    return {
      filename: "decision-report.csv",
      columns: ["ID", "Title", "Status", "Created By", "Team", "Alternatives", "Documents", "Discussions", "Approvals", "Created At"],
      rows: rows.map((row) => [row.id, row.title, row.status, row.createdBy?.name, row.team?.name, row._count.alternatives, row._count.documents, row._count.discussions, row._count.approvals, row.createdAt.toISOString()]),
    };
  }

  if (type === "approvals") {
    const rows = await prisma.approval.findMany({ where: { decision: decisionWhere }, include: { decision: { select: { title: true } }, reviewer: { select: { name: true } }, requestedBy: { select: { name: true } } }, orderBy: { createdAt: "desc" } });
    return {
      filename: "approval-report.csv",
      columns: ["ID", "Decision", "Reviewer", "Requested By", "Level", "Status", "Comments", "Created At", "Acted At"],
      rows: rows.map((row) => [row.id, row.decision?.title, row.reviewer?.name, row.requestedBy?.name, row.level, row.status, row.comments, row.createdAt.toISOString(), row.actedAt?.toISOString() || ""]),
    };
  }

  if (type === "teams") {
    const rows = await prisma.team.findMany({ where: teamWhere, include: { _count: { select: { members: true, decisions: true } } }, orderBy: { name: "asc" } });
    return {
      filename: "team-report.csv",
      columns: ["ID", "Team", "Members", "Decisions", "Created At"],
      rows: rows.map((row) => [row.id, row.name, row._count.members, row._count.decisions, row.createdAt.toISOString()]),
    };
  }

  const rows = await prisma.auditLog.findMany({ where: user?.role === "Manager" ? { OR: [{ userId: user.userId }, { decision: decisionWhere }] } : {}, include: { user: { select: { name: true } } }, orderBy: { createdAt: "desc" }, take: 1000 });
  return {
    filename: "audit-report.csv",
    columns: ["ID", "User", "Action", "Entity", "Entity ID", "Decision ID", "Team ID", "Metadata", "Created At"],
    rows: rows.map((row) => [row.id, row.user?.name, row.action, row.entityType, row.entityId, row.decisionId, row.teamId, row.metadata, row.createdAt.toISOString()]),
  };
};

const getReport = async (req, res) => {
  try {
    if (!["Manager", "Administrator"].includes(req.user.role)) return res.status(403).json({ message: "Manager or Administrator access required" });
    const type = ["decisions", "approvals", "teams", "audit"].includes(req.params.type) ? req.params.type : "decisions";
    const report = await buildReportRows(type, req.user);
    res.status(200).json({ report });
  } catch (error) {
    console.error("Report error:", error);
    res.status(500).json({ message: "Failed to generate report" });
  }
};

const downloadReport = async (req, res) => {
  try {
    if (!["Manager", "Administrator"].includes(req.user.role)) return res.status(403).json({ message: "Manager or Administrator access required" });
    const type = ["decisions", "approvals", "teams", "audit"].includes(req.params.type) ? req.params.type : "decisions";
    const report = await buildReportRows(type, req.user);
    const csv = [report.columns, ...report.rows].map((row) => row.map(csvEscape).join(",")).join("\n");
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${report.filename}"`);
    res.status(200).send(csv);
  } catch (error) {
    console.error("Download report error:", error);
    res.status(500).json({ message: "Failed to download report" });
  }
};

export { getReport, downloadReport };
