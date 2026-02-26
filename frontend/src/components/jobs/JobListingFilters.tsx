"use client";

import { useState, useEffect } from "react";
import type { JobListingFilters as Filters, JobListingSortBy, FilterOption } from "@/lib/api/types";
import { ChevronDownIcon } from "@/components/icons";
import { jobListingApi } from "@/lib/api/client";

interface JobListingFiltersProps {
  filters: Filters;
  onFiltersChange: (filters: Filters) => void;
}

// Fallback options used while loading
const FALLBACK_SENIORITY_OPTIONS = [
  { value: "entry level", label: "Entry Level", count: 0 },
  { value: "mid-senior level", label: "Mid-Senior Level", count: 0 },
  { value: "associate", label: "Associate", count: 0 },
];

const APPLICANT_PRESETS = [
  { value: 25, label: "< 25" },
  { value: 50, label: "< 50" },
  { value: 100, label: "< 100" },
  { value: undefined, label: "Any" },
];

const SORT_OPTIONS: { value: JobListingSortBy; label: string }[] = [
  { value: "date_posted", label: "Date Posted" },
  { value: "salary_max", label: "Salary (High to Low)" },
  { value: "salary_min", label: "Salary (Low to High)" },
  { value: "company_name", label: "Company Name" },
  { value: "job_title", label: "Job Title" },
];

