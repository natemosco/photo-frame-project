import { and, eq, inArray } from "drizzle-orm";
import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { z } from "zod";
import { db } from "../../../../db";
import { framePhotos, frames, photos } from "../../../../db/schema";
import { getOrCreateUser } from "../../../../lib/user";
import { authOptions } from "../../auth/[...nextauth]";

const AddPhotosSchema = z.object({
  photoIds: z.array(z.string().uuid()).min(1),
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

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

    // Verify frame exists and check permissions
    const frame = await db
      .select({ id: frames.id, userId: frames.userId, isShared: frames.isShared })
      .from(frames)
      .where(eq(frames.id, frameId))
      .limit(1);

    if (frame.length === 0) {
      return res.status(404).json({ error: "Frame not found" });
    }

    // Allow if frame is shared (collaborative) OR user is the owner
    if (!frame[0].isShared && frame[0].userId !== userId) {
      return res.status(403).json({ error: "You don't have permission to modify this frame" });
    }

    // Validate request body
    const parsed = AddPhotosSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: "Invalid request",
        details: parsed.error.flatten(),
      });
    }

    const { photoIds } = parsed.data;

    // Verify all photos exist (for collaborative frames, any user can add any photo)
    const existingPhotos = await db
      .select({ id: photos.id })
      .from(photos)
      .where(inArray(photos.id, photoIds));

    if (existingPhotos.length !== photoIds.length) {
      return res.status(400).json({
        error: "Some photos not found",
      });
    }

    // Check which photos are already in the frame
    const existingFramePhotos = await db
      .select({ photoId: framePhotos.photoId })
      .from(framePhotos)
      .where(and(eq(framePhotos.frameId, frameId), inArray(framePhotos.photoId, photoIds)));

    const existingPhotoIds = new Set(existingFramePhotos.map((fp) => fp.photoId));
    const newPhotoIds = photoIds.filter((id) => !existingPhotoIds.has(id));

    // Add only new photos to frame (handle duplicates gracefully)
    if (newPhotoIds.length > 0) {
      try {
        await db.insert(framePhotos).values(
          newPhotoIds.map((photoId) => ({
            frameId,
            photoId,
          }))
        );
      } catch (error) {
        // Ignore duplicate key errors (frame_photo_unique constraint)
        const errorMessage = error instanceof Error ? error.message : String(error);
        if (!errorMessage.includes("frame_photo_unique")) {
          throw error;
        }
      }
    }

    return res.status(200).json({
      added: newPhotoIds.length,
      skipped: existingPhotoIds.size,
      message: "Photos added to frame successfully",
    });
  } catch (error: unknown) {
    console.error("Failed to add photos to frame:", error);
    const message = error instanceof Error ? error.message : String(error);
    return res.status(500).json({
      error: "Failed to add photos to frame",
      message,
    });
  }
}
