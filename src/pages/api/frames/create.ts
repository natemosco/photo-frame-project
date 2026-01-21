import { and, eq, inArray } from "drizzle-orm";
import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { z } from "zod";
import { db } from "../../../db";
import { framePhotos, frames, photos } from "../../../db/schema";
import { getOrCreateUser } from "../../../lib/user";
import { authOptions } from "../auth/[...nextauth]";

const CreateFrameSchema = z.object({
  name: z.string().min(1).max(200),
  photoIds: z.array(z.string().uuid()).optional(),
  isShared: z.boolean().optional().default(true), // Default to true for collaborative frames
  // When true, any of the caller's private photos in photoIds will be
  // switched to shared (isShared=true) before being attached to the frame.
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

    // Validate request body
    const parsed = CreateFrameSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: "Invalid request",
        details: parsed.error.flatten(),
      });
    }

    const { name, photoIds, isShared, makePrivatePhotosShared } = parsed.data;

    let madeSharedCount = 0;
    let photosToAttach: string[] = [];

    // Verify all photos belong to the user if photoIds provided and enforce
    // that only shared photos are attached unless explicitly promoted.
    if (photoIds && photoIds.length > 0) {
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
        sharedPhotoIds.push(...privatePhotoIds);
      }

      if (privatePhotoIds.length > 0 && !makePrivatePhotosShared) {
        return res.status(400).json({
          error: "Private photos cannot be added to frames without confirmation.",
          privatePhotoCount: privatePhotoIds.length,
          sharedPhotoCount: sharedPhotoIds.length,
        });
      }

      photosToAttach = sharedPhotoIds;
    }

    // Create the frame
    const [newFrame] = await db
      .insert(frames)
      .values({
        userId,
        name,
        isShared: isShared ?? false,
      })
      .returning({
        id: frames.id,
        name: frames.name,
        isShared: frames.isShared,
        createdAt: frames.createdAt,
        updatedAt: frames.updatedAt,
      });

    let attachedCount = 0;

    // Add photos to frame if provided (handle duplicates gracefully)
    if (photosToAttach.length > 0) {
      try {
        await db.insert(framePhotos).values(
          photosToAttach.map((photoId) => ({
            frameId: newFrame.id,
            photoId,
          }))
        );
        attachedCount = photosToAttach.length;
      } catch (error) {
        // Ignore duplicate key errors (frame_photo_unique constraint)
        // This allows idempotent operations
        const errorMessage = error instanceof Error ? error.message : String(error);
        if (!errorMessage.includes("frame_photo_unique")) {
          throw error;
        }
      }
    }

    return res.status(201).json({
      frame: newFrame,
      madeSharedCount,
      attachedCount,
      message: "Frame created successfully",
    });
  } catch (error: unknown) {
    console.error("Failed to create frame:", error);
    const message = error instanceof Error ? error.message : String(error);
    return res.status(500).json({
      error: "Failed to create frame",
      message,
    });
  }
}
