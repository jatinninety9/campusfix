import { Router } from "express";
import { randomUUID } from "node:crypto";
import multer from "multer";
import { fileTypeFromBuffer } from "file-type";
import { rateLimit } from "express-rate-limit";
import { z } from "zod";
import { db } from "./db.js";

const MAX_BYTES = 5 * 1024 * 1024;
const MAX_PHOTOS = 3;
const allowedTypes = new Set(["image/jpeg", "image/png", "image/webp"]);

function canUpload(user, issue) {
  return user.role === "admin"
    || issue.reporter_id === user.id
    || (user.role === "staff" && issue.assignee_id === user.id);
}

export function attachmentRoutes() {
  const router = Router();
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: MAX_BYTES, files: 1, fields: 0 },
  });
  const uploadLimit = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 20,
    keyGenerator: req => String(req.user.id),
    standardHeaders: "draft-8",
    legacyHeaders: false,
    message: { error: "Too many photo upload attempts. Try again later." },
  });

  router.get("/issues/:issueId/attachments", async (req, res) => {
    const issueId = z.coerce.number().int().positive().parse(req.params.issueId);
    const issue = await db.query("SELECT id FROM issues WHERE id=$1", [issueId]);

    if (!issue.rowCount) {
      return res.status(404).json({ error: "Issue not found." });
    }

    const { rows } = await db.query(`
      SELECT id, original_name, content_type, size_bytes,
             uploaded_by, created_at
      FROM issue_attachments
      WHERE issue_id=$1
      ORDER BY created_at
    `, [issueId]);

    res.set("Cache-Control", "no-store").json(rows);
  });

  router.post(
    "/issues/:issueId/attachments",
    uploadLimit,
    async (req, res, next) => {
      const issueId = z.coerce.number().int().positive().parse(req.params.issueId);
      const issue = (await db.query(
        "SELECT * FROM issues WHERE id=$1", [issueId],
      )).rows[0];

      if (!issue) return res.status(404).json({ error: "Issue not found." });
      if (!canUpload(req.user, issue)) {
        return res.status(403).json({ error: "You cannot add photos to this issue." });
      }
      if (!req.app.locals.attachmentStorage) {
        return res.status(503).json({ error: "Photo storage is not configured." });
      }

      req.attachmentIssueId = issueId;
      next();
    },
    upload.single("photo"),
    async (req, res) => {
      if (!req.file) {
        return res.status(400).json({ error: "Select a photo to upload." });
      }

      const detected = await fileTypeFromBuffer(req.file.buffer).catch(() => null);
      if (!detected || !allowedTypes.has(detected.mime)) {
        return res.status(400).json({ error: "Only JPEG, PNG, and WebP photos are allowed." });
      }

      const id = randomUUID();
      const issueId = req.attachmentIssueId;
      const key = `complaints/${issueId}/${id}.${detected.ext}`;
      const originalName = req.file.originalname
        .replace(/[\x00-\x1f\x7f]/g, "")
        .slice(0, 120) || `photo.${detected.ext}`;
      const storage = req.app.locals.attachmentStorage;
      const client = await db.connect();
      let uploaded = false;

      try {
        await client.query("BEGIN");
        const issue = (await client.query(
          "SELECT * FROM issues WHERE id=$1 FOR UPDATE", [issueId],
        )).rows[0];

        if (!issue || !canUpload(req.user, issue)) {
          await client.query("ROLLBACK");
          return res.status(403).json({ error: "The issue is no longer available for upload." });
        }

        const count = (await client.query(
          "SELECT COUNT(*)::int AS total FROM issue_attachments WHERE issue_id=$1",
          [issueId],
        )).rows[0].total;

        if (count >= MAX_PHOTOS) {
          await client.query("ROLLBACK");
          return res.status(409).json({ error: "An issue can have at most 3 photos." });
        }

        await storage.upload({
          key,
          body: req.file.buffer,
          contentType: detected.mime,
        });
        uploaded = true;

        const { rows } = await client.query(`
          INSERT INTO issue_attachments
            (id, issue_id, uploaded_by, object_key,
             original_name, content_type, size_bytes)
          VALUES ($1,$2,$3,$4,$5,$6,$7)
          RETURNING id, original_name, content_type,
                    size_bytes, uploaded_by, created_at
        `, [id, issueId, req.user.id, key,
            originalName, detected.mime, req.file.size]);

        await client.query("COMMIT");
        res.status(201).json(rows[0]);
      } catch (error) {
        await client.query("ROLLBACK");
        if (uploaded) {
          await storage.remove(key).catch(() => {
            console.error("Attachment cleanup required for object:", key);
          });
        }
        throw error;
      } finally {
        client.release();
      }
    },
  );

  router.get("/issues/:issueId/attachments/:id/url", async (req, res) => {
    const issueId = z.coerce.number().int().positive().parse(req.params.issueId);
    const id = z.uuid().parse(req.params.id);
    const attachment = (await db.query(
      "SELECT * FROM issue_attachments WHERE id=$1 AND issue_id=$2",
      [id, issueId],
    )).rows[0];

    if (!attachment) {
      return res.status(404).json({ error: "Photo not found." });
    }

    const storage = req.app.locals.attachmentStorage;
    if (!storage) {
      return res.status(503).json({ error: "Photo storage is not configured." });
    }

    const url = await storage.getViewUrl({
      key: attachment.object_key,
      filename: attachment.original_name,
    });

    res.set("Cache-Control", "no-store").json({ url, expiresIn: 60 });
  });

  router.delete("/issues/:issueId/attachments/:id", async (req, res) => {
    const issueId = z.coerce.number().int().positive().parse(req.params.issueId);
    const id = z.uuid().parse(req.params.id);
    const storage = req.app.locals.attachmentStorage;

    if (!storage) {
      return res.status(503).json({ error: "Photo storage is not configured." });
    }

    const client = await db.connect();
    try {
      await client.query("BEGIN");
      const attachment = (await client.query(
        "SELECT * FROM issue_attachments WHERE id=$1 AND issue_id=$2 FOR UPDATE",
        [id, issueId],
      )).rows[0];

      if (!attachment) {
        await client.query("ROLLBACK");
        return res.status(404).json({ error: "Photo not found." });
      }

      if (req.user.role !== "admin" && attachment.uploaded_by !== req.user.id) {
        await client.query("ROLLBACK");
        return res.status(403).json({ error: "Only the uploader or an admin can remove this photo." });
      }

      await storage.remove(attachment.object_key);
      await client.query("DELETE FROM issue_attachments WHERE id=$1", [id]);
      await client.query("COMMIT");
      res.json({ ok: true });
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  });

  router.use((error, req, res, next) => {
    if (error instanceof multer.MulterError) {
      return res.status(error.code === "LIMIT_FILE_SIZE" ? 413 : 400).json({
        error: error.code === "LIMIT_FILE_SIZE"
          ? "Each photo must be 5 MiB or smaller."
          : "Upload one file using the photo field.",
      });
    }
    next(error);
  });

  return router;
}
