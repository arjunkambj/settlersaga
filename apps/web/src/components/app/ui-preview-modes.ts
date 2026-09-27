// Kept apart from ui-preview.tsx so the app can check `?preview=` without loading the previews.
export const UI_PREVIEW_MODES = [
  "action-preset",
  "auth",
  "game",
  "game-actions",
  "game-cities",
  "game-discard",
  "game-live",
  "game-paused",
  "game-results",
  "game-setup",
  "game-trade-confirm",
  "game-trade-offer",
  "game-trade-watch",
  "game-waiting",
  "game-won",
  "help",
  "home",
  "home-fresh",
  "lobby",
  "lobby-full",
  "lobby-guest",
] as const;

export type UiPreviewMode = (typeof UI_PREVIEW_MODES)[number];

export function isUiPreviewMode(value: string | null): value is UiPreviewMode {
  return UI_PREVIEW_MODES.some((mode) => mode === value);
}
