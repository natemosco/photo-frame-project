import type { NextApiRequest, NextApiResponse } from "next";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";

async function streamToString(stream: any): Promise<string> {
  return await new Promise((resolve, reject) => {
    const chunks: any[] = [];
    stream.on("data", (chunk: any) => chunks.push(chunk));
    stream.on("error", reject);
    stream.on("end", () => resolve(Buffer.concat(chunks).toString("utf-8")));
  });
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const tenant = process.env.TENANT_ID ?? "demo";
  const indexKey = `${tenant}/index.json`;

  const s3 = new S3Client({ region: process.env.AWS_REGION });

  try {
    const out = await s3.send(
      new GetObjectCommand({
        Bucket: process.env.S3_BUCKET ?? "",
        Key: indexKey,
      })
    );

    const body = await streamToString(out.Body);
    const items = JSON.parse(body);
    return res.status(200).json({ items });
  } catch (err: any) {
    // If missing, return empty list
    return res.status(200).json({ items: [] });
  }
}
