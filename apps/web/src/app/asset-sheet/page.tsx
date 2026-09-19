import arrowLeftIcon from "@iconify-icons/solar/arrow-left-bold";
import checkIcon from "@iconify-icons/solar/check-circle-bold";
import clockIcon from "@iconify-icons/solar/clock-circle-bold";
import imageIcon from "@iconify-icons/solar/gallery-bold";
import { Icon } from "@iconify/react";
import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

import { getPieceAssetPath } from "@/components/game/piece-icon";
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

import { AssetCard, type AssetCardItem } from "@/components/asset-sheet/asset-card";
import { TerrainBoardPreview } from "@/components/asset-sheet/terrain-board-preview";

export const metadata: Metadata = {
  description: "Matching asset sets and production briefs for SetterSaga.",
  title: "Asset Sheet · SetterSaga",
};

interface AssetItem extends AssetCardItem {
  description: string;
  format: string;
}

interface AssetCategory {
  assets?: readonly AssetItem[];
  name: string;
  brief: string;
  deliverables: string;
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
    name: "Terrain tiles",
    brief:
      "Buy or commission all six terrain types together. Match the camera angle, lighting, landmark scale, ground treatment, and hex-edge clearance across the complete atlas.",
    deliverables: "6 tile types · 1 atlas · fields, forest, hills, mountains, pasture, desert",
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
    name: "Cards",
    brief:
      "Source every card as one coordinated family. Use the same portrait proportions, frame, border thickness, lighting, and illustration scale; distinguish card types with a controlled palette. Include both concealed-card designs in the brief.",
    deliverables: "16 cards · 6 resource designs, 6 development designs, 4 action designs",
    subcategories: [
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
            description:
              "Concealed card-back concept retained with the development-card art catalog.",
            format: "PNG · 512×768",
            path: DEVELOPMENT_CARD_BACK_ASSET_PATH,
            status: "generated" as const,
          },
        ],
      },
      {
        name: "Action cards",
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
        ],
      },
    ],
  },
  {
    name: "Players",
    brief:
      "Commission all eight portraits together. Keep the same crop, head size, rendering style, lighting, and background treatment, with a clear accent for each reserved player color.",
    deliverables: "8 portraits · red, blue, orange, green, purple, teal, yellow, pink",
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
    name: "Board pieces & ports",
    brief:
      "Source these as a coordinated board-prop set. Match the terrain camera and lighting, keep silhouettes readable at board size, and use consistent transparent padding. Roads, settlements, and cities must support all eight player tints.",
    deliverables: "6 sprites · road, settlement, city, robber, boat, bridge",
    subcategories: [
      {
        name: "Playing pieces",
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
        name: "Port props",
        assets: [
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
    ],
  },
  {
    name: "Environments",
    brief:
      "Commission both backgrounds together using the same island world, ocean palette, and lighting. Keep the central play and menu areas quiet enough for the interface.",
    deliverables: "2 backgrounds · island world and ocean playfield",
    subcategories: [
      {
        name: "Menu world",
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
        name: "Game board",
        assets: [
          {
            name: "Ocean board canvas",
            description: "Quiet turquoise water backdrop beneath the playable board.",
            fit: "cover",
            format: "WebP · 1586×992",
            path: OCEAN_BOARD_ASSET_PATH,
            status: "generated",
          },
        ],
      },
    ],
  },
  {
    name: "Menu & interface icons",
    brief:
      "Buy or commission a matching interface illustration pack. Keep materials, lighting, edge treatment, and visual weight consistent, including the small bank and turn-state icons.",
    deliverables: "6 illustrations · 3 menu illustrations and 3 utility icons",
    subcategories: [
      {
        name: "Home menu",
        assets: [
          {
            name: "Quick match",
            description: "Glossy rolling dice on a floating board island.",
            format: "PNG · 1080×1080",
            path: "/home-assets/menu/quick-match.png",
            status: "generated",
          },
          {
            name: "Host island",
            description: "Crooked storybook island home with golden roof.",
            format: "PNG · 1080×1080",
            path: "/home-assets/menu/host-island.png",
            status: "generated",
          },
          {
            name: "Join crew",
            description: "Treasure map with brass compass for joining a room.",
            format: "PNG · 1080×1080",
            path: "/home-assets/menu/join-crew.png",
            status: "generated",
          },
        ],
      },
      {
        name: "Utility icons",
        assets: [
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
    ],
  },
  {
    name: "Awards & results",
    brief:
      "Commission the award pair and victory treatment together. Match their materials, lighting, and celebration palette, with distinct silhouettes for each achievement.",
    deliverables: "3 illustrations · longest road, largest army, victory flourish",
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
    name: "Brand foundations",
    brief:
      "Use one approved identity kit for every set. Keep the wordmark and emblem coordinated, and share the typography, theme palette, and player colors with every artist or asset supplier.",
    deliverables: "2 logo assets · typography and color references",
    assets: [
      {
        name: "Wordmark",
        description: "Stacked gold 3D title: Setter over Saga, with a hexagonal cottage badge.",
        format: "PNG · 558×605 · transparent",
        path: "/game-assets/brand/settersaga-wordmark.png",
        status: "generated",
      },
      {
        name: "Mark",
        description:
          "Hexagonal island crest: golden-thatched cottage, pines, rocky cliffs, and a wooden dock.",
        format: "PNG · 921×921 · transparent",
        path: "/game-assets/brand/settersaga-mark.png",
        status: "generated",
      },
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
        name: "Ocean night palette",
        description:
          "Single deep ocean theme. Ice-white text, navy surfaces, sky blue on primary actions, cyan glow lines.",
        format: "#1A4A94 · #143D7C · #F2F7FF · #C3D6F2 · #46B8FF",
        kind: "brand",
        status: "generated",
        swatches: ["#1A4A94", "#143D7C", "#F2F7FF", "#C3D6F2", "#46B8FF"],
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
  {
    name: "Audio",
    brief:
      "Source music and effects as a coordinated audio package. Agree on instrumentation, loudness, and event intensity so cues belong to the same game and remain clear over the music.",
    deliverables: "12 audio files · 1 music track and 11 effects",
    subcategories: [
      {
        name: "Music",
        assets: MUSIC_ASSETS,
      },
      ...SOUND_EFFECT_SUBCATEGORIES,
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
    <main className="min-h-screen bg-background text-foreground overflow-y-auto" id="main-content">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-8">
        <header className="border-b border-border pb-6 space-y-6">
          <Link
            className="inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors"
            href="/"
          >
            <Icon aria-hidden="true" icon={arrowLeftIcon} width={16} />
            Back to game
          </Link>

          <div className="space-y-1">
            <p className="text-xs font-bold uppercase tracking-widest text-brand-accent">
              Matching asset sets
            </p>
            <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl lg:text-5xl">
              Game asset sheet
            </h1>
          </div>

          <div className="flex flex-wrap gap-4" aria-label="Asset totals">
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
              label="Asset sets"
              tone="neutral"
              value={ASSET_CATEGORIES.length}
            />
          </div>
        </header>

        <aside className="rounded-2xl border border-border bg-card p-5 space-y-2">
          <h2 className="font-bold">Source complete sets, keep one art direction</h2>
          <p className="max-w-3xl text-sm leading-relaxed text-muted-foreground">
            Buy, commission, or generate each group together. Review the whole set side by side
            before accepting individual assets. Share the same approved style reference across every
            group: cartoon shapes, consistent lighting, materials, and color palette. Existing
            assets below are references, not a guarantee that a set already matches.
          </p>
        </aside>

        <nav aria-label="Asset sets" className="flex flex-wrap gap-2">
          {ASSET_CATEGORIES.map((category) => (
            <a
              className="rounded-full border border-border bg-card px-3 py-2 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
              href={`#category-${toId(category.name)}`}
              key={category.name}
            >
              {category.name}
            </a>
          ))}
        </nav>

        <div className="space-y-4">
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
    <div className="flex items-center gap-3.5 rounded-xl border border-border bg-card text-card-foreground p-4 shadow-none min-w-[140px]">
      <span
        className={cn(
          "flex h-9 w-9 items-center justify-center rounded-lg text-lg",
          tone === "ready" && "text-signal-success bg-signal-success/12",
          tone === "needed" && "text-signal-warning bg-signal-warning/12",
          tone === "neutral" && "text-muted-foreground bg-muted",
        )}
      >
        {icon}
      </span>
      <span className="flex flex-col">
        <strong className="text-xl font-bold leading-none">{value}</strong>
        <small className="text-xs text-muted-foreground font-medium mt-1">{label}</small>
      </span>
    </div>
  );
}

function AssetCategoryRow({ category }: { category: AssetCategory }) {
  const assets = categoryAssets(category);
  const generatedCount = assets.filter((asset) => asset.status === "generated").length;

  return (
    <section
      aria-labelledby={`category-${toId(category.name)}`}
      className="py-6 border-b border-border last:border-b-0 space-y-4"
      data-live-preview={category.name === "Terrain tiles" || undefined}
    >
      <div className="flex items-center justify-between gap-4">
        <h2
          id={`category-${toId(category.name)}`}
          className="text-xl sm:text-2xl font-bold tracking-tight"
        >
          {category.name}
        </h2>
        <span className="rounded-full border border-border px-3 py-1 text-xs font-semibold text-muted-foreground whitespace-nowrap">
          {generatedCount}/{assets.length} available
        </span>
      </div>

      <div className="rounded-xl border border-border bg-muted/30 p-4 space-y-2">
        <p className="text-sm font-semibold">Complete set: {category.deliverables}</p>
        <p className="max-w-4xl text-sm leading-relaxed text-muted-foreground">{category.brief}</p>
      </div>

      {category.subcategories ? (
        <div className="space-y-6">
          {category.subcategories.map((subcategory) => (
            <section
              aria-labelledby={`subcategory-${toId(category.name)}-${toId(subcategory.name)}`}
              className="space-y-3"
              key={subcategory.name}
            >
              <h3
                id={`subcategory-${toId(category.name)}-${toId(subcategory.name)}`}
                className="text-xs font-bold uppercase tracking-wider text-muted-foreground"
              >
                {subcategory.name}
              </h3>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                {subcategory.assets.map((asset) => (
                  <AssetCard asset={asset} key={`${subcategory.name}-${asset.name}`} />
                ))}
              </div>
            </section>
          ))}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
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
