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
import magniferIcon from "@iconify-icons/solar/magnifer-zoom-in-bold";
import musicIcon from "@iconify-icons/solar/music-note-2-bold";
import { Icon } from "@iconify/react/offline";
import { type MouseEvent, useState } from "react";

import { AudioPlayButton } from "./audio-play-button";

interface ImageAsset {
  description: string;
  fit?: "cover";
  kind?: "image";
  name: string;
  path: string;
  transparent?: boolean;
}

interface AudioAsset {
  description: string;
  format: string;
  kind: "audio";
  name: string;
  path: string;
}

export interface AssetSwatch {
  /** Sets the swatch background from a theme token. */
  className: string;
  label: string;
}

interface BrandAsset {
  description: string;
  format: string;
  kind: "brand";
  name: string;
  previewClassName?: string;
  previewText?: string;
  swatches?: readonly AssetSwatch[];
}

export type AssetCardItem = AudioAsset | BrandAsset | ImageAsset;

const CHECKERBOARD_CLASS =
  "bg-[repeating-conic-gradient(var(--muted)_0%_25%,var(--card)_0%_50%)] bg-[length:16px_16px]";

export function AssetCard({ asset }: { asset: AssetCardItem }) {
  const [imageSize, setImageSize] = useState<string>();
  const format =
    asset.kind === "audio" || asset.kind === "brand"
      ? asset.format
      : [getFileType(asset.path), imageSize, asset.transparent ? "transparent" : undefined]
          .filter(Boolean)
          .join(" · ");

  return (
    <div className="group/card relative flex flex-col overflow-hidden rounded-2xl bg-card text-card-foreground shadow-xs transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md focus-within:shadow-md focus-within:ring-1 focus-within:ring-foreground/5">
      <div
        className={cn(
          "relative isolate flex h-[176px] w-full items-center justify-center overflow-hidden border-b",
          asset.kind === "brand"
            ? "bg-gradient-to-b from-card to-muted/30 p-3"
            : asset.kind === "audio"
              ? "bg-gradient-to-b from-accent/[0.07] via-card to-muted/20 p-3"
              : "bg-muted/30",
        )}
      >
        {asset.kind === "brand" ? (
          <BrandPreview asset={asset} />
        ) : asset.kind === "audio" ? (
          <div className="relative flex w-full flex-col items-center justify-center gap-3 py-1">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-accent/10 text-accent ring-1 ring-accent/20">
              <Icon aria-hidden="true" icon={musicIcon} width={22} />
            </span>
            <AudioPlayButton name={asset.name} src={asset.path} />
          </div>
        ) : (
          <ImagePreview asset={asset} format={format} onMeasure={setImageSize} />
        )}
      </div>

      <div className="flex flex-1 flex-col gap-2 p-3.5">
        <h3 className="line-clamp-1 text-sm font-bold leading-snug tracking-tight text-foreground">
          {asset.name}
        </h3>
        <p className="line-clamp-3 min-h-[36px] text-xs leading-relaxed text-muted-foreground">
          {asset.description}
        </p>
        <span className="mt-auto inline-flex max-w-full items-center self-start rounded-full border bg-muted/60 px-2 py-1 font-mono text-xs leading-none text-muted-foreground">
          <span className="truncate">{format}</span>
        </span>
      </div>
    </div>
  );
}

