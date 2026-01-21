import { and, eq } from "drizzle-orm";
import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { db } from "../../../../../db";
import { framePhotos, frames } from "../../../../../db/schema";
import { getOrCreateUser } from "../../../../../lib/user";
import { authOptions } from "../../../auth/[...nextauth]";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "DELETE") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const session = await getServerSession(req, res, authOptions);
  if (!session) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const userId = await getOrCreateUser(session);
    const frameId = req.query.frameId as string;
    const photoId = req.query.photoId as string;

    if (!frameId || !photoId) {
      return res.status(400).json({ error: "Frame ID and Photo ID are required" });
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
      return res.status(403).json({ error: "You don't have permission to modify this frame" });
    }

    // Remove photo from frame
    const result = await db
      .delete(framePhotos)
      .where(and(eq(framePhotos.frameId, frameId), eq(framePhotos.photoId, photoId)))
      .returning({ id: framePhotos.id });

    if (result.length === 0) {
      return res.status(404).json({ error: "Photo not found in frame" });
    }

    return res.status(200).json({
      message: "Photo removed from frame successfully",
    });
  } catch (error: unknown) {
    console.error("Failed to remove photo from frame:", error);
    const message = error instanceof Error ? error.message : String(error);
    return res.status(500).json({
      error: "Failed to remove photo from frame",
      message,
    });
  }
}
