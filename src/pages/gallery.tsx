import type { GetServerSideProps } from "next";
import { getServerSession } from "next-auth/next";
import { useEffect, useState } from "react";
import Navigation from "../components/Navigation";
import { authOptions } from "./api/auth/[...nextauth]";

type GalleryItem = {
  key: string;
  publicUrl: string;
  uploadedAt: string;
  uploaderEmail?: string;
};

export default function GalleryPage() {
  const [items, setItems] = useState<GalleryItem[]>([]);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const r = await fetch("/api/gallery");
        const j = await r.json();
        if (!r.ok) setErr(j?.error ?? "Failed to load");
        setItems(j.items ?? []);
      } catch (error) {
        setErr("Failed to load gallery");
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
            Gallery
          </h1>
          <p style={{ fontSize: "1.125rem", color: "#6b7280", marginBottom: "32px" }}>
            Explore shared photos from our community
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
                gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
                gap: "20px",
              }}
            >
              {["sk1", "sk2", "sk3", "sk4", "sk5", "sk6"].map((id) => (
                <div key={id} className="skeleton" style={{ height: "250px" }} />
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
              <p style={{ fontSize: "1.25rem", marginBottom: "8px" }}>No photos yet</p>
              <p>Be the first to share your photos!</p>
            </div>
          ) : (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
                gap: "20px",
              }}
            >
              {items.map((it) => (
                <div
                  key={it.key}
                  className="card fade-in"
                  style={{
                    padding: 0,
                    overflow: "hidden",
                    cursor: "pointer",
                    border: "none",
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
                  <div style={{ position: "relative", paddingTop: "100%", overflow: "hidden" }}>
                    <img
                      src={it.publicUrl}
                      alt={it.key}
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
                        marginBottom: "4px",
                      }}
                    >
                      {new Date(it.uploadedAt).toLocaleDateString()}
                    </div>
                    {it.uploaderEmail && (
                      <div
                        style={{
                          fontSize: "0.75rem",
                          color: "#9ca3af",
                          fontWeight: "500",
                        }}
                      >
                        {it.uploaderEmail}
                      </div>
                    )}
                  </div>
                </div>
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
