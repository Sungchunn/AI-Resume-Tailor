"use client";

import { useCallback } from "react";
import type { AnyResumeBlock, BlockEditorStyle } from "@/lib/resume/types";
import { useAutoFitBlocks } from "./useAutoFitBlocks";
import type { UseAutoFitBlocksResult } from "./useAutoFitBlocks";

/**
 * Ref handle expected from ResumePreview
 */
interface ResumePreviewRefHandle {
  getPageElement: () => HTMLElement | null;
}

/**
 * Options for the DOM-based fit-to-page hook
 */
export interface UseFitToPageWithDOMOptions {
  /** Ref to the ResumePreview component */
  previewRef: React.RefObject<ResumePreviewRefHandle | null>;
  /** Resume blocks to render */
  blocks: AnyResumeBlock[];
  /** Current style settings */
  style: BlockEditorStyle;
  /** Whether auto-fit is enabled */
  enabled: boolean;
  /** Callback when style changes are needed */
  onStyleChange: (style: Partial<BlockEditorStyle>) => void;
}

/**
 * DOM bridge hook that connects ResumePreview's ref with useAutoFitBlocks.
 *
 * This hook provides real DOM-based measurement for the auto-fit algorithm,
 * enabling accurate binary search (O(log n)) rather than estimation-based
 * linear iteration (O(n)).
 *
 * Why this pattern exists:
 * - DOM measurement requires access to the rendered page element
 * - ResumePreview owns this element and exposes it via useImperativeHandle
 * - This hook bridges the gap, allowing auto-fit to "pull" measurements when needed
 *
 * See docs/features/fit-to-one-page/130326_tradeoff-2-coupling-preview-to-autofit.md
 * for detailed rationale on why this ref coupling is intentional and load-bearing.
 *
 * @example
 * ```tsx
 * const previewRef = useRef<ResumePreviewHandle>(null);
 *
 * const { status, reductions } = useFitToPageWithDOM({
 *   previewRef,
 *   blocks: state.blocks,
 *   style: state.style,
 *   enabled: state.fitToOnePage,
 *   onStyleChange: updateStyle,
 * });
 *
 * return <ResumePreview ref={previewRef} blocks={blocks} style={style} />;
 * ```
 */
export function useFitToPageWithDOM({
  previewRef,
  blocks,
  style,
  enabled,
  onStyleChange,
}: UseFitToPageWithDOMOptions): UseAutoFitBlocksResult {
  /**
   * Measurement function that reads scrollHeight from the page element.
   *
   * Returns 0 if the preview ref is not connected, which will cause
   * the auto-fit algorithm to skip processing (content "fits" at height 0).
   * This is a safe fallback during initial render or ref connection.
   */
  const measureFn = useCallback(() => {
    const pageElement = previewRef.current?.getPageElement();
    return pageElement?.scrollHeight ?? 0;
  }, [previewRef]);

  return useAutoFitBlocks({
    blocks,
    style,
    enabled,
    onStyleChange,
    measureFn,
  });
}
