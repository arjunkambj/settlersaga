import arrowLeftIcon from "@iconify-icons/solar/arrow-left-line-duotone";
import checkIcon from "@iconify-icons/solar/check-circle-bold-duotone";
import clockIcon from "@iconify-icons/solar/clock-circle-bold-duotone";
import imageIcon from "@iconify-icons/solar/gallery-bold-duotone";
import { Icon } from "@iconify/react";
import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";

import { getPieceAssetPath } from "@/components/game/piece-icon";
import { LiquidGlass } from "@/components/ui/liquid-glass";
import {
  ACTION_CARD_ASSET_PATHS,
  DEVELOPMENT_CARD_ASSETS,
  DEVELOPMENT_CARD_BACK_ASSET_PATH,
  RESOURCE_CARD_ASSET_PATHS,
  UNKNOWN_RESOURCE_CARD_ASSET_PATH,
} from "@/constants/game/card-assets";
import { AWARD_ASSET_PATHS } from "@/constants/game/award-assets";
import { END_TURN_ICON_ASSET_PATH, WAIT_ICON_ASSET_PATH } from "@/constants/game/ui-assets";
import {
  OCEAN_BOARD_ASSET_PATH,
  PORT_BOAT_ASSET_PATH,
  PORT_DOCK_ASSET_PATH,
  TERRAIN_ATLAS_ASSET_PATH,
} from "@/constants/game/board-assets";
import { SOUND_EFFECT_PATHS, type SoundEffect } from "@/lib/game/audio-cues";

import { AssetCard, type AssetCardItem } from "./asset-card";
import styles from "./asset-sheet.module.css";
import { TerrainBoardPreview } from "./terrain-board-preview";
import { ThemeToggle } from "./theme-toggle";

export const metadata: Metadata = {
  description: "A category-by-category inventory of ColonistSaga's generated and planned assets.",
  title: "Asset Sheet · ColonistSaga",
};

interface AssetItem extends AssetCardItem {
  description: string;
  format: string;
}

interface AssetCategory {
  assets?: readonly AssetItem[];
  name: string;
  subcategories?: readonly AssetSubcategory[];
}

interface AssetSubcategory {
  assets: readonly AssetItem[];
  name: string;
}

const MUSIC_ASSETS = [
  {
    description: "A welcoming magical-island theme used on the signed-in home screen.",
    format: "MP3 · 44.1 kHz · 192 kbps",
    kind: "audio",
    name: "Home music",
    path: "/music/main-lobby-music.mp3",
    status: "generated",
  },
] satisfies readonly AssetItem[];

const SOUND_EFFECT_DEFINITIONS = [
  ["Action feedback", "Generic game action confirmation.", "action"],
  ["Magic dice", "Cushioned arcane roll.", "dice"],
  ["Next turn", "Notification when another player's turn begins.", "nextTurn"],
  ["Your turn", "Notification when your turn begins or has been idle.", "turn"],
  ["Resource change", "Resource gain or loss cue.", "resource"],
  ["Road placed", "Short wooden road placement cue.", "road"],
  ["Settlement placed", "Warm settlement placement cue.", "settlement"],
  ["City placed", "Weightier city upgrade cue.", "city"],
  ["Robber alert", "Robber sequence warning.", "robber"],
  ["Trade resolved", "Soft resource exchange.", "trade"],
  ["Victory", "Match-winning celebration.", "victory"],
] satisfies readonly (readonly [name: string, description: string, sound: SoundEffect])[];

const SOUND_EFFECT_ASSETS = SOUND_EFFECT_DEFINITIONS.map(([name, description, sound]) => ({
  name,
  description,
  format: "MP3 · 44.1 kHz · 192 kbps",
  kind: "audio" as const,
  path: SOUND_EFFECT_PATHS[sound],
  status: "generated" as const,
}));

const selectAssets = (assets: readonly AssetItem[], names: readonly string[]) =>
  assets.filter((asset) => names.includes(asset.name));

