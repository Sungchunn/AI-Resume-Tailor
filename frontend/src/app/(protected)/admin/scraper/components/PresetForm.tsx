"use client";

import { useState, useEffect } from "react";
import { useCreateScraperPreset, useUpdateScraperPreset } from "@/lib/api/hooks";
import type { ScraperPresetResponse } from "@/lib/api/types";

const JOB_COUNT_PRESETS = [100, 200, 400, 500];

interface PresetFormProps {
  preset?: ScraperPresetResponse | null;
  onClose: () => void;
}

export default function PresetForm({ preset, onClose }: PresetFormProps) {
  const isEditing = !!preset;

  const [name, setName] = useState(preset?.name ?? "");
  const [url, setUrl] = useState(preset?.url ?? "");
  const [count, setCount] = useState(preset?.count ?? 100);
  const [isActive, setIsActive] = useState(preset?.is_active ?? true);

  const { mutate: createPreset, isPending: isCreating } = useCreateScraperPreset();
  const { mutate: updatePreset, isPending: isUpdating } = useUpdateScraperPreset();

  const isPending = isCreating || isUpdating;

  // Reset form when preset changes
  useEffect(() => {
    if (preset) {
      setName(preset.name);
      setUrl(preset.url);
      setCount(preset.count);
      setIsActive(preset.is_active);
    }
  }, [preset]);

  const isValidUrl = url.toLowerCase().includes("linkedin.com/jobs");
  const isValid = name.trim().length > 0 && isValidUrl;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid) return;

    const data = {
      name: name.trim(),
      url: url.trim(),
      count,
      is_active: isActive,
    };

    if (isEditing && preset) {
      updatePreset(
        { id: preset.id, data },
        {
          onSuccess: () => onClose(),
        }
      );
    } else {
      createPreset(data, {
        onSuccess: () => onClose(),
      });
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
        {/* Backdrop - semi-transparent to show page behind */}
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-sm transition-opacity"
          onClick={onClose}
        />

        {/* Modal */}
        <div className="relative transform overflow-hidden rounded-lg bg-card text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-lg">
          <form onSubmit={handleSubmit}>
            <div className="bg-card px-4 pb-4 pt-5 sm:p-6 sm:pb-4">
              <div className="sm:flex sm:items-start">
                <div className="mt-3 text-center sm:ml-4 sm:mt-0 sm:text-left w-full">
                  <h3 className="text-lg font-semibold leading-6 text-foreground">
                    {isEditing ? "Edit Preset" : "Add Preset"}
                  </h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {isEditing
                      ? "Update this preset's settings."
                      : "Save a LinkedIn job search URL as a preset for scheduled scraping."}
                  </p>

                  <div className="mt-6 space-y-4">
                    {/* Name */}
                    <div>
                      <label htmlFor="name" className="block text-sm font-medium text-foreground/80">
                        Name
                      </label>
                      <input
                        type="text"
                        id="name"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="e.g., Thailand Remote Jobs"
                        className="mt-1 block w-full rounded-md border-input shadow-sm focus:border-ring focus:ring-ring sm:text-sm"
                        required
                      />
                    </div>

                    {/* URL */}
                    <div>
                      <label htmlFor="url" className="block text-sm font-medium text-foreground/80">
                        LinkedIn Job Search URL
                      </label>
                      <input
                        type="url"
                        id="url"
                        value={url}
                        onChange={(e) => setUrl(e.target.value)}
                        placeholder="https://www.linkedin.com/jobs/search/?keywords=..."
                        className="mt-1 block w-full rounded-md border-input shadow-sm focus:border-ring focus:ring-ring sm:text-sm"
                        required
                      />
                      {url && !isValidUrl && (
                        <p className="mt-1 text-sm text-destructive">
                          URL must be a LinkedIn jobs URL
                        </p>
                      )}
                      {url && isValidUrl && (
                        <p className="mt-1 text-sm text-green-500">
                          Valid LinkedIn jobs URL
                        </p>
                      )}
                    </div>

                    {/* Count */}
                    <div>
                      <label className="block text-sm font-medium text-foreground/80">
                        Max Jobs per Run
                      </label>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        {JOB_COUNT_PRESETS.map((presetValue) => (
                          <button
                            key={presetValue}
                            type="button"
                            onClick={() => setCount(presetValue)}
                            className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                              count === presetValue
                                ? "bg-primary text-primary-foreground"
                                : "bg-muted text-foreground/80 hover:bg-muted"
                            }`}
                          >
                            {presetValue}
                          </button>
                        ))}
                        <span className="text-muted-foreground/60 text-sm">or</span>
                        <input
                          type="number"
                          value={count}
                          onChange={(e) => setCount(Math.max(100, parseInt(e.target.value) || 100))}
                          min={100}
                          max={1000}
                          className="w-20 rounded-md border-input shadow-sm focus:border-ring focus:ring-ring sm:text-sm text-center"
                        />
                      </div>
                    </div>

                    {/* Active Toggle */}
                    <div className="flex items-center justify-between">
                      <div>
                        <label htmlFor="isActive" className="text-sm font-medium text-foreground/80">
                          Active
                        </label>
                        <p className="text-xs text-muted-foreground">
                          Include in scheduled runs
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setIsActive(!isActive)}
                        className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 ${
                          isActive ? "bg-primary" : "bg-muted"
                        }`}
                      >
                        <span
                          className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-card shadow ring-0 transition duration-200 ease-in-out ${
                            isActive ? "translate-x-5" : "translate-x-0"
                          }`}
                        />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-muted px-4 py-3 sm:flex sm:flex-row-reverse sm:px-6">
              <button
                type="submit"
                disabled={!isValid || isPending}
                className="inline-flex w-full justify-center rounded-md bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground shadow-sm hover:bg-primary/90 sm:ml-3 sm:w-auto disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isPending
                  ? isEditing
                    ? "Saving..."
                    : "Creating..."
                  : isEditing
                  ? "Save Changes"
                  : "Create Preset"}
              </button>
              <button
                type="button"
                onClick={onClose}
                disabled={isPending}
                className="mt-3 inline-flex w-full justify-center rounded-md bg-card px-3 py-2 text-sm font-semibold text-foreground shadow-sm ring-1 ring-inset ring-border hover:bg-muted sm:mt-0 sm:w-auto disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
