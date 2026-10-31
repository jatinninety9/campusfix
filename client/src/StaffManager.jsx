import { useState } from "react";
import { Plus, Users, ShieldCheck, CheckCircle2 } from "lucide-react";
export default function StaffManager({ staff, api, onCreated }) {
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [success, setSuccess] = useState("");
  async function submit(event) {
    event.preventDefault();
    const form = event.currentTarget;
    setBusy(true);
    setError("");
    setSuccess("");
    try {
      const person = await api("/staff", {
        method: "POST",
        body: JSON.stringify(Object.fromEntries(new FormData(form))),
      });
      form.reset();
      await onCreated();
      setSuccess(
        `${person.name} now has a staff account and can be assigned reports.`,
      );
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="team-layout">
      <section className="panel team-directory">
        <div className="section-heading">
          <div>
            <span className="eyebrow muted">PEOPLE BEHIND THE PROGRESS</span>
            <h2>
              Maintenance team{" "}
              <span className="count-pill">{staff.length}</span>
            </h2>
          </div>
          <Users size={23} aria-hidden="true" />
        </div>
        <p className="muted small">
          Assign reports to the right people and keep workloads visible.
        </p>
        <div className="staff-list">
          {staff.length ? (
            staff.map((person) => (
              <article className="staff-card" key={person.id}>
                <span className="team-avatar">
                  {person.name
                    .split(" ")
                    .slice(0, 2)
                    .map((n) => n[0])
                    .join("")}
                </span>
                <div>
                  <h3>{person.name}</h3>
                  <p>{person.email}</p>
                </div>
                <span className="workload-badge">
                  {person.active_count} active
                </span>
              </article>
            ))
          ) : (
            <div className="empty-state">
              No staff members yet. Add your first team member.
            </div>
          )}
        </div>
      </section>
      <section className="panel staff-form">
        <span className="eyebrow muted">ADMINISTRATOR ACCESS</span>
        <h2>Add a staff member</h2>
        <p className="muted small">
          Create an account for a member of your maintenance team.
        </p>
        <form onSubmit={submit}>
          <label className="field">
            <span>Staff full name</span>
            <input
              name="name"
              autoComplete="off"
              required
              minLength={2}
              maxLength={80}
              placeholder="e.g. Riya Kapoor"
            />
          </label>
          <label className="field">
            <span>Staff email</span>
            <input
              type="email"
              name="email"
              autoComplete="off"
              maxLength={254}
              required
              placeholder="riya@college.edu"
            />
          </label>
          <label className="field">
            <span>Initial password</span>
            <input
              type="password"
              name="password"
              autoComplete="new-password"
              required
              minLength={10}
              maxLength={128}
              placeholder="At least 10 characters"
            />
          </label>
          <p className="small muted password-help">
            <ShieldCheck size={16} aria-hidden="true" /> Share the initial
            password privately. The account can sign in immediately; no email is
            sent.
          </p>
          {error && (
            <div role="alert" className="error">
              {error}
            </div>
          )}
          {success && (
            <div role="status" className="success">
              <CheckCircle2 size={18} />
              {success}
            </div>
          )}
          <button className="primary full" disabled={busy}>
            <Plus size={17} />
            {busy ? "Creating account…" : "Create staff account"}
          </button>
        </form>
      </section>
    </div>
  );
}
