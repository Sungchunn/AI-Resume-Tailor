"use client";

import { useState, useEffect } from "react";
import { useScheduleSettings, useUpdateScheduleSettings, useToggleSchedule } from "@/lib/api/hooks";
import type { ScheduleType } from "@/lib/api/types";

const DAYS_OF_WEEK = [
  { value: 0, label: "Monday" },
  { value: 1, label: "Tuesday" },
  { value: 2, label: "Wednesday" },
  { value: 3, label: "Thursday" },
  { value: 4, label: "Friday" },
  { value: 5, label: "Saturday" },
  { value: 6, label: "Sunday" },
];

const COMMON_HOURS = [
  { value: 0, label: "12:00 AM" },
  { value: 2, label: "2:00 AM" },
  { value: 6, label: "6:00 AM" },
  { value: 9, label: "9:00 AM" },
  { value: 12, label: "12:00 PM" },
  { value: 18, label: "6:00 PM" },
];

export default function ScheduleSettings() {
  const { data: settings, isLoading } = useScheduleSettings();
  const { mutate: updateSettings, isPending: isUpdating } = useUpdateScheduleSettings();
  const { mutate: toggleSchedule, isPending: isToggling } = useToggleSchedule();

  const [scheduleType, setScheduleType] = useState<ScheduleType>("daily");
  const [scheduleHour, setScheduleHour] = useState(2);
  const [scheduleDayOfWeek, setScheduleDayOfWeek] = useState<number | null>(null);

  // Sync local state with server data
  useEffect(() => {
    if (settings) {
      setScheduleType(settings.schedule_type);
      setScheduleHour(settings.schedule_hour);
      setScheduleDayOfWeek(settings.schedule_day_of_week);
    }
  }, [settings]);

  const handleSave = () => {
    updateSettings({
      schedule_type: scheduleType,
      schedule_hour: scheduleHour,
      schedule_minute: 0,
      schedule_day_of_week: scheduleType === "weekly" ? scheduleDayOfWeek : null,
    });
  };

  const hasChanges =
    settings &&
    (scheduleType !== settings.schedule_type ||
      scheduleHour !== settings.schedule_hour ||
      scheduleDayOfWeek !== settings.schedule_day_of_week);

  if (isLoading) {
    return (
      <div className="card animate-pulse">
        <div className="h-6 w-48 bg-gray-200 rounded mb-4" />
        <div className="h-4 w-64 bg-gray-200 rounded" />
      </div>
    );
  }

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Schedule Settings</h2>
          <p className="text-sm text-gray-600">
            Configure when to automatically run all active presets
          </p>
        </div>

        {/* Global Toggle */}
        <div className="flex items-center gap-3">
          <span className={`text-sm font-medium ${settings?.is_enabled ? "text-green-600" : "text-gray-500"}`}>
            {settings?.is_enabled ? "Enabled" : "Disabled"}
          </span>
          <button
            type="button"
            onClick={() => toggleSchedule()}
            disabled={isToggling}
            className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 ${
              settings?.is_enabled ? "bg-primary-600" : "bg-gray-200"
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
          <label className="block text-sm font-medium text-gray-700 mb-2">
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
                className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300"
              />
              <span className="ml-2 text-sm text-gray-700">Daily</span>
            </label>
            <label className="inline-flex items-center">
              <input
                type="radio"
                name="scheduleType"
                value="weekly"
                checked={scheduleType === "weekly"}
                onChange={() => setScheduleType("weekly")}
                className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300"
              />
              <span className="ml-2 text-sm text-gray-700">Weekly</span>
            </label>
          </div>
        </div>

        {/* Day of Week (for weekly) */}
        {scheduleType === "weekly" && (
          <div>
            <label htmlFor="dayOfWeek" className="block text-sm font-medium text-gray-700 mb-2">
              Day of Week
            </label>
            <select
              id="dayOfWeek"
              value={scheduleDayOfWeek ?? 0}
              onChange={(e) => setScheduleDayOfWeek(parseInt(e.target.value))}
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
            >
              {DAYS_OF_WEEK.map((day) => (
                <option key={day.value} value={day.value}>
                  {day.label}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Hour */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Time (UTC)
          </label>
          <div className="flex flex-wrap gap-2">
            {COMMON_HOURS.map((hour) => (
              <button
                key={hour.value}
                type="button"
                onClick={() => setScheduleHour(hour.value)}
                className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                  scheduleHour === hour.value
                    ? "bg-primary-600 text-white"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                {hour.label}
              </button>
            ))}
          </div>
        </div>

        {/* Save Button */}
        {hasChanges && (
          <div className="pt-2">
            <button
              type="button"
              onClick={handleSave}
              disabled={isUpdating}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50"
            >
              {isUpdating ? "Saving..." : "Save Changes"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