function ImagePreview({
  asset,
  format,
  onMeasure,
}: {
  asset: ImageAsset;
  format: string;
  onMeasure: (size: string) => void;
}) {
  return (
    <Dialog>
      <DialogTrigger
        aria-label={`Open ${asset.name} preview`}
        className={cn(
          "group/trigger relative flex h-full w-full cursor-zoom-in items-center justify-center overflow-hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card",
          asset.transparent && CHECKERBOARD_CLASS,
        )}
      >
        {/* The sheet reviews source files, so skip the optimizer and measure the original pixels. */}
        <Image
          alt={`${asset.name} asset preview`}
          className={cn(
            "relative h-full w-full transition-transform duration-300 will-change-transform group-hover/card:scale-[1.02] group-focus-within/card:scale-[1.02]",
            asset.fit === "cover" ? "object-cover" : "object-contain",
          )}
          draggable={false}
          height={512}
          onLoad={(event) => {
            const image = event.currentTarget;
            onMeasure(`${image.naturalWidth}×${image.naturalHeight}`);
          }}
          src={asset.path}
          unoptimized
          width={512}
        />
        <span className="pointer-events-none absolute bottom-2 right-2 flex h-7 w-7 items-center justify-center rounded-full border bg-card/90 text-card-foreground shadow-sm backdrop-blur transition-all duration-200 md:opacity-0 md:group-hover/trigger:opacity-100 md:group-focus-visible/trigger:opacity-100">
          <Icon aria-hidden="true" className="h-4 w-4" icon={magniferIcon} />
        </span>
      </DialogTrigger>

      <DialogContent
        aria-describedby={undefined}
        className="max-w-3xl gap-0 overflow-hidden p-0 sm:max-w-4xl"
      >
        <DialogHeader className="p-6">
          <DialogTitle>{asset.name}</DialogTitle>
          <DialogDescription>{asset.description}</DialogDescription>
          <span className="rounded-full bg-well px-3 py-1 font-mono text-xs leading-none text-muted-foreground">
            {format}
          </span>
        </DialogHeader>

        <div
          className={cn(
            "relative flex max-h-[66vh] min-h-[280px] items-center justify-center p-4 sm:p-6",
            asset.transparent ? CHECKERBOARD_CLASS : "bg-gradient-to-b from-muted/40 to-background",
          )}
        >
          <Image
            alt={asset.name}
            className={cn(
              "max-h-[60vh] max-w-full rounded-xl object-contain",
              asset.fit === "cover"
                ? "w-full shadow-sm ring-1 ring-foreground/10"
                : "drop-shadow-xl",
            )}
            height={512}
            src={asset.path}
            unoptimized
            width={768}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}

function BrandPreview({ asset }: { asset: BrandAsset }) {
  return (
    <div className="relative flex w-full flex-col items-center justify-center gap-3 p-2 text-center">
      {asset.swatches ? (
        <div className="flex w-full max-w-[220px] flex-col gap-1.5">
          <div className="flex h-11 w-full rounded-xl border bg-background shadow-xs">
            {asset.swatches.map((swatch) => (
              <Swatch key={swatch.label} swatch={swatch} />
            ))}
          </div>
          <span className="text-xs font-medium text-muted-foreground">
            Click a swatch to copy its color
          </span>
        </div>
      ) : null}
      {asset.previewText ? (
        <span
          className={cn(
            "max-w-[18ch] text-balance text-base font-extrabold tracking-tight text-foreground",
            asset.previewClassName,
          )}
        >
          {asset.previewText}
        </span>
      ) : null}
    </div>
  );
}

function Swatch({ swatch }: { swatch: AssetSwatch }) {
  const [copied, setCopied] = useState(false);

  const copyColor = async (event: MouseEvent<HTMLButtonElement>) => {
    await navigator.clipboard.writeText(getComputedStyle(event.currentTarget).backgroundColor);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  };

  return (
    <button
      aria-label={`Copy the ${swatch.label} color`}
      className={cn(
        "group/swatch relative flex-1 outline-none first:rounded-l-xl last:rounded-r-xl hover:z-10 focus-visible:z-10 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset",
        swatch.className,
      )}
      onClick={copyColor}
      title={swatch.label}
      type="button"
    >
      {/* Floats above the bar: a swatch is narrower than its label. */}
      <span
        className={cn(
          "pointer-events-none absolute bottom-full left-1/2 mb-1.5 -translate-x-1/2 rounded-full px-2 py-1 font-mono text-xs font-bold leading-none whitespace-nowrap opacity-0 shadow-sm transition-opacity group-hover/swatch:opacity-100 group-focus-visible/swatch:opacity-100",
          copied
            ? "bg-accent text-accent-foreground opacity-100"
            : "bg-card text-card-foreground ring-1 ring-border",
        )}
      >
        {copied ? "Copied" : swatch.label}
      </span>
    </button>
  );
}

function getFileType(path: string) {
  return path.split("?")[0]?.split(".").pop()?.toUpperCase();
}
