import { and, count, eq, inArray } from "drizzle-orm";
import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { z } from "zod";
import { db } from "../../../db";
import { framePhotos, photos } from "../../../db/schema";
import { getOrCreateUser } from "../../../lib/user";
import { authOptions } from "../auth/[...nextauth]";

// Schema for single photo toggle
const SingleToggleSchema = z.object({
  photoId: z.string().uuid(),
});

// Schema for bulk toggle
const BulkToggleSchema = z.object({
  photoIds: z.array(z.string().uuid()).min(1),
  isShared: z.boolean(),
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const session = await getServerSession(req, res, authOptions);
  if (!session) return res.status(401).json({ error: "Unauthorized" });

  try {
    // Get authenticated user's ID
    const userId = await getOrCreateUser(session);

    // Try to parse as bulk toggle first, then single toggle
    const bulkParse = BulkToggleSchema.safeParse(req.body);
    const singleParse = SingleToggleSchema.safeParse(req.body);

    if (!bulkParse.success && !singleParse.success) {
      return res.status(400).json({
        error: "Invalid request",
        details: bulkParse.error?.flatten() || singleParse.error?.flatten(),
      });
    }

    if (bulkParse.success) {
      // Bulk toggle: set specific isShared value for multiple photos
      const { photoIds, isShared } = bulkParse.data;

      // Before updating, query frame counts for warning (only if setting to private)
      let frameCounts: Array<{ photoId: string; frameCount: number }> = [];
      let totalFramesAffected = 0;

      if (!isShared) {
        // Query frame counts per photo before making private
        const frameCountResults = await db
          .select({
            photoId: framePhotos.photoId,
            frameCount: count(),
          })
          .from(framePhotos)
          .where(inArray(framePhotos.photoId, photoIds))
          .groupBy(framePhotos.photoId);

        frameCounts = frameCountResults.map((r) => ({
          photoId: r.photoId,
          frameCount: Number(r.frameCount),
        }));

        totalFramesAffected = frameCountResults.reduce((sum, r) => sum + Number(r.frameCount), 0);
      }

      // Verify all photos belong to the user and update them
      const updatedPhotos = await db
        .update(photos)
        .set({
          isShared,
          updatedAt: new Date(),
        })
        .where(and(inArray(photos.id, photoIds), eq(photos.userId, userId)))
        .returning({
          id: photos.id,
          isShared: photos.isShared,
        });

      if (updatedPhotos.length === 0) {
        return res
          .status(404)
          .json({ error: "No photos found or you don't have permission to update them" });
      }

      // If setting to private, remove photos from all frames
      let removedFromFrames = 0;
      if (!isShared && updatedPhotos.length > 0) {
        const updatedPhotoIds = updatedPhotos.map((p) => p.id);
        const deleteResult = await db
          .delete(framePhotos)
          .where(inArray(framePhotos.photoId, updatedPhotoIds))
          .returning({ id: framePhotos.id });

        removedFromFrames = deleteResult.length;
      }

      if (updatedPhotos.length < photoIds.length) {
        // Some photos weren't updated (don't belong to user or don't exist)
        return res.status(200).json({
          ok: true,
          updated: updatedPhotos.length,
          requested: photoIds.length,
          warning: "Some photos could not be updated",
          photos: updatedPhotos,
          frameCounts,
          removedFromFrames,
        });
      }

      return res.status(200).json({
        ok: true,
        updated: updatedPhotos.length,
        photos: updatedPhotos,
        frameCounts,
        removedFromFrames,
      });
    }
    // Single toggle: flip the current isShared value
    const { photoId } = singleParse.data as { photoId: string };

    // First, get the current photo to check ownership and current state
    const photo = await db.query.photos.findFirst({
      where: and(eq(photos.id, photoId), eq(photos.userId, userId)),
      columns: {
        id: true,
        isShared: true,
      },
    });

    if (!photo) {
      return res
        .status(404)
        .json({ error: "Photo not found or you don't have permission to update it" });
    }

    // Toggle the isShared value
    const newIsShared = !photo.isShared;

    // Before updating, query frame count if making private
    let frameCount = 0;
    let removedFromFrames = 0;

    if (!newIsShared) {
      // Query frame count before making private
      const frameCountResult = await db
        .select({ count: count() })
        .from(framePhotos)
        .where(eq(framePhotos.photoId, photoId));

      frameCount = frameCountResult[0] ? Number(frameCountResult[0].count) : 0;
    }

    const [updatedPhoto] = await db
      .update(photos)
      .set({
        isShared: newIsShared,
        updatedAt: new Date(),
      })
      .where(and(eq(photos.id, photoId), eq(photos.userId, userId)))
      .returning({
        id: photos.id,
        isShared: photos.isShared,
      });

    // If setting to private, remove photo from all frames
    if (!newIsShared && frameCount > 0) {
      const deleteResult = await db
        .delete(framePhotos)
        .where(eq(framePhotos.photoId, photoId))
        .returning({ id: framePhotos.id });

      removedFromFrames = deleteResult.length;
    }

    return res.status(200).json({
      ok: true,
      updated: 1,
      photo: updatedPhoto,
      frameCount,
      removedFromFrames,
    });
  } catch (error: unknown) {
    console.error("Failed to toggle share status:", error);
    const message = error instanceof Error ? error.message : String(error);
    return res.status(500).json({ error: "Failed to toggle share status", message });
  }
}
