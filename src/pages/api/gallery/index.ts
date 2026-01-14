import type { NextApiRequest, NextApiResponse } from "next";
import { db } from "../../../db";
import { photos, users } from "../../../db/schema";
import { eq, desc } from "drizzle-orm";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  try {
    // Query photos where isShared = true, ordered by uploadedAt descending
    const sharedPhotos = await db
      .select({
        key: photos.s3Key,
        publicUrl: photos.publicUrl,
        uploadedAt: photos.uploadedAt,
        uploaderEmail: users.email,
      })
      .from(photos)
      .innerJoin(users, eq(photos.userId, users.id))
      .where(eq(photos.isShared, true))
      .orderBy(desc(photos.uploadedAt));

    // Transform to match expected format (uploadedAt as ISO string)
    const items = sharedPhotos.map((photo) => ({
      key: photo.key,
      publicUrl: photo.publicUrl,
      uploadedAt: photo.uploadedAt.toISOString(),
      uploaderEmail: photo.uploaderEmail,
    }));

    return res.status(200).json({ items });
  } catch (error: any) {
    console.error("Failed to fetch gallery photos:", error);
    return res.status(500).json({ error: "Failed to fetch gallery photos", message: error.message });
  }
}
