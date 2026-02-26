"use client";

import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import { useExtractDocument } from "@/lib/api";
import type { DocumentExtractionResponse } from "@/lib/api/types";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ACCEPTED_FILE_TYPES = {
  "application/pdf": [".pdf"],
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [
    ".docx",
  ],
};

interface FileUploadZoneProps {
  onExtracted: (result: DocumentExtractionResponse) => void;
  onError?: (error: Error) => void;
}

export function FileUploadZone({ onExtracted, onError }: FileUploadZoneProps) {
  const [fileError, setFileError] = useState<string | null>(null);
  const extractDocument = useExtractDocument();

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      setFileError(null);

      if (acceptedFiles.length === 0) {
        return;
      }

      const file = acceptedFiles[0];

      if (file.size > MAX_FILE_SIZE) {
        const error = "File too large. Maximum size is 10MB.";
        setFileError(error);
        onError?.(new Error(error));
        return;
      }

      try {
        const result = await extractDocument.mutateAsync(file);
        onExtracted(result);
      } catch (err) {
        const error = err instanceof Error ? err : new Error("Upload failed");
        setFileError(error.message);
        onError?.(error);
      }
    },
    [extractDocument, onExtracted, onError]
  );

  const { getRootProps, getInputProps, isDragActive, isDragReject } =
    useDropzone({
      onDrop,
      accept: ACCEPTED_FILE_TYPES,
      maxFiles: 1,
      maxSize: MAX_FILE_SIZE,
      disabled: extractDocument.isPending,
    });

  const getBorderColor = () => {
    if (isDragReject) return "border-destructive bg-destructive/10";
    if (isDragActive) return "border-blue-400 bg-blue-50";
    if (fileError) return "border-destructive/30";
    return "border-input hover:border-input/80";
  };

  return (
    <div className="space-y-4">
      <div
        {...getRootProps()}
        className={`relative flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-8 transition-colors cursor-pointer ${getBorderColor()}`}
      >
        <input {...getInputProps()} />

        {extractDocument.isPending ? (
          <div className="flex flex-col items-center">
            <svg
              className="h-10 w-10 animate-spin text-blue-500"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
            <p className="mt-4 text-sm text-muted-foreground">Extracting text...</p>
          </div>
        ) : (
          <>
            <svg
              className={`h-10 w-10 ${isDragActive ? "text-blue-500" : "text-muted-foreground/60"}`}
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m6.75 12l-3-3m0 0l-3 3m3-3v6m-1.5-15H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"
              />
            </svg>
            <p className="mt-4 text-sm font-medium text-foreground/80">
              {isDragActive
                ? "Drop your file here"
                : "Drag & drop your resume file"}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              or click to browse (PDF, DOCX up to 10MB)
            </p>
          </>
        )}
      </div>

      {fileError && (
        <div className="rounded-lg bg-destructive/10 border border-destructive/20 p-3">
          <p className="text-sm text-destructive">{fileError}</p>
        </div>
      )}
    </div>
  );
}
