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

export default function Home() {
  return (
    <>
      <Navigation />
      <main className="flex min-h-screen flex-col items-center justify-center p-24">
        <h1 style={{ fontSize: "2rem", marginBottom: "2rem" }}>Photo Frame Project</h1>
        <p style={{ fontSize: "1.125rem", color: "#6b7280", textAlign: "center" }}>
          Upload and view your photos in the gallery
        </p>
      </main>
    </>
  );
}
