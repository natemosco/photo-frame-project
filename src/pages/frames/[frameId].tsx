import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { and, desc, eq, inArray } from "drizzle-orm";
import type { GetServerSideProps } from "next";
import { getServerSession } from "next-auth/next";
import { useRouter } from "next/router";
import { useCallback, useEffect, useRef, useState } from "react";
import Navigation from "../../components/Navigation";
import { db } from "../../db";
import { framePhotos, frames, photos } from "../../db/schema";
import { getOrCreateUser } from "../../lib/user";
import { authOptions } from "../api/auth/[...nextauth]";

type FramePhoto = {
  id: string;
  key: string;
  publicUrl: string;
  filename: string;
  uploadedAt: string;
};

type FrameData = {
  frame: {
    id: string;
    name: string;
    isShared: boolean;
    userId: string;
    createdAt: string;
    updatedAt: string;
  };
  photos: FramePhoto[];
  isAllPhotosFrame?: boolean;
};

type FramePageProps = {
  frameData: FrameData;
};

export default function FrameViewPage({ frameData }: FramePageProps) {
  const router = useRouter();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [slideInterval, setSlideInterval] = useState(3000); // 3 seconds default
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const [isMobile, setIsMobile] = useState(false);

  const { frame, photos, isAllPhotosFrame } = frameData;

  const handlePrevious = useCallback(() => {
    setCurrentIndex((prev) => (prev - 1 + photos.length) % photos.length);
  }, [photos.length]);

  const handleNext = useCallback(() => {
    setCurrentIndex((prev) => (prev + 1) % photos.length);
  }, [photos.length]);

  const handleTogglePlay = useCallback(() => {
    setIsPlaying((prev) => !prev);
  }, []);

  useEffect(() => {
    // Check if mobile
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  useEffect(() => {
    if (photos.length === 0) return;

    if (isPlaying) {
      intervalRef.current = setInterval(() => {
        setCurrentIndex((prev) => (prev + 1) % photos.length);
      }, slideInterval);
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [isPlaying, slideInterval, photos.length]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") {
        handlePrevious();
      } else if (e.key === "ArrowRight") {
        handleNext();
      } else if (e.key === " " || e.key === "Space") {
        e.preventDefault();
        setIsPlaying((prev) => !prev);
      } else if (e.key === "Escape") {
        router.back();
      }
    };

    window.addEventListener("keydown", handleKeyPress);
    return () => window.removeEventListener("keydown", handleKeyPress);
  }, [handlePrevious, handleNext, router]);

  if (photos.length === 0) {
    return (
      <>
        <Navigation />
        <div
          style={{
            minHeight: "calc(100vh - 80px)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: "48px 24px",
          }}
        >
          <div style={{ textAlign: "center" }}>
            <h1
              style={{
                fontSize: "2rem",
                marginBottom: "16px",
                background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
              }}
            >
              {frame.name}
            </h1>
            <p style={{ color: "#6b7280", fontSize: "1.125rem" }}>
              This frame doesn't have any photos yet.
            </p>
          </div>
        </div>
      </>
    );
  }

  const currentPhoto = photos[currentIndex];

  return (
    <>
      <Navigation />
      <div
        style={{
          minHeight: "calc(100vh - 80px)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: isMobile ? "0" : "48px 24px",
          backgroundColor: isMobile ? "#000" : "#f9fafb",
        }}
      >
        {!isMobile && (
          <div
            style={{
              width: "100%",
              maxWidth: "1400px",
              marginBottom: "24px",
              textAlign: "center",
            }}
          >
            <h1
              style={{
                fontSize: "2rem",
                marginBottom: "8px",
                background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
              }}
            >
              {frame.name}
            </h1>
            <p style={{ color: "#6b7280" }}>
              Photo {currentIndex + 1} of {photos.length}
              {isAllPhotosFrame && " • Randomized on each load"}
            </p>
          </div>
        )}

        {/* Frame Container */}
        <div
          style={{
            width: isMobile ? "100vw" : "90%",
            maxWidth: isMobile ? "100%" : "1200px",
            height: isMobile ? "100vh" : "calc(100vh - 200px)",
            backgroundColor: isMobile ? "#000" : "#000",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            position: "relative",
            border: isMobile ? "none" : "40px solid #1a1a1a",
            borderRadius: isMobile ? "0" : "8px",
            boxShadow: isMobile
              ? "none"
              : "0 20px 60px rgba(0, 0, 0, 0.5), inset 0 0 0 2px rgba(255, 255, 255, 0.1)",
          }}
        >
          {/* Click zones for navigation */}
          {photos.length > 1 && (
            <>
              {/* Left click zone */}
              <div
                onClick={handlePrevious}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    handlePrevious();
                  }
                }}
                style={{
                  position: "absolute",
                  left: 0,
                  top: 0,
                  width: "33%",
                  height: "100%",
                  cursor: "pointer",
                  zIndex: 5,
                }}
                aria-label="Previous photo"
                tabIndex={0}
                role="button"
              />
              {/* Right click zone */}
              <div
                onClick={handleNext}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    handleNext();
                  }
                }}
                style={{
                  position: "absolute",
                  right: 0,
                  top: 0,
                  width: "33%",
                  height: "100%",
                  cursor: "pointer",
                  zIndex: 5,
                }}
                aria-label="Next photo"
                tabIndex={0}
                role="button"
              />
            </>
          )}

          {/* Photo */}
          <img
            src={currentPhoto.publicUrl}
            alt={currentPhoto.filename}
            style={{
              maxWidth: "100%",
              maxHeight: "100%",
              objectFit: "contain",
              transition: "opacity 0.5s ease-in-out",
              zIndex: 1,
              position: "relative",
            }}
          />

          {/* Navigation Buttons */}
          {photos.length > 1 && (
            <>
              <button
                type="button"
                onClick={handlePrevious}
                style={{
                  position: "absolute",
                  left: isMobile ? "16px" : "24px",
                  top: "50%",
                  transform: "translateY(-50%)",
                  background: "rgba(0, 0, 0, 0.6)",
                  color: "white",
                  border: "none",
                  borderRadius: "50%",
                  width: "48px",
                  height: "48px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                  fontSize: "24px",
                  transition: "all 0.2s",
                  zIndex: 10,
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "rgba(0, 0, 0, 0.8)";
                  e.currentTarget.style.transform = "translateY(-50%) scale(1.1)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "rgba(0, 0, 0, 0.6)";
                  e.currentTarget.style.transform = "translateY(-50%) scale(1)";
                }}
                aria-label="Previous photo"
              >
                ‹
              </button>
              <button
                type="button"
                onClick={handleNext}
                style={{
                  position: "absolute",
                  right: isMobile ? "16px" : "24px",
                  top: "50%",
                  transform: "translateY(-50%)",
                  background: "rgba(0, 0, 0, 0.6)",
                  color: "white",
                  border: "none",
                  borderRadius: "50%",
                  width: "48px",
                  height: "48px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                  fontSize: "24px",
                  transition: "all 0.2s",
                  zIndex: 10,
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "rgba(0, 0, 0, 0.8)";
                  e.currentTarget.style.transform = "translateY(-50%) scale(1.1)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "rgba(0, 0, 0, 0.6)";
                  e.currentTarget.style.transform = "translateY(-50%) scale(1)";
                }}
                aria-label="Next photo"
              >
                ›
              </button>
            </>
          )}

          {/* Controls */}
          {!isMobile && (
            <div
              style={{
                position: "absolute",
                bottom: "24px",
                left: "50%",
                transform: "translateX(-50%)",
                display: "flex",
                gap: "12px",
                alignItems: "center",
                background: "rgba(0, 0, 0, 0.6)",
                padding: "8px 16px",
                borderRadius: "24px",
                zIndex: 10,
              }}
            >
              <button
                type="button"
                onClick={handleTogglePlay}
                style={{
                  background: "transparent",
                  border: "none",
                  color: "white",
                  cursor: "pointer",
                  fontSize: "20px",
                  padding: "4px 8px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
                aria-label={isPlaying ? "Pause" : "Play"}
              >
                {isPlaying ? "⏸" : "▶"}
              </button>
              <div
                style={{
                  width: "200px",
                  height: "4px",
                  background: "rgba(255, 255, 255, 0.3)",
                  borderRadius: "2px",
                  position: "relative",
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    width: `${((currentIndex + 1) / photos.length) * 100}%`,
                    height: "100%",
                    background: "white",
                    transition: "width 0.3s ease",
                  }}
                />
              </div>
              <span style={{ color: "white", fontSize: "14px", minWidth: "60px" }}>
                {currentIndex + 1} / {photos.length}
              </span>
            </div>
          )}
        </div>

        {/* Mobile Controls */}
        {isMobile && photos.length > 1 && (
          <div
            style={{
              position: "fixed",
              bottom: "24px",
              left: "50%",
              transform: "translateX(-50%)",
              display: "flex",
              gap: "16px",
              alignItems: "center",
              background: "rgba(0, 0, 0, 0.7)",
              padding: "12px 20px",
              borderRadius: "32px",
              zIndex: 100,
            }}
          >
            <button
              type="button"
              onClick={handlePrevious}
              style={{
                background: "transparent",
                border: "none",
                color: "white",
                cursor: "pointer",
                fontSize: "24px",
                padding: "4px",
              }}
              aria-label="Previous"
            >
              ‹
            </button>
            <button
              type="button"
              onClick={handleTogglePlay}
              style={{
                background: "transparent",
                border: "none",
                color: "white",
                cursor: "pointer",
                fontSize: "20px",
                padding: "4px 8px",
              }}
              aria-label={isPlaying ? "Pause" : "Play"}
            >
              {isPlaying ? "⏸" : "▶"}
            </button>
            <button
              type="button"
              onClick={handleNext}
              style={{
                background: "transparent",
                border: "none",
                color: "white",
                cursor: "pointer",
                fontSize: "24px",
                padding: "4px",
              }}
              aria-label="Next"
            >
              ›
            </button>
          </div>
        )}
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

  const frameId = context.params?.frameId as string;

  if (!frameId) {
    return {
      notFound: true,
    };
  }

  try {
    const userId = await getOrCreateUser(session);

    // Special virtual "All Photos" frame for the current user.
    if (frameId === "all") {
      const userSharedPhotos = await db
        .select({
          id: photos.id,
          s3Key: photos.s3Key,
          publicUrl: photos.publicUrl,
          filename: photos.filename,
          uploadedAt: photos.uploadedAt,
        })
        .from(photos)
        .where(and(eq(photos.userId, userId), eq(photos.isShared, true)))
        .orderBy(desc(photos.uploadedAt));

      // Shuffle photos on every page load (Fisher–Yates).
      const shuffled = [...userSharedPhotos];
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }

      const s3 = new S3Client({ region: process.env.AWS_REGION });
      const bucket = process.env.S3_BUCKET;

      if (!bucket) {
        return {
          props: {
            frameData: {
              frame: {
                id: "all",
                name: "All Photos",
                isShared: true,
                userId,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              },
              photos: [],
              isAllPhotosFrame: true,
            },
          },
        };
      }

      const photosWithUrls: FramePhoto[] = await Promise.all(
        shuffled.map(async (photo) => {
          const getCommand = new GetObjectCommand({
            Bucket: bucket,
            Key: photo.s3Key,
          });
          const presignedUrl = await getSignedUrl(s3, getCommand, { expiresIn: 3600 });

          return {
            id: photo.id,
            key: photo.s3Key,
            publicUrl: presignedUrl,
            filename: photo.filename,
            uploadedAt: photo.uploadedAt.toISOString(),
          };
        })
      );

      return {
        props: {
          frameData: {
            frame: {
              id: "all",
              name: "All Photos",
              isShared: true,
              userId,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            },
            photos: photosWithUrls,
            isAllPhotosFrame: true,
          },
        },
      };
    }

    // Standard frame behavior for persisted frames.
    const frame = await db
      .select({
        id: frames.id,
        name: frames.name,
        isShared: frames.isShared,
        userId: frames.userId,
        createdAt: frames.createdAt,
        updatedAt: frames.updatedAt,
      })
      .from(frames)
      .where(eq(frames.id, frameId))
      .limit(1);

    if (frame.length === 0) {
      return {
        notFound: true,
      };
    }

    // Check if user has access (owner or frame is shared)
    if (frame[0].userId !== userId && !frame[0].isShared) {
      return {
        redirect: {
          destination: "/?authRequired=true",
          permanent: false,
        },
      };
    }

    // Get photos in frame
    const framePhotosList = await db
      .select({
        photoId: framePhotos.photoId,
        createdAt: framePhotos.createdAt,
      })
      .from(framePhotos)
      .where(eq(framePhotos.frameId, frameId))
      .orderBy(desc(framePhotos.createdAt));

    const photoIds = framePhotosList.map((fp) => fp.photoId);

    let photosWithUrls: FramePhoto[] = [];

    if (photoIds.length > 0) {
      // Get photo details
      const framePhotosData = await db
        .select({
          id: photos.id,
          s3Key: photos.s3Key,
          publicUrl: photos.publicUrl,
          filename: photos.filename,
          uploadedAt: photos.uploadedAt,
        })
        .from(photos)
        .where(inArray(photos.id, photoIds));

      // Maintain order from framePhotosList
      const photosMap = new Map(framePhotosData.map((p) => [p.id, p]));
      const orderedPhotos = photoIds
        .map((id) => photosMap.get(id))
        .filter((p): p is NonNullable<typeof p> => p !== undefined);

      // Generate presigned URLs
      const s3 = new S3Client({ region: process.env.AWS_REGION });
      const bucket = process.env.S3_BUCKET;

      if (!bucket) {
        return {
          props: {
            frameData: {
              frame: {
                ...frame[0],
                createdAt: frame[0].createdAt.toISOString(),
                updatedAt: frame[0].updatedAt.toISOString(),
              },
              photos: [],
            },
          },
        };
      }

      photosWithUrls = await Promise.all(
        orderedPhotos.map(async (photo) => {
          const getCommand = new GetObjectCommand({
            Bucket: bucket,
            Key: photo.s3Key,
          });
          const presignedUrl = await getSignedUrl(s3, getCommand, { expiresIn: 3600 });

          return {
            id: photo.id,
            key: photo.s3Key,
            publicUrl: presignedUrl,
            filename: photo.filename,
            uploadedAt: photo.uploadedAt.toISOString(),
          };
        })
      );
    }

    return {
      props: {
        frameData: {
          frame: {
            ...frame[0],
            createdAt: frame[0].createdAt.toISOString(),
            updatedAt: frame[0].updatedAt.toISOString(),
          },
          photos: photosWithUrls,
        },
      },
    };
  } catch (error) {
    console.error("Failed to fetch frame:", error);
    return {
      notFound: true,
    };
  }
};
