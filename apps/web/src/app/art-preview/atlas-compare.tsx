"use client";

import Image from "next/image";
import { useState } from "react";

import { TerrainBoardPreview } from "@/components/asset-sheet/terrain-board-preview";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { TERRAIN_CONCEPTS, type TerrainConcept } from "./terrain-concepts";

const phases = [...new Set(TERRAIN_CONCEPTS.map((concept) => concept.phase))];

function getConcept(id: string): TerrainConcept {
  return TERRAIN_CONCEPTS.find((concept) => concept.id === id) ?? TERRAIN_CONCEPTS[0]!;
}

interface BoardPaneProps {
  concept: TerrainConcept;
  idPrefix: string;
  onChange: (id: string) => void;
  title: string;
}

function BoardPane({ concept, idPrefix, onChange, title }: BoardPaneProps) {
  return (
    <section className="flex min-w-0 flex-col gap-4 rounded-3xl border border-border bg-card p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold">{title}</h2>
          <p className="text-xs text-muted-foreground">{concept.phase}</p>
        </div>
        <Select
          value={concept.id}
          onValueChange={(value) => {
            if (value) onChange(value);
          }}
        >
          <SelectTrigger
            aria-label={`Choose ${title.toLowerCase()} artwork`}
            className="w-full max-w-64"
          >
            <SelectValue>{concept.label}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {phases.map((phase) => (
              <SelectGroup key={phase}>
                <SelectLabel>{phase}</SelectLabel>
                {TERRAIN_CONCEPTS.filter((option) => option.phase === phase).map((option) => (
                  <SelectItem key={option.id} value={option.id}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectGroup>
            ))}
          </SelectContent>
        </Select>
      </div>
      <TerrainBoardPreview
        atlasPath={concept.path}
        className="mx-auto max-w-2xl"
        idPrefix={idPrefix}
        showHeading={false}
      />
      {concept.note ? <p className="text-xs text-muted-foreground">{concept.note}</p> : null}
    </section>
  );
}

export function AtlasCompare() {
  const [primaryId, setPrimaryId] = useState("bold-cartoon");
  const [comparisonId, setComparisonId] = useState("clean-icons");
  const primary = getConcept(primaryId);
  const comparison = getConcept(comparisonId);

  return (
    <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_18rem]">
      <div className="grid min-w-0 gap-5 lg:grid-cols-2 xl:grid-cols-2">
        <BoardPane
          concept={primary}
          idPrefix="atlas-primary"
          onChange={setPrimaryId}
          title="Main board"
        />
        <BoardPane
          concept={comparison}
          idPrefix="atlas-comparison"
          onChange={setComparisonId}
          title="Compare board"
        />
      </div>

      <aside className="rounded-3xl border border-border bg-card p-4">
        <div className="mb-4">
          <h2 className="font-bold">All artwork</h2>
          <p className="text-xs text-muted-foreground">
            {TERRAIN_CONCEPTS.length - 1} generated versions plus the current game atlas.
          </p>
        </div>
        <div className="grid max-h-[75vh] grid-cols-2 gap-2 overflow-y-auto pr-1 sm:grid-cols-3 xl:grid-cols-1">
          {[...TERRAIN_CONCEPTS].reverse().map((concept) => (
            <Button
              aria-pressed={primaryId === concept.id}
              className="h-auto min-w-0 justify-start gap-2 p-2 text-left"
              key={concept.id}
              onClick={() => setPrimaryId(concept.id)}
              variant={primaryId === concept.id ? "secondary" : "outline"}
            >
              <Image
                alt=""
                className="aspect-[3/2] w-16 shrink-0 rounded-lg object-cover"
                height={64}
                src={concept.path}
                width={96}
              />
              <span className="min-w-0 truncate text-xs">{concept.label}</span>
            </Button>
          ))}
        </div>
      </aside>
    </div>
  );
}
