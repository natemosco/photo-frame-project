import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { and, desc, eq, inArray } from "drizzle-orm";
import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { db } from "../../../../db";
import { framePhotos, frames, photos } from "../../../../db/schema";
import { getOrCreateUser } from "../../../../lib/user";
import { authOptions } from "../../auth/[...nextauth]";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === "GET") {
    return handleGet(req, res);
  }
  if (req.method === "DELETE") {
    return handleDelete(req, res);
  }
  return res.status(405).json({ error: "Method not allowed" });
}

async function handleGet(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);
  if (!session) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const userId = await getOrCreateUser(session);
    const frameId = req.query.frameId as string;

    if (!frameId) {
      return res.status(400).json({ error: "Frame ID is required" });
    }

    // Special virtual "All Photos" frame for the current user.
    if (frameId === "all") {
      // All shared photos owned by this user, randomized per request.
      const userSharedPhotos = await db
        .select({
          id: photos.id,
          s3Key: photos.s3Key,
          publicUrl: photos.publicUrl,
          filename: photos.filename,
          uploadedAt: photos.uploadedAt,
        })
        .from(photos)
        .where(and(eq(photos.userId, userId), eq(photos.isShared, true)))
        .orderBy(desc(photos.uploadedAt));

      // Shuffle photos on every request (Fisher–Yates).
      const shuffled = [...userSharedPhotos];
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }

      const s3 = new S3Client({ region: process.env.AWS_REGION });
      const bucket = process.env.S3_BUCKET;

      if (!bucket) {
        return res.status(500).json({ error: "S3_BUCKET environment variable is not set" });
      }

      const photosWithUrls = await Promise.all(
        shuffled.map(async (photo) => {
          const getCommand = new GetObjectCommand({
            Bucket: bucket,
            Key: photo.s3Key,
          });
          const presignedUrl = await getSignedUrl(s3, getCommand, { expiresIn: 3600 });

          return {
            id: photo.id,
            key: photo.s3Key,
            publicUrl: presignedUrl,
            filename: photo.filename,
            uploadedAt: photo.uploadedAt.toISOString(),
          };
        })
      );

      return res.status(200).json({
        frame: {
          id: "all",
          name: "All Photos",
          isShared: true,
          userId,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        photos: photosWithUrls,
      });
    }

    // Regular, persisted frame behavior
    const frame = await db
      .select({
        id: frames.id,
        name: frames.name,
        isShared: frames.isShared,
        userId: frames.userId,
        createdAt: frames.createdAt,
        updatedAt: frames.updatedAt,
      })
      .from(frames)
      .where(eq(frames.id, frameId))
      .limit(1);

    if (frame.length === 0) {
      return res.status(404).json({ error: "Frame not found" });
    }

    // Check if user has access (owner or frame is shared)
    if (frame[0].userId !== userId && !frame[0].isShared) {
      return res.status(403).json({ error: "You don't have permission to view this frame" });
    }

    // Get photos in frame
    const framePhotosList = await db
      .select({
        photoId: framePhotos.photoId,
        createdAt: framePhotos.createdAt,
      })
      .from(framePhotos)
      .where(eq(framePhotos.frameId, frameId))
      .orderBy(desc(framePhotos.createdAt));

    const photoIds = framePhotosList.map((fp) => fp.photoId);

    if (photoIds.length === 0) {
      return res.status(200).json({
        frame: frame[0],
        photos: [],
      });
    }

    // Get photo details using inArray
    const framePhotosData = await db
      .select({
        id: photos.id,
        s3Key: photos.s3Key,
        publicUrl: photos.publicUrl,
        filename: photos.filename,
        uploadedAt: photos.uploadedAt,
      })
      .from(photos)
      .where(inArray(photos.id, photoIds));

    // Maintain order from framePhotosList
    const photosMap = new Map(framePhotosData.map((p) => [p.id, p]));
    const orderedPhotos = photoIds
      .map((id) => photosMap.get(id))
      .filter((p): p is NonNullable<typeof p> => p !== undefined);

    // Generate presigned URLs
    const s3 = new S3Client({ region: process.env.AWS_REGION });
    const bucket = process.env.S3_BUCKET;

    if (!bucket) {
      return res.status(500).json({ error: "S3_BUCKET environment variable is not set" });
    }

    const photosWithUrls = await Promise.all(
      orderedPhotos.map(async (photo) => {
        const getCommand = new GetObjectCommand({
          Bucket: bucket,
          Key: photo.s3Key,
        });
        const presignedUrl = await getSignedUrl(s3, getCommand, { expiresIn: 3600 });

        return {
          id: photo.id,
          key: photo.s3Key,
          publicUrl: presignedUrl,
          filename: photo.filename,
          uploadedAt: photo.uploadedAt.toISOString(),
        };
      })
    );

    return res.status(200).json({
      frame: frame[0],
      photos: photosWithUrls,
    });
  } catch (error: unknown) {
    console.error("Failed to fetch frame:", error);
    const message = error instanceof Error ? error.message : String(error);
    return res.status(500).json({
      error: "Failed to fetch frame",
      message,
    });
  }
}

async function handleDelete(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);
  if (!session) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const userId = await getOrCreateUser(session);
    const frameId = req.query.frameId as string;

    if (!frameId) {
      return res.status(400).json({ error: "Frame ID is required" });
    }

    // Verify frame belongs to user
    const frame = await db
      .select({ id: frames.id, userId: frames.userId })
      .from(frames)
      .where(eq(frames.id, frameId))
      .limit(1);

    if (frame.length === 0) {
      return res.status(404).json({ error: "Frame not found" });
    }

    if (frame[0].userId !== userId) {
      return res.status(403).json({ error: "You don't have permission to delete this frame" });
    }

    // Delete frame (cascade will handle frame_photos)
    await db.delete(frames).where(eq(frames.id, frameId));

    return res.status(200).json({
      message: "Frame deleted successfully",
    });
  } catch (error: unknown) {
    console.error("Failed to delete frame:", error);
    const message = error instanceof Error ? error.message : String(error);
    return res.status(500).json({
      error: "Failed to delete frame",
      message,
    });
  }
}
