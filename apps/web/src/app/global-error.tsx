"use client";

import { ErrorScreen } from "@/components/app/error-screen";
import { fontVariables } from "@/components/app/fonts";

// This boundary replaces the root layout, so it brings its own document, fonts and styles.
import "./styles.css";

export default function GlobalError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry(): void;
}) {
  return (
    <html className={fontVariables} lang="en">
      <body>
        <ErrorScreen error={error} retry={retry} />
      </body>
    </html>
  );
}
