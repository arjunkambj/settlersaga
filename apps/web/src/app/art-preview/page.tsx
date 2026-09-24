import type { Metadata } from "next";

import { AtlasCompare } from "./atlas-compare";

export const metadata: Metadata = {
  title: "Terrain art preview",
  description: "Compare generated terrain art on the SetterSaga game board.",
};

export default function ArtPreviewPage() {
  return (
    <main className="mx-auto flex w-full max-w-[1600px] flex-col gap-6 px-4 py-8 sm:px-6">
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold">Terrain art on the board</h1>
        <p className="max-w-3xl text-sm text-muted-foreground">
          Each option uses the same 19-tile board, terrain positions, number tokens, and ocean
          background. Pick two versions to compare how the art actually reads in play.
        </p>
      </header>
      <AtlasCompare />
    </main>
  );
}
