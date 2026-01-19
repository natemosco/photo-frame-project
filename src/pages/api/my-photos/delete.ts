import { DeleteObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { and, eq, inArray } from "drizzle-orm";
import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { z } from "zod";
import { db } from "../../../db";
import { photos } from "../../../db/schema";
import { getOrCreateUser } from "../../../lib/user";
import { authOptions } from "../auth/[...nextauth]";

const DeleteSchema = z.object({
  photoIds: z.array(z.string().uuid()).min(1),
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const session = await getServerSession(req, res, authOptions);
  if (!session) return res.status(401).json({ error: "Unauthorized" });

  try {
    // Get authenticated user's ID
    const userId = await getOrCreateUser(session);

    // Validate request body
    const parsed = DeleteSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: "Invalid request",
        details: parsed.error.flatten(),
      });
    }

    const { photoIds } = parsed.data;

    // Query photos to verify ownership and get S3 keys before deletion
    const photosToDelete = await db
      .select({
        id: photos.id,
        s3Key: photos.s3Key,
      })
      .from(photos)
      .where(and(eq(photos.userId, userId), inArray(photos.id, photoIds)));

    // Check if all requested photos were found and belong to the user
    if (photosToDelete.length === 0) {
      return res.status(404).json({
        error: "No photos found or you don't have permission to delete them",
      });
    }

    if (photosToDelete.length < photoIds.length) {
      // Some photos don't exist or don't belong to user
      return res.status(404).json({
        error: "Some photos were not found or you don't have permission to delete them",
        found: photosToDelete.length,
        requested: photoIds.length,
      });
    }

    // Extract S3 keys for deletion
    const s3Keys = photosToDelete.map((photo) => photo.s3Key);
    const photoIdsToDelete = photosToDelete.map((photo) => photo.id);

    // Delete photos from database in a single transaction
    await db
      .delete(photos)
      .where(and(eq(photos.userId, userId), inArray(photos.id, photoIdsToDelete)));

    // Delete files from S3
    const s3 = new S3Client({ region: process.env.AWS_REGION });
    const bucket = process.env.S3_BUCKET;

    if (!bucket) {
      console.error("S3_BUCKET environment variable is not set");
      // Database deletion already succeeded, so return success but log the error
      return res.status(200).json({
        deleted: photoIdsToDelete.length,
        message: "Photos deleted from database, but S3 deletion failed due to configuration error",
        warning: "S3_BUCKET environment variable is not set",
      });
    }

    // Execute S3 deletions in parallel
    const s3DeletionResults = await Promise.allSettled(
      s3Keys.map((key) =>
        s3.send(
          new DeleteObjectCommand({
            Bucket: bucket,
            Key: key,
          })
        )
      )
    );

    // Check for S3 deletion failures
    const s3Failures = s3DeletionResults.filter((result) => result.status === "rejected");
    if (s3Failures.length > 0) {
      console.error("Some S3 deletions failed:", s3Failures);
      // Log errors but don't fail the request since database deletion succeeded
      return res.status(200).json({
        deleted: photoIdsToDelete.length,
        message: "Photos deleted from database",
        warning: `${s3Failures.length} photo(s) could not be deleted from S3`,
      });
    }

    return res.status(200).json({
      deleted: photoIdsToDelete.length,
      message: "Photos deleted successfully",
    });
  } catch (error: unknown) {
    console.error("Failed to delete photos:", error);
    const message = error instanceof Error ? error.message : String(error);
    return res.status(500).json({
      error: "Failed to delete photos",
      message,
    });
  }
}
