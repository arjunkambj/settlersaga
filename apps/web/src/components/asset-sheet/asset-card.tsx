"use client";

import Image from "next/image";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import magniferIcon from "@iconify-icons/solar/magnifer-zoom-in-bold-duotone";
import musicIcon from "@iconify-icons/solar/music-note-2-bold-duotone";
import sparkleIcon from "@iconify-icons/solar/stars-bold-duotone";
import { Icon } from "@iconify/react";
import { useCallback, useEffect, useState } from "react";

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

function useCopiedFeedback(timeoutMs = 1600) {
  const [copied, setCopied] = useState(false);
  const [key, setKey] = useState(0);

  useEffect(() => {
    if (!copied) return;
    const id = window.setTimeout(() => setCopied(false), timeoutMs);
    return () => window.clearTimeout(id);
  }, [copied, key, timeoutMs]);

  const trigger = useCallback(() => {
    setCopied(true);
    setKey((k) => k + 1);
  }, []);

  return [copied, trigger] as const;
}

async function copyText(value: string) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value);
    return;
  }
  const ta = document.createElement("textarea");
  ta.value = value;
  ta.setAttribute("readonly", "");
  ta.style.position = "fixed";
  ta.style.opacity = "0";
  document.body.appendChild(ta);
  ta.select();
  document.execCommand("copy");
  ta.remove();
}

