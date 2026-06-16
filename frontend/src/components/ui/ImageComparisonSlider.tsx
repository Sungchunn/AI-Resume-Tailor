"use client";

import Image from "next/image";
import { useState } from "react";
import { GripVertical } from "lucide-react";

type ImageComparisonSliderProps = {
  originalSrc: string;
  comparisonSrc: string;
  originalAlt: string;
  comparisonAlt: string;
  className?: string;
};

export function ImageComparisonSlider({
  originalSrc,
  comparisonSrc,
  originalAlt,
  comparisonAlt,
  className = "",
}: ImageComparisonSliderProps) {
  const [position, setPosition] = useState(50);

  return (
    <div className={className}>
      <div className="mb-4 flex items-center justify-between text-sm font-medium text-muted-foreground">
        <span>Original</span>
        <span>Tailored</span>
      </div>

      <div className="relative isolate aspect-[1628/1000] overflow-hidden rounded-lg border border-border bg-card shadow-2xl shadow-foreground/10 focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 focus-within:ring-offset-background">
        <Image
          src={comparisonSrc}
          alt={comparisonAlt}
          fill
          sizes="(min-width: 1280px) 1120px, calc(100vw - 32px)"
          className="object-cover object-left-top"
        />

        <div
          className="absolute inset-0 overflow-hidden"
          style={{ clipPath: `inset(0 ${100 - position}% 0 0)` }}
        >
          <Image
            src={originalSrc}
            alt={originalAlt}
            fill
            sizes="(min-width: 1280px) 1120px, calc(100vw - 32px)"
            className="max-w-none object-cover object-left-top"
          />
        </div>

        <div
          className="pointer-events-none absolute inset-y-0 z-10 w-px bg-background shadow-[0_0_0_1px_rgba(0,0,0,0.18)]"
          style={{ left: `${position}%` }}
        />

        <div
          className="pointer-events-none absolute top-1/2 z-20 flex h-11 w-11 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-background text-foreground shadow-lg"
          style={{ left: `${position}%` }}
        >
          <GripVertical className="h-5 w-5" aria-hidden="true" />
        </div>

        <input
          type="range"
          min="0"
          max="100"
          value={position}
          aria-label="Compare original and tailored resume screenshots"
          className="absolute inset-0 z-30 h-full w-full cursor-ew-resize opacity-0"
          onChange={(event) => setPosition(Number(event.target.value))}
        />
      </div>
    </div>
  );
}
