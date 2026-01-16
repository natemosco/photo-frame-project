import type { NextApiRequest, NextApiResponse } from "next";
import { z } from "zod";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import { getOrCreateUser } from "../../../lib/user";
import { db } from "../../../db";
import { photos } from "../../../db/schema";

const BodySchema = z.object({
  key: z.string().min(1),
  publicUrl: z.string().url(),
  filename: z.string().min(1),
  contentType: z.string().min(1),
  size: z.number().positive(),
  uploadedAt: z.string().optional(),
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const session = await getServerSession(req, res, authOptions);
  if (!session) return res.status(401).json({ error: "Unauthorized" });

  const parsed = BodySchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid payload", details: parsed.error.flatten() });

  try {
    // Get or create user in database
    const userId = await getOrCreateUser(session);

    // Insert photo record
    await db.insert(photos).values({
      userId,
      s3Key: parsed.data.key,
      publicUrl: parsed.data.publicUrl,
      filename: parsed.data.filename,
      contentType: parsed.data.contentType,
      size: parsed.data.size,
      isShared: false, // Default to not shared
      uploadedAt: parsed.data.uploadedAt ? new Date(parsed.data.uploadedAt) : new Date(),
    });

    return res.status(200).json({ ok: true });
  } catch (error: any) {
    console.error("Failed to save photo metadata:", error);
    return res.status(500).json({ error: "Failed to save photo metadata", message: error.message });
  }
}
