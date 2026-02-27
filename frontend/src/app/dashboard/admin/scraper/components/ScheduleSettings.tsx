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

  const [scheduleType, setScheduleType] = useState<ScheduleType>("daily");
  const [hour12, setHour12] = useState(2);
  const [period, setPeriod] = useState<"AM" | "PM">("AM");
  const [scheduleMinute, setScheduleMinute] = useState(0);
  const [scheduleDayOfWeek, setScheduleDayOfWeek] = useState<number | null>(null);

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
      </div>
    </div>
  );
}
