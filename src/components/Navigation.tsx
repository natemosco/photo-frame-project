import Link from "next/link";
import { useSession, signIn, signOut } from "next-auth/react";
import Image from "next/image";

export default function Navigation() {
  const { data: session, status } = useSession();

  return (
    <nav
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "16px 24px",
        borderBottom: "1px solid #e5e7eb",
        backgroundColor: "#fff",
      }}
    >
      <div style={{ display: "flex", gap: "24px", alignItems: "center" }}>
        <Link href="/" style={{ textDecoration: "none", color: "#000", fontWeight: "bold", fontSize: "18px" }}>
          Photo Frame Project
        </Link>
        <div style={{ display: "flex", gap: "16px" }}>
          <Link href="/" style={{ textDecoration: "none", color: "#374151", padding: "8px 12px", borderRadius: "4px" }}>
            Home
          </Link>
          <Link
            href="/gallery"
            style={{ textDecoration: "none", color: "#374151", padding: "8px 12px", borderRadius: "4px" }}
          >
            Gallery
          </Link>
          <Link
            href="/my-photos"
            style={{ textDecoration: "none", color: "#374151", padding: "8px 12px", borderRadius: "4px" }}
          >
            My Photos
          </Link>
          <Link
            href="/upload"
            style={{ textDecoration: "none", color: "#374151", padding: "8px 12px", borderRadius: "4px" }}
          >
            Upload
          </Link>
        </div>
      </div>

      <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
        {status === "loading" ? (
          <span style={{ color: "#6b7280" }}>Loading...</span>
        ) : session ? (
          <>
            {session.user?.image && (
              <Image
                src={session.user.image}
                alt="User avatar"
                width={32}
                height={32}
                style={{ borderRadius: "50%" }}
              />
            )}
            <span style={{ color: "#374151", fontSize: "14px" }}>{session.user?.email}</span>
            <button
              onClick={() => signOut()}
              style={{
                backgroundColor: "#ef4444",
                color: "white",
                padding: "8px 16px",
                borderRadius: "4px",
                border: "none",
                cursor: "pointer",
                fontSize: "14px",
              }}
            >
              Sign out
            </button>
          </>
        ) : (
          <button
            onClick={() => signIn("google")}
            style={{
              backgroundColor: "#3b82f6",
              color: "white",
              padding: "8px 16px",
              borderRadius: "4px",
              border: "none",
              cursor: "pointer",
              fontSize: "14px",
            }}
          >
            Sign in
          </button>
        )}
      </div>
    </nav>
  );
}
