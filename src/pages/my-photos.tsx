import { useEffect, useState } from "react";
import { useSession, signIn } from "next-auth/react";
import Navigation from "../components/Navigation";

type PhotoItem = {
  id: string;
  key: string;
  publicUrl: string;
  filename: string;
  uploadedAt: string;
  isShared: boolean;
  frameId: string | null;
};

type FilterType = "all" | "shared" | "unshared";

export default function MyPhotosPage() {
  const { data: session, status } = useSession();
  const [items, setItems] = useState<PhotoItem[]>([]);
  const [err, setErr] = useState("");
  const [filter, setFilter] = useState<FilterType>("all");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (status === "loading") return;
    if (!session) return;

    async function fetchPhotos() {
      setLoading(true);
      setErr("");
      try {
        const url = `/api/my-photos${filter !== "all" ? `?filter=${filter}` : ""}`;
        const r = await fetch(url);
        const j = await r.json();
        if (!r.ok) {
          setErr(j?.error ?? "Failed to load photos");
          setItems([]);
        } else {
          setItems(j.items ?? []);
        }
      } catch (error) {
        setErr("Failed to load photos");
        setItems([]);
      } finally {
        setLoading(false);
      }
    }

    fetchPhotos();
  }, [session, status, filter]);

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
          <h1>My Photos</h1>
          <p>Please sign in to view your photos.</p>
          <button
            onClick={() => signIn("google")}
            style={{
              backgroundColor: "#3b82f6",
              color: "white",
              padding: "10px 20px",
              borderRadius: "4px",
              border: "none",
              cursor: "pointer",
              marginTop: "12px",
            }}
          >
            Sign in with Google
          </button>
        </div>
      </>
    );
  }

  return (
    <>
      <Navigation />
      <div style={{ padding: 24 }}>
        <h1>My Photos</h1>

        {/* Filter buttons */}
        <div style={{ display: "flex", gap: "8px", marginBottom: "24px", flexWrap: "wrap" }}>
          <button
            onClick={() => setFilter("all")}
            style={{
              padding: "8px 16px",
              borderRadius: "4px",
              border: "1px solid #d1d5db",
              backgroundColor: filter === "all" ? "#3b82f6" : "white",
              color: filter === "all" ? "white" : "#374151",
              cursor: "pointer",
              fontSize: "14px",
            }}
          >
            All
          </button>
          <button
            onClick={() => setFilter("shared")}
            style={{
              padding: "8px 16px",
              borderRadius: "4px",
              border: "1px solid #d1d5db",
              backgroundColor: filter === "shared" ? "#3b82f6" : "white",
              color: filter === "shared" ? "white" : "#374151",
              cursor: "pointer",
              fontSize: "14px",
            }}
          >
            Shared
          </button>
          <button
            onClick={() => setFilter("unshared")}
            style={{
              padding: "8px 16px",
              borderRadius: "4px",
              border: "1px solid #d1d5db",
              backgroundColor: filter === "unshared" ? "#3b82f6" : "white",
              color: filter === "unshared" ? "white" : "#374151",
              cursor: "pointer",
              fontSize: "14px",
            }}
          >
            Unshared
          </button>
        </div>

        {err && <p style={{ color: "#ef4444" }}>{err}</p>}

        {loading ? (
          <p>Loading photos...</p>
        ) : items.length === 0 ? (
          <p style={{ color: "#6b7280" }}>No photos found.</p>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 12 }}>
            {items.map((item) => (
              <div key={item.id} style={{ border: "1px solid #ddd", padding: 8, position: "relative" }}>
                <img
                  src={item.publicUrl}
                  alt={item.filename}
                  style={{ width: "100%", height: 180, objectFit: "cover" }}
                  loading="lazy"
                />
                <div style={{ fontSize: 12, marginTop: 6 }}>{new Date(item.uploadedAt).toLocaleString()}</div>
                <div style={{ fontSize: 11, marginTop: 4, display: "flex", gap: "8px", alignItems: "center" }}>
                  <span
                    style={{
                      padding: "2px 6px",
                      borderRadius: "3px",
                      backgroundColor: item.isShared ? "#10b981" : "#6b7280",
                      color: "white",
                      fontSize: "10px",
                    }}
                  >
                    {item.isShared ? "Shared" : "Private"}
                  </span>
                  {item.frameId && (
                    <span style={{ fontSize: "10px", color: "#6b7280" }}>Frame: {item.frameId}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
