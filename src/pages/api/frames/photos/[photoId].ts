import { eq } from "drizzle-orm";
import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { db } from "../../../../db";
import { framePhotos, frames, photos } from "../../../../db/schema";
import { getOrCreateUser } from "../../../../lib/user";
import { authOptions } from "../../auth/[...nextauth]";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const session = await getServerSession(req, res, authOptions);
  if (!session) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const userId = await getOrCreateUser(session);
    const photoId = req.query.photoId as string;

    if (!photoId) {
      return res.status(400).json({ error: "Photo ID is required" });
    }

    // Verify photo belongs to user
    const photo = await db
      .select({ id: photos.id, userId: photos.userId })
      .from(photos)
      .where(eq(photos.id, photoId))
      .limit(1);

    if (photo.length === 0) {
      return res.status(404).json({ error: "Photo not found" });
    }

    if (photo[0].userId !== userId) {
      return res.status(403).json({ error: "You don't have permission to view this photo" });
    }

    // Get all frames containing this photo
    const framesWithPhoto = await db
      .select({
        frameId: framePhotos.frameId,
        frameName: frames.name,
        frameIsShared: frames.isShared,
        createdAt: framePhotos.createdAt,
      })
      .from(framePhotos)
      .innerJoin(frames, eq(framePhotos.frameId, frames.id))
      .where(eq(framePhotos.photoId, photoId));

    return res.status(200).json({
      frames: framesWithPhoto.map((f) => ({
        id: f.frameId,
        name: f.frameName,
        isShared: f.frameIsShared,
        addedAt: f.createdAt.toISOString(),
      })),
    });
  } catch (error: unknown) {
    console.error("Failed to fetch frames for photo:", error);
    const message = error instanceof Error ? error.message : String(error);
    return res.status(500).json({
      error: "Failed to fetch frames for photo",
      message,
    });
  }
}
