import { useEffect, useMemo, useState } from "react";
import {
  ArrowUpRight,
  BarChart3,
  CheckCircle2,
  ChevronRight,
  Clock3,
  FileText,
  FolderOpen,
  MessageCircle,
  Search,
  ShieldCheck,
  Users,
  X,
} from "lucide-react";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:4000";

const formatDate = (value) => {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
};

const formatRelative = (value) => {
  if (!value) return "—";
  const time = new Date(value).getTime();
  if (Number.isNaN(time)) return "—";
  const minutes = Math.max(0, Math.floor((Date.now() - time) / 60000));
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
};

const statusLabel = (status) =>
  ({
    Draft: "Draft",
    UnderReview: "Under Review",
    Approved: "Approved",
    Rejected: "Rejected",
    Archived: "Archived",
  })[status] || status;

const statusClass = (status) =>
  String(statusLabel(status)).toLowerCase().replaceAll(" ", "-");

const EmptyState = ({ icon: Icon, title, body }) => (
  <div className="module-empty-state">
    <div className="module-empty-icon">
      <Icon size={18} />
    </div>
    <strong>{title}</strong>
    <span>{body}</span>
  </div>
);

function ReviewsPage({
  apiRequest,
  decisions,
  openDecision,
  currentUser,
  globalSearch = "",
  onApprovalChange,
}) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actingId, setActingId] = useState(null);
  const [commentId, setCommentId] = useState(null);
  const [comments, setComments] = useState({});

  const load = async () => {
    try {
      setLoading(true);
      const data = await apiRequest("/api/approvals/pending");
      setItems(Array.isArray(data) ? data : data?.approvals || []);
    } catch (error) {
      console.error("Load reviews error:", error);
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [currentUser?.id]);

  const act = async (approvalId, status) => {
    try {
      setActingId(approvalId);
      await apiRequest(`/api/approvals/${approvalId}`, {
        method: "PATCH",
        body: JSON.stringify({
          status,
          comments: comments[approvalId]?.trim() || null,
        }),
      });
      await load();
      await onApprovalChange?.();
    } catch (error) {
      alert(error.message || "Unable to update approval.");
    } finally {
      setActingId(null);
      setCommentId(null);
    }
  };

  const filteredItems = useMemo(() => {
    const query = globalSearch.trim().toLowerCase();
    if (!query) return items;
    return items.filter((approval) => {
      const decision =
        decisions.find((item) => item.id === approval.decisionId) ||
        approval.decision;
      return [
        decision?.title,
        approval.requestedBy?.name,
        approval.level,
        approval.status,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(query);
    });
  }, [items, decisions, globalSearch]);

  return (
    <section className="workspace-page full-module-page review-workspace-page">
      <div className="workspace-page-header">
        <div>
          <span className="section-label">APPROVAL WORKFLOW</span>
          <h1>Reviews</h1>
          <p>
            {currentUser?.role === "Manager"
              ? "Complete final approvals after reviewer sign-off."
              : "Review decisions assigned to you and keep approvals moving."}
          </p>
        </div>
        <button className="compact-action" type="button" onClick={load}>
          Refresh
        </button>
      </div>
      <div className="module-stat-grid">
        <div className="module-stat-card">
          <span>Pending reviews</span>
          <strong>{filteredItems.length}</strong>
          <small>Assigned to you</small>
        </div>
        <div className="module-stat-card">
          <span>Stage</span>
          <strong>
            {currentUser?.role === "Manager" ? "Final" : "Review"}
          </strong>
          <small>{currentUser?.role || "Reviewer"} workspace</small>
        </div>
      </div>
      <div className="review-module-list">
        {loading ? (
          <EmptyState
            icon={Clock3}
            title="Loading reviews"
            body="Fetching approval requests from the workspace."
          />
        ) : filteredItems.length === 0 ? (
          <EmptyState
            icon={CheckCircle2}
            title={globalSearch ? "No reviews found" : "You’re all caught up"}
            body={
              globalSearch
                ? "Try a different search term."
                : "There are no pending decisions waiting for you."
            }
          />
        ) : (
          filteredItems.map((approval) => {
            const decision =
              decisions.find((item) => item.id === approval.decisionId) ||
              approval.decision;
            return (
              <article className="review-module-card" key={approval.id}>
                <div className="review-module-main">
                  <div className="review-module-icon">
                    <ShieldCheck size={19} />
                  </div>
                  <div className="review-module-copy">
                    <div className="panel-kicker">LEVEL {approval.level}</div>
                    <h3>{decision?.title || "Decision"}</h3>
                    <p>
                      Requested by{" "}
                      {approval.requestedBy?.name || "Workspace member"}
                      {decision?.team?.name ? ` · ${decision.team.name}` : ""}
                    </p>
                    <small>{formatDate(approval.createdAt)}</small>
                  </div>
                </div>
                <div className="review-module-actions">
                  <button
                    className="review-open-link"
                    type="button"
                    onClick={() => decision && openDecision(decision)}
                  >
                    Open decision <ArrowUpRight size={14} />
                  </button>
                  {commentId === approval.id && (
                    <textarea
                      value={comments[approval.id] || ""}
                      onChange={(event) =>
                        setComments((current) => ({
                          ...current,
                          [approval.id]: event.target.value,
                        }))
                      }
                      placeholder="Add an optional review comment..."
                      rows="3"
                    />
                  )}
                  <div className="review-action-row">
                    <button
                      className="review-comment-button"
                      type="button"
                      onClick={() =>
                        setCommentId(
                          commentId === approval.id ? null : approval.id,
                        )
                      }
                    >
                      Comment
                    </button>
                    <button
                      className="review-reject-button"
                      type="button"
                      disabled={actingId === approval.id}
                      onClick={() => act(approval.id, "Rejected")}
                    >
                      Reject
                    </button>
                    <button
                      className="review-approve-button"
                      type="button"
                      disabled={actingId === approval.id}
                      onClick={() => act(approval.id, "Approved")}
                    >
                      {actingId === approval.id
                        ? "Processing..."
                        : approval.level === 2
                          ? "Final approve"
                          : "Approve"}
                      <CheckCircle2 size={14} />
                    </button>
                  </div>
                </div>
              </article>
            );
          })
        )}
      </div>
    </section>
  );
}

function TeamsPage({ apiRequest, currentUser, globalSearch = "" }) {
  const [teams, setTeams] = useState([]);
  const [selected, setSelected] = useState(null);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [teamForm, setTeamForm] = useState({ name: "", description: "" });
  const [memberUserId, setMemberUserId] = useState("");
  const [memberRole, setMemberRole] = useState("Member");

  const loadTeams = async () => {
    try {
      setLoading(true);
      const data = await apiRequest("/api/teams");
      setTeams(data?.teams || []);
    } catch {
      setTeams([]);
    } finally {
      setLoading(false);
    }
  };

  const loadUsers = async () => {
    try {
      const data = await apiRequest("/api/users");
      setUsers(data?.users || []);
    } catch {
      setUsers([]);
    }
  };

  const openTeam = async (teamId) => {
    try {
      setDetailLoading(true);
      const data = await apiRequest(`/api/teams/${teamId}`);
      setSelected(data?.team || null);
    } catch (error) {
      alert(error.message || "Unable to load team.");
    } finally {
      setDetailLoading(false);
    }
  };

  useEffect(() => {
    loadTeams();
    loadUsers();
  }, []);

  const createTeam = async (event) => {
    event.preventDefault();
    if (!teamForm.name.trim()) return;
    try {
      await apiRequest("/api/teams", {
        method: "POST",
        body: JSON.stringify(teamForm),
      });
      setTeamForm({ name: "", description: "" });
      setShowCreate(false);
      await loadTeams();
    } catch (error) {
      alert(error.message || "Unable to create team.");
    }
  };

  const addMember = async (event) => {
    event.preventDefault();
    if (!selected || !memberUserId) return;
    try {
      await apiRequest(`/api/teams/${selected.id}/members`, {
        method: "POST",
        body: JSON.stringify({
          userId: Number(memberUserId),
          teamRole: memberRole,
        }),
      });
      setMemberUserId("");
      setMemberRole("Member");
      await openTeam(selected.id);
      await loadTeams();
    } catch (error) {
      alert(error.message || "Unable to add member.");
    }
  };

  const filteredTeams = useMemo(() => {
    const query = globalSearch.trim().toLowerCase();

    if (!query) return teams;

    return teams.filter((team) =>
      [team.name, team.description, team.userMembership?.teamRole]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(query),
    );
  }, [teams, globalSearch]);

  const myMembership = selected?.members?.find(
    (member) => member.userId === currentUser?.id,
  );
  const canCreateTeam = ["Manager", "Administrator"].includes(
    currentUser?.role,
  );
  const canManageMembers =
    currentUser?.role === "Administrator" ||
    ["Owner", "Manager", "Lead"].includes(myMembership?.teamRole);

  return (
    <section className="workspace-page full-module-page">
      <div className="workspace-page-header">
        <div>
          <span className="section-label">COLLABORATION</span>
          <h1>Teams</h1>
          <p>
            See every team you belong to and understand how decisions contribute
            across the workspace.
          </p>
        </div>
        {canCreateTeam && (
          <button
            className="new-decision-button"
            type="button"
            onClick={() => setShowCreate((value) => !value)}
          >
            <span>+</span>New team
          </button>
        )}
      </div>
      {showCreate && (
        <form className="module-form-card" onSubmit={createTeam}>
          <div className="panel-kicker">CREATE TEAM</div>
          <div className="module-form-grid two-columns">
            <input
              value={teamForm.name}
              onChange={(event) =>
                setTeamForm({ ...teamForm, name: event.target.value })
              }
              placeholder="Team name"
            />
            <input
              value={teamForm.description}
              onChange={(event) =>
                setTeamForm({ ...teamForm, description: event.target.value })
              }
              placeholder="What does this team work on?"
            />
          </div>
          <div className="module-form-actions">
            <button
              className="modal-secondary"
              type="button"
              onClick={() => setShowCreate(false)}
            >
              Cancel
            </button>
            <button className="modal-primary" type="submit">
              Create team <ArrowUpRight size={14} />
            </button>
          </div>
        </form>
      )}
      {loading ? (
        <EmptyState
          icon={Users}
          title="Loading teams"
          body="Fetching your team workspaces."
        />
      ) : teams.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No teams yet"
          body="Create a team to start connecting decisions and contributions."
        />
      ) : filteredTeams.length === 0 ? (
        <EmptyState
          icon={Search}
          title="No teams found"
          body="Try a different search term."
        />
      ) : (
        <div className="team-card-grid">
          {filteredTeams.map((team) => (
            <button
              className="team-overview-card"
              key={team.id}
              type="button"
              onClick={() => openTeam(team.id)}
            >
              <div className="team-overview-top">
                <div className="team-avatar-stack">
                  {team.members?.slice(0, 4).map((member) => (
                    <span key={member.id}>
                      {member.user.name.charAt(0).toUpperCase()}
                    </span>
                  ))}
                </div>
                <ChevronRight size={17} />
              </div>
              <div className="team-overview-copy">
                <strong>{team.name}</strong>
                <span>{team.description || "Decision workspace"}</span>
              </div>
              <div className="team-overview-metrics">
                <div>
                  <span>Your role</span>
                  <strong>{team.userMembership?.teamRole || "Member"}</strong>
                </div>
                <div>
                  <span>Decisions</span>
                  <strong>{team._count?.decisions || 0}</strong>
                </div>
                <div>
                  <span>Your activity</span>
                  <strong>{team.contributionCount || 0}</strong>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
      {selected && (
        <div
          className="workspace-overlay"
          role="presentation"
          onClick={() => setSelected(null)}
        >
          <div
            className="team-detail-modal"
            role="dialog"
            aria-modal="true"
            aria-label={`${selected.name} team details`}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="team-detail-header">
              <div>
                <span className="section-label">TEAM WORKSPACE</span>
                <h2>{selected.name}</h2>
                <p>
                  {selected.description || "Decision collaboration workspace"}
                </p>
              </div>
              <button
                className="icon-button"
                type="button"
                onClick={() => setSelected(null)}
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>
            {detailLoading ? (
              <EmptyState
                icon={Clock3}
                title="Loading team"
                body="Fetching members, activity and decisions."
              />
            ) : (
              <>
                <div className="module-stat-grid team-stats">
                  <div className="module-stat-card">
                    <span>Decisions</span>
                    <strong>{selected._count?.decisions || 0}</strong>
                    <small>Linked to this team</small>
                  </div>
                  <div className="module-stat-card">
                    <span>Your contribution</span>
                    <strong>
                      {selected.contributionSummary?.myContributions || 0}
                    </strong>
                    <small>Recorded activities</small>
                  </div>
                  <div className="module-stat-card">
                    <span>Your decisions</span>
                    <strong>
                      {selected.contributionSummary?.myDecisions || 0}
                    </strong>
                    <small>Created by you</small>
                  </div>
                </div>
                <div className="team-detail-grid">
                  <div className="team-panel-card">
                    <div className="lower-card-header">
                      <div>
                        <span className="section-label">MEMBERS</span>
                        <h3>Team contribution</h3>
                      </div>
                    </div>
                    {selected.memberContributions?.map((member) => (
                      <div
                        className="member-contribution-row"
                        key={member.user.id}
                      >
                        <div className="member-mini-avatar">
                          {member.user.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <strong>{member.user.name}</strong>
                          <span>
                            {member.teamRole} · {member.user.role}
                          </span>
                        </div>
                        <div className="member-contribution-numbers">
                          <strong>{member.decisionsContributed}</strong>
                          <span>decisions</span>
                        </div>
                        <div className="member-contribution-numbers">
                          <strong>{member.contributions}</strong>
                          <span>activities</span>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="team-panel-card">
                    <div className="lower-card-header">
                      <div>
                        <span className="section-label">RECENT ACTIVITY</span>
                        <h3>What changed</h3>
                      </div>
                    </div>
                    {selected.recentActivity?.length ? (
                      selected.recentActivity.slice(0, 6).map((item) => (
                        <div className="team-activity-row" key={item.id}>
                          <div className="activity-status approved" />
                          <div>
                            <strong>{item.action.replaceAll("_", " ")}</strong>
                            <span>
                              {item.user?.name || "Workspace member"} ·{" "}
                              {formatRelative(item.createdAt)}
                            </span>
                          </div>
                        </div>
                      ))
                    ) : (
                      <EmptyState
                        icon={Users}
                        title="No activity yet"
                        body="Team activity appears as members work."
                      />
                    )}
                  </div>
                </div>
                <div className="team-panel-card">
                  <div className="lower-card-header">
                    <div>
                      <span className="section-label">DECISIONS</span>
                      <h3>Team decisions</h3>
                    </div>
                  </div>
                  <div className="workspace-decisions-list compact-team-decision-list">
                    {selected.decisions?.length ? (
                      selected.decisions.map((decision) => (
                        <div
                          className="workspace-decision-card"
                          key={decision.id}
                        >
                          <div className="decision-left">
                            <div className="decision-info">
                              <strong>{decision.title}</strong>
                              <span>
                                {decision.createdBy?.name || "Workspace member"}
                              </span>
                            </div>
                          </div>
                          <span
                            className={`status status-${statusClass(decision.status)}`}
                          >
                            <span />
                            {statusLabel(decision.status)}
                          </span>
                          <span className="decision-date">
                            {formatDate(decision.updatedAt)}
                          </span>
                        </div>
                      ))
                    ) : (
                      <EmptyState
                        icon={FileText}
                        title="No team decisions"
                        body="Link a decision to this team to build the workspace history."
                      />
                    )}
                  </div>
                </div>
                {canManageMembers && (
                  <form
                    className="module-form-card team-member-form"
                    onSubmit={addMember}
                  >
                    <div>
                      <div className="panel-kicker">TEAM ADMINISTRATION</div>
                      <h3>Add a member</h3>
                    </div>
                    <div className="module-form-grid two-columns">
                      <select
                        value={memberUserId}
                        onChange={(event) =>
                          setMemberUserId(event.target.value)
                        }
                      >
                        <option value="">Select user</option>
                        {users
                          .filter(
                            (user) =>
                              !selected.members?.some(
                                (member) => member.userId === user.id,
                              ),
                          )
                          .map((user) => (
                            <option key={user.id} value={user.id}>
                              {user.name} · {user.role}
                            </option>
                          ))}
                      </select>
                      <select
                        value={memberRole}
                        onChange={(event) => setMemberRole(event.target.value)}
                      >
                        <option>Member</option>
                        <option>Lead</option>
                        <option>Manager</option>
                      </select>
                    </div>
                    <button className="modal-primary" type="submit">
                      Add member <ArrowUpRight size={14} />
                    </button>
                  </form>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

function KnowledgePage({ apiRequest, globalSearch = "", openDecision }) {
  const [decisions, setDecisions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState(globalSearch);
  const [expanded, setExpanded] = useState(null);
  const [statusFilter, setStatusFilter] = useState("all");

  const load = async () => {
    try {
      setLoading(true);
      setError("");
      const data = await apiRequest(
        "/api/knowledge?tab=decisions&page=1&pageSize=50",
      );
      setDecisions(data?.decisions || []);
    } catch (requestError) {
      setError(
        requestError.message || "Unable to load the knowledge repository.",
      );
      setDecisions([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);
  useEffect(() => {
    setSearch(globalSearch);
  }, [globalSearch]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return decisions.filter((decision) => {
      const matchesQuery =
        !query ||
        [
          decision.title,
          decision.problemStatement,
          decision.team?.name,
          decision.createdBy?.name,
          ...(decision.documents || []).map((doc) => doc.filename),
        ]
          .join(" ")
          .toLowerCase()
          .includes(query);
      const matchesStatus =
        statusFilter === "all" || decision.status === statusFilter;
      return matchesQuery && matchesStatus;
    });
  }, [decisions, search, statusFilter]);

  const totalDocuments = decisions.reduce(
    (sum, decision) => sum + (decision.documents?.length || 0),
    0,
  );
  const approved = decisions.filter(
    (decision) => decision.status === "Approved",
  ).length;

  return (
    <section className="workspace-page full-module-page knowledge-redesign-page">
      <div className="workspace-page-header knowledge-header">
        <div>
          <span className="section-label">KNOWLEDGE</span>
          <h1>Knowledge Repository</h1>
          <p>
            Decision-centered knowledge: every decision keeps its supporting
            evidence, context and history together.
          </p>
        </div>
        <button className="compact-action" type="button" onClick={load}>
          Refresh
        </button>
      </div>

      <div className="knowledge-overview-strip">
        <div>
          <span>Decisions</span>
          <strong>{decisions.length}</strong>
        </div>
        <div>
          <span>Documents</span>
          <strong>{totalDocuments}</strong>
        </div>
        <div>
          <span>Approved</span>
          <strong>{approved}</strong>
        </div>
        <div>
          <span>Evidence coverage</span>
          <strong>
            {decisions.length
              ? Math.round(
                  (decisions.filter(
                    (decision) => (decision.documents || []).length > 0,
                  ).length /
                    decisions.length) *
                    100,
                )
              : 0}
            %
          </strong>
        </div>
      </div>

      <div className="knowledge-controls">
        <div className="dashboard-search inline-search">
          <Search size={16} />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search decisions, documents, teams or people..."
          />
        </div>
        <select
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value)}
        >
          <option value="all">All statuses</option>
          <option value="Draft">Draft</option>
          <option value="UnderReview">Under review</option>
          <option value="Approved">Approved</option>
          <option value="Rejected">Rejected</option>
          <option value="Archived">Archived</option>
        </select>
        <span>
          {filtered.length} decision{filtered.length === 1 ? "" : "s"}
        </span>
      </div>

      <div className="knowledge-decision-grid">
        {loading ? (
          <EmptyState
            icon={Clock3}
            title="Loading knowledge"
            body="Fetching decisions and their supporting documents."
          />
        ) : error ? (
          <div className="module-error-state">
            <X size={18} />
            <strong>Knowledge unavailable</strong>
            <span>{error}</span>
            <button type="button" onClick={load}>
              Try again
            </button>
          </div>
        ) : filtered.length ? (
          filtered.map((decision) => {
            const isOpen = expanded === decision.id;
            const docs = decision.documents || [];
            return (
              <article
                className={`knowledge-decision-card ${isOpen ? "expanded" : ""}`}
                key={decision.id}
              >
                <button
                  className="knowledge-decision-card-head"
                  type="button"
                  onClick={() =>
                    setExpanded((current) =>
                      current === decision.id ? null : decision.id,
                    )
                  }
                >
                  <div className="knowledge-decision-icon">
                    <CheckCircle2 size={18} />
                  </div>
                  <div className="knowledge-decision-head-copy">
                    <div className="knowledge-card-kicker">
                      DECISION KNOWLEDGE
                    </div>
                    <strong>{decision.title}</strong>
                    <span>
                      {decision.problemStatement ||
                        "No problem statement added."}
                    </span>
                    <small>
                      {decision.team?.name || "Unassigned"} ·{" "}
                      {decision.createdBy?.name || "Workspace member"} · Updated{" "}
                      {formatDate(decision.updatedAt)}
                    </small>
                  </div>
                  <div className="knowledge-decision-head-meta">
                    <span
                      className={`status status-${statusClass(decision.status)}`}
                    >
                      <span />
                      {statusLabel(decision.status)}
                    </span>
                    <span className="knowledge-document-count">
                      {docs.length} document{docs.length === 1 ? "" : "s"}
                    </span>
                    <ChevronRight
                      className={
                        isOpen ? "knowledge-chevron open" : "knowledge-chevron"
                      }
                      size={18}
                    />
                  </div>
                </button>

                {isOpen && (
                  <div className="knowledge-decision-expanded">
                    <div className="knowledge-expanded-toolbar">
                      <div>
                        <strong>Supporting documents</strong>
                        <span>
                          {docs.length
                            ? "Evidence attached to this decision"
                            : "No documents attached yet"}
                        </span>
                      </div>
                      {openDecision && (
                        <button
                          type="button"
                          className="knowledge-open-decision"
                          onClick={() => openDecision(decision)}
                        >
                          Open full decision <ArrowUpRight size={13} />
                        </button>
                      )}
                    </div>
                    {docs.length ? (
                      <div className="knowledge-document-stack">
                        {docs.map((doc) => (
                          <div className="knowledge-document-item" key={doc.id}>
                            <div className="knowledge-file-icon">
                              {String(doc.filename)
                                .toLowerCase()
                                .endsWith(".pdf")
                                ? "PDF"
                                : "FILE"}
                            </div>
                            <div className="knowledge-document-item-copy">
                              <strong>{doc.filename}</strong>
                              <span>
                                {doc.category || "General"} · Uploaded by{" "}
                                {doc.uploadedBy?.name || "Workspace member"} ·{" "}
                                {formatDate(doc.createdAt)}
                              </span>
                              {doc.tags ? (
                                <div className="tag-list">
                                  {doc.tags
                                    .split(",")
                                    .map((tag) => tag.trim())
                                    .filter(Boolean)
                                    .slice(0, 4)
                                    .map((tag) => (
                                      <span key={tag}>{tag}</span>
                                    ))}
                                </div>
                              ) : null}
                            </div>
                            <a
                              className="knowledge-view-button"
                              href={`${API_BASE_URL}/${String(doc.filePath || "").replaceAll("\\", "/")}`}
                              target="_blank"
                              rel="noreferrer"
                            >
                              Open <ArrowUpRight size={13} />
                            </a>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <EmptyState
                        icon={FolderOpen}
                        title="No supporting documents"
                        body="Upload evidence from the decision workspace to build this knowledge record."
                      />
                    )}
                  </div>
                )}
              </article>
            );
          })
        ) : (
          <EmptyState
            icon={Search}
            title="No matching decisions"
            body="Try a different search or status filter."
          />
        )}
      </div>
    </section>
  );
}

function DocumentKnowledgeRow({ document }) {
  return (
    <div className="knowledge-document-row">
      <div className="knowledge-file-icon">
        {String(document.filename).toLowerCase().endsWith(".pdf")
          ? "PDF"
          : "FILE"}
      </div>
      <div className="knowledge-document-copy">
        <strong>{document.filename}</strong>
        <span>
          Uploaded by {document.uploadedBy?.name || "Workspace member"} ·{" "}
          {formatDate(document.createdAt)}
        </span>
        <div className="tag-list">
          {document.tags
            ?.split(",")
            .map((tag) => tag.trim())
            .filter(Boolean)
            .slice(0, 4)
            .map((tag) => (
              <span key={tag}>{tag}</span>
            ))}
        </div>
      </div>
      <div className="knowledge-document-context">
        <strong>{document.decision?.title || "Supporting document"}</strong>
        <span>{document.decision?.team?.name || "Shared workspace"}</span>
      </div>
      <a
        className="knowledge-view-button"
        href={`${API_BASE_URL}/${String(document.filePath || "").replaceAll("\\", "/")}`}
        target="_blank"
        rel="noreferrer"
      >
        Open <ArrowUpRight size={13} />
      </a>
    </div>
  );
}

function DecisionKnowledgeRow({ decision }) {
  return (
    <div className="knowledge-decision-row">
      <div className="decision-icon">
        <CheckCircle2 size={17} />
      </div>
      <div>
        <strong>{decision.title}</strong>
        <span>{decision.problemStatement}</span>
        <small>
          {decision.team?.name || "Unassigned"} ·{" "}
          {decision.createdBy?.name || "Workspace member"}
        </small>
      </div>
      <span className={`status status-${statusClass(decision.status)}`}>
        <span />
        {statusLabel(decision.status)}
      </span>
    </div>
  );
}

function DiscussionsPage({ apiRequest, globalSearch = "" }) {
  const [decisions, setDecisions] = useState([]);
  const [selectedDecisionId, setSelectedDecisionId] = useState("");
  const [discussions, setDiscussions] = useState([]);
  const [search, setSearch] = useState("");
  const [text, setText] = useState("");
  const [type, setType] = useState("Comment");
  const [loading, setLoading] = useState(false);
  const [loadingDecisions, setLoadingDecisions] = useState(true);
  const [posting, setPosting] = useState(false);

  const loadDecisions = async () => {
    try {
      setLoadingDecisions(true);
      const data = await apiRequest("/api/decisions");
      const list = data?.decisions || [];
      setDecisions(list);
      setSelectedDecisionId(
        (current) => current || (list[0] ? String(list[0].id) : ""),
      );
    } catch {
      setDecisions([]);
    } finally {
      setLoadingDecisions(false);
    }
  };

  const loadDiscussion = async (id) => {
    if (!id) {
      setDiscussions([]);
      return;
    }
    try {
      setLoading(true);
      const data = await apiRequest(`/api/decisions/${id}/discussions`);
      setDiscussions(data?.discussions || []);
    } catch {
      setDiscussions([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDecisions();
  }, []);

  useEffect(() => {
    loadDiscussion(selectedDecisionId);
  }, [selectedDecisionId]);

  useEffect(() => {
    setSearch(globalSearch || "");
  }, [globalSearch]);

  const post = async (event) => {
    event.preventDefault();
    if (!selectedDecisionId || !text.trim()) return;
    try {
      setPosting(true);
      await apiRequest(`/api/decisions/${selectedDecisionId}/discussions`, {
        method: "POST",
        body: JSON.stringify({ type, content: text.trim(), parentId: null }),
      });
      setText("");
      await loadDiscussion(selectedDecisionId);
    } catch (error) {
      alert(error.message || "Unable to post discussion.");
    } finally {
      setPosting(false);
    }
  };

  const filtered = discussions.filter((item) =>
    `${item.content} ${item.createdBy?.name || ""}`
      .toLowerCase()
      .includes(search.toLowerCase()),
  );
  const selectedDecision = decisions.find(
    (decision) => String(decision.id) === String(selectedDecisionId),
  );

  return (
    <section className="workspace-page full-module-page">
      <div className="workspace-page-header discussion-page-header">
        <div>
          <span className="section-label">COLLABORATION</span>
          <h1>Discussions</h1>
          <p>
            Capture comments, meeting notes and decision rationale in one
            connected conversation.
          </p>
        </div>
        <div className="discussion-decision-picker">
          <label htmlFor="discussion-decision">Decision</label>
          <select
            id="discussion-decision"
            value={selectedDecisionId}
            onChange={(event) => setSelectedDecisionId(event.target.value)}
            disabled={loadingDecisions || decisions.length === 0}
          >
            <option value="">
              {loadingDecisions ? "Loading decisions..." : "Choose a decision"}
            </option>
            {decisions.map((decision) => (
              <option key={decision.id} value={decision.id}>
                {decision.title}
              </option>
            ))}
          </select>
          {selectedDecision && (
            <span>{selectedDecision.team?.name || "Unassigned"}</span>
          )}
        </div>
      </div>
      <div className="module-toolbar">
        <div className="dashboard-search inline-search">
          <Search size={16} />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search this discussion..."
          />
        </div>
        <span>{filtered.length} entries</span>
      </div>
      {selectedDecisionId ? (
        <>
          <form className="module-form-card" onSubmit={post}>
            <div className="discussion-compose-head">
              <select
                value={type}
                onChange={(event) => setType(event.target.value)}
              >
                <option value="Comment">Comment</option>
                <option value="MeetingNote">Meeting note</option>
                <option value="Rationale">Decision rationale</option>
              </select>
            </div>
            <textarea
              rows="4"
              value={text}
              onChange={(event) => setText(event.target.value)}
              placeholder="Share a comment, capture a meeting note, or record why the team chose this path..."
            />
            <div className="module-form-actions">
              <button
                className="modal-primary"
                type="submit"
                disabled={posting || !text.trim()}
              >
                {posting ? "Posting..." : "Post to discussion"}
                <ArrowUpRight size={14} />
              </button>
            </div>
          </form>
          <div className="discussion-module-list">
            {loading ? (
              <EmptyState
                icon={Clock3}
                title="Loading discussion"
                body="Fetching the conversation."
              />
            ) : filtered.length ? (
              filtered.map((item) => (
                <article className="discussion-module-card" key={item.id}>
                  <div className="discussion-card-header">
                    <div className="discussion-author">
                      <div className="discussion-avatar">
                        {(item.createdBy?.name || "W").charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <strong>
                          {item.createdBy?.name || "Workspace member"}
                        </strong>
                        <span>
                          {item.type === "MeetingNote"
                            ? "Meeting note"
                            : item.type === "Rationale"
                              ? "Decision rationale"
                              : "Comment"}{" "}
                          · {formatDate(item.createdAt)}
                        </span>
                      </div>
                    </div>
                  </div>
                  <p>{item.content}</p>
                  {item.attachments?.length ? (
                    <div className="tag-list">
                      {item.attachments.map((attachment) => (
                        <span key={attachment.id}>{attachment.filename}</span>
                      ))}
                    </div>
                  ) : null}
                </article>
              ))
            ) : (
              <EmptyState
                icon={MessageCircle}
                title="No discussions yet"
                body="Start the conversation for this decision."
              />
            )}
          </div>
        </>
      ) : (
        <EmptyState
          icon={MessageCircle}
          title="Select a decision"
          body="Choose a decision above to view or post discussion entries."
        />
      )}
    </section>
  );
}

function DocumentsPage({ apiRequest, globalSearch = "" }) {
  const [documents, setDocuments] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const load = async () => {
    try {
      setLoading(true);
      const data = await apiRequest(
        "/api/knowledge?tab=documents&page=1&pageSize=50",
      );
      setDocuments(data?.documents || []);
    } catch {
      setDocuments([]);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    setSearch(globalSearch || "");
  }, [globalSearch]);

  const filtered = documents.filter((item) =>
    `${item.filename} ${item.decision?.title || ""} ${item.tags || ""} ${item.category || ""}`
      .toLowerCase()
      .includes(search.toLowerCase()),
  );
  return (
    <section className="workspace-page full-module-page">
      <div className="workspace-page-header">
        <div>
          <span className="section-label">DOCUMENT ARCHIVE</span>
          <h1>Documents</h1>
          <p>
            Pure file storage: search, review and open supporting evidence
            without mixing it with broader knowledge discovery.
          </p>
        </div>
        <button className="compact-action" type="button" onClick={load}>
          Refresh
        </button>
      </div>
      <div className="module-toolbar">
        <div className="dashboard-search inline-search">
          <Search size={16} />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search files, decisions or tags..."
          />
        </div>
        <span>{filtered.length} files</span>
      </div>
      <div className="documents-summary-strip">
        <div>
          <strong>{documents.length}</strong>
          <span>Files archived</span>
        </div>
        <div>
          <strong>
            {new Set(documents.map((item) => item.category)).size}
          </strong>
          <span>Categories</span>
        </div>
        <div>
          <strong>
            {new Set(documents.map((item) => item.decisionId)).size}
          </strong>
          <span>Decisions linked</span>
        </div>
      </div>
      <div className="global-document-list">
        {loading ? (
          <EmptyState
            icon={Clock3}
            title="Loading documents"
            body="Fetching the file archive."
          />
        ) : filtered.length ? (
          filtered.map((document) => (
            <div className="global-document-row" key={document.id}>
              <div className="knowledge-file-icon">FILE</div>
              <div>
                <strong>{document.filename}</strong>
                <span>
                  {document.decision?.title || "Decision"} ·{" "}
                  {document.uploadedBy?.name || "Workspace member"} ·{" "}
                  {formatDate(document.createdAt)}
                </span>
              </div>
              <div className="tag-list">
                <span>{document.category || "General"}</span>
                {document.tags
                  ?.split(",")
                  .map((tag) => tag.trim())
                  .filter(Boolean)
                  .slice(0, 2)
                  .map((tag) => (
                    <span key={tag}>{tag}</span>
                  ))}
              </div>
              <a
                href={`${API_BASE_URL}/${String(document.filePath || "").replaceAll("\\", "/")}`}
                target="_blank"
                rel="noreferrer"
              >
                Open <ArrowUpRight size={13} />
              </a>
            </div>
          ))
        ) : (
          <EmptyState
            icon={FileText}
            title="No documents found"
            body="Upload supporting evidence from Knowledge or inside a decision."
          />
        )}
      </div>
    </section>
  );
}

function AnalyticsPage({ apiRequest, globalSearch = "" }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const load = async () => {
    try {
      setLoading(true);
      setError("");
      setData(await apiRequest("/api/analytics"));
    } catch (requestError) {
      setData(null);
      setError(requestError.message || "Unable to load analytics.");
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    load();
  }, []);
  const summary = data?.summary || {};
  const query = globalSearch.trim().toLowerCase();
  const filteredTeams = (data?.teamBreakdown || []).filter(
    (team) =>
      !query ||
      `${team.name} ${team._count?.members || 0} ${team._count?.decisions || 0}`
        .toLowerCase()
        .includes(query),
  );
  const filteredRecent = (data?.recent || []).filter(
    (decision) =>
      !query ||
      `${decision.title} ${decision.team?.name || ""} ${decision.createdBy?.name || ""} ${decision.status}`
        .toLowerCase()
        .includes(query),
  );
  const maxTeam = Math.max(
    1,
    ...(filteredTeams.length ? filteredTeams : data?.teamBreakdown || []).map(
      (team) => team._count?.decisions || 0,
    ),
  );
  return (
    <section className="workspace-page full-module-page">
      <div className="workspace-page-header">
        <div>
          <span className="section-label">ANALYTICS</span>
          <h1>Decision Analytics</h1>
          <p>
            Real workspace metrics for decision health, approvals, evidence and
            collaboration.
          </p>
        </div>
        <button className="compact-action" type="button" onClick={load}>
          Refresh
        </button>
      </div>
      {loading ? (
        <EmptyState
          icon={BarChart3}
          title="Loading analytics"
          body="Calculating workspace metrics."
        />
      ) : error ? (
        <div className="module-error-state">
          <strong>Analytics could not load</strong>
          <span>{error}</span>
          <button className="modal-primary" type="button" onClick={load}>
            Retry
          </button>
        </div>
      ) : (
        <>
          <div className="analytics-hero-grid">
            <div className="analytics-hero-card">
              <span>Total decisions</span>
              <strong>{summary.totalDecisions || 0}</strong>
              <small>
                {summary.drafts || 0} drafts · {summary.underReview || 0} under
                review
              </small>
            </div>
            <div className="analytics-hero-card">
              <span>Approval rate</span>
              <strong>{summary.approvalRate || 0}%</strong>
              <small>
                {summary.approved || 0} approved of{" "}
                {summary.totalDecisions || 0}
              </small>
            </div>
            <div className="analytics-hero-card">
              <span>Pending approvals</span>
              <strong>{summary.pendingApprovals || 0}</strong>
              <small>
                {summary.decidedApprovals || 0} decisions already reviewed
              </small>
            </div>
            <div className="analytics-hero-card">
              <span>Workspace footprint</span>
              <strong>{summary.totalTeams || 0}</strong>
              <small>
                {summary.totalUsers || 0} users · {summary.totalDocuments || 0}{" "}
                documents
              </small>
            </div>
          </div>
          <div className="analytics-grid">
            <div className="analytics-panel">
              <div className="lower-card-header">
                <div>
                  <span className="section-label">DECISION PIPELINE</span>
                  <h2>Status distribution</h2>
                </div>
              </div>
              {[
                ["Draft", summary.drafts],
                ["Under review", summary.underReview],
                ["Approved", summary.approved],
                ["Rejected", summary.rejected],
              ].map(([label, value]) => (
                <div className="metric-bar-row" key={label}>
                  <div>
                    <span>{label}</span>
                    <strong>{value || 0}</strong>
                  </div>
                  <div className="metric-bar">
                    <span
                      style={{
                        width: `${summary.totalDecisions ? Math.max(3, Math.round(((value || 0) / summary.totalDecisions) * 100)) : 0}%`,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
            <div className="analytics-panel">
              <div className="lower-card-header">
                <div>
                  <span className="section-label">TEAM SIGNALS</span>
                  <h2>Decision contribution</h2>
                </div>
              </div>
              {filteredTeams.length ? (
                filteredTeams.map((team) => (
                  <div className="analytics-team-row" key={team.id}>
                    <div>
                      <strong>{team.name}</strong>
                      <span>{team._count?.members || 0} members</span>
                      <div className="analytics-team-bar">
                        <span
                          style={{
                            width: `${Math.max(6, Math.round(((team._count?.decisions || 0) / maxTeam) * 100))}%`,
                          }}
                        />
                      </div>
                    </div>
                    <strong>{team._count?.decisions || 0}</strong>
                  </div>
                ))
              ) : (
                <EmptyState
                  icon={Users}
                  title="No team data"
                  body="Team decision links will appear here."
                />
              )}
            </div>
          </div>
          <div className="analytics-recent-panel">
            <div className="lower-card-header">
              <div>
                <span className="section-label">RECENT DECISIONS</span>
                <h2>Latest decision movement</h2>
              </div>
            </div>
            {filteredRecent.length ? (
              filteredRecent.map((decision) => (
                <div className="analytics-recent-row" key={decision.id}>
                  <div>
                    <strong>{decision.title}</strong>
                    <span>
                      {decision.team?.name || "Unassigned"} ·{" "}
                      {decision.createdBy?.name || "Workspace member"}
                    </span>
                  </div>
                  <span
                    className={`status status-${statusClass(decision.status)}`}
                  >
                    <span />
                    {statusLabel(decision.status)}
                  </span>
                  <small>{formatDate(decision.updatedAt)}</small>
                </div>
              ))
            ) : (
              <EmptyState
                icon={FileText}
                title="No decisions yet"
                body="Create decisions to populate the analytics view."
              />
            )}
          </div>
        </>
      )}
    </section>
  );
}

function UsersPage({ apiRequest, globalSearch = "" }) {
  const [users, setUsers] = useState([]);
  const [search, setSearch] = useState("");
  const load = () =>
    apiRequest("/api/users")
      .then((data) => setUsers(data?.users || []))
      .catch(() => setUsers([]));
  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    setSearch(globalSearch || "");
  }, [globalSearch]);

  const updateRole = async (userId, role) => {
    try {
      await apiRequest(`/api/users/${userId}/role`, {
        method: "PATCH",
        body: JSON.stringify({ role }),
      });
      await load();
    } catch (error) {
      alert(error.message || "Unable to update role.");
    }
  };
  const filtered = users.filter((item) =>
    `${item.name} ${item.email} ${item.role}`
      .toLowerCase()
      .includes(search.toLowerCase()),
  );
  return (
    <section className="workspace-page full-module-page">
      <div className="workspace-page-header">
        <div>
          <span className="section-label">ADMINISTRATION</span>
          <h1>Users</h1>
          <p>Manage roles and review activity across the organization.</p>
        </div>
        <button className="compact-action" type="button" onClick={load}>
          Refresh
        </button>
      </div>
      <div className="module-toolbar">
        <div className="dashboard-search inline-search">
          <Search size={16} />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search people..."
          />
        </div>
        <span>{filtered.length} users</span>
      </div>
      <div className="users-table">
        <div className="users-table-head">
          <span>User</span>
          <span>Role</span>
          <span>Decisions</span>
          <span>Discussions</span>
          <span>Change role</span>
        </div>
        {filtered.map((user) => (
          <div className="users-table-row" key={user.id}>
            <div className="user-row-main">
              <div className="member-mini-avatar">
                {user.name.charAt(0).toUpperCase()}
              </div>
              <div>
                <strong>{user.name}</strong>
                <span>{user.email}</span>
              </div>
            </div>
            <span>{user.role}</span>
            <strong>{user._count?.decisions || 0}</strong>
            <strong>{user._count?.discussions || 0}</strong>
            <select
              value={user.role}
              onChange={(event) => updateRole(user.id, event.target.value)}
            >
              <option>Employee</option>
              <option>Reviewer</option>
              <option>Manager</option>
              <option>Administrator</option>
            </select>
          </div>
        ))}
      </div>
    </section>
  );
}

function AuditPage({ apiRequest, globalSearch = "" }) {
  const [logs, setLogs] = useState([]);
  const [search, setSearch] = useState("");
  const load = () =>
    apiRequest(`/api/audit-logs?search=${encodeURIComponent(search)}`)
      .then((data) => setLogs(data?.logs || []))
      .catch(() => setLogs([]));

  useEffect(() => {
    setSearch(globalSearch || "");
  }, [globalSearch]);

  useEffect(() => {
    const timer = window.setTimeout(load, 250);
    return () => window.clearTimeout(timer);
  }, [search]);
  return (
    <section className="workspace-page full-module-page">
      <div className="workspace-page-header">
        <div>
          <span className="section-label">GOVERNANCE</span>
          <h1>Audit & Compliance</h1>
          <p>
            Trace important actions across decisions, approvals, documents,
            teams and users.
          </p>
        </div>
        <button className="compact-action" type="button" onClick={load}>
          Refresh
        </button>
      </div>
      <div className="module-toolbar">
        <div className="dashboard-search inline-search">
          <Search size={16} />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            onKeyDown={(event) => event.key === "Enter" && load()}
            placeholder="Search audit activity..."
          />
        </div>
        <span>{logs.length} events</span>
      </div>
      <div className="audit-list">
        {logs.length ? (
          logs.map((log) => (
            <div className="audit-row" key={log.id}>
              <div className="audit-icon">
                <ShieldCheck size={15} />
              </div>
              <div>
                <strong>{log.action.replaceAll("_", " ")}</strong>
                <span>
                  {log.user?.name || "System"} · {log.entityType}
                  {log.entityId ? ` #${log.entityId}` : ""}
                </span>
              </div>
              <small>{formatDate(log.createdAt)}</small>
            </div>
          ))
        ) : (
          <EmptyState
            icon={ShieldCheck}
            title="No audit events found"
            body="Your compliance trail will populate as users interact with the workspace."
          />
        )}
      </div>
    </section>
  );
}

function ReportsPage({ apiRequest, globalSearch = "" }) {
  const reportTypes = [
    [
      "decisions",
      "Decision Report",
      "Decision status, ownership, evidence and discussion footprint.",
    ],
    [
      "approvals",
      "Approval Report",
      "Reviewer assignments, approval outcomes and comments.",
    ],
    [
      "teams",
      "Team Report",
      "Team members and decision contribution footprint.",
    ],
    ["audit", "Audit Report", "Governance activity and change history."],
  ];
  const query = globalSearch.trim().toLowerCase();
  const visibleReportTypes = reportTypes.filter(
    ([, title, description]) =>
      !query || `${title} ${description}`.toLowerCase().includes(query),
  );
  const download = async (type) => {
    try {
      const data = await apiRequest(`/api/reports/${type}`);
      const report = data.report;
      const csv = [report.columns, ...report.rows]
        .map((row) =>
          row
            .map((value) => `"${String(value ?? "").replaceAll('"', '""')}"`)
            .join(","),
        )
        .join("\n");
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = report.filename;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      alert(error.message || "Unable to generate report.");
    }
  };
  const print = async (type) => {
    try {
      const data = await apiRequest(`/api/reports/${type}`);
      const report = data.report;
      const headers = report.columns.map((item) => `<th>${item}</th>`).join("");
      const rows = report.rows
        .slice(0, 200)
        .map(
          (row) =>
            `<tr>${row
              .map(
                (value) =>
                  `<td>${String(value ?? "")
                    .replaceAll("<", "&lt;")
                    .replaceAll(">", "&gt;")}</td>`,
              )
              .join("")}</tr>`,
        )
        .join("");
      const printWindow = window.open("", "_blank", "width=1200,height=800");
      if (!printWindow) return;
      printWindow.document.write(
        `<html><head><title>${report.filename}</title><style>body{font-family:Arial,sans-serif;padding:30px;color:#101512}h1{font-size:24px}table{border-collapse:collapse;width:100%;font-size:11px}th,td{border:1px solid #ddd;padding:7px;text-align:left}th{background:#edf7f0}</style></head><body><h1>${report.filename.replace(".csv", "")}</h1><table><thead><tr>${headers}</tr></thead><tbody>${rows}</tbody></table></body></html>`,
      );
      printWindow.document.close();
      printWindow.focus();
      printWindow.print();
    } catch (error) {
      alert(error.message || "Unable to prepare report.");
    }
  };
  return (
    <section className="workspace-page full-module-page">
      <div className="workspace-page-header">
        <div>
          <span className="section-label">REPORTING</span>
          <h1>Reports</h1>
          <p>
            Generate structured exports for decisions, approvals, teams and
            governance.
          </p>
        </div>
      </div>
      <div className="report-card-grid">
        {visibleReportTypes.length ? (
          visibleReportTypes.map(([key, title, description]) => (
            <article className="report-card" key={key}>
              <div className="report-card-icon">
                <FileText size={19} />
              </div>
              <div>
                <span className="panel-kicker">EXPORT</span>
                <h3>{title}</h3>
                <p>{description}</p>
              </div>
              <div className="report-card-actions">
                <button
                  className="modal-primary"
                  type="button"
                  onClick={() => download(key)}
                >
                  Excel / CSV <ArrowUpRight size={13} />
                </button>
                <button
                  className="modal-secondary"
                  type="button"
                  onClick={() => print(key)}
                >
                  Print / PDF <ArrowUpRight size={13} />
                </button>
              </div>
            </article>
          ))
        ) : (
          <EmptyState
            icon={FileText}
            title="No reports found"
            body="Try a different search term."
          />
        )}
      </div>
    </section>
  );
}

function SettingsPage({ currentUser, apiRequest, onUserUpdated }) {
  const [form, setForm] = useState({
    name: currentUser?.name || "",
    email: currentUser?.email || "",
  });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  useEffect(() => {
    setForm({ name: currentUser?.name || "", email: currentUser?.email || "" });
  }, [currentUser]);
  const save = async (event) => {
    event.preventDefault();
    try {
      setSaving(true);
      setMessage("");
      setError("");
      const data = await apiRequest("/api/auth/profile", {
        method: "PATCH",
        body: JSON.stringify(form),
      });
      setMessage("Profile saved successfully.");
      onUserUpdated?.(data.user);
    } catch (requestError) {
      setError(requestError.message || "Unable to save profile.");
    } finally {
      setSaving(false);
    }
  };
  return (
    <section className="workspace-page full-module-page">
      <div className="workspace-page-header">
        <div>
          <span className="section-label">ACCOUNT</span>
          <h1>Settings</h1>
          <p>
            Manage your profile, workspace identity and account preferences.
          </p>
        </div>
      </div>
      <div className="settings-grid">
        <form className="settings-card settings-edit-card" onSubmit={save}>
          <span className="section-label">PROFILE</span>
          <h3>Personal details</h3>
          <div className="settings-field">
            <label htmlFor="settings-name">Full name</label>
            <input
              id="settings-name"
              value={form.name}
              onChange={(event) =>
                setForm({ ...form, name: event.target.value })
              }
              required
            />
          </div>
          <div className="settings-field">
            <label htmlFor="settings-email">Email</label>
            <input
              id="settings-email"
              type="email"
              value={form.email}
              onChange={(event) =>
                setForm({ ...form, email: event.target.value })
              }
              required
            />
          </div>
          <div className="settings-readonly-row">
            <span>Role</span>
            <strong>{currentUser?.role || "Employee"}</strong>
          </div>
          <button
            className="modal-primary settings-save-button"
            type="submit"
            disabled={saving}
          >
            {saving ? "Saving..." : "Save profile"}
            <ArrowUpRight size={14} />
          </button>
          {message && <div className="settings-success">{message}</div>}
          {error && <div className="settings-error">{error}</div>}
        </form>
        <div className="settings-card">
          <span className="section-label">WORKSPACE</span>
          <h3>Decision intelligence</h3>
          <p>
            Decisions, evidence, discussions and approvals remain connected
            instead of being split across separate tools.
          </p>
          <div className="settings-preference-row">
            <span>Knowledge discovery</span>
            <strong>Enabled</strong>
          </div>
          <div className="settings-preference-row">
            <span>Activity history</span>
            <strong>Enabled</strong>
          </div>
          <div className="settings-preference-row">
            <span>Approval tracking</span>
            <strong>
              {["Reviewer", "Manager", "Administrator"].includes(
                currentUser?.role,
              )
                ? "Enabled"
                : "Available to reviewers"}
            </strong>
          </div>
        </div>
      </div>
    </section>
  );
}

export {
  ReviewsPage,
  TeamsPage,
  KnowledgePage,
  DiscussionsPage,
  DocumentsPage,
  AnalyticsPage,
  UsersPage,
  AuditPage,
  ReportsPage,
  SettingsPage,
};