export function AssetCard({ asset }: { asset: AssetCardItem }) {
  const isGenerated = asset.status === "generated";
  const isAudio = asset.kind === "audio";
  const isBrand = asset.kind === "brand";
  const canPreviewImage = Boolean(asset.path && !isAudio && !isBrand);
  const isTransparent =
    typeof asset.format === "string" && asset.format.toLowerCase().includes("transparent");

  return (
    <div
      className={cn(
        "group/card relative flex flex-col overflow-hidden rounded-2xl border bg-card text-card-foreground shadow-xs transition-all duration-200",
        "hover:shadow-md hover:-translate-y-0.5 hover:border-foreground/15 hover:ring-1 hover:ring-foreground/5",
        "focus-within:shadow-md focus-within:ring-1 focus-within:ring-foreground/5",
        !isGenerated && "border-dashed opacity-85 hover:translate-y-0 hover:shadow-xs",
      )}
      data-status={asset.status}
    >
      {/* Preview */}
      <div
        className={cn(
          "relative isolate flex h-[176px] w-full items-center justify-center overflow-hidden border-b",
          canPreviewImage ? "p-0" : "p-3",
          isBrand
            ? "bg-gradient-to-b from-card to-muted/30"
            : isAudio
              ? "bg-gradient-to-b from-signal-success/[0.07] via-card to-muted/20"
              : "bg-muted/30",
        )}
      >
        {/* checker for transparent art so edges read correctly */}
        {canPreviewImage && isTransparent ? (
          <div
            aria-hidden="true"
            className="absolute inset-0 opacity-[0.55]"
            style={{
              backgroundImage:
                "repeating-conic-gradient(from 0deg at 50% 50%, #e7e5e4 0% 25%, #fafaf9 0% 50%)",
              backgroundSize: "16px 16px",
            }}
          />
        ) : null}
        {canPreviewImage && !isTransparent && asset.fit === "cover" ? (
          <div
            aria-hidden="true"
            className="absolute inset-0 opacity-40"
            style={{
              backgroundImage:
                "radial-gradient(ellipse at 50% 0%, color-mix(in oklch, var(--muted-foreground) 8%, transparent), transparent 60%), linear-gradient(to bottom, transparent, color-mix(in oklch, var(--muted) 55%, transparent))",
            }}
          />
        ) : null}

        {isBrand ? (
          <div className="relative flex w-full flex-col items-center justify-center gap-3 p-2 text-center">
            {asset.swatches ? (
              <div className="flex w-full max-w-[220px] flex-col gap-1.5">
                <div className="flex h-11 w-full overflow-hidden rounded-xl border bg-background shadow-xs">
                  {asset.swatches.map((swatch) => (
                    <Swatch key={swatch} value={swatch} />
                  ))}
                </div>
                <span className="text-[10px] font-medium tracking-wide text-muted-foreground">
                  Click a swatch to copy hex
                </span>
              </div>
            ) : null}
            {asset.previewText ? (
              <span className="max-w-[18ch] text-balance text-base font-extrabold tracking-tight text-foreground">
                {asset.previewText}
              </span>
            ) : null}
            {asset.format ? (
              <span className="rounded-full bg-muted px-2.5 py-1 font-mono text-[10px] leading-none text-muted-foreground">
                {asset.format}
              </span>
            ) : null}
          </div>
        ) : canPreviewImage ? (
          <Dialog>
            <DialogTrigger
              aria-label={`Open ${asset.name} preview`}
              className="group/trigger relative flex h-full w-full cursor-zoom-in items-center justify-center overflow-hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card"
            >
              <Image
                alt={`${asset.name} asset preview`}
                className={cn(
                  "relative h-full w-full transition-transform duration-300 will-change-transform group-hover/card:scale-[1.02] group-focus-within/card:scale-[1.02]",
                  asset.fit === "cover" ? "object-cover" : "object-contain",
                )}
                decoding="async"
                draggable={false}
                loading="lazy"
                src={asset.path!}
                unoptimized
                width={512}
                height={512}
              />
              <span className="pointer-events-none absolute bottom-2 right-2 flex h-7 w-7 items-center justify-center rounded-full border bg-chip/90 text-chip-foreground shadow-sm backdrop-blur transition-all duration-200 md:opacity-0 md:group-hover/trigger:opacity-100 md:group-focus-visible/trigger:opacity-100">
                <Icon aria-hidden="true" className="h-4 w-4" icon={magniferIcon} />
              </span>
            </DialogTrigger>

            <DialogContent
              aria-describedby={undefined}
              className="max-w-3xl gap-0 overflow-hidden p-0 sm:max-w-4xl"
            >
              <DialogHeader className="border-b bg-muted/20 px-5 py-4 text-left sm:px-6">
                <DialogTitle className="pr-8 text-base font-bold tracking-tight">
                  {asset.name}
                </DialogTitle>
                {asset.description ? (
                  <DialogDescription className="text-xs leading-relaxed">
                    {asset.description}
                  </DialogDescription>
                ) : null}
                {asset.format ? (
                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    <span className="rounded-full border bg-chip px-2.5 py-1 font-mono text-[10px] leading-none text-chip-foreground/80">
                      {asset.format}
                    </span>
                  </div>
                ) : null}
              </DialogHeader>

              <div
                className={cn(
                  "relative flex max-h-[66vh] min-h-[280px] items-center justify-center p-4 sm:p-6",
                  isTransparent
                    ? "bg-[repeating-conic-gradient(from_0deg_at_50%_50%,#e7e5e4_0%_25%,#fafaf9_0%_50%)] bg-[length:20px_20px]"
                    : "bg-gradient-to-b from-muted/40 to-background",
                )}
              >
                <Image
                  alt={asset.name}
                  className={cn(
                    "max-h-[60vh] max-w-full rounded-xl object-contain",
                    asset.fit === "cover"
                      ? "w-full shadow-sm ring-1 ring-foreground/10"
                      : "drop-shadow-[0_12px_32px_rgba(0,0,0,0.18)]",
                  )}
                  src={asset.path!}
                  unoptimized
                  width={768}
                  height={512}
                />
              </div>
            </DialogContent>
          </Dialog>
        ) : isAudio ? (
          <div className="relative flex w-full flex-col items-center justify-center gap-3 py-1">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-signal-success/10 text-signal-success ring-1 ring-signal-success/20">
              <Icon aria-hidden="true" icon={musicIcon} width={22} />
            </span>
            {asset.path ? (
              <AudioPlayButton name={asset.name} src={asset.path} />
            ) : (
              <span className="rounded-full bg-signal-warning/10 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-signal-warning ring-1 ring-signal-warning/20">
                Pending
              </span>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center gap-2 py-2 text-center">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-signal-warning/10 text-signal-warning ring-1 ring-signal-warning/20">
              <Icon aria-hidden="true" icon={sparkleIcon} width={22} />
            </span>
            <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              {isGenerated ? "Audio asset" : "Production pending"}
            </span>
          </div>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-2 p-3.5">
        <h3 className="line-clamp-1 text-sm font-bold leading-snug tracking-tight text-foreground">
          {asset.name}
        </h3>
        {asset.description ? (
          <p className="line-clamp-3 min-h-[36px] text-xs leading-relaxed text-muted-foreground">
            {asset.description}
          </p>
        ) : (
          <span className="min-h-[36px]" aria-hidden="true" />
        )}

        <div className="mt-auto flex flex-col gap-2.5 pt-2.5">
          <div className="flex flex-wrap items-center gap-1.5">
            {asset.format ? (
              <span className="inline-flex max-w-full items-center rounded-full border bg-muted/60 px-2 py-1 font-mono text-[10px] leading-none text-muted-foreground">
                <span className="truncate">{asset.format}</span>
              </span>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

function Swatch({ value }: { value: string }) {
  const [copied, trigger] = useCopiedFeedback();
  return (
    <button
      aria-label={`Copy ${value}`}
      className="group/swatch relative flex-1 outline-none focus-visible:z-10 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
      onClick={async () => {
        await copyText(value);
        trigger();
      }}
      style={{ background: value }}
      type="button"
    >
      <span
        className={cn(
          "pointer-events-none absolute inset-x-1 bottom-1 flex justify-center opacity-0 transition-opacity group-hover/swatch:opacity-100 group-focus-visible/swatch:opacity-100",
          copied && "opacity-100",
        )}
      >
        <span
          className={cn(
            "rounded-full px-1.5 py-0.5 font-mono text-[9px] font-bold leading-none shadow-sm",
            copied
              ? "bg-signal-success text-white"
              : "bg-chip/95 text-chip-foreground ring-1 ring-border",
          )}
        >
          {copied ? "Copied" : value}
        </span>
      </span>
    </button>
  );
}
