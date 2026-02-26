"use client";

import { ChevronLeftIcon, ChevronRightIcon } from "@/components/icons";

interface PreviewPaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

export function PreviewPagination({
  currentPage,
  totalPages,
  onPageChange,
}: PreviewPaginationProps) {
  return (
    <div className="flex items-center gap-2 mt-4 bg-card rounded-lg shadow px-3 py-2">
      <button
        onClick={() => onPageChange(Math.max(1, currentPage - 1))}
        disabled={currentPage === 1}
        className="p-1 rounded hover:bg-accent disabled:opacity-50 disabled:cursor-not-allowed"
        aria-label="Previous page"
      >
        <ChevronLeftIcon className="w-4 h-4" />
      </button>

      <span className="text-sm text-muted-foreground min-w-[60px] text-center">
        {currentPage} / {totalPages}
      </span>

      <button
        onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
        disabled={currentPage === totalPages}
        className="p-1 rounded hover:bg-accent disabled:opacity-50 disabled:cursor-not-allowed"
        aria-label="Next page"
      >
        <ChevronRightIcon className="w-4 h-4" />
      </button>
    </div>
  );
}
