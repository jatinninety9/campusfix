import { ArrowRight, ClipboardList, ShieldCheck, Wrench } from "lucide-react";
import CampusScene from "./CampusScene.jsx";
export const roleCopy = {
  admin: {
    title: "Your campus. Under control.",
    workspace: "ADMIN CONTROL CENTER",
    intro: "Coordinate the team, clear the queue, and keep campus moving.",
    action: "Manage staff",
    target: "team",
    care: "Good teams make great campuses.",
    careText:
      "Bring the right people together to turn reports into resolutions.",
    careAction: "Manage your team",
  },
  staff: {
    title: "Ready for your next fix?",
    workspace: "MAINTENANCE WORKSPACE",
    intro:
      "Your assignments, priorities, and progress. Everything you need to get to work.",
    action: "My assignments",
    target: "mine",
    care: "Your work makes a difference.",
    careText: "Every completed assignment makes someone’s day a little easier.",
    careAction: "Open your assignments",
  },
  student: {
    title: "A better campus starts here.",
    workspace: "STUDENT COMMON ROOM",
    intro:
      "Report a problem, follow the progress, and help your shared spaces improve.",
    action: "Report an issue",
    target: "report",
    care: "Your voice shapes this campus.",
    careText:
      "Spot an issue? A small report can make a big difference for everyone.",
    careAction: "Report something",
  },
};
export default function RoleWorkspace({
  user,
  issues,
  staffCount,
  onNavigate,
  onOpen,
}) {
  const mine = issues.filter((i) =>
    user.role === "staff"
      ? i.assignee_id === user.id
      : i.reporter_id === user.id,
  );
  const unassigned = issues.filter(
    (i) => !i.assignee_id && !["closed", "resolved"].includes(i.status),
  );
  const urgent = mine.filter(
    (i) => i.priority === "high" && !["closed", "resolved"].includes(i.status),
  );
  const pending = mine.filter((i) => i.status === "resolved");
  const role = user.role;
  const featured =
    role === "admin"
      ? unassigned.slice(0, 2)
      : role === "staff"
        ? urgent.slice(0, 2)
        : pending.slice(0, 2);
  const headline =
    role === "admin"
      ? `${unassigned.length} ${unassigned.length === 1 ? "report needs" : "reports need"} an owner`
      : role === "staff"
        ? `${urgent.length} urgent ${urgent.length === 1 ? "assignment" : "assignments"} in your queue`
        : `${pending.length} ${pending.length === 1 ? "fix" : "fixes"} ready for your confirmation`;
  const Icon =
    role === "admin" ? ShieldCheck : role === "staff" ? Wrench : ClipboardList;
  return (
    <section
      className="role-workspace"
      aria-label={
        role === "admin"
          ? "Campus dispatch overview"
          : role === "staff"
            ? "Personal work overview"
            : "Student report overview"
      }
    >
      <div className="role-focus">
        <span className="role-focus-icon">
          <Icon size={25} aria-hidden="true" />
        </span>
        <div>
          <span className="eyebrow">
            {role === "admin"
              ? "THE DISPATCH DESK"
              : role === "staff"
                ? "YOUR WORKBENCH"
                : "YOUR CAMPUS. YOUR IMPACT."}
          </span>
          <h2>{headline}</h2>
          <p>
            {role === "admin"
              ? `${staffCount} staff members available for assignment.`
              : role === "staff"
                ? "Start with high-priority tasks and keep your resolution notes clear."
                : "Review completed work and confirm the fix, or reopen it if needed."}
          </p>
        </div>
      </div>
      {role === "student" && <CampusScene className="student-campus-scene" />}
      {role === "staff" && (
        <div className="work-stages" aria-label="Assignment stages">
          {[
            ["open", "To pick up"],
            ["in_progress", "In progress"],
            ["resolved", "Ready for review"],
          ].map(([status, label], index) => (
            <button key={status} onClick={() => onNavigate("mine", status)}>
              <span className="stage-number">0{index + 1}</span>
              <span>
                {label}
                <strong>
                  {mine
                    .filter((i) => i.status === status)
                    .length.toString()
                    .padStart(2, "0")}
                </strong>
              </span>
              <ArrowRight size={15} />
            </button>
          ))}
        </div>
      )}
      <div className="role-queue">
        {featured.length ? (
          featured.map((i) => (
            <button key={i.id} onClick={() => onOpen(i)}>
              <span>
                <small>CF-{String(i.id).padStart(4, "0")}</small>
                {i.title}
              </span>
              <ArrowRight size={17} />
            </button>
          ))
        ) : (
          <div className="role-quiet">
            <ShieldCheck size={20} />
            <span>
              {role === "admin"
                ? "Every active report has an owner."
                : role === "staff"
                  ? "No urgent assignments. Keep up the steady progress."
                  : "You’re all caught up on resolution reviews."}
            </span>
          </div>
        )}
        <button
          className="role-queue-footer"
          onClick={() => onNavigate(role === "admin" ? "issues" : "mine")}
        >
          {role === "admin"
            ? "Open campus dispatch"
            : role === "staff"
              ? "See all my assignments"
              : "Track my reports"}
          <ArrowRight size={15} />
        </button>
      </div>
    </section>
  );
}
