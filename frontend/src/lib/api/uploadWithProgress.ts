/**
 * Upload with Progress
 *
 * XMLHttpRequest wrapper that provides upload progress events.
 * Fetch API doesn't support upload progress, so we use XHR.
 */

import { tokenManager } from "./client";

export interface UploadProgressEvent {
  loaded: number;
  total: number;
  percent: number;
}

export interface UploadOptions<T> {
  file: File;
  url: string;
  headers?: Record<string, string>;
  onProgress?: (event: UploadProgressEvent) => void;
}

export interface UploadResult<T> {
  promise: Promise<T>;
  abort: () => void;
}

/**
 * Upload a file with progress tracking.
 *
 * @example
 * ```typescript
 * const { promise, abort } = uploadWithProgress<DocumentExtractionResponse>({
 *   file: myFile,
 *   url: `${API_BASE_URL}/api/upload/extract`,
 *   onProgress: (e) => console.log(`${e.percent}%`),
 * });
 *
 * try {
 *   const result = await promise;
 * } catch (err) {
 *   if (err.message === "Upload cancelled") {
 *     // User cancelled
 *   }
 * }
 * ```
 */
export function uploadWithProgress<T>(options: UploadOptions<T>): UploadResult<T> {
  const xhr = new XMLHttpRequest();

  const promise = new Promise<T>((resolve, reject) => {
    // Track upload progress
    xhr.upload.addEventListener("progress", (e) => {
      if (e.lengthComputable && options.onProgress) {
        options.onProgress({
          loaded: e.loaded,
          total: e.total,
          percent: Math.round((e.loaded / e.total) * 100),
        });
      }
    });

    // Handle successful response
    xhr.addEventListener("load", () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          resolve(JSON.parse(xhr.responseText));
        } catch {
          reject(new Error("Invalid JSON response"));
        }
      } else {
        // Try to parse error response
        try {
          const errorData = JSON.parse(xhr.responseText);
          reject(new Error(errorData.detail || `HTTP ${xhr.status}: ${xhr.statusText}`));
        } catch {
          reject(new Error(`HTTP ${xhr.status}: ${xhr.statusText}`));
        }
      }
    });

    // Handle network errors
    xhr.addEventListener("error", () => {
      reject(new Error("Network error. Check your connection and try again."));
    });

    // Handle abort
    xhr.addEventListener("abort", () => {
      reject(new Error("Upload cancelled"));
    });

    // Handle timeout
    xhr.addEventListener("timeout", () => {
      reject(new Error("Upload timed out. Please try again."));
    });

    // Prepare form data
    const formData = new FormData();
    formData.append("file", options.file);

    // Open connection
    xhr.open("POST", options.url);

    // Set timeout (5 minutes for large files)
    xhr.timeout = 5 * 60 * 1000;

    // Set headers
    const token = tokenManager.getAccessToken();
    if (token) {
      xhr.setRequestHeader("Authorization", `Bearer ${token}`);
    }

    // Set any additional headers (except Content-Type which is set by FormData)
    if (options.headers) {
      Object.entries(options.headers).forEach(([key, value]) => {
        if (key.toLowerCase() !== "content-type") {
          xhr.setRequestHeader(key, value);
        }
      });
    }

    // Send the request
    xhr.send(formData);
  });

  return {
    promise,
    abort: () => xhr.abort(),
  };
}

/**
 * Format bytes to human-readable string.
 *
 * @example
 * formatBytes(1024) // "1.0 KB"
 * formatBytes(1234567) // "1.2 MB"
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";

  const units = ["B", "KB", "MB", "GB"];
  const k = 1024;
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${units[i]}`;
}