const SOUND_EFFECT_SUBCATEGORIES = [
  {
    name: "General",
    assets: selectAssets(SOUND_EFFECT_ASSETS, ["Action feedback"]),
  },
  {
    name: "Turn flow",
    assets: selectAssets(SOUND_EFFECT_ASSETS, [
      "Magic dice",
      "Next turn",
      "Your turn",
      "Resource change",
    ]),
  },
  {
    name: "Building",
    assets: selectAssets(SOUND_EFFECT_ASSETS, ["Road placed", "Settlement placed", "City placed"]),
  },
  {
    name: "High-priority events",
    assets: selectAssets(SOUND_EFFECT_ASSETS, ["Robber alert", "Trade resolved", "Victory"]),
  },
] satisfies readonly AssetSubcategory[];

const ASSET_CATEGORIES = [
  {
    name: "Brand & environments",
    assets: [
      {
        name: "Island world (supercell)",
        description: "Tabletop island backdrop used by the login, home, and end-of-game views.",
        fit: "cover",
        format: "PNG · 1672×941",
        path: "/shared-assets/coastal-island-kingdom-supercell.png",
        status: "generated",
      },
    ],
  },
  {
    name: "Home menu",
    assets: [
      {
        name: "Quick match",
        description: "Glossy rolling dice on a floating board island.",
        format: "PNG · 1080×1080",
        path: "/home-assets/menu/quick-match-v2.png",
        status: "generated",
      },
      {
        name: "Host island",
        description: "Crooked storybook island home with golden roof.",
        format: "PNG · 1080×1080",
        path: "/home-assets/menu/host-island-v2.png",
        status: "generated",
      },
      {
        name: "Join crew",
        description: "Treasure map with brass compass for joining a room.",
        format: "PNG · 1080×1080",
        path: "/home-assets/menu/join-crew-v2.png",
        status: "generated",
      },
    ],
  },
  {
    name: "Terrain tiles",
    assets: [
      {
        name: "Terrain atlas",
        description:
          "Single-source 3×2 atlas for fields, forest, hills, mountains, pasture, and desert. The board clips each frame into its exact flat-top hex geometry.",
        fit: "cover",
        format: "PNG · 1536×1024 · six 512×512 frames",
        path: TERRAIN_ATLAS_ASSET_PATH,
        status: "generated" as const,
      },
    ],
  },
  {
    name: "Resource cards",
    assets: [
      ["Tree card", "Forest-and-timber card artwork.", RESOURCE_CARD_ASSET_PATHS.tree],
      ["Brick card", "Clay-hills-and-brick card artwork.", RESOURCE_CARD_ASSET_PATHS.brick],
      ["Sheep card", "Pasture-and-sheep card artwork.", RESOURCE_CARD_ASSET_PATHS.sheep],
      ["Wheat card", "Golden-fields-and-wheat card artwork.", RESOURCE_CARD_ASSET_PATHS.wheat],
      ["Stone card", "Mountain-and-stone card artwork.", RESOURCE_CARD_ASSET_PATHS.stone],
      [
        "Unknown resource card",
        "Neutral card face used when only a resource count is public.",
        UNKNOWN_RESOURCE_CARD_ASSET_PATH,
      ],
    ].map(([name, description, path]) => ({
      name,
      description: `${description} Labels and counts remain code-rendered.`,
      format: "PNG · 512×768",
      path,
      status: "generated" as const,
    })),
  },
  {
    name: "Development cards",
    assets: [
      ...DEVELOPMENT_CARD_ASSETS.map((card) => ({
        name: `${card.label} card`,
        description: card.description,
        format: "PNG · 512×768",
        path: card.path,
        status: "generated" as const,
      })),
      {
        name: "Hidden card back",
        description: "Concealed card-back concept retained with the development-card art catalog.",
        format: "PNG · 512×768",
        path: DEVELOPMENT_CARD_BACK_ASSET_PATH,
        status: "generated" as const,
      },
    ],
  },
  {
    name: "Board pieces",
    assets: [
      {
        name: "Road piece",
        description: "Player-tintable road used for board placement.",
        format: "PNG · 512×512",
        path: getPieceAssetPath("road"),
        status: "generated",
      },
      {
        name: "Settlement piece",
        description: "Player-tintable settlement used for board placement.",
        format: "PNG · 512×512",
        path: getPieceAssetPath("settlement"),
        status: "generated",
      },
      {
        name: "City piece",
        description: "Player-tintable city used to upgrade a settlement.",
        format: "PNG · 512×512",
        path: getPieceAssetPath("city"),
        status: "generated",
      },
      {
        name: "Robber piece",
        description: "Neutral robber piece moved between terrain tiles.",
        format: "PNG · 256×256",
        path: "/game-assets/pieces/robber-piece.png",
        status: "generated",
      },
    ],
  },
  {
    name: "Section cards",
    assets: [
      {
        name: "Trade card",
        description: "Purple-and-gold market artwork used by the live trade control.",
        format: "PNG · 512×768",
        path: ACTION_CARD_ASSET_PATHS.trade,
        status: "generated",
      },
      {
        name: "Road card",
        description: "Purple-and-gold road artwork used by the build-road section card.",
        format: "PNG · 512×768",
        path: ACTION_CARD_ASSET_PATHS.road,
        status: "generated",
      },
      {
        name: "House card",
        description: "Purple-and-gold settlement artwork used by the build-house section card.",
        format: "PNG · 512×768",
        path: ACTION_CARD_ASSET_PATHS.settlement,
        status: "generated",
      },
      {
        name: "City card",
        description: "Purple-and-gold city artwork used by the build-city section card.",
        format: "PNG · 512×768",
        path: ACTION_CARD_ASSET_PATHS.city,
        status: "generated",
      },
      {
        name: "Bank icon",
        description: "Bank-building symbol for the resource market and bank controls.",
        format: "PNG · 256×256 · transparent",
        path: "/game-assets/ui/bank.png",
        status: "generated",
      },
      {
        name: "End turn icon",
        description: "Checked turn ledger and dice used by the live end-turn control.",
        format: "PNG · 256×256 · transparent",
        path: END_TURN_ICON_ASSET_PATH,
        status: "generated",
      },
      {
        name: "Wait icon",
        description: "Hourglass artwork used when another player is taking their turn.",
        format: "PNG · 256×256 · transparent",
        path: WAIT_ICON_ASSET_PATH,
        status: "generated",
      },
    ],
  },
  {
    name: "Board utility art",
    assets: [
      {
        name: "Ocean board canvas",
        description: "Quiet turquoise water backdrop beneath the playable board.",
        fit: "cover",
        format: "WebP · 1586×992",
        path: OCEAN_BOARD_ASSET_PATH,
        status: "generated",
      },
      {
        name: "Port merchant",
        description: "Top-down trading boat marking each offshore port.",
        format: "PNG · 655×1182 · transparent",
        path: PORT_BOAT_ASSET_PATH,
        status: "generated",
      },
      {
        name: "Port bridge",
        description: "Single continuous timber bridge connecting each port to the island.",
        format: "PNG · 1642×328 · transparent",
        path: PORT_DOCK_ASSET_PATH,
        status: "generated",
      },
    ],
  },
  {
    name: "Awards & results",
    assets: [
      {
        name: "Longest Road",
        description: "Award illustration for the longest connected route.",
        format: "PNG · 512×512 · transparent",
        path: AWARD_ASSET_PATHS.longestRoad,
        status: "generated",
      },
      {
        name: "Largest Army",
        description: "Award illustration for the strongest knight force.",
        format: "PNG · 512×512 · transparent",
        path: AWARD_ASSET_PATHS.largestArmy,
        status: "generated",
      },
      {
        name: "Victory flourish",
        description: "Celebratory crown, rays, and confetti treatment.",
        format: "PNG · 1536×512 · transparent",
        path: "/game-assets/results/victory-flourish.png",
        status: "generated",
      },
    ],
  },
  {
    name: "Player portraits",
    assets: [
      {
        name: "Red navigator",
        description: "Red-seat harbor navigator and default fallback portrait.",
        format: "PNG · 256×256",
        path: "/game-assets/players/red-navigator.png",
        status: "generated",
      },
      {
        name: "Blue cartographer",
        description: "Blue-seat island cartographer.",
        format: "PNG · 256×256",
        path: "/game-assets/players/blue-cartographer.png",
        status: "generated",
      },
      {
        name: "Orange builder",
        description: "Orange-seat village builder.",
        format: "PNG · 256×256",
        path: "/game-assets/players/orange-builder.png",
        status: "generated",
      },
      {
        name: "Green botanist",
        description: "Green-seat island botanist.",
        format: "PNG · 256×256",
        path: "/game-assets/players/green-botanist.png",
        status: "generated",
      },
      {
        name: "Purple astronomer",
        description: "Purple-seat island astronomer.",
        format: "PNG · 256×256",
        path: "/game-assets/players/purple-astronomer.png",
        status: "generated",
      },
      {
        name: "Teal shipwright",
        description: "Teal-seat harbor shipwright.",
        format: "PNG · 256×256",
        path: "/game-assets/players/teal-shipwright.png",
        status: "generated",
      },
      {
        name: "Yellow merchant",
        description: "Yellow-seat island merchant.",
        format: "PNG · 256×256",
        path: "/game-assets/players/yellow-merchant.png",
        status: "generated",
      },
      {
        name: "Pink pathfinder",
        description: "Pink-seat island pathfinder.",
        format: "PNG · 256×256",
        path: "/game-assets/players/pink-pathfinder.png",
        status: "generated",
      },
    ],
  },
  {
    name: "Music",
    assets: MUSIC_ASSETS,
  },
  {
    name: "Sound effects",
    subcategories: SOUND_EFFECT_SUBCATEGORIES,
  },
  {
    name: "Brand foundations",
    assets: [
      {
        name: "Display typography",
        description:
          "DM Sans gives game titles, the logo lockup, and card headings a clean, friendly voice.",
        format: "DM Sans · 700–900 · sans serif",
        kind: "brand",
        previewText: "Build your island",
        status: "generated",
      },
      {
        name: "Interface typography",
        description:
          "DM Sans keeps rules, room status, resources, and quick in-turn decisions clear and consistent.",
        format: "DM Sans · 400–900 · system sans fallback",
        kind: "brand",
        previewText: "Roll dice · Trade · Build",
        status: "generated",
      },
      {
        name: "Parchment light palette",
        description:
          "Warm parchment, aubergine ink, royal purple, and token gold mirror the development-card materials and action hierarchy.",
        format: "#FFF7ED · #43284B · #824193 · #E5A72E",
        kind: "brand",
        status: "generated",
        swatches: ["#FFF7ED", "#43284B", "#824193", "#E5A72E"],
      },
      {
        name: "Royal purple dark palette",
        description:
          "Deep aubergine, parchment type, token gold, and bright amethyst carry the same card-table atmosphere into dark play.",
        format: "#2A1234 · #FFF7ED · #F2B83F · #C078CB",
        kind: "brand",
        status: "generated",
        swatches: ["#2A1234", "#FFF7ED", "#F2B83F", "#C078CB"],
      },
      {
        name: "Player seat colors",
        description:
          "Eight distinct seat colors remain reserved for ownership across pieces, HUDs, and activity states.",
        format: "#F04F49 · #2F8EE8 · #F18C2C · #2FB86A · #8357D9 · #0F9696 · #BD8100 · #D74786",
        kind: "brand",
        status: "generated",
        swatches: [
          "#F04F49",
          "#2F8EE8",
          "#F18C2C",
          "#2FB86A",
          "#8357D9",
          "#0F9696",
          "#BD8100",
          "#D74786",
        ],
      },
    ],
  },
] satisfies readonly AssetCategory[];

