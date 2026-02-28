"use client";

import { useState, useEffect } from "react";
import { useScheduleSettings, useUpdateScheduleSettings, useToggleSchedule, useTriggerScraper } from "@/lib/api/hooks";
import type { ScheduleType, ScraperBatchResult } from "@/lib/api/types";

const DAYS_OF_WEEK = [
  { value: 0, label: "Monday" },
  { value: 1, label: "Tuesday" },
  { value: 2, label: "Wednesday" },
  { value: 3, label: "Thursday" },
  { value: 4, label: "Friday" },
  { value: 5, label: "Saturday" },
  { value: 6, label: "Sunday" },
];

const HOURS_12 = [
  { value: 12, label: "12" },
  { value: 1, label: "1" },
  { value: 2, label: "2" },
  { value: 3, label: "3" },
  { value: 4, label: "4" },
  { value: 5, label: "5" },
  { value: 6, label: "6" },
  { value: 7, label: "7" },
  { value: 8, label: "8" },
  { value: 9, label: "9" },
  { value: 10, label: "10" },
  { value: 11, label: "11" },
];

// Convert 24-hour to 12-hour format
const to12Hour = (hour24: number): { hour: number; period: "AM" | "PM" } => {
  if (hour24 === 0) return { hour: 12, period: "AM" };
  if (hour24 === 12) return { hour: 12, period: "PM" };
  if (hour24 > 12) return { hour: hour24 - 12, period: "PM" };
  return { hour: hour24, period: "AM" };
};

// Convert 12-hour to 24-hour format
const to24Hour = (hour12: number, period: "AM" | "PM"): number => {
  if (hour12 === 12) return period === "AM" ? 0 : 12;
  return period === "AM" ? hour12 : hour12 + 12;
};

const MINUTES = [
  { value: 0, label: ":00" },
  { value: 15, label: ":15" },
  { value: 30, label: ":30" },
  { value: 45, label: ":45" },
];

