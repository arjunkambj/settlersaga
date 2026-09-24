import arrowLeftIcon from "@iconify-icons/solar/arrow-left-bold";
import imageIcon from "@iconify-icons/solar/gallery-bold";
import layersIcon from "@iconify-icons/solar/layers-bold";
import { Icon } from "@iconify/react/offline";
import { PLAYER_COLORS, type PlayerColor } from "@settersaga/game";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";

import {
  AssetCard,
  type AssetCardItem,
  type AssetSwatch,
} from "@/components/asset-sheet/asset-card";
import { TerrainBoardPreview } from "@/components/asset-sheet/terrain-board-preview";
import { AWARD_ASSET_PATHS } from "@/constants/game/award-assets";
import {
  OCEAN_BOARD_ASSET_PATH,
  PIECE_ASSET_PATHS,
  PORT_BOAT_ASSET_PATH,
  PORT_DOCK_ASSET_PATH,
  ROBBER_ASSET_PATH,
  TERRAIN_ATLAS,
  TERRAIN_ATLAS_ASSET_PATH,
} from "@/constants/game/board-assets";
import {
  SETTERSAGA_MARK_ASSET_PATH,
  SETTERSAGA_WORDMARK_ASSET_PATH,
} from "@/constants/game/brand-assets";
import {
  ACTION_CARD_ASSET_PATHS,
  DEVELOPMENT_CARD_ASSETS,
  DEVELOPMENT_CARD_BACK_ASSET_PATH,
  RESOURCE_CARD_ASSET_PATHS,
  UNKNOWN_RESOURCE_CARD_ASSET_PATH,
} from "@/constants/game/card-assets";
import { getPlayerPortraitPath } from "@/constants/game/player-assets";
import {
  END_TURN_ICON_ASSET_PATH,
  VICTORY_FLOURISH_ASSET_PATH,
  WAIT_ICON_ASSET_PATH,
} from "@/constants/game/ui-assets";
import { SOUND_EFFECT_PATHS, type SoundEffect } from "@/lib/game/audio-cues";
import { BOT_DIFFICULTY_OPTIONS } from "@/lib/lobby/bot-difficulty";
import { HOUSE_RULE_OPTIONS } from "@/lib/lobby/house-rules";

export const metadata: Metadata = {
  description: "Matching asset sets and production briefs for SetterSaga.",
  robots: { follow: false, index: false },
  title: "Asset Sheet",
};

interface AssetCategory {
  assets?: readonly AssetCardItem[];
  brief: string;
  deliverables: string;
  name: string;
  preview?: ReactNode;
  subcategories?: readonly AssetSubcategory[];
}

interface AssetSubcategory {
  assets: readonly AssetCardItem[];
  name: string;
}

const AUDIO_FORMAT = "MP3 · 44.1 kHz · 192 kbps";

const SOUND_EFFECTS: Record<SoundEffect, { description: string; name: string }> = {
  action: { description: "Generic game action confirmation.", name: "Action feedback" },
  city: { description: "Weightier city upgrade cue.", name: "City placed" },
  dice: { description: "Cushioned arcane roll.", name: "Magic dice" },
  nextTurn: { description: "Notification when another player's turn begins.", name: "Next turn" },
  resource: { description: "Resource gain or loss cue.", name: "Resource change" },
  road: { description: "Short wooden road placement cue.", name: "Road placed" },
  robber: { description: "Robber sequence warning.", name: "Robber alert" },
  settlement: { description: "Warm settlement placement cue.", name: "Settlement placed" },
  trade: { description: "Soft resource exchange.", name: "Trade resolved" },
  turn: { description: "Notification when your turn begins or has been idle.", name: "Your turn" },
  victory: { description: "Match-winning celebration.", name: "Victory" },
};

function soundEffectAssets(sounds: readonly SoundEffect[]): AssetCardItem[] {
  return sounds.map((sound) => ({
    ...SOUND_EFFECTS[sound],
    format: AUDIO_FORMAT,
    kind: "audio",
    path: SOUND_EFFECT_PATHS[sound],
  }));
}

