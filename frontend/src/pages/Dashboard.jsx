import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import {
  ArrowUpRight,
  BarChart3,
  Bell,
  BookOpen,
  CheckCircle2,
  ChevronRight,
  ChevronDown,
  Clock3,
  Database,
  FileText,
  GitBranch,
  LayoutDashboard,
  LockKeyhole,
  Menu,
  MessageCircle,
  MoreHorizontal,
  Search,
  Settings,
  ShieldCheck,
  Sparkles,
  Users,
  X,
  Zap,
} from "lucide-react";

import "../styles/Dashboard.css";
import ApprovalPanel from "../components/ApprovalPanel.jsx";
import AnimatedNumber from "../components/AnimatedNumber.jsx";
import WorkspacePageTransition from "../components/WorkspacePageTransition.jsx";
import CustomScrollbar from "../components/CustomScrollbar.jsx";
import {
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
} from "../components/WorkspacePages.jsx";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:4000";

const EMPTY_DECISION_FORM = {
  title: "",
  problemStatement: "",
  status: "Draft",
  teamId: "",
};

const EMPTY_ALTERNATIVE_FORM = {
  name: "",
  pros: "",
  cons: "",
  cost: "",
  feasibility: "",
  risk: "",
};

function Dashboard() {
  const navigate = useNavigate();
  const modalRef = useRef(null);
  const dashboardContentRef = useRef(null);
  const overviewScrollRef = useRef(null);

  const [activePage, setActivePage] = useState("Overview");
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [modal, setModal] = useState(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [moreMenu, setMoreMenu] = useState(null);

  const [decisions, setDecisions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [currentUser, setCurrentUser] = useState(null);
  const [userLoading, setUserLoading] = useState(true);

  const [decisionForm, setDecisionForm] = useState(EMPTY_DECISION_FORM);
  const [alternativeForm, setAlternativeForm] = useState(
    EMPTY_ALTERNATIVE_FORM,
  );
  const [selectedFile, setSelectedFile] = useState(null);
  const [documentCategory, setDocumentCategory] = useState("General");
  const [documentTags, setDocumentTags] = useState("");
  const [uploadingDocument, setUploadingDocument] = useState(false);
  const [discussionForm, setDiscussionForm] = useState({
    type: "Comment",
    content: "",
    parentId: "",
  });
  const [savingDiscussion, setSavingDiscussion] = useState(false);
  const [deletingDiscussionId, setDeletingDiscussionId] = useState(null);
  const [editingDiscussion, setEditingDiscussion] = useState(null);
  const [selectedDiscussionFile, setSelectedDiscussionFile] = useState(null);
  const [uploadingDiscussionFile, setUploadingDiscussionFile] = useState(false);

  const [creatingDecision, setCreatingDecision] = useState(false);
  const [savingDecision, setSavingDecision] = useState(false);
  const [deletingDecision, setDeletingDecision] = useState(false);
  const [savingAlternative, setSavingAlternative] = useState(false);
  const [deletingAlternativeId, setDeletingAlternativeId] = useState(null);

  const [selectedDecision, setSelectedDecision] = useState(null);
  const [editingAlternative, setEditingAlternative] = useState(null);
  const [decisionTab, setDecisionTab] = useState("overview");
  const [selectedAlternative, setSelectedAlternative] = useState(null);
  const [availableTeams, setAvailableTeams] = useState([]);
  const [teamToOpenId, setTeamToOpenId] = useState(null);
  const [availableUsers, setAvailableUsers] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [dashboardDocumentCount, setDashboardDocumentCount] = useState(0);

  const normalizedRole = (currentUser?.role || "Employee").trim().toLowerCase();

  const role = normalizedRole === "admin" ? "administrator" : normalizedRole;

  const isEmployee = role === "employee";
  const isReviewer = role === "reviewer";
  const isManager = role === "manager";
  const isAdministrator = role === "administrator";
  const canReview = isReviewer || isManager || isAdministrator;

  const navigation = [
    { label: "Overview", icon: LayoutDashboard, show: true },
    { label: "Decisions", icon: FileText, show: true },
    { label: "Reviews", icon: Clock3, show: canReview },
    { label: "Knowledge", icon: BookOpen, show: true },
    { label: "Teams", icon: Users, show: true },
    { label: "Discussions", icon: MessageCircle, show: true },
    { label: "Documents", icon: FileText, show: true },
    { label: "Analytics", icon: BarChart3, show: isManager || isAdministrator },
    { label: "Reports", icon: FileText, show: isManager || isAdministrator },
    { label: "Users", icon: Users, show: isAdministrator },
    { label: "Audit & Compliance", icon: ShieldCheck, show: isAdministrator },
  ].filter((item) => item.show);

  const primaryNavigation = navigation.slice(0, 7);
  const secondaryNavigation = [
    ...navigation.slice(7),
    { label: "Settings", icon: Settings, show: true },
  ];

  const getToken = () => {
    return localStorage.getItem("token");
  };

  const handleUnauthorized = () => {
    localStorage.removeItem("token");
    navigate("/login", {
      replace: true,
    });
  };

  const apiRequest = async (path, options = {}) => {
    const token = getToken();

    if (!token) {
      handleUnauthorized();
      throw new Error("Authentication required");
    }

    const method = (options.method || "GET").toUpperCase();
    const maxAttempts = method === "GET" ? 3 : 1;

    let lastError = null;

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        const { responseType = "json", ...fetchOptions } = options;

        const response = await fetch(`${API_BASE_URL}${path}`, {
          ...fetchOptions,
          headers: {
            ...(fetchOptions.body && !(fetchOptions.body instanceof FormData)
              ? {
                  "Content-Type": "application/json",
                }
              : {}),
            ...(fetchOptions.headers || {}),
            Authorization: `Bearer ${token}`,
          },
        });

        let data = null;

        if (!response.ok) {
          try {
            data = await response.json();
          } catch {
            data = null;
          }
        } else if (responseType === "blob") {
          data = await response.blob();
        } else {
          try {
            data = await response.json();
          } catch {
            data = null;
          }
        }

        if (response.status === 401) {
          handleUnauthorized();

          throw new Error("Your session has expired. Please sign in again.");
        }

        const isTransientServerError = [502, 503, 504].includes(
          response.status,
        );

        if (!response.ok) {
          const error = new Error(data?.message || "Something went wrong.");
          error.isTransient = isTransientServerError;

          if (isTransientServerError && attempt < maxAttempts) {
            await new Promise((resolve) =>
              window.setTimeout(resolve, 1200 * attempt),
            );
            continue;
          }

          throw error;
        }

        return data;
      } catch (requestError) {
        lastError = requestError;

        const isNetworkError =
          requestError instanceof TypeError ||
          requestError?.message === "Failed to fetch";

        const isTransientError =
          isNetworkError || requestError?.isTransient === true;

        if (!isTransientError || attempt >= maxAttempts) {
          throw requestError;
        }

        await new Promise((resolve) =>
          window.setTimeout(resolve, 1200 * attempt),
        );
      }
    }

    throw lastError || new Error("Unable to connect to the server.");
  };

  const getDecisionIcon = (title = "") => {
    const value = title.toLowerCase();

    if (value.includes("database")) {
      return Database;
    }

    if (value.includes("architecture")) {
      return GitBranch;
    }

    if (value.includes("ai") || value.includes("model")) {
      return Sparkles;
    }

    if (value.includes("security") || value.includes("privacy")) {
      return ShieldCheck;
    }

    return Zap;
  };

  const displayStatus = (status = "Draft") => {
    const statusMap = {
      Draft: "Draft",
      UnderReview: "Under Review",
      Approved: "Approved",
      Rejected: "Rejected",
      Archived: "Archived",
    };

    return statusMap[status] || status;
  };

  const statusApiValue = (status) => {
    const statusMap = {
      Draft: "Draft",
      "Under Review": "UnderReview",
      UnderReview: "UnderReview",
      Approved: "Approved",
      Rejected: "Rejected",
      Archived: "Archived",
    };

    return statusMap[status] || "Draft";
  };

  const formatDecisionDate = (date) => {
    if (!date) {
      return "—";
    }

    const parsedDate = new Date(date);

    if (Number.isNaN(parsedDate.getTime())) {
      return "—";
    }

    return new Intl.DateTimeFormat("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }).format(parsedDate);
  };

  const formatRelativeTime = (date) => {
    if (!date) {
      return "—";
    }

    const timestamp = new Date(date).getTime();

    if (Number.isNaN(timestamp)) {
      return "—";
    }

    const difference = Date.now() - timestamp;
    const minutes = Math.max(0, Math.floor(difference / 60000));

    if (minutes < 1) {
      return "Just now";
    }

    if (minutes < 60) {
      return `${minutes} min ago`;
    }

    const hours = Math.floor(minutes / 60);

    if (hours < 24) {
      return `${hours} hour${hours === 1 ? "" : "s"} ago`;
    }

    const days = Math.floor(hours / 24);

    return `${days} day${days === 1 ? "" : "s"} ago`;
  };

  const fetchDecisions = async () => {
    try {
      setLoading(true);
      setError("");

      const data = await apiRequest("/api/decisions");

      setDecisions(Array.isArray(data?.decisions) ? data.decisions : []);
    } catch (fetchError) {
      console.error("Fetch decisions error:", fetchError);

      if (fetchError.message !== "Authentication required") {
        setError(fetchError.message || "Unable to load decisions.");
      }
    } finally {
      setLoading(false);
    }
  };

  const fetchTeams = async () => {
    try {
      const data = await apiRequest("/api/teams");
      setAvailableTeams(data?.teams || []);
    } catch (error) {
      console.error("Fetch teams error:", error);
      setAvailableTeams([]);
    }
  };

  const fetchUsers = async () => {
    try {
      const data = await apiRequest("/api/users");
      setAvailableUsers(data?.users || []);
    } catch (error) {
      console.error("Fetch users error:", error);
      setAvailableUsers([]);
    }
  };

  const fetchNotifications = async () => {
    try {
      const data = await apiRequest("/api/notifications");
      setNotifications(data?.notifications || []);
      setUnreadNotifications(data?.unreadCount || 0);
    } catch (error) {
      console.error("Fetch notifications error:", error);
      setNotifications([]);
      setUnreadNotifications(0);
    }
  };

  const markAllNotificationsRead = async () => {
    try {
      await apiRequest("/api/notifications/read-all", { method: "PATCH" });
      await fetchNotifications();
    } catch (error) {
      console.error("Mark notifications read error:", error);
    }
  };

  const fetchDashboardKnowledge = async () => {
    try {
      const data = await apiRequest(
        "/api/knowledge?tab=documents&page=1&pageSize=5",
      );
      setDashboardDocumentCount(
        Number(data?.stats?.documents ?? data?.pagination?.total ?? 0),
      );
    } catch (error) {
      console.error("Fetch dashboard knowledge error:", error);
      setDashboardDocumentCount(0);
    }
  };

  const fetchCurrentUser = async () => {
    try {
      setUserLoading(true);

      const data = await apiRequest("/api/auth/me");

      setCurrentUser(data?.user || null);
    } catch (userError) {
      console.error("Fetch user error:", userError);
    } finally {
      setUserLoading(false);
    }
  };

  useEffect(() => {
    let cancelled = false;

    const loadDashboard = async () => {
      // Wake the backend and establish the current session first.
      // The remaining dashboard requests start only after this initial
      // request has had a chance to bring the Render free instance online.
      await fetchCurrentUser();

      if (cancelled) {
        return;
      }

      await Promise.all([
        fetchDecisions(),
        fetchNotifications(),
        fetchDashboardKnowledge(),
      ]);
    };

    loadDashboard().catch((loadError) => {
      console.error("Dashboard initialization error:", loadError);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (currentUser?.id) {
      fetchTeams();
      fetchUsers();
    }
  }, [currentUser?.id]);

  useEffect(() => {
    const timer = window.setInterval(fetchNotifications, 30000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (modalRef.current) {
      modalRef.current.scrollTop = 0;
    }
  }, [modal]);

  const dashboardDecisions = useMemo(() => {
    return decisions.map((decision) => ({
      ...decision,
      name: decision.title,
      team: decision.team?.name || "Unassigned",
      status: displayStatus(decision.status),
      created: formatDecisionDate(decision.createdAt),
      relativeCreated: formatRelativeTime(decision.createdAt),
      icon: getDecisionIcon(decision.title),
    }));
  }, [decisions]);

  const filteredDecisions = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    if (!query) {
      return dashboardDecisions;
    }

    return dashboardDecisions.filter((decision) =>
      [
        decision.name,
        decision.team,
        decision.status,
        decision.created,
        decision.problemStatement,
      ]
        .join(" ")
        .toLowerCase()
        .includes(query),
    );
  }, [dashboardDecisions, searchQuery]);

  const recentDecisions = filteredDecisions.slice(0, 5);

  const totalDecisions = decisions.length;

  const draftCount = decisions.filter(
    (decision) => decision.status === "Draft",
  ).length;

  const reviewCount = decisions.filter(
    (decision) => decision.status === "UnderReview",
  ).length;

  const approvedCount = decisions.filter(
    (decision) => decision.status === "Approved",
  ).length;

  const rejectedCount = decisions.filter(
    (decision) => decision.status === "Rejected",
  ).length;

  const myTeams = useMemo(
    () =>
      availableTeams.filter(
        (team) =>
          team.userMembership ||
          currentUser?.teamMemberships?.some(
            (membership) => membership.teamId === team.id,
          ),
      ),
    [availableTeams, currentUser],
  );

  const canManageDecision = (decision) => {
    if (!decision || !currentUser?.id) return false;
    if (isAdministrator) return true;
    if (
      Number(decision.createdById || decision.createdBy?.id) ===
      Number(currentUser.id)
    )
      return true;
    if (isManager && decision.teamId) {
      const team = availableTeams.find(
        (item) => Number(item.id) === Number(decision.teamId),
      );
      const membershipRole =
        team?.userMembership?.teamRole ||
        currentUser.teamMemberships?.find(
          (membership) => Number(membership.teamId) === Number(decision.teamId),
        )?.teamRole;
      return ["Owner", "Manager", "Lead"].includes(membershipRole);
    }
    return false;
  };

  const canManageSelectedDecision = canManageDecision(selectedDecision);

  const approvalRate = totalDecisions
    ? Math.round((approvedCount / totalDecisions) * 100)
    : 0;

  const statusPercent = (count) => {
    if (!totalDecisions) {
      return 0;
    }

    return Math.round((count / totalDecisions) * 100);
  };

  const getStatusClass = (status) => {
    return status.toLowerCase().replaceAll(" ", "-");
  };

  const handlePageChange = (page) => {
    setActivePage(page);

    // The top search is scoped to the page the user is currently viewing.
    // Clear it when navigating so a search from one module cannot hide all
    // records in another module. Each module keeps its own local search state.
    setSearchQuery("");

    setMobileOpen(false);
    setProfileOpen(false);
    setNotificationsOpen(false);
    setMoreMenu(null);
  };

  const openTeamFromKnowledge = (teamId) => {
    setTeamToOpenId(Number(teamId));
    handlePageChange("Teams");
  };

  const openCreateDecision = () => {
    setDecisionForm(EMPTY_DECISION_FORM);

    setModal({
      type: "create-decision",
    });

    setMoreMenu(null);
  };

  const openEditDecision = (decision) => {
    setDecisionForm({
      title: decision.title || "",
      problemStatement: decision.problemStatement || "",
      status: decision.status || "Draft",
      teamId: decision.teamId ? String(decision.teamId) : "",
    });

    setModal({
      type: "edit-decision",
      decision,
    });

    setMoreMenu(null);
  };

  const openDecision = async (decision, preferredTab = "overview") => {
    try {
      const data = await apiRequest(`/api/decisions/${decision.id}`);

      const alternatives = await apiRequest(
        `/api/decisions/${decision.id}/alternatives`,
      );

      const documents = await apiRequest(
        `/api/decisions/${decision.id}/documents`,
      );

      const discussions = await apiRequest(
        `/api/decisions/${decision.id}/discussions`,
      );

      setSelectedDecision({
        ...(data?.decision || decision),
        alternatives: Array.isArray(alternatives)
          ? alternatives
          : alternatives?.alternatives || [],
        documents: Array.isArray(documents)
          ? documents
          : documents?.documents || [],
        discussions: Array.isArray(discussions)
          ? discussions
          : discussions?.discussions || [],
      });

      setAlternativeForm(EMPTY_ALTERNATIVE_FORM);
      setEditingAlternative(null);
      setSelectedFile(null);
      setDocumentCategory("General");
      setDocumentTags("");
      setDiscussionForm({ type: "Comment", content: "", parentId: "" });
      setEditingDiscussion(null);
      setSelectedDiscussionFile(null);
      setDecisionTab(preferredTab);

      setModal({
        type: "view-decision",
      });
    } catch (viewError) {
      console.error("Open decision error:", viewError);

      alert(viewError.message || "Unable to open decision.");
    }
  };

  const handleCreateDecision = async (event) => {
    event.preventDefault();

    if (!decisionForm.title.trim() || !decisionForm.problemStatement.trim()) {
      alert("Please fill in both the decision title and problem statement.");

      return;
    }

    try {
      setCreatingDecision(true);

      await apiRequest("/api/decisions", {
        method: "POST",
        body: JSON.stringify({
          title: decisionForm.title.trim(),
          problemStatement: decisionForm.problemStatement.trim(),
          teamId: decisionForm.teamId ? Number(decisionForm.teamId) : null,
        }),
      });

      setDecisionForm(EMPTY_DECISION_FORM);

      setModal(null);

      await fetchDecisions();
    } catch (createError) {
      console.error("Create decision error:", createError);

      alert(createError.message || "Unable to create decision.");
    } finally {
      setCreatingDecision(false);
    }
  };

  const handleUpdateDecision = async (event) => {
    event.preventDefault();

    if (!decisionForm.title.trim() || !decisionForm.problemStatement.trim()) {
      alert("Please fill in both the decision title and problem statement.");

      return;
    }

    if (!modal?.decision?.id) {
      return;
    }

    try {
      setSavingDecision(true);

      const data = await apiRequest(`/api/decisions/${modal.decision.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          title: decisionForm.title.trim(),
          problemStatement: decisionForm.problemStatement.trim(),
          status: statusApiValue(decisionForm.status),
          teamId: decisionForm.teamId ? Number(decisionForm.teamId) : null,
        }),
      });

      setModal(null);

      setSelectedDecision(data?.decision || null);

      await fetchDecisions();
    } catch (updateError) {
      console.error("Update decision error:", updateError);

      alert(updateError.message || "Unable to update decision.");
    } finally {
      setSavingDecision(false);
    }
  };

  const handleDeleteDecision = async (decision) => {
    const confirmed = window.confirm(
      `Delete "${decision.title}"? This cannot be undone.`,
    );

    if (!confirmed) {
      return;
    }

    try {
      setDeletingDecision(true);

      await apiRequest(`/api/decisions/${decision.id}`, {
        method: "DELETE",
      });

      setModal(null);
      setSelectedDecision(null);

      await fetchDecisions();
    } catch (deleteError) {
      console.error("Delete decision error:", deleteError);

      alert(deleteError.message || "Unable to delete decision.");
    } finally {
      setDeletingDecision(false);
    }
  };

  const handleSaveAlternative = async (event) => {
    event.preventDefault();

    if (!selectedDecision?.id || !alternativeForm.name.trim()) {
      alert("Alternative name is required.");

      return;
    }

    try {
      setSavingAlternative(true);

      let responseData;

      if (editingAlternative?.id) {
        responseData = await apiRequest(
          `/api/decisions/${selectedDecision.id}/alternatives/${editingAlternative.id}`,
          {
            method: "PATCH",
            body: JSON.stringify(alternativeForm),
          },
        );
      } else {
        responseData = await apiRequest(
          `/api/decisions/${selectedDecision.id}/alternatives`,
          {
            method: "POST",
            body: JSON.stringify(alternativeForm),
          },
        );
      }

      const savedAlternative = responseData?.alternative || responseData;

      const alternatives = editingAlternative?.id
        ? (selectedDecision.alternatives || []).map((alternative) =>
            alternative.id === editingAlternative.id
              ? savedAlternative
              : alternative,
          )
        : [...(selectedDecision.alternatives || []), savedAlternative];

      setSelectedDecision({
        ...selectedDecision,
        alternatives,
      });

      setAlternativeForm(EMPTY_ALTERNATIVE_FORM);

      setEditingAlternative(null);
    } catch (alternativeError) {
      console.error("Save alternative error:", alternativeError);

      alert(alternativeError.message || "Unable to save alternative.");
    } finally {
      setSavingAlternative(false);
    }
  };

  const handleEditAlternative = (alternative) => {
    setEditingAlternative(alternative);

    setAlternativeForm({
      name: alternative.name || "",
      pros: alternative.pros || "",
      cons: alternative.cons || "",
      cost: alternative.cost || "",
      feasibility: alternative.feasibility || "",
      risk: alternative.risk || "",
    });
  };

  const handleDeleteAlternative = async (alternative) => {
    if (!selectedDecision?.id) {
      return;
    }

    const confirmed = window.confirm(
      `Delete alternative "${alternative.name}"?`,
    );

    if (!confirmed) {
      return;
    }

    try {
      setDeletingAlternativeId(alternative.id);

      await apiRequest(
        `/api/decisions/${selectedDecision.id}/alternatives/${alternative.id}`,
        {
          method: "DELETE",
        },
      );

      setSelectedDecision({
        ...selectedDecision,
        alternatives: (selectedDecision.alternatives || []).filter(
          (item) => item.id !== alternative.id,
        ),
      });
    } catch (alternativeError) {
      console.error("Delete alternative error:", alternativeError);

      alert(alternativeError.message || "Unable to delete alternative.");
    } finally {
      setDeletingAlternativeId(null);
    }
  };

  const handleUploadDocument = async () => {
    if (!selectedDecision?.id || !selectedFile) {
      alert("Please select a file first.");
      return;
    }

    try {
      setUploadingDocument(true);

      const formData = new FormData();
      formData.append("file", selectedFile);
      formData.append("category", documentCategory);
      formData.append("tags", documentTags.trim());

      const responseData = await apiRequest(
        `/api/decisions/${selectedDecision.id}/documents`,
        {
          method: "POST",
          body: formData,
        },
      );

      const savedDocument = responseData?.document || responseData;

      setSelectedDecision({
        ...selectedDecision,
        documents: [...(selectedDecision.documents || []), savedDocument],
      });

      setSelectedFile(null);
      setDocumentCategory("General");
      setDocumentTags("");
    } catch (documentError) {
      console.error("Upload document error:", documentError);
      alert(documentError.message || "Unable to upload document.");
    } finally {
      setUploadingDocument(false);
    }
  };

  const handleOpenDocument = async (document) => {
    if (!document?.id || !selectedDecision?.id) {
      alert("This document cannot be opened.");
      return;
    }

    // Open the tab synchronously from the click event so Chrome does not
    // treat the document viewer as a popup created after an async request.
    const newWindow = window.open("", "_blank");

    if (!newWindow) {
      alert("Please allow pop-ups for DecisionVault to open documents.");
      return;
    }

    try {
      newWindow.opener = null;
      newWindow.document.title = "Opening document...";
      newWindow.document.body.innerHTML = `
        <div
          style="
            font-family: system-ui, -apple-system, BlinkMacSystemFont, sans-serif;
            padding: 40px;
            text-align: center;
          "
        >
          Opening document...
        </div>
      `;

      const fileBlob = await apiRequest(
        `/api/decisions/${selectedDecision.id}/documents/${document.id}/content`,
        { responseType: "blob" },
      );

      if (!(fileBlob instanceof Blob) || fileBlob.size === 0) {
        throw new Error("The document file is empty or could not be loaded.");
      }

      const objectUrl = URL.createObjectURL(fileBlob);
      newWindow.location.replace(objectUrl);

      // Keep the Blob URL alive while the browser finishes loading the file.
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
    } catch (error) {
      try {
        newWindow.close();
      } catch {
        // Ignore popup close errors.
      }

      console.error("Open document error:", error);

      alert(error.message || "Unable to open the document.");
    }
  };

  const handleSaveDiscussion = async (event) => {
    event.preventDefault();

    if (!selectedDecision?.id || !discussionForm.content.trim()) {
      alert("Discussion content is required.");
      return;
    }

    try {
      setSavingDiscussion(true);

      const path = editingDiscussion?.id
        ? `/api/decisions/${selectedDecision.id}/discussions/${editingDiscussion.id}`
        : `/api/decisions/${selectedDecision.id}/discussions`;

      const responseData = await apiRequest(path, {
        method: editingDiscussion?.id ? "PATCH" : "POST",
        body: JSON.stringify({
          type: discussionForm.type,
          content: discussionForm.content.trim(),
          parentId: discussionForm.parentId
            ? Number(discussionForm.parentId)
            : null,
        }),
      });

      const savedDiscussion = responseData?.discussion || responseData;
      const discussions = editingDiscussion?.id
        ? (selectedDecision.discussions || []).map((item) =>
            item.id === editingDiscussion.id ? savedDiscussion : item,
          )
        : [...(selectedDecision.discussions || []), savedDiscussion];

      setSelectedDecision({ ...selectedDecision, discussions });
      setDiscussionForm({ type: "Comment", content: "", parentId: "" });
      setEditingDiscussion(null);
    } catch (discussionError) {
      console.error("Save discussion error:", discussionError);
      alert(discussionError.message || "Unable to save discussion.");
    } finally {
      setSavingDiscussion(false);
    }
  };

  const handleEditDiscussion = (discussion) => {
    setEditingDiscussion(discussion);
    setDiscussionForm({
      type: discussion.type || "Comment",
      content: discussion.content || "",
      parentId: discussion.parentId ? String(discussion.parentId) : "",
    });
  };

  const handleUploadDiscussionAttachment = async (discussion) => {
    if (!selectedDiscussionFile) {
      alert("Please select a file first.");
      return;
    }

    try {
      setUploadingDiscussionFile(true);

      const formData = new FormData();
      formData.append("file", selectedDiscussionFile);

      const responseData = await apiRequest(
        `/api/discussions/${discussion.id}/attachments`,
        { method: "POST", body: formData },
      );

      const savedAttachment = responseData?.attachment || responseData;
      const discussions = (selectedDecision.discussions || []).map((item) =>
        item.id === discussion.id
          ? {
              ...item,
              attachments: [...(item.attachments || []), savedAttachment],
            }
          : item,
      );

      setSelectedDecision({ ...selectedDecision, discussions });
      setSelectedDiscussionFile(null);
    } catch (attachmentError) {
      console.error("Upload discussion attachment error:", attachmentError);
      alert(attachmentError.message || "Unable to upload attachment.");
    } finally {
      setUploadingDiscussionFile(false);
    }
  };

  const handleDeleteDiscussion = async (discussion) => {
    if (!selectedDecision?.id) return;

    const confirmed = window.confirm(
      "Delete this discussion entry? This cannot be undone.",
    );

    if (!confirmed) return;

    try {
      setDeletingDiscussionId(discussion.id);

      await apiRequest(
        `/api/decisions/${selectedDecision.id}/discussions/${discussion.id}`,
        { method: "DELETE" },
      );

      setSelectedDecision({
        ...selectedDecision,
        discussions: (selectedDecision.discussions || []).filter(
          (item) => item.id !== discussion.id,
        ),
      });
    } catch (discussionError) {
      console.error("Delete discussion error:", discussionError);
      alert(discussionError.message || "Unable to delete discussion.");
    } finally {
      setDeletingDiscussionId(null);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("token");

    navigate("/login", {
      replace: true,
    });
  };

  const firstName = currentUser?.name?.split(" ")[0] || "there";

  const initials = currentUser?.name
    ? currentUser.name
        .split(" ")
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0])
        .join("")
        .toUpperCase()
    : "DV";

  const showOverview = activePage === "Overview";

  const showDecisionsPage = activePage === "Decisions";

  const donutStyle = totalDecisions
    ? {
        background: `conic-gradient(
          #6f7b74 0% ${statusPercent(draftCount)}%,
          #d3a83b ${statusPercent(draftCount)}% ${
            statusPercent(draftCount) + statusPercent(reviewCount)
          }%,
          #2b8a57 ${statusPercent(draftCount) + statusPercent(reviewCount)}% ${
            statusPercent(draftCount) +
            statusPercent(reviewCount) +
            statusPercent(approvedCount)
          }%,
          #d27663 ${
            statusPercent(draftCount) +
            statusPercent(reviewCount) +
            statusPercent(approvedCount)
          }% 100%
        )`,
      }
    : undefined;

  const pendingApprovalCount = reviewCount;
  const reviewRate = totalDecisions
    ? Math.round((reviewCount / totalDecisions) * 100)
    : 0;

  return (
    <div className={`dashboard ${showOverview ? "overview-dashboard" : ""}`}>
      <div className="dashboard-grid" />

      <div className="dashboard-glow dashboard-glow-1" />

      <div className="dashboard-glow dashboard-glow-2" />

      <header className="dashboard-nav-header">
        <div className="dashboard-nav-brand">
          <div className="brand-mark">
            <LockKeyhole size={16} strokeWidth={2.2} />
          </div>

          <span>
            Decision<span>Vault</span>
          </span>
        </div>

        <button
          className="dashboard-nav-mobile-menu"
          onClick={() => setMobileOpen((value) => !value)}
          aria-label="Toggle navigation"
          type="button"
        >
          {mobileOpen ? <X size={20} /> : <Menu size={20} />}
        </button>

        <nav className="dashboard-nav-main" aria-label="Primary navigation">
          {primaryNavigation.map((item) => {
            const Icon = item.icon;

            return (
              <button
                key={item.label}
                className={
                  activePage === item.label
                    ? "top-nav-item active"
                    : "top-nav-item"
                }
                onClick={() => handlePageChange(item.label)}
                type="button"
              >
                <Icon size={15} />
                <span>{item.label}</span>
              </button>
            );
          })}

          <div className="top-nav-more">
            <button
              className={
                secondaryNavigation.some((item) => item.label === activePage)
                  ? "top-nav-item top-nav-more-toggle active"
                  : "top-nav-item top-nav-more-toggle"
              }
              onClick={() => {
                setMoreMenu((value) => !value);
                setProfileOpen(false);
                setNotificationsOpen(false);
              }}
              type="button"
              aria-expanded={Boolean(moreMenu)}
            >
              <MoreHorizontal size={16} />
              <span>More</span>
              <ChevronDown
                size={14}
                className={moreMenu ? "more-chevron open" : "more-chevron"}
              />
            </button>

            {moreMenu && (
              <div className="top-nav-more-menu">
                {secondaryNavigation.map((item) => {
                  const Icon = item.icon;

                  return (
                    <button
                      key={item.label}
                      className={
                        activePage === item.label
                          ? "top-nav-more-item active"
                          : "top-nav-more-item"
                      }
                      onClick={() => handlePageChange(item.label)}
                      type="button"
                    >
                      <Icon size={15} />
                      <span>{item.label}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </nav>

        <div className="dashboard-nav-search">
          <Search size={17} />

          <input
            type="search"
            placeholder="Search decisions, teams, documents..."
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            aria-label="Search decisions, teams, documents"
          />

          {searchQuery && (
            <button
              type="button"
              className="search-clear"
              onClick={() => setSearchQuery("")}
              aria-label="Clear search"
            >
              <X size={14} />
            </button>
          )}
        </div>

        <div className="topbar-actions dashboard-nav-actions">
          <button
            className="icon-button"
            type="button"
            aria-label="Notifications"
            onClick={() => {
              setNotificationsOpen((value) => !value);
              setProfileOpen(false);
              setMoreMenu(false);
            }}
          >
            <Bell size={17} />

            {unreadNotifications > 0 && <span className="notification-dot" />}
          </button>

          <button
            className="topbar-profile"
            type="button"
            onClick={() => {
              setProfileOpen((value) => !value);
              setNotificationsOpen(false);
              setMoreMenu(false);
            }}
          >
            <span className="topbar-avatar">{initials[0]}</span>

            <span className="topbar-profile-copy">
              <strong>{currentUser?.name || "Decision Workspace"}</strong>
              <small>{currentUser?.role || "Employee"}</small>
            </span>

            <ChevronRight size={15} className="profile-chevron" />
          </button>
        </div>

        {notificationsOpen && (
          <div className="topbar-popover notification-popover">
            <div className="notification-popover-head">
              <span className="popover-label">NOTIFICATIONS</span>
              {unreadNotifications > 0 && (
                <button type="button" onClick={markAllNotificationsRead}>
                  Mark all read
                </button>
              )}
            </div>
            <div className="notification-list">
              {notifications.length ? (
                notifications.slice(0, 5).map((notification) => (
                  <button
                    type="button"
                    className={`notification-item ${notification.isRead ? "read" : ""}`}
                    key={notification.id}
                    onClick={async () => {
                      if (!notification.isRead) {
                        await apiRequest(
                          `/api/notifications/${notification.id}/read`,
                          { method: "PATCH" },
                        );
                        await fetchNotifications();
                      }
                      if (
                        notification.entityType === "Decision" &&
                        notification.entityId
                      ) {
                        const decision = decisions.find(
                          (item) => item.id === notification.entityId,
                        );
                        if (decision) {
                          await openDecision(decision);
                        } else {
                          const decisionData = await apiRequest(
                            `/api/decisions/${notification.entityId}`,
                          );
                          if (decisionData?.decision)
                            await openDecision(decisionData.decision);
                        }
                      }
                    }}
                  >
                    <span className="notification-item-icon">
                      <Bell size={14} />
                    </span>
                    <span>
                      <strong>{notification.title}</strong>
                      <small>{notification.message}</small>
                      <em>{formatRelativeTime(notification.createdAt)}</em>
                    </span>
                  </button>
                ))
              ) : (
                <div className="notification-empty">
                  <Bell size={16} />
                  <span>No new notifications.</span>
                </div>
              )}
            </div>
            {canReview && (
              <button type="button" onClick={() => handlePageChange("Reviews")}>
                Open reviews <ArrowUpRight size={13} />
              </button>
            )}
          </div>
        )}

        {profileOpen && (
          <div className="topbar-popover profile-popover">
            <span className="popover-label">ACCOUNT</span>

            <strong>{currentUser?.name || "Decision Workspace"}</strong>

            <button type="button" onClick={() => handlePageChange("Settings")}>
              Settings
              <ArrowUpRight size={13} />
            </button>

            <button type="button" onClick={handleLogout}>
              Sign out
              <ArrowUpRight size={13} />
            </button>
          </div>
        )}

        {mobileOpen && (
          <div className="dashboard-nav-mobile-menu-panel">
            <div className="dashboard-nav-mobile-links">
              {navigation.map((item) => {
                const Icon = item.icon;

                return (
                  <button
                    key={item.label}
                    className={
                      activePage === item.label
                        ? "mobile-nav-item active"
                        : "mobile-nav-item"
                    }
                    onClick={() => handlePageChange(item.label)}
                    type="button"
                  >
                    <Icon size={16} />
                    <span>{item.label}</span>
                  </button>
                );
              })}

              <button
                className={
                  activePage === "Settings"
                    ? "mobile-nav-item active"
                    : "mobile-nav-item"
                }
                onClick={() => handlePageChange("Settings")}
                type="button"
              >
                <Settings size={16} />
                <span>Settings</span>
              </button>
            </div>
          </div>
        )}
      </header>

      <main className="dashboard-main">
        <div className="dashboard-content" ref={dashboardContentRef}>
          <WorkspacePageTransition pageKey={activePage}>
            {showOverview && (
              <section className="overview-v4-page">
                <div className="overview-v4-scroll" ref={overviewScrollRef}>
                  <section className="overview-v4-hero">
                    <div className="overview-v4-hero-copy">
                      <h1>
                        Good evening
                        {firstName !== "there" ? `, ${firstName}` : ""}.
                      </h1>
                    </div>

                    <div className="overview-v4-hero-actions">
                      <div className="overview-v4-date-card">
                        <span>TODAY</span>
                        <strong>
                          {new Intl.DateTimeFormat("en-IN", {
                            weekday: "short",
                            day: "numeric",
                            month: "short",
                          }).format(new Date())}
                        </strong>
                      </div>
                      <button
                        className="overview-v4-primary"
                        type="button"
                        onClick={openCreateDecision}
                      >
                        <b>+</b>
                        New decision
                        <ArrowUpRight size={15} />
                      </button>
                    </div>
                  </section>

                  <section className="overview-v4-kpis">
                    <button
                      type="button"
                      className="overview-v4-kpi"
                      onClick={() => handlePageChange("Decisions")}
                    >
                      <span className="overview-v4-kpi-icon teal">
                        <FileText size={18} />
                      </span>
                      <span className="overview-v4-kpi-content">
                        <small>Total decisions</small>
                        <AnimatedNumber value={totalDecisions} />
                        <span>Across the workspace</span>
                      </span>
                      <em>+20%</em>
                    </button>

                    <button
                      type="button"
                      className="overview-v4-kpi"
                      onClick={() => handlePageChange("Reviews")}
                    >
                      <span className="overview-v4-kpi-icon amber">
                        <Clock3 size={18} />
                      </span>
                      <span className="overview-v4-kpi-content">
                        <small>Pending approvals</small>
                        <AnimatedNumber value={pendingApprovalCount} />
                        <span>Needs review attention</span>
                      </span>
                      <em className="warning">{reviewRate}%</em>
                    </button>

                    <button
                      type="button"
                      className="overview-v4-kpi"
                      onClick={() => handlePageChange("Decisions")}
                    >
                      <span className="overview-v4-kpi-icon green">
                        <CheckCircle2 size={18} />
                      </span>
                      <span className="overview-v4-kpi-content">
                        <small>Approved decisions</small>
                        <AnimatedNumber value={approvedCount} />
                        <span>{approvalRate}% approval rate</span>
                      </span>
                      <em className="positive">Stable</em>
                    </button>

                    <button
                      type="button"
                      className="overview-v4-kpi"
                      onClick={() => handlePageChange("Documents")}
                    >
                      <span className="overview-v4-kpi-icon blue">
                        <Database size={18} />
                      </span>
                      <span className="overview-v4-kpi-content">
                        <small>Knowledge assets</small>
                        <AnimatedNumber value={dashboardDocumentCount} />
                        <span>Supporting documents</span>
                      </span>
                      <em>+100%</em>
                    </button>
                  </section>

                  <section className="overview-v4-grid overview-v4-grid-top">
                    <section className="overview-v4-card overview-v4-pipeline-card">
                      <div className="overview-v4-card-head">
                        <div>
                          <span>WORKFLOW</span>
                          <h2>Decision pipeline</h2>
                          <p>
                            See where your decision portfolio is sitting right
                            now.
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => handlePageChange("Reviews")}
                        >
                          Review queue <ChevronRight size={15} />
                        </button>
                      </div>

                      <div className="overview-v4-pipeline-summary">
                        <div>
                          <span>PORTFOLIO</span>
                          <strong>
                            <AnimatedNumber value={totalDecisions} />
                          </strong>
                          <small>total decisions</small>
                        </div>
                        <div className="overview-v4-pipeline-summary-focus">
                          <span>FOCUS</span>
                          <strong>
                            <AnimatedNumber value={reviewCount} />
                          </strong>
                          <small>
                            {reviewCount
                              ? "need review attention"
                              : "no decisions waiting"}
                          </small>
                        </div>
                      </div>

                      <div className="overview-v4-pipeline-list">
                        {[
                          {
                            label: "Draft",
                            count: draftCount,
                            tone: "draft",
                            note: "Still being shaped",
                          },
                          {
                            label: "Under review",
                            count: reviewCount,
                            tone: "review",
                            note: "Waiting for approval",
                          },
                          {
                            label: "Approved",
                            count: approvedCount,
                            tone: "approved",
                            note: "Completed outcomes",
                          },
                          {
                            label: "Rejected",
                            count: rejectedCount,
                            tone: "rejected",
                            note: "Closed decisions",
                          },
                        ].map((stage, index) => {
                          const percentage = totalDecisions
                            ? Math.round((stage.count / totalDecisions) * 100)
                            : 0;

                          return (
                            <div
                              className="overview-v4-pipeline-row"
                              key={stage.label}
                            >
                              <div className="overview-v4-pipeline-row-top">
                                <span>
                                  <i
                                    className={`overview-v4-pipeline-dot ${stage.tone}`}
                                  />
                                  <strong>{stage.label}</strong>
                                  <small>{stage.note}</small>
                                </span>
                                <b>
                                  <AnimatedNumber value={stage.count} />
                                </b>
                              </div>
                              <div className="overview-v4-pipeline-track">
                                <i
                                  className={`overview-v4-pipeline-fill ${stage.tone}`}
                                  style={{
                                    width: `${percentage}%`,
                                    animationDelay: `${index * 90}ms`,
                                  }}
                                />
                              </div>
                              <span className="overview-v4-pipeline-percent">
                                {percentage}% of portfolio
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </section>

                    <section className="overview-v4-card overview-v4-health-card">
                      <div className="overview-v4-card-head compact">
                        <div>
                          <span>WORKFLOW</span>
                          <h2>Decision health</h2>
                        </div>
                        <span className="overview-v4-live">
                          <i /> Live
                        </span>
                      </div>

                      <div className="overview-v4-health-visual">
                        <div className="overview-v4-donut" style={donutStyle}>
                          <div>
                            <strong>
                              <AnimatedNumber value={totalDecisions} />
                            </strong>
                            <span>Total</span>
                          </div>
                        </div>

                        <div className="overview-v4-status-list">
                          <div>
                            <span>
                              <i className="approved" />
                              Approved
                            </span>
                            <strong>{approvedCount}</strong>
                            <small>{statusPercent(approvedCount)}%</small>
                          </div>
                          <div>
                            <span>
                              <i className="review" />
                              Under review
                            </span>
                            <strong>{reviewCount}</strong>
                            <small>{statusPercent(reviewCount)}%</small>
                          </div>
                          <div>
                            <span>
                              <i className="draft" />
                              Draft
                            </span>
                            <strong>{draftCount}</strong>
                            <small>{statusPercent(draftCount)}%</small>
                          </div>
                          <div>
                            <span>
                              <i className="rejected" />
                              Rejected
                            </span>
                            <strong>{rejectedCount}</strong>
                            <small>{statusPercent(rejectedCount)}%</small>
                          </div>
                        </div>
                      </div>

                      <div className="overview-v4-workflow-strip">
                        <div>
                          <span>01</span>
                          <strong>Capture</strong>
                          <small>{totalDecisions} decisions</small>
                        </div>
                        <div>
                          <span>02</span>
                          <strong>Review</strong>
                          <small>{reviewCount} waiting</small>
                        </div>
                        <div>
                          <span>03</span>
                          <strong>Approve</strong>
                          <small>{approvedCount} complete</small>
                        </div>
                      </div>
                    </section>
                  </section>

                  <section className="overview-v4-grid overview-v4-grid-middle">
                    <section className="overview-v4-card overview-v4-decisions-card">
                      <div className="overview-v4-card-head">
                        <div>
                          <span>DECISION LOG</span>
                          <h2>Recent decisions</h2>
                        </div>
                        <button
                          type="button"
                          onClick={() => handlePageChange("Decisions")}
                        >
                          View all <ChevronRight size={15} />
                        </button>
                      </div>

                      <div className="overview-v4-table-head">
                        <span>Decision</span>
                        <span>Status</span>
                        <span>Team</span>
                        <span>Updated</span>
                        <span />
                      </div>

                      <div className="overview-v4-table">
                        {dashboardDecisions.slice(0, 6).map((decision) => {
                          const Icon = decision.icon;
                          return (
                            <button
                              key={decision.id}
                              type="button"
                              className="overview-v4-table-row"
                              onClick={() => openDecision(decision)}
                            >
                              <span className="overview-v4-table-decision">
                                <span className="overview-v4-table-icon">
                                  <Icon size={16} />
                                </span>
                                <span>
                                  <strong>{decision.name}</strong>
                                  <small>
                                    {decision.problemStatement ||
                                      "Decision record"}
                                  </small>
                                </span>
                              </span>
                              <span
                                className={`status status-${getStatusClass(decision.status)}`}
                              >
                                <span />
                                {decision.status}
                              </span>
                              <span>{decision.team}</span>
                              <span>
                                {decision.relativeCreated || decision.created}
                              </span>
                              <span className="overview-v4-open">
                                <ArrowUpRight size={14} />
                              </span>
                            </button>
                          );
                        })}
                        {!dashboardDecisions.length && (
                          <div className="overview-v4-empty">
                            <FileText size={19} />
                            <strong>No decisions yet</strong>
                            <span>
                              Create your first decision to start building
                              organizational memory.
                            </span>
                          </div>
                        )}
                      </div>
                    </section>

                    <section className="overview-v4-card overview-v4-review-card">
                      <div className="overview-v4-card-head">
                        <div>
                          <span>ATTENTION</span>
                          <h2>Review queue</h2>
                        </div>
                        <button
                          type="button"
                          onClick={() => handlePageChange("Reviews")}
                        >
                          Open queue <ChevronRight size={15} />
                        </button>
                      </div>

                      <div className="overview-v4-review-summary">
                        <div>
                          <AnimatedNumber value={reviewCount} />
                        </div>
                        <div>
                          <strong>
                            {reviewCount
                              ? "Decisions need attention"
                              : "Queue is clear"}
                          </strong>
                          <span>
                            {reviewCount
                              ? "Keep the approval workflow moving."
                              : "No decisions are currently waiting for review."}
                          </span>
                        </div>
                      </div>

                      <div className="overview-v4-review-list">
                        {dashboardDecisions
                          .filter(
                            (decision) => decision.status === "Under Review",
                          )
                          .slice(0, 4)
                          .map((decision) => (
                            <button
                              key={decision.id}
                              type="button"
                              onClick={() => openDecision(decision)}
                            >
                              <i />
                              <span>
                                <strong>{decision.name}</strong>
                                <small>
                                  {decision.team} ·{" "}
                                  {decision.relativeCreated || decision.created}
                                </small>
                              </span>
                              <ChevronRight size={15} />
                            </button>
                          ))}
                        {!reviewCount && (
                          <div className="overview-v4-review-empty">
                            <CheckCircle2 size={18} />
                            <span>All approval stages are clear.</span>
                          </div>
                        )}
                      </div>
                    </section>
                  </section>

                  <section className="overview-v4-grid overview-v4-grid-bottom">
                    <section className="overview-v4-card overview-v4-team-card">
                      <div className="overview-v4-card-head">
                        <div>
                          <span>COLLABORATION</span>
                          <h2>My team</h2>
                        </div>
                        <button
                          type="button"
                          onClick={() => handlePageChange("Teams")}
                        >
                          View all <ChevronRight size={15} />
                        </button>
                      </div>

                      <div className="overview-v4-team-list">
                        {myTeams.slice(0, 3).map((team) => (
                          <button
                            key={team.id}
                            type="button"
                            onClick={() => handlePageChange("Teams")}
                          >
                            <span>{team.name.slice(0, 2).toUpperCase()}</span>
                            <span>
                              <strong>{team.name}</strong>
                              <small>
                                {team._count?.members || 0} members ·{" "}
                                {team._count?.decisions || 0} decisions
                              </small>
                            </span>
                            <ChevronRight size={15} />
                          </button>
                        ))}
                        {!myTeams.length && (
                          <div className="overview-v4-team-empty">
                            <Users size={18} />
                            <span>You are not assigned to a team yet.</span>
                          </div>
                        )}
                      </div>
                    </section>

                    <section className="overview-v4-card overview-v4-signals-card">
                      <div className="overview-v4-card-head">
                        <div>
                          <span>INSIGHTS</span>
                          <h2>Workspace signals</h2>
                        </div>
                        <span className="overview-v4-signal-chip">
                          Live data
                        </span>
                      </div>

                      <div className="overview-v4-signal-list">
                        <div>
                          <span>
                            <Database size={15} /> Evidence assets
                          </span>
                          <strong>{dashboardDocumentCount}</strong>
                          <small>
                            {totalDecisions
                              ? `${(dashboardDocumentCount / totalDecisions).toFixed(1)} per decision`
                              : "—"}
                          </small>
                        </div>
                        <div>
                          <span>
                            <Clock3 size={15} /> Review load
                          </span>
                          <strong>{reviewRate}%</strong>
                          <small>{reviewCount} decisions waiting</small>
                        </div>
                        <div>
                          <span>
                            <Users size={15} /> Active teams
                          </span>
                          <strong>{availableTeams.length}</strong>
                          <small>Connected workspaces</small>
                        </div>
                      </div>
                    </section>
                  </section>

                  <section className="overview-v4-card overview-v4-quick-card">
                    <div className="overview-v4-card-head">
                      <div>
                        <span>SHORTCUTS</span>
                        <h2>Quick actions</h2>
                      </div>
                    </div>
                    <div className="overview-v4-quick-grid">
                      <button type="button" onClick={openCreateDecision}>
                        <span className="overview-v4-quick-icon teal">
                          <Zap size={17} />
                        </span>
                        <span>
                          <strong>Create decision</strong>
                          <small>Start a new decision process</small>
                        </span>
                        <ArrowUpRight size={15} />
                      </button>
                      <button
                        type="button"
                        onClick={() => handlePageChange("Documents")}
                      >
                        <span className="overview-v4-quick-icon blue">
                          <FileText size={17} />
                        </span>
                        <span>
                          <strong>Upload evidence</strong>
                          <small>Add supporting documents</small>
                        </span>
                        <ArrowUpRight size={15} />
                      </button>
                      <button
                        type="button"
                        onClick={() => handlePageChange("Knowledge")}
                      >
                        <span className="overview-v4-quick-icon teal">
                          <GitBranch size={17} />
                        </span>
                        <span>
                          <strong>Explore knowledge</strong>
                          <small>Trace connected decisions</small>
                        </span>
                        <ArrowUpRight size={15} />
                      </button>
                      <button
                        type="button"
                        onClick={() => handlePageChange("Discussions")}
                      >
                        <span className="overview-v4-quick-icon amber">
                          <MessageCircle size={17} />
                        </span>
                        <span>
                          <strong>Start discussion</strong>
                          <small>Collaborate around a decision</small>
                        </span>
                        <ArrowUpRight size={15} />
                      </button>
                    </div>
                  </section>
                </div>
              </section>
            )}
            {showDecisionsPage && (
              <section className="workspace-page">
                <div className="workspace-page-header">
                  <div>
                    <span className="section-label">DECISION WORKSPACE</span>

                    <h1>All decisions</h1>

                    <p>Manage every decision stored in your workspace.</p>
                  </div>

                  <button
                    className="new-decision-button"
                    type="button"
                    onClick={openCreateDecision}
                  >
                    <span>+</span>
                    New decision
                  </button>
                </div>

                <div className="workspace-toolbar">
                  <span>
                    {filteredDecisions.length} result
                    {filteredDecisions.length === 1 ? "" : "s"}
                  </span>

                  {searchQuery && (
                    <button type="button" onClick={() => setSearchQuery("")}>
                      Clear search
                    </button>
                  )}
                </div>

                <div className="workspace-decisions-list">
                  {loading ? (
                    <div className="empty-search-state">
                      <Clock3 size={18} />

                      <strong>Loading decisions</strong>

                      <span>Fetching your workspace data.</span>
                    </div>
                  ) : error ? (
                    <div className="empty-search-state">
                      <X size={18} />

                      <strong>Unable to load decisions</strong>

                      <span>{error}</span>

                      <button type="button" onClick={fetchDecisions}>
                        Try again
                      </button>
                    </div>
                  ) : filteredDecisions.length > 0 ? (
                    filteredDecisions.map((decision) => {
                      const Icon = decision.icon;

                      const statusClass = getStatusClass(decision.status);

                      return (
                        <div
                          className="workspace-decision-card"
                          key={decision.id}
                        >
                          <div className="decision-left">
                            <div className="decision-icon">
                              <Icon size={17} />
                            </div>

                            <div className="decision-info">
                              <strong>{decision.name}</strong>

                              <span>{decision.problemStatement}</span>
                              <small>
                                Created by{" "}
                                {decision.createdBy?.name || "Workspace member"}
                              </small>
                            </div>
                          </div>

                          <span className={`status status-${statusClass}`}>
                            <span />
                            {decision.status}
                          </span>

                          <span className="decision-date">
                            {decision.created}
                          </span>

                          <div className="decision-actions">
                            <button
                              className="decision-view-button"
                              type="button"
                              onClick={() => openDecision(decision)}
                            >
                              View
                            </button>

                            {canManageDecision(decision) && (
                              <button
                                className="decision-more"
                                type="button"
                                onClick={() => openEditDecision(decision)}
                                aria-label={`Edit ${decision.name}`}
                              >
                                <MoreHorizontal size={16} />
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="empty-search-state">
                      <Search size={18} />

                      <strong>No decisions found</strong>

                      <span>Create a new decision or adjust your search.</span>

                      <button type="button" onClick={openCreateDecision}>
                        Create decision
                      </button>
                    </div>
                  )}
                </div>
              </section>
            )}

            {!showOverview &&
              !showDecisionsPage &&
              activePage === "Reviews" && (
                <ReviewsPage
                  apiRequest={apiRequest}
                  decisions={decisions}
                  openDecision={openDecision}
                  currentUser={currentUser}
                  globalSearch={searchQuery}
                  onApprovalChange={async () => {
                    await fetchDecisions();
                    await fetchNotifications();
                  }}
                />
              )}

            {!showOverview &&
              !showDecisionsPage &&
              activePage === "Knowledge" && (
                <KnowledgePage
                  apiRequest={apiRequest}
                  openDecision={openDecision}
                  openTeam={openTeamFromKnowledge}
                  globalSearch={searchQuery}
                />
              )}

            {!showOverview && !showDecisionsPage && activePage === "Teams" && (
              <TeamsPage
                apiRequest={apiRequest}
                currentUser={currentUser}
                initialTeamId={teamToOpenId}
              />
            )}

            {!showOverview &&
              !showDecisionsPage &&
              activePage === "Discussions" && (
                <DiscussionsPage apiRequest={apiRequest} />
              )}

            {!showOverview &&
              !showDecisionsPage &&
              activePage === "Documents" && (
                <DocumentsPage apiRequest={apiRequest} />
              )}

            {!showOverview &&
              !showDecisionsPage &&
              activePage === "Analytics" && (
                <AnalyticsPage apiRequest={apiRequest} />
              )}

            {!showOverview &&
              !showDecisionsPage &&
              activePage === "Reports" && (
                <ReportsPage apiRequest={apiRequest} />
              )}

            {!showOverview && !showDecisionsPage && activePage === "Users" && (
              <UsersPage apiRequest={apiRequest} />
            )}

            {!showOverview &&
              !showDecisionsPage &&
              activePage === "Audit & Compliance" && (
                <AuditPage apiRequest={apiRequest} />
              )}

            {!showOverview &&
              !showDecisionsPage &&
              activePage === "Settings" && (
                <SettingsPage
                  currentUser={currentUser}
                  apiRequest={apiRequest}
                  onUserUpdated={setCurrentUser}
                />
              )}
          </WorkspacePageTransition>
        </div>

        <CustomScrollbar scrollRef={dashboardContentRef} pageKey={activePage} />
      </main>

      {modal &&
        createPortal(
          <div
            className="dashboard-modal-backdrop"
            onClick={() => setModal(null)}
          >
            <div
              ref={modalRef}
              className="dashboard-modal"
              onClick={(event) => event.stopPropagation()}
            >
              <button
                className="dashboard-modal-close"
                type="button"
                onClick={() => setModal(null)}
                aria-label="Close"
              >
                <X size={17} />
              </button>

              {modal.type === "create-decision" && (
                <>
                  <span className="modal-eyebrow">DECISION WORKSPACE</span>

                  <h2>Create a new decision</h2>

                  <p>Capture the problem before deciding on the solution.</p>

                  <form
                    className="decision-create-form"
                    onSubmit={handleCreateDecision}
                  >
                    <div className="form-group">
                      <label htmlFor="decision-title">Decision title</label>

                      <input
                        id="decision-title"
                        type="text"
                        placeholder="e.g. Choose database for DecisionVault"
                        value={decisionForm.title}
                        onChange={(event) =>
                          setDecisionForm({
                            ...decisionForm,
                            title: event.target.value,
                          })
                        }
                      />
                    </div>

                    <div className="form-group">
                      <label htmlFor="decision-problem">
                        Problem statement
                      </label>

                      <textarea
                        id="decision-problem"
                        rows="5"
                        placeholder="Describe the problem this decision needs to solve..."
                        value={decisionForm.problemStatement}
                        onChange={(event) =>
                          setDecisionForm({
                            ...decisionForm,
                            problemStatement: event.target.value,
                          })
                        }
                      />
                    </div>

                    <div className="form-group">
                      <label htmlFor="decision-team">Team workspace</label>
                      <select
                        id="decision-team"
                        value={decisionForm.teamId}
                        onChange={(event) =>
                          setDecisionForm({
                            ...decisionForm,
                            teamId: event.target.value,
                          })
                        }
                      >
                        <option value="">No team assigned</option>
                        {availableTeams.map((team) => (
                          <option key={team.id} value={team.id}>
                            {team.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="modal-actions">
                      <button
                        className="modal-secondary"
                        type="button"
                        onClick={() => setModal(null)}
                      >
                        Cancel
                      </button>

                      <button
                        className="modal-primary"
                        type="submit"
                        disabled={creatingDecision}
                      >
                        {creatingDecision ? "Creating..." : "Create decision"}

                        <ArrowUpRight size={14} />
                      </button>
                    </div>
                  </form>
                </>
              )}

              {modal.type === "edit-decision" && (
                <>
                  <span className="modal-eyebrow">EDIT DECISION</span>

                  <h2>Edit decision</h2>

                  <p>Update the decision information and current status.</p>

                  <form
                    className="decision-create-form"
                    onSubmit={handleUpdateDecision}
                  >
                    <div className="form-group">
                      <label htmlFor="edit-decision-title">
                        Decision title
                      </label>

                      <input
                        id="edit-decision-title"
                        type="text"
                        value={decisionForm.title}
                        onChange={(event) =>
                          setDecisionForm({
                            ...decisionForm,
                            title: event.target.value,
                          })
                        }
                      />
                    </div>

                    <div className="form-group">
                      <label htmlFor="edit-decision-problem">
                        Problem statement
                      </label>

                      <textarea
                        id="edit-decision-problem"
                        rows="5"
                        value={decisionForm.problemStatement}
                        onChange={(event) =>
                          setDecisionForm({
                            ...decisionForm,
                            problemStatement: event.target.value,
                          })
                        }
                      />
                    </div>

                    <div className="form-group">
                      <label htmlFor="edit-decision-team">Team workspace</label>
                      <select
                        id="edit-decision-team"
                        value={decisionForm.teamId}
                        onChange={(event) =>
                          setDecisionForm({
                            ...decisionForm,
                            teamId: event.target.value,
                          })
                        }
                      >
                        <option value="">No team assigned</option>
                        {availableTeams.map((team) => (
                          <option key={team.id} value={team.id}>
                            {team.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="form-group">
                      <label htmlFor="decision-status">Status</label>

                      <select
                        id="decision-status"
                        value={decisionForm.status}
                        onChange={(event) =>
                          setDecisionForm({
                            ...decisionForm,
                            status: event.target.value,
                          })
                        }
                      >
                        <option value="Draft">Draft</option>

                        <option value="Under Review">Under Review</option>

                        <option value="Approved">Approved</option>

                        <option value="Rejected">Rejected</option>

                        <option value="Archived">Archived</option>
                      </select>
                    </div>

                    <div className="modal-actions">
                      <button
                        className="modal-secondary"
                        type="button"
                        onClick={() => setModal(null)}
                      >
                        Cancel
                      </button>

                      <button
                        className="modal-primary"
                        type="submit"
                        disabled={savingDecision}
                      >
                        {savingDecision ? "Saving..." : "Save changes"}

                        <ArrowUpRight size={14} />
                      </button>
                    </div>
                  </form>
                </>
              )}

              {modal.type === "view-decision" && selectedDecision && (
                <>
                  <div className="decision-modal-hero">
                    <div className="decision-modal-heading">
                      <span className="modal-eyebrow">
                        {displayStatus(selectedDecision.status).toUpperCase()}
                      </span>
                      <h2>{selectedDecision.title}</h2>
                      <p className="decision-detail-copy">
                        {selectedDecision.problemStatement}
                      </p>

                      <div className="decision-modal-meta-line">
                        <span>
                          Created{" "}
                          {formatDecisionDate(selectedDecision.createdAt)}
                        </span>
                        <span>•</span>
                        <span>
                          {selectedDecision.createdBy?.name ||
                            currentUser?.name ||
                            "You"}
                        </span>
                        <span
                          className={`status status-${getStatusClass(displayStatus(selectedDecision.status))}`}
                        >
                          <span />
                          {displayStatus(selectedDecision.status)}
                        </span>
                      </div>
                    </div>

                    <div className="decision-modal-top-actions">
                      {canManageSelectedDecision && (
                        <>
                          <button
                            className="modal-secondary"
                            type="button"
                            onClick={() => openEditDecision(selectedDecision)}
                          >
                            Edit
                          </button>
                          <button
                            className="modal-danger"
                            type="button"
                            onClick={() =>
                              handleDeleteDecision(selectedDecision)
                            }
                            disabled={deletingDecision}
                          >
                            {deletingDecision ? "Deleting..." : "Delete"}
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="decision-summary-strip">
                    <div>
                      <span>Alternatives</span>
                      <strong>
                        {(selectedDecision.alternatives || []).length}
                      </strong>
                    </div>
                    <div>
                      <span>Documents</span>
                      <strong>
                        {(selectedDecision.documents || []).length}
                      </strong>
                    </div>
                    <div>
                      <span>Discussion</span>
                      <strong>
                        {(selectedDecision.discussions || []).length}
                      </strong>
                    </div>
                    <div>
                      <span>Approvals</span>
                      <strong>
                        {(selectedDecision.approvals || []).length}
                      </strong>
                    </div>
                  </div>

                  <div
                    className="decision-tabs"
                    role="tablist"
                    aria-label="Decision details"
                  >
                    {[
                      ["overview", "Overview", LayoutDashboard],
                      ["alternatives", "Alternatives", Database],
                      ["documents", "Documents", FileText],
                      ["discussion", "Discussion", MessageCircle],
                      ["approvals", "Approvals", ShieldCheck],
                      ["history", "History", GitBranch],
                    ].map(([value, label, Icon]) => (
                      <button
                        key={value}
                        className={
                          decisionTab === value
                            ? "decision-tab active"
                            : "decision-tab"
                        }
                        type="button"
                        role="tab"
                        aria-selected={decisionTab === value}
                        onClick={() => setDecisionTab(value)}
                      >
                        <Icon size={15} />
                        <span>{label}</span>
                      </button>
                    ))}
                  </div>

                  <div className="decision-tab-panel" key={decisionTab}>
                    {decisionTab === "overview" && (
                      <div className="decision-tab-content decision-tab-content-overview">
                        <div className="tab-scroll-area overview-scroll-area">
                          <div className="decision-overview-panel">
                            <div className="decision-overview-card">
                              <div className="panel-kicker">
                                DECISION DETAILS
                              </div>
                              <h3>Why this decision exists</h3>
                              <p>
                                {selectedDecision.problemStatement ||
                                  "No problem statement has been added yet."}
                              </p>

                              <div className="overview-detail-list">
                                <div>
                                  <span>Created on</span>
                                  <strong>
                                    {formatDecisionDate(
                                      selectedDecision.createdAt,
                                    )}
                                  </strong>
                                </div>
                                <div>
                                  <span>Created by</span>
                                  <strong>
                                    {selectedDecision.createdBy?.name ||
                                      currentUser?.name ||
                                      "You"}
                                  </strong>
                                </div>
                                <div>
                                  <span>Status</span>
                                  <strong>
                                    {displayStatus(selectedDecision.status)}
                                  </strong>
                                </div>
                              </div>
                            </div>

                            <div className="decision-overview-card">
                              <div className="panel-kicker">QUICK ACTIONS</div>
                              <h3>Keep building the decision</h3>

                              <div className="quick-action-grid">
                                <button
                                  type="button"
                                  onClick={() => setDecisionTab("alternatives")}
                                >
                                  <span className="quick-action-icon">
                                    <Database size={16} />
                                  </span>
                                  <span>
                                    <strong>Add alternative</strong>
                                    <small>Compare more options</small>
                                  </span>
                                  <ChevronRight size={15} />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setDecisionTab("documents")}
                                >
                                  <span className="quick-action-icon">
                                    <FileText size={16} />
                                  </span>
                                  <span>
                                    <strong>Upload document</strong>
                                    <small>Add supporting evidence</small>
                                  </span>
                                  <ChevronRight size={15} />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setDecisionTab("discussion")}
                                >
                                  <span className="quick-action-icon">
                                    <MessageCircle size={16} />
                                  </span>
                                  <span>
                                    <strong>Start discussion</strong>
                                    <small>Capture team reasoning</small>
                                  </span>
                                  <ChevronRight size={15} />
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {decisionTab === "alternatives" && (
                      <div className="decision-tab-content">
                        <div className="tab-content-header">
                          <div>
                            <div className="panel-kicker">
                              ALTERNATIVE ANALYSIS
                            </div>
                            <h3>Compare the available options</h3>
                          </div>
                          <span className="count-pill">
                            {(selectedDecision.alternatives || []).length}
                          </span>
                        </div>

                        {canManageSelectedDecision && (
                          <form
                            className="alternative-form"
                            onSubmit={handleSaveAlternative}
                          >
                            <input
                              type="text"
                              placeholder="Alternative name"
                              value={alternativeForm.name}
                              onChange={(event) =>
                                setAlternativeForm({
                                  ...alternativeForm,
                                  name: event.target.value,
                                })
                              }
                            />
                            <input
                              type="text"
                              placeholder="Pros"
                              value={alternativeForm.pros}
                              onChange={(event) =>
                                setAlternativeForm({
                                  ...alternativeForm,
                                  pros: event.target.value,
                                })
                              }
                            />
                            <input
                              type="text"
                              placeholder="Cons"
                              value={alternativeForm.cons}
                              onChange={(event) =>
                                setAlternativeForm({
                                  ...alternativeForm,
                                  cons: event.target.value,
                                })
                              }
                            />
                            <input
                              type="text"
                              placeholder="Cost"
                              value={alternativeForm.cost}
                              onChange={(event) =>
                                setAlternativeForm({
                                  ...alternativeForm,
                                  cost: event.target.value,
                                })
                              }
                            />
                            <input
                              type="text"
                              placeholder="Feasibility"
                              value={alternativeForm.feasibility}
                              onChange={(event) =>
                                setAlternativeForm({
                                  ...alternativeForm,
                                  feasibility: event.target.value,
                                })
                              }
                            />
                            <input
                              type="text"
                              placeholder="Risk"
                              value={alternativeForm.risk}
                              onChange={(event) =>
                                setAlternativeForm({
                                  ...alternativeForm,
                                  risk: event.target.value,
                                })
                              }
                            />
                            <div className="modal-actions">
                              <button
                                className="modal-primary"
                                type="submit"
                                disabled={savingAlternative}
                              >
                                {savingAlternative
                                  ? "Saving..."
                                  : editingAlternative
                                    ? "Update alternative"
                                    : "Add alternative"}
                                <ArrowUpRight size={14} />
                              </button>
                              {editingAlternative && (
                                <button
                                  className="modal-secondary"
                                  type="button"
                                  onClick={() => {
                                    setEditingAlternative(null);
                                    setAlternativeForm(EMPTY_ALTERNATIVE_FORM);
                                  }}
                                >
                                  Cancel edit
                                </button>
                              )}
                            </div>
                          </form>
                        )}

                        <div className="tab-scroll-area alternatives-scroll-area">
                          {(selectedDecision.alternatives || []).length > 0 ? (
                            (selectedDecision.alternatives || []).map(
                              (alternative) => (
                                <div
                                  className="alternative-card"
                                  key={alternative.id}
                                >
                                  <div className="alternative-card-header">
                                    <div>
                                      <strong>{alternative.name}</strong>
                                      <span>Option</span>
                                    </div>
                                    {canManageSelectedDecision && (
                                      <div className="alternative-actions">
                                        <button
                                          type="button"
                                          onClick={() =>
                                            handleEditAlternative(alternative)
                                          }
                                        >
                                          Edit
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() =>
                                            handleDeleteAlternative(alternative)
                                          }
                                          disabled={
                                            deletingAlternativeId ===
                                            alternative.id
                                          }
                                        >
                                          {deletingAlternativeId ===
                                          alternative.id
                                            ? "Deleting..."
                                            : "Delete"}
                                        </button>
                                      </div>
                                    )}
                                  </div>
                                  <div className="alternative-grid">
                                    <div>
                                      <span>Pros</span>
                                      <strong>{alternative.pros || "—"}</strong>
                                    </div>
                                    <div>
                                      <span>Cons</span>
                                      <strong>{alternative.cons || "—"}</strong>
                                    </div>
                                    <div>
                                      <span>Cost</span>
                                      <strong>{alternative.cost || "—"}</strong>
                                    </div>
                                    <div>
                                      <span>Feasibility</span>
                                      <strong>
                                        {alternative.feasibility || "—"}
                                      </strong>
                                    </div>
                                    <div>
                                      <span>Risk</span>
                                      <strong>{alternative.risk || "—"}</strong>
                                    </div>
                                  </div>
                                  <button
                                    className="alternative-view-more"
                                    type="button"
                                    onClick={() => {
                                      setSelectedAlternative(alternative);
                                      setModal({ type: "view-alternative" });
                                    }}
                                  >
                                    View more
                                    <ChevronRight size={14} />
                                  </button>
                                </div>
                              ),
                            )
                          ) : (
                            <div className="empty-module-state">
                              <Database size={18} />
                              <strong>No alternatives yet</strong>
                              <span>
                                Add options here to compare them without
                                expanding the whole decision view.
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {decisionTab === "documents" && (
                      <div className="decision-tab-content">
                        <div className="tab-content-header">
                          <div>
                            <div className="panel-kicker">DOCUMENTS</div>
                            <h3>Supporting files</h3>
                          </div>
                          <span className="count-pill">
                            {(selectedDecision.documents || []).length}
                          </span>
                        </div>

                        {canManageSelectedDecision && (
                          <div className="document-upload-panel">
                            <label
                              className="file-picker"
                              htmlFor="decision-document-upload"
                            >
                              <input
                                id="decision-document-upload"
                                type="file"
                                onChange={(event) =>
                                  setSelectedFile(
                                    event.target.files?.[0] || null,
                                  )
                                }
                              />
                              <span className="file-picker-icon">
                                <FileText size={17} />
                              </span>
                              <span className="file-picker-copy">
                                <strong>
                                  {selectedFile
                                    ? selectedFile.name
                                    : "Choose a supporting file"}
                                </strong>
                                <small>
                                  PDF, DOCX, PPTX, XLSX or other project files
                                </small>
                              </span>
                            </label>
                            <div className="document-upload-fields">
                              <select
                                value={documentCategory}
                                onChange={(event) =>
                                  setDocumentCategory(event.target.value)
                                }
                              >
                                <option>General</option>
                                <option>Research</option>
                                <option>Evaluation</option>
                                <option>Requirements</option>
                                <option>Architecture</option>
                                <option>Security</option>
                                <option>Compliance</option>
                                <option>Planning</option>
                                <option>Deployment</option>
                              </select>
                              <input
                                value={documentTags}
                                onChange={(event) =>
                                  setDocumentTags(event.target.value)
                                }
                                placeholder="Tags: AI, research, architecture"
                              />
                            </div>
                            <button
                              className="modal-primary"
                              type="button"
                              onClick={handleUploadDocument}
                              disabled={!selectedFile || uploadingDocument}
                            >
                              {uploadingDocument
                                ? "Uploading..."
                                : "Upload document"}
                              <ArrowUpRight size={14} />
                            </button>
                          </div>
                        )}

                        <div className="tab-scroll-area documents-scroll-area">
                          {(selectedDecision.documents || []).length > 0 ? (
                            (selectedDecision.documents || []).map(
                              (document) => (
                                <div
                                  className="document-card"
                                  key={document.id}
                                >
                                  <span className="document-card-icon">
                                    <FileText size={17} />
                                  </span>
                                  <div className="document-card-main">
                                    <strong title={document.filename}>
                                      {document.filename}
                                    </strong>
                                    <span>
                                      Supporting document · Uploaded{" "}
                                      {formatDecisionDate(document.createdAt)}
                                    </span>
                                  </div>
                                  <div className="document-card-actions">
                                    <span className="document-status">
                                      Stored
                                    </span>
                                    <button
                                      className="document-open-button"
                                      type="button"
                                      onClick={() =>
                                        handleOpenDocument(document)
                                      }
                                    >
                                      Open
                                      <ArrowUpRight size={13} />
                                    </button>
                                  </div>
                                </div>
                              ),
                            )
                          ) : (
                            <div className="empty-module-state">
                              <FileText size={18} />
                              <strong>No documents yet</strong>
                              <span>
                                Attach supporting files to this decision.
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {decisionTab === "history" && (
                      <div className="decision-tab-content">
                        <div className="tab-content-header">
                          <div>
                            <div className="panel-kicker">VERSION HISTORY</div>
                            <h3>Decision changes</h3>
                          </div>
                          <span className="count-pill">
                            {(selectedDecision.versions || []).length}
                          </span>
                        </div>
                        <div className="version-history-list">
                          {(selectedDecision.versions || []).length ? (
                            (selectedDecision.versions || []).map((version) => (
                              <article
                                className="version-history-card"
                                key={version.id}
                              >
                                <div className="version-history-number">
                                  v{version.version}
                                </div>
                                <div className="version-history-copy">
                                  <strong>{version.title}</strong>
                                  <span>
                                    {version.changedBy?.name ||
                                      "Workspace member"}{" "}
                                    · {formatDecisionDate(version.createdAt)}
                                  </span>
                                  <small>
                                    {displayStatus(version.status)} ·{" "}
                                    {version.problemStatement}
                                  </small>
                                </div>
                              </article>
                            ))
                          ) : (
                            <div className="empty-module-state">
                              <GitBranch size={18} />
                              <strong>No version history yet</strong>
                              <span>
                                Changes to the decision will be recorded here.
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {decisionTab === "approvals" && (
                      <ApprovalPanel
                        apiRequest={apiRequest}
                        selectedDecision={selectedDecision}
                        currentUser={currentUser}
                        users={availableUsers}
                        onDecisionRefresh={async () => {
                          if (!selectedDecision?.id) return;
                          const refreshed = await apiRequest(
                            `/api/decisions/${selectedDecision.id}`,
                          );
                          setSelectedDecision(
                            refreshed?.decision || selectedDecision,
                          );
                          await fetchDecisions();
                          await fetchNotifications();
                        }}
                      />
                    )}

                    {decisionTab === "discussion" && (
                      <div className="decision-tab-content">
                        <div className="tab-content-header">
                          <div>
                            <div className="panel-kicker">DISCUSSIONS</div>
                            <h3>Decision conversation</h3>
                          </div>
                          <span className="count-pill">
                            {(selectedDecision.discussions || []).length}
                          </span>
                        </div>

                        <form
                          className="discussion-compose"
                          onSubmit={handleSaveDiscussion}
                        >
                          <div className="discussion-compose-head">
                            <div className="discussion-field">
                              <span className="discussion-field-label">
                                TYPE
                              </span>
                              <select
                                value={discussionForm.type}
                                onChange={(event) =>
                                  setDiscussionForm({
                                    ...discussionForm,
                                    type: event.target.value,
                                  })
                                }
                              >
                                <option value="Comment">Comment</option>
                                <option value="MeetingNote">
                                  Meeting note
                                </option>
                                <option value="Rationale">
                                  Decision rationale
                                </option>
                              </select>
                            </div>
                            <div className="discussion-field">
                              <span className="discussion-field-label">
                                THREAD
                              </span>
                              <select
                                value={discussionForm.parentId}
                                onChange={(event) =>
                                  setDiscussionForm({
                                    ...discussionForm,
                                    parentId: event.target.value,
                                  })
                                }
                              >
                                <option value="">New thread</option>
                                {(selectedDecision.discussions || []).map(
                                  (discussion) => (
                                    <option
                                      key={discussion.id}
                                      value={discussion.id}
                                    >
                                      Reply to #{discussion.id}
                                    </option>
                                  ),
                                )}
                              </select>
                            </div>
                          </div>
                          <textarea
                            className="discussion-composer-input"
                            rows="4"
                            placeholder="Share a comment, capture a meeting note, or record the reasoning behind this decision..."
                            value={discussionForm.content}
                            onChange={(event) =>
                              setDiscussionForm({
                                ...discussionForm,
                                content: event.target.value,
                              })
                            }
                          />
                          <div className="discussion-compose-footer">
                            <div className="discussion-compose-hint">
                              <MessageCircle size={14} />
                              <span>
                                {discussionForm.parentId
                                  ? `Replying to discussion #${discussionForm.parentId}`
                                  : "Start a new conversation thread"}
                              </span>
                            </div>
                            <div className="modal-actions">
                              {editingDiscussion && (
                                <button
                                  className="modal-secondary"
                                  type="button"
                                  onClick={() => {
                                    setEditingDiscussion(null);
                                    setDiscussionForm({
                                      type: "Comment",
                                      content: "",
                                      parentId: "",
                                    });
                                  }}
                                >
                                  Cancel edit
                                </button>
                              )}
                              <button
                                className="modal-primary"
                                type="submit"
                                disabled={savingDiscussion}
                              >
                                {savingDiscussion
                                  ? "Saving..."
                                  : editingDiscussion
                                    ? "Update discussion"
                                    : "Post to discussion"}
                                <ArrowUpRight size={14} />
                              </button>
                            </div>
                          </div>
                        </form>

                        <div className="tab-scroll-area discussion-scroll-area">
                          {(selectedDecision.discussions || []).length > 0 ? (
                            (selectedDecision.discussions || []).map(
                              (discussion) => {
                                const discussionType =
                                  discussion.type === "MeetingNote"
                                    ? "Meeting note"
                                    : discussion.type === "Rationale"
                                      ? "Decision rationale"
                                      : "Comment";
                                const authorName =
                                  discussion.createdBy?.name ||
                                  "Workspace member";
                                return (
                                  <article
                                    className={`discussion-card ${discussion.parentId ? "discussion-reply" : ""}`}
                                    key={discussion.id}
                                  >
                                    <div className="discussion-card-header">
                                      <div className="discussion-author">
                                        <div className="discussion-avatar">
                                          {authorName.charAt(0).toUpperCase()}
                                        </div>
                                        <div className="discussion-author-copy">
                                          <div className="discussion-author-line">
                                            <strong>{authorName}</strong>
                                            <span className="discussion-type-badge">
                                              {discussionType}
                                            </span>
                                          </div>
                                          <span>
                                            {formatRelativeTime(
                                              discussion.createdAt,
                                            )}{" "}
                                            · #{discussion.id}
                                          </span>
                                        </div>
                                      </div>
                                      <div className="discussion-actions">
                                        <button
                                          type="button"
                                          onClick={() =>
                                            setDiscussionForm({
                                              type: "Comment",
                                              content: "",
                                              parentId: String(discussion.id),
                                            })
                                          }
                                        >
                                          Reply
                                        </button>
                                        {Number(
                                          discussion.createdById ||
                                            discussion.createdBy?.id,
                                        ) === Number(currentUser?.id) ||
                                        canManageSelectedDecision ? (
                                          <>
                                            <button
                                              type="button"
                                              onClick={() =>
                                                handleEditDiscussion(discussion)
                                              }
                                            >
                                              Edit
                                            </button>
                                            <button
                                              type="button"
                                              onClick={() =>
                                                handleDeleteDiscussion(
                                                  discussion,
                                                )
                                              }
                                              disabled={
                                                deletingDiscussionId ===
                                                discussion.id
                                              }
                                            >
                                              {deletingDiscussionId ===
                                              discussion.id
                                                ? "Deleting..."
                                                : "Delete"}
                                            </button>
                                          </>
                                        ) : null}
                                      </div>
                                    </div>
                                    {discussion.parentId && (
                                      <div className="discussion-thread-label">
                                        Replying to discussion #
                                        {discussion.parentId}
                                      </div>
                                    )}
                                    <div className="discussion-content">
                                      {discussion.content}
                                    </div>
                                    {(discussion.attachments || []).length >
                                      0 && (
                                      <div className="discussion-attachments">
                                        <span className="discussion-sub-label">
                                          Supporting files
                                        </span>
                                        <div className="discussion-attachment-list">
                                          {(discussion.attachments || []).map(
                                            (attachment) => (
                                              <span
                                                className="discussion-attachment-chip"
                                                key={attachment.id}
                                              >
                                                <FileText size={13} />
                                                {attachment.filename}
                                              </span>
                                            ),
                                          )}
                                        </div>
                                      </div>
                                    )}
                                    <div className="discussion-attachment-row">
                                      <label
                                        className="discussion-file-picker"
                                        htmlFor={`discussion-file-${discussion.id}`}
                                      >
                                        <input
                                          id={`discussion-file-${discussion.id}`}
                                          type="file"
                                          onChange={(event) =>
                                            setSelectedDiscussionFile(
                                              event.target.files?.[0] || null,
                                            )
                                          }
                                        />
                                        <FileText size={14} />
                                        <span>
                                          {selectedDiscussionFile
                                            ? selectedDiscussionFile.name
                                            : "Attach supporting file"}
                                        </span>
                                      </label>
                                      <button
                                        className="modal-secondary"
                                        type="button"
                                        onClick={() =>
                                          handleUploadDiscussionAttachment(
                                            discussion,
                                          )
                                        }
                                        disabled={
                                          !selectedDiscussionFile ||
                                          uploadingDiscussionFile
                                        }
                                      >
                                        {uploadingDiscussionFile
                                          ? "Uploading..."
                                          : "Attach file"}
                                      </button>
                                    </div>
                                  </article>
                                );
                              },
                            )
                          ) : (
                            <div className="empty-module-state">
                              <MessageCircle size={18} />
                              <strong>No discussions yet</strong>
                              <span>
                                Start the first conversation around this
                                decision.
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="modal-actions decision-detail-actions">
                    <button
                      className="modal-secondary"
                      type="button"
                      onClick={() => setModal(null)}
                    >
                      Close
                    </button>
                  </div>
                </>
              )}

              {modal.type === "view-alternative" && selectedAlternative && (
                <>
                  <div className="alternative-detail-modal-content">
                    <div className="alternative-detail-topline">
                      <div>
                        <span className="modal-eyebrow">
                          ALTERNATIVE DETAIL
                        </span>
                        <h2>{selectedAlternative.name}</h2>
                        <p>Full comparison details for this option.</p>
                      </div>
                      <span className="count-pill">OPTION</span>
                    </div>

                    <div className="alternative-detail-grid">
                      <section>
                        <span>Pros</span>
                        <p>{selectedAlternative.pros || "No pros recorded."}</p>
                      </section>
                      <section>
                        <span>Cons</span>
                        <p>{selectedAlternative.cons || "No cons recorded."}</p>
                      </section>
                      <section>
                        <span>Cost</span>
                        <p>
                          {selectedAlternative.cost ||
                            "No cost information recorded."}
                        </p>
                      </section>
                      <section>
                        <span>Feasibility</span>
                        <p>
                          {selectedAlternative.feasibility ||
                            "No feasibility assessment recorded."}
                        </p>
                      </section>
                      <section>
                        <span>Risk</span>
                        <p>
                          {selectedAlternative.risk ||
                            "No risk assessment recorded."}
                        </p>
                      </section>
                    </div>
                  </div>

                  <div className="modal-actions decision-detail-actions alternative-detail-actions">
                    <button
                      className="modal-secondary"
                      type="button"
                      onClick={() => {
                        setSelectedAlternative(null);
                        setModal({ type: "view-decision" });
                        setDecisionTab("alternatives");
                      }}
                    >
                      Back to alternatives
                    </button>
                  </div>
                </>
              )}

              {modal.type === "info" && (
                <>
                  <span className="modal-eyebrow">WORKSPACE</span>

                  <h2>{modal.title}</h2>

                  <p>{modal.body}</p>

                  <div className="modal-actions">
                    <button
                      className="modal-primary"
                      type="button"
                      onClick={() => setModal(null)}
                    >
                      Close
                      <ArrowUpRight size={14} />
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}

export default Dashboard;
