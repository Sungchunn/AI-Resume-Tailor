"use client";

import { XCircle, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { KnockoutRisk } from "../../WorkshopContext";

interface KnockoutAlertsProps {
  risks: KnockoutRisk[];
}

export function KnockoutAlerts({ risks }: KnockoutAlertsProps) {
  const hardRisks = risks.filter(r => r.severity === "hard");
  const softRisks = risks.filter(r => r.severity === "soft");

  if (risks.length === 0) return null;

  return (
    <div className="space-y-3">
      {hardRisks.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-3">
            <XCircle className="w-5 h-5 text-red-600" />
            <h3 className="font-medium text-red-900">
              Knockout Risk Detected
            </h3>
          </div>
          <p className="text-sm text-red-800 mb-3">
            These requirements may auto-reject your application:
          </p>
          <ul className="space-y-2">
            {hardRisks.map((risk, i) => (
              <KnockoutRiskItem key={i} risk={risk} />
            ))}
          </ul>
        </div>
      )}

      {softRisks.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-3">
            <AlertCircle className="w-5 h-5 text-amber-600" />
            <h3 className="font-medium text-amber-900">
              Potential Concerns
            </h3>
          </div>
          <ul className="space-y-2">
            {softRisks.map((risk, i) => (
              <KnockoutRiskItem key={i} risk={risk} variant="soft" />
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function KnockoutRiskItem({
  risk,
  variant = "hard",
}: {
  risk: KnockoutRisk;
  variant?: "hard" | "soft";
}) {
  const categoryLabels: Record<string, string> = {
    experience: "Experience",
    education: "Education",
    certification: "Certification",
    location: "Location",
  };

  return (
    <li className="text-sm">
      <span className={cn(
        "font-medium",
        variant === "hard" ? "text-red-900" : "text-amber-900"
      )}>
        {categoryLabels[risk.category] ?? risk.category}:
      </span>{" "}
      <span className={variant === "hard" ? "text-red-800" : "text-amber-800"}>
        {risk.message}
      </span>
      <div className="mt-1 text-xs opacity-75">
        Job requires: {risk.job_requirement} | Your resume: {risk.resume_value}
      </div>
    </li>
  );
}
