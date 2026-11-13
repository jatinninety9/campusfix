import { test, after } from "node:test";
import assert from "node:assert/strict";
import request from "./helpers/csrf-request.js";
import { app } from "../src/app.js";
import { db, migrate } from "../src/db.js";
import { hashPassword } from "../src/password.js";

const tag = `${Date.now()}-${process.pid}`;
const password = "Attachments@Test2026";
const users = {};
const emails = [];
const objects = new Map();
const previousStorage = app.locals.attachmentStorage;

let issueId;
let reporterPhoto;
let staffPhoto;
let remainingPhoto;
let failUpload = false;
let failRemove = false;

const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64",
);

const fakeStorage = {
  async upload({ key, body, contentType }) {
    if (failUpload) throw new Error("Simulated storage upload failure");
    objects.set(key, { body: Buffer.from(body), contentType });
  },
  async getViewUrl({ key }) {
    assert.ok(objects.has(key));
    return `https://attachments.example.test/${encodeURIComponent(key)}?expires=60`;
  },
  async remove(key) {
    if (failRemove) throw new Error("Simulated storage deletion failure");
    objects.delete(key);
  },
};

function uploadPhoto(agent, body = png, filename = "evidence.png", field = "photo") {
  return agent.post(`/api/issues/${issueId}/attachments`)
    .attach(field, body, { filename, contentType: "image/png" });
}

function photoPath(id) {
  return `/api/issues/${issueId}/attachments/${id}`;
}

async function countPhotos() {
  return (await db.query(
    "SELECT COUNT(*)::int AS total FROM issue_attachments WHERE issue_id=$1",
    [issueId],
  )).rows[0].total;
}

after(async () => {
  app.locals.attachmentStorage = previousStorage;
  try {
    if (issueId) {
      await db.query("DELETE FROM issues WHERE id=$1", [issueId]);
    }
    if (emails.length) {
      await db.query("DELETE FROM users WHERE email=ANY($1)", [emails]);
    }
  } finally {
    objects.clear();
    await db.end();
  }
});

