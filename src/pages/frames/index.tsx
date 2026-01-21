import type { GetServerSideProps } from "next";
import { getServerSession } from "next-auth/next";
import { useEffect, useState } from "react";
import Navigation from "../../components/Navigation";
import { authOptions } from "../api/auth/[...nextauth]";

type FrameListItem = {
  id: string;
  name: string;
  photoCount: number;
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
          <p style={{ fontSize: "1.125rem", color: "#6b7280", marginBottom: "32px" }}>
            Explore shared frames from the community
          </p>

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
              {frames.map((frame) => (
                <a
                  key={frame.id}
                  href={`/frames/${frame.id}`}
                  className="card fade-in"
                  style={{
                    padding: "16px",
                    textDecoration: "none",
                    color: "inherit",
                    display: "flex",
                    flexDirection: "column",
                    gap: "12px",
                    border: "1px solid rgba(229, 231, 235, 0.8)",
                    borderRadius: "12px",
                    boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.06)",
                    transition: "all 0.2s ease",
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
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      gap: "8px",
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
                      {frame.photoCount} photos
                    </span>
                  </div>

                  <div style={{ color: "#6b7280", fontSize: "0.9rem" }}>
                    Updated {new Date(frame.updatedAt).toLocaleDateString()}
                  </div>
                  <div style={{ color: "#9ca3af", fontSize: "0.85rem" }}>
                    Created {new Date(frame.createdAt).toLocaleDateString()}
                  </div>
                  <div
                    style={{
                      marginTop: "auto",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "8px",
                      color: "#4f46e5",
                      fontWeight: 600,
                    }}
                  >
                    View frame →
                  </div>
                </a>
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
