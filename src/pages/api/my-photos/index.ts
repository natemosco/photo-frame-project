import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { type SQL, and, desc, eq } from "drizzle-orm";
import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { db } from "../../../db";
import { photos } from "../../../db/schema";
import { getOrCreateUser } from "../../../lib/user";
import { authOptions } from "../auth/[...nextauth]";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const session = await getServerSession(req, res, authOptions);
  if (!session) return res.status(401).json({ error: "Unauthorized" });

  try {
    // Get authenticated user's ID
    const userId = await getOrCreateUser(session);

    // Get filter from query parameter: all, shared, or unshared
    const filter = req.query.filter as string | undefined;

    // Build query conditions
    let whereCondition: SQL<unknown> | undefined = eq(photos.userId, userId);

    if (filter === "shared") {
      whereCondition = and(eq(photos.userId, userId), eq(photos.isShared, true));
    } else if (filter === "unshared") {
      whereCondition = and(eq(photos.userId, userId), eq(photos.isShared, false));
    }
    // If filter is "all" or undefined, show all user's photos

    // Query photos for the authenticated user
    const userPhotos = await db
      .select({
        id: photos.id,
        key: photos.s3Key,
        publicUrl: photos.publicUrl,
        filename: photos.filename,
        uploadedAt: photos.uploadedAt,
        isShared: photos.isShared,
        frameId: photos.frameId,
      })
      .from(photos)
      .where(whereCondition)
      .orderBy(desc(photos.uploadedAt));

    // Generate presigned GET URLs for each photo (valid for 1 hour)
    // This is needed because the S3 bucket blocks public access
    const s3 = new S3Client({ region: process.env.AWS_REGION });
    const bucket = process.env.S3_BUCKET;

    if (!bucket) {
      return res.status(500).json({ error: "S3_BUCKET environment variable is not set" });
    }

    // Transform to match expected format with presigned URLs
    const items = await Promise.all(
      userPhotos.map(async (photo) => {
        // Generate presigned GET URL
        const getCommand = new GetObjectCommand({
          Bucket: bucket,
          Key: photo.key,
        });
        const presignedUrl = await getSignedUrl(s3, getCommand, { expiresIn: 3600 });

        return {
          id: photo.id,
          key: photo.key,
          publicUrl: presignedUrl, // Use presigned URL instead of stored publicUrl
          filename: photo.filename,
          uploadedAt: photo.uploadedAt.toISOString(),
          isShared: photo.isShared,
          frameId: photo.frameId,
        };
      })
    );

    return res.status(200).json({ items });
  } catch (error: unknown) {
    console.error("Failed to fetch user photos:", error);
    const message = error instanceof Error ? error.message : String(error);
    return res.status(500).json({ error: "Failed to fetch user photos", message });
  }
}
