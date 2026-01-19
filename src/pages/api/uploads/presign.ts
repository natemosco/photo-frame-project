import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { nanoid } from "nanoid";
import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { z } from "zod";
import { getOrCreateUser } from "../../../lib/user";
import { authOptions } from "../auth/[...nextauth]";

const BodySchema = z.object({
  filename: z.string().min(1),
  contentType: z.string().min(1),
  size: z.number().positive(),
});

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_CONTENT_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/gif", "image/webp"];

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const session = await getServerSession(req, res, authOptions);
  if (!session?.user) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const parsed = BodySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid payload", details: parsed.error.flatten() });
  }

  const { filename, contentType, size } = parsed.data;

  // Validate file size
  if (size > MAX_FILE_SIZE) {
    return res
      .status(400)
      .json({ error: `File size exceeds maximum of ${MAX_FILE_SIZE / 1024 / 1024}MB` });
  }

  // Validate content type
  if (!ALLOWED_CONTENT_TYPES.includes(contentType.toLowerCase())) {
    return res.status(400).json({ error: "Invalid content type. Only images are allowed." });
  }

  try {
    // Get or create user in database
    const userId = await getOrCreateUser(session);

    // Generate S3 key: userId/nanoid-filename
    const fileId = nanoid();
    const s3Key = `${userId}/${fileId}-${filename}`;

    const s3 = new S3Client({ region: process.env.AWS_REGION });
    const bucket = process.env.S3_BUCKET;

    if (!bucket) {
      return res.status(500).json({ error: "S3_BUCKET environment variable is not set" });
    }

    // Create presigned PUT URL
    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: s3Key,
      ContentType: contentType,
    });

    const url = await getSignedUrl(s3, command, { expiresIn: 3600 }); // 1 hour expiry

    // Construct public URL
    const publicBaseUrl = process.env.S3_PUBLIC_BASE_URL;
    const publicUrl = publicBaseUrl
      ? `${publicBaseUrl}/${s3Key}`
      : `https://${bucket}.s3.${process.env.AWS_REGION}.amazonaws.com/${s3Key}`;

    return res.status(200).json({
      url,
      fields: {}, // Empty fields for PUT request (POST would need fields)
      key: s3Key,
      publicUrl,
    });
  } catch (error: unknown) {
    console.error("Presign error:", error);
    const message = error instanceof Error ? error.message : String(error);
    return res.status(500).json({ error: "Failed to generate presigned URL", message });
  }
}
