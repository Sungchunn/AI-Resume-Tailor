"use client";

interface ScoreCategory {
  label: string;
  score: number;
  maxScore?: number;
}

interface ScoreBreakdownProps {
  categories: ScoreCategory[];
  className?: string;
}

function getBarColor(score: number, max: number): string {
  const percentage = (score / max) * 100;
  if (percentage >= 80) return "bg-green-500";
  if (percentage >= 60) return "bg-yellow-500";
  return "bg-red-500";
}

export function ScoreBreakdown({ categories, className = "" }: ScoreBreakdownProps) {
  return (
    <div className={`space-y-3 ${className}`}>
      {categories.map((category) => {
        const max = category.maxScore ?? 100;
        const percentage = Math.min((category.score / max) * 100, 100);
        const barColor = getBarColor(category.score, max);

        return (
          <div key={category.label}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm text-foreground/80">{category.label}</span>
              <span className="text-sm font-medium text-foreground">
                {Math.round(category.score)}/{max}
              </span>
            </div>
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <div
                className={`h-full ${barColor} rounded-full transition-all duration-500`}
                style={{ width: `${percentage}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ATS-specific breakdown using actual analysis data
interface ATSBreakdownProps {
  requiredCoverage: number;
  preferredCoverage: number;
  overallScore: number;
  requiredMatched: number;
  requiredTotal: number;
  preferredMatched: number;
  preferredTotal: number;
  className?: string;
}

export function ATSBreakdown({
  requiredCoverage,
  preferredCoverage,
  overallScore,
  requiredMatched,
  requiredTotal,
  preferredMatched,
  preferredTotal,
  className = "",
}: ATSBreakdownProps) {
  const categories: ScoreCategory[] = [
    {
      label: `Required Keywords (${requiredMatched}/${requiredTotal})`,
      score: requiredCoverage,
    },
    {
      label: `Preferred Keywords (${preferredMatched}/${preferredTotal})`,
      score: preferredCoverage,
    },
    {
      label: "Overall ATS Score",
      score: overallScore,
    },
  ];

  return <ScoreBreakdown categories={categories} className={className} />;
}

// Skill match breakdown
interface SkillBreakdownProps {
  skillMatches: string[];
  skillGaps: string[];
  keywordCoverage: number;
  className?: string;
}

export function SkillBreakdown({
  skillMatches,
  skillGaps,
  keywordCoverage,
  className = "",
}: SkillBreakdownProps) {
  const totalSkills = skillMatches.length + skillGaps.length;
  const matchPercentage = totalSkills > 0 ? (skillMatches.length / totalSkills) * 100 : 0;

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Coverage bar */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <span className="text-sm text-foreground/80">Keyword Coverage</span>
          <span className="text-sm font-medium text-foreground">
            {Math.round(keywordCoverage)}%
          </span>
        </div>
        <div className="h-2 bg-muted rounded-full overflow-hidden">
          <div
            className={`h-full ${getBarColor(keywordCoverage, 100)} rounded-full transition-all duration-500`}
            style={{ width: `${keywordCoverage}%` }}
          />
        </div>
      </div>

      {/* Skill matches */}
      {skillMatches.length > 0 && (
        <div>
          <h4 className="text-xs font-medium text-muted-foreground mb-2">
            Matched Skills ({skillMatches.length})
          </h4>
          <div className="flex flex-wrap gap-1">
            {skillMatches.slice(0, 8).map((skill) => (
              <span
                key={skill}
                className="px-2 py-0.5 text-xs bg-green-100 text-green-700 rounded-full"
              >
                {skill}
              </span>
            ))}
            {skillMatches.length > 8 && (
              <span className="px-2 py-0.5 text-xs bg-muted text-muted-foreground rounded-full">
                +{skillMatches.length - 8} more
              </span>
            )}
          </div>
        </div>
      )}

      {/* Skill gaps */}
      {skillGaps.length > 0 && (
        <div>
          <h4 className="text-xs font-medium text-muted-foreground mb-2">
            Missing Skills ({skillGaps.length})
          </h4>
          <div className="flex flex-wrap gap-1">
            {skillGaps.slice(0, 6).map((skill) => (
              <span
                key={skill}
                className="px-2 py-0.5 text-xs bg-red-100 text-red-700 rounded-full"
              >
                {skill}
              </span>
            ))}
            {skillGaps.length > 6 && (
              <span className="px-2 py-0.5 text-xs bg-muted text-muted-foreground rounded-full">
                +{skillGaps.length - 6} more
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
