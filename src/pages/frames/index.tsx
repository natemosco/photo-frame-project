import type { GetServerSideProps } from "next";
import { getServerSession } from "next-auth/next";
import Link from "next/link";
import { useEffect, useState } from "react";
import Navigation from "../../components/Navigation";
import { authOptions } from "../api/auth/[...nextauth]";

type FrameListItem = {
  id: string;
  name: string;
  photoCount: number;
  coverPhotoUrl: string | null;
  createdAt: string;
  updatedAt: string;
};

export default function FramesPage() {
  const [frames, setFrames] = useState<FrameListItem[]>([]);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const res = await fetch("/api/gallery/frames");
        const json = await res.json();
        if (!res.ok) {
          setErr(json?.error ?? "Failed to load frames");
          return;
        }
        setFrames(json.frames ?? []);
      } catch (error) {
        setErr("Failed to load frames");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

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
              alignItems: "flex-start",
              marginBottom: "32px",
              flexWrap: "wrap",
              gap: "16px",
            }}
          >
            <div>
              <h1
                style={{
                  fontSize: "clamp(2rem, 4vw, 3rem)",
                  marginBottom: "8px",
                  background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  backgroundClip: "text",
                  fontWeight: "800",
                  letterSpacing: "-1px",
                }}
              >
                Frames
              </h1>
              <p style={{ fontSize: "1.125rem", color: "#6b7280" }}>
                Explore shared frames from the community
              </p>
            </div>
            <Link
              href="/my-photos"
              style={{
                textDecoration: "none",
                padding: "12px 24px",
                borderRadius: "8px",
                border: "none",
                background: "linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)",
                color: "white",
                fontSize: "14px",
                fontWeight: "600",
                boxShadow: "0 4px 6px rgba(99, 102, 241, 0.3)",
                transition: "all 0.2s ease",
                display: "inline-block",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = "translateY(-2px)";
                e.currentTarget.style.boxShadow = "0 6px 12px rgba(99, 102, 241, 0.4)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = "translateY(0)";
                e.currentTarget.style.boxShadow = "0 4px 6px rgba(99, 102, 241, 0.3)";
              }}
            >
              Add Frame
            </Link>
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
              }}
            >
              {err}
            </div>
          )}

          {loading ? (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
                gap: "20px",
              }}
            >
              {["sk1", "sk2", "sk3", "sk4", "sk5", "sk6"].map((id) => (
                <div key={id} className="skeleton" style={{ height: "180px" }} />
              ))}
            </div>
          ) : frames.length === 0 ? (
            <div
              style={{
                textAlign: "center",
                padding: "64px 24px",
                color: "#6b7280",
              }}
            >
              <div style={{ fontSize: "4rem", marginBottom: "16px" }}>🖼️</div>
              <p style={{ fontSize: "1.25rem", marginBottom: "8px" }}>No frames yet</p>
              <p>Share a frame to see it here.</p>
            </div>
          ) : (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
                gap: "20px",
              }}
            >
              {/* Virtual All Photos Frame card */}
              <Link
                href="/frames/all"
                className="card fade-in"
                style={{
                  padding: "20px",
                  display: "flex",
                  flexDirection: "column",
                  gap: "16px",
                  border: "1px solid rgba(229, 231, 235, 0.8)",
                  borderRadius: "12px",
                  boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.06)",
                  transition: "all 0.2s ease",
                  cursor: "pointer",
                  textDecoration: "none",
                  color: "inherit",
                  background:
                    "linear-gradient(135deg, rgba(129, 140, 248, 0.12) 0%, rgba(244, 114, 182, 0.12) 100%)",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = "translateY(-4px)";
                  e.currentTarget.style.boxShadow = "0 12px 24px rgba(0, 0, 0, 0.1)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = "translateY(0)";
                  e.currentTarget.style.boxShadow = "0 4px 6px -1px rgba(0, 0, 0, 0.06)";
                }}
              >
                <div
                  style={{
                    position: "relative",
                    width: "100%",
                    paddingTop: "75%",
                    background:
                      "radial-gradient(circle at top left, #6366f1 0%, transparent 50%), radial-gradient(circle at bottom right, #ec4899 0%, transparent 55%)",
                    borderRadius: "8px",
                    overflow: "hidden",
                    border: "12px solid #111827",
                    boxShadow: "inset 0 0 0 4px #f9fafb",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <span
                    style={{
                      color: "white",
                      fontSize: "2.4rem",
                    }}
                  >
                    ✨
                  </span>
                </div>
                <div>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      gap: "8px",
                      marginBottom: "8px",
                    }}
                  >
                    <h2
                      style={{
                        fontSize: "1.1rem",
                        fontWeight: 800,
                        margin: 0,
                        color: "#111827",
                      }}
                    >
                      All Photos Frame
                    </h2>
                    <span
                      style={{
                        fontSize: "0.75rem",
                        backgroundColor: "rgba(22, 163, 74, 0.1)",
                        color: "#16a34a",
                        padding: "4px 8px",
                        borderRadius: "9999px",
                        fontWeight: 600,
                      }}
                    >
                      Auto-updating
                    </span>
                  </div>
                  <p style={{ color: "#4b5563", fontSize: "0.85rem", marginBottom: "4px" }}>
                    Slideshow of all your shared photos, in a new random order every time.
                  </p>
                  <p style={{ color: "#9ca3af", fontSize: "0.8rem" }}>
                    Only photos you&apos;ve marked as shared are included.
                  </p>
                </div>
                <div
                  style={{
                    marginTop: "auto",
                    padding: "10px 16px",
                    borderRadius: "8px",
                    border: "1px solid #6366f1",
                    background:
                      "linear-gradient(135deg, rgba(99, 102, 241, 0.08) 0%, rgba(129, 140, 248, 0.16) 100%)",
                    color: "#4f46e5",
                    fontSize: "14px",
                    fontWeight: 600,
                    textAlign: "center",
                    transition: "all 0.2s ease",
                  }}
                >
                  View All Photos Frame
                </div>
              </Link>

              {frames.map((frame) => (
                <Link
                  key={frame.id}
                  href={`/frames/${frame.id}`}
                  className="card fade-in"
                  style={{
                    padding: "20px",
                    display: "flex",
                    flexDirection: "column",
                    gap: "16px",
                    border: "1px solid rgba(229, 231, 235, 0.8)",
                    borderRadius: "12px",
                    boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.06)",
                    transition: "all 0.2s ease",
                    cursor: "pointer",
                    textDecoration: "none",
                    color: "inherit",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = "translateY(-4px)";
                    e.currentTarget.style.boxShadow = "0 12px 24px rgba(0, 0, 0, 0.1)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = "translateY(0)";
                    e.currentTarget.style.boxShadow = "0 4px 6px -1px rgba(0, 0, 0, 0.06)";
                  }}
                >
                  {/* Art Frame with Cover Photo */}
                  <div
                    style={{
                      position: "relative",
                      width: "100%",
                      paddingTop: "75%", // 4:3 aspect ratio
                      backgroundColor: "#f3f4f6",
                      borderRadius: "8px",
                      overflow: "hidden",
                      border: "12px solid #1a1a1a", // Outer dark frame border
                      boxShadow: "inset 0 0 0 4px #f5f5f5", // Inner mat border
                    }}
                  >
                    {frame.coverPhotoUrl ? (
                      <img
                        src={frame.coverPhotoUrl}
                        alt={frame.name}
                        style={{
                          position: "absolute",
                          top: 0,
                          left: 0,
                          width: "100%",
                          height: "100%",
                          objectFit: "cover",
                        }}
                      />
                    ) : (
                      <div
                        style={{
                          position: "absolute",
                          top: "50%",
                          left: "50%",
                          transform: "translate(-50%, -50%)",
                          color: "#9ca3af",
                          fontSize: "3rem",
                        }}
                      >
                        🖼️
                      </div>
                    )}
                  </div>

                  {/* Frame Info */}
                  <div>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        gap: "8px",
                        marginBottom: "8px",
                      }}
                    >
                      <h2
                        style={{
                          fontSize: "1.1rem",
                          fontWeight: 700,
                          margin: 0,
                          color: "#111827",
                        }}
                      >
                        {frame.name}
                      </h2>
                      <span
                        style={{
                          fontSize: "0.75rem",
                          backgroundColor: "rgba(99, 102, 241, 0.1)",
                          color: "#4f46e5",
                          padding: "4px 8px",
                          borderRadius: "9999px",
                          fontWeight: 600,
                        }}
                      >
                        {frame.photoCount} photo{frame.photoCount !== 1 ? "s" : ""}
                      </span>
                    </div>
                    <div style={{ color: "#6b7280", fontSize: "0.85rem", marginBottom: "4px" }}>
                      Updated {new Date(frame.updatedAt).toLocaleDateString()}
                    </div>
                    <div style={{ color: "#9ca3af", fontSize: "0.8rem" }}>
                      Created {new Date(frame.createdAt).toLocaleDateString()}
                    </div>
                  </div>

                  {/* View Button */}
                  <div
                    style={{
                      marginTop: "auto",
                      padding: "10px 16px",
                      borderRadius: "8px",
                      border: "1px solid #6366f1",
                      backgroundColor: "white",
                      color: "#6366f1",
                      fontSize: "14px",
                      fontWeight: 600,
                      textAlign: "center",
                      transition: "all 0.2s ease",
                    }}
                  >
                    View Frame
                  </div>
                </Link>
              ))}
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
