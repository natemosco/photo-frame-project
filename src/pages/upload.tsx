import { useSession } from "next-auth/react";
import { useState } from "react";
import Navigation from "../components/Navigation";

export default function UploadPage() {
  const { data: session, status } = useSession();
  const [file, setFile] = useState<File | null>(null);
  const [msg, setMsg] = useState<string>("");

  if (status === "loading") {
    return (
      <>
        <Navigation />
        <div style={{ padding: 24 }}>Loading…</div>
      </>
    );
  }

  if (!session) {
    return (
      <>
        <Navigation />
        <div style={{ padding: 24 }}>
          <h1>Upload</h1>
          <p>Please sign in to upload photos.</p>
        </div>
      </>
    );
  }

  async function onUpload() {
    if (!file) return;

    setMsg("Requesting upload…");
    const presignRes = await fetch("/api/uploads/presign", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ filename: file.name, contentType: file.type, size: file.size }),
    });

    if (!presignRes.ok) {
      const e = await presignRes.json().catch(() => ({}));
      setMsg(e?.error ?? "Failed to presign");
      return;
    }

    const { url, key, publicUrl } = await presignRes.json();

    setMsg("Uploading to S3…");
    const s3Res = await fetch(url, {
      method: "PUT",
      body: file,
      headers: {
        "Content-Type": file.type,
      },
    });
    if (!s3Res.ok) {
      setMsg("Upload failed");
      return;
    }

    setMsg("Saving metadata…");
    const metaRes = await fetch("/api/gallery/append", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        key,
        publicUrl,
        filename: file.name,
        contentType: file.type,
        size: file.size,
        uploadedAt: new Date().toISOString(),
      }),
    });

    if (!metaRes.ok) {
      setMsg("Uploaded, but failed to save metadata.");
      return;
    }

    setMsg("Done! Go to /gallery");
  }

  return (
    <>
      <Navigation />
      <div style={{ padding: 24 }}>
        <h1 style={{ marginTop: 16 }}>Upload a photo (≤ 10MB)</h1>

      <input
        type="file"
        accept="image/*"
        onChange={(e) => setFile(e.target.files?.[0] ?? null)}
      />

      <div style={{ marginTop: 12 }}>
        <button disabled={!file} onClick={onUpload}>Upload</button>
      </div>

        <p style={{ marginTop: 12 }}>{msg}</p>
      </div>
    </>
  );
}
