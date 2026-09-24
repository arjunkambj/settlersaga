import { cn } from "@/lib/utils";

interface LiveMessageProps {
  className?: string;
  message: string;
}

/**
 * Inline error text in a polite live region. It stays mounted while empty, because screen readers
 * skip regions that are inserted already holding their message; while empty it is visually hidden
 * and out of the layout flow, so it adds no gap to a flex or grid parent.
 */
export function LiveMessage({ className, message }: LiveMessageProps) {
  return (
    <p
      aria-live="polite"
      className={cn(
        "rounded-xl bg-destructive/25 px-3 py-1.5 text-center text-sm font-semibold text-balance text-destructive-foreground empty:sr-only",
        className,
      )}
    >
      {message}
    </p>
  );
}
