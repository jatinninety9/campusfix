import { test, after } from "node:test";
import assert from "node:assert/strict";
import express from "express";
import cookieParser from "cookie-parser";
import request from "supertest";
import { createCsrfProtection } from "../src/csrf.js";
import { app } from "../src/app.js";
import { db } from "../src/db.js";

after(() => db.end());

function fixture(production = false) {
  const server = express();
  const csrf = createCsrfProtection({ production });
  server.use(cookieParser());
  server.use(csrf.csrfProtection);
  server.get("/token", (req, res) => res.json({ token: csrf.generateCsrfToken(req, res) }));
  server.post("/write", (req, res) => res.json({ ok: true }));
  server.delete("/write", (req, res) => res.json({ ok: true }));
  server.use((error, req, res, next) => res.status(error.status || 500).json({ code: error.code }));
  return server;
}

function cookie(response) {
  return response.headers["set-cookie"][0].split(";")[0];
}

test("CSRF rejects missing tokens, cookie-only submission and forged matching pairs", async () => {
  const server = fixture();
  await request(server).post("/write").expect(403);
  const response = await request(server).get("/token").expect(200);
  await request(server).post("/write").set("Cookie", cookie(response)).expect(403);
  await request(server).post("/write").set("X-CSRF-Token", response.body.token).expect(403);
  await request(server).post("/write")
    .set("Cookie", "campusfix_csrf=forged.forged")
    .set("X-CSRF-Token", "forged.forged").expect(403);
});

test("CSRF allows explicit valid headers without Origin, including multipart uploads", async () => {
  const server = fixture();
  const response = await request(server).get("/token").expect(200);
  for (const method of ["post", "delete"]) {
    await request(server)[method]("/write").set("Cookie", cookie(response))
      .set("X-CSRF-Token", response.body.token).expect(200);
  }
  await request(server).post("/write").set("Cookie", cookie(response))
    .set("X-CSRF-Token", response.body.token)
    .attach("photo", Buffer.from("test"), "test.txt").expect(200);
});

test("CSRF tokens are bound to sessions and refreshed after login or session changes", async () => {
  const server = fixture();
  const session = "campusfix_session=session-one";
  const response = await request(server).get("/token").set("Cookie", session).expect(200);
  await request(server).post("/write").set("Cookie", `${session}; ${cookie(response)}`)
    .set("X-CSRF-Token", response.body.token).expect(200);
  await request(server).post("/write")
    .set("Cookie", `campusfix_session=session-two; ${cookie(response)}`)
    .set("X-CSRF-Token", response.body.token).expect(403);
  const refreshed = await request(server).get("/token")
    .set("Cookie", `campusfix_session=session-two; ${cookie(response)}`).expect(200);
  await request(server).post("/write")
    .set("Cookie", `campusfix_session=session-two; ${cookie(refreshed)}`)
    .set("X-CSRF-Token", refreshed.body.token).expect(200);
});

test("production CSRF cookie has host prefix, Secure, HttpOnly, SameSite and no Domain", async () => {
  const server = fixture(true);
  const response = await request(server).get("/token").expect(200);
  const header = response.headers["set-cookie"][0];
  assert.match(header, /^__Host-campusfix-csrf=/);
  for (const flag of [/; Secure/i, /; HttpOnly/i, /; SameSite=Strict/i, /; Path=\//i]) assert.match(header, flag);
  assert.doesNotMatch(header, /; Domain=/i);
  await request(server).post("/write").set("Cookie", cookie(response))
    .set("X-CSRF-Token", response.body.token).expect(200);
});

test("unsafe application routes reject missing CSRF before database or storage access", async () => {
  for (const [method, path] of [
    ["post", "/api/auth/login"], ["post", "/api/auth/register"],
    ["post", "/api/issues"], ["patch", "/api/issues/1"],
    ["delete", "/api/issues/1/attachments/invalid"],
  ]) {
    const response = await request(app)[method](path).expect(403);
    assert.equal(response.body.code, "CSRF_INVALID");
  }
  await request(app).post("/api/auth/login").set("Sec-Fetch-Site", "cross-site").expect(403);
  const token = await request(app).get("/api/auth/csrf").expect(200);
  assert.equal(token.headers["cache-control"], "no-store");
});

test("API rate limiting covers health, reads and writes and ignores forged client addresses", async () => {
  let blocked;
  for (let index = 0; index < 610; index++) {
    const response = await request(app).get("/api/does-not-exist")
      .set("X-Forwarded-For", `198.51.100.${index % 250 + 1}`);
    if (response.status === 429) { blocked = response; break; }
    assert.equal(response.status, 401);
  }
  assert.ok(blocked, "Changing an untrusted forwarded address must not bypass the limiter");
  assert.ok(Number(blocked.headers["retry-after"]) > 0);
  await request(app).get("/api/health").expect(429);
  await request(app).post("/api/issues").expect(429);
});
