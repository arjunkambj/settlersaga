import type { ReactNode } from "react";

import { AppProviders } from "@/components/app/app-providers";

export default function PlayLayout({ children }: { children: ReactNode }) {
  return <AppProviders>{children}</AppProviders>;
}
