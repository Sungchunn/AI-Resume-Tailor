"use client";

import { useState } from "react";
import {
  useScraperPresets,
  useToggleScraperPreset,
  useDeleteScraperPreset,
} from "@/lib/api/hooks";
import type { ScraperPresetResponse } from "@/lib/api/types";
import PresetForm from "./PresetForm";

export default function PresetList() {
  const { data, isLoading } = useScraperPresets();
  const { mutate: togglePreset, isPending: isToggling } = useToggleScraperPreset();
  const { mutate: deletePreset, isPending: isDeleting } = useDeleteScraperPreset();

  const [showForm, setShowForm] = useState(false);
  const [editingPreset, setEditingPreset] = useState<ScraperPresetResponse | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const handleDelete = (preset: ScraperPresetResponse) => {
    if (window.confirm(`Are you sure you want to delete "${preset.name}"?`)) {
      setDeletingId(preset.id);
      deletePreset(preset.id, {
        onSettled: () => setDeletingId(null),
      });
    }
  };

  const handleEdit = (preset: ScraperPresetResponse) => {
    setEditingPreset(preset);
    setShowForm(true);
  };

  const handleCloseForm = () => {
    setShowForm(false);
    setEditingPreset(null);
  };

  const truncateUrl = (url: string, maxLength = 60) => {
    if (url.length <= maxLength) return url;
    return url.slice(0, maxLength) + "...";
  };

  if (isLoading) {
    return (
      <div className="card animate-pulse">
        <div className="h-6 w-48 bg-muted rounded mb-4" />
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 bg-muted rounded" />
          ))}
        </div>
      </div>
    );
  }

  const presets = data?.presets ?? [];

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Saved Presets</h2>
          <p className="text-sm text-muted-foreground">
            {presets.length === 0
              ? "No presets yet. Add one to get started."
              : `${presets.length} preset${presets.length === 1 ? "" : "s"} configured`}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowForm(true)}
          className="inline-flex items-center px-3 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-primary hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-ring"
        >
          <svg
            className="-ml-0.5 mr-1.5 h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          Add Preset
        </button>
      </div>

      {presets.length === 0 ? (
        <div className="text-center py-8">
          <svg
            className="mx-auto h-12 w-12 text-muted-foreground/60"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m3.75 9v6m3-3H9m1.5-12H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"
            />
          </svg>
          <h3 className="mt-2 text-sm font-medium text-foreground">No presets</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Create a preset to save a LinkedIn search URL for scheduled scraping.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {presets.map((preset) => (
            <div
              key={preset.id}
              className={`flex items-center justify-between p-4 rounded-lg border ${
                preset.is_active
                  ? "border-primary/20 bg-primary/10"
                  : "border-border bg-muted"
              }`}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-medium text-foreground truncate">{preset.name}</h3>
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                      preset.is_active
                        ? "bg-green-500/20 text-green-500"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {preset.is_active ? "Active" : "Paused"}
                  </span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground truncate" title={preset.url}>
                  {truncateUrl(preset.url)}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">Max {preset.count} jobs per run</p>
              </div>

              <div className="flex items-center gap-2 ml-4">
                {/* Toggle Button */}
                <button
                  type="button"
                  onClick={() => togglePreset(preset.id)}
                  disabled={isToggling}
                  className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 ${
                    preset.is_active ? "bg-primary" : "bg-muted"
                  } ${isToggling ? "opacity-50" : ""}`}
                  title={preset.is_active ? "Pause preset" : "Activate preset"}
                >
                  <span
                    className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                      preset.is_active ? "translate-x-4" : "translate-x-0"
                    }`}
                  />
                </button>

                {/* Edit Button */}
                <button
                  type="button"
                  onClick={() => handleEdit(preset)}
                  className="p-1.5 text-muted-foreground/60 hover:text-muted-foreground rounded-md hover:bg-muted"
                  title="Edit preset"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10"
                    />
                  </svg>
                </button>

                {/* Delete Button */}
                <button
                  type="button"
                  onClick={() => handleDelete(preset)}
                  disabled={isDeleting && deletingId === preset.id}
                  className="p-1.5 text-muted-foreground/60 hover:text-destructive rounded-md hover:bg-destructive/10 disabled:opacity-50"
                  title="Delete preset"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0"
                    />
                  </svg>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Form Modal */}
      {showForm && (
        <PresetForm
          preset={editingPreset}
          onClose={handleCloseForm}
        />
      )}
    </div>
  );
}
