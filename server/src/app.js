import { attachmentRoutes } from "./attachments.js";
import { createAttachmentStorage } from "./storage.js";
import express from "express";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import { rateLimit } from "express-rate-limit";
import { createHash, randomBytes } from "node:crypto";
import { z } from "zod";
import { db } from "./db.js";
import { hashPassword, verifyPassword } from "./password.js";

export const app = express();
app.use(helmet());
app.use(express.json({ limit: "32kb" }));
app.use(cookieParser());
// Same-origin browser writes only; API clients without Origin remain usable for tests/CLI.
app.use((req, res, next) => {
  if (!["GET", "HEAD", "OPTIONS"].includes(req.method) && req.headers.origin) {
    try {
      if (new URL(req.headers.origin).host !== req.headers.host)
        return res.status(403).json({ error: "Cross-origin request blocked." });
    } catch {
      return res.status(403).json({ error: "Invalid origin." });
    }
  }
  next();
});
const digest = (value) => createHash("sha256").update(value).digest("hex");
const cookieOptions = {
  httpOnly: true,
  sameSite: "lax",
  secure: process.env.NODE_ENV === "production",
  path: "/",
};
async function login(res, user) {
  const token = randomBytes(32).toString("hex");
  await db.query(
    "INSERT INTO sessions(token,user_id,expires_at) VALUES($1,$2,NOW()+INTERVAL '7 days')",
    [digest(token), user.id],
  );
  res.cookie("campusfix_session", token, {
    ...cookieOptions,
    maxAge: 604800000,
  });
  return { id: user.id, name: user.name, email: user.email, role: user.role };
}
const loginLimiter = rateLimit({
  windowMs: 900000,
  limit: 40,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  message: {
    error: "Too many failed sign-in attempts. Try again in 15 minutes.",
  },
});
const registrationLimiter = rateLimit({
  windowMs: 900000,
  limit: 20,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: {
    error: "Too many registration attempts. Try again in 15 minutes.",
  },
});
app.get("/api/health", async (req, res) => {
  await db.query("SELECT 1");
  res.json({ status: "ok", service: "campusfix-api" });
});
const account = z.object({
  email: z
    .email()
    .max(254)
    .transform((v) => v.toLowerCase()),
  password: z.string().min(10).max(128),
});
app.post("/api/auth/register", registrationLimiter, async (req, res) => {
  const input = account
    .extend({ name: z.string().trim().min(2).max(80) })
    .parse(req.body);
  const result = await db.query(
    "INSERT INTO users(name,email,password,role) VALUES($1,$2,$3,'student') RETURNING *",
    [input.name, input.email, hashPassword(input.password)],
  );
  res.status(201).json({ user: await login(res, result.rows[0]) });
});
app.post("/api/auth/login", loginLimiter, async (req, res) => {
  const input = account.parse(req.body);
  const { rows } = await db.query("SELECT * FROM users WHERE email=$1", [
    input.email,
  ]);
  if (!rows[0] || !verifyPassword(input.password, rows[0].password))
    return res.status(401).json({ error: "Email or password is incorrect." });
  res.json({ user: await login(res, rows[0]) });
});
app.use("/api", async (req, res, next) => {
  const token = req.cookies.campusfix_session;
  if (!token) return res.status(401).json({ error: "Please sign in." });
  const { rows } = await db.query(
    "SELECT u.id,u.name,u.email,u.role FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token=$1 AND s.expires_at>NOW()",
    [digest(token)],
  );
  if (!rows[0])
    return res
      .status(401)
      .json({ error: "Your session has expired. Please sign in." });
  req.user = rows[0];
  next();
});
app.locals.attachmentStorage = createAttachmentStorage();
app.use("/api", attachmentRoutes());
app.get("/api/auth/me", (req, res) => res.json({ user: req.user }));
app.post("/api/auth/logout", async (req, res) => {
  await db.query("DELETE FROM sessions WHERE token=$1", [
    digest(req.cookies.campusfix_session),
  ]);
  res.clearCookie("campusfix_session", cookieOptions).json({ ok: true });
});
app.get("/api/staff", async (req, res) => {
  if (req.user.role !== "admin")
    return res.status(403).json({ error: "Administrator access required." });
  res.json(
    (
      await db.query(
        `SELECT u.id,u.name,u.email,
          (SELECT COUNT(*)::int FROM issues i WHERE i.assignee_id=u.id AND i.status IN ('open','in_progress')) AS active_count
         FROM users u WHERE u.role='staff' ORDER BY u.name`,
      )
    ).rows,
  );
});
app.post("/api/staff", async (req, res) => {
  if (req.user.role !== "admin")
    return res.status(403).json({ error: "Administrator access required." });
  const input = account
    .extend({ name: z.string().trim().min(2).max(80) })
    .strict()
    .parse(req.body);
  const { rows } = await db.query(
    "INSERT INTO users(name,email,password,role) VALUES($1,$2,$3,'staff') RETURNING id,name,email,role",
    [input.name, input.email, hashPassword(input.password)],
  );
  res.status(201).json(rows[0]);
});
app.get("/api/issues", async (req, res) => {
  const { rows } = await db.query(
    `SELECT i.*,u.name AS reporter,a.name AS assignee,
    (SELECT COUNT(*)::int FROM supports s WHERE s.issue_id=i.id) AS support_count,
    EXISTS(SELECT 1 FROM supports s WHERE s.issue_id=i.id AND s.user_id=$1) AS supported
    FROM issues i JOIN users u ON u.id=i.reporter_id LEFT JOIN users a ON a.id=i.assignee_id ORDER BY i.created_at DESC`,
    [req.user.id],
  );
  res.json(rows);
});
const issueSchema = z.object({
  title: z.string().trim().min(5).max(120),
  description: z.string().trim().min(15).max(3000),
  category: z.enum(["IT & Network", "Electrical", "Plumbing", "Facilities"]),
  location: z.string().trim().min(3).max(120),
  priority: z.enum(["low", "medium", "high"]),
});
app.post("/api/issues", async (req, res) => {
  const i = issueSchema.parse(req.body);
  const { rows } = await db.query(
    "INSERT INTO issues(title,description,category,location,priority,reporter_id) VALUES($1,$2,$3,$4,$5,$6) RETURNING *",
    [i.title, i.description, i.category, i.location, i.priority, req.user.id],
  );
  res.status(201).json(rows[0]);
});
app.post("/api/issues/:id/support", async (req, res) => {
  if (req.user.role !== "student")
    return res
      .status(403)
      .json({ error: "Only students can support reports." });
  const id = z.coerce.number().int().positive().parse(req.params.id);
  if (!(await db.query("SELECT id FROM issues WHERE id=$1", [id])).rowCount)
    return res.status(404).json({ error: "Issue not found." });
  const removed = await db.query(
    "DELETE FROM supports WHERE issue_id=$1 AND user_id=$2",
    [id, req.user.id],
  );
  if (!removed.rowCount)
    await db.query(
      "INSERT INTO supports(issue_id,user_id) VALUES($1,$2) ON CONFLICT DO NOTHING",
      [id, req.user.id],
    );
  res.json({ ok: true });
});
app.patch("/api/issues/:id", async (req, res) => {
  const id = z.coerce.number().int().positive().parse(req.params.id);
  const body = z
    .object({
      status: z.enum(["open", "in_progress", "resolved", "closed"]).optional(),
      assignee_id: z.number().int().positive().optional(),
      resolution: z.string().trim().min(10).max(2000).optional(),
    })
    .strict()
    .parse(req.body);
  const client = await db.connect();
  try {
    await client.query("BEGIN");
    const issue = (
      await client.query("SELECT * FROM issues WHERE id=$1 FOR UPDATE", [id])
    ).rows[0];
    if (!issue) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Issue not found." });
    }
    let status = body.status ?? issue.status,
      assignee = body.assignee_id ?? issue.assignee_id;
    let allowed = req.user.role === "admin";
    if (req.user.role === "student")
      allowed =
        issue.reporter_id === req.user.id &&
        issue.status === "resolved" &&
        ["closed", "open"].includes(body.status) &&
        body.assignee_id === undefined &&
        body.resolution === undefined;
    if (req.user.role === "staff")
      allowed =
        issue.assignee_id === req.user.id &&
        ["open", "in_progress"].includes(issue.status) &&
        ["in_progress", "resolved"].includes(body.status) &&
        body.assignee_id === undefined;
    if (!allowed) {
      await client.query("ROLLBACK");
      return res.status(403).json({ error: "You cannot make this change." });
    }
    if (
      body.assignee_id &&
      !(
        await client.query(
          "SELECT id FROM users WHERE id=$1 AND role='staff'",
          [body.assignee_id],
        )
      ).rowCount
    ) {
      await client.query("ROLLBACK");
      return res.status(400).json({ error: "Select a valid staff member." });
    }
    if (status === "in_progress" && !assignee) {
      await client.query("ROLLBACK");
      return res.status(400).json({ error: "Assign a staff member first." });
    }
    if (status === "resolved" && !(body.resolution || issue.resolution)) {
      await client.query("ROLLBACK");
      return res
        .status(400)
        .json({ error: "Add resolution notes before resolving." });
    }
    await client.query(
      `UPDATE issues SET status=$1,assignee_id=$2,resolution=$3,updated_at=NOW(), resolved_at=CASE WHEN $1='resolved' THEN COALESCE(resolved_at,NOW()) WHEN $1='open' THEN NULL ELSE resolved_at END WHERE id=$4`,
      [
        status,
        assignee,
        status === "open" ? null : (body.resolution ?? issue.resolution),
        id,
      ],
    );
    await client.query("COMMIT");
    res.json({ ok: true });
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
});
app.use((req, res) => res.status(404).json({ error: "Endpoint not found." }));
app.use((err, req, res, next) => {
  if (err instanceof z.ZodError)
    return res.status(400).json({
      error: err.issues
        .map((i) => `${i.path.join(".")}: ${i.message}`)
        .join("; "),
    });
  if (err.code === "23505")
    return res.status(409).json({ error: "This email is already registered." });
  if (err.type === "entity.parse.failed")
    return res.status(400).json({ error: "Invalid JSON." });
  console.error(err.message);
  res.status(500).json({ error: "Something went wrong. Please try again." });
});
