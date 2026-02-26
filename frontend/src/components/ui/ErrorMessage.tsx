interface ErrorMessageProps {
  message?: string;
  onRetry?: () => void;
}

export function ErrorMessage({
  message = "Something went wrong. Please try again.",
  onRetry,
}: ErrorMessageProps) {
  return (
    <div className="card bg-destructive/10 border-destructive/20">
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0">
          <svg
            className="h-5 w-5 text-destructive"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z"
            />
          </svg>
        </div>
        <div className="flex-1">
          <p className="text-destructive">{message}</p>
          {onRetry && (
            <button
              onClick={onRetry}
              className="mt-2 text-sm font-medium text-destructive hover:text-destructive/80"
            >
              Try again
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