const PLAYER_PORTRAITS: Record<PlayerColor, { description: string; name: string }> = {
  blue: { description: "Blue-seat island cartographer.", name: "Blue cartographer" },
  green: { description: "Green-seat island botanist.", name: "Green botanist" },
  orange: { description: "Orange-seat village builder.", name: "Orange builder" },
  pink: { description: "Pink-seat island pathfinder.", name: "Pink pathfinder" },
  purple: { description: "Purple-seat island astronomer.", name: "Purple astronomer" },
  red: {
    description: "Red-seat harbor navigator and default fallback portrait.",
    name: "Red navigator",
  },
  teal: { description: "Teal-seat harbor shipwright.", name: "Teal shipwright" },
  yellow: { description: "Yellow-seat island merchant.", name: "Yellow merchant" },
};

const THEME_SWATCHES: readonly AssetSwatch[] = [
  { className: "bg-background", label: "background" },
  { className: "bg-card", label: "card" },
  { className: "bg-primary", label: "primary" },
  { className: "bg-accent", label: "accent" },
  { className: "bg-foreground", label: "foreground" },
  { className: "bg-muted-foreground", label: "muted-foreground" },
];

const PLAYER_SWATCHES: readonly AssetSwatch[] = PLAYER_COLORS.map((color) => ({
  className: `player-${color} bg-[var(--player-color)]`,
  label: color,
}));

