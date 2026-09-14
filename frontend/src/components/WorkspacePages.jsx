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

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:4000";

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

const statusLabel = (status) => ({
  Draft: "Draft",
  UnderReview: "Under Review",
  Approved: "Approved",
  Rejected: "Rejected",
  Archived: "Archived",
}[status] || status);

const statusClass = (status) => String(statusLabel(status)).toLowerCase().replaceAll(" ", "-");

const EmptyState = ({ icon: Icon, title, body }) => (
  <div className="module-empty-state">
    <div className="module-empty-icon"><Icon size={18} /></div>
    <strong>{title}</strong>
    <span>{body}</span>
  </div>
);

function ReviewsPage({ apiRequest, decisions, openDecision, currentUser }) {
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
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const act = async (approvalId, status) => {
    try {
      setActingId(approvalId);
      await apiRequest(`/api/approvals/${approvalId}`, {
        method: "PATCH",
        body: JSON.stringify({ status, comments: comments[approvalId]?.trim() || null }),
      });
      await load();
    } catch (error) {
      alert(error.message || "Unable to update approval.");
    } finally {
      setActingId(null);
      setCommentId(null);
    }
  };

  return (
    <section className="workspace-page full-module-page">
      <div className="workspace-page-header">
        <div><span className="section-label">APPROVAL WORKFLOW</span><h1>Reviews</h1><p>Review decisions assigned to you and keep approvals moving.</p></div>
        <button className="compact-action" type="button" onClick={load}>Refresh</button>
      </div>
      <div className="module-stat-grid">
        <div className="module-stat-card"><span>Pending reviews</span><strong>{items.length}</strong><small>Assigned to you</small></div>
        <div className="module-stat-card"><span>Role</span><strong>{currentUser?.role || "Reviewer"}</strong><small>Current access level</small></div>
      </div>
      <div className="review-module-list">
        {loading ? <EmptyState icon={Clock3} title="Loading reviews" body="Fetching approval requests." /> : items.length === 0 ? <EmptyState icon={CheckCircle2} title="You’re all caught up" body="There are no pending decisions waiting for you." /> : items.map((approval) => {
          const decision = decisions.find((item) => item.id === approval.decisionId) || approval.decision;
          return (
            <article className="review-module-card" key={approval.id}>
              <div className="review-module-main"><div className="review-module-icon"><ShieldCheck size={19} /></div><div className="review-module-copy"><div className="panel-kicker">LEVEL {approval.level}</div><h3>{decision?.title || "Decision"}</h3><p>Requested by {approval.requestedBy?.name || "Workspace member"}{decision?.team?.name ? ` · ${decision.team.name}` : ""}</p><small>{formatDate(approval.createdAt)}</small></div></div>
              <div className="review-module-actions">
                <button className="review-open-link" type="button" onClick={() => decision && openDecision(decision)}>Open decision <ArrowUpRight size={14} /></button>
                {commentId === approval.id && <textarea value={comments[approval.id] || ""} onChange={(event) => setComments((current) => ({ ...current, [approval.id]: event.target.value }))} placeholder="Add an optional review comment..." rows="3" />}
                <div className="review-action-row"><button className="review-comment-button" type="button" onClick={() => setCommentId(commentId === approval.id ? null : approval.id)}>Comment</button><button className="review-reject-button" type="button" disabled={actingId === approval.id} onClick={() => act(approval.id, "Rejected")}>Reject</button><button className="review-approve-button" type="button" disabled={actingId === approval.id} onClick={() => act(approval.id, "Approved")}>{actingId === approval.id ? "Processing..." : "Approve"}<CheckCircle2 size={14} /></button></div>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function TeamsPage({ apiRequest, currentUser }) {
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

  useEffect(() => { loadTeams(); loadUsers(); }, []);

  const createTeam = async (event) => {
    event.preventDefault();
    if (!teamForm.name.trim()) return;
    try {
      await apiRequest("/api/teams", { method: "POST", body: JSON.stringify(teamForm) });
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
      await apiRequest(`/api/teams/${selected.id}/members`, { method: "POST", body: JSON.stringify({ userId: Number(memberUserId), teamRole: memberRole }) });
      setMemberUserId("");
      setMemberRole("Member");
      await openTeam(selected.id);
      await loadTeams();
    } catch (error) {
      alert(error.message || "Unable to add member.");
    }
  };

  const myMembership = selected?.members?.find((member) => member.userId === currentUser?.id);
  const canManageMembers = ["Manager", "Administrator"].includes(currentUser?.role) || ["Owner", "Lead"].includes(myMembership?.teamRole);

  return (
    <section className="workspace-page full-module-page">
      <div className="workspace-page-header">
        <div><span className="section-label">COLLABORATION</span><h1>Teams</h1><p>See every team you belong to and understand how decisions contribute across the workspace.</p></div>
        <button className="new-decision-button" type="button" onClick={() => setShowCreate((value) => !value)}><span>+</span>New team</button>
      </div>
      {showCreate && <form className="module-form-card" onSubmit={createTeam}><div className="panel-kicker">CREATE TEAM</div><div className="module-form-grid two-columns"><input value={teamForm.name} onChange={(event) => setTeamForm({ ...teamForm, name: event.target.value })} placeholder="Team name" /><input value={teamForm.description} onChange={(event) => setTeamForm({ ...teamForm, description: event.target.value })} placeholder="What does this team work on?" /></div><div className="module-form-actions"><button className="modal-secondary" type="button" onClick={() => setShowCreate(false)}>Cancel</button><button className="modal-primary" type="submit">Create team <ArrowUpRight size={14} /></button></div></form>}
      {loading ? <EmptyState icon={Users} title="Loading teams" body="Fetching your team workspaces." /> : teams.length === 0 ? <EmptyState icon={Users} title="No teams yet" body="Create a team to start connecting decisions and contributions." /> : <div className="team-card-grid">{teams.map((team) => <button className="team-overview-card" key={team.id} type="button" onClick={() => openTeam(team.id)}><div className="team-overview-top"><div className="team-avatar-stack">{team.members?.slice(0, 4).map((member) => <span key={member.id}>{member.user.name.charAt(0).toUpperCase()}</span>)}</div><ChevronRight size={17} /></div><div className="team-overview-copy"><strong>{team.name}</strong><span>{team.description || "Decision workspace"}</span></div><div className="team-overview-metrics"><div><span>Your role</span><strong>{team.userMembership?.teamRole || "Member"}</strong></div><div><span>Decisions</span><strong>{team._count?.decisions || 0}</strong></div><div><span>Your activity</span><strong>{team.contributionCount || 0}</strong></div></div></button>)}</div>}
      {selected && <div className="workspace-overlay" role="presentation" onClick={() => setSelected(null)}><div className="team-detail-modal" role="dialog" aria-modal="true" aria-label={`${selected.name} team details`} onClick={(event) => event.stopPropagation()}><div className="team-detail-header"><div><span className="section-label">TEAM WORKSPACE</span><h2>{selected.name}</h2><p>{selected.description || "Decision collaboration workspace"}</p></div><button className="icon-button" type="button" onClick={() => setSelected(null)} aria-label="Close"><X size={18} /></button></div>{detailLoading ? <EmptyState icon={Clock3} title="Loading team" body="Fetching members, activity and decisions." /> : <><div className="module-stat-grid team-stats"><div className="module-stat-card"><span>Decisions</span><strong>{selected._count?.decisions || 0}</strong><small>Linked to this team</small></div><div className="module-stat-card"><span>Your contribution</span><strong>{selected.contributionSummary?.myContributions || 0}</strong><small>Recorded activities</small></div><div className="module-stat-card"><span>Your decisions</span><strong>{selected.contributionSummary?.myDecisions || 0}</strong><small>Created by you</small></div></div><div className="team-detail-grid"><div className="team-panel-card"><div className="lower-card-header"><div><span className="section-label">MEMBERS</span><h3>Team contribution</h3></div></div>{selected.memberContributions?.map((member) => <div className="member-contribution-row" key={member.user.id}><div className="member-mini-avatar">{member.user.name.charAt(0).toUpperCase()}</div><div><strong>{member.user.name}</strong><span>{member.teamRole} · {member.user.role}</span></div><div className="member-contribution-numbers"><strong>{member.decisionsContributed}</strong><span>decisions</span></div><div className="member-contribution-numbers"><strong>{member.contributions}</strong><span>activities</span></div></div>)}</div><div className="team-panel-card"><div className="lower-card-header"><div><span className="section-label">RECENT ACTIVITY</span><h3>What changed</h3></div></div>{selected.recentActivity?.length ? selected.recentActivity.slice(0, 6).map((item) => <div className="team-activity-row" key={item.id}><div className="activity-status approved" /><div><strong>{item.action.replaceAll("_", " ")}</strong><span>{item.user?.name || "Workspace member"} · {formatRelative(item.createdAt)}</span></div></div>) : <EmptyState icon={Users} title="No activity yet" body="Team activity appears as members work." />}</div></div><div className="team-panel-card"><div className="lower-card-header"><div><span className="section-label">DECISIONS</span><h3>Team decisions</h3></div></div><div className="workspace-decisions-list compact-team-decision-list">{selected.decisions?.length ? selected.decisions.map((decision) => <div className="workspace-decision-card" key={decision.id}><div className="decision-left"><div className="decision-info"><strong>{decision.title}</strong><span>{decision.createdBy?.name || "Workspace member"}</span></div></div><span className={`status status-${statusClass(decision.status)}`}><span />{statusLabel(decision.status)}</span><span className="decision-date">{formatDate(decision.updatedAt)}</span></div>) : <EmptyState icon={FileText} title="No team decisions" body="Link a decision to this team to build the workspace history." />}</div></div>{canManageMembers && <form className="module-form-card team-member-form" onSubmit={addMember}><div><div className="panel-kicker">TEAM ADMINISTRATION</div><h3>Add a member</h3></div><div className="module-form-grid two-columns"><select value={memberUserId} onChange={(event) => setMemberUserId(event.target.value)}><option value="">Select user</option>{users.filter((user) => !selected.members?.some((member) => member.userId === user.id)).map((user) => <option key={user.id} value={user.id}>{user.name} · {user.role}</option>)}</select><select value={memberRole} onChange={(event) => setMemberRole(event.target.value)}><option>Member</option><option>Lead</option><option>Manager</option></select></div><button className="modal-primary" type="submit">Add member <ArrowUpRight size={14} /></button></form>}</>}</div></div>}
    </section>
  );
}

function KnowledgePage({ apiRequest }) {
  const [tab, setTab] = useState("all");
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [teamId, setTeamId] = useState("");
  const [teams, setTeams] = useState([]);
  const [decisionOptions, setDecisionOptions] = useState([]);
  const [data, setData] = useState({ documents: [], decisions: [], people: [], insights: [], filters: { categories: [], tags: [] }, recentActivity: [], topics: [], stats: {} });
  const [page, setPage] = useState(1);
  const [view, setView] = useState("list");
  const [loading, setLoading] = useState(true);
  const [showUpload, setShowUpload] = useState(false);
  const [uploadFile, setUploadFile] = useState(null);
  const [uploadDecisionId, setUploadDecisionId] = useState("");
  const [uploadCategory, setUploadCategory] = useState("General");
  const [uploadTags, setUploadTags] = useState("");
  const [uploading, setUploading] = useState(false);

  const load = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({ tab, page: String(page), pageSize: "8" });
      if (search.trim()) params.set("search", search.trim());
      if (category) params.set("category", category);
      if (teamId) params.set("teamId", teamId);
      const [knowledge, teamData, decisionData] = await Promise.all([
        apiRequest(`/api/knowledge?${params.toString()}`),
        apiRequest("/api/teams"),
        apiRequest("/api/decisions"),
      ]);
      setData(knowledge || {});
      setTeams(teamData?.teams || []);
      setDecisionOptions(decisionData?.decisions || []);
    } catch (error) {
      console.error("Knowledge load error:", error);
      setData({ documents: [], decisions: [], people: [], insights: [], filters: { categories: [], tags: [] }, recentActivity: [], topics: [], stats: {} });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [tab, page, category, teamId]);

  const visibleTags = useMemo(() => data.filters?.tags?.slice(0, 10) || [], [data.filters]);

  const uploadDocument = async (event) => {
    event.preventDefault();
    if (!uploadFile || !uploadDecisionId) return;
    try {
      setUploading(true);
      const formData = new FormData();
      formData.append("file", uploadFile);
      formData.append("category", uploadCategory);
      formData.append("tags", uploadTags);
      await apiRequest(`/api/decisions/${uploadDecisionId}/documents`, { method: "POST", body: formData });
      setUploadFile(null);
      setUploadDecisionId("");
      setUploadCategory("General");
      setUploadTags("");
      setShowUpload(false);
      await load();
    } catch (error) {
      alert(error.message || "Unable to upload document.");
    } finally {
      setUploading(false);
    }
  };

  const chooseTab = (next) => { setTab(next); setPage(1); };

  return (
    <section className="workspace-page knowledge-page full-module-page">
      <div className="workspace-page-header knowledge-header"><div><span className="section-label">KNOWLEDGE</span><h1>Knowledge Repository</h1><p>Discover documents, past decisions, topics, people, insights and the context around them.</p></div><button className="new-decision-button" type="button" onClick={() => setShowUpload((value) => !value)}><span>+</span>{showUpload ? "Close uploader" : "Upload evidence"}</button></div>
      {showUpload && <form className="module-form-card knowledge-upload-card" onSubmit={uploadDocument}><div><div className="panel-kicker">ADD KNOWLEDGE</div><h3>Upload supporting evidence</h3><p>Attach a document to a decision and keep it searchable.</p></div><div className="module-form-grid two-columns"><label className="file-picker knowledge-file-picker" htmlFor="knowledge-upload-file"><input id="knowledge-upload-file" type="file" onChange={(event) => setUploadFile(event.target.files?.[0] || null)} /><span className="file-picker-icon"><FileText size={17} /></span><span className="file-picker-copy"><strong>{uploadFile ? uploadFile.name : "Choose a file"}</strong><small>PDF, DOCX, PPTX, XLSX or other evidence</small></span></label><select value={uploadDecisionId} onChange={(event) => setUploadDecisionId(event.target.value)}><option value="">Choose a decision</option>{decisionOptions.map((decision) => <option key={decision.id} value={decision.id}>{decision.title}</option>)}</select><select value={uploadCategory} onChange={(event) => setUploadCategory(event.target.value)}><option>General</option><option>Research</option><option>Evaluation</option><option>Requirements</option><option>Architecture</option><option>Security</option><option>Compliance</option><option>Planning</option><option>Deployment</option></select><input value={uploadTags} onChange={(event) => setUploadTags(event.target.value)} placeholder="Tags: AI, research, architecture" /></div><div className="module-form-actions"><button className="modal-secondary" type="button" onClick={() => setShowUpload(false)}>Cancel</button><button className="modal-primary" type="submit" disabled={uploading || !uploadFile || !uploadDecisionId}>{uploading ? "Uploading..." : "Upload document"}<ArrowUpRight size={14} /></button></div></form>}
      <div className="knowledge-tabs">{[["all","All"],["documents","Documents"],["decisions","Past Decisions"],["topics","Topics"],["people","People"],["insights","Insights"]].map(([key,label]) => <button key={key} className={tab === key ? "active" : ""} type="button" onClick={() => chooseTab(key)}>{label}</button>)}</div>
      <div className="knowledge-stats"><div><div className="knowledge-stat-icon"><FileText size={18} /></div><div><strong>{data.stats?.documents || 0}</strong><span>Total documents</span></div></div><div><div className="knowledge-stat-icon"><CheckCircle2 size={18} /></div><div><strong>{data.stats?.decisions || 0}</strong><span>Decisions indexed</span></div></div><div><div className="knowledge-stat-icon"><Users size={18} /></div><div><strong>{data.stats?.teams || 0}</strong><span>Teams contributed</span></div></div><div><div className="knowledge-stat-icon"><Clock3 size={18} /></div><div><strong>{data.stats?.recent || 0}</strong><span>Recent changes</span></div></div></div>
      <div className="knowledge-main-grid"><div className="knowledge-primary-panel"><div className="knowledge-toolbar"><div className="dashboard-search inline-search"><Search size={16} /><input value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} placeholder="Search documents, decisions, people..." /></div><select value={teamId} onChange={(event) => { setTeamId(event.target.value); setPage(1); }}><option value="">All Teams</option>{teams.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}</select><select value={category} onChange={(event) => { setCategory(event.target.value); setPage(1); }}><option value="">All Types</option>{data.filters?.categories?.map((item) => <option key={item} value={item}>{item}</option>)}</select><div className="knowledge-view-toggle"><button type="button" className={view === "list" ? "active" : ""} onClick={() => setView("list")}><FileText size={14} /></button><button type="button" className={view === "grid" ? "active" : ""} onClick={() => setView("grid")}><FolderOpen size={14} /></button></div></div>
        <div className={`knowledge-content ${view}`}>
          {loading ? <EmptyState icon={Clock3} title="Loading repository" body="Fetching connected workspace knowledge." /> : tab === "documents" ? (data.documents?.length ? data.documents.map((document) => <DocumentKnowledgeRow key={document.id} document={document} />) : <EmptyState icon={FileText} title="No documents found" body="Upload supporting evidence to build the archive." />) : tab === "all" ? <>{data.decisions?.length > 0 && <div className="knowledge-subsection-title">Recent decisions</div>}{data.decisions?.slice(0, 5).map((decision) => <DecisionKnowledgeRow key={`d-${decision.id}`} decision={decision} />)}{data.documents?.length > 0 && <div className="knowledge-subsection-title">Supporting documents</div>}{data.documents?.map((document) => <DocumentKnowledgeRow key={`doc-${document.id}`} document={document} />)}{!data.decisions?.length && !data.documents?.length && <EmptyState icon={FileText} title="No knowledge found" body="Create a decision or upload evidence to start building organizational memory." />}</> : tab === "decisions" ? (data.decisions?.length ? data.decisions.map((decision) => <DecisionKnowledgeRow key={decision.id} decision={decision} />) : <EmptyState icon={CheckCircle2} title="No decisions found" body="Historical and active decision records will appear here." />) : tab === "people" ? (data.people?.length ? data.people.map((person) => <div className="knowledge-person-row" key={person.id}><div className="member-mini-avatar">{person.name.charAt(0).toUpperCase()}</div><div><strong>{person.name}</strong><span>{person.role} · {person.email}</span></div><div><strong>{person._count?.decisions || 0}</strong><span>decisions</span></div><div><strong>{person._count?.discussions || 0}</strong><span>discussions</span></div></div>) : <EmptyState icon={Users} title="No people found" body="People appear as they contribute to the workspace." />) : tab === "topics" ? (visibleTags.length ? <div className="knowledge-topic-grid">{visibleTags.map((tag) => <button type="button" key={tag} onClick={() => { setSearch(tag); setTab("all"); setPage(1); }}><strong>{tag}</strong><small>Explore related decisions and evidence</small></button>)}</div> : <EmptyState icon={MessageCircle} title="No topics yet" body="Topics will emerge from document tags and recurring themes." />) : data.insights?.length ? data.insights.map((insight) => <article className="knowledge-insight-card" key={insight.id}><div className="knowledge-insight-icon"><BarChart3 size={17} /></div><div><span className="panel-kicker">{insight.status}</span><h3>{insight.title}</h3><p>{insight.detail}</p></div></article>) : <EmptyState icon={BarChart3} title="No insights yet" body="Insights will appear as decisions accumulate evidence and discussion." />}
        </div><div className="knowledge-pagination"><span>Page {page}</span><div><button type="button" disabled={page === 1} onClick={() => setPage((value) => value - 1)}>‹</button><button type="button">{page}</button><button type="button" disabled={!data.pagination || page * (data.pagination.pageSize || 8) >= (data.pagination.total || 0)} onClick={() => setPage((value) => value + 1)}>›</button></div></div></div>
        <aside className="knowledge-side-panel"><div className="knowledge-side-card"><div className="lower-card-header"><div><span className="section-label">KNOWLEDGE GRAPH</span><h3>How it connects</h3></div></div><div className="knowledge-graph"><div className="graph-node central">Decision</div><div className="graph-node top-left">People</div><div className="graph-node top-right">Documents</div><div className="graph-node bottom-left">Topics</div><div className="graph-node bottom-right">Outcomes</div><div className="graph-line l1" /><div className="graph-line l2" /><div className="graph-line l3" /><div className="graph-line l4" /></div></div><div className="knowledge-side-card"><div className="lower-card-header"><div><span className="section-label">POPULAR TOPICS</span><h3>What teams discuss</h3></div></div><div className="tag-cloud">{visibleTags.length ? visibleTags.map((tag) => <button type="button" key={tag} onClick={() => { setSearch(tag); setTab("all"); setPage(1); }}>{tag}</button>) : <span>No tagged topics yet</span>}</div></div><div className="knowledge-side-card"><div className="lower-card-header"><div><span className="section-label">RECENT ACTIVITY</span><h3>What changed</h3></div></div>{data.recentActivity?.length ? data.recentActivity.slice(0, 6).map((item) => <div className="knowledge-activity-row" key={item.id}><div className="activity-status approved" /><div><strong>{item.action.replaceAll("_", " ")}</strong><span>{item.user?.name || "Workspace member"} · {formatRelative(item.createdAt)}</span></div></div>) : <EmptyState icon={Clock3} title="No activity yet" body="Workspace changes will be surfaced here." />}</div></aside></div>
    </section>
  );
}

function DocumentKnowledgeRow({ document }) {
  return <div className="knowledge-document-row"><div className="knowledge-file-icon">{String(document.filename).toLowerCase().endsWith(".pdf") ? "PDF" : "FILE"}</div><div className="knowledge-document-copy"><strong>{document.filename}</strong><span>Uploaded by {document.uploadedBy?.name || "Workspace member"} · {formatDate(document.createdAt)}</span><div className="tag-list">{document.tags?.split(",").map((tag) => tag.trim()).filter(Boolean).slice(0, 4).map((tag) => <span key={tag}>{tag}</span>)}</div></div><div className="knowledge-document-context"><strong>{document.decision?.title || "Supporting document"}</strong><span>{document.decision?.team?.name || "Shared workspace"}</span></div><a className="knowledge-view-button" href={`${API_BASE_URL}/${String(document.filePath || "").replaceAll("\\", "/")}`} target="_blank" rel="noreferrer">Open <ArrowUpRight size={13} /></a></div>;
}

function DecisionKnowledgeRow({ decision }) {
  return <div className="knowledge-decision-row"><div className="decision-icon"><CheckCircle2 size={17} /></div><div><strong>{decision.title}</strong><span>{decision.problemStatement}</span><small>{decision.team?.name || "Unassigned"} · {decision.createdBy?.name || "Workspace member"}</small></div><span className={`status status-${statusClass(decision.status)}`}><span />{statusLabel(decision.status)}</span></div>;
}

function DiscussionsPage({ apiRequest }) {
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
      setSelectedDecisionId((current) => current || (list[0] ? String(list[0].id) : ""));
    } catch {
      setDecisions([]);
    } finally {
      setLoadingDecisions(false);
    }
  };

  const loadDiscussion = async (id) => {
    if (!id) { setDiscussions([]); return; }
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

  useEffect(() => { loadDecisions(); }, []);
  useEffect(() => { loadDiscussion(selectedDecisionId); }, [selectedDecisionId]);

  const post = async (event) => {
    event.preventDefault();
    if (!selectedDecisionId || !text.trim()) return;
    try {
      setPosting(true);
      await apiRequest(`/api/decisions/${selectedDecisionId}/discussions`, { method: "POST", body: JSON.stringify({ type, content: text.trim(), parentId: null }) });
      setText("");
      await loadDiscussion(selectedDecisionId);
    } catch (error) {
      alert(error.message || "Unable to post discussion.");
    } finally {
      setPosting(false);
    }
  };

  const filtered = discussions.filter((item) => `${item.content} ${item.createdBy?.name || ""}`.toLowerCase().includes(search.toLowerCase()));
  const selectedDecision = decisions.find((decision) => String(decision.id) === String(selectedDecisionId));

  return <section className="workspace-page full-module-page"><div className="workspace-page-header discussion-page-header"><div><span className="section-label">COLLABORATION</span><h1>Discussions</h1><p>Capture comments, meeting notes and decision rationale in one connected conversation.</p></div><div className="discussion-decision-picker"><label htmlFor="discussion-decision">Decision</label><select id="discussion-decision" value={selectedDecisionId} onChange={(event) => setSelectedDecisionId(event.target.value)} disabled={loadingDecisions || decisions.length === 0}><option value="">{loadingDecisions ? "Loading decisions..." : "Choose a decision"}</option>{decisions.map((decision) => <option key={decision.id} value={decision.id}>{decision.title}</option>)}</select>{selectedDecision && <span>{selectedDecision.team?.name || "Unassigned"}</span>}</div></div><div className="module-toolbar"><div className="dashboard-search inline-search"><Search size={16} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search this discussion..." /></div><span>{filtered.length} entries</span></div>{selectedDecisionId ? <><form className="module-form-card" onSubmit={post}><div className="discussion-compose-head"><select value={type} onChange={(event) => setType(event.target.value)}><option value="Comment">Comment</option><option value="MeetingNote">Meeting note</option><option value="Rationale">Decision rationale</option></select></div><textarea rows="4" value={text} onChange={(event) => setText(event.target.value)} placeholder="Share a comment, capture a meeting note, or record why the team chose this path..." /><div className="module-form-actions"><button className="modal-primary" type="submit" disabled={posting || !text.trim()}>{posting ? "Posting..." : "Post to discussion"}<ArrowUpRight size={14} /></button></div></form><div className="discussion-module-list">{loading ? <EmptyState icon={Clock3} title="Loading discussion" body="Fetching the conversation." /> : filtered.length ? filtered.map((item) => <article className="discussion-module-card" key={item.id}><div className="discussion-card-header"><div className="discussion-author"><div className="discussion-avatar">{(item.createdBy?.name || "W").charAt(0).toUpperCase()}</div><div><strong>{item.createdBy?.name || "Workspace member"}</strong><span>{item.type === "MeetingNote" ? "Meeting note" : item.type === "Rationale" ? "Decision rationale" : "Comment"} · {formatDate(item.createdAt)}</span></div></div></div><p>{item.content}</p>{item.attachments?.length ? <div className="tag-list">{item.attachments.map((attachment) => <span key={attachment.id}>{attachment.filename}</span>)}</div> : null}</article>) : <EmptyState icon={MessageCircle} title="No discussions yet" body="Start the conversation for this decision." />}</div></> : <EmptyState icon={MessageCircle} title="Select a decision" body="Choose a decision above to view or post discussion entries." />}</section>;
}

function DocumentsPage({ apiRequest }) {
  const [documents, setDocuments] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const load = async () => {
    try {
      setLoading(true);
      const data = await apiRequest("/api/knowledge?tab=documents&page=1&pageSize=50");
      setDocuments(data?.documents || []);
    } catch {
      setDocuments([]);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, []);
  const filtered = documents.filter((item) => `${item.filename} ${item.decision?.title || ""} ${item.tags || ""}`.toLowerCase().includes(search.toLowerCase()));
  return <section className="workspace-page full-module-page"><div className="workspace-page-header"><div><span className="section-label">DOCUMENT ARCHIVE</span><h1>Documents</h1><p>Pure file storage: search, review and open supporting evidence without mixing it with broader knowledge discovery.</p></div><button className="compact-action" type="button" onClick={load}>Refresh</button></div><div className="module-toolbar"><div className="dashboard-search inline-search"><Search size={16} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search files, decisions or tags..." /></div><span>{filtered.length} files</span></div><div className="documents-summary-strip"><div><strong>{documents.length}</strong><span>Files archived</span></div><div><strong>{new Set(documents.map((item) => item.category)).size}</strong><span>Categories</span></div><div><strong>{new Set(documents.map((item) => item.decisionId)).size}</strong><span>Decisions linked</span></div></div><div className="global-document-list">{loading ? <EmptyState icon={Clock3} title="Loading documents" body="Fetching the file archive." /> : filtered.length ? filtered.map((document) => <div className="global-document-row" key={document.id}><div className="knowledge-file-icon">FILE</div><div><strong>{document.filename}</strong><span>{document.decision?.title || "Decision"} · {document.uploadedBy?.name || "Workspace member"} · {formatDate(document.createdAt)}</span></div><div className="tag-list"><span>{document.category || "General"}</span>{document.tags?.split(",").map((tag) => tag.trim()).filter(Boolean).slice(0, 2).map((tag) => <span key={tag}>{tag}</span>)}</div><a href={`${API_BASE_URL}/${String(document.filePath || "").replaceAll("\\", "/")}`} target="_blank" rel="noreferrer">Open <ArrowUpRight size={13} /></a></div>) : <EmptyState icon={FileText} title="No documents found" body="Upload supporting evidence from Knowledge or inside a decision." />}</div></section>;
}

function AnalyticsPage({ apiRequest }) {
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
  useEffect(() => { load(); }, []);
  const summary = data?.summary || {};
  const maxTeam = Math.max(1, ...(data?.teamBreakdown || []).map((team) => team._count?.decisions || 0));
  return <section className="workspace-page full-module-page"><div className="workspace-page-header"><div><span className="section-label">ANALYTICS</span><h1>Decision Analytics</h1><p>Real workspace metrics for decision health, approvals, evidence and collaboration.</p></div><button className="compact-action" type="button" onClick={load}>Refresh</button></div>{loading ? <EmptyState icon={BarChart3} title="Loading analytics" body="Calculating workspace metrics." /> : error ? <div className="module-error-state"><strong>Analytics could not load</strong><span>{error}</span><button className="modal-primary" type="button" onClick={load}>Retry</button></div> : <><div className="analytics-hero-grid"><div className="analytics-hero-card"><span>Total decisions</span><strong>{summary.totalDecisions || 0}</strong><small>{summary.drafts || 0} drafts · {summary.underReview || 0} under review</small></div><div className="analytics-hero-card"><span>Approval rate</span><strong>{summary.approvalRate || 0}%</strong><small>{summary.approved || 0} approved of {summary.totalDecisions || 0}</small></div><div className="analytics-hero-card"><span>Pending approvals</span><strong>{summary.pendingApprovals || 0}</strong><small>{summary.decidedApprovals || 0} decisions already reviewed</small></div><div className="analytics-hero-card"><span>Workspace footprint</span><strong>{summary.totalTeams || 0}</strong><small>{summary.totalUsers || 0} users · {summary.totalDocuments || 0} documents</small></div></div><div className="analytics-grid"><div className="analytics-panel"><div className="lower-card-header"><div><span className="section-label">DECISION PIPELINE</span><h2>Status distribution</h2></div></div>{[["Draft", summary.drafts], ["Under review", summary.underReview], ["Approved", summary.approved], ["Rejected", summary.rejected]].map(([label, value]) => <div className="metric-bar-row" key={label}><div><span>{label}</span><strong>{value || 0}</strong></div><div className="metric-bar"><span style={{ width: `${summary.totalDecisions ? Math.max(3, Math.round(((value || 0) / summary.totalDecisions) * 100)) : 0}%` }} /></div></div>)}</div><div className="analytics-panel"><div className="lower-card-header"><div><span className="section-label">TEAM SIGNALS</span><h2>Decision contribution</h2></div></div>{data.teamBreakdown?.length ? data.teamBreakdown.map((team) => <div className="analytics-team-row" key={team.id}><div><strong>{team.name}</strong><span>{team._count?.members || 0} members</span><div className="analytics-team-bar"><span style={{ width: `${Math.max(6, Math.round(((team._count?.decisions || 0) / maxTeam) * 100))}%` }} /></div></div><strong>{team._count?.decisions || 0}</strong></div>) : <EmptyState icon={Users} title="No team data" body="Team decision links will appear here." />}</div></div><div className="analytics-recent-panel"><div className="lower-card-header"><div><span className="section-label">RECENT DECISIONS</span><h2>Latest decision movement</h2></div></div>{data.recent?.length ? data.recent.map((decision) => <div className="analytics-recent-row" key={decision.id}><div><strong>{decision.title}</strong><span>{decision.team?.name || "Unassigned"} · {decision.createdBy?.name || "Workspace member"}</span></div><span className={`status status-${statusClass(decision.status)}`}><span />{statusLabel(decision.status)}</span><small>{formatDate(decision.updatedAt)}</small></div>) : <EmptyState icon={FileText} title="No decisions yet" body="Create decisions to populate the analytics view." />}</div></>}</section>;
}

function UsersPage({ apiRequest }) {
  const [users, setUsers] = useState([]);
  const [search, setSearch] = useState("");
  const load = () => apiRequest("/api/users").then((data) => setUsers(data?.users || [])).catch(() => setUsers([]));
  useEffect(() => { load(); }, []);
  const updateRole = async (userId, role) => { try { await apiRequest(`/api/users/${userId}/role`, { method: "PATCH", body: JSON.stringify({ role }) }); await load(); } catch (error) { alert(error.message || "Unable to update role."); } };
  const filtered = users.filter((item) => `${item.name} ${item.email} ${item.role}`.toLowerCase().includes(search.toLowerCase()));
  return <section className="workspace-page full-module-page"><div className="workspace-page-header"><div><span className="section-label">ADMINISTRATION</span><h1>Users</h1><p>Manage roles and review activity across the organization.</p></div><button className="compact-action" type="button" onClick={load}>Refresh</button></div><div className="module-toolbar"><div className="dashboard-search inline-search"><Search size={16} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search people..." /></div><span>{filtered.length} users</span></div><div className="users-table"><div className="users-table-head"><span>User</span><span>Role</span><span>Decisions</span><span>Discussions</span><span>Change role</span></div>{filtered.map((user) => <div className="users-table-row" key={user.id}><div className="user-row-main"><div className="member-mini-avatar">{user.name.charAt(0).toUpperCase()}</div><div><strong>{user.name}</strong><span>{user.email}</span></div></div><span>{user.role}</span><strong>{user._count?.decisions || 0}</strong><strong>{user._count?.discussions || 0}</strong><select value={user.role} onChange={(event) => updateRole(user.id, event.target.value)}><option>Employee</option><option>Reviewer</option><option>Manager</option><option>Administrator</option></select></div>)}</div></section>;
}

function AuditPage({ apiRequest }) {
  const [logs, setLogs] = useState([]);
  const [search, setSearch] = useState("");
  const load = () => apiRequest(`/api/audit-logs?search=${encodeURIComponent(search)}`).then((data) => setLogs(data?.logs || [])).catch(() => setLogs([]));
  useEffect(() => { load(); }, []);
  return <section className="workspace-page full-module-page"><div className="workspace-page-header"><div><span className="section-label">GOVERNANCE</span><h1>Audit & Compliance</h1><p>Trace important actions across decisions, approvals, documents, teams and users.</p></div><button className="compact-action" type="button" onClick={load}>Refresh</button></div><div className="module-toolbar"><div className="dashboard-search inline-search"><Search size={16} /><input value={search} onChange={(event) => setSearch(event.target.value)} onKeyDown={(event) => event.key === "Enter" && load()} placeholder="Search audit activity..." /></div><span>{logs.length} events</span></div><div className="audit-list">{logs.length ? logs.map((log) => <div className="audit-row" key={log.id}><div className="audit-icon"><ShieldCheck size={15} /></div><div><strong>{log.action.replaceAll("_", " ")}</strong><span>{log.user?.name || "System"} · {log.entityType}{log.entityId ? ` #${log.entityId}` : ""}</span></div><small>{formatDate(log.createdAt)}</small></div>) : <EmptyState icon={ShieldCheck} title="No audit events found" body="Your compliance trail will populate as users interact with the workspace." />}</div></section>;
}

function ReportsPage({ apiRequest }) {
  const reportTypes = [["decisions", "Decision Report", "Decision status, ownership, evidence and discussion footprint."], ["approvals", "Approval Report", "Reviewer assignments, approval outcomes and comments."], ["teams", "Team Report", "Team members and decision contribution footprint."], ["audit", "Audit Report", "Governance activity and change history."]];
  const download = async (type) => { try { const data = await apiRequest(`/api/reports/${type}`); const report = data.report; const csv = [report.columns, ...report.rows].map((row) => row.map((value) => `"${String(value ?? "").replaceAll('"', '""')}"`).join(",")).join("\n"); const blob = new Blob([csv], { type: "text/csv;charset=utf-8" }); const url = URL.createObjectURL(blob); const anchor = document.createElement("a"); anchor.href = url; anchor.download = report.filename; anchor.click(); URL.revokeObjectURL(url); } catch (error) { alert(error.message || "Unable to generate report."); } };
  const print = async (type) => { try { const data = await apiRequest(`/api/reports/${type}`); const report = data.report; const headers = report.columns.map((item) => `<th>${item}</th>`).join(""); const rows = report.rows.slice(0, 200).map((row) => `<tr>${row.map((value) => `<td>${String(value ?? "").replaceAll("<", "&lt;").replaceAll(">", "&gt;")}</td>`).join("")}</tr>`).join(""); const printWindow = window.open("", "_blank", "width=1200,height=800"); if (!printWindow) return; printWindow.document.write(`<html><head><title>${report.filename}</title><style>body{font-family:Arial,sans-serif;padding:30px;color:#101512}h1{font-size:24px}table{border-collapse:collapse;width:100%;font-size:11px}th,td{border:1px solid #ddd;padding:7px;text-align:left}th{background:#edf7f0}</style></head><body><h1>${report.filename.replace(".csv", "")}</h1><table><thead><tr>${headers}</tr></thead><tbody>${rows}</tbody></table></body></html>`); printWindow.document.close(); printWindow.focus(); printWindow.print(); } catch (error) { alert(error.message || "Unable to prepare report."); } };
  return <section className="workspace-page full-module-page"><div className="workspace-page-header"><div><span className="section-label">REPORTING</span><h1>Reports</h1><p>Generate structured exports for decisions, approvals, teams and governance.</p></div></div><div className="report-card-grid">{reportTypes.map(([key, title, description]) => <article className="report-card" key={key}><div className="report-card-icon"><FileText size={19} /></div><div><span className="panel-kicker">EXPORT</span><h3>{title}</h3><p>{description}</p></div><div className="report-card-actions"><button className="modal-primary" type="button" onClick={() => download(key)}>Excel / CSV <ArrowUpRight size={13} /></button><button className="modal-secondary" type="button" onClick={() => print(key)}>Print / PDF <ArrowUpRight size={13} /></button></div></article>)}</div></section>;
}

function SettingsPage({ currentUser, apiRequest, onUserUpdated }) {
  const [form, setForm] = useState({ name: currentUser?.name || "", email: currentUser?.email || "" });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  useEffect(() => { setForm({ name: currentUser?.name || "", email: currentUser?.email || "" }); }, [currentUser]);
  const save = async (event) => { event.preventDefault(); try { setSaving(true); setMessage(""); setError(""); const data = await apiRequest("/api/auth/profile", { method: "PATCH", body: JSON.stringify(form) }); setMessage("Profile saved successfully."); onUserUpdated?.(data.user); } catch (requestError) { setError(requestError.message || "Unable to save profile."); } finally { setSaving(false); } };
  return <section className="workspace-page full-module-page"><div className="workspace-page-header"><div><span className="section-label">ACCOUNT</span><h1>Settings</h1><p>Manage your profile, workspace identity and account preferences.</p></div></div><div className="settings-grid"><form className="settings-card settings-edit-card" onSubmit={save}><span className="section-label">PROFILE</span><h3>Personal details</h3><div className="settings-field"><label htmlFor="settings-name">Full name</label><input id="settings-name" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required /></div><div className="settings-field"><label htmlFor="settings-email">Email</label><input id="settings-email" type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} required /></div><div className="settings-readonly-row"><span>Role</span><strong>{currentUser?.role || "Employee"}</strong></div><button className="modal-primary settings-save-button" type="submit" disabled={saving}>{saving ? "Saving..." : "Save profile"}<ArrowUpRight size={14} /></button>{message && <div className="settings-success">{message}</div>}{error && <div className="settings-error">{error}</div>}</form><div className="settings-card"><span className="section-label">WORKSPACE</span><h3>Decision intelligence</h3><p>Decisions, evidence, discussions and approvals remain connected instead of being split across separate tools.</p><div className="settings-preference-row"><span>Knowledge discovery</span><strong>Enabled</strong></div><div className="settings-preference-row"><span>Activity history</span><strong>Enabled</strong></div><div className="settings-preference-row"><span>Approval tracking</span><strong>{["Reviewer", "Manager", "Administrator"].includes(currentUser?.role) ? "Enabled" : "Available to reviewers"}</strong></div></div></div></section>;
}

export { ReviewsPage, TeamsPage, KnowledgePage, DiscussionsPage, DocumentsPage, AnalyticsPage, UsersPage, AuditPage, ReportsPage, SettingsPage };
