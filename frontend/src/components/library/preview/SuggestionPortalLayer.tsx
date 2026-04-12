import { forwardRef } from "react";

export const SuggestionPortalLayer = forwardRef<HTMLDivElement>(
  function SuggestionPortalLayer(_, ref) {
    return (
      <div
        ref={ref}
        data-print-hidden="true"
        data-no-export="true"
        style={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          zIndex: 50,
        }}
      />
    );
  }
);