const ASSET_CATEGORIES: readonly AssetCategory[] = [
  {
    name: "Terrain tiles",
    brief:
      "Buy or commission all six terrain types together. Match the camera angle, lighting, landmark scale, ground treatment, and hex-edge clearance across the complete atlas.",
    deliverables: "6 tile types · 1 atlas · fields, forest, hills, mountains, pasture, desert",
    assets: [
      {
        name: "Terrain atlas",
        description: `Single-source ${TERRAIN_ATLAS.columns}×${TERRAIN_ATLAS.rows} atlas of ${TERRAIN_ATLAS.frameSize}px frames for fields, forest, hills, mountains, pasture, and desert. The board clips each frame into its exact flat-top hex geometry.`,
        fit: "cover",
        path: TERRAIN_ATLAS_ASSET_PATH,
      },
    ],
    preview: <TerrainBoardPreview />,
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
          path,
        })),
      },
      {
        name: "Development cards",
        assets: [
          ...DEVELOPMENT_CARD_ASSETS.map((card) => ({
            name: `${card.label} card`,
            description: card.description,
            path: card.path,
          })),
          {
            name: "Hidden card back",
            description:
              "Concealed card-back concept retained with the development-card art catalog.",
            path: DEVELOPMENT_CARD_BACK_ASSET_PATH,
          },
        ],
      },
      {
        name: "Action cards",
        assets: [
          {
            name: "Trade card",
            description: "Purple-and-gold market artwork used by the live trade control.",
            path: ACTION_CARD_ASSET_PATHS.trade,
          },
          {
            name: "Road card",
            description: "Purple-and-gold road artwork used by the build-road section card.",
            path: ACTION_CARD_ASSET_PATHS.road,
          },
          {
            name: "House card",
            description: "Purple-and-gold settlement artwork used by the build-house section card.",
            path: ACTION_CARD_ASSET_PATHS.settlement,
          },
          {
            name: "City card",
            description: "Purple-and-gold city artwork used by the build-city section card.",
            path: ACTION_CARD_ASSET_PATHS.city,
          },
        ],
      },
    ],
  },
  {
    name: "Players",
    brief:
      "Commission all eight portraits together. Keep the same crop, head size, rendering style, lighting, and background treatment, with a clear accent for each reserved player color.",
    deliverables: `${PLAYER_COLORS.length} portraits · ${PLAYER_COLORS.join(", ")}`,
    assets: PLAYER_COLORS.map((color) => ({
      ...PLAYER_PORTRAITS[color],
      path: getPlayerPortraitPath(color),
    })),
  },
  {
    name: "Harbor & bots",
    brief:
      "Commission the bot captains, house-rule badges and empty seat as one pre-game set. Match the player portraits' crop and lighting so bots and people sit side by side, and keep every badge on a transparent square.",
    deliverables: `${BOT_DIFFICULTY_OPTIONS.length + HOUSE_RULE_OPTIONS.length + 1} illustrations · bot captains, house rules, empty seat`,
    subcategories: [
      {
        name: "Bot captains",
        assets: BOT_DIFFICULTY_OPTIONS.map((bot) => ({
          name: `${bot.label} bot`,
          description: `Portrait for ${bot.label.toLowerCase()} bots in the harbor, Quick Match and the game.`,
          path: bot.artSrc,
          transparent: true,
        })),
      },
      {
        name: "House rules",
        assets: HOUSE_RULE_OPTIONS.map((rule) => ({
          name: rule.label,
          description: `Harbor rule tile. ${rule.description}`,
          path: rule.artSrc,
          transparent: true,
        })),
      },
      {
        name: "Seats",
        assets: [
          {
            name: "Empty seat",
            description: "Open chair shown on a harbor seat that is still waiting for a player.",
            path: "/game-assets/ui/empty-seat.png",
            transparent: true,
          },
        ],
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
            path: PIECE_ASSET_PATHS.road,
            transparent: true,
          },
          {
            name: "Settlement piece",
            description: "Player-tintable settlement used for board placement.",
            path: PIECE_ASSET_PATHS.settlement,
            transparent: true,
          },
          {
            name: "City piece",
            description: "Player-tintable city used to upgrade a settlement.",
            path: PIECE_ASSET_PATHS.city,
            transparent: true,
          },
          {
            name: "Robber piece",
            description: "Neutral robber piece moved between terrain tiles.",
            path: ROBBER_ASSET_PATH,
            transparent: true,
          },
        ],
      },
      {
        name: "Port props",
        assets: [
          {
            name: "Port merchant",
            description: "Top-down trading boat marking each offshore port.",
            path: PORT_BOAT_ASSET_PATH,
            transparent: true,
          },
          {
            name: "Port bridge",
            description:
              "Timber bridge prop for port docks. The board does not use it yet and draws docks in code.",
            path: PORT_DOCK_ASSET_PATH,
            transparent: true,
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
            path: "/shared-assets/coastal-island-kingdom-supercell.png",
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
            path: OCEAN_BOARD_ASSET_PATH,
          },
        ],
      },
    ],
  },
  {
    name: "Menu & interface icons",
    brief:
      "Buy or commission a matching interface illustration pack. Keep materials, lighting, edge treatment, and visual weight consistent, including the small bank and turn-state icons.",
    deliverables: "7 illustrations · 3 menu illustrations and 4 utility icons",
    subcategories: [
      {
        name: "Home menu",
        assets: [
          {
            name: "Quick match",
            description: "Glossy rolling dice on a floating board island.",
            path: "/home-assets/menu/quick-match.png",
          },
          {
            name: "Host island",
            description: "Crooked storybook island home with golden roof.",
            path: "/home-assets/menu/host-island.png",
          },
          {
            name: "Join crew",
            description: "Treasure map with brass compass for joining a room.",
            path: "/home-assets/menu/join-crew.png",
          },
        ],
      },
      {
        name: "Utility icons",
        assets: [
          {
            name: "Bank icon",
            description: "Bank-building symbol. The game UI does not use it yet.",
            path: "/game-assets/ui/bank.png",
            transparent: true,
          },
          {
            name: "End turn icon",
            description: "Checked turn ledger and dice used by the live end-turn control.",
            path: END_TURN_ICON_ASSET_PATH,
            transparent: true,
          },
          {
            name: "Wait icon",
            description: "Hourglass artwork used when another player is taking their turn.",
            path: WAIT_ICON_ASSET_PATH,
            transparent: true,
          },
          {
            name: "Loading compass",
            description: "Brass compass that sways on every loading screen.",
            path: "/game-assets/ui/loading-compass.png",
            transparent: true,
          },
        ],
      },
    ],
  },
  {
    name: "Awards & results",
    brief:
      "Commission the award pair and victory treatment together. Match their materials, lighting, and celebration palette, with distinct silhouettes for each achievement.",
    deliverables:
      "5 illustrations · longest road, largest army, victory and defeat flourishes, podium",
    assets: [
      {
        name: "Longest Road",
        description: "Award illustration for the longest connected route.",
        path: AWARD_ASSET_PATHS.longestRoad,
        transparent: true,
      },
      {
        name: "Largest Army",
        description: "Award illustration for the strongest knight force.",
        path: AWARD_ASSET_PATHS.largestArmy,
        transparent: true,
      },
      {
        name: "Victory flourish",
        description: "Celebratory crown, rays, and confetti treatment.",
        path: VICTORY_FLOURISH_ASSET_PATH,
        transparent: true,
      },
      {
        name: "Defeat flourish",
        description: "Quieter banner treatment behind the results when another player wins.",
        path: "/game-assets/results/defeat-flourish.png",
        transparent: true,
      },
      {
        name: "Podium",
        description:
          "Three empty wooden steps (tallest in the middle) that the top three players stand on in the results.",
        path: "/game-assets/results/podium.png",
        transparent: true,
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
        description:
          "One-line 3D title: cream Setter and gold Saga in a navy outline, crowned with three rooftops.",
        path: SETTERSAGA_WORDMARK_ASSET_PATH,
        transparent: true,
      },
      {
        name: "Mark",
        description:
          "Gold-framed blue hexagon crest with a blue-roofed cottage, tree, and flag on a floating island.",
        path: SETTERSAGA_MARK_ASSET_PATH,
        transparent: true,
      },
      {
        name: "Display typography",
        description:
          "Lilita One gives titles, the logo lockup, and card headings a chunky, friendly voice.",
        format: "Lilita One · 400 · display",
        kind: "brand",
        previewClassName: "font-display",
        previewText: "Build your island",
      },
      {
        name: "Interface typography",
        description:
          "DM Sans keeps rules, room status, resources, and quick in-turn decisions clear and consistent.",
        format: "DM Sans · 400–900 · system sans fallback",
        kind: "brand",
        previewText: "Roll dice · Trade · Build",
      },
      {
        name: "Ocean night palette",
        description:
          "Single deep ocean theme. Ice-white text, navy surfaces, sky blue on primary actions, cyan glow lines.",
        format: THEME_SWATCHES.map((swatch) => swatch.label).join(" · "),
        kind: "brand",
        swatches: THEME_SWATCHES,
      },
      {
        name: "Player seat colors",
        description:
          "Eight distinct seat colors remain reserved for ownership across pieces, HUDs, and activity states.",
        format: PLAYER_COLORS.join(" · "),
        kind: "brand",
        swatches: PLAYER_SWATCHES,
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
        assets: [
          {
            name: "Home music",
            description: "A welcoming magical-island theme used on the signed-in home screen.",
            format: AUDIO_FORMAT,
            kind: "audio",
            path: "/music/main-lobby-music.mp3",
          },
        ],
      },
      { name: "General", assets: soundEffectAssets(["action"]) },
      { name: "Turn flow", assets: soundEffectAssets(["dice", "nextTurn", "turn", "resource"]) },
      { name: "Building", assets: soundEffectAssets(["road", "settlement", "city"]) },
      { name: "High-priority events", assets: soundEffectAssets(["robber", "trade", "victory"]) },
    ],
  },
];

