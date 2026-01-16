import { useSession } from "next-auth/react";
import { useState, useCallback, useRef } from "react";
import Navigation from "../components/Navigation";
import heic2any from "heic2any";
import { nanoid } from "nanoid";

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
  const { data: session, status } = useSession();
  const [jobs, setJobs] = useState<UploadJob[]>([]);
  const activeConversionsRef = useRef<Set<string>>(new Set());
  const conversionQueueRef = useRef<UploadJob[]>([]);
  const processingRef = useRef(false);

  if (status === "loading") {
    return (
      <>
        <Navigation />
        <div style={{ padding: 24 }}>Loading?</div>
      </>
    );
  }

  if (!session) {
    return (
      <>
        <Navigation />
        <div style={{ padding: 24 }}>
          <h1>Upload</h1>
          <p>Please sign in to upload photos.</p>
        </div>
      </>
    );
  }

  // Check if file is HEIC/HEIF
  const isHeicFile = (file: File): boolean => {
    return (
      file.type === "image/heic" ||
      file.type === "image/heif" ||
      /\.(heic|heif)$/i.test(file.name)
    );
  };

  // Convert HEIC to JPEG
  const convertHeicToJpeg = async (file: File): Promise<File> => {
    try {
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
    } catch (error: any) {
      throw new Error(`HEIC conversion failed: ${error.message}`);
    }
  };

  // Upload file to S3 and save metadata with progress tracking
  const processUpload = useCallback(async (jobId: string, fileToUpload: File) => {
    try {
      // Update state to uploading if not already set
      setJobs((prev) =>
        prev.map((j) =>
          j.id === jobId && j.state !== "uploading"
            ? { ...j, state: "uploading", progress: 0 }
            : j
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
            setJobs((prev) =>
              prev.map((j) => (j.id === jobId ? { ...j, progress } : j))
            );
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
      setJobs((prev) =>
        prev.map((j) => (j.id === jobId ? { ...j, progress: 95 } : j))
      );

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
    } catch (error: any) {
      // Update job state to error
      setJobs((prev) =>
        prev.map((j) =>
          j.id === jobId
            ? { ...j, state: "error", error: error.message, progress: undefined }
            : j
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
      setJobs((prev) =>
        prev.map((j) => (j.id === job.id ? { ...j, state: "converting" } : j))
      );

      try {
        const convertedFile = await convertHeicToJpeg(job.file);
        
        // Update job with converted file and move to uploading
        setJobs((prev) =>
          prev.map((j) =>
            j.id === job.id
              ? { ...j, state: "uploading", convertedFile }
              : j
          )
        );

        // Start upload process
        processUpload(job.id, convertedFile);
      } catch (error: any) {
        // Update job with error
        setJobs((prev) =>
          prev.map((j) =>
            j.id === job.id
              ? { ...j, state: "error", error: error.message }
              : j
          )
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
  }, [processUpload]);

  // Handle file selection
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
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
    newJobs.forEach((job) => {
      if (isHeicFile(job.file)) {
        // Add to conversion queue
        conversionQueueRef.current.push(job);
        processConversionQueue();
      } else {
        // Skip conversion, go directly to uploading
        // State will be set to "uploading" in processUpload
        processUpload(job.id, job.file);
      }
    });
  };

  // Get status display text
  const getStatusText = (job: UploadJob): string => {
    switch (job.state) {
      case "queued":
        return "Waiting...";
      case "converting":
        return "Converting HEIC to JPEG...";
      case "uploading":
        return job.progress !== undefined
          ? `Uploading... ${job.progress}%`
          : "Uploading...";
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
    } else if (queued > 0) {
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
      <div style={{ padding: 24 }}>
        <h1 style={{ marginTop: 16 }}>Upload photos (? 10MB each)</h1>

        <input
          type="file"
          accept="image/*"
          multiple
          onChange={handleFileSelect}
        />

        {jobs.length > 0 && (
          <div style={{ marginTop: 24 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <h2>Upload Queue ({jobs.length})</h2>
              <div>
                <button
                  onClick={clearCompleted}
                  style={{ marginRight: 8 }}
                  disabled={!jobs.some((j) => j.state === "done")}
                >
                  Clear Completed
                </button>
                <button onClick={clearAll}>Clear All</button>
              </div>
            </div>

            {getConversionStatus() && (
              <p style={{ marginBottom: 12, color: "#666" }}>{getConversionStatus()}</p>
            )}

            <div style={{ display: "grid", gap: 12 }}>
              {jobs.map((job) => (
                <div
                  key={job.id}
                  style={{
                    padding: 12,
                    border: "1px solid #ddd",
                    borderRadius: 4,
                    backgroundColor: job.state === "done" ? "#f0f9ff" : job.state === "error" ? "#fef2f2" : "#fff",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
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
                        height: 6,
                        backgroundColor: "#e5e7eb",
                        borderRadius: 3,
                        overflow: "hidden",
                        marginTop: 8,
                      }}
                    >
                      <div
                        style={{
                          width: `${job.progress}%`,
                          height: "100%",
                          backgroundColor: "#3b82f6",
                          transition: "width 0.3s ease",
                        }}
                      />
                    </div>
                  )}
                  {/* Error message display */}
                  {job.state === "error" && job.error && (
                    <div
                      style={{
                        marginTop: 8,
                        padding: 8,
                        backgroundColor: "#fee2e2",
                        borderRadius: 4,
                        fontSize: 12,
                        color: "#991b1b",
                      }}
                    >
                      {job.error}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
