"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useUpdateProfile } from "@/lib/api";

// Common timezones grouped by region
const TIMEZONE_GROUPS = [
  {
    label: "Americas",
    timezones: [
      { value: "America/New_York", label: "Eastern Time (New York)" },
      { value: "America/Chicago", label: "Central Time (Chicago)" },
      { value: "America/Denver", label: "Mountain Time (Denver)" },
      { value: "America/Los_Angeles", label: "Pacific Time (Los Angeles)" },
      { value: "America/Anchorage", label: "Alaska Time" },
      { value: "America/Toronto", label: "Toronto" },
      { value: "America/Vancouver", label: "Vancouver" },
      { value: "America/Mexico_City", label: "Mexico City" },
      { value: "America/Sao_Paulo", label: "Sao Paulo" },
      { value: "America/Buenos_Aires", label: "Buenos Aires" },
    ],
  },
  {
    label: "Europe",
    timezones: [
      { value: "Europe/London", label: "London (GMT/BST)" },
      { value: "Europe/Paris", label: "Paris (CET)" },
      { value: "Europe/Berlin", label: "Berlin (CET)" },
      { value: "Europe/Amsterdam", label: "Amsterdam (CET)" },
      { value: "Europe/Rome", label: "Rome (CET)" },
      { value: "Europe/Madrid", label: "Madrid (CET)" },
      { value: "Europe/Stockholm", label: "Stockholm (CET)" },
      { value: "Europe/Moscow", label: "Moscow" },
    ],
  },
  {
    label: "Asia",
    timezones: [
      { value: "Asia/Dubai", label: "Dubai (GST)" },
      { value: "Asia/Kolkata", label: "India (IST)" },
      { value: "Asia/Bangkok", label: "Bangkok (ICT)" },
      { value: "Asia/Ho_Chi_Minh", label: "Ho Chi Minh (ICT)" },
      { value: "Asia/Singapore", label: "Singapore (SGT)" },
      { value: "Asia/Hong_Kong", label: "Hong Kong (HKT)" },
      { value: "Asia/Shanghai", label: "Shanghai (CST)" },
      { value: "Asia/Tokyo", label: "Tokyo (JST)" },
      { value: "Asia/Seoul", label: "Seoul (KST)" },
    ],
  },
  {
    label: "Pacific & Australia",
    timezones: [
      { value: "Australia/Perth", label: "Perth (AWST)" },
      { value: "Australia/Sydney", label: "Sydney (AEST)" },
      { value: "Australia/Melbourne", label: "Melbourne (AEST)" },
      { value: "Pacific/Auckland", label: "Auckland (NZST)" },
      { value: "Pacific/Fiji", label: "Fiji" },
      { value: "Pacific/Honolulu", label: "Hawaii" },
    ],
  },
  {
    label: "Other",
    timezones: [
      { value: "UTC", label: "UTC (Coordinated Universal Time)" },
      { value: "Africa/Cairo", label: "Cairo" },
      { value: "Africa/Johannesburg", label: "Johannesburg" },
      { value: "Africa/Lagos", label: "Lagos" },
    ],
  },
];

