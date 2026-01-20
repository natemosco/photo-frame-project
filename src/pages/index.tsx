import { Geist, Geist_Mono } from "next/font/google";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";
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

// SVG Icon Components
const UploadIcon = () => (
  <svg
    width="48"
    height="48"
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    style={{ margin: "0 auto" }}
  >
    <path
      d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <polyline
      points="17 8 12 3 7 8"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <line
      x1="12"
      y1="3"
      x2="12"
      y2="15"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const FrameIcon = () => (
  <svg
    width="48"
    height="48"
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    style={{ margin: "0 auto" }}
  >
    <rect
      x="3"
      y="3"
      width="18"
      height="18"
      rx="2"
      stroke="currentColor"
      strokeWidth="2"
      fill="none"
    />
    <rect
      x="7"
      y="7"
      width="10"
      height="10"
      rx="1"
      stroke="currentColor"
      strokeWidth="1.5"
      fill="none"
    />
    <circle cx="9" cy="9" r="1" fill="currentColor" />
    <circle cx="15" cy="9" r="1" fill="currentColor" />
    <circle cx="9" cy="15" r="1" fill="currentColor" />
    <circle cx="15" cy="15" r="1" fill="currentColor" />
  </svg>
);

const ShareIcon = () => (
  <svg
    width="48"
    height="48"
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    style={{ margin: "0 auto" }}
  >
    <circle cx="18" cy="5" r="3" stroke="currentColor" strokeWidth="2" fill="none" />
    <circle cx="6" cy="12" r="3" stroke="currentColor" strokeWidth="2" fill="none" />
    <circle cx="18" cy="19" r="3" stroke="currentColor" strokeWidth="2" fill="none" />
    <line
      x1="8.59"
      y1="13.51"
      x2="15.42"
      y2="17.49"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    />
    <line
      x1="15.41"
      y1="6.51"
      x2="8.59"
      y2="10.49"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    />
  </svg>
);

export default function Home() {
  const router = useRouter();
  const [showAuthMessage, setShowAuthMessage] = useState(false);

  useEffect(() => {
    if (router.query.authRequired === "true") {
      setShowAuthMessage(true);
      // Remove query parameter from URL without reload
      const newUrl = window.location.pathname;
      window.history.replaceState({}, "", newUrl);
      // Auto-hide after 5 seconds
      const timer = setTimeout(() => setShowAuthMessage(false), 5000);
      return () => clearTimeout(timer);
    }
  }, [router.query.authRequired]);
  return (
    <>
      <Navigation />
      {showAuthMessage && (
        <div
          style={{
            position: "fixed",
            top: "80px",
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 1000,
            maxWidth: "600px",
            width: "calc(100% - 48px)",
            padding: "16px 20px",
            backgroundColor: "#fef3c7",
            border: "1px solid #fbbf24",
            borderRadius: "12px",
            boxShadow: "0 10px 25px rgba(0, 0, 0, 0.15)",
            display: "flex",
            alignItems: "center",
            gap: "12px",
            animation: "fadeIn 0.3s ease-out",
          }}
        >
          <div
            style={{
              fontSize: "24px",
              flexShrink: 0,
            }}
          >
            ⚠️
          </div>
          <div style={{ flex: 1 }}>
            <div
              style={{
                fontWeight: "600",
                color: "#92400e",
                marginBottom: "4px",
                fontSize: "16px",
              }}
            >
              Sign in required
            </div>
            <div
              style={{
                color: "#78350f",
                fontSize: "14px",
              }}
            >
              Please sign in to access this page.
            </div>
          </div>
          <button
            type="button"
            onClick={() => setShowAuthMessage(false)}
            style={{
              background: "transparent",
              border: "none",
              color: "#92400e",
              cursor: "pointer",
              fontSize: "20px",
              padding: "4px 8px",
              borderRadius: "4px",
              transition: "background 0.2s",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = "rgba(146, 64, 14, 0.1)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = "transparent";
            }}
          >
            ×
          </button>
        </div>
      )}
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
                padding: "32px 24px",
                textAlign: "center",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
              }}
            >
              <div
                style={{
                  color: "#6366f1",
                  marginBottom: "16px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <UploadIcon />
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
                padding: "32px 24px",
                textAlign: "center",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
              }}
            >
              <div
                style={{
                  color: "#8b5cf6",
                  marginBottom: "16px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <FrameIcon />
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
                padding: "32px 24px",
                textAlign: "center",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
              }}
            >
              <div
                style={{
                  color: "#ec4899",
                  marginBottom: "16px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <ShareIcon />
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
