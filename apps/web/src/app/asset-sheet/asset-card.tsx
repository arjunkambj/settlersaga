"use client";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
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
    <Card className={""} data-status={asset.status}>
      <CardContent className={""}>
        <div className={""} data-fit={asset.fit ?? "contain"}>
          {asset.kind === "brand" ? (
            <div className={""}>
              {asset.swatches ? (
                <div aria-hidden="true" className={""}>
                  {asset.swatches.map((swatch) => (
                    <span className={""} key={swatch} style={{ background: swatch }} />
                  ))}
                </div>
              ) : null}
              {asset.previewText ? <span>{asset.previewText}</span> : null}
            </div>
          ) : canPreview ? (
            <Dialog>
              <DialogTrigger
                aria-label={`Open ${asset.name} preview`}
                className={""}
              >
                <img
                  alt={`${asset.name} asset preview`}
                  decoding="async"
                  draggable={false}
                  loading="lazy"
                  src={asset.path}
                />
              </DialogTrigger>
              <DialogContent
                aria-label={`${asset.name} preview`}
                className={""}
              >
                <DialogTitle className="sr-only">{asset.name} preview</DialogTitle>
                <div className={""}>
                  <img alt={asset.name} src={asset.path} />
                </div>
              </DialogContent>
            </Dialog>
          ) : asset.path && asset.kind === "audio" ? (
            <div className={""}>
              <Icon aria-hidden="true" icon={musicIcon} />
              <AudioPlayButton name={asset.name} src={asset.path} />
            </div>
          ) : (
            <div className={""}>
              {asset.kind === "audio" ? (
                <Icon aria-hidden="true" icon={musicIcon} />
              ) : (
                <Icon aria-hidden="true" icon={sparkleIcon} />
              )}
              <span>{isGenerated ? "Audio asset" : "Production pending"}</span>
            </div>
          )}
        </div>

        <div className={""}>
          <Badge variant={isGenerated ? "default" : "secondary"}>
            {isGenerated ? "Generated" : "Pending production"}
          </Badge>
          <h3>{asset.name}</h3>
          {asset.description ? <p>{asset.description}</p> : null}
          {asset.format ? <small>{asset.format}</small> : null}
        </div>
      </CardContent>
    </Card>
  );
}