export function JobListingFilters({ filters, onFiltersChange }: JobListingFiltersProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [filterOptions, setFilterOptions] = useState<{
    countries: FilterOption[];
    regions: FilterOption[];
    seniorities: FilterOption[];
    cities: FilterOption[];
  } | null>(null);
  const [isLoadingOptions, setIsLoadingOptions] = useState(true);

  // Load filter options on mount
  useEffect(() => {
    const loadFilterOptions = async () => {
      try {
        const options = await jobListingApi.getFilterOptions();
        setFilterOptions(options);
      } catch (error) {
        console.error("Failed to load filter options:", error);
      } finally {
        setIsLoadingOptions(false);
      }
    };
    loadFilterOptions();
  }, []);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onFiltersChange({ ...filters, search: e.target.value || undefined, offset: 0 });
  };

  const handleCompanyNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onFiltersChange({ ...filters, company_name: e.target.value || undefined, offset: 0 });
  };

  const handleCityChange = (value: string) => {
    const currentCities = filters.city?.split(",") || [];
    let newCities: string[];

    if (currentCities.includes(value)) {
      newCities = currentCities.filter((c) => c !== value);
    } else {
      newCities = [...currentCities, value];
    }

    onFiltersChange({
      ...filters,
      city: newCities.length > 0 ? newCities.join(",") : undefined,
      offset: 0,
    });
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

  const handleCountryChange = (value: string) => {
    const currentCountries = filters.country?.split(",") || [];
    let newCountries: string[];

    if (currentCountries.includes(value)) {
      newCountries = currentCountries.filter((c) => c !== value);
    } else {
      newCountries = [...currentCountries, value];
    }

    onFiltersChange({
      ...filters,
      country: newCountries.length > 0 ? newCountries.join(",") : undefined,
      offset: 0,
    });
  };

  const handleRegionChange = (value: string) => {
    const currentRegions = filters.region?.split(",") || [];
    let newRegions: string[];

    if (currentRegions.includes(value)) {
      newRegions = currentRegions.filter((r) => r !== value);
    } else {
      newRegions = [...currentRegions, value];
    }

    onFiltersChange({
      ...filters,
      region: newRegions.length > 0 ? newRegions.join(",") : undefined,
      offset: 0,
    });
  };

  const handleRemoteOnlyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onFiltersChange({
      ...filters,
      is_remote: e.target.checked ? true : undefined,
      offset: 0,
    });
  };

  const handleEasyApplyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onFiltersChange({
      ...filters,
      easy_apply: e.target.checked ? true : undefined,
      offset: 0,
    });
  };

  const handleApplicantsMaxChange = (value: number | undefined) => {
    onFiltersChange({
      ...filters,
      applicants_max: value,
      offset: 0,
    });
  };

  const handleApplicantsIncludeNaChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onFiltersChange({
      ...filters,
      applicants_include_na: e.target.checked,
      offset: 0,
    });
  };

  const handleSalaryMinChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value ? parseInt(e.target.value, 10) : undefined;
    onFiltersChange({ ...filters, salary_min: value, offset: 0 });
  };

  const handleSalaryMaxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value ? parseInt(e.target.value, 10) : undefined;
    onFiltersChange({ ...filters, salary_max: value, offset: 0 });
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

  const handleSavedOnlyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onFiltersChange({
      ...filters,
      is_saved: e.target.checked ? true : undefined,
      offset: 0,
    });
  };

  const handleHideHiddenChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onFiltersChange({
      ...filters,
      is_hidden: e.target.checked ? false : undefined,
      offset: 0,
    });
  };

  const clearFilters = () => {
    onFiltersChange({
      limit: filters.limit,
      offset: 0,
      sort_by: "date_posted",
      sort_order: "desc",
      applicants_include_na: true,
    });
  };

  const selectedSeniorities = filters.seniority?.split(",") || [];
  const selectedCountries = filters.country?.split(",") || [];
  const selectedRegions = filters.region?.split(",") || [];
  const selectedCities = filters.city?.split(",") || [];

  // Use dynamic options or fallback
  const seniorityOptions = filterOptions?.seniorities || FALLBACK_SENIORITY_OPTIONS;
  const countryOptions = filterOptions?.countries || [];
  const regionOptions = filterOptions?.regions || [];
  const cityOptions = filterOptions?.cities || [];

  const hasActiveFilters =
    filters.search ||
    filters.company_name ||
    filters.city ||
    filters.country ||
    filters.region ||
    filters.seniority ||
    filters.is_remote ||
    filters.easy_apply ||
    filters.applicants_max !== undefined ||
    filters.salary_min ||
    filters.salary_max ||
    filters.is_saved;

  return (
    <div className="bg-card rounded-lg border border-border p-4">
      {/* Search */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-foreground/80 mb-1">
          Search
        </label>
        <input
          type="text"
          value={filters.search || ""}
          onChange={handleSearchChange}
          placeholder="Search jobs..."
          className="w-full px-3 py-2 bg-background text-foreground border border-input rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
        />
      </div>

      {/* Collapsible section */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center justify-between w-full text-sm font-medium text-foreground/80 mb-3"
      >
        <span>Filters</span>
        <ChevronDownIcon className={`h-5 w-5 transition-transform ${isExpanded ? "rotate-180" : ""}`} />
      </button>

      {isExpanded && (
        <div className="space-y-4">
          {/* Company Name */}
          <div>
            <label className="block text-sm font-medium text-foreground/80 mb-1">
              Company
            </label>
            <input
              type="text"
              value={filters.company_name || ""}
              onChange={handleCompanyNameChange}
              placeholder="e.g., Google, Microsoft"
              className="w-full px-3 py-2 bg-background text-foreground border border-input rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            />
          </div>

          {/* City */}
          {cityOptions.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-foreground/80 mb-2">
                City
              </label>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {cityOptions.map((option) => (
                  <label
                    key={option.value}
                    className="flex items-center gap-2 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={selectedCities.includes(option.value)}
                      onChange={() => handleCityChange(option.value)}
                      className="h-4 w-4 text-primary border-input rounded focus:ring-primary-500"
                    />
                    <span className="text-sm text-muted-foreground">
                      {option.label}
                      <span className="text-muted-foreground/60 ml-1">({option.count})</span>
                    </span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Country */}
          {countryOptions.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-foreground/80 mb-2">
                Country
              </label>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {countryOptions.map((option) => (
                  <label
                    key={option.value}
                    className="flex items-center gap-2 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={selectedCountries.includes(option.value)}
                      onChange={() => handleCountryChange(option.value)}
                      className="h-4 w-4 text-primary border-input rounded focus:ring-primary-500"
                    />
                    <span className="text-sm text-muted-foreground">
                      {option.label}
                      <span className="text-muted-foreground/60 ml-1">({option.count})</span>
                    </span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Region */}
          {regionOptions.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-foreground/80 mb-2">
                Region
              </label>
              <div className="space-y-2">
                {regionOptions.map((option) => (
                  <label
                    key={option.value}
                    className="flex items-center gap-2 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={selectedRegions.includes(option.value)}
                      onChange={() => handleRegionChange(option.value)}
                      className="h-4 w-4 text-primary border-input rounded focus:ring-primary-500"
                    />
                    <span className="text-sm text-muted-foreground">
                      {option.label}
                      <span className="text-muted-foreground/60 ml-1">({option.count})</span>
                    </span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Seniority */}
          {seniorityOptions.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-foreground/80 mb-2">
                Seniority
              </label>
              <div className="space-y-2">
                {seniorityOptions.map((option) => (
                  <label
                    key={option.value}
                    className="flex items-center gap-2 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={selectedSeniorities.includes(option.value)}
                      onChange={() => handleSeniorityChange(option.value)}
                      className="h-4 w-4 text-primary border-input rounded focus:ring-primary-500"
                    />
                    <span className="text-sm text-muted-foreground">
                      {option.label}
                      {option.count > 0 && (
                        <span className="text-muted-foreground/60 ml-1">({option.count})</span>
                      )}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Remote & Easy Apply Toggles */}
          <div className="space-y-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={filters.is_remote === true}
                onChange={handleRemoteOnlyChange}
                className="h-4 w-4 text-primary border-input rounded focus:ring-primary-500"
              />
              <span className="text-sm text-muted-foreground">Remote only</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={filters.easy_apply === true}
                onChange={handleEasyApplyChange}
                className="h-4 w-4 text-primary border-input rounded focus:ring-primary-500"
              />
              <span className="text-sm text-muted-foreground">Easy Apply only</span>
            </label>
          </div>

          {/* Applicant Count */}
          <div>
            <label className="block text-sm font-medium text-foreground/80 mb-2">
              Max Applicants
            </label>
            <div className="flex flex-wrap gap-2 mb-2">
              {APPLICANT_PRESETS.map((preset) => (
                <button
                  key={preset.label}
                  onClick={() => handleApplicantsMaxChange(preset.value)}
                  className={`px-3 py-1 text-sm rounded-full border transition-colors ${
                    filters.applicants_max === preset.value
                      ? "bg-primary/10 border-primary-500 text-primary"
                      : "border-input text-muted-foreground hover:bg-accent"
                  }`}
                >
                  {preset.label}
                </button>
              ))}
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={filters.applicants_include_na !== false}
                onChange={handleApplicantsIncludeNaChange}
                className="h-4 w-4 text-primary border-input rounded focus:ring-primary-500"
              />
              <span className="text-sm text-muted-foreground">Include jobs with unknown applicant count</span>
            </label>
          </div>

          {/* Salary Range */}
          <div>
            <label className="block text-sm font-medium text-foreground/80 mb-2">
              Salary Range
            </label>
            <div className="flex gap-2">
              <input
                type="number"
                value={filters.salary_min || ""}
                onChange={handleSalaryMinChange}
                placeholder="Min"
                className="w-1/2 px-3 py-2 bg-background text-foreground border border-input rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
              <input
                type="number"
                value={filters.salary_max || ""}
                onChange={handleSalaryMaxChange}
                placeholder="Max"
                className="w-1/2 px-3 py-2 bg-background text-foreground border border-input rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
            </div>
          </div>

          {/* Quick Filters */}
          <div className="space-y-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={filters.is_saved === true}
                onChange={handleSavedOnlyChange}
                className="h-4 w-4 text-primary border-input rounded focus:ring-primary-500"
              />
              <span className="text-sm text-muted-foreground">Saved jobs only</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={filters.is_hidden === false}
                onChange={handleHideHiddenChange}
                className="h-4 w-4 text-primary border-input rounded focus:ring-primary-500"
              />
              <span className="text-sm text-muted-foreground">Hide hidden jobs</span>
            </label>
          </div>

          {/* Sort */}
          <div>
            <label className="block text-sm font-medium text-foreground/80 mb-1">
              Sort by
            </label>
            <div className="flex gap-2">
              <select
                value={filters.sort_by || "date_posted"}
                onChange={handleSortChange}
                className="flex-1 px-3 py-2 bg-background text-foreground border border-input rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              >
                {SORT_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <button
                onClick={handleSortOrderChange}
                className="px-3 py-2 border border-input rounded-lg hover:bg-accent"
                title={filters.sort_order === "asc" ? "Ascending" : "Descending"}
              >
                {filters.sort_order === "asc" ? "↑" : "↓"}
              </button>
            </div>
          </div>

          {/* Clear Filters */}
          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="w-full py-2 text-sm text-primary hover:text-primary font-medium"
            >
              Clear all filters
            </button>
          )}
        </div>
      )}
    </div>
  );
}
