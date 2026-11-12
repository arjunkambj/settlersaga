import type { Metadata } from "next";

import { HomePageContent } from "@/components/home/home-page-content";

export const metadata: Metadata = {
  alternates: { canonical: "/" },
};

export default function HomePage() {
  return <HomePageContent />;
}
