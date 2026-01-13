import type { NextApiRequest, NextApiResponse } from "next";
import { z } from "zod";
import { S3Client, GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";

const BodySchema = z.object({
  key: z.string().min(1),
  publicUrl: z.string().url(),
  uploadedAt: z.string().min(1),
});

async function streamToString(stream: any): Promise<string> {
  return await new Promise((resolve, reject) => {
    const chunks: any[] = [];
    stream.on("data", (chunk: any) => chunks.push(chunk));
    stream.on("error", reject);
    stream.on("end", () => resolve(Buffer.concat(chunks).toString("utf-8")));
  });
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const session = await getServerSession(req, res, authOptions);
  if (!session) return res.status(401).json({ error: "Unauthorized" });

  const parsed = BodySchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid payload", details: parsed.error.flatten() });

  const tenant = process.env.TENANT_ID ?? "demo";
  const indexKey = `${tenant}/index.json`;
  const s3 = new S3Client({ region: process.env.AWS_REGION });

  let items: any[] = [];
  try {
    const out = await s3.send(new GetObjectCommand({ Bucket: process.env.S3_BUCKET ?? "", Key: indexKey }));
    const body = await streamToString(out.Body);
    items = JSON.parse(body);
    if (!Array.isArray(items)) items = [];
  } catch {}

  const newItem = {
    ...parsed.data,
    uploaderEmail: session.user?.email ?? undefined,
  };

  items.unshift(newItem);

  await s3.send(
    new PutObjectCommand({
      Bucket: process.env.S3_BUCKET ?? "",
      Key: indexKey,
      Body: JSON.stringify(items, null, 2),
      ContentType: "application/json",
      CacheControl: "no-store",
    })
  );

  return res.status(200).json({ ok: true });
}
