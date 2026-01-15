import type { NextApiRequest, NextApiResponse } from "next";
import { z } from "zod";
import { db } from "../../../db";
import { photos } from "../../../db/schema";
import { eq, and, inArray } from "drizzle-orm";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import { getOrCreateUser } from "../../../lib/user";

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
        return res.status(404).json({ error: "No photos found or you don't have permission to update them" });
      }

      if (updatedPhotos.length < photoIds.length) {
        // Some photos weren't updated (don't belong to user or don't exist)
        return res.status(200).json({
          ok: true,
          updated: updatedPhotos.length,
          requested: photoIds.length,
          warning: "Some photos could not be updated",
          photos: updatedPhotos,
        });
      }

      return res.status(200).json({
        ok: true,
        updated: updatedPhotos.length,
        photos: updatedPhotos,
      });
    } else {
      // Single toggle: flip the current isShared value
      const { photoId } = singleParse.data;

      // First, get the current photo to check ownership and current state
      const photo = await db.query.photos.findFirst({
        where: and(eq(photos.id, photoId), eq(photos.userId, userId)),
        columns: {
          id: true,
          isShared: true,
        },
      });

      if (!photo) {
        return res.status(404).json({ error: "Photo not found or you don't have permission to update it" });
      }

      // Toggle the isShared value
      const newIsShared = !photo.isShared;

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

      return res.status(200).json({
        ok: true,
        updated: 1,
        photo: updatedPhoto,
      });
    }
  } catch (error: any) {
    console.error("Failed to toggle share status:", error);
    return res.status(500).json({ error: "Failed to toggle share status", message: error.message });
  }
}
