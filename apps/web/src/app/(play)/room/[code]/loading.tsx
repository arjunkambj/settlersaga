import { FullPageStatus } from "@/components/ui/full-page-status";

// Only the room has a loading screen. One above the public pages (home, how to play) would put
// this screen first in their HTML and tuck the real words into a hidden block for a script to
// swap in, which is what a search engine or link preview would read.
export default function Loading() {
  return <FullPageStatus label="Loading…" />;
}
