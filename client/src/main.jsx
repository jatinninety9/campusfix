import React, { useEffect, useRef, useState, lazy, Suspense } from "react";
import PhotoAttachments from "./PhotoAttachments.jsx";
import { createRoot } from "react-dom/client";
import {
  ArrowUpRight,
  ArrowRight,
  LayoutDashboard,
  ClipboardList,
  Plus,
  Search,
  MapPin,
  Clock,
  CheckCircle2,
  LogOut,
  ChevronRight,
  ShieldCheck,
  Wrench,
  Users,
  ThumbsUp,
  X,
  Activity,
  AlertCircle,
  Building2,
  UserRound,
  Check,
  RefreshCw,
} from "lucide-react";
const CategoryChart = lazy(() => import("./CategoryChart.jsx"));
import "./styles.css";
import StaffManager from "./StaffManager.jsx";
import RoleWorkspace, { roleCopy } from "./RoleWorkspace.jsx";
import CampusScene from "./CampusScene.jsx";

async function api(path, options = {}) {
  let response;
  try {
    const method = (options.method || "GET").toUpperCase();
    let csrfHeaders = {};
    if (!["GET", "HEAD", "OPTIONS"].includes(method)) {
      const tokenResponse = await fetch("/api/auth/csrf", {
        credentials: "same-origin",
        cache: "no-store",
      });
      const token = await tokenResponse.json();
      if (!tokenResponse.ok || typeof token.csrfToken !== "string")
        throw new Error("Cannot obtain a security token.");
      csrfHeaders = { "X-CSRF-Token": token.csrfToken };
    }
    response = await fetch(`/api${path}`, {
      ...options,
      headers: {
        ...(options.body instanceof FormData ? {} : { "Content-Type": "application/json" }),
        ...options.headers,
        ...csrfHeaders,
      },
      credentials: "same-origin",
    });
  } catch {
    throw new Error(
      "Cannot reach CampusFix. Check your connection and try again.",
    );
  }
  const data = await response.json();
  if (!response.ok) {
    if (response.status === 401 && !path.includes("/auth/"))
      window.dispatchEvent(new Event("session-expired"));
    throw new Error(data.error || "Request failed.");
  }
  return data;
}
const statusLabel = {
  open: "Open",
  in_progress: "In progress",
  resolved: "Resolved",
  closed: "Closed",
};
const categoryColor = {
  "IT & Network": "#55bfa3",
  Electrical: "#f0b86a",
  Plumbing: "#83a9e0",
  Facilities: "#b7a0dc",
};
const Icon = ({ as: Component, ...props }) => (
  <Component size={18} aria-hidden="true" {...props} />
);
function Brand() {
  return (
    <div className="brand">
      <span className="brand-mark">
        <Wrench size={23} aria-hidden="true" />
      </span>
      <span>
        campus<span className="brand-fix">fix</span>
        <small>CAMPUS CARE, CONNECTED</small>
      </span>
    </div>
  );
}
function Field({ label, children }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  );
}
function Badge({ status }) {
  return (
    <span className={`badge ${status}`}>
      <span />
      {statusLabel[status]}
    </span>
  );
}
function Auth({ onLogin }) {
  const [register, setRegister] = useState(false),
    [portal, setPortal] = useState("student"),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const portalName = { student: "Student", staff: "Staff", admin: "Admin" }[portal];
  async function submit(e) {
    e.preventDefault();
    setError("");
    setBusy(true);
    const values = Object.fromEntries(new FormData(e.currentTarget));
    try {
      onLogin(
        (
          await api(`/auth/${register ? "register" : "login"}`, {
            method: "POST",
            body: JSON.stringify(register ? values : { ...values, role: portal }),
          })
        ).user,
      );
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="auth-page">
      <section className="auth-story">
        <Brand />
        <div className="story-copy">
          <div className="eyebrow">
            <span className="dot" /> A LITTLE CARE. A BETTER CAMPUS.
          </div>
          <h1>
            Small issues.
            <br />
            Real <em>change.</em>
          </h1>
          <p>
            A flickering light. A broken desk. A connection that drops. Help
            your campus get better, one fix at a time.
          </p>
          <div className="story-steps">
            <span>
              <CheckCircle2 size={18} /> Report in minutes
            </span>
            <span>
              <Activity size={18} /> Follow every update
            </span>
            <span>
              <Users size={18} /> Make a difference together
            </span>
          </div>
        </div>
        <div className="story-footer">
          <Building2 size={16} /> Built for the people who make a campus.
        </div>
        <CampusScene className="auth-campus-scene" />
        <div className="orb orb-one" />
        <div className="orb orb-two" />
      </section>
      <section className="auth-form-wrap">
        <div className="auth-form">
          <span className="eyebrow muted">{portalName.toUpperCase()} PORTAL</span>
          <h2>
            {register ? "Make yourself at home." : "Good to see you again."}
          </h2>
          <p className="muted">
            {register
              ? "Create your student account to start making a difference."
              : portal === "student"
                ? "Report issues and follow every update. Sign in with your student email."
                : portal === "staff"
                  ? "Sign in with your assigned staff account to manage repairs."
                  : "Sign in with your administrator account to manage campus operations."}
          </p>
          <div className="portal-picker" role="group" aria-label="Choose your sign-in portal">
            {["student", "staff", "admin"].map(role => (
              <button
                key={role}
                type="button"
                aria-pressed={portal === role}
                disabled={busy}
                onClick={() => { setPortal(role); setRegister(false); setError(""); }}
              >
                {role === "student" ? <UserRound size={17} /> : role === "staff" ? <Wrench size={17} /> : <ShieldCheck size={17} />}
                {{ student: "Student", staff: "Staff", admin: "Admin" }[role]}
              </button>
            ))}
          </div>
          {portal === "student" && (
          <div className="auth-tabs">
            <button
              className={!register ? "selected" : ""}
              onClick={() => {
                setRegister(false);
                setError("");
              }}
            >
              Sign in
            </button>
            <button
              className={register ? "selected" : ""}
              onClick={() => {
                setRegister(true);
                setError("");
              }}
            >
              Create account
            </button>
          </div>
          )}
          <form key={portal} onSubmit={submit} aria-label={`${portalName} ${register ? "registration" : "sign in"}`}>
            {register && (
              <Field label="Full name">
                <input
                  name="name"
                  autoComplete="name"
                  required
                  minLength={2}
                  maxLength={80}
                  placeholder="Your full name"
                />
              </Field>
            )}
            <Field label="Email address">
              <input
                name="email"
                type="email"
                autoComplete="email"
                required
                placeholder={portal === "student" ? "you@college.edu" : portal === "staff" ? "name.staff@campusfix.com" : "Your administrator email"}
              />
            </Field>
            <Field label="Password">
              <input
                name="password"
                type="password"
                autoComplete={register ? "new-password" : "current-password"}
                required
                minLength={10}
                maxLength={128}
                placeholder="At least 10 characters"
              />
            </Field>
            {error && (
              <div role="alert" className="error">
                <AlertCircle size={18} />
                {error}
              </div>
            )}
            <button className="primary full" disabled={busy}>
              {busy
                ? "Please wait…"
                : register
                  ? "Create student account"
                  : `Sign in as ${portalName}`}
              <ArrowRight size={18} />
            </button>
          </form>
          <p className="auth-note">
            <ShieldCheck size={16} /> {portal === "student"
              ? "New here? Create a student account using your existing email."
              : "Accounts are assigned by your campus administrator. Contact them if you need access."}
          </p>
        </div>
      </section>
    </div>
  );
}
function IssueForm({ onCreated, onCancel }) {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [photos, setPhotos] = useState([]);
  const [createdIssue, setCreatedIssue] = useState(null);
  const [uploadedCount, setUploadedCount] = useState(0);
  const photoInput = useRef(null);

  function selectPhotos(event) {
    const selected = Array.from(event.target.files || []);
    setError("");

    if (selected.length + uploadedCount > 3) {
      setError(`You can select up to ${3 - uploadedCount} more photos.`);
      event.target.value = "";
      return;
    }

    if (selected.some(file => file.size > 5 * 1024 * 1024)) {
      setError("Each photo must be 5 MiB or smaller.");
      event.target.value = "";
      return;
    }

    setPhotos(selected);
  }

  async function submit(event) {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(event.currentTarget));
    setBusy(true);
    setError("");

    try {
      let report = createdIssue;

      if (!report) {
        report = await api("/issues", {
          method: "POST",
          body: JSON.stringify(values),
        });
        setCreatedIssue(report);
      }

      const failed = [];
      let firstError = "";

      for (const photo of photos) {
        const body = new FormData();
        body.append("photo", photo);

        try {
          await api(`/issues/${report.id}/attachments`, {
            method: "POST",
            body,
          });
          setUploadedCount(count => count + 1);
        } catch (error) {
          failed.push(photo);
          if (!firstError) firstError = error.message;
        }
      }

      setPhotos(failed);
      if (photoInput.current) photoInput.current.value = "";

      if (failed.length) {
        setError(
          `Report CF-${String(report.id).padStart(4, "0")} was saved, but ` +
          `${failed.length} photo upload(s) failed. ${firstError} ` +
          "Retry the remaining photos or continue without them.",
        );
        return;
      }

      await onCreated();
    } catch (error) {
      setError(error.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="panel report-panel">
      <div className="section-heading">
        <div>
          <span className="eyebrow muted">LET'S GET IT SORTED</span>
          <h2>Report an issue</h2>
          <p className="muted">
            Tell us what needs attention. Add photos to help the team understand.
          </p>
        </div>
        <span className="illustration-icon">
          <Wrench size={30} aria-hidden="true" />
        </span>
      </div>

      <form onSubmit={submit}>
        <fieldset
          className="issue-fields"
          disabled={busy || Boolean(createdIssue)}
        >
          <Field label="What's the issue?">
            <input
              name="title"
              required
              minLength={5}
              maxLength={120}
              placeholder="e.g. Projector not working in Room 204"
            />
          </Field>

          <div className="form-grid">
            <Field label="Category">
              <select name="category">
                {Object.keys(categoryColor).map(value => (
                  <option key={value}>{value}</option>
                ))}
              </select>
            </Field>
            <Field label="Priority">
              <select name="priority" defaultValue="medium">
                <option value="low">Low - minor inconvenience</option>
                <option value="medium">Medium - needs attention</option>
                <option value="high">High - urgent disruption</option>
              </select>
            </Field>
          </div>

          <Field label="Location">
            <input
              name="location"
              required
              minLength={3}
              maxLength={120}
              placeholder="Building, floor, room or equipment number"
            />
          </Field>

          <Field label="Describe the problem">
            <textarea
              name="description"
              required
              minLength={15}
              maxLength={3000}
              rows={5}
              placeholder="What happened? When did you notice it? Who is affected?"
            />
          </Field>
        </fieldset>

        <div className="photos-upload">
          <Field label="Photos (optional)">
            <input
              ref={photoInput}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              disabled={busy || uploadedCount >= 3}
              onChange={selectPhotos}
              aria-describedby="new-report-photo-help"
            />
          </Field>

          <p id="new-report-photo-help" className="small muted">
            Up to 3 JPEG, PNG or WebP photos. Maximum 5 MiB each.
          </p>

          {photos.length > 0 && (
            <>
              <ul className="selected-report-photos">
                {photos.map((photo, index) => (
                  <li key={`${photo.name}-${index}`}>
                    <span>{photo.name}</span>
                    <small>{Math.ceil(photo.size / 1024)} KiB</small>
                  </li>
                ))}
              </ul>
              <button
                type="button"
                className="secondary"
                disabled={busy}
                onClick={() => {
                  setPhotos([]);
                  if (photoInput.current) photoInput.current.value = "";
                }}
              >
                Clear selected photos
              </button>
            </>
          )}

          {uploadedCount > 0 && (
            <p className="small muted">
              {uploadedCount} photo(s) uploaded successfully.
            </p>
          )}
        </div>

        {createdIssue && (
          <p className="success" role="status">
            Report CF-{String(createdIssue.id).padStart(4, "0")} is saved.
            {busy ? " Processing photos..." : " Retrying will not create another report."}
          </p>
        )}

        {error && <p role="alert" className="error">{error}</p>}

        <div className="form-actions">
          <button
            type="button"
            className="secondary"
            disabled={busy}
            onClick={createdIssue ? () => onCreated() : onCancel}
          >
            {createdIssue ? "Continue to my reports" : "Cancel"}
          </button>
          <button className="primary" disabled={busy}>
            {busy
              ? "Submitting..."
              : createdIssue
                ? photos.length
                  ? "Retry remaining photos"
                  : "Finish report"
                : "Submit report"}
            <ArrowRight size={17} aria-hidden="true" />
          </button>
        </div>
      </form>
    </section>
  );
}
function IssueDetail({ issue, user, staff, onUpdate, onClose, refreshing, refreshError }) {
  const dialog = useRef(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [note, setNote] = useState(""),
    [assignment, setAssignment] = useState(String(issue.assignee_id || ""));
  useEffect(() => {
    setAssignment(String(issue.assignee_id || ""));
  }, [issue.assignee_id]);
  useEffect(() => {
    const before = document.activeElement;
    dialog.current.showModal();
    return () => before?.focus();
  }, []);
  async function change(body) {
    if (refreshing || refreshError) return;
    setBusy(true);
    setError("");
    try {
      await api(`/issues/${issue.id}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      });
      await onUpdate();
      onClose();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  const canWork =
    user.role === "admin" ||
    (user.role === "staff" &&
      issue.assignee_id === user.id &&
      ["open", "in_progress"].includes(issue.status));
  return (
    <dialog ref={dialog} className="detail-dialog" onCancel={onClose}>
      <div className="dialog-top">
        <span className="issue-number">
          CF-{String(issue.id).padStart(4, "0")}
        </span>
        <button
          className="icon-button"
          aria-label="Close issue details"
          onClick={onClose}
        >
          <X />
        </button>
      </div>
      <Badge status={issue.status} />
      <h2>{issue.title}</h2>
      <p className="location">
        <MapPin size={16} />
        {issue.location}
      </p>
      <p className="description">{issue.description}</p>
      {refreshing && <p className="muted small" role="status">Updating report details…</p>}
      {refreshError && (
        <div className="error" role="alert">
          {refreshError}
          <button className="text-button" onClick={onUpdate} disabled={refreshing}>
            Retry report refresh
          </button>
        </div>
      )}
      <div className="detail-meta">
        <div>
          <small>Reported by</small>
          <strong>{issue.reporter}</strong>
        </div>
        <div>
          <small>Category</small>
          <strong>{issue.category}</strong>
        </div>
        <div>
          <small>Assigned to</small>
          <strong>{issue.assignee || "Awaiting assignment"}</strong>
        </div>
        <div>
          <small>Priority</small>
          <strong className="capitalize">{issue.priority}</strong>
        </div>
      </div>
<PhotoAttachments issue={issue} user={user} api={api} />
      {issue.resolution && (
        <div className="resolution">
          <strong>Resolution notes</strong>
          <p>{issue.resolution}</p>
        </div>
      )}
      {user.role === "admin" && (
        <div className="assign-row">
          <Field label="Assign maintenance staff">
            <select
              value={assignment}
              onChange={(e) => setAssignment(e.target.value)}
            >
              <option value="">Choose staff member</option>
              {staff.map((s) => (
                <option value={s.id} key={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </Field>
          <button
            className="secondary"
            disabled={busy || refreshing || Boolean(refreshError) || !assignment}
            onClick={() => change({ assignee_id: Number(assignment) })}
          >
            Assign
          </button>
        </div>
      )}
      {canWork && !["resolved", "closed"].includes(issue.status) && (
        <div className="work-actions">
          <Field label="Resolution notes (required to resolve)">
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              maxLength={2000}
              placeholder="Explain what was fixed and how it was checked."
            />
          </Field>
          <div className="form-actions">
            <button
              className="secondary"
              disabled={
                busy || refreshing || Boolean(refreshError) || !issue.assignee_id || issue.status === "in_progress"
              }
              onClick={() => change({ status: "in_progress" })}
            >
              Start work
            </button>
            <button
              className="primary"
              disabled={busy || refreshing || Boolean(refreshError) || note.trim().length < 10}
              onClick={() => change({ status: "resolved", resolution: note })}
            >
              Mark resolved
              <Check size={16} />
            </button>
          </div>
        </div>
      )}
      {user.id === issue.reporter_id &&
        user.role === "student" &&
        issue.status === "resolved" && (
          <div className="resolution">
            <strong>Has the problem been fixed?</strong>
            <p>
              Confirm the resolution, or reopen the report if it needs another
              look.
            </p>
            <div className="form-actions">
              <button
                className="secondary"
                disabled={busy || refreshing || Boolean(refreshError)}
                onClick={() => change({ status: "open" })}
              >
                Reopen issue
              </button>
              <button
                className="primary"
                disabled={busy || refreshing || Boolean(refreshError)}
                onClick={() => change({ status: "closed" })}
              >
                Confirm fix
                <Check size={16} />
              </button>
            </div>
          </div>
        )}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
    </dialog>
  );
}
function App() {
  const [user, setUser] = useState(null),
    [boot, setBoot] = useState(true),
    [issues, setIssues] = useState([]),
    [staff, setStaff] = useState([]),
    [page, setPage] = useState("overview"),
    [filter, setFilter] = useState("all"),
    [search, setSearch] = useState(""),
    [selectedId, setSelectedId] = useState(null),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [loading, setLoading] = useState(false);
  useEffect(() => {
    api("/auth/me")
      .then((d) => setUser(d.user))
      .catch((e) => {
        if (!e.message.includes("sign in") && !e.message.includes("expired"))
          setError(e.message);
      })
      .finally(() => setBoot(false));
    const expire = () => {
      setUser(null);
      setIssues([]);
    };
    window.addEventListener("session-expired", expire);
    return () => window.removeEventListener("session-expired", expire);
  }, []);
  async function load() {
    setLoading(true);
    setError("");
    try {
      const latestIssues = await api("/issues");
      setIssues(latestIssues);
      setSelectedId(current => latestIssues.some(issue => issue.id === current) ? current : null);
      if (user?.role === "admin") setStaff(await api("/staff"));
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    if (user) load();
  }, [user]);
  function navigate(next, nextFilter = "all") {
    setPage(next);
    setFilter(nextFilter);
    setSearch("");
    setNotice("");
  }
  function openIssue(issue) {
    setSelectedId(issue.id);
  }
  const selected = issues.find(issue => issue.id === selectedId);
  if (boot)
    return (
      <div className="loading-screen">
        <Brand />
        <p>Opening your campus workspace…</p>
      </div>
    );
  if (!user)
    return (
      <>
        <Auth
          onLogin={(u) => {
            setUser(u);
            setError("");
          }}
        />
        {error && (
          <p className="connection-error" role="alert">
            {error}
          </p>
        )}
      </>
    );
  const copy = roleCopy[user.role];
  const personal = issues.filter((i) =>
    user.role === "staff"
      ? i.assignee_id === user.id
      : i.reporter_id === user.id,
  );
  const metrics = user.role === "admin" ? issues : personal;
  const active = metrics.filter(
    (i) => !["resolved", "closed"].includes(i.status),
  );
  const resolved = metrics.filter((i) =>
    ["resolved", "closed"].includes(i.status),
  );
  const overdue = active.filter((i) => new Date(i.due_at) < new Date());
  const resolutionHours = resolved
    .filter((i) => i.resolved_at)
    .map((i) => (new Date(i.resolved_at) - new Date(i.created_at)) / 3600000);
  const avg = resolutionHours.length
    ? Math.round(
        resolutionHours.reduce((a, b) => a + b, 0) / resolutionHours.length,
      )
    : null;
  const counts = Object.keys(categoryColor).map((name) => ({
    name: name === "IT & Network" ? "IT / Network" : name,
    count: metrics.filter((i) => i.category === name).length,
  }));
  let visible = issues.filter(
    (i) =>
      ((page !== "mine" && !(page === "overview" && user.role === "staff")) ||
        (user.role === "staff"
          ? i.assignee_id === user.id
          : i.reporter_id === user.id)) &&
      (filter === "all" || i.status === filter) &&
      (i.title + " " + i.location + " " + i.category)
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  const title =
    page === "overview"
      ? copy.title
      : page === "report"
        ? "See something? Say something."
        : page === "mine"
          ? user.role === "staff"
            ? "Your work, at a glance."
            : "Your reports, all in one place."
          : page === "team"
            ? "The people who keep campus moving."
            : "Every issue. One shared space.";
  async function support(issue) {
    setError("");
    try {
      await api(`/issues/${issue.id}/support`, { method: "POST" });
      await load();
    } catch (e) {
      setError(e.message);
    }
  }
  async function logout() {
    try {
      await api("/auth/logout", { method: "POST" });
      setUser(null);
      setIssues([]);
      setPage("overview");
      setNotice("");
      setStaff([]);
      setSelectedId(null);
    } catch (e) {
      setError(e.message);
    }
  }
  return (
    <div className={`app-shell role-${user.role}`}>
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <aside className="sidebar">
        <Brand />
        <div className="workspace-label">{copy.workspace}</div>
        <nav aria-label="Main navigation">
          {[
            [
              "overview",
              LayoutDashboard,
              user.role === "admin"
                ? "Control center"
                : user.role === "staff"
                  ? "My workbench"
                  : "Overview",
            ],
            ["issues", ClipboardList, "All issues"],
            ...(user.role === "admin"
              ? [["team", Users, "Manage staff"]]
              : [
                  [
                    "mine",
                    user.role === "staff" ? Wrench : UserRound,
                    user.role === "staff" ? "My assignments" : "My reports",
                  ],
                ]),
            ...(user.role === "student"
              ? [["report", Plus, "Report an issue"]]
              : []),
          ].map(([key, I, label]) => (
            <button
              key={key}
              className={`nav-item ${page === key ? "active" : ""}`}
              aria-current={page === key ? "page" : undefined}
              onClick={() => navigate(key)}
            >
              <Icon as={I} />
              {label}
              {key === "issues" && (
                <span className="nav-count">{issues.length}</span>
              )}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="care-card">
            <span className="care-icon">
              <Building2 size={22} />
            </span>
            <h3>{copy.care}</h3>
            <p>{copy.careText}</p>
            <button onClick={() => navigate(copy.target)}>
              {copy.careAction}
              <ArrowUpRight size={16} />
            </button>
          </div>
          <div className="profile">
            <span className="avatar">
              {user.name
                .split(" ")
                .slice(0, 2)
                .map((s) => s[0])
                .join("")}
            </span>
            <div>
              <strong>{user.name}</strong>
              <span className="capitalize">{user.role} account</span>
            </div>
            <button
              className="icon-button"
              aria-label="Sign out"
              onClick={logout}
            >
              <LogOut size={18} />
              <span className="logout-label">Sign out</span>
            </button>
          </div>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div>
            <span className="muted">Workspace</span>
            <ChevronRight size={14} />
            <strong>
              {page === "overview"
                ? user.role === "admin"
                  ? "Control center"
                  : user.role === "staff"
                    ? "My workbench"
                    : "Overview"
                : page === "report"
                  ? "New report"
                  : page === "mine"
                    ? "My workspace"
                    : page === "team"
                      ? "Manage staff"
                      : "All issues"}
            </strong>
          </div>
          <span className="environment">
            <span className="dot" /> Campus workspace
          </span>
        </header>
        <main id="main">
          <div className="page-heading">
            <div>
              <div className="eyebrow muted">{copy.workspace}</div>
              <h1>{title}</h1>
              <p className="muted">
                {page === "overview"
                  ? `Welcome back, ${user.name.split(" ")[0]}. ${copy.intro}`
                  : "Stay connected to the spaces you share."}
              </p>
            </div>
            {page !== "report" && page !== "team" && (
              <button className="primary" onClick={() => navigate(copy.target)}>
                {user.role === "admin" ? (
                  <Users size={18} />
                ) : user.role === "staff" ? (
                  <Wrench size={18} />
                ) : (
                  <Plus size={18} />
                )}
                {copy.action}
              </button>
            )}
          </div>
          {error && (
            <div role="alert" className="error">
              {error}
              <button className="text-button" onClick={load}>
                Try again
              </button>
            </div>
          )}
          {notice && (
            <div role="status" className="success">
              <CheckCircle2 size={18} />
              {notice}
            </div>
          )}
          {page === "team" && user.role === "admin" ? (
            <StaffManager staff={staff} api={api} onCreated={load} />
          ) : page === "report" ? (
            <IssueForm
              onCancel={() => navigate("overview")}
              onCreated={async () => {
                await load();
                setPage("mine");
                setNotice(
                  "Your report is in. You can follow its progress here.",
                );
              }}
            />
          ) : (
            <>
              {page === "overview" && (
                <div className="overview-layout">
                  <RoleWorkspace
                    user={user}
                    issues={issues}
                    staffCount={staff.length}
                    onNavigate={navigate}
                    onOpen={openIssue}
                  />
                  <section
                    className="stat-grid"
                    aria-label={
                      user.role === "admin"
                        ? "Campus statistics"
                        : "Personal statistics"
                    }
                  >
                    {[
                      [
                        ClipboardList,
                        user.role === "staff"
                          ? "My assignments"
                          : user.role === "student"
                            ? "My reports"
                            : "Total reports",
                        metrics.length,
                        user.role === "admin"
                          ? "Across all campus spaces"
                          : "In your workspace",
                        "blue",
                      ],
                      [
                        Activity,
                        "Open & in progress",
                        active.length,
                        "Waiting for a little care",
                        "amber",
                      ],
                      [
                        CheckCircle2,
                        "Resolved & closed",
                        resolved.length,
                        `${metrics.length ? Math.round((resolved.length / metrics.length) * 100) : 0}% of ${user.role === "admin" ? "all reports" : "your workload"}`,
                        "violet",
                      ],
                      [
                        Clock,
                        "Overdue issues",
                        overdue.length,
                        "Past the 3-day target",
                        "coral",
                      ],
                    ].map(([I, label, value, hint, color]) => (
                      <article className="stat-card" key={label}>
                        <div className="stat-top">
                          <span>{label}</span>
                          <span className={`stat-icon ${color}`}>
                            <Icon as={I} />
                          </span>
                        </div>
                        <strong className="stat-value">
                          {value.toString().padStart(2, "0")}
                        </strong>
                        <span className="stat-hint">{hint}</span>
                      </article>
                    ))}
                  </section>
                  <section className="insight-grid">
                    <article className="panel category-panel">
                      <div className="section-heading">
                        <div>
                          <h2>Where attention is needed</h2>
                          <p className="muted small">
                            {user.role === "admin"
                              ? "Campus reports"
                              : user.role === "staff"
                                ? "My assignments"
                                : "My reports"}{" "}
                            by category · all time
                          </p>
                        </div>
                        <span className="subtle-tag">
                          {user.role === "admin"
                            ? "Campus-wide"
                            : "Your workspace"}
                        </span>
                      </div>
                      <div
                        className="chart"
                        role="img"
                        aria-label={counts
                          .map((c) => `${c.name}: ${c.count} reports`)
                          .join(", ")}
                      >
                        <Suspense
                          fallback={
                            <p className="muted small">
                              Loading category chart…
                            </p>
                          }
                        >
                          <CategoryChart data={counts} role={user.role} />
                        </Suspense>
                      </div>
                    </article>
                    <article className="impact-panel">
                      <div className="eyebrow">
                        {user.role === "admin"
                          ? "A CLEAR VIEW. A STRONGER TEAM."
                          : user.role === "staff"
                            ? "SKILL. CARE. FOLLOW-THROUGH."
                            : "LITTLE FIXES. BIG IMPACT."}
                      </div>
                      <div className="impact-symbol">
                        <ShieldCheck size={35} />
                      </div>
                      <h2>
                        {user.role === "admin"
                          ? "Organize the work."
                          : user.role === "staff"
                            ? "Make every fix"
                            : "Better spaces."}
                        <br />
                        {user.role === "admin"
                          ? "Empower the team."
                          : user.role === "staff"
                            ? "count."
                            : "Better days."}
                      </h2>
                      <p>
                        {avg === null
                          ? "Your first resolved report will start the response-time story."
                          : `Average resolution time is ${avg} hours across ${user.role === "admin" ? "all" : "your"} resolved reports.`}{" "}
                        Every report is a step toward a campus that works for
                        everyone.
                      </p>
                      <button
                        className="impact-link"
                        onClick={() => {
                          setPage(user.role === "admin" ? "issues" : "mine");
                          setFilter("resolved");
                        }}
                      >
                        Explore resolved issues
                        <ArrowUpRight size={18} />
                      </button>
                    </article>
                  </section>
                </div>
              )}
              <section className="panel issues-panel">
                <div className="section-heading">
                  <div>
                    <h2>
                      {page === "overview"
                        ? user.role === "admin"
                          ? "Campus dispatch"
                          : user.role === "staff"
                            ? "My assignment queue"
                            : "Campus issue feed"
                        : page === "mine"
                          ? user.role === "staff"
                            ? "My assignments"
                            : "My reports"
                          : "All campus issues"}{" "}
                      <span className="count-pill">{visible.length}</span>
                    </h2>
                    <p className="muted small">
                      {page === "mine"
                        ? "Track the reports connected to you."
                        : "Real reports. Shared progress. A little better every day."}
                    </p>
                  </div>
                  <button
                    className="icon-button"
                    aria-label="Refresh issues"
                    disabled={loading}
                    onClick={load}
                  >
                    <RefreshCw size={17} />
                  </button>
                </div>
                <div className="table-toolbar">
                  <div className="filter-tabs" aria-label="Filter by status">
                    {["all", "open", "in_progress", "resolved", "closed"].map(
                      (s) => (
                        <button
                          key={s}
                          aria-pressed={filter === s}
                          className={filter === s ? "selected" : ""}
                          onClick={() => setFilter(s)}
                        >
                          {s === "all" ? "All issues" : statusLabel[s]}
                        </button>
                      ),
                    )}
                  </div>
                  <label className="search">
                    <Search size={16} />
                    <input
                      aria-label="Search issues"
                      placeholder="Search issues…"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                    />
                  </label>
                </div>
                {loading && (
                  <p className="muted small" role="status">
                    Updating reports…
                  </p>
                )}
                <div className="issue-list">
                  {visible.length === 0 && !loading ? (
                    <div className="empty-state">
                      <ClipboardList size={30} />
                      <h3>No reports here yet.</h3>
                      <p>
                        Try another filter or report something that needs
                        attention.
                      </p>
                    </div>
                  ) : (
                    visible
                      .slice(0, page === "overview" ? 5 : 100)
                      .map((issue) => (
                        <article className="issue-row" key={issue.id}>
                          <span
                            className="category-dot"
                            style={{
                              background: categoryColor[issue.category],
                            }}
                          />
                          <div className="issue-main">
                            <button
                              className="issue-title"
                              onClick={() => openIssue(issue)}
                            >
                              {issue.title}
                            </button>
                            <div className="issue-sub">
                              <span className="issue-number">
                                CF-{String(issue.id).padStart(4, "0")}
                              </span>
                              <span>
                                <MapPin size={12} />
                                {issue.location}
                              </span>
                            </div>
                          </div>
                          <span className={`priority ${issue.priority}`}>
                            <i />
                            {issue.priority}
                          </span>
                          <Badge status={issue.status} />
                          {user.role === "student" ? (
                            <button
                              className={`support-button ${issue.supported ? "supported" : ""}`}
                              aria-label={`${issue.supported ? "Remove support for" : "Support"} ${issue.title}`}
                              aria-pressed={issue.supported}
                              onClick={() => support(issue)}
                            >
                              <ThumbsUp size={14} />
                              {issue.support_count}
                            </button>
                          ) : (
                            <span className="assignee-label">
                              {issue.assignee?.split(" ")[0] || "Unassigned"}
                            </span>
                          )}
                          <button
                            className="icon-button row-open"
                            aria-label={`View ${issue.title}`}
                            onClick={() => openIssue(issue)}
                          >
                            <ChevronRight size={18} />
                          </button>
                        </article>
                      ))
                  )}
                </div>
                {page === "overview" && visible.length > 5 && (
                  <button
                    className="feed-footer"
                    onClick={() =>
                      navigate(user.role === "staff" ? "mine" : "issues")
                    }
                  >
                    {user.role === "staff"
                      ? "View all my assignments"
                      : "View all campus issues"}
                    <ArrowRight size={15} />
                  </button>
                )}
                {page !== "overview" && visible.length > 100 && (
                  <p className="muted small">
                    Showing the first 100 reports. Use search to narrow the
                    results.
                  </p>
                )}
              </section>
              <footer className="page-footer">
                <span>Small actions. Shared responsibility.</span>
                <span>CampusFix · Campus care, connected</span>
              </footer>
            </>
          )}
        </main>
      </div>
      {selected && (
        <IssueDetail
          key={selected.id}
          issue={selected}
          user={user}
          staff={staff}
          onUpdate={load}
          onClose={() => setSelectedId(null)}
          refreshing={loading}
          refreshError={error}
        />
      )}
    </div>
  );
}
createRoot(document.getElementById("root")).render(<App />);
