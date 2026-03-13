/**
 * Style Panel Components
 *
 * Components and hooks for managing resume styling with auto-fit support.
 */

export { AutoFitToggle, type AutoFitToggleProps } from "./AutoFitToggle";
export {
  useAutoFitBlocks,
  measureWithRAF,
  findOptimalCompactness,
  compactnessToStyle,
  calculateReductions,
  MINIMUMS,
  PAGE_HEIGHT,
  STABILITY_THRESHOLD_PX,
  type AutoFitStatus,
  type AutoFitState,
  type AutoFitReduction,
  type UseAutoFitBlocksOptions,
  type UseAutoFitBlocksResult,
  type BinarySearchResult,
} from "./useAutoFitBlocks";
export {
  useFitToPageWithDOM,
  type UseFitToPageWithDOMOptions,
} from "./useFitToPageWithDOM";
