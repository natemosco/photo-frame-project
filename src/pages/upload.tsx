import { useSession, signIn, signOut } from "next-auth/react";
import { useState } from "react";

export default function UploadPage() {
  const { data: session, status } = useSession();
  const [file, setFile] = useState<File | null>(null);
  const [msg, setMsg] = useState<string>("");

  if (status === "loading") return <div>Loading…</div>;

  if (!session) {
    return (
      <div style={{ padding: 24 }}>
        <h1>Upload</h1>
        <button onClick={() => signIn("google")}>Sign in with Google</button>
      </div>
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

    const { url, fields, key, publicUrl } = await presignRes.json();

    setMsg("Uploading to S3…");
    const formData = new FormData();
    Object.entries(fields).forEach(([k, v]) => formData.append(k, v as string));
    formData.append("file", file);

    const s3Res = await fetch(url, { method: "POST", body: formData });
    if (!s3Res.ok) {
      setMsg("Upload failed");
      return;
    }

    setMsg("Saving metadata…");
    const metaRes = await fetch("/api/gallery/append", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key, publicUrl, uploadedAt: new Date().toISOString() }),
    });

    if (!metaRes.ok) {
      setMsg("Uploaded, but failed to save metadata.");
      return;
    }

    setMsg("Done! Go to /gallery");
  }

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
        <div>Signed in as {session.user?.email}</div>
        <button onClick={() => signOut()}>Sign out</button>
      </div>

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
  );
}
