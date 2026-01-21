import { desc, eq } from "drizzle-orm";
import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { db } from "../../../db";
import { frames } from "../../../db/schema";
import { getOrCreateUser } from "../../../lib/user";
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
    const userId = await getOrCreateUser(session);

    // Get all frames for the user
    const userFrames = await db
      .select({
        id: frames.id,
        name: frames.name,
        isShared: frames.isShared,
        createdAt: frames.createdAt,
        updatedAt: frames.updatedAt,
      })
      .from(frames)
      .where(eq(frames.userId, userId))
      .orderBy(desc(frames.createdAt));

    return res.status(200).json({ frames: userFrames });
  } catch (error: unknown) {
    console.error("Failed to fetch frames:", error);
    const message = error instanceof Error ? error.message : String(error);
    return res.status(500).json({
      error: "Failed to fetch frames",
      message,
    });
  }
}
