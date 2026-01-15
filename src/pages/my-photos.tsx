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
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [toggling, setToggling] = useState(false);

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

  // Clear selection when filter changes
  useEffect(() => {
    setSelectedIds(new Set());
  }, [filter]);

  async function handleToggleShare(photoId: string) {
    if (toggling) return;

    setToggling(true);
    try {
      const res = await fetch("/api/my-photos/toggle-share", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ photoId }),
      });

      const data = await res.json();
      if (!res.ok) {
        setErr(data?.error ?? "Failed to toggle share status");
        return;
      }

      // Update the photo in the items array
      setItems((prev) =>
        prev.map((item) => (item.id === photoId ? { ...item, isShared: data.photo.isShared } : item))
      );
    } catch (error) {
      setErr("Failed to toggle share status");
    } finally {
      setToggling(false);
    }
  }

  async function handleBulkToggleShare(isShared: boolean) {
    if (toggling || selectedIds.size === 0) return;

    setToggling(true);
    try {
      const res = await fetch("/api/my-photos/toggle-share", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ photoIds: Array.from(selectedIds), isShared }),
      });

      const data = await res.json();
      if (!res.ok) {
        setErr(data?.error ?? "Failed to update photos");
        return;
      }

      // Update all affected photos in the items array
      const updatedIds = new Set(data.photos.map((p: { id: string }) => p.id));
      setItems((prev) =>
        prev.map((item) =>
          updatedIds.has(item.id) ? { ...item, isShared } : item
        )
      );

      // Clear selection
      setSelectedIds(new Set());
    } catch (error) {
      setErr("Failed to update photos");
    } finally {
      setToggling(false);
    }
  }

  function handleSelectPhoto(photoId: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(photoId)) {
        next.delete(photoId);
      } else {
        next.add(photoId);
      }
      return next;
    });
  }

  function handleSelectAll() {
    if (selectedIds.size === items.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(items.map((item) => item.id)));
    }
  }

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
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
          <h1 style={{ margin: 0 }}>My Photos</h1>
          {items.length > 0 && (
            <button
              onClick={handleSelectAll}
              style={{
                padding: "8px 16px",
                borderRadius: "4px",
                border: "1px solid #d1d5db",
                backgroundColor: "white",
                color: "#374151",
                cursor: "pointer",
                fontSize: "14px",
              }}
            >
              {selectedIds.size === items.length ? "Deselect All" : "Select All"}
            </button>
          )}
        </div>

        {/* Bulk Actions Bar */}
        {selectedIds.size > 0 && (
          <div
            style={{
              padding: "12px 16px",
              backgroundColor: "#f3f4f6",
              borderRadius: "4px",
              marginBottom: "24px",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: "8px",
            }}
          >
            <span style={{ fontSize: "14px", color: "#374151" }}>
              {selectedIds.size} photo{selectedIds.size !== 1 ? "s" : ""} selected
            </span>
            <div style={{ display: "flex", gap: "8px" }}>
              <button
                onClick={() => handleBulkToggleShare(true)}
                disabled={toggling}
                style={{
                  padding: "8px 16px",
                  borderRadius: "4px",
                  border: "none",
                  backgroundColor: "#10b981",
                  color: "white",
                  cursor: toggling ? "not-allowed" : "pointer",
                  fontSize: "14px",
                  opacity: toggling ? 0.6 : 1,
                }}
              >
                Share All
              </button>
              <button
                onClick={() => handleBulkToggleShare(false)}
                disabled={toggling}
                style={{
                  padding: "8px 16px",
                  borderRadius: "4px",
                  border: "none",
                  backgroundColor: "#6b7280",
                  color: "white",
                  cursor: toggling ? "not-allowed" : "pointer",
                  fontSize: "14px",
                  opacity: toggling ? 0.6 : 1,
                }}
              >
                Make Private
              </button>
              <button
                onClick={() => setSelectedIds(new Set())}
                disabled={toggling}
                style={{
                  padding: "8px 16px",
                  borderRadius: "4px",
                  border: "1px solid #d1d5db",
                  backgroundColor: "white",
                  color: "#374151",
                  cursor: toggling ? "not-allowed" : "pointer",
                  fontSize: "14px",
                  opacity: toggling ? 0.6 : 1,
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        )}

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
            {items.map((item) => {
              const isSelected = selectedIds.has(item.id);
              return (
                <div
                  key={item.id}
                  style={{
                    border: isSelected ? "2px solid #3b82f6" : "1px solid #ddd",
                    padding: 8,
                    position: "relative",
                    backgroundColor: isSelected ? "#eff6ff" : "white",
                  }}
                >
                  {/* Checkbox */}
                  <div style={{ position: "absolute", top: 8, left: 8, zIndex: 1 }}>
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => handleSelectPhoto(item.id)}
                      style={{ width: "18px", height: "18px", cursor: "pointer" }}
                    />
                  </div>

                  <img
                    src={item.publicUrl}
                    alt={item.filename}
                    style={{ width: "100%", height: 180, objectFit: "cover" }}
                    loading="lazy"
                  />
                  <div style={{ fontSize: 12, marginTop: 6 }}>{new Date(item.uploadedAt).toLocaleString()}</div>
                  <div style={{ fontSize: 11, marginTop: 4, display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
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
                  {/* Toggle button */}
                  <button
                    onClick={() => handleToggleShare(item.id)}
                    disabled={toggling}
                    style={{
                      marginTop: "8px",
                      padding: "4px 8px",
                      borderRadius: "3px",
                      border: "1px solid #d1d5db",
                      backgroundColor: "white",
                      color: "#374151",
                      cursor: toggling ? "not-allowed" : "pointer",
                      fontSize: "11px",
                      width: "100%",
                      opacity: toggling ? 0.6 : 1,
                    }}
                  >
                    {item.isShared ? "Make Private" : "Share"}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
