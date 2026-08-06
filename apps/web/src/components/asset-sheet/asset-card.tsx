"use client";

import { Dialog, DialogContent, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import magniferIcon from "@iconify-icons/solar/magnifer-zoom-in-bold-duotone";
import musicIcon from "@iconify-icons/solar/music-note-2-bold-duotone";
import sparkleIcon from "@iconify-icons/solar/stars-bold-duotone";
import { Icon } from "@iconify/react";

import { AudioPlayButton } from "./audio-play-button";

export type AssetKind = "audio" | "brand" | "image";

export interface AssetCardItem {
  description?: string;
  fit?: "contain" | "cover";
  format?: string;
  kind?: AssetKind;
  name: string;
  path?: string;
  previewText?: string;
  status: "generated" | "needed";
  swatches?: readonly string[];
}

export function AssetCard({ asset }: { asset: AssetCardItem }) {
  const isGenerated = asset.status === "generated";
  const canPreview = Boolean(asset.path && asset.kind !== "audio");

  return (
    <div
      className={cn(
        "group relative flex flex-col justify-between overflow-hidden rounded-xl border border-border bg-card transition-all duration-200 hover:border-foreground/25",
        !isGenerated && "border-dashed opacity-80",
      )}
      data-status={asset.status}
    >
      <div
        className="relative flex h-44 w-full items-center justify-center border-b border-border bg-gradient-to-b from-muted/50 to-muted/20 p-3 overflow-hidden"
        data-fit={asset.fit ?? "contain"}
      >
        {asset.kind === "brand" ? (
          <div className="flex flex-col items-center justify-center gap-3 w-full text-center p-2">
            {asset.swatches ? (
              <div
                aria-hidden="true"
                className="flex h-12 w-full max-w-[200px] overflow-hidden rounded-lg border border-border"
              >
                {asset.swatches.map((swatch) => (
                  <span className="flex-1 h-full" key={swatch} style={{ background: swatch }} />
                ))}
              </div>
            ) : null}
            {asset.previewText ? (
              <span className="font-bold text-base tracking-tight text-foreground">
                {asset.previewText}
              </span>
            ) : null}
          </div>
        ) : canPreview ? (
          <Dialog>
            <DialogTrigger
              aria-label={`Open ${asset.name} preview`}
              className="relative cursor-zoom-in w-full h-full flex items-center justify-center"
            >
              <img
                alt={`${asset.name} asset preview`}
                className={cn(
                  "transition-transform duration-300 group-hover:scale-105",
                  asset.fit === "cover"
                    ? "h-full w-full object-cover"
                    : "max-h-36 w-auto max-w-[88%] object-contain drop-shadow-sm",
                )}
                decoding="async"
                draggable={false}
                loading="lazy"
                src={asset.path}
              />
              <span className="absolute right-2.5 top-2.5 flex h-7 w-7 items-center justify-center rounded-full bg-background/80 text-foreground opacity-0 backdrop-blur-xs transition-opacity duration-200 group-hover:opacity-100 border border-border/50">
                <Icon aria-hidden="true" className="h-4 w-4" icon={magniferIcon} />
              </span>
            </DialogTrigger>
            <DialogContent
              aria-label={`${asset.name} preview`}
              className="max-w-4xl p-6 overflow-hidden"
            >
              <DialogTitle className="sr-only">{asset.name} preview</DialogTitle>
              <div className="flex max-h-[80vh] items-center justify-center p-2">
                <img
                  alt={asset.name}
                  className="max-h-full max-w-full object-contain rounded-lg"
                  src={asset.path}
                />
              </div>
            </DialogContent>
          </Dialog>
        ) : asset.path && asset.kind === "audio" ? (
          <div className="flex flex-col items-center justify-center gap-3 py-2 text-emerald-500">
            <Icon aria-hidden="true" className="h-10 w-10 opacity-90" icon={musicIcon} />
            <AudioPlayButton name={asset.name} src={asset.path} />
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center gap-2 py-2 text-muted-foreground text-center">
            {asset.kind === "audio" ? (
              <Icon aria-hidden="true" className="h-9 w-9 text-amber-500/80" icon={musicIcon} />
            ) : (
              <Icon aria-hidden="true" className="h-9 w-9 text-amber-500/80" icon={sparkleIcon} />
            )}
            <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              {isGenerated ? "Audio asset" : "Production pending"}
            </span>
          </div>
        )}
      </div>

      <div className="flex flex-col flex-1 p-3.5 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <span
            className={cn(
              "inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-semibold tracking-wide uppercase border",
              isGenerated
                ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                : "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
            )}
          >
            {isGenerated ? "Generated" : "Pending"}
          </span>
        </div>
        <h3 className="font-bold text-sm leading-snug text-foreground tracking-tight">
          {asset.name}
        </h3>
        {asset.description ? (
          <p className="text-xs text-muted-foreground leading-relaxed flex-1">
            {asset.description}
          </p>
        ) : null}
        {asset.format ? (
          <div className="pt-1.5 border-t border-border/50 text-[10px] font-mono text-muted-foreground/70">
            {asset.format}
          </div>
        ) : null}
      </div>
    </div>
  );
}
