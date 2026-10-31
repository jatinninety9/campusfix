import { test, after } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import { app } from "../src/app.js";
import { db, migrate } from "../src/db.js";
import { hashPassword } from "../src/password.js";
const suffix = `${Date.now()}-${process.pid}`;
const password = "WorkflowTest@2026";
const emails = ["student", "other", "staff", "admin", "created-staff"].map(
  (role) => `test-${role}-${suffix}@example.test`,
);
after(async () => {
  const ids = (
    await db.query("SELECT id FROM users WHERE email=ANY($1)", [emails])
  ).rows.map((u) => u.id);
  await db.query(
    "DELETE FROM supports WHERE user_id=ANY($1) OR issue_id IN (SELECT id FROM issues WHERE reporter_id=ANY($1))",
    [ids],
  );
  await db.query("DELETE FROM issues WHERE reporter_id=ANY($1)", [ids]);
  await db.query("DELETE FROM users WHERE id=ANY($1)", [ids]);
  await db.end();
});
test("authenticated complaint lifecycle and permission boundaries", async (t) => {
  await migrate();
  const student = request.agent(app),
    other = request.agent(app),
    staff = request.agent(app),
    admin = request.agent(app);
  let studentId, staffId, issueId;
  await t.test(
    "anonymous access is denied and health checks the database",
    async () => {
      await request(app).get("/api/issues").expect(401);
      const response = await request(app).get("/api/health").expect(200);
      assert.equal(response.body.status, "ok");
    },
  );
  await t.test(
    "registration cannot grant administrator privileges",
    async () => {
      const res = await student
        .post("/api/auth/register")
        .send({
          name: "Test Student",
          email: emails[0],
          password,
          role: "admin",
        })
        .expect(201);
      assert.equal(res.body.user.role, "student");
      studentId = res.body.user.id;
      assert.match(res.headers["set-cookie"][0], /HttpOnly/);
      assert.match(res.headers["set-cookie"][0], /SameSite=Lax/);
      await other
        .post("/api/auth/register")
        .send({ name: "Other Student", email: emails[1], password })
        .expect(201);
      await request(app)
        .post("/api/auth/register")
        .send({ name: "Duplicate", email: emails[0], password })
        .expect(409);
      await request(app)
        .post("/api/auth/login")
        .send({ email: emails[0], password: "WrongPassword123" })
        .expect(401);
      const stored = (
        await db.query("SELECT password FROM users WHERE id=$1", [studentId])
      ).rows[0].password;
      assert.notEqual(stored, password);
    },
  );
  await t.test("staff and admin are independently provisioned", async () => {
    for (const [index, role] of [
      [2, "staff"],
      [3, "admin"],
    ]) {
      const result = await db.query(
        "INSERT INTO users(name,email,password,role) VALUES($1,$2,$3,$4) RETURNING id",
        [`Test ${role}`, emails[index], hashPassword(password), role],
      );
      if (role === "staff") staffId = result.rows[0].id;
    }
    await staff
      .post("/api/auth/login")
      .send({ email: emails[2], password })
      .expect(200);
    await admin
      .post("/api/auth/login")
      .send({ email: emails[3], password })
      .expect(200);
    await student.get("/api/staff").expect(403);
    const res = await admin.get("/api/staff").expect(200);
    assert.ok(res.body.some((s) => s.id === staffId));
  });
  await t.test(
    "only admins can create staff accounts; new staff can sign in",
    async () => {
      const body = {
        name: "New Test Staff",
        email: emails[4].toUpperCase(),
        password,
      };
      await request(app).post("/api/staff").send(body).expect(401);
      await student.post("/api/staff").send(body).expect(403);
      await staff.post("/api/staff").send(body).expect(403);
      await admin
        .post("/api/staff")
        .send({ ...body, password: "short" })
        .expect(400);
      await admin
        .post("/api/staff")
        .send({ ...body, role: "admin" })
        .expect(400);
      const created = await admin.post("/api/staff").send(body).expect(201);
      assert.equal(created.body.role, "staff");
      assert.equal(created.body.email, emails[4]);
      assert.equal(created.body.password, undefined);
      await admin.post("/api/staff").send(body).expect(409);
      assert.equal(
        (await admin.get("/api/auth/me").expect(200)).body.user.role,
        "admin",
      );
      const newStaff = request.agent(app);
      await newStaff
        .post("/api/auth/login")
        .send({ email: emails[4], password })
        .expect(200);
      assert.equal(
        (await newStaff.get("/api/auth/me").expect(200)).body.user.role,
        "staff",
      );
      const directory = (await admin.get("/api/staff").expect(200)).body;
      assert.ok(
        directory.some((s) => s.email === emails[4] && s.active_count === 0),
      );
    },
  );
  await t.test(
    "invalid reports are rejected and valid reports persist",
    async () => {
      await student.post("/api/issues").send({ title: "x" }).expect(400);
      const res = await student
        .post("/api/issues")
        .send({
          title: "Test projector is broken",
          description: "The classroom projector does not display any image.",
          category: "IT & Network",
          location: "Test Building Room 101",
          priority: "high",
        })
        .expect(201);
      issueId = res.body.id;
      assert.equal(res.body.reporter_id, studentId);
      assert.equal(
        (await db.query("SELECT title FROM issues WHERE id=$1", [issueId]))
          .rows[0].title,
        "Test projector is broken",
      );
    },
  );
  await t.test(
    "support is reversible and students cannot assign or resolve",
    async () => {
      await other.post(`/api/issues/${issueId}/support`).expect(200);
      let res = await other.get("/api/issues").expect(200);
      assert.equal(res.body.find((i) => i.id === issueId).support_count, 1);
      await other.post(`/api/issues/${issueId}/support`).expect(200);
      res = await other.get("/api/issues").expect(200);
      assert.equal(res.body.find((i) => i.id === issueId).support_count, 0);
      await student
        .patch(`/api/issues/${issueId}`)
        .send({ assignee_id: staffId })
        .expect(403);
      await student
        .patch(`/api/issues/${issueId}`)
        .send({ status: "resolved", resolution: "Unauthorized resolution" })
        .expect(403);
      await staff
        .patch(`/api/issues/${issueId}`)
        .send({ status: "in_progress" })
        .expect(403);
    },
  );
  await t.test(
    "admin assigns; assigned staff starts and resolves with notes",
    async () => {
      await admin
        .patch(`/api/issues/${issueId}`)
        .send({ assignee_id: studentId })
        .expect(400);
      await admin
        .patch(`/api/issues/${issueId}`)
        .send({ assignee_id: staffId })
        .expect(200);
      await staff
        .patch(`/api/issues/${issueId}`)
        .send({ status: "in_progress" })
        .expect(200);
      await staff
        .patch(`/api/issues/${issueId}`)
        .send({ status: "resolved" })
        .expect(400);
      await staff
        .patch(`/api/issues/${issueId}`)
        .send({
          status: "resolved",
          resolution: "Replaced HDMI cable and tested the projector.",
        })
        .expect(200);
      await other
        .patch(`/api/issues/${issueId}`)
        .send({ status: "closed" })
        .expect(403);
    },
  );
  await t.test(
    "reporter can reopen and confirm a subsequent resolution",
    async () => {
      await student
        .patch(`/api/issues/${issueId}`)
        .send({ status: "open" })
        .expect(200);
      assert.equal(
        (await db.query("SELECT resolution FROM issues WHERE id=$1", [issueId]))
          .rows[0].resolution,
        null,
      );
      await staff
        .patch(`/api/issues/${issueId}`)
        .send({
          status: "resolved",
          resolution: "Replaced faulty projector and confirmed operation.",
        })
        .expect(200);
      await student
        .patch(`/api/issues/${issueId}`)
        .send({ status: "closed" })
        .expect(200);
      const issue = (await student.get("/api/issues").expect(200)).body.find(
        (i) => i.id === issueId,
      );
      assert.equal(issue.status, "closed");
      assert.ok(issue.resolved_at);
    },
  );
  await t.test(
    "cross-origin browser writes are blocked and logout invalidates session",
    async () => {
      await student
        .post("/api/issues")
        .set("Origin", "https://untrusted.example")
        .send({})
        .expect(403);
      await student.post("/api/auth/logout").expect(200);
      await student.get("/api/auth/me").expect(401);
    },
  );
  await t.test(
    "normal sessions do not exhaust login limits; failed logins are still blocked",
    async () => {
      // The previous limiter counted all these anonymous session checks as failures.
      for (let i = 0; i < 42; i++) {
        await request(app).get("/api/auth/me").expect(401);
      }
      for (let i = 0; i < 42; i++) {
        await student
          .post("/api/auth/login")
          .send({ email: emails[0], password })
          .expect(200);
      }
      let blocked;
      for (let i = 0; i < 41; i++) {
        const response = await request(app)
          .post("/api/auth/login")
          .send({ email: emails[0], password: "IncorrectPassword123" });
        if (response.status === 429) {
          blocked = response;
          break;
        }
        assert.equal(response.status, 401);
      }
      assert.ok(blocked, "Repeated failed logins must still be rate limited");
      assert.ok(Number(blocked.headers["retry-after"]) > 0);
      await student.get("/api/auth/me").expect(200);
      await student.post("/api/auth/logout").expect(200);
      await student.get("/api/auth/me").expect(401);
    },
  );
});