const assetTotals = ASSET_CATEGORIES.reduce(
  (totals, category) =>
    categoryAssets(category).reduce(
      (categoryTotals, asset) => ({
        ...categoryTotals,
        [asset.status]: categoryTotals[asset.status] + 1,
      }),
      totals,
    ),
  { generated: 0, needed: 0 },
);

export default function AssetSheetPage() {
  return (
    <main className={styles.page} id="main-content">
      <div className={styles.shell}>
        <header className={styles.header}>
          <div className={styles.headerActions}>
            <Link className={styles.backLink} href="/">
              <Icon aria-hidden="true" icon={arrowLeftIcon} width={16} />
              Back to game
            </Link>
            <ThemeToggle />
          </div>

          <div className={styles.headerCopy}>
            <p className={styles.eyebrow}>Production inventory</p>
            <h1>Game asset sheet</h1>
          </div>

          <div className={styles.summary} aria-label="Asset totals">
            <SummaryItem
              icon={<Icon aria-hidden="true" icon={checkIcon} />}
              label="Generated"
              tone="ready"
              value={assetTotals.generated}
            />
            <SummaryItem
              icon={<Icon aria-hidden="true" icon={clockIcon} />}
              label="Pending production"
              tone="needed"
              value={assetTotals.needed}
            />
            <SummaryItem
              icon={<Icon aria-hidden="true" icon={imageIcon} />}
              label="Categories"
              tone="neutral"
              value={ASSET_CATEGORIES.length}
            />
          </div>
        </header>

        <div className={styles.categories}>
          {ASSET_CATEGORIES.map((category) => (
            <AssetCategoryRow category={category} key={category.name} />
          ))}
        </div>
      </div>
    </main>
  );
}

