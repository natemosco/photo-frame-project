import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { asc, desc, eq, inArray } from "drizzle-orm";
import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { db } from "../../../db";
import { framePhotos, frames, photos } from "../../../db/schema";
import { authOptions } from "../auth/[...nextauth]";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const session = await getServerSession(req, res, authOptions);
  if (!session) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    // Get all shared frames
    const sharedFrames = await db
      .select({
        id: frames.id,
        name: frames.name,
        createdAt: frames.createdAt,
        updatedAt: frames.updatedAt,
      })
      .from(frames)
      .where(eq(frames.isShared, true))
      .orderBy(desc(frames.createdAt));

    // Get photo count and cover photo for each frame
    const s3 = new S3Client({ region: process.env.AWS_REGION });
    const bucket = process.env.S3_BUCKET;

    const framesWithPhotoCounts = await Promise.all(
      sharedFrames.map(async (frame) => {
        // Get photo count
        const framePhotoRecords = await db
          .select({ photoId: framePhotos.photoId })
          .from(framePhotos)
          .where(eq(framePhotos.frameId, frame.id))
          .orderBy(asc(framePhotos.createdAt))
          .limit(1); // Get first photo for cover

        const photoCount = await db
          .select({ count: framePhotos.id })
          .from(framePhotos)
          .where(eq(framePhotos.frameId, frame.id));

        let coverPhotoUrl: string | null = null;

        // Get cover photo (first photo in frame)
        if (framePhotoRecords.length > 0 && bucket) {
          const firstPhotoId = framePhotoRecords[0].photoId;
          const coverPhoto = await db
            .select({ s3Key: photos.s3Key })
            .from(photos)
            .where(eq(photos.id, firstPhotoId))
            .limit(1);

          if (coverPhoto.length > 0) {
            const getCommand = new GetObjectCommand({
              Bucket: bucket,
              Key: coverPhoto[0].s3Key,
            });
            coverPhotoUrl = await getSignedUrl(s3, getCommand, { expiresIn: 3600 });
          }
        }

        return {
          ...frame,
          photoCount: photoCount.length,
          coverPhotoUrl,
          createdAt: frame.createdAt.toISOString(),
          updatedAt: frame.updatedAt.toISOString(),
        };
      })
    );

    return res.status(200).json({ frames: framesWithPhotoCounts });
  } catch (error: unknown) {
    console.error("Failed to fetch shared frames:", error);
    const message = error instanceof Error ? error.message : String(error);
    return res.status(500).json({
      error: "Failed to fetch shared frames",
      message,
    });
  }
}
