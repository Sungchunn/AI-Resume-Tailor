"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000, // 1 minute
            refetchOnWindowFocus: false,
            // Don't retry on 4xx client errors (they won't resolve by retrying)
            retry: (failureCount, error) => {
              // Check if it's a client error (4xx) - don't retry
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
              // For other errors, retry up to 3 times
              return failureCount < 3;
            },
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}