export default function ScheduleSettings() {
  const { data: settings, isLoading } = useScheduleSettings();
  const { mutate: updateSettings, isPending: isUpdating } = useUpdateScheduleSettings();
  const { mutate: toggleSchedule, isPending: isToggling } = useToggleSchedule();
  const { mutate: triggerScraper, isPending: isTriggering } = useTriggerScraper();

  const [scheduleType, setScheduleType] = useState<ScheduleType>("daily");
  const [hour12, setHour12] = useState(2);
  const [period, setPeriod] = useState<"AM" | "PM">("AM");
  const [scheduleMinute, setScheduleMinute] = useState(0);
  const [scheduleDayOfWeek, setScheduleDayOfWeek] = useState<number | null>(null);
  const [showRunNowModal, setShowRunNowModal] = useState(false);
  const [runNowResult, setRunNowResult] = useState<ScraperBatchResult | null>(null);
  const [runNowError, setRunNowError] = useState<string | null>(null);

  // Sync local state with server data
  useEffect(() => {
    if (settings) {
      setScheduleType(settings.schedule_type);
      const { hour, period: p } = to12Hour(settings.schedule_hour);
      setHour12(hour);
      setPeriod(p);
      setScheduleMinute(settings.schedule_minute);
      setScheduleDayOfWeek(settings.schedule_day_of_week);
    }
  }, [settings]);

  const scheduleHour24 = to24Hour(hour12, period);

  const handleSave = () => {
    updateSettings({
      schedule_type: scheduleType,
      schedule_hour: scheduleHour24,
      schedule_minute: scheduleMinute,
      schedule_day_of_week: scheduleType === "weekly" ? scheduleDayOfWeek : null,
    });
  };

  const hasChanges =
    settings &&
    (scheduleType !== settings.schedule_type ||
      scheduleHour24 !== settings.schedule_hour ||
      scheduleMinute !== settings.schedule_minute ||
      scheduleDayOfWeek !== settings.schedule_day_of_week);

  const handleRunNow = () => {
    setRunNowResult(null);
    setRunNowError(null);
    triggerScraper(undefined, {
      onSuccess: (data) => {
        setRunNowResult(data);
      },
      onError: (error) => {
        setRunNowError(error.message);
      },
    });
  };

  if (isLoading) {
    return (
      <div className="card animate-pulse">
        <div className="h-6 w-48 bg-muted rounded mb-4" />
        <div className="h-4 w-64 bg-muted rounded" />
      </div>
    );
  }

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Schedule Settings</h2>
          <p className="text-sm text-muted-foreground">
            Configure when to automatically run all active presets
          </p>
        </div>

        {/* Global Toggle */}
        <div className="flex items-center gap-3">
          <span className={`text-sm font-medium ${settings?.is_enabled ? "text-green-500" : "text-muted-foreground"}`}>
            {settings?.is_enabled ? "Enabled" : "Disabled"}
          </span>
          <button
            type="button"
            onClick={() => toggleSchedule()}
            disabled={isToggling}
            className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 ${
              settings?.is_enabled ? "bg-primary" : "bg-muted"
            } ${isToggling ? "opacity-50" : ""}`}
          >
            <span className="sr-only">Toggle schedule</span>
            <span
              className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                settings?.is_enabled ? "translate-x-5" : "translate-x-0"
              }`}
            />
          </button>
        </div>
      </div>

      {/* Schedule Configuration */}
      <div className="space-y-4">
        {/* Schedule Type */}
        <div>
          <label className="block text-sm font-medium text-foreground/80 mb-2">
            Frequency
          </label>
          <div className="flex gap-4">
            <label className="inline-flex items-center">
              <input
                type="radio"
                name="scheduleType"
                value="daily"
                checked={scheduleType === "daily"}
                onChange={() => setScheduleType("daily")}
                className="h-4 w-4 text-primary focus:ring-ring border-input"
              />
              <span className="ml-2 text-sm text-foreground/80">Daily</span>
            </label>
            <label className="inline-flex items-center">
              <input
                type="radio"
                name="scheduleType"
                value="weekly"
                checked={scheduleType === "weekly"}
                onChange={() => setScheduleType("weekly")}
                className="h-4 w-4 text-primary focus:ring-ring border-input"
              />
              <span className="ml-2 text-sm text-foreground/80">Weekly</span>
            </label>
          </div>
        </div>

        {/* Day of Week (for weekly) */}
        {scheduleType === "weekly" && (
          <div>
            <label htmlFor="dayOfWeek" className="block text-sm font-medium text-foreground/80 mb-2">
              Day of Week
            </label>
            <select
              id="dayOfWeek"
              value={scheduleDayOfWeek ?? 0}
              onChange={(e) => setScheduleDayOfWeek(parseInt(e.target.value))}
              className="block w-full rounded-md border-input shadow-sm focus:border-ring focus:ring-ring sm:text-sm"
            >
              {DAYS_OF_WEEK.map((day) => (
                <option key={day.value} value={day.value}>
                  {day.label}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Time Selection */}
        <div>
          <label className="block text-sm font-medium text-foreground/80 mb-2">
            Time (Bangkok)
          </label>
          <div className="flex items-center gap-2">
            <select
              value={hour12}
              onChange={(e) => setHour12(parseInt(e.target.value))}
              className="block w-20 rounded-md border-input bg-background px-3 py-2 text-sm shadow-sm focus:border-ring focus:ring-ring"
            >
              {HOURS_12.map((hour) => (
                <option key={hour.value} value={hour.value}>
                  {hour.label}
                </option>
              ))}
            </select>
            <select
              value={scheduleMinute}
              onChange={(e) => setScheduleMinute(parseInt(e.target.value))}
              className="block w-20 rounded-md border-input bg-background px-3 py-2 text-sm shadow-sm focus:border-ring focus:ring-ring"
            >
              {MINUTES.map((minute) => (
                <option key={minute.value} value={minute.value}>
                  {minute.label}
                </option>
              ))}
            </select>
            <select
              value={period}
              onChange={(e) => setPeriod(e.target.value as "AM" | "PM")}
              className="block w-20 rounded-md border-input bg-background px-3 py-2 text-sm shadow-sm focus:border-ring focus:ring-ring"
            >
              <option value="AM">AM</option>
              <option value="PM">PM</option>
            </select>
          </div>
        </div>

        {/* Save Button */}
        {hasChanges && (
          <div className="pt-2">
            <button
              type="button"
              onClick={handleSave}
              disabled={isUpdating}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-primary hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-ring disabled:opacity-50"
            >
              {isUpdating ? "Saving..." : "Save Changes"}
            </button>
          </div>
        )}

        {/* Run Now Button - for testing */}
        <div className="pt-4 border-t border-border mt-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-foreground/80">Manual Trigger</p>
              <p className="text-xs text-muted-foreground">
                Run all active presets immediately (for testing)
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowRunNowModal(true)}
              disabled={isTriggering}
              className="inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-md border border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-amber-500 disabled:opacity-50 transition-colors"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.348a1.125 1.125 0 010 1.971l-11.54 6.347a1.125 1.125 0 01-1.667-.985V5.653z" />
              </svg>
              Run Now
            </button>
          </div>
        </div>
      </div>

      {/* Run Now Confirmation Modal */}
      {showRunNowModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4">
            {/* Backdrop */}
            <div
              className="fixed inset-0 bg-black/50 transition-opacity"
              onClick={() => !isTriggering && setShowRunNowModal(false)}
            />

            {/* Modal */}
            <div className="relative w-full max-w-md transform rounded-lg bg-background p-6 shadow-xl transition-all">
              {/* Warning Icon */}
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-amber-100">
                <svg
                  className="h-6 w-6 text-amber-600"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={1.5}
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
                  />
                </svg>
              </div>

              <div className="mt-4 text-center">
                <h3 className="text-lg font-semibold text-foreground">
                  Testing Mode Only
                </h3>
                <div className="mt-2 text-sm text-muted-foreground space-y-2">
                  <p>
                    This feature is for <span className="font-medium text-foreground">testing purposes only</span>.
                  </p>
                  <p>
                    The scraper is designed to run automatically on schedule to avoid rate limits and manage API costs effectively.
                  </p>
                  <p className="text-amber-600 font-medium">
                    Running manually may incur additional APIFY costs.
                  </p>
                </div>
              </div>

              {/* Result or Error Display */}
              {runNowResult && (
                <div className="mt-4 p-3 rounded-lg bg-green-50 border border-green-200">
                  <div className="flex items-center gap-2 text-green-700">
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span className="font-medium">Scraping Complete</span>
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <span className="text-muted-foreground">Jobs Found:</span>{" "}
                      <span className="font-medium">{runNowResult.total_jobs_found}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Created:</span>{" "}
                      <span className="font-medium text-green-600">{runNowResult.total_jobs_created}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Updated:</span>{" "}
                      <span className="font-medium text-blue-600">{runNowResult.total_jobs_updated}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Errors:</span>{" "}
                      <span className={`font-medium ${runNowResult.total_errors > 0 ? "text-red-600" : ""}`}>
                        {runNowResult.total_errors}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {runNowError && (
                <div className="mt-4 p-3 rounded-lg bg-red-50 border border-red-200">
                  <div className="flex items-center gap-2 text-red-700">
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 9.75l4.5 4.5m0-4.5l-4.5 4.5M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span className="font-medium">Failed</span>
                  </div>
                  <p className="mt-1 text-sm text-red-600">{runNowError}</p>
                </div>
              )}

              {/* Actions */}
              <div className="mt-6 flex gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowRunNowModal(false);
                    setRunNowResult(null);
                    setRunNowError(null);
                  }}
                  disabled={isTriggering}
                  className="flex-1 rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground hover:bg-muted focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:opacity-50"
                >
                  {runNowResult || runNowError ? "Close" : "Cancel"}
                </button>
                {!runNowResult && !runNowError && (
                  <button
                    type="button"
                    onClick={handleRunNow}
                    disabled={isTriggering}
                    className="flex-1 inline-flex items-center justify-center gap-2 rounded-md bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 disabled:opacity-50"
                  >
                    {isTriggering ? (
                      <>
                        <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                        Running...
                      </>
                    ) : (
                      "I Understand, Run Now"
                    )}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
