import { useEffect, useState } from "react";
import { ArrowUpRight, CheckCircle2, Clock3, ShieldCheck, X } from "lucide-react";

const formatDate = (date) => {
  if (!date) return "—";
  const value = new Date(date);
  if (Number.isNaN(value.getTime())) return "—";
  return new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric" }).format(value);
};

const statusClass = (status) => String(status || "Pending").toLowerCase();

function ApprovalPanel({ apiRequest, selectedDecision, currentUser, users, onDecisionRefresh }) {
  const [approvals, setApprovals] = useState(selectedDecision?.approvals || []);
  const [loading, setLoading] = useState(false);
  const [reviewerId, setReviewerId] = useState("");
  const [level, setLevel] = useState(1);
  const [requesting, setRequesting] = useState(false);
  const [acting, setActing] = useState(null);
  const [comment, setComment] = useState("");

  const load = async () => {
    if (!selectedDecision?.id) return;
    try {
      setLoading(true);
      const data = await apiRequest(`/api/decisions/${selectedDecision.id}/approvals`);
      setApprovals(Array.isArray(data) ? data : data?.approvals || []);
    } catch (error) {
      console.error("Load approvals error:", error);
      setApprovals([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setApprovals(selectedDecision?.approvals || []);
    load();
  }, [selectedDecision?.id]);

  const canRequest = selectedDecision?.createdById === currentUser?.id || ["Manager", "Administrator"].includes(currentUser?.role);

  const request = async (event) => {
    event.preventDefault();
    if (!reviewerId) return;
    try {
      setRequesting(true);
      await apiRequest(`/api/decisions/${selectedDecision.id}/approvals`, {
        method: "POST",
        body: JSON.stringify({ reviewerId: Number(reviewerId), level: Number(level) }),
      });
      setReviewerId("");
      setLevel(1);
      await load();
      await onDecisionRefresh?.();
    } catch (error) {
      alert(error.message || "Unable to request approval.");
    } finally {
      setRequesting(false);
    }
  };

  const latest = approvals.length ? approvals[approvals.length - 1] : null;
  const myPendingApproval = approvals.find((approval) => approval.status === "Pending" && approval.reviewerId === currentUser?.id);

  const act = async (status) => {
    if (!myPendingApproval) return;
    try {
      setActing(status);
      await apiRequest(`/api/approvals/${myPendingApproval.id}`, {
        method: "PATCH",
        body: JSON.stringify({ status, comments: comment.trim() || null }),
      });
      setComment("");
      await load();
      await onDecisionRefresh?.();
    } catch (error) {
      alert(error.message || "Unable to update approval.");
    } finally {
      setActing(null);
    }
  };

  return (
    <div className="approval-panel">
      <div className="approval-status-banner">
        <div className="approval-panel-icon"><ShieldCheck size={19} /></div>
        <div><strong>{selectedDecision?.status === "UnderReview" ? "Approval in progress" : selectedDecision?.status}</strong><span>{selectedDecision?.status === "UnderReview" ? "This decision is waiting for one or more assigned reviewers." : "Approval history and reviewer activity for this decision."}</span></div>
      </div>

      {myPendingApproval && (
        <div className="approval-review-panel">
          <div><div className="panel-kicker">YOUR REVIEW</div><h3>Decision assigned to you</h3><p>Complete this approval directly from the decision workspace.</p></div>
          <textarea rows="3" value={comment} onChange={(event) => setComment(event.target.value)} placeholder="Optional review comment..." />
          <div className="review-action-row">
            <button className="review-reject-button" type="button" disabled={Boolean(acting)} onClick={() => act("Rejected")}>{acting === "Rejected" ? "Rejecting..." : "Reject"}</button>
            <button className="review-approve-button" type="button" disabled={Boolean(acting)} onClick={() => act("Approved")}>{acting === "Approved" ? "Approving..." : "Approve"}<CheckCircle2 size={14} /></button>
          </div>
        </div>
      )}

      {canRequest && selectedDecision?.status !== "Approved" && (
        <form className="approval-request-panel" onSubmit={request}>
          <div><div className="panel-kicker">REQUEST APPROVAL</div><h3>Send this decision for review</h3><p>Assign a reviewer and approval level.</p></div>
          <div className="approval-request-grid">
            <select value={reviewerId} onChange={(event) => setReviewerId(event.target.value)}><option value="">Select reviewer</option>{users.filter((user) => user.id !== currentUser?.id).map((user) => <option key={user.id} value={user.id}>{user.name} · {user.role}</option>)}</select>
            <select value={level} onChange={(event) => setLevel(event.target.value)}><option value={1}>Level 1 · Reviewer</option><option value={2}>Level 2 · Manager</option><option value={3}>Level 3 · Final</option></select>
            <button className="modal-primary" disabled={requesting} type="submit">{requesting ? "Sending..." : "Request approval"}<ArrowUpRight size={14} /></button>
          </div>
        </form>
      )}

      <div className="approval-history-list">
        {loading ? <div className="module-inline-empty"><Clock3 size={17} /><span>Loading approval history...</span></div> : approvals.length === 0 ? <div className="module-inline-empty"><ShieldCheck size={17} /><span>No approval requests have been created yet.</span></div> : approvals.map((approval) => <article className="approval-history-card" key={approval.id}><div className={`approval-history-icon ${statusClass(approval.status)}`}>{approval.status === "Approved" ? <CheckCircle2 size={16} /> : approval.status === "Rejected" ? <X size={16} /> : <Clock3 size={16} />}</div><div className="approval-history-copy"><div><strong>Level {approval.level} · {approval.reviewer?.name || "Assigned reviewer"}</strong><span className={`approval-badge ${statusClass(approval.status)}`}>{approval.status}</span></div><span>Requested by {approval.requestedBy?.name || "Workspace member"} · {formatDate(approval.createdAt)}</span>{approval.comments && <p>{approval.comments}</p>}</div></article>)}
      </div>
      {latest?.status === "Approved" && <div className="approval-complete-note"><CheckCircle2 size={17} /> Approval workflow completed.</div>}
    </div>
  );
}

export default ApprovalPanel;
