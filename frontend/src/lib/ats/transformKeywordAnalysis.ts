/**
 * Collapse the 4-tier enhanced keyword analysis returned by the backend's
 * Stage 2 analyzer into the 3-tier detailed shape the UI consumes.
 *
 * Backend reference: `backend/app/services/job/ats/models/keywords.py`
 * (`EnhancedKeywordAnalysis`, `EnhancedKeywordDetail`).
 */

import type {
  ATSKeywordDetailedResponse,
  ATSKeywordEnhancedAnalysis,
  KeywordDetail,
  KeywordImportance,
} from "@/lib/api/types";

export function transformEnhancedToDetailedFormat(
  enhanced: ATSKeywordEnhancedAnalysis
): ATSKeywordDetailedResponse {
  const preferredMatched = [
    ...(enhanced.strongly_preferred_matched ?? []),
    ...(enhanced.preferred_matched ?? []),
  ];
  const preferredMissing = [
    ...(enhanced.strongly_preferred_missing ?? []),
    ...(enhanced.preferred_missing ?? []),
  ];

  const allKeywords: KeywordDetail[] = (enhanced.all_keywords ?? []).map(
    (kw) => ({
      keyword: kw.keyword,
      importance:
        kw.importance === "strongly_preferred"
          ? "preferred"
          : (kw.importance as KeywordImportance),
      found_in_resume: kw.found_in_resume,
      found_in_vault: kw.found_in_vault,
      frequency_in_job: kw.frequency_in_job,
      context: kw.context,
    })
  );

  const stronglyCoverage = enhanced.strongly_preferred_coverage ?? 0;
  const preferredCoverage = enhanced.preferred_coverage ?? 0;
  const mergedPreferredCoverage =
    stronglyCoverage > 0 && preferredCoverage > 0
      ? (stronglyCoverage + preferredCoverage) / 2
      : Math.max(stronglyCoverage, preferredCoverage);

  return {
    coverage_score: (enhanced.raw_coverage ?? 0) / 100,
    required_coverage: enhanced.required_coverage ?? 0,
    preferred_coverage: mergedPreferredCoverage,
    required_matched: enhanced.required_matched ?? [],
    required_missing: enhanced.required_missing ?? [],
    preferred_matched: preferredMatched,
    preferred_missing: preferredMissing,
    nice_to_have_matched: enhanced.nice_to_have_matched ?? [],
    nice_to_have_missing: enhanced.nice_to_have_missing ?? [],
    missing_available_in_vault: enhanced.missing_available_in_vault ?? [],
    missing_not_in_vault: enhanced.missing_not_in_vault ?? [],
    all_keywords: allKeywords,
    suggestions: enhanced.suggestions ?? [],
    warnings: enhanced.warnings ?? [],
  };
}
