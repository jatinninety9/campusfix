import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

export function createAttachmentStorage({
  bucket = process.env.S3_BUCKET,
  region = process.env.AWS_REGION,
} = {}) {
  if (!bucket) return null;
  if (!region) throw new Error("AWS_REGION is required when S3_BUCKET is set.");

  const client = new S3Client({ region });

  function validateKey(key) {
    if (!key.startsWith("complaints/")) {
      throw new Error("Attachment keys must start with complaints/.");
    }
  }

  return {
    async upload({ key, body, contentType }) {
      validateKey(key);
      await client.send(new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: body,
        ContentType: contentType,
        ServerSideEncryption: "AES256",
      }));
    },

    async getViewUrl({ key, filename }) {
      validateKey(key);
      const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120);
      return getSignedUrl(
        client,
        new GetObjectCommand({
          Bucket: bucket,
          Key: key,
          ResponseContentDisposition: `inline; filename="${safeName}"`,
        }),
        { expiresIn: 60 },
      );
    },

    async remove(key) {
      validateKey(key);
      await client.send(new DeleteObjectCommand({
        Bucket: bucket,
        Key: key,
      }));
    },
  };
}
