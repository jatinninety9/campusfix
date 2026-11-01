import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createAttachmentStorage } from "./storage.js";

const storage = createAttachmentStorage();
if (!storage) throw new Error("S3_BUCKET is not configured.");

const key = `complaints/checks/${randomUUID()}.txt`;
const original = Buffer.from("CampusFix Docker S3 verification.");
let uploaded = false;

try {
  await storage.upload({
    key,
    body: original,
    contentType: "text/plain",
  });
  uploaded = true;

  const url = await storage.getViewUrl({
    key,
    filename: "verification.txt",
  });

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Signed download failed: HTTP ${response.status}`);
  }

  const downloaded = Buffer.from(await response.arrayBuffer());
  assert.deepEqual(downloaded, original);
  console.log("PASS: Docker S3 upload, signed download, and file comparison.");
} finally {
  if (uploaded) {
    await storage.remove(key);
    console.log("PASS: Temporary S3 object deleted.");
  }
}
