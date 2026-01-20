import type { GetServerSideProps } from "next";
import { getServerSession } from "next-auth/next";
import { signIn, useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import Navigation from "../components/Navigation";
import { authOptions } from "./api/auth/[...nextauth]";

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
  const [deleting, setDeleting] = useState(false);
  const [deletionConfirm, setDeletionConfirm] = useState<{ open: boolean; photoIds: string[] }>({
    open: false,
    photoIds: [],
  });

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
  }, []);

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
        prev.map((item) =>
          item.id === photoId ? { ...item, isShared: data.photo.isShared } : item
        )
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
        prev.map((item) => (updatedIds.has(item.id) ? { ...item, isShared } : item))
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

  function handleDelete(photoIds: string[]) {
    setDeletionConfirm({ open: true, photoIds });
  }

  async function handleConfirmDelete() {
    if (deleting || deletionConfirm.photoIds.length === 0) return;

    setDeleting(true);
    setErr("");
    try {
      const res = await fetch("/api/my-photos/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ photoIds: deletionConfirm.photoIds }),
      });

      const data = await res.json();
      if (!res.ok) {
        setErr(data?.error ?? "Failed to delete photos");
        return;
      }

      // Remove deleted photos from the items array
      const deletedIds = new Set(deletionConfirm.photoIds);
      setItems((prev) => prev.filter((item) => !deletedIds.has(item.id)));

      // Clear selection if any deleted photos were selected
      setSelectedIds((prev) => {
        const next = new Set(prev);
        for (const id of deletionConfirm.photoIds) {
          next.delete(id);
        }
        return next;
      });

      // Close confirmation dialog
      handleCancelDelete();
    } catch (error) {
      setErr("Failed to delete photos");
    } finally {
      setDeleting(false);
    }
  }

  function handleCancelDelete() {
    setDeletionConfirm({ open: false, photoIds: [] });
  }

  if (status === "loading") {
    return (
      <>
        <Navigation />
        <div
          style={{
            padding: "48px 24px",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            minHeight: "calc(100vh - 80px)",
          }}
        >
          <div className="spinner" style={{ width: "40px", height: "40px" }} />
        </div>
      </>
    );
  }

  if (!session) {
    return (
      <>
        <Navigation />
        <div
          style={{
            padding: "48px 24px",
            maxWidth: "600px",
            margin: "0 auto",
            textAlign: "center",
            minHeight: "calc(100vh - 80px)",
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          <div className="fade-in">
            <h1
              style={{
                fontSize: "clamp(2rem, 4vw, 3rem)",
                marginBottom: "16px",
                background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
                fontWeight: "800",
                letterSpacing: "-1px",
              }}
            >
              My Photos
            </h1>
            <p style={{ fontSize: "1.125rem", color: "#6b7280", marginBottom: "32px" }}>
              Please sign in to view your photos.
            </p>
            <button
              type="button"
              onClick={() => signIn("google")}
              style={{
                background: "linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)",
                color: "white",
                padding: "14px 32px",
                borderRadius: "8px",
                border: "none",
                cursor: "pointer",
                fontSize: "16px",
                fontWeight: "600",
                boxShadow: "0 4px 12px rgba(99, 102, 241, 0.4)",
                transition: "all 0.3s ease",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = "translateY(-2px)";
                e.currentTarget.style.boxShadow = "0 8px 20px rgba(99, 102, 241, 0.5)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = "translateY(0)";
                e.currentTarget.style.boxShadow = "0 4px 12px rgba(99, 102, 241, 0.4)";
              }}
            >
              Sign in with Google
            </button>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <Navigation />
      <div
        style={{
          padding: "32px 24px",
          maxWidth: "1400px",
          margin: "0 auto",
          minHeight: "calc(100vh - 80px)",
        }}
      >
        <div className="fade-in">
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "32px",
              flexWrap: "wrap",
              gap: "16px",
            }}
          >
            <h1
              style={{
                margin: 0,
                fontSize: "clamp(2rem, 4vw, 3rem)",
                background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
                fontWeight: "800",
                letterSpacing: "-1px",
              }}
            >
              My Photos
            </h1>
            {items.length > 0 && (
              <button
                type="button"
                onClick={handleSelectAll}
                style={{
                  padding: "10px 20px",
                  borderRadius: "8px",
                  border: "1px solid #d1d5db",
                  backgroundColor: "white",
                  color: "#374151",
                  cursor: "pointer",
                  fontSize: "14px",
                  fontWeight: "600",
                  boxShadow: "0 2px 4px rgba(0, 0, 0, 0.1)",
                  transition: "all 0.2s ease",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = "#f3f4f6";
                  e.currentTarget.style.borderColor = "#9ca3af";
                  e.currentTarget.style.transform = "translateY(-1px)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = "white";
                  e.currentTarget.style.borderColor = "#d1d5db";
                  e.currentTarget.style.transform = "translateY(0)";
                }}
              >
                {selectedIds.size === items.length ? "Deselect All" : "Select All"}
              </button>
            )}
          </div>

          {/* Bulk Actions Bar */}
          {selectedIds.size > 0 && (
            <div
              className="fade-in"
              style={{
                padding: "16px 20px",
                background:
                  "linear-gradient(135deg, rgba(99, 102, 241, 0.1) 0%, rgba(139, 92, 246, 0.1) 100%)",
                borderRadius: "12px",
                marginBottom: "32px",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                flexWrap: "wrap",
                gap: "12px",
                border: "1px solid rgba(99, 102, 241, 0.2)",
                boxShadow: "0 4px 6px rgba(0, 0, 0, 0.05)",
              }}
            >
              <span
                style={{
                  fontSize: "16px",
                  color: "#1f2937",
                  fontWeight: "600",
                }}
              >
                {selectedIds.size} photo{selectedIds.size !== 1 ? "s" : ""} selected
              </span>
              <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                <button
                  type="button"
                  onClick={() => handleBulkToggleShare(true)}
                  disabled={toggling}
                  style={{
                    padding: "10px 20px",
                    borderRadius: "8px",
                    border: "none",
                    background: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
                    color: "white",
                    cursor: toggling ? "not-allowed" : "pointer",
                    fontSize: "14px",
                    fontWeight: "600",
                    opacity: toggling ? 0.6 : 1,
                    boxShadow: "0 2px 4px rgba(16, 185, 129, 0.3)",
                    transition: "all 0.2s ease",
                  }}
                  onMouseEnter={(e) => {
                    if (!toggling) {
                      e.currentTarget.style.transform = "translateY(-2px)";
                      e.currentTarget.style.boxShadow = "0 4px 8px rgba(16, 185, 129, 0.4)";
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!toggling) {
                      e.currentTarget.style.transform = "translateY(0)";
                      e.currentTarget.style.boxShadow = "0 2px 4px rgba(16, 185, 129, 0.3)";
                    }
                  }}
                >
                  Share All
                </button>
                <button
                  type="button"
                  onClick={() => handleBulkToggleShare(false)}
                  disabled={toggling || deleting}
                  style={{
                    padding: "10px 20px",
                    borderRadius: "8px",
                    border: "none",
                    background: "linear-gradient(135deg, #6b7280 0%, #4b5563 100%)",
                    color: "white",
                    cursor: toggling || deleting ? "not-allowed" : "pointer",
                    fontSize: "14px",
                    fontWeight: "600",
                    opacity: toggling || deleting ? 0.6 : 1,
                    boxShadow: "0 2px 4px rgba(107, 114, 128, 0.3)",
                    transition: "all 0.2s ease",
                  }}
                  onMouseEnter={(e) => {
                    if (!toggling && !deleting) {
                      e.currentTarget.style.transform = "translateY(-2px)";
                      e.currentTarget.style.boxShadow = "0 4px 8px rgba(107, 114, 128, 0.4)";
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!toggling && !deleting) {
                      e.currentTarget.style.transform = "translateY(0)";
                      e.currentTarget.style.boxShadow = "0 2px 4px rgba(107, 114, 128, 0.3)";
                    }
                  }}
                >
                  Make Private
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(Array.from(selectedIds))}
                  disabled={deleting || toggling}
                  style={{
                    padding: "10px 20px",
                    borderRadius: "8px",
                    border: "none",
                    background: "linear-gradient(135deg, #ef4444 0%, #dc2626 100%)",
                    color: "white",
                    cursor: deleting || toggling ? "not-allowed" : "pointer",
                    fontSize: "14px",
                    fontWeight: "600",
                    opacity: deleting || toggling ? 0.6 : 1,
                    boxShadow: "0 2px 4px rgba(239, 68, 68, 0.3)",
                    transition: "all 0.2s ease",
                  }}
                  onMouseEnter={(e) => {
                    if (!deleting && !toggling) {
                      e.currentTarget.style.transform = "translateY(-2px)";
                      e.currentTarget.style.boxShadow = "0 4px 8px rgba(239, 68, 68, 0.4)";
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!deleting && !toggling) {
                      e.currentTarget.style.transform = "translateY(0)";
                      e.currentTarget.style.boxShadow = "0 2px 4px rgba(239, 68, 68, 0.3)";
                    }
                  }}
                >
                  Delete Selected
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedIds(new Set())}
                  disabled={toggling || deleting}
                  style={{
                    padding: "10px 20px",
                    borderRadius: "8px",
                    border: "1px solid #d1d5db",
                    backgroundColor: "white",
                    color: "#374151",
                    cursor: toggling || deleting ? "not-allowed" : "pointer",
                    fontSize: "14px",
                    fontWeight: "600",
                    opacity: toggling || deleting ? 0.6 : 1,
                    boxShadow: "0 2px 4px rgba(0, 0, 0, 0.1)",
                    transition: "all 0.2s ease",
                  }}
                  onMouseEnter={(e) => {
                    if (!toggling && !deleting) {
                      e.currentTarget.style.backgroundColor = "#f3f4f6";
                      e.currentTarget.style.borderColor = "#9ca3af";
                      e.currentTarget.style.transform = "translateY(-1px)";
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!toggling && !deleting) {
                      e.currentTarget.style.backgroundColor = "white";
                      e.currentTarget.style.borderColor = "#d1d5db";
                      e.currentTarget.style.transform = "translateY(0)";
                    }
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Filter buttons */}
          <div
            style={{
              display: "flex",
              gap: "12px",
              marginBottom: "32px",
              flexWrap: "wrap",
            }}
          >
            <button
              type="button"
              onClick={() => setFilter("all")}
              style={{
                padding: "10px 24px",
                borderRadius: "8px",
                border: "1px solid #d1d5db",
                background:
                  filter === "all" ? "linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)" : "white",
                color: filter === "all" ? "white" : "#374151",
                cursor: "pointer",
                fontSize: "14px",
                fontWeight: "600",
                boxShadow:
                  filter === "all"
                    ? "0 2px 4px rgba(99, 102, 241, 0.3)"
                    : "0 1px 2px rgba(0, 0, 0, 0.1)",
                transition: "all 0.2s ease",
              }}
              onMouseEnter={(e) => {
                if (filter !== "all") {
                  e.currentTarget.style.backgroundColor = "#f3f4f6";
                  e.currentTarget.style.borderColor = "#9ca3af";
                }
              }}
              onMouseLeave={(e) => {
                if (filter !== "all") {
                  e.currentTarget.style.backgroundColor = "white";
                  e.currentTarget.style.borderColor = "#d1d5db";
                }
              }}
            >
              All
            </button>
            <button
              type="button"
              onClick={() => setFilter("shared")}
              style={{
                padding: "10px 24px",
                borderRadius: "8px",
                border: "1px solid #d1d5db",
                background:
                  filter === "shared"
                    ? "linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)"
                    : "white",
                color: filter === "shared" ? "white" : "#374151",
                cursor: "pointer",
                fontSize: "14px",
                fontWeight: "600",
                boxShadow:
                  filter === "shared"
                    ? "0 2px 4px rgba(99, 102, 241, 0.3)"
                    : "0 1px 2px rgba(0, 0, 0, 0.1)",
                transition: "all 0.2s ease",
              }}
              onMouseEnter={(e) => {
                if (filter !== "shared") {
                  e.currentTarget.style.backgroundColor = "#f3f4f6";
                  e.currentTarget.style.borderColor = "#9ca3af";
                }
              }}
              onMouseLeave={(e) => {
                if (filter !== "shared") {
                  e.currentTarget.style.backgroundColor = "white";
                  e.currentTarget.style.borderColor = "#d1d5db";
                }
              }}
            >
              Shared
            </button>
            <button
              type="button"
              onClick={() => setFilter("unshared")}
              style={{
                padding: "10px 24px",
                borderRadius: "8px",
                border: "1px solid #d1d5db",
                background:
                  filter === "unshared"
                    ? "linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)"
                    : "white",
                color: filter === "unshared" ? "white" : "#374151",
                cursor: "pointer",
                fontSize: "14px",
                fontWeight: "600",
                boxShadow:
                  filter === "unshared"
                    ? "0 2px 4px rgba(99, 102, 241, 0.3)"
                    : "0 1px 2px rgba(0, 0, 0, 0.1)",
                transition: "all 0.2s ease",
              }}
              onMouseEnter={(e) => {
                if (filter !== "unshared") {
                  e.currentTarget.style.backgroundColor = "#f3f4f6";
                  e.currentTarget.style.borderColor = "#9ca3af";
                }
              }}
              onMouseLeave={(e) => {
                if (filter !== "unshared") {
                  e.currentTarget.style.backgroundColor = "white";
                  e.currentTarget.style.borderColor = "#d1d5db";
                }
              }}
            >
              Unshared
            </button>
          </div>

          {err && (
            <div
              style={{
                padding: "16px",
                backgroundColor: "#fef2f2",
                border: "1px solid #fecaca",
                borderRadius: "8px",
                color: "#991b1b",
                marginBottom: "24px",
                fontWeight: "500",
              }}
            >
              ⚠️ {err}
            </div>
          )}

          {loading ? (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
                gap: "20px",
              }}
            >
              {["sk1", "sk2", "sk3", "sk4", "sk5", "sk6"].map((id) => (
                <div key={id} className="skeleton" style={{ height: "300px" }} />
              ))}
            </div>
          ) : items.length === 0 ? (
            <div
              style={{
                textAlign: "center",
                padding: "64px 24px",
                color: "#6b7280",
              }}
            >
              <div style={{ fontSize: "4rem", marginBottom: "16px" }}>📷</div>
              <p style={{ fontSize: "1.25rem", marginBottom: "8px", fontWeight: "600" }}>
                No photos found
              </p>
              <p>Upload your first photo to get started!</p>
            </div>
          ) : (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
                gap: "20px",
              }}
            >
              {items.map((item) => {
                const isSelected = selectedIds.has(item.id);
                return (
                  <div
                    key={item.id}
                    className="card fade-in"
                    style={{
                      border: isSelected ? "3px solid #6366f1" : "none",
                      padding: 0,
                      position: "relative",
                      backgroundColor: isSelected ? "rgba(99, 102, 241, 0.05)" : "white",
                      overflow: "hidden",
                      cursor: "pointer",
                      transition: "all 0.2s ease",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = "translateY(-4px)";
                      e.currentTarget.style.boxShadow = "0 12px 24px rgba(0, 0, 0, 0.15)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = "translateY(0)";
                      e.currentTarget.style.boxShadow =
                        "0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)";
                    }}
                  >
                    {/* Checkbox */}
                    <div
                      style={{
                        position: "absolute",
                        top: "12px",
                        left: "12px",
                        zIndex: 1,
                        backgroundColor: "rgba(255, 255, 255, 0.9)",
                        borderRadius: "6px",
                        padding: "4px",
                        boxShadow: "0 2px 4px rgba(0, 0, 0, 0.2)",
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => handleSelectPhoto(item.id)}
                        style={{
                          width: "20px",
                          height: "20px",
                          cursor: "pointer",
                          accentColor: "#6366f1",
                        }}
                      />
                    </div>

                    <div style={{ position: "relative", paddingTop: "100%", overflow: "hidden" }}>
                      <img
                        src={item.publicUrl}
                        alt={item.filename}
                        style={{
                          position: "absolute",
                          top: 0,
                          left: 0,
                          width: "100%",
                          height: "100%",
                          objectFit: "cover",
                          transition: "transform 0.3s ease",
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.transform = "scale(1.05)";
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.transform = "scale(1)";
                        }}
                        loading="lazy"
                      />
                    </div>
                    <div style={{ padding: "12px" }}>
                      <div
                        style={{
                          fontSize: "0.75rem",
                          color: "#6b7280",
                          marginBottom: "8px",
                        }}
                      >
                        {new Date(item.uploadedAt).toLocaleDateString()}
                      </div>
                      <div
                        style={{
                          fontSize: "0.75rem",
                          marginBottom: "12px",
                          display: "flex",
                          gap: "8px",
                          alignItems: "center",
                          flexWrap: "wrap",
                        }}
                      >
                        <span
                          style={{
                            padding: "4px 8px",
                            borderRadius: "6px",
                            background: item.isShared
                              ? "linear-gradient(135deg, #10b981 0%, #059669 100%)"
                              : "linear-gradient(135deg, #6b7280 0%, #4b5563 100%)",
                            color: "white",
                            fontSize: "0.7rem",
                            fontWeight: "600",
                            boxShadow: "0 1px 2px rgba(0, 0, 0, 0.1)",
                          }}
                        >
                          {item.isShared ? "Shared" : "Private"}
                        </span>
                        {item.frameId && (
                          <span
                            style={{
                              fontSize: "0.7rem",
                              color: "#6366f1",
                              fontWeight: "500",
                              padding: "4px 8px",
                              backgroundColor: "rgba(99, 102, 241, 0.1)",
                              borderRadius: "6px",
                            }}
                          >
                            Frame: {item.frameId}
                          </span>
                        )}
                      </div>
                      <div style={{ display: "flex", gap: "8px" }}>
                        {/* Toggle button */}
                        <button
                          type="button"
                          onClick={() => handleToggleShare(item.id)}
                          disabled={toggling || deleting}
                          style={{
                            flex: 1,
                            padding: "8px 12px",
                            borderRadius: "6px",
                            border: "1px solid #d1d5db",
                            backgroundColor: "white",
                            color: "#374151",
                            cursor: toggling || deleting ? "not-allowed" : "pointer",
                            fontSize: "0.75rem",
                            fontWeight: "600",
                            opacity: toggling || deleting ? 0.6 : 1,
                            transition: "all 0.2s ease",
                          }}
                          onMouseEnter={(e) => {
                            if (!toggling && !deleting) {
                              e.currentTarget.style.backgroundColor = "#f3f4f6";
                              e.currentTarget.style.borderColor = "#9ca3af";
                            }
                          }}
                          onMouseLeave={(e) => {
                            if (!toggling && !deleting) {
                              e.currentTarget.style.backgroundColor = "white";
                              e.currentTarget.style.borderColor = "#d1d5db";
                            }
                          }}
                        >
                          {item.isShared ? "Make Private" : "Share"}
                        </button>
                        {/* Delete button */}
                        <button
                          type="button"
                          onClick={() => handleDelete([item.id])}
                          disabled={deleting}
                          style={{
                            flex: 1,
                            padding: "8px 12px",
                            borderRadius: "6px",
                            border: "1px solid #ef4444",
                            backgroundColor: "white",
                            color: "#ef4444",
                            cursor: deleting ? "not-allowed" : "pointer",
                            fontSize: "0.75rem",
                            fontWeight: "600",
                            opacity: deleting ? 0.6 : 1,
                            transition: "all 0.2s ease",
                          }}
                          onMouseEnter={(e) => {
                            if (!deleting) {
                              e.currentTarget.style.backgroundColor = "#fef2f2";
                              e.currentTarget.style.borderColor = "#dc2626";
                            }
                          }}
                          onMouseLeave={(e) => {
                            if (!deleting) {
                              e.currentTarget.style.backgroundColor = "white";
                              e.currentTarget.style.borderColor = "#ef4444";
                            }
                          }}
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Confirmation Dialog */}
          {deletionConfirm.open && (
            <div
              style={{
                position: "fixed",
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                backgroundColor: "rgba(0, 0, 0, 0.5)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                zIndex: 1000,
              }}
              onClick={handleCancelDelete}
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  handleCancelDelete();
                }
              }}
            >
              <div
                style={{
                  backgroundColor: "white",
                  padding: "24px",
                  borderRadius: "8px",
                  maxWidth: "400px",
                  width: "90%",
                  boxShadow: "0 4px 6px rgba(0, 0, 0, 0.1)",
                }}
                onClick={(e) => e.stopPropagation()}
                onKeyDown={(e) => {
                  e.stopPropagation();
                }}
              >
                <h2 style={{ margin: "0 0 16px 0", color: "#374151", fontSize: "18px" }}>
                  Confirm Deletion
                </h2>
                <p style={{ margin: "0 0 24px 0", color: "#6b7280", fontSize: "14px" }}>
                  Are you sure you want to delete {deletionConfirm.photoIds.length} photo
                  {deletionConfirm.photoIds.length !== 1 ? "s" : ""}? This action cannot be undone.
                </p>
                <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
                  <button
                    type="button"
                    onClick={handleCancelDelete}
                    disabled={deleting}
                    style={{
                      padding: "8px 16px",
                      borderRadius: "4px",
                      border: "1px solid #d1d5db",
                      backgroundColor: "white",
                      color: "#374151",
                      cursor: deleting ? "not-allowed" : "pointer",
                      fontSize: "14px",
                      opacity: deleting ? 0.6 : 1,
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmDelete}
                    disabled={deleting}
                    style={{
                      padding: "8px 16px",
                      borderRadius: "4px",
                      border: "none",
                      backgroundColor: "#ef4444",
                      color: "white",
                      cursor: deleting ? "not-allowed" : "pointer",
                      fontSize: "14px",
                      opacity: deleting ? 0.6 : 1,
                    }}
                  >
                    {deleting ? "Deleting..." : "Delete"}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

export const getServerSideProps: GetServerSideProps = async (context) => {
  const session = await getServerSession(context.req, context.res, authOptions);

  if (!session) {
    return {
      redirect: {
        destination: "/?authRequired=true",
        permanent: false,
      },
    };
  }

  return {
    props: {},
  };
};
