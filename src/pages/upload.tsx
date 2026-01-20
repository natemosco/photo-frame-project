import { nanoid } from "nanoid";
import type { GetServerSideProps } from "next";
import { getServerSession } from "next-auth/next";
import { useCallback, useRef, useState } from "react";
import Navigation from "../components/Navigation";
import { authOptions } from "./api/auth/[...nextauth]";

type JobState = "queued" | "converting" | "uploading" | "done" | "error" | "skipped";

interface UploadJob {
  id: string;
  file: File;
  state: JobState;
  convertedFile?: File;
  error?: string;
  progress?: number;
}

export default function UploadPage() {
  const [jobs, setJobs] = useState<UploadJob[]>([]);
  const activeConversionsRef = useRef<Set<string>>(new Set());
  const conversionQueueRef = useRef<UploadJob[]>([]);
  const processingRef = useRef(false);

  // Check if file is HEIC/HEIF
  const isHeicFile = (file: File): boolean => {
    return (
      file.type === "image/heic" || file.type === "image/heif" || /\.(heic|heif)$/i.test(file.name)
    );
  };

  // Convert HEIC to JPEG
  const convertHeicToJpeg = useCallback(async (file: File): Promise<File> => {
    try {
      // Dynamically import heic2any only when needed (client-side only)
      const heic2any = (await import("heic2any")).default;
      const result = await heic2any({
        blob: file,
        toType: "image/jpeg",
        quality: 0.92,
      });

      // heic2any can return an array or a single blob
      const blob = Array.isArray(result) ? result[0] : result;

      // Create a new File object with JPEG extension
      const jpegFilename = file.name.replace(/\.(heic|heif)$/i, ".jpg");
      return new File([blob], jpegFilename, { type: "image/jpeg" });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`HEIC conversion failed: ${message}`);
    }
  }, []);

  // Upload file to S3 and save metadata with progress tracking
  const processUpload = useCallback(async (jobId: string, fileToUpload: File) => {
    try {
      // Update state to uploading if not already set
      setJobs((prev) =>
        prev.map((j) =>
          j.id === jobId && j.state !== "uploading" ? { ...j, state: "uploading", progress: 0 } : j
        )
      );

      // Request presign URL
      const presignRes = await fetch("/api/uploads/presign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filename: fileToUpload.name,
          contentType: fileToUpload.type,
          size: fileToUpload.size,
        }),
      });

      if (!presignRes.ok) {
        const e = await presignRes.json().catch(() => ({}));
        throw new Error(e?.error ?? "Failed to presign");
      }

      const { url, key, publicUrl } = await presignRes.json();

      // Upload to S3 with progress tracking using XMLHttpRequest
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();

        // Track upload progress
        xhr.upload.addEventListener("progress", (e) => {
          if (e.lengthComputable) {
            const progress = Math.round((e.loaded / e.total) * 90); // 90% for upload, 10% for metadata save
            setJobs((prev) => prev.map((j) => (j.id === jobId ? { ...j, progress } : j)));
          }
        });

        xhr.addEventListener("load", () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve();
          } else {
            reject(new Error(`Upload failed with status ${xhr.status}`));
          }
        });

        xhr.addEventListener("error", () => {
          reject(new Error("Network error during upload"));
        });

        xhr.addEventListener("abort", () => {
          reject(new Error("Upload aborted"));
        });

        xhr.open("PUT", url);
        xhr.setRequestHeader("Content-Type", fileToUpload.type);
        xhr.send(fileToUpload);
      });

      // Update progress to 95% (upload complete, saving metadata)
      setJobs((prev) => prev.map((j) => (j.id === jobId ? { ...j, progress: 95 } : j)));

      // Save metadata
      const metaRes = await fetch("/api/gallery/append", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          key,
          publicUrl,
          filename: fileToUpload.name,
          contentType: fileToUpload.type,
          size: fileToUpload.size,
          uploadedAt: new Date().toISOString(),
        }),
      });

      if (!metaRes.ok) {
        throw new Error("Uploaded, but failed to save metadata");
      }

      // Update job state to done with 100% progress
      setJobs((prev) =>
        prev.map((j) => (j.id === jobId ? { ...j, state: "done", progress: 100 } : j))
      );
    } catch (error: unknown) {
      // Update job state to error
      const message = error instanceof Error ? error.message : String(error);
      setJobs((prev) =>
        prev.map((j) =>
          j.id === jobId ? { ...j, state: "error", error: message, progress: undefined } : j
        )
      );
    }
  }, []);

  // Worker pool: process conversion queue with max concurrency of 2
  const processConversionQueue = useCallback(async () => {
    if (processingRef.current) return;
    processingRef.current = true;

    while (conversionQueueRef.current.length > 0 && activeConversionsRef.current.size < 2) {
      const job = conversionQueueRef.current.shift();
      if (!job) break;

      activeConversionsRef.current.add(job.id);

      // Update job state to converting
      setJobs((prev) => prev.map((j) => (j.id === job.id ? { ...j, state: "converting" } : j)));

      try {
        const convertedFile = await convertHeicToJpeg(job.file);

        // Update job with converted file and move to uploading
        setJobs((prev) =>
          prev.map((j) => (j.id === job.id ? { ...j, state: "uploading", convertedFile } : j))
        );

        // Start upload process
        processUpload(job.id, convertedFile);
      } catch (error: unknown) {
        // Update job with error
        const message = error instanceof Error ? error.message : String(error);
        setJobs((prev) =>
          prev.map((j) => (j.id === job.id ? { ...j, state: "error", error: message } : j))
        );
      } finally {
        activeConversionsRef.current.delete(job.id);
      }
    }

    processingRef.current = false;

    // Continue processing if there are more items in queue
    if (conversionQueueRef.current.length > 0) {
      setTimeout(() => processConversionQueue(), 100);
    }
  }, [processUpload, convertHeicToJpeg]);

  // Process files (used by both file input and drag-drop)
  const processFiles = (files: File[]) => {
    if (files.length === 0) return;

    // Create jobs for new files, avoiding duplicates (by filename + size)
    const existingKeys = new Set(jobs.map((j) => `${j.file.name}-${j.file.size}`));

    const newJobs: UploadJob[] = files
      .filter((file) => !existingKeys.has(`${file.name}-${file.size}`))
      .map((file) => ({
        id: nanoid(),
        file,
        state: "queued" as JobState,
      }));

    if (newJobs.length === 0) return;

    setJobs((prev) => [...prev, ...newJobs]);

    // Process each job
    for (const job of newJobs) {
      if (isHeicFile(job.file)) {
        // Add to conversion queue
        conversionQueueRef.current.push(job);
        processConversionQueue();
      } else {
        // Skip conversion, go directly to uploading
        // State will be set to "uploading" in processUpload
        processUpload(job.id, job.file);
      }
    }
  };

  // Handle file selection
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    processFiles(files);
  };

  // Get status display text
  const getStatusText = (job: UploadJob): string => {
    switch (job.state) {
      case "queued":
        return "Waiting...";
      case "converting":
        return "Converting HEIC to JPEG...";
      case "uploading":
        return job.progress !== undefined ? `Uploading... ${job.progress}%` : "Uploading...";
      case "done":
        return "? Uploaded";
      case "error":
        return `? Error: ${job.error || "Unknown error"}`;
      case "skipped":
        return "Processing...";
      default:
        return "";
    }
  };

  // Get conversion queue status
  const getConversionStatus = (): string => {
    const converting = jobs.filter((j) => j.state === "converting").length;
    const queued = jobs.filter((j) => j.state === "queued" && isHeicFile(j.file)).length;
    if (converting > 0) {
      const total = converting + queued;
      return `Converting ${converting} of ${total} HEIC file${total !== 1 ? "s" : ""}...`;
    }
    if (queued > 0) {
      return `Waiting to convert ${queued} HEIC file${queued !== 1 ? "s" : ""}...`;
    }
    return "";
  };

  // Clear completed jobs
  const clearCompleted = () => {
    setJobs((prev) => prev.filter((j) => j.state !== "done"));
  };

  // Clear all jobs
  const clearAll = () => {
    setJobs([]);
    conversionQueueRef.current = [];
    activeConversionsRef.current.clear();
    processingRef.current = false;
  };

  return (
    <>
      <Navigation />
      <div
        style={{
          padding: "32px 24px",
          maxWidth: "1000px",
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
            Upload Photos
          </h1>
          <p style={{ fontSize: "1.125rem", color: "#6b7280", marginBottom: "32px" }}>
            Upload your photos (max 10MB each). HEIC/HEIF files will be automatically converted to
            JPEG.
          </p>

          <div
            style={{
              border: "2px dashed #cbd5e1",
              borderRadius: "12px",
              padding: "48px 24px",
              textAlign: "center",
              backgroundColor: "rgba(99, 102, 241, 0.02)",
              transition: "all 0.3s ease",
              marginBottom: "32px",
            }}
            onDragOver={(e) => {
              e.preventDefault();
              e.currentTarget.style.borderColor = "#6366f1";
              e.currentTarget.style.backgroundColor = "rgba(99, 102, 241, 0.05)";
            }}
            onDragLeave={(e) => {
              e.currentTarget.style.borderColor = "#cbd5e1";
              e.currentTarget.style.backgroundColor = "rgba(99, 102, 241, 0.02)";
            }}
            onDrop={(e) => {
              e.preventDefault();
              e.currentTarget.style.borderColor = "#cbd5e1";
              e.currentTarget.style.backgroundColor = "rgba(99, 102, 241, 0.02)";
              
              // Extract files from drop event
              const files = Array.from(e.dataTransfer.files || []);
              processFiles(files);
            }}
          >
            <div style={{ fontSize: "3rem", marginBottom: "16px" }}>📤</div>
            <p style={{ fontSize: "1.125rem", fontWeight: "600", marginBottom: "8px" }}>
              Drop your photos here
            </p>
            <p style={{ fontSize: "0.875rem", color: "#6b7280", marginBottom: "24px" }}>
              or click to browse
            </p>
            <label
              style={{
                display: "inline-block",
                background: "linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)",
                color: "white",
                padding: "12px 32px",
                borderRadius: "8px",
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
              Select Files
              <input
                type="file"
                accept="image/*"
                multiple
                onChange={handleFileSelect}
                style={{ display: "none" }}
              />
            </label>
          </div>

          {jobs.length > 0 && (
            <div className="fade-in" style={{ marginTop: "32px" }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: "20px",
                  flexWrap: "wrap",
                  gap: "16px",
                }}
              >
                <h2
                  style={{
                    fontSize: "1.5rem",
                    fontWeight: "700",
                    margin: 0,
                    color: "#1f2937",
                  }}
                >
                  Upload Queue ({jobs.length})
                </h2>
                <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                  <button
                    type="button"
                    onClick={clearCompleted}
                    disabled={!jobs.some((j) => j.state === "done")}
                    style={{
                      padding: "8px 20px",
                      borderRadius: "8px",
                      border: "1px solid #d1d5db",
                      backgroundColor: "white",
                      color: "#374151",
                      fontSize: "14px",
                      fontWeight: "600",
                      cursor: "pointer",
                      transition: "all 0.2s ease",
                    }}
                    onMouseEnter={(e) => {
                      if (!e.currentTarget.disabled) {
                        e.currentTarget.style.backgroundColor = "#f3f4f6";
                        e.currentTarget.style.borderColor = "#9ca3af";
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!e.currentTarget.disabled) {
                        e.currentTarget.style.backgroundColor = "white";
                        e.currentTarget.style.borderColor = "#d1d5db";
                      }
                    }}
                  >
                    Clear Completed
                  </button>
                  <button
                    type="button"
                    onClick={clearAll}
                    style={{
                      padding: "8px 20px",
                      borderRadius: "8px",
                      border: "1px solid #ef4444",
                      backgroundColor: "white",
                      color: "#ef4444",
                      fontSize: "14px",
                      fontWeight: "600",
                      cursor: "pointer",
                      transition: "all 0.2s ease",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = "#fef2f2";
                      e.currentTarget.style.borderColor = "#dc2626";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = "white";
                      e.currentTarget.style.borderColor = "#ef4444";
                    }}
                  >
                    Clear All
                  </button>
                </div>
              </div>

              {getConversionStatus() && (
                <div
                  style={{
                    padding: "12px 16px",
                    backgroundColor: "rgba(99, 102, 241, 0.1)",
                    borderRadius: "8px",
                    marginBottom: "20px",
                    color: "#6366f1",
                    fontSize: "14px",
                    fontWeight: "500",
                  }}
                >
                  {getConversionStatus()}
                </div>
              )}

              <div style={{ display: "grid", gap: "16px" }}>
                {jobs.map((job) => (
                  <div
                    key={job.id}
                    className="card fade-in"
                    style={{
                      padding: "20px",
                      border: "none",
                      backgroundColor:
                        job.state === "done"
                          ? "rgba(16, 185, 129, 0.1)"
                          : job.state === "error"
                            ? "rgba(239, 68, 68, 0.1)"
                            : "#fff",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        marginBottom: 8,
                      }}
                    >
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 500 }}>{job.file.name}</div>
                        <div style={{ fontSize: 14, color: "#666", marginTop: 4 }}>
                          {getStatusText(job)}
                        </div>
                      </div>
                      <div style={{ fontSize: 12, color: "#999", marginLeft: 16 }}>
                        {(job.file.size / 1024 / 1024).toFixed(2)} MB
                      </div>
                    </div>
                    {/* Progress bar for uploading state */}
                    {job.state === "uploading" && job.progress !== undefined && (
                      <div
                        style={{
                          width: "100%",
                          height: "8px",
                          backgroundColor: "#e5e7eb",
                          borderRadius: "4px",
                          overflow: "hidden",
                          marginTop: "12px",
                        }}
                      >
                        <div
                          style={{
                            width: `${job.progress}%`,
                            height: "100%",
                            background: "linear-gradient(90deg, #6366f1 0%, #8b5cf6 100%)",
                            transition: "width 0.3s ease",
                            borderRadius: "4px",
                          }}
                        />
                      </div>
                    )}
                    {/* Error message display */}
                    {job.state === "error" && job.error && (
                      <div
                        style={{
                          marginTop: "12px",
                          padding: "12px",
                          backgroundColor: "#fee2e2",
                          border: "1px solid #fecaca",
                          borderRadius: "8px",
                          fontSize: "14px",
                          color: "#991b1b",
                          fontWeight: "500",
                        }}
                      >
                        ⚠️ {job.error}
                      </div>
                    )}
                  </div>
                ))}
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