const ASSET_COUNT = ASSET_CATEGORIES.reduce(
  (count, category) => count + categoryAssets(category).length,
  0,
);

export default function AssetSheetPage() {
  if (process.env.NODE_ENV !== "development") {
    notFound();
  }

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
            <p className="text-xs font-bold uppercase tracking-widest text-accent">
              Matching asset sets
            </p>
            <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl lg:text-5xl">
              Game asset sheet
            </h1>
          </div>

          <div className="flex flex-wrap gap-4" aria-label="Asset totals">
            <SummaryItem
              icon={<Icon aria-hidden="true" icon={imageIcon} />}
              label="Assets"
              value={ASSET_COUNT}
            />
            <SummaryItem
              icon={<Icon aria-hidden="true" icon={layersIcon} />}
              label="Asset sets"
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

function SummaryItem({ icon, label, value }: { icon: ReactNode; label: string; value: number }) {
  return (
    <div className="flex items-center gap-3.5 rounded-xl border border-border bg-card text-card-foreground p-4 shadow-none min-w-[140px]">
      <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent/10 text-lg text-accent">
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

  return (
    <section
      aria-labelledby={`category-${toId(category.name)}`}
      className="py-6 border-b border-border last:border-b-0 space-y-4"
    >
      <div className="flex items-center justify-between gap-4">
        <h2
          id={`category-${toId(category.name)}`}
          className="text-xl sm:text-2xl font-bold tracking-tight"
        >
          {category.name}
        </h2>
        <span className="rounded-full border border-border px-3 py-1 text-xs font-semibold text-muted-foreground whitespace-nowrap">
          {assets.length} {assets.length === 1 ? "asset" : "assets"}
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
              <AssetGrid assets={subcategory.assets} />
            </section>
          ))}
        </div>
      ) : (
        <AssetGrid assets={assets} />
      )}
      {category.preview}
    </section>
  );
}

function AssetGrid({ assets }: { assets: readonly AssetCardItem[] }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
      {assets.map((asset) => (
        <AssetCard asset={asset} key={asset.name} />
      ))}
    </div>
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
