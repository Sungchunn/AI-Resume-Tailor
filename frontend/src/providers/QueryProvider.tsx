"use client";

import { QueryClient } from "@tanstack/react-query";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { createSyncStoragePersister } from "@tanstack/query-sync-storage-persister";
import { useState } from "react";

const PERSIST_KEY = "rb-jobs-cache-v1";
const PERSIST_MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Read the user id from the JWT in localStorage to use as a cache buster.
 * When the user changes (login as a different account on the same browser),
 * the buster changes and persisted data is dropped — preventing cross-user
 * data leakage in shared-browser scenarios.
 */
function getUserBuster(): string {
  if (typeof window === "undefined") return "anon";
  try {
    const token = window.localStorage.getItem("access_token");
    if (!token) return "anon";
    const payload = token.split(".")[1];
    if (!payload) return "anon";
    const decoded = JSON.parse(
      atob(payload.replace(/-/g, "+").replace(/_/g, "/"))
    );
    return String(decoded.sub ?? "anon");
  } catch {
    return "anon";
  }
}

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // 5 min stale window matches the scraper cadence and gives
            // persisted entries a fresh-enough lifetime on warm reloads.
            staleTime: 5 * 60 * 1000,
            // 24 h GC keeps entries alive long enough for the persister
            // to rehydrate them after a refresh.
            gcTime: 24 * 60 * 60 * 1000,
            refetchOnWindowFocus: false,
            // Don't retry on 4xx client errors (they won't resolve by retrying)
            retry: (failureCount, error) => {
              if (error instanceof Error) {
                const message = error.message.toLowerCase();
                if (
                  message.includes("404") ||
                  message.includes("not found") ||
                  message.includes("401") ||
                  message.includes("403") ||
                  message.includes("400")
                ) {
                  return false;
                }
              }
              return failureCount < 3;
            },
          },
        },
      })
  );

  // createSyncStoragePersister returns a no-op persister when storage is
  // undefined (SSR), so this is safe to call on the server.
  const [persister] = useState(() =>
    createSyncStoragePersister({
      storage: typeof window !== "undefined" ? window.localStorage : undefined,
      key: PERSIST_KEY,
    })
  );

  const [buster] = useState(() => getUserBuster());

  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{
        persister,
        buster,
        maxAge: PERSIST_MAX_AGE_MS,
        dehydrateOptions: {
          // Persist only successful job-listings queries. Auth, mutations,
          // and other domain queries stay in-memory only.
          shouldDehydrateQuery: (query) =>
            query.queryKey[0] === "jobListings" &&
            query.state.status === "success",
        },
      }}
    >
      {children}
    </PersistQueryClientProvider>
  );
}
