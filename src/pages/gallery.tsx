import { useEffect, useState } from "react";
import Navigation from "../components/Navigation";

type GalleryItem = {
  key: string;
  publicUrl: string;
  uploadedAt: string;
  uploaderEmail?: string;
};

export default function GalleryPage() {
  const [items, setItems] = useState<GalleryItem[]>([]);
  const [err, setErr] = useState("");

  useEffect(() => {
    (async () => {
      const r = await fetch("/api/gallery");
      const j = await r.json();
      if (!r.ok) setErr(j?.error ?? "Failed to load");
      setItems(j.items ?? []);
    })();
  }, []);

  return (
    <>
      <Navigation />
      <div style={{ padding: 24 }}>
        <h1>Gallery</h1>
        {err && <p>{err}</p>}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 12 }}>
        {items.map((it) => (
          <div key={it.key} style={{ border: "1px solid #ddd", padding: 8 }}>
            <img src={it.publicUrl} alt={it.key} style={{ width: "100%", height: 180, objectFit: "cover" }} loading="lazy" />
            <div style={{ fontSize: 12, marginTop: 6 }}>{new Date(it.uploadedAt).toLocaleString()}</div>
            {it.uploaderEmail && <div style={{ fontSize: 12, opacity: 0.7 }}>{it.uploaderEmail}</div>}
          </div>
        ))}
      </div>
      </div>
    </>
  );
}
 