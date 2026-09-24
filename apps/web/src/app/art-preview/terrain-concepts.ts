export interface TerrainConcept {
  id: string;
  label: string;
  phase: string;
  path: string;
  note?: string;
}

const conceptPath = (file: string) => `/game-assets/terrain/concepts/${file}.png`;

export const TERRAIN_CONCEPTS: readonly TerrainConcept[] = [
  {
    id: "live",
    label: "Current game atlas",
    phase: "Reference",
    path: "/game-assets/terrain/terrain-atlas.png",
  },
  {
    id: "storybook",
    label: "Storybook terrain",
    phase: "Early exploration",
    path: conceptPath("exec-e489e607-ffb3-417a-9e34-547f8073c0f6"),
  },
  {
    id: "miniature",
    label: "Miniature terrain",
    phase: "Early exploration",
    path: conceptPath("exec-ac9380a4-3442-4a71-8596-51000550b4db"),
  },
  {
    id: "map",
    label: "Illustrated map",
    phase: "Early exploration",
    path: conceptPath("exec-23f87dbf-d2bd-4843-8602-53929b925610"),
  },
  {
    id: "soft-cartoon",
    label: "Soft cartoon terrain",
    phase: "Cartoon studies",
    path: conceptPath("exec-d74a9f4b-b1a7-42ac-a98b-fd35ae63be01"),
  },
  {
    id: "dense-toy",
    label: "Dense toy terrain",
    phase: "Cartoon studies",
    path: conceptPath("exec-4ba22c07-f278-48b6-a62a-faa9d490358f"),
    note: "Square source stretched into the six atlas frames.",
  },
  {
    id: "scenic-cartoon",
    label: "Scenic cartoon terrain",
    phase: "Cartoon studies",
    path: conceptPath("exec-2c6404d2-a92f-4b83-be08-c4d2baf6e01d"),
  },
  {
    id: "rounded-terrain",
    label: "Rounded toy terrain",
    phase: "Cartoon studies",
    path: conceptPath("exec-b298e043-9bd7-4fbb-8cf4-83ee2fcd05c8"),
  },
  {
    id: "ink-terrain",
    label: "Outlined terrain",
    phase: "Cartoon studies",
    path: conceptPath("exec-0c14249d-8836-4b4a-abf1-5f84e96fa4d5"),
  },
  {
    id: "bold-cartoon",
    label: "Bold cartoon original",
    phase: "Cartoon studies",
    path: conceptPath("exec-93560bef-3a08-446b-b8cd-51b1da6c0e55"),
  },
  {
    id: "bold-cartoon-detailed",
    label: "Bold cartoon detailed",
    phase: "Cartoon studies",
    path: conceptPath("exec-43860c7e-af38-4544-901c-fe384576d253"),
  },
  {
    id: "refined-one",
    label: "Crops and stone 1",
    phase: "Refinements",
    path: conceptPath("exec-394de783-2854-4e5f-b774-82e1d7a37c49"),
  },
  {
    id: "refined-two",
    label: "Crops and stone 2",
    phase: "Refinements",
    path: conceptPath("exec-3dd782a0-f197-45ea-ab9c-34e5d4f3b0d3"),
  },
  {
    id: "refined-three",
    label: "Crops and stone 3",
    phase: "Refinements",
    path: conceptPath("exec-7efebcc6-6a32-46a5-93e8-1cc81e601a8e"),
  },
  {
    id: "polished",
    label: "Polished cartoon",
    phase: "Refinements",
    path: conceptPath("exec-cc106581-1afb-4cac-900e-cff1e03deb45"),
  },
  {
    id: "board-safe",
    label: "Board-safe spacing",
    phase: "Refinements",
    path: conceptPath("exec-154194bb-a9e9-438b-b1e2-6d508fca35c7"),
  },
  {
    id: "upper-clusters",
    label: "Upper-half clusters",
    phase: "Refinements",
    path: conceptPath("exec-a318d373-739f-4b89-aa10-8c600b813273"),
  },
  {
    id: "token-safe",
    label: "Token-safe motifs",
    phase: "Refinements",
    path: conceptPath("exec-5330c12f-b5bc-4ed7-b5c6-858088bf6aaf"),
  },
  {
    id: "terrain-first",
    label: "Farm and clay quarry",
    phase: "Resource redesigns",
    path: conceptPath("exec-49afb20d-f0cc-4c61-867c-d2893c0fc01c"),
  },
  {
    id: "farm-rows",
    label: "Crop rows and slabs",
    phase: "Resource redesigns",
    path: conceptPath("exec-0fd1b459-5222-4dfe-bcbd-1d11b268b482"),
  },
  {
    id: "resource-icons",
    label: "Resource icon study",
    phase: "Resource redesigns",
    path: conceptPath("exec-0056a0fa-5f51-48c9-a0d0-21d6690ed097"),
  },
  {
    id: "clean-icons",
    label: "Clean symbols latest",
    phase: "Resource redesigns",
    path: conceptPath("exec-5f7da943-1966-4c5a-98dd-4cee77bf7018"),
  },
];
