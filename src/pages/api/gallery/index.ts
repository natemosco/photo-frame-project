import type { NextApiRequest, NextApiResponse } from "next";
import { db } from "../../../db";
import { photos, users } from "../../../db/schema";
import { eq, desc } from "drizzle-orm";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  try {
    // Gallery shows only shared photos (isShared = true) - public view
    // Future: Will also display photo frames when frame feature is implemented
    // Query photos where isShared = true, ordered by uploadedAt descending
    const sharedPhotos = await db
      .select({
        key: photos.s3Key,
        publicUrl: photos.publicUrl,
        uploadedAt: photos.uploadedAt,
        uploaderEmail: users.email,
      })
      .from(photos)
      .innerJoin(users, eq(photos.userId, users.id))
      .where(eq(photos.isShared, true))
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
      sharedPhotos.map(async (photo) => {
        // Generate presigned GET URL
        const getCommand = new GetObjectCommand({
          Bucket: bucket,
          Key: photo.key,
        });
        const presignedUrl = await getSignedUrl(s3, getCommand, { expiresIn: 3600 });

        return {
          key: photo.key,
          publicUrl: presignedUrl, // Use presigned URL instead of stored publicUrl
          uploadedAt: photo.uploadedAt.toISOString(),
          uploaderEmail: photo.uploaderEmail,
        };
      })
    );

    return res.status(200).json({ items });
  } catch (error: any) {
    console.error("Failed to fetch gallery photos:", error);
    return res.status(500).json({ error: "Failed to fetch gallery photos", message: error.message });
  }
}
