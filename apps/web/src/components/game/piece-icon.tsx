import Image from "next/image";
import type { PlayerColor } from "@settersaga/game";
import type { CSSProperties } from "react";

export type PieceAsset = "city" | "road" | "settlement";
export type PieceTheme = PlayerColor;

const PIECE_ASSET_PATHS: Readonly<Record<PieceAsset, string>> = {
  city: "/game-assets/pieces/city-piece.png",
  road: "/game-assets/pieces/road-piece.png",
  settlement: "/game-assets/pieces/settlement-piece.png",
};

export function getPieceAssetPath(asset: PieceAsset): string {
  return PIECE_ASSET_PATHS[asset];
}

export function PieceIcon({
  asset,
  className = "",
  theme,
}: {
  asset: PieceAsset;
  className?: string;
  theme: PieceTheme;
}) {
  const assetPath = getPieceAssetPath(asset);

  return (
    <span
      aria-hidden="true"
      className={`piece-icon piece-icon-${asset} player-${theme} ${className}`.trim()}
    >
      <Image alt="" draggable={false} height={512} src={assetPath} unoptimized width={512} />
      <span
        className="piece-color"
        style={{ "--piece-mask": `url(${assetPath})` } as CSSProperties}
      />
    </span>
  );
}