test("attachment APIs with PostgreSQL and simulated storage", async t => {
  await migrate();
  app.locals.attachmentStorage = fakeStorage;

  for (const [name, role] of [
    ["reporter", "student"],
    ["other", "student"],
    ["staff", "staff"],
    ["admin", "admin"],
  ]) {
    const email = `photo-${name}-${tag}@example.test`;
    emails.push(email);

    const result = await db.query(
      "INSERT INTO users(name,email,password,role) VALUES($1,$2,$3,$4) RETURNING id",
      [`Photo ${name}`, email, hashPassword(password), role],
    );

    const agent = request.agent(app);
    await agent.post("/api/auth/login").send({ email, password }).expect(200);
    users[name] = { id: result.rows[0].id, agent };
  }

  const created = await users.reporter.agent.post("/api/issues").send({
    title: `Attachment test ${tag}`,
    description: "The classroom projector requires a maintenance inspection.",
    category: "IT & Network",
    location: "Attachment test room",
    priority: "medium",
  }).expect(201);

  issueId = created.body.id;

  await t.test("anonymous users cannot access attachment routes", async () => {
    await request(app).get(`/api/issues/${issueId}/attachments`).expect(401);
    await request(app).post(`/api/issues/${issueId}/attachments`).expect(401);
  });

  await t.test("other students and unassigned staff cannot upload", async () => {
    await uploadPhoto(users.other.agent).expect(403);
    await uploadPhoto(users.staff.agent).expect(403);
    assert.equal(objects.size, 0);
  });

  await t.test("missing, incorrect, oversized and disguised files are rejected", async () => {
    await users.reporter.agent.post(`/api/issues/${issueId}/attachments`).expect(400);
    await uploadPhoto(users.reporter.agent, png, "image.png", "wrongField").expect(400);
    await uploadPhoto(users.reporter.agent, Buffer.from("Not an image"), "fake.png").expect(400);
    await uploadPhoto(users.reporter.agent, Buffer.from("<svg></svg>"), "drawing.svg").expect(400);
    await uploadPhoto(users.reporter.agent, Buffer.alloc(5 * 1024 * 1024 + 1)).expect(413);
    assert.equal(await countPhotos(), 0);
    assert.equal(objects.size, 0);
  });

  await t.test("valid image content is detected and metadata is saved", async () => {
    const response = await uploadPhoto(users.reporter.agent, png, "evidence.txt").expect(201);
    reporterPhoto = response.body.id;

    assert.equal(response.body.content_type, "image/png");
    assert.equal(response.body.size_bytes, png.length);
    assert.equal(response.body.uploaded_by, users.reporter.id);
    assert.equal(response.body.object_key, undefined);

    const stored = (await db.query(
      "SELECT * FROM issue_attachments WHERE id=$1", [reporterPhoto],
    )).rows[0];

    assert.ok(stored.object_key.startsWith(`complaints/${issueId}/`));
    assert.ok(stored.object_key.endsWith(".png"));
    assert.deepEqual(objects.get(stored.object_key).body, png);
  });

  await t.test("signed-in campus users can list photos and request viewing links", async () => {
    const listed = await users.other.agent
      .get(`/api/issues/${issueId}/attachments`).expect(200);
    assert.ok(listed.body.some(photo => photo.id === reporterPhoto));

    const viewed = await users.other.agent.get(`${photoPath(reporterPhoto)}/url`).expect(200);
    assert.equal(viewed.body.expiresIn, 60);
    assert.match(viewed.body.url, /^https:\/\/attachments\.example\.test\//);
    assert.equal(viewed.headers["cache-control"], "no-store");
  });

  await t.test("other students and staff cannot delete another uploader's photo", async () => {
    await users.other.agent.delete(photoPath(reporterPhoto)).expect(403);
    await users.staff.agent.delete(photoPath(reporterPhoto)).expect(403);
    assert.equal(await countPhotos(), 1);
  });

  await t.test("assigned staff can upload", async () => {
    await users.admin.agent.patch(`/api/issues/${issueId}`)
      .send({ assignee_id: users.staff.id }).expect(200);
    const response = await uploadPhoto(users.staff.agent).expect(201);
    staffPhoto = response.body.id;
  });

  await t.test("concurrent uploads cannot exceed the three-photo limit", async () => {
    const results = await Promise.all([
      uploadPhoto(users.reporter.agent),
      uploadPhoto(users.reporter.agent),
    ]);
    assert.deepEqual(results.map(result => result.status).sort(), [201, 409]);
    remainingPhoto = results.find(result => result.status === 201).body.id;
    assert.equal(await countPhotos(), 3);
    assert.equal(objects.size, 3);
  });

  await t.test("uploaders can remove their photos and admins can remove staff photos", async () => {
    await users.reporter.agent.delete(photoPath(reporterPhoto)).expect(200);
    await users.admin.agent.delete(photoPath(staffPhoto)).expect(200);
    assert.equal(await countPhotos(), 1);
    assert.equal(objects.size, 1);
  });

  await t.test("failed storage uploads do not create attachment records", async () => {
    failUpload = true;
    try {
      await uploadPhoto(users.reporter.agent).expect(500);
    } finally {
      failUpload = false;
    }
    assert.equal(await countPhotos(), 1);
    assert.equal(objects.size, 1);
  });

  await t.test("failed storage deletion preserves the attachment record", async () => {
    failRemove = true;
    try {
      await users.admin.agent.delete(photoPath(remainingPhoto)).expect(500);
    } finally {
      failRemove = false;
    }
    assert.equal(await countPhotos(), 1);
    assert.equal(objects.size, 1);
  });

  await t.test("unconfigured storage returns clear errors without breaking listing", async () => {
    app.locals.attachmentStorage = null;
    try {
      await uploadPhoto(users.reporter.agent).expect(503);
      await users.reporter.agent.get(`${photoPath(remainingPhoto)}/url`).expect(503);
      await users.reporter.agent.get(`/api/issues/${issueId}/attachments`).expect(200);
    } finally {
      app.locals.attachmentStorage = fakeStorage;
    }
  });

  await t.test("invalid identifiers and missing issues are handled", async () => {
    await users.reporter.agent.get(`/api/issues/${issueId}/attachments/not-a-uuid/url`).expect(400);
    await users.reporter.agent.get("/api/issues/2147483647/attachments").expect(404);
  });

  await t.test("running migrations again does not reapply the attachment migration", async () => {
    await migrate();
    const result = await db.query(
      "SELECT COUNT(*)::int AS total FROM schema_migrations WHERE version=$1",
      ["001_attachments.sql"],
    );
    assert.equal(result.rows[0].total, 1);
  });
});