export default function SettingsPage() {
  const { user, refreshUser } = useAuth();
  const updateProfile = useUpdateProfile();

  const [fullName, setFullName] = useState("");
  const [timezone, setTimezone] = useState("UTC");
  const [hasChanges, setHasChanges] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Sync form state with user data
  useEffect(() => {
    if (user) {
      setFullName(user.full_name || "");
      setTimezone(user.timezone || "UTC");
    }
  }, [user]);

  // Track changes
  useEffect(() => {
    if (user) {
      const nameChanged = fullName !== (user.full_name || "");
      const tzChanged = timezone !== (user.timezone || "UTC");
      setHasChanges(nameChanged || tzChanged);
    }
  }, [fullName, timezone, user]);

  const handleSave = async () => {
    setSaveSuccess(false);
    await updateProfile.mutateAsync({
      full_name: fullName || null,
      timezone: timezone,
    });
    await refreshUser();
    setHasChanges(false);
    setSaveSuccess(true);
    // Clear success message after 3 seconds
    setTimeout(() => setSaveSuccess(false), 3000);
  };

  // Get current time in selected timezone for preview
  const getCurrentTimePreview = () => {
    const now = new Date();
    try {
      return now.toLocaleString("en-US", {
        timeZone: timezone,
        weekday: "short",
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      });
    } catch {
      return "Invalid timezone";
    }
  };

  if (!user) {
    return <SettingsSkeleton />;
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-foreground">Settings</h1>
        <p className="text-muted-foreground mt-1">
          Manage your account preferences
        </p>
      </div>

      <div className="space-y-8">
        {/* Account Section */}
        <section className="card">
          <h2 className="text-lg font-medium text-foreground mb-6">Account</h2>

          <div className="space-y-6">
            {/* Full Name */}
            <div>
              <label
                htmlFor="fullName"
                className="block text-sm font-medium text-foreground/80 mb-2"
              >
                Full Name
              </label>
              <input
                id="fullName"
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Enter your name"
                className="w-full max-w-md rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus:border-ring focus:ring-1 focus:ring-ring"
              />
            </div>

            {/* Email (Read-only) */}
            <div>
              <label className="block text-sm font-medium text-foreground/80 mb-2">
                Email
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="email"
                  value={user.email}
                  disabled
                  className="w-full max-w-md rounded-md border border-input bg-muted px-3 py-2 text-sm text-muted-foreground cursor-not-allowed"
                />
                <span className="text-xs text-muted-foreground">
                  Cannot be changed
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* Preferences Section */}
        <section className="card">
          <h2 className="text-lg font-medium text-foreground mb-6">
            Preferences
          </h2>

          <div className="space-y-6">
            {/* Timezone */}
            <div>
              <label
                htmlFor="timezone"
                className="block text-sm font-medium text-foreground/80 mb-2"
              >
                Timezone
              </label>
              <select
                id="timezone"
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                className="w-full max-w-md rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus:border-ring focus:ring-1 focus:ring-ring"
              >
                {TIMEZONE_GROUPS.map((group) => (
                  <optgroup key={group.label} label={group.label}>
                    {group.timezones.map((tz) => (
                      <option key={tz.value} value={tz.value}>
                        {tz.label}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
              <p className="mt-2 text-sm text-muted-foreground">
                This affects how dates and times are displayed throughout the
                app.
              </p>

              {/* Time Preview */}
              <div className="mt-4 p-3 bg-muted/50 rounded-md max-w-md">
                <p className="text-xs text-muted-foreground mb-1">
                  Current time in selected timezone:
                </p>
                <p className="text-sm font-medium text-foreground">
                  {getCurrentTimePreview()}
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Save Button */}
        <div className="flex items-center gap-4">
          <button
            onClick={handleSave}
            disabled={!hasChanges || updateProfile.isPending}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-primary hover:bg-primary/90 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-ring disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {updateProfile.isPending ? "Saving..." : "Save Changes"}
          </button>
          {saveSuccess && (
            <span className="flex items-center gap-1 text-sm text-green-600 dark:text-green-400">
              <CheckIcon className="h-4 w-4" />
              Settings saved
            </span>
          )}
          {updateProfile.isError && (
            <span className="text-sm text-destructive">
              Failed to save. Please try again.
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function SettingsSkeleton() {
  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-8">
        <div className="h-8 w-32 bg-muted rounded animate-pulse" />
        <div className="h-4 w-48 bg-muted rounded animate-pulse mt-2" />
      </div>
      <div className="card">
        <div className="h-6 w-24 bg-muted rounded animate-pulse mb-6" />
        <div className="space-y-6">
          <div>
            <div className="h-4 w-20 bg-muted rounded animate-pulse mb-2" />
            <div className="h-10 w-full max-w-md bg-muted rounded animate-pulse" />
          </div>
          <div>
            <div className="h-4 w-16 bg-muted rounded animate-pulse mb-2" />
            <div className="h-10 w-full max-w-md bg-muted rounded animate-pulse" />
          </div>
        </div>
      </div>
    </div>
  );
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={2}
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M4.5 12.75l6 6 9-13.5"
      />
    </svg>
  );
}
