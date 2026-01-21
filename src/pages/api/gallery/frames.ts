import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { desc, eq } from "drizzle-orm";
import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { db } from "../../../db";
import { framePhotos, frames } from "../../../db/schema";
import { authOptions } from "../auth/[...nextauth]";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const session = await getServerSession(req, res, authOptions);
  if (!session) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    // Get all shared frames
    const sharedFrames = await db
      .select({
        id: frames.id,
        name: frames.name,
        createdAt: frames.createdAt,
        updatedAt: frames.updatedAt,
      })
      .from(frames)
      .where(eq(frames.isShared, true))
      .orderBy(desc(frames.createdAt));

    // Get photo count for each frame
    const framesWithPhotoCounts = await Promise.all(
      sharedFrames.map(async (frame) => {
        const photoCount = await db
          .select({ count: framePhotos.id })
          .from(framePhotos)
          .where(eq(framePhotos.frameId, frame.id));

        return {
          ...frame,
          photoCount: photoCount.length,
          createdAt: frame.createdAt.toISOString(),
          updatedAt: frame.updatedAt.toISOString(),
        };
      })
    );

    return res.status(200).json({ frames: framesWithPhotoCounts });
  } catch (error: unknown) {
    console.error("Failed to fetch shared frames:", error);
    const message = error instanceof Error ? error.message : String(error);
    return res.status(500).json({
      error: "Failed to fetch shared frames",
      message,
    });
  }
}
