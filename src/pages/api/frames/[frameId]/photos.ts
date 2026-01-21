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
  // When true, any of the caller's private photos in photoIds will be
  // switched to shared (isShared=true) before being attached to the frame.
  // This is how the UI explicitly confirms that private photos may be
  // visible in frames and the gallery.
  makePrivatePhotosShared: z.boolean().optional().default(false),
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

    const { photoIds, makePrivatePhotosShared } = parsed.data;

    // Privacy rules:
    // - Only the authenticated user's photos can be attached to frames
    //   via this endpoint (even for collaborative frames).
    // - By default, only already-shared photos (isShared=true) can be
    //   attached.
    // - If makePrivatePhotosShared=true is provided, any of the caller's
    //   private photos in the request will first be updated to
    //   isShared=true and then attached.
    const userPhotos = await db
      .select({
        id: photos.id,
        isShared: photos.isShared,
      })
      .from(photos)
      .where(and(eq(photos.userId, userId), inArray(photos.id, photoIds)));

    if (userPhotos.length !== photoIds.length) {
      return res.status(400).json({
        error: "Some photos not found or you don't have permission to use them",
      });
    }

    const sharedPhotoIds = userPhotos.filter((p) => p.isShared).map((p) => p.id);
    const privatePhotoIds = userPhotos.filter((p) => !p.isShared).map((p) => p.id);

    let madeSharedCount = 0;

    if (privatePhotoIds.length > 0 && makePrivatePhotosShared) {
      const result = await db
        .update(photos)
        .set({
          isShared: true,
          updatedAt: new Date(),
        })
        .where(and(eq(photos.userId, userId), inArray(photos.id, privatePhotoIds)))
        .returning({ id: photos.id });

      madeSharedCount = result.length;
      // After promotion, all user photos in this request are effectively shared
      sharedPhotoIds.push(...privatePhotoIds);
    }

    // If there are still private photos and the caller did not explicitly
    // confirm promotion, block attaching them to the frame.
    if (privatePhotoIds.length > 0 && !makePrivatePhotosShared) {
      return res.status(400).json({
        error: "Private photos cannot be added to frames without confirmation.",
        privatePhotoCount: privatePhotoIds.length,
        sharedPhotoCount: sharedPhotoIds.length,
      });
    }

    const photosToAttach = [...sharedPhotoIds];

    // Check which photos are already in the frame
    const existingFramePhotos =
      photosToAttach.length > 0
        ? await db
            .select({ photoId: framePhotos.photoId })
            .from(framePhotos)
            .where(
              and(eq(framePhotos.frameId, frameId), inArray(framePhotos.photoId, photosToAttach))
            )
        : [];

    const existingPhotoIds = new Set(existingFramePhotos.map((fp) => fp.photoId));
    const newPhotoIds = photosToAttach.filter((id) => !existingPhotoIds.has(id));

    let attachedCount = 0;

    // Add only new photos to frame (handle duplicates gracefully)
    if (newPhotoIds.length > 0) {
      try {
        await db.insert(framePhotos).values(
          newPhotoIds.map((photoId) => ({
            frameId,
            photoId,
          }))
        );
        attachedCount = newPhotoIds.length;
      } catch (error) {
        // Ignore duplicate key errors (frame_photo_unique constraint)
        const errorMessage = error instanceof Error ? error.message : String(error);
        if (!errorMessage.includes("frame_photo_unique")) {
          throw error;
        }
      }
    }

    return res.status(200).json({
      added: attachedCount,
      skipped: existingPhotoIds.size,
      madeSharedCount,
      attachedCount,
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
