import { db, migrate } from "./db.js";
import { hashPassword } from "./password.js";
await migrate();
if (!process.env.SEED_PASSWORD || process.env.SEED_PASSWORD.length < 10)
  throw new Error("Set SEED_PASSWORD (10+ characters) before seeding.");
const people = [
  ["Aarav Sharma", "student@campusfix.local", "student"],
  ["Priya Mehta", "staff@campusfix.local", "staff"],
  ["Campus Administrator", "admin@campusfix.local", "admin"],
];
const ids = {};
for (const [name, email, role] of people) {
  await db.query(
    "INSERT INTO users(name,email,password,role) VALUES($1,$2,$3,$4) ON CONFLICT(email) DO NOTHING",
    [name, email, hashPassword(process.env.SEED_PASSWORD), role],
  );
  ids[role] = (
    await db.query("SELECT id FROM users WHERE email=$1", [email])
  ).rows[0].id;
}
if (!(await db.query("SELECT id FROM issues LIMIT 1")).rowCount) {
  const examples = [
    [
      "Wi-Fi disconnects during lab sessions",
      "The wireless network disconnects every few minutes. Multiple students in the lab are affected.",
      "IT & Network",
      "Academic Block A · Computer Lab 204",
      "high",
      "open",
      0,
    ],
    [
      "Projector display needs attention",
      "The projector has a flickering display and makes it difficult to read lecture slides.",
      "IT & Network",
      "Academic Block B · Room 301",
      "medium",
      "in_progress",
      1,
    ],
    [
      "Leaking tap near the library",
      "The drinking water tap outside the library keeps running even when fully closed.",
      "Plumbing",
      "Central Library · Ground floor",
      "medium",
      "open",
      2,
    ],
    [
      "Ceiling lights not working",
      "Three ceiling lights above the reading desks have stopped working. Please replace them.",
      "Electrical",
      "Central Library · Reading room",
      "high",
      "resolved",
      3,
    ],
    [
      "Broken chair in seminar hall",
      "A chair in the second row has a damaged backrest and needs to be repaired or replaced.",
      "Facilities",
      "Seminar Hall · Second row",
      "low",
      "closed",
      4,
    ],
    [
      "Power socket is loose",
      "The power socket near workstation 12 is loose. The workstation has been switched off.",
      "Electrical",
      "Academic Block A · Computer Lab 102",
      "high",
      "open",
      5,
    ],
  ];
  for (const [
    title,
    description,
    category,
    location,
    priority,
    status,
    days,
  ] of examples) {
    await db.query(
      `INSERT INTO issues(title,description,category,location,priority,status,reporter_id,assignee_id,resolution,created_at,due_at,resolved_at)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,NOW()-$10*INTERVAL '1 day',NOW()+(3-$10)*INTERVAL '1 day',CASE WHEN $6 IN ('resolved','closed') THEN NOW()-INTERVAL '1 day' ELSE NULL END)`,
      [
        title,
        description,
        category,
        location,
        priority,
        status,
        ids.student,
        ["open"].includes(status) ? null : ids.staff,
        ["resolved", "closed"].includes(status)
          ? "The faulty parts were replaced and the equipment was tested."
          : null,
        days,
      ],
    );
  }
}
console.log(
  "Local sample accounts and complaints are ready. Existing records were preserved.",
);
await db.end();
