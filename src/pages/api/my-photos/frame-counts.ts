import { and, count, eq, inArray } from "drizzle-orm";
import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { z } from "zod";
import { db } from "../../../db";
import { framePhotos, photos } from "../../../db/schema";
import { getOrCreateUser } from "../../../lib/user";
import { authOptions } from "../auth/[...nextauth]";

const FrameCountsSchema = z.object({
  photoIds: z.array(z.string().uuid()).min(1),
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const session = await getServerSession(req, res, authOptions);
  if (!session) return res.status(401).json({ error: "Unauthorized" });

  try {
    // Get authenticated user's ID
    const userId = await getOrCreateUser(session);

    const parseResult = FrameCountsSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        error: "Invalid request",
        details: parseResult.error.flatten(),
      });
    }

    const { photoIds } = parseResult.data;

    // Verify all photos belong to the user
    const userPhotos = await db.query.photos.findMany({
      where: and(inArray(photos.id, photoIds), eq(photos.userId, userId)),
      columns: { id: true },
    });

    const userPhotoIds = userPhotos.map((p) => p.id);
    if (userPhotoIds.length === 0) {
      return res.status(404).json({ error: "No photos found or you don't have permission" });
    }

    // Query frame counts per photo
    const frameCountResults = await db
      .select({
        photoId: framePhotos.photoId,
        frameCount: count(),
      })
      .from(framePhotos)
      .where(inArray(framePhotos.photoId, userPhotoIds))
      .groupBy(framePhotos.photoId);

    const frameCounts = frameCountResults.map((r) => ({
      photoId: r.photoId,
      frameCount: Number(r.frameCount),
    }));

    // Include photos with 0 frames
    const allCounts = userPhotoIds.map((id) => {
      const found = frameCounts.find((fc) => fc.photoId === id);
      return {
        photoId: id,
        frameCount: found ? found.frameCount : 0,
      };
    });

    const totalFramesAffected = allCounts.reduce((sum, fc) => sum + fc.frameCount, 0);

    return res.status(200).json({
      ok: true,
      frameCounts: allCounts,
      totalFramesAffected,
    });
  } catch (error: unknown) {
    console.error("Failed to get frame counts:", error);
    const message = error instanceof Error ? error.message : String(error);
    return res.status(500).json({ error: "Failed to get frame counts", message });
  }
}