function SummaryItem({
  icon,
  label,
  tone,
  value,
}: {
  icon: ReactNode;
  label: string;
  tone: "needed" | "neutral" | "ready";
  value: number;
}) {
  return (
    <LiquidGlass className={styles.summaryItem} data-tone={tone} kind="control" radius="sm">
      <span className={styles.summaryIcon}>{icon}</span>
      <span>
        <strong>{value}</strong>
        <small>{label}</small>
      </span>
    </LiquidGlass>
  );
}

function AssetCategoryRow({ category }: { category: AssetCategory }) {
  const assets = categoryAssets(category);
  const generatedCount = assets.filter((asset) => asset.status === "generated").length;

  return (
    <section
      aria-labelledby={`category-${toId(category.name)}`}
      className={styles.category}
      data-live-preview={category.name === "Terrain tiles" || undefined}
    >
      <div className={styles.categoryHeader}>
        <h2 id={`category-${toId(category.name)}`}>{category.name}</h2>
        <span className={styles.categoryCount}>
          {generatedCount}/{assets.length} ready
        </span>
      </div>

      {category.subcategories ? (
        <div className={styles.assetSubcategories}>
          {category.subcategories.map((subcategory) => (
            <section
              aria-labelledby={`subcategory-${toId(category.name)}-${toId(subcategory.name)}`}
              className={styles.assetSubcategory}
              key={subcategory.name}
            >
              <h3 id={`subcategory-${toId(category.name)}-${toId(subcategory.name)}`}>
                {subcategory.name}
              </h3>
              <div className={styles.assetRow}>
                {subcategory.assets.map((asset) => (
                  <AssetCard asset={asset} key={`${subcategory.name}-${asset.name}`} />
                ))}
              </div>
            </section>
          ))}
        </div>
      ) : (
        <>
          <div className={styles.assetRow}>
            {assets.map((asset) => (
              <AssetCard asset={asset} key={`${category.name}-${asset.name}`} />
            ))}
          </div>
          {category.name === "Terrain tiles" ? <TerrainBoardPreview /> : null}
        </>
      )}
    </section>
  );
}

function categoryAssets(category: AssetCategory) {
  return (
    category.assets ?? category.subcategories?.flatMap((subcategory) => subcategory.assets) ?? []
  );
}

function toId(value: string) {
  return value
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/g, "-")
    .replaceAll(/(^-|-$)/g, "");
}
