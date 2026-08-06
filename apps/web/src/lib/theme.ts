export const DEFAULT_THEME = "light";
export const THEME_STORAGE_KEY = "settersaga:theme";

export type Theme = "dark" | "light";

export function resolveTheme(value: string | null): Theme {
  return value === "dark" ? "dark" : DEFAULT_THEME;
}

export function getNextTheme(theme: Theme): Theme {
  return theme === "light" ? "dark" : "light";
}
