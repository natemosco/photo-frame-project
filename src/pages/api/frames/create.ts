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
  isShared: z.boolean().optional().default(false),
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

    const { name, photoIds, isShared } = parsed.data;

    // Verify all photos belong to the user if photoIds provided
    if (photoIds && photoIds.length > 0) {
      const userPhotos = await db
        .select({ id: photos.id })
        .from(photos)
        .where(and(eq(photos.userId, userId), inArray(photos.id, photoIds)));

      if (userPhotos.length !== photoIds.length) {
        return res.status(400).json({
          error: "Some photos not found or you don't have permission to use them",
        });
      }
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

    // Add photos to frame if provided
    if (photoIds && photoIds.length > 0) {
      await db.insert(framePhotos).values(
        photoIds.map((photoId) => ({
          frameId: newFrame.id,
          photoId,
        }))
      );
    }

    return res.status(201).json({
      frame: newFrame,
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
