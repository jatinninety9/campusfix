import { test, after } from "node:test";
import assert from "node:assert/strict";
import request from "./helpers/csrf-request.js";
import { createHash } from "node:crypto";
import { db, migrate } from "../src/db.js";
import { hashPassword } from "../src/password.js";

// Exercise production cookies without changing the environment of other test files.
process.env.NODE_ENV = "production";
const { app } = await import("../src/app.js");
// This suite must never call real S3, even when local credentials are configured.
app.locals.attachmentStorage = null;
const email = `deployment-${Date.now()}-${process.pid}@example.test`;
const password = "DeploymentTest@2026";
const host = "campusfix.example.test";
const origin = `https://${host}`;
let userId;

after(async () => {
  try {
    if (userId) await db.query("DELETE FROM users WHERE id=$1", [userId]);
  } finally {
    await db.end();
  }
});

test("production API contract before address migration", async (t) => {
  await migrate();
  userId = (await db.query(
    "INSERT INTO users(name,email,password,role) VALUES($1,$2,$3,'student') RETURNING id",
    ["Deployment Test", email, hashPassword(password)],
  )).rows[0].id;
  let cookie;

  await t.test("HTTPS login issues a secure host-only cookie and no secrets", async () => {
    const response = await request(app).post("/api/auth/login")
      .set("Host", host).set("Origin", origin)
      .send({ email, password }).expect(200);
    const header = response.headers["set-cookie"][0];
    for (const flag of [/; Secure/i, /; HttpOnly/i, /; SameSite=Lax/i, /; Path=\//i]) {
      assert.match(header, flag);
    }
    assert.doesNotMatch(header, /; Domain=/i);
    assert.deepEqual(Object.keys(response.body.user).sort(), ["email", "id", "name", "role"]);
    cookie = header.split(";")[0];
    const token = cookie.slice(cookie.indexOf("=") + 1);
    const sessions = await db.query("SELECT token FROM sessions WHERE user_id=$1", [userId]);
    assert.equal(sessions.rows[0].token, createHash("sha256").update(token).digest("hex"));
    await request(app).get("/api/auth/me").set("Cookie", cookie).expect(200);
  });

  await t.test("foreign, malformed and null origins fail without changing sessions", async () => {
    for (const value of ["https://attacker.example", `http://${host}`, `https://${host}:444`, "not-a-url", "null"]) {
      await request(app).post("/api/auth/logout")
        .set("Host", host).set("Origin", value).set("Cookie", cookie).expect(403);
    }
    await request(app).get("/api/auth/me").set("Cookie", cookie).expect(200);
  });

  await t.test("forwarded host headers cannot bypass origin checks", async () => {
    await request(app).post("/api/auth/logout")
      .set("Host", "origin.example.test").set("Origin", origin)
      .set("X-Forwarded-Host", host).set("Forwarded", `host=${host};proto=https`)
      .set("Cookie", cookie).expect(403);
    // A gateway must deliberately preserve the public Host, or pass a reviewed
    // origin policy. Simply forwarding X-Forwarded-Host is not sufficient.
    await request(app).get("/api/auth/me").set("Cookie", cookie).expect(200);
  });

  await t.test("anonymous and forged sessions cannot access protected routes", async () => {
    for (const path of ["/api/auth/me", "/api/staff", "/api/issues", "/api/issues/1/attachments"]) {
      await request(app).get(path).expect(401);
      await request(app).get(path).set("Cookie", "campusfix_session=forged").expect(401);
    }
  });

  await t.test("unknown routes and unsupported methods return JSON 404", async () => {
    for (const [method, path] of [["get", "/api/does-not-exist"], ["put", "/api/issues"]]) {
      const response = await request(app)[method](path).set("Cookie", cookie).expect(404);
      assert.match(response.headers["content-type"], /application\/json/);
      assert.equal(response.body.error, "Endpoint not found.");
    }
  });

  await t.test("malformed JSON is rejected without an internal server error", async () => {
    await request(app).post("/api/auth/login")
      .set("Content-Type", "application/json").send('{"email":').expect(400);
  });

  await t.test("oversized JSON is a 413 client error", async () => {
    await request(app).post("/api/auth/login")
      .send({ email, password, padding: "x".repeat(33 * 1024) }).expect(413);
  });

  await t.test("invalid issue IDs and absent reports have explicit errors", async () => {
    for (const value of ["invalid", "0", "-1", "1.5"]) {
      await request(app).post(`/api/issues/${value}/support`).set("Cookie", cookie).expect(400);
      await request(app).patch(`/api/issues/${value}`).set("Cookie", cookie)
        .send({ status: "open" }).expect(400);
    }
    await request(app).post("/api/issues/2147483647/support").set("Cookie", cookie).expect(404);
    await request(app).patch("/api/issues/2147483647").set("Cookie", cookie)
      .send({ status: "open" }).expect(404);
  });

  await t.test("same-origin logout clears the secure cookie and rejects replay", async () => {
    const response = await request(app).post("/api/auth/logout")
      .set("Host", host).set("Origin", origin).set("Cookie", cookie).expect(200);
    assert.match(response.headers["set-cookie"][0], /; Secure/i);
    await request(app).get("/api/auth/me").set("Cookie", cookie).expect(401);
  });

  await t.test("expired sessions cannot authenticate", async () => {
    const token = "expired-deployment-session";
    await db.query("INSERT INTO sessions(token,user_id,expires_at) VALUES($1,$2,NOW()-INTERVAL '1 minute')",
      [createHash("sha256").update(token).digest("hex"), userId]);
    await request(app).get("/api/auth/me")
      .set("Cookie", `campusfix_session=${token}`).expect(401);
  });
});
