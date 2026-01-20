import { Geist, Geist_Mono } from "next/font/google";
import Navigation from "../components/Navigation";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

import Link from "next/link";

export default function Home() {
  return (
    <>
      <Navigation />
      <main
        style={{
          minHeight: "calc(100vh - 80px)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "48px 24px",
          background:
            "linear-gradient(135deg, rgba(99, 102, 241, 0.05) 0%, rgba(139, 92, 246, 0.05) 100%)",
        }}
      >
        <div
          className="fade-in"
          style={{
            maxWidth: "800px",
            textAlign: "center",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "32px",
          }}
        >
          <h1
            style={{
              fontSize: "clamp(2.5rem, 5vw, 4rem)",
              marginBottom: "0",
              background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
              fontWeight: "800",
              letterSpacing: "-1px",
              lineHeight: "1.1",
            }}
          >
            Digital Photo Frames
            <br />
            <span style={{ fontSize: "0.7em", fontWeight: "600" }}>Reimagined</span>
          </h1>
          <p
            style={{
              fontSize: "clamp(1rem, 2vw, 1.25rem)",
              color: "#6b7280",
              lineHeight: "1.8",
              maxWidth: "600px",
            }}
          >
            Transform your memories into beautiful digital displays. Upload, organize, and share
            your photos in stunning frames that bring your gallery to life.
          </p>
          <div
            style={{
              display: "flex",
              gap: "16px",
              flexWrap: "wrap",
              justifyContent: "center",
              marginTop: "16px",
            }}
          >
            <Link
              href="/gallery"
              style={{
                background: "linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)",
                color: "white",
                padding: "16px 32px",
                borderRadius: "12px",
                textDecoration: "none",
                fontSize: "16px",
                fontWeight: "600",
                boxShadow: "0 4px 12px rgba(99, 102, 241, 0.4)",
                transition: "all 0.3s ease",
                display: "inline-block",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = "translateY(-3px)";
                e.currentTarget.style.boxShadow = "0 8px 20px rgba(99, 102, 241, 0.5)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = "translateY(0)";
                e.currentTarget.style.boxShadow = "0 4px 12px rgba(99, 102, 241, 0.4)";
              }}
            >
              View Gallery
            </Link>
            <Link
              href="/upload"
              style={{
                background: "white",
                color: "#6366f1",
                padding: "16px 32px",
                borderRadius: "12px",
                textDecoration: "none",
                fontSize: "16px",
                fontWeight: "600",
                border: "2px solid #6366f1",
                boxShadow: "0 2px 8px rgba(0, 0, 0, 0.1)",
                transition: "all 0.3s ease",
                display: "inline-block",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = "translateY(-3px)";
                e.currentTarget.style.background =
                  "linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)";
                e.currentTarget.style.color = "white";
                e.currentTarget.style.boxShadow = "0 8px 20px rgba(99, 102, 241, 0.3)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = "translateY(0)";
                e.currentTarget.style.background = "white";
                e.currentTarget.style.color = "#6366f1";
                e.currentTarget.style.boxShadow = "0 2px 8px rgba(0, 0, 0, 0.1)";
              }}
            >
              Upload Photos
            </Link>
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
              gap: "24px",
              width: "100%",
              maxWidth: "600px",
              marginTop: "48px",
            }}
          >
            <div
              className="card"
              style={{
                padding: "24px",
                textAlign: "center",
              }}
            >
              <div
                style={{
                  fontSize: "2.5rem",
                  marginBottom: "12px",
                }}
              >
                📸
              </div>
              <h3 style={{ fontSize: "1.125rem", fontWeight: "600", marginBottom: "8px" }}>
                Easy Upload
              </h3>
              <p style={{ fontSize: "0.875rem", color: "#6b7280", margin: 0 }}>
                Drag and drop or select your photos
              </p>
            </div>
            <div
              className="card"
              style={{
                padding: "24px",
                textAlign: "center",
              }}
            >
              <div
                style={{
                  fontSize: "2.5rem",
                  marginBottom: "12px",
                }}
              >
                🖼️
              </div>
              <h3 style={{ fontSize: "1.125rem", fontWeight: "600", marginBottom: "8px" }}>
                Digital Frames
              </h3>
              <p style={{ fontSize: "0.875rem", color: "#6b7280", margin: 0 }}>
                Create beautiful photo frame collections
              </p>
            </div>
            <div
              className="card"
              style={{
                padding: "24px",
                textAlign: "center",
              }}
            >
              <div
                style={{
                  fontSize: "2.5rem",
                  marginBottom: "12px",
                }}
              >
                🌐
              </div>
              <h3 style={{ fontSize: "1.125rem", fontWeight: "600", marginBottom: "8px" }}>
                Share & Explore
              </h3>
              <p style={{ fontSize: "0.875rem", color: "#6b7280", margin: 0 }}>
                Share your frames with the community
              </p>
            </div>
          </div>
        </div>
      </main>
    </>
  );
}
