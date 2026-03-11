"use client";

import {
  createContext,
  useContext,
  useMemo,
  type ReactNode,
} from "react";
import { useAuth } from "./AuthContext";

interface TimezoneContextType {
  /** User's IANA timezone string (e.g., "America/New_York", "Asia/Bangkok") */
  timezone: string;
  /**
   * Format a date/timestamp in the user's timezone.
   * @param date - Date object or ISO timestamp string
   * @param options - Intl.DateTimeFormat options
   */
  formatDate: (
    date: Date | string,
    options?: Intl.DateTimeFormatOptions
  ) => string;
  /**
   * Format time only in the user's timezone.
   * @param date - Date object or ISO timestamp string
   * @param options - Intl.DateTimeFormat options for time
   */
  formatTime: (
    date: Date | string,
    options?: Intl.DateTimeFormatOptions
  ) => string;
  /**
   * Format date and time in the user's timezone.
   * @param date - Date object or ISO timestamp string
   */
  formatDateTime: (date: Date | string) => { date: string; time: string };
}

const TimezoneContext = createContext<TimezoneContextType | undefined>(undefined);

/**
 * Parse timestamp ensuring UTC interpretation.
 * Backend stores UTC but may omit 'Z' suffix.
 */
function parseTimestamp(timestamp: string): Date {
  return new Date(timestamp.endsWith("Z") ? timestamp : timestamp + "Z");
}

export function TimezoneProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();

  // Default to UTC if no user or timezone set
  const timezone = user?.timezone || "UTC";

  const contextValue = useMemo<TimezoneContextType>(() => {
    const formatDate = (
      date: Date | string,
      options: Intl.DateTimeFormatOptions = {
        month: "short",
        day: "numeric",
        year: "numeric",
      }
    ): string => {
      const dateObj = typeof date === "string" ? parseTimestamp(date) : date;
      return dateObj.toLocaleDateString("en-US", {
        ...options,
        timeZone: timezone,
      });
    };

    const formatTime = (
      date: Date | string,
      options: Intl.DateTimeFormatOptions = {
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      }
    ): string => {
      const dateObj = typeof date === "string" ? parseTimestamp(date) : date;
      return dateObj.toLocaleTimeString("en-US", {
        ...options,
        timeZone: timezone,
      });
    };

    const formatDateTime = (
      date: Date | string
    ): { date: string; time: string } => {
      return {
        date: formatDate(date),
        time: formatTime(date),
      };
    };

    return {
      timezone,
      formatDate,
      formatTime,
      formatDateTime,
    };
  }, [timezone]);

  return (
    <TimezoneContext.Provider value={contextValue}>
      {children}
    </TimezoneContext.Provider>
  );
}

export function useTimezone() {
  const context = useContext(TimezoneContext);
  if (context === undefined) {
    throw new Error("useTimezone must be used within a TimezoneProvider");
  }
  return context;
}
