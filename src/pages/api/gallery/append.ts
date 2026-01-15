import type { NextApiRequest, NextApiResponse } from "next";
import { z } from "zod";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import { getOrCreateUser } from "../../../lib/user";
import { db } from "../../../db";
import { photos } from "../../../db/schema";
import { S3Client, GetObjectCommand, PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import sharp from "sharp";

const BodySchema = z.object({
  key: z.string().min(1),
  publicUrl: z.string().url(),
  filename: z.string().min(1),
  contentType: z.string().min(1),
  size: z.number().positive(),
  uploadedAt: z.string().optional(),
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const session = await getServerSession(req, res, authOptions);
  if (!session) return res.status(401).json({ error: "Unauthorized" });

  const parsed = BodySchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid payload", details: parsed.error.flatten() });

  try {
    // Get or create user in database
    const userId = await getOrCreateUser(session);

    let s3Key = parsed.data.key;
    let filename = parsed.data.filename;
    let contentType = parsed.data.contentType;
    let size = parsed.data.size;
    let publicUrl = parsed.data.publicUrl;

    // Helper function to convert stream to buffer
    async function streamToBuffer(stream: any): Promise<Buffer> {
      return await new Promise((resolve, reject) => {
        const chunks: Uint8Array[] = [];
        stream.on("data", (chunk: Uint8Array) => chunks.push(chunk));
        stream.on("error", reject);
        stream.on("end", () => resolve(Buffer.concat(chunks)));
      });
    }

    // Check if file needs conversion (HEIC/HEIF)
    const isHeicFormat = contentType.toLowerCase() === "image/heic" || contentType.toLowerCase() === "image/heif";

    if (isHeicFormat) {
      const s3 = new S3Client({ region: process.env.AWS_REGION });
      const bucket = process.env.S3_BUCKET;

      if (!bucket) {
        return res.status(500).json({ error: "S3_BUCKET environment variable is not set" });
      }

      try {
        // Download original HEIC/HEIF file from S3
        const getObjectResponse = await s3.send(
          new GetObjectCommand({
            Bucket: bucket,
            Key: s3Key,
          })
        );

        if (!getObjectResponse.Body) {
          throw new Error("Failed to download file from S3");
        }

        // Convert stream to buffer
        const heicBuffer = await streamToBuffer(getObjectResponse.Body);

        // Convert HEIC/HEIF to JPEG using sharp
        // For Live Photos: sharp extracts the static cover image (key frame)
        const jpegBuffer = await sharp(heicBuffer)
          .jpeg({ quality: 90 })
          .toBuffer();

        // Generate new S3 key with .jpg extension
        const newKey = s3Key.replace(/\.(heic|heif)$/i, ".jpg");
        const newFilename = filename.replace(/\.(heic|heif)$/i, ".jpg");

        // Upload converted JPEG to S3 (replaces original)
        await s3.send(
          new PutObjectCommand({
            Bucket: bucket,
            Key: newKey,
            Body: jpegBuffer,
            ContentType: "image/jpeg",
          })
        );

        // Delete original HEIC/HEIF file
        try {
          await s3.send(
            new DeleteObjectCommand({
              Bucket: bucket,
              Key: s3Key,
            })
          );
        } catch (deleteError) {
          // Log but don't fail if deletion fails (original might not exist or already deleted)
          console.warn("Failed to delete original HEIC file:", deleteError);
        }

        // Update values for database storage
        s3Key = newKey;
        filename = newFilename;
        contentType = "image/jpeg";
        size = jpegBuffer.length;

        // Update public URL (replace extension in URL)
        const publicBaseUrl = process.env.S3_PUBLIC_BASE_URL;
        publicUrl = publicBaseUrl
          ? `${publicBaseUrl}/${newKey}`
          : `https://${bucket}.s3.${process.env.AWS_REGION}.amazonaws.com/${newKey}`;
      } catch (conversionError: any) {
        console.error("Failed to convert HEIC/HEIF to JPEG:", conversionError);
        // If conversion fails, save original HEIC but log the error
        // User will see the file but it may not display in browser
        // Future: Could return error and ask user to retry with JPEG
      }
    }

    // Insert photo record (with converted values if conversion happened)
    await db.insert(photos).values({
      userId,
      s3Key,
      publicUrl,
      filename,
      contentType,
      size,
      isShared: false, // Default to not shared
      uploadedAt: parsed.data.uploadedAt ? new Date(parsed.data.uploadedAt) : new Date(),
    });

    return res.status(200).json({ ok: true });
  } catch (error: any) {
    console.error("Failed to save photo metadata:", error);
    return res.status(500).json({ error: "Failed to save photo metadata", message: error.message });
  }
}
