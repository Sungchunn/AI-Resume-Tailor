"use client";

import { useState, useEffect } from "react";
import type { JobListingFilters as Filters, JobListingSortBy, FilterOption } from "@/lib/api/types";
import { ChevronDownIcon } from "@/components/icons";
import { jobListingApi } from "@/lib/api/client";

interface JobListingFiltersProps {
  filters: Filters;
  onFiltersChange: (filters: Filters) => void;
}

const SORT_OPTIONS: { value: JobListingSortBy; label: string }[] = [
  { value: "date_posted", label: "Date Posted" },
  { value: "salary_max", label: "Salary (High)" },
  { value: "salary_min", label: "Salary (Low)" },
  { value: "company_name", label: "Company" },
  { value: "job_title", label: "Title" },
];

const APPLICANT_PRESETS = [
  { value: 25, label: "<25" },
  { value: 50, label: "<50" },
  { value: 100, label: "<100" },
  { value: undefined, label: "Any" },
];

export function JobListingFilters({ filters, onFiltersChange }: JobListingFiltersProps) {
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showCountry, setShowCountry] = useState(false);
  const [showCity, setShowCity] = useState(false);
  const [filterOptions, setFilterOptions] = useState<{
    countries: FilterOption[];
    seniorities: FilterOption[];
    cities: FilterOption[];
  } | null>(null);

  // Load filter options on mount
  useEffect(() => {
    const loadFilterOptions = async () => {
      try {
        const options = await jobListingApi.getFilterOptions();
        setFilterOptions(options);
      } catch (error) {
        console.error("Failed to load filter options:", error);
      }
    };
    loadFilterOptions();
  }, []);

  // Handler functions (unchanged API calls)
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onFiltersChange({ ...filters, search: e.target.value || undefined, offset: 0 });
  };

  const handleCompanyNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onFiltersChange({ ...filters, company_name: e.target.value || undefined, offset: 0 });
  };

  const handleSortChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onFiltersChange({ ...filters, sort_by: e.target.value as JobListingSortBy });
  };

  const handleSortOrderChange = () => {
    onFiltersChange({
      ...filters,
      sort_order: filters.sort_order === "asc" ? "desc" : "asc",
    });
  };

  const handleRemoteOnlyChange = (checked: boolean) => {
    onFiltersChange({ ...filters, is_remote: checked ? true : undefined, offset: 0 });
  };

  const handleEasyApplyChange = (checked: boolean) => {
    onFiltersChange({ ...filters, easy_apply: checked ? true : undefined, offset: 0 });
  };

  const handleSavedOnlyChange = (checked: boolean) => {
    onFiltersChange({ ...filters, is_saved: checked ? true : undefined, offset: 0 });
  };

  const handleHideHiddenChange = (checked: boolean) => {
    onFiltersChange({ ...filters, is_hidden: checked ? false : undefined, offset: 0 });
  };

  const handleSeniorityChange = (value: string) => {
    const currentSeniorities = filters.seniority?.split(",") || [];
    let newSeniorities: string[];
    if (currentSeniorities.includes(value)) {
      newSeniorities = currentSeniorities.filter((s) => s !== value);
    } else {
      newSeniorities = [...currentSeniorities, value];
    }
    onFiltersChange({
      ...filters,
      seniority: newSeniorities.length > 0 ? newSeniorities.join(",") : undefined,
      offset: 0,
    });
  };

  const handleCountryToggle = (value: string) => {
    const includedCountries = filters.country?.split(",").filter(Boolean) || [];
    const excludedCountries = filters.exclude_country?.split(",").filter(Boolean) || [];
    const isIncluded = includedCountries.includes(value);
    const isExcluded = excludedCountries.includes(value);

    let newIncluded = includedCountries;
    let newExcluded = excludedCountries;

    if (!isIncluded && !isExcluded) {
      newIncluded = [...includedCountries, value];
    } else if (isIncluded) {
      newIncluded = includedCountries.filter((c) => c !== value);
      newExcluded = [...excludedCountries, value];
    } else {
      newExcluded = excludedCountries.filter((c) => c !== value);
    }

    onFiltersChange({
      ...filters,
      country: newIncluded.length > 0 ? newIncluded.join(",") : undefined,
      exclude_country: newExcluded.length > 0 ? newExcluded.join(",") : undefined,
      offset: 0,
    });
  };

  const handleCityToggle = (value: string) => {
    const includedCities = filters.city?.split(",").filter(Boolean) || [];
    const excludedCities = filters.exclude_city?.split(",").filter(Boolean) || [];
    const isIncluded = includedCities.includes(value);
    const isExcluded = excludedCities.includes(value);

    let newIncluded = includedCities;
    let newExcluded = excludedCities;

    if (!isIncluded && !isExcluded) {
      newIncluded = [...includedCities, value];
    } else if (isIncluded) {
      newIncluded = includedCities.filter((c) => c !== value);
      newExcluded = [...excludedCities, value];
    } else {
      newExcluded = excludedCities.filter((c) => c !== value);
    }

    onFiltersChange({
      ...filters,
      city: newIncluded.length > 0 ? newIncluded.join(",") : undefined,
      exclude_city: newExcluded.length > 0 ? newExcluded.join(",") : undefined,
      offset: 0,
    });
  };

  const handleApplicantsMaxChange = (value: number | undefined) => {
    onFiltersChange({ ...filters, applicants_max: value, offset: 0 });
  };

  const handleApplicantsIncludeNaChange = (checked: boolean) => {
    onFiltersChange({ ...filters, applicants_include_na: checked, offset: 0 });
  };

  const handleSalaryMinChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value ? parseInt(e.target.value, 10) : undefined;
    onFiltersChange({ ...filters, salary_min: value, offset: 0 });
  };

  const handleSalaryMaxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value ? parseInt(e.target.value, 10) : undefined;
    onFiltersChange({ ...filters, salary_max: value, offset: 0 });
  };

  const clearFilters = () => {
    onFiltersChange({
      limit: filters.limit,
      offset: 0,
      sort_by: "date_posted",
      sort_order: "desc",
      applicants_include_na: true,
      exclude_city: undefined,
      exclude_country: undefined,
    });
  };

  // Derived state
  const selectedSeniorities = filters.seniority?.split(",") || [];
  const selectedCountries = filters.country?.split(",") || [];
  const selectedCities = filters.city?.split(",") || [];
  const excludedCities = filters.exclude_city?.split(",") || [];
  const excludedCountries = filters.exclude_country?.split(",") || [];

  const seniorityOptions = filterOptions?.seniorities || [];
  const countryOptions = filterOptions?.countries || [];
  const cityOptions = filterOptions?.cities || [];

  const hasActiveFilters =
    filters.search || filters.company_name || filters.city || filters.country ||
    filters.exclude_city || filters.exclude_country || filters.seniority ||
    filters.is_remote || filters.easy_apply || filters.applicants_max !== undefined ||
    filters.salary_min || filters.salary_max || filters.is_saved;

  return (
    <div className="space-y-4">
      {/* Search */}
      <input
        type="text"
        value={filters.search || ""}
        onChange={handleSearchChange}
        placeholder="Search jobs..."
        className="w-full px-3 py-2 text-sm bg-card dark:bg-zinc-800 border border-border dark:border-zinc-600 rounded-lg focus:ring-1 focus:ring-primary focus:border-primary"
      />

      {/* Sort */}
      <div className="flex gap-1.5">
        <select
          value={filters.sort_by || "date_posted"}
          onChange={handleSortChange}
          className="flex-1 px-2 py-1.5 text-sm bg-card dark:bg-zinc-800 border border-border dark:border-zinc-600 rounded-md focus:ring-1 focus:ring-primary"
        >
          {SORT_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
        <button
          onClick={handleSortOrderChange}
          className="px-2 py-1.5 text-sm border border-border dark:border-zinc-600 dark:bg-zinc-800 rounded-md hover:bg-accent"
          title={filters.sort_order === "asc" ? "Ascending" : "Descending"}
        >
          {filters.sort_order === "asc" ? "↑" : "↓"}
        </button>
      </div>

      {/* Quick Toggles */}
      <div className="flex flex-wrap gap-1.5">
        <ToggleChip active={filters.is_remote === true} onClick={() => handleRemoteOnlyChange(!filters.is_remote)}>
          Remote
        </ToggleChip>
        <ToggleChip active={filters.easy_apply === true} onClick={() => handleEasyApplyChange(!filters.easy_apply)}>
          Easy Apply
        </ToggleChip>
        <ToggleChip active={filters.is_saved === true} onClick={() => handleSavedOnlyChange(!filters.is_saved)}>
          Saved
        </ToggleChip>
        <ToggleChip active={filters.is_hidden === false} onClick={() => handleHideHiddenChange(filters.is_hidden !== false)}>
          Hide Hidden
        </ToggleChip>
      </div>

      {/* Company */}
      <div>
        <label className="block text-xs font-medium text-muted-foreground mb-1">Company</label>
        <input
          type="text"
          value={filters.company_name || ""}
          onChange={handleCompanyNameChange}
          placeholder="Filter by company..."
          className="w-full px-3 py-1.5 text-sm bg-card dark:bg-zinc-800 border border-border dark:border-zinc-600 rounded-md focus:ring-1 focus:ring-primary"
        />
      </div>

      {/* Seniority */}
      {seniorityOptions.length > 0 && (
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1.5">Seniority</label>
          <div className="flex flex-wrap gap-1.5">
            {seniorityOptions.map((opt) => (
              <ToggleChip
                key={opt.value}
                active={selectedSeniorities.includes(opt.value)}
                onClick={() => handleSeniorityChange(opt.value)}
                count={opt.count}
              >
                {opt.label}
              </ToggleChip>
            ))}
          </div>
        </div>
      )}

      {/* Country */}
      {countryOptions.length > 0 && (
        <div>
          <button
            onClick={() => setShowCountry(!showCountry)}
            className="flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground w-full"
          >
            <ChevronDownIcon className={`h-3.5 w-3.5 transition-transform ${showCountry ? "rotate-180" : ""}`} />
            <span>Country</span>
            {(selectedCountries.length > 0 || excludedCountries.length > 0) && (
              <span className="ml-auto text-primary text-[10px]">
                {selectedCountries.length > 0 && `+${selectedCountries.length}`}
                {excludedCountries.length > 0 && ` -${excludedCountries.length}`}
              </span>
            )}
          </button>
          {showCountry && (
            <div className="mt-1.5 space-y-0.5 max-h-32 overflow-y-auto">
              {countryOptions.map((opt) => {
                const isIncluded = selectedCountries.includes(opt.value);
                const isExcluded = excludedCountries.includes(opt.value);
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => handleCountryToggle(opt.value)}
                    className={`w-full flex items-center gap-2 px-1.5 py-1 rounded text-left text-xs transition-colors ${
                      isIncluded ? "text-primary" : isExcluded ? "text-destructive" : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <span className={`shrink-0 w-4 h-4 rounded border flex items-center justify-center text-[10px] font-medium ${
                      isIncluded ? "bg-primary border-primary text-primary-foreground" :
                      isExcluded ? "bg-destructive border-destructive text-destructive-foreground" :
                      "border-border"
                    }`}>
                      {isIncluded && "✓"}
                      {isExcluded && "✕"}
                    </span>
                    <span className="flex-1 truncate">{opt.label}</span>
                    <span className="text-[10px] text-muted-foreground/60">({opt.count})</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* City */}
      {cityOptions.length > 0 && (
        <div>
          <button
            onClick={() => setShowCity(!showCity)}
            className="flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground w-full"
          >
            <ChevronDownIcon className={`h-3.5 w-3.5 transition-transform ${showCity ? "rotate-180" : ""}`} />
            <span>City</span>
            {(selectedCities.length > 0 || excludedCities.length > 0) && (
              <span className="ml-auto text-primary text-[10px]">
                {selectedCities.length > 0 && `+${selectedCities.length}`}
                {excludedCities.length > 0 && ` -${excludedCities.length}`}
              </span>
            )}
          </button>
          {showCity && (
            <div className="mt-1.5 space-y-0.5 max-h-32 overflow-y-auto">
              {cityOptions.map((opt) => {
                const isIncluded = selectedCities.includes(opt.value);
                const isExcluded = excludedCities.includes(opt.value);
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => handleCityToggle(opt.value)}
                    className={`w-full flex items-center gap-2 px-1.5 py-1 rounded text-left text-xs transition-colors ${
                      isIncluded ? "text-primary" : isExcluded ? "text-destructive" : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <span className={`shrink-0 w-4 h-4 rounded border flex items-center justify-center text-[10px] font-medium ${
                      isIncluded ? "bg-primary border-primary text-primary-foreground" :
                      isExcluded ? "bg-destructive border-destructive text-destructive-foreground" :
                      "border-border"
                    }`}>
                      {isIncluded && "✓"}
                      {isExcluded && "✕"}
                    </span>
                    <span className="flex-1 truncate">{opt.label}</span>
                    <span className="text-[10px] text-muted-foreground/60">({opt.count})</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Advanced Section */}
      <div className="pt-2 border-t border-border">
        <button
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <ChevronDownIcon className={`h-3.5 w-3.5 transition-transform ${showAdvanced ? "rotate-180" : ""}`} />
          Advanced
        </button>

        {showAdvanced && (
          <div className="mt-3 space-y-3">
            {/* Applicants */}
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">Max Applicants</label>
              <div className="flex flex-wrap gap-1">
                {APPLICANT_PRESETS.map((preset) => (
                  <button
                    key={preset.label}
                    onClick={() => handleApplicantsMaxChange(preset.value)}
                    className={`px-2 py-0.5 text-xs rounded-full border transition-colors ${
                      filters.applicants_max === preset.value
                        ? "bg-primary/10 border-primary text-primary"
                        : "border-border text-muted-foreground hover:bg-accent"
                    }`}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
              <label className="flex items-center gap-1.5 mt-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={filters.applicants_include_na !== false}
                  onChange={(e) => handleApplicantsIncludeNaChange(e.target.checked)}
                  className="h-3 w-3 text-primary border-input rounded"
                />
                <span className="text-xs text-muted-foreground">Include unknown</span>
              </label>
            </div>

            {/* Salary */}
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">Salary Range</label>
              <div className="flex gap-2">
                <input
                  type="number"
                  value={filters.salary_min || ""}
                  onChange={handleSalaryMinChange}
                  placeholder="Min"
                  className="w-1/2 px-2 py-1 text-sm bg-card dark:bg-zinc-800 border border-border dark:border-zinc-600 rounded-md"
                />
                <input
                  type="number"
                  value={filters.salary_max || ""}
                  onChange={handleSalaryMaxChange}
                  placeholder="Max"
                  className="w-1/2 px-2 py-1 text-sm bg-card dark:bg-zinc-800 border border-border dark:border-zinc-600 rounded-md"
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Clear Filters */}
      {hasActiveFilters && (
        <button
          onClick={clearFilters}
          className="w-full py-1.5 text-xs text-primary hover:text-primary/80 font-medium"
        >
          Clear all filters
        </button>
      )}
    </div>
  );
}

// Toggle chip component
function ToggleChip({
  active,
  onClick,
  children,
  count,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  count?: number;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-2 py-0.5 text-xs rounded-full border transition-colors ${
        active
          ? "bg-primary/10 border-primary text-primary"
          : "border-border text-muted-foreground hover:bg-accent hover:text-foreground"
      }`}
    >
      {children}
      {count !== undefined && count > 0 && (
        <span className="ml-1 opacity-60">({count})</span>
      )}
    </button>
  );
}
