import type { NextApiRequest, NextApiResponse } from "next";
import { db } from "../../../db";
import { photos } from "../../../db/schema";
import { eq, desc, and, SQL } from "drizzle-orm";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import { getOrCreateUser } from "../../../lib/user";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const session = await getServerSession(req, res, authOptions);
  if (!session) return res.status(401).json({ error: "Unauthorized" });

  try {
    // Get authenticated user's ID
    const userId = await getOrCreateUser(session);

    // Get filter from query parameter: all, shared, or unshared
    const filter = req.query.filter as string | undefined;

    // Build query conditions
    let whereCondition: SQL<unknown> | undefined = eq(photos.userId, userId);

    if (filter === "shared") {
      whereCondition = and(eq(photos.userId, userId), eq(photos.isShared, true));
    } else if (filter === "unshared") {
      whereCondition = and(eq(photos.userId, userId), eq(photos.isShared, false));
    }
    // If filter is "all" or undefined, show all user's photos

    // Query photos for the authenticated user
    const userPhotos = await db
      .select({
        id: photos.id,
        key: photos.s3Key,
        publicUrl: photos.publicUrl,
        filename: photos.filename,
        uploadedAt: photos.uploadedAt,
        isShared: photos.isShared,
        frameId: photos.frameId,
      })
      .from(photos)
      .where(whereCondition)
      .orderBy(desc(photos.uploadedAt));

    // Transform to match expected format (uploadedAt as ISO string)
    const items = userPhotos.map((photo) => ({
      id: photo.id,
      key: photo.key,
      publicUrl: photo.publicUrl,
      filename: photo.filename,
      uploadedAt: photo.uploadedAt.toISOString(),
      isShared: photo.isShared,
      frameId: photo.frameId,
    }));

    return res.status(200).json({ items });
  } catch (error: any) {
    console.error("Failed to fetch user photos:", error);
    return res.status(500).json({ error: "Failed to fetch user photos", message: error.message });
  }
}
