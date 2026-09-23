import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowUpRight,
  BarChart3,
  CheckCircle2,
  ChevronRight,
  Clock3,
  FileText,
  FolderOpen,
  GitBranch,
  Maximize2,
  MessageCircle,
  Minus,
  Network,
  Plus,
  Search,
  ShieldCheck,
  Users,
  X,
} from "lucide-react";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:4000";

const KNOWLEDGE_GRAPH_WIDTH = 1800;
const KNOWLEDGE_GRAPH_HEIGHT = 1300;
const KNOWLEDGE_GRAPH_DEFAULT_ZOOM = 1;

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

function TeamsPage({
  apiRequest,
  currentUser,
  globalSearch = "",
  initialTeamId = null,
}) {
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

  useEffect(() => {
    if (initialTeamId) {
      openTeam(Number(initialTeamId));
    }
  }, [initialTeamId]);

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

function KnowledgePage({
  apiRequest,
  globalSearch = "",
  openDecision,
  openTeam,
}) {
  const [decisionOptions, setDecisionOptions] = useState([]);
  const [selectedDecisionId, setSelectedDecisionId] = useState(null);
  const [graph, setGraph] = useState({ nodes: [], edges: [] });
  const [search, setSearch] = useState(globalSearch);
  const [searchFocused, setSearchFocused] = useState(false);
  const [searching, setSearching] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [selectedNode, setSelectedNode] = useState(null);
  const [expanded, setExpanded] = useState({
    documents: false,
    alternatives: false,
    discussions: false,
  });
  const [zoom, setZoom] = useState(KNOWLEDGE_GRAPH_DEFAULT_ZOOM);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [filter, setFilter] = useState("all");
  const dragRef = useRef({
    x: 0,
    y: 0,
    panX: 0,
    panY: 0,
  });

  const searchDecisions = async (value) => {
    try {
      setSearching(true);
      setError("");

      const query = value.trim();
      const endpoint = query
        ? `/api/knowledge/graph?search=${encodeURIComponent(query)}`
        : "/api/knowledge/graph";

      const data = await apiRequest(endpoint);
      const options = Array.isArray(data?.decisionOptions)
        ? data.decisionOptions
        : [];

      setDecisionOptions(options);

      if (!selectedDecisionId && data?.recommendedDecisionId) {
        await loadGraph(data.recommendedDecisionId);
      }
    } catch (searchError) {
      console.error("Knowledge graph search error:", searchError);
      setError(searchError.message || "Unable to load the knowledge graph.");
    } finally {
      setSearching(false);
    }
  };

  const loadGraph = async (decisionId) => {
    try {
      setLoading(true);
      setError("");

      const id = Number(decisionId);

      if (!Number.isInteger(id) || id <= 0) {
        throw new Error("Invalid decision ID.");
      }

      const data = await apiRequest(`/api/knowledge/graph?decisionId=${id}`);

      const nodes = Array.isArray(data?.nodes) ? data.nodes : [];

      const root = nodes.find(
        (node) => node.type === "decision" && Number(node.entityId) === id,
      );

      setSelectedDecisionId(id);
      setGraph({
        nodes,
        edges: Array.isArray(data?.edges) ? data.edges : [],
      });
      setSelectedNode(root || null);
      setExpanded({
        documents: false,
        alternatives: false,
        discussions: false,
      });
      setZoom(KNOWLEDGE_GRAPH_DEFAULT_ZOOM);
      setPan({ x: 0, y: 0 });
      setSearchFocused(false);
    } catch (loadError) {
      console.error("Knowledge graph load error:", loadError);
      setError(loadError.message || "Unable to load the knowledge graph.");
      setGraph({ nodes: [], edges: [] });
      setSelectedNode(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    searchDecisions("");
  }, []);

  useEffect(() => {
    setSearch(globalSearch || "");
  }, [globalSearch]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (search.trim()) {
        searchDecisions(search);
      }
    }, 250);

    return () => window.clearTimeout(timer);
  }, [search]);

  const selectedDecision = graph.nodes.find(
    (node) =>
      node.type === "decision" &&
      Number(node.entityId) === Number(selectedDecisionId),
  );

  const visibleNodeList = useMemo(() => {
    const nodes = Array.isArray(graph.nodes) ? graph.nodes : [];

    return nodes.filter((node) => {
      if (node.type === "decision") return true;
      if (node.metadata?.group === "documents") {
        return true;
      }
      if (node.metadata?.group === "alternatives") {
        return true;
      }
      if (node.metadata?.group === "discussions") {
        return true;
      }
      if (node.type === "person" || node.type === "team") {
        return true;
      }
      if (node.type === "document") {
        return expanded.documents;
      }
      if (node.type === "alternative") {
        return expanded.alternatives;
      }
      if (node.type === "discussion") {
        return expanded.discussions;
      }
      return false;
    });
  }, [graph.nodes, expanded]);

  const visibleNodeIds = useMemo(
    () => new Set(visibleNodeList.map((node) => node.id)),
    [visibleNodeList],
  );

  const visibleEdges = useMemo(
    () =>
      graph.edges.filter(
        (edge) =>
          visibleNodeIds.has(edge.source) && visibleNodeIds.has(edge.target),
      ),
    [graph.edges, visibleNodeIds],
  );

  const connectedNodeIds = useMemo(() => {
    if (!selectedNode) return new Set();

    const ids = new Set([selectedNode.id]);

    visibleEdges.forEach((edge) => {
      if (edge.source === selectedNode.id) {
        ids.add(edge.target);
      }
      if (edge.target === selectedNode.id) {
        ids.add(edge.source);
      }
    });

    return ids;
  }, [selectedNode, visibleEdges]);

  const nodePositions = useMemo(() => {
    if (!selectedDecision) return {};

    const WIDTH = KNOWLEDGE_GRAPH_WIDTH;
    const HEIGHT = KNOWLEDGE_GRAPH_HEIGHT;
    const CENTER_X = WIDTH / 2;
    const CENTER_Y = HEIGHT / 2;

    const positions = {};

    positions[selectedDecision.id] = {
      ...selectedDecision,
      x: CENTER_X,
      y: CENTER_Y,
    };

    const groups = {
      person: visibleNodeList.find((node) => node.type === "person"),
      team: visibleNodeList.find((node) => node.type === "team"),
      documents: visibleNodeList.find(
        (node) => node.metadata?.group === "documents",
      ),
      alternatives: visibleNodeList.find(
        (node) => node.metadata?.group === "alternatives",
      ),
      discussions: visibleNodeList.find(
        (node) => node.metadata?.group === "discussions",
      ),
    };

    // Keep every first-degree group inside the initial viewport.
    const groupPositions = {
      // Keep the complete first-degree map inside the 100% viewport.
      person: [CENTER_X, 465],
      team: [630, CENTER_Y],
      documents: [1170, CENTER_Y],
      alternatives: [560, 820],
      discussions: [1240, 820],
    };

    Object.entries(groups).forEach(([key, node]) => {
      if (!node) return;
      const [x, y] = groupPositions[key];
      positions[node.id] = { ...node, x, y };
    });

    const placeGrid = ({ items, startX, startY, columns, stepX, stepY }) => {
      items.forEach((node, index) => {
        const column = index % columns;
        const row = Math.floor(index / columns);
        positions[node.id] = {
          ...node,
          x: startX + column * stepX,
          y: startY + row * stepY,
        };
      });
    };

    // Children fan away from their group instead of stacking on top of it.
    if (expanded.documents) {
      placeGrid({
        items: visibleNodeList.filter((node) => node.type === "document"),
        startX: 1330,
        startY: 430,
        columns: 2,
        stepX: 205,
        stepY: 105,
      });
    }

    if (expanded.alternatives) {
      const alternativeChildren = visibleNodeList.filter(
        (node) => node.type === "alternative",
      );

      /*
       * Alternatives branch:
       * spread downward and toward the left so the
       * options read as a dedicated branch rather
       * than a horizontal row across the canvas.
       */
      alternativeChildren.forEach((node, index) => {
        positions[node.id] = {
          ...node,
          x: 560 - index * 200,
          y: 955 + index * 135,
        };
      });
    }

    if (expanded.discussions) {
      placeGrid({
        items: visibleNodeList.filter((node) => node.type === "discussion"),
        startX: 920,
        startY: 985,
        columns: 4,
        stepX: 210,
        stepY: 110,
      });
    }

    return positions;
  }, [visibleNodeList, selectedDecision, expanded]);

  const renderedEdges = visibleEdges;

  const filterOptions = [
    ["all", "All"],
    ["documents", "Documents"],
    ["people", "Created by"],
    ["teams", "Team"],
    ["alternatives", "Alternatives"],
    ["discussions", "Discussions"],
  ];

  const filterTypeMap = {
    documents: "document",
    people: "person",
    teams: "team",
    alternatives: "alternative",
    discussions: "discussion",
  };

  const filteredNodeIds = useMemo(() => {
    if (filter === "all") {
      return visibleNodeIds;
    }

    const ids = new Set();

    visibleNodeList.forEach((node) => {
      const isGroupForFilter = node.metadata?.group === filter;

      if (
        node.type === "decision" ||
        node.type === filterTypeMap[filter] ||
        isGroupForFilter
      ) {
        ids.add(node.id);
      }
    });

    return ids;
  }, [filter, visibleNodeIds, visibleNodeList]);

  const finalEdges = renderedEdges.filter(
    (edge) =>
      filteredNodeIds.has(edge.source) && filteredNodeIds.has(edge.target),
  );

  const searchMatches = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) {
      return decisionOptions.slice(0, 8).map((option) => ({
        type: "decision",
        id: option.id,
        title: option.title,
        subtitle: `${statusLabel(option.status)} · ${option.team?.name || "Unassigned"}`,
        decisionId: option.id,
      }));
    }

    return decisionOptions
      .filter((option) =>
        [option.title, option.status, option.team?.name, option.createdBy?.name]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(query),
      )
      .slice(0, 10)
      .map((option) => ({
        type: "decision",
        id: option.id,
        title: option.title,
        subtitle: `${statusLabel(option.status)} · ${option.team?.name || "Unassigned"}`,
        decisionId: option.id,
      }));
  }, [decisionOptions, search]);

  const toggleGroup = (group) => {
    setExpanded((current) => {
      const next = {
        ...current,
        [group]: !current[group],
      };

      const anyExpanded = Object.values(next).some(Boolean);

      if (!anyExpanded) {
        setZoom(KNOWLEDGE_GRAPH_DEFAULT_ZOOM);
        setPan({ x: 0, y: 0 });
      } else if (!current[group]) {
        // Give the expanded branch room by moving the world slightly.
        if (group === "documents") {
          setPan({ x: -90, y: 0 });
        } else if (group === "alternatives") {
          // The alternative branch grows down-left, so
          // shift the world slightly right/up to keep it
          // comfortably inside the visible viewport.
          setPan({ x: 120, y: -130 });
        } else if (group === "discussions") {
          setPan({ x: 0, y: -135 });
        }
      }

      return next;
    });
  };

  const expandAll = () => {
    setExpanded({
      documents: true,
      alternatives: true,
      discussions: true,
    });
    setZoom(0.6);
    setPan({ x: 0, y: -125 });
  };

  const collapseAll = () => {
    setExpanded({
      documents: false,
      alternatives: false,
      discussions: false,
    });
    setZoom(KNOWLEDGE_GRAPH_DEFAULT_ZOOM);
    setPan({ x: 0, y: 0 });
  };

  const handleNodeClick = (node) => {
    setSelectedNode(node);

    if (node.metadata?.group) {
      toggleGroup(node.metadata.group);
    }
  };

  const handleOpenNode = (node) => {
    if (!node) return;

    if (node.metadata?.group) {
      const decisionId = Number(
        node.metadata?.decisionId || selectedDecision?.entityId,
      );

      if (!decisionId || typeof openDecision !== "function") {
        return;
      }

      const decision = decisionOptions.find(
        (item) => Number(item.id) === decisionId,
      ) || {
        id: decisionId,
        title: selectedDecision?.label || "Decision",
        status: selectedDecision?.subtitle || "Draft",
      };

      const tab =
        node.metadata.group === "documents"
          ? "documents"
          : node.metadata.group === "alternatives"
            ? "alternatives"
            : "discussion";

      openDecision(decision, tab);
      return;
    }

    if (node.type === "document") {
      const filePath = node.metadata?.filePath;

      if (!filePath) return;

      window.open(
        `${API_BASE_URL}/${String(filePath).replaceAll("\\", "/")}`,
        "_blank",
        "noopener,noreferrer",
      );
      return;
    }

    if (node.type === "team") {
      if (typeof openTeam === "function") {
        openTeam(Number(node.entityId));
      }
      return;
    }

    const decisionId = Number(
      node.metadata?.decisionId || selectedDecision?.entityId,
    );

    if (!decisionId || typeof openDecision !== "function") {
      return;
    }

    const decision = decisionOptions.find(
      (item) => Number(item.id) === decisionId,
    ) || {
      id: decisionId,
      title: selectedDecision?.label || "Decision",
      status: selectedDecision?.subtitle || "Draft",
    };

    const tab =
      node.type === "alternative"
        ? "alternatives"
        : node.type === "discussion"
          ? "discussion"
          : "overview";

    openDecision(decision, tab);
  };

  const handleCanvasPointerDown = (event) => {
    if (event.target.closest("button, a, input, select, textarea")) {
      return;
    }

    event.preventDefault();

    setIsPanning(true);

    dragRef.current = {
      x: event.clientX,
      y: event.clientY,
      panX: pan.x,
      panY: pan.y,
    };

    event.currentTarget.setPointerCapture?.(event.pointerId);
  };

  const handleCanvasPointerMove = (event) => {
    if (!isPanning) return;

    setPan({
      x: dragRef.current.panX + event.clientX - dragRef.current.x,
      y: dragRef.current.panY + event.clientY - dragRef.current.y,
    });
  };

  const stopPanning = (event) => {
    if (!isPanning) return;

    setIsPanning(false);
    event.currentTarget.releasePointerCapture?.(event.pointerId);
  };

  const openActionLabel = {
    decision: "Open Decision",
    person: "Open Decision",
    team: "Open Team",
    document: "Open Document",
    alternative: "Open Alternatives",
    discussion: "Open Discussion",
  }[selectedNode?.type];

  const groupActionLabel = {
    documents: "Open Documents",
    alternatives: "Open Alternatives",
    discussions: "Open Discussions",
  }[selectedNode?.metadata?.group];

  const selectedDescription = selectedNode?.metadata?.problemStatement;

  const groupCount = selectedNode?.metadata?.group
    ? selectedNode?.metadata?.count || 0
    : 0;

  return (
    <section className="workspace-page full-module-page knowledge-graph-page-v6">
      <div className="knowledge-graph-heading-v6">
        <div>
          <span className="section-label">KNOWLEDGE</span>
          <h1>Knowledge Graph</h1>
          <p>
            Explore how decisions connect to people, teams, documents,
            alternatives and discussions.
          </p>
        </div>

        <div className="knowledge-graph-heading-actions-v6">
          <button
            type="button"
            className="knowledge-graph-soft-button-v6"
            onClick={() => {
              setZoom(1);
              setPan({ x: 0, y: 0 });
            }}
          >
            <Maximize2 size={14} />
            Reset view
          </button>

          <button
            type="button"
            className="knowledge-graph-primary-button-v6"
            onClick={expandAll}
          >
            <Plus size={14} />
            Expand all
          </button>
        </div>
      </div>

      <div className="knowledge-graph-search-card-v6">
        <Search size={17} />
        <input
          value={search}
          onFocus={() => setSearchFocused(true)}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search decisions..."
          aria-label="Search decisions"
        />
        {searching && <span>Searching…</span>}

        {searchFocused && (
          <div className="knowledge-graph-search-results-v6">
            {searchMatches.map((result) => (
              <button
                type="button"
                key={`${result.type}:${result.id}`}
                onClick={() => {
                  setSearchFocused(false);
                  loadGraph(result.decisionId);
                }}
              >
                <span className="knowledge-graph-result-icon-v6">
                  <GitBranch size={14} />
                </span>
                <span>
                  <strong>{result.title}</strong>
                  <small>{result.subtitle}</small>
                </span>
                <ChevronRight size={14} />
              </button>
            ))}
          </div>
        )}
      </div>

      {!selectedDecisionId ? (
        <div className="knowledge-graph-empty-v6">
          <Network size={24} />
          <strong>
            {error ? "Knowledge Graph unavailable" : "Choose a decision"}
          </strong>
          <span>
            {error ||
              "Search above to open a decision and explore its connected knowledge."}
          </span>

          {error && (
            <button type="button" onClick={() => searchDecisions("")}>
              Try again
            </button>
          )}
        </div>
      ) : (
        <div className="knowledge-graph-shell-v6">
          <div className="knowledge-graph-toolbar-v6">
            <div className="knowledge-graph-toolbar-copy-v6">
              <span className="section-label">IMPORTANT DECISION</span>
              <strong>{selectedDecision?.label || "Decision"}</strong>
              <small>{visibleNodeList.length - 1} connected items shown</small>
            </div>

            <div className="knowledge-graph-toolbar-actions-v6">
              <button
                type="button"
                className="knowledge-graph-soft-button-v6"
                onClick={collapseAll}
              >
                Collapse
              </button>

              <button
                type="button"
                className="knowledge-graph-soft-button-v6"
                onClick={() => {
                  setZoom(KNOWLEDGE_GRAPH_DEFAULT_ZOOM);
                  setPan({ x: 0, y: 0 });
                }}
              >
                <Maximize2 size={14} />
                Fit
              </button>
            </div>
          </div>

          <div className="knowledge-graph-filters-v6">
            <span>SHOW</span>
            {filterOptions.map(([value, label]) => {
              const count =
                value === "all"
                  ? visibleNodeList.length - 1
                  : visibleNodeList.filter(
                      (node) =>
                        node.type === filterTypeMap[value] ||
                        node.metadata?.group === value,
                    ).length;

              return (
                <button
                  type="button"
                  key={value}
                  className={filter === value ? "active" : ""}
                  onClick={() => setFilter(value)}
                >
                  <i />
                  {label}
                  {count > 0 && <b>{count}</b>}
                </button>
              );
            })}
          </div>

          {loading ? (
            <div className="knowledge-graph-state-v6">
              <div className="knowledge-graph-loading-orbit-v6" />
              <strong>Building knowledge graph…</strong>
              <span>
                Connecting the selected decision to its direct knowledge.
              </span>
            </div>
          ) : error ? (
            <div className="knowledge-graph-state-v6">
              <X size={20} />
              <strong>Knowledge Graph unavailable</strong>
              <span>{error}</span>
              <button
                type="button"
                onClick={() => loadGraph(selectedDecisionId)}
              >
                Try again
              </button>
            </div>
          ) : (
            <div className="knowledge-graph-layout-v6">
              <div
                className={`knowledge-graph-canvas-v6 ${
                  isPanning ? "is-panning" : ""
                }`}
                onPointerDown={handleCanvasPointerDown}
                onPointerMove={handleCanvasPointerMove}
                onPointerUp={stopPanning}
                onPointerCancel={stopPanning}
                onSelectStart={(event) => event.preventDefault()}
                onDragStart={(event) => event.preventDefault()}
              >
                <div
                  className="knowledge-graph-stage-v6"
                  style={{
                    width: `${KNOWLEDGE_GRAPH_WIDTH}px`,
                    height: `${KNOWLEDGE_GRAPH_HEIGHT}px`,
                    transform: `translate(-50%, -50%) translate3d(${pan.x}px, ${pan.y}px, 0) scale(${zoom})`,
                  }}
                >
                  <svg
                    className="knowledge-graph-edges-v6"
                    viewBox={`0 0 ${KNOWLEDGE_GRAPH_WIDTH} ${KNOWLEDGE_GRAPH_HEIGHT}`}
                    preserveAspectRatio="none"
                    aria-hidden="true"
                  >
                    {finalEdges.map((edge) => {
                      const source = nodePositions[edge.source];
                      const target = nodePositions[edge.target];

                      if (!source || !target) {
                        return null;
                      }

                      const connected =
                        connectedNodeIds.has(edge.source) &&
                        connectedNodeIds.has(edge.target);

                      const dx = target.x - source.x;
                      const dy = target.y - source.y;
                      const length = Math.max(1, Math.hypot(dx, dy));
                      const normalX = -dy / length;
                      const normalY = dx / length;
                      const bend = Math.min(100, Math.max(30, length * 0.09));
                      const midX = (source.x + target.x) / 2;
                      const midY = (source.y + target.y) / 2;
                      const controlX = midX + normalX * bend;
                      const controlY = midY + normalY * bend;

                      return (
                        <path
                          key={edge.id}
                          d={`M ${source.x} ${source.y} Q ${controlX} ${controlY} ${target.x} ${target.y}`}
                          className={`knowledge-graph-edge-v6 ${
                            connected ? "active" : ""
                          }`}
                        />
                      );
                    })}
                  </svg>

                  {visibleNodeList.map((node) => {
                    const position = nodePositions[node.id];

                    if (!position) {
                      return null;
                    }

                    const visible = filteredNodeIds.has(node.id);
                    const connected = connectedNodeIds.has(node.id);
                    const muted =
                      selectedNode && !connected && selectedNode.id !== node.id;
                    const isGroup = Boolean(node.metadata?.group);
                    const group = node.metadata?.group;

                    return (
                      <button
                        type="button"
                        key={node.id}
                        className={`knowledge-graph-node-v6 node-${node.type} ${
                          isGroup ? "group-node" : ""
                        } ${selectedNode?.id === node.id ? "selected" : ""} ${
                          muted ? "muted" : ""
                        }`}
                        style={{
                          left: `${position.x}px`,
                          top: `${position.y}px`,
                          display: visible ? "flex" : "none",
                        }}
                        onClick={() => handleNodeClick(node)}
                      >
                        <span className="knowledge-graph-node-icon-v6">
                          {node.type === "document" || group === "documents" ? (
                            <FileText size={15} />
                          ) : node.type === "team" ? (
                            <Users size={15} />
                          ) : node.type === "person" ? (
                            <Users size={15} />
                          ) : node.type === "alternative" ||
                            group === "alternatives" ? (
                            <GitBranch size={15} />
                          ) : node.type === "discussion" ||
                            group === "discussions" ? (
                            <MessageCircle size={15} />
                          ) : (
                            <GitBranch size={16} />
                          )}
                        </span>

                        <span className="knowledge-graph-node-copy-v6">
                          <strong title={node.label}>{node.label}</strong>
                          <small>{node.subtitle}</small>
                        </span>

                        {isGroup && (
                          <span className="knowledge-graph-node-expand-v6">
                            {expanded[group] ? "−" : "+"}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>

                <div className="knowledge-graph-zoom-v6">
                  <button
                    type="button"
                    onClick={() =>
                      setZoom((value) =>
                        Math.min(1.35, Number((value + 0.1).toFixed(2))),
                      )
                    }
                    aria-label="Zoom in"
                  >
                    <Plus size={14} />
                  </button>
                  <span>{Math.round(zoom * 100)}%</span>
                  <button
                    type="button"
                    onClick={() =>
                      setZoom((value) =>
                        Math.max(0.65, Number((value - 0.1).toFixed(2))),
                      )
                    }
                    aria-label="Zoom out"
                  >
                    <Minus size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setZoom(KNOWLEDGE_GRAPH_DEFAULT_ZOOM);
                      setPan({ x: 0, y: 0 });
                    }}
                    aria-label="Reset view"
                  >
                    <Maximize2 size={14} />
                  </button>
                </div>

                <div className="knowledge-graph-canvas-hint-v6">
                  Drag to pan · Click a branch to expand · Click an item to
                  inspect
                </div>

                <div className="knowledge-graph-live-v6">
                  <span className="knowledge-graph-live-dot-v6" />
                  {visibleNodeList.length} nodes · {finalEdges.length}{" "}
                  connections
                </div>
              </div>

              <aside className="knowledge-graph-inspector-v6">
                {selectedNode ? (
                  <div className="knowledge-graph-inspector-content-v6">
                    <div className="knowledge-graph-inspector-top-v6">
                      <div>
                        <span className="knowledge-graph-inspector-type-v6">
                          {selectedNode.metadata?.group
                            ? selectedNode.metadata.group.toUpperCase()
                            : selectedNode.type === "person"
                              ? "CREATED BY"
                              : selectedNode.type.toUpperCase()}
                        </span>
                        <h2>{selectedNode.label}</h2>
                        <p>{selectedNode.subtitle || "Connected knowledge"}</p>
                      </div>

                      <button
                        type="button"
                        className="knowledge-graph-inspector-close-v6"
                        onClick={() => setSelectedNode(null)}
                        aria-label="Close inspector"
                      >
                        <X size={16} />
                      </button>
                    </div>

                    {selectedDescription && (
                      <div className="knowledge-graph-description-v6">
                        {selectedDescription}
                      </div>
                    )}

                    {selectedNode.metadata?.group && (
                      <>
                        <div className="knowledge-graph-inspector-count-v6">
                          <strong>{groupCount}</strong>
                          <span>connected {selectedNode.metadata.group}</span>
                        </div>

                        <button
                          type="button"
                          className="knowledge-graph-inspector-secondary-v6"
                          onClick={() =>
                            toggleGroup(selectedNode.metadata.group)
                          }
                        >
                          {expanded[selectedNode.metadata.group]
                            ? "Collapse branch"
                            : "Expand branch"}
                        </button>
                      </>
                    )}

                    {selectedNode.type === "decision" && (
                      <div className="knowledge-graph-data-grid-v6">
                        <div>
                          <span>Status</span>
                          <strong>
                            {statusLabel(selectedNode.metadata?.status)}
                          </strong>
                        </div>
                        <div>
                          <span>Team</span>
                          <strong>
                            {selectedNode.metadata?.teamName || "Unassigned"}
                          </strong>
                        </div>
                        <div>
                          <span>Documents</span>
                          <strong>
                            {selectedNode.metadata?.documents || 0}
                          </strong>
                        </div>
                        <div>
                          <span>Alternatives</span>
                          <strong>
                            {selectedNode.metadata?.alternatives || 0}
                          </strong>
                        </div>
                        <div>
                          <span>Discussions</span>
                          <strong>
                            {selectedNode.metadata?.discussions || 0}
                          </strong>
                        </div>
                        <div>
                          <span>Created by</span>
                          <strong>
                            {selectedNode.metadata?.createdBy || "Unknown"}
                          </strong>
                        </div>
                      </div>
                    )}

                    {selectedNode.type === "person" && (
                      <div className="knowledge-graph-data-grid-v6">
                        <div>
                          <span>Name</span>
                          <strong>
                            {selectedNode.metadata?.name || selectedNode.label}
                          </strong>
                        </div>
                        <div>
                          <span>Role</span>
                          <strong>
                            {selectedNode.metadata?.role ||
                              selectedNode.subtitle}
                          </strong>
                        </div>
                        {selectedNode.metadata?.email && (
                          <div className="wide">
                            <span>Email</span>
                            <strong>{selectedNode.metadata.email}</strong>
                          </div>
                        )}
                      </div>
                    )}

                    {selectedNode.type === "team" && (
                      <div className="knowledge-graph-data-grid-v6">
                        <div>
                          <span>Members</span>
                          <strong>
                            {selectedNode.metadata?.memberCount || 0}
                          </strong>
                        </div>
                        <div>
                          <span>Decisions</span>
                          <strong>
                            {selectedNode.metadata?.decisionCount || 0}
                          </strong>
                        </div>
                        {selectedNode.metadata?.description && (
                          <div className="wide">
                            <span>Description</span>
                            <strong className="wrap">
                              {selectedNode.metadata.description}
                            </strong>
                          </div>
                        )}
                      </div>
                    )}

                    {selectedNode.type === "document" && (
                      <div className="knowledge-graph-data-grid-v6">
                        <div>
                          <span>File type</span>
                          <strong>
                            {selectedNode.metadata?.fileType || "FILE"}
                          </strong>
                        </div>
                        <div>
                          <span>Category</span>
                          <strong>
                            {selectedNode.metadata?.category || "General"}
                          </strong>
                        </div>
                        <div>
                          <span>Uploaded by</span>
                          <strong>
                            {selectedNode.metadata?.uploadedBy ||
                              "Workspace member"}
                          </strong>
                        </div>
                        <div>
                          <span>Uploaded</span>
                          <strong>
                            {formatDate(selectedNode.metadata?.createdAt)}
                          </strong>
                        </div>
                        {selectedNode.metadata?.tags && (
                          <div className="wide">
                            <span>Tags</span>
                            <strong className="wrap">
                              {selectedNode.metadata.tags}
                            </strong>
                          </div>
                        )}
                      </div>
                    )}

                    {selectedNode.type === "alternative" && (
                      <div className="knowledge-graph-rich-details-v6">
                        <div className="knowledge-graph-detail-strip-v6">
                          <div>
                            <span>Risk</span>
                            <strong>
                              {selectedNode.metadata?.risk || "—"}
                            </strong>
                          </div>
                          <div>
                            <span>Feasibility</span>
                            <strong>
                              {selectedNode.metadata?.feasibility || "—"}
                            </strong>
                          </div>
                          <div>
                            <span>Cost</span>
                            <strong>
                              {selectedNode.metadata?.cost || "—"}
                            </strong>
                          </div>
                        </div>

                        <div className="knowledge-graph-text-card-v6">
                          <span>Pros</span>
                          <p>{selectedNode.metadata?.pros || "—"}</p>
                        </div>

                        <div className="knowledge-graph-text-card-v6">
                          <span>Cons</span>
                          <p>{selectedNode.metadata?.cons || "—"}</p>
                        </div>
                      </div>
                    )}

                    {selectedNode.type === "discussion" && (
                      <div className="knowledge-graph-rich-details-v6">
                        <div className="knowledge-graph-detail-strip-v6">
                          <div>
                            <span>Type</span>
                            <strong>
                              {selectedNode.metadata?.type || "Comment"}
                            </strong>
                          </div>
                          <div>
                            <span>Created by</span>
                            <strong>
                              {selectedNode.metadata?.createdBy ||
                                "Workspace member"}
                            </strong>
                          </div>
                        </div>

                        <div className="knowledge-graph-text-card-v6 discussion-copy-v6">
                          <span>Discussion</span>
                          <p>
                            {selectedNode.metadata?.content ||
                              "No discussion content."}
                          </p>
                        </div>
                      </div>
                    )}

                    <button
                      type="button"
                      className="knowledge-graph-open-action-v6"
                      onClick={() => handleOpenNode(selectedNode)}
                    >
                      {groupActionLabel || openActionLabel || "Open"}
                      <ArrowUpRight size={14} />
                    </button>
                  </div>
                ) : (
                  <div className="knowledge-graph-inspector-empty-v6">
                    <Network size={22} />
                    <strong>Select a node</strong>
                    <span>
                      Click the decision, a branch, or any connected item to
                      inspect it here.
                    </span>
                  </div>
                )}
              </aside>
            </div>
          )}
        </div>
      )}
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
