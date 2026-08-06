"use client";

import moonIcon from "@iconify-icons/solar/moon-bold-duotone";
import sunIcon from "@iconify-icons/solar/sun-bold-duotone";
import { Icon } from "@iconify/react";
import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";

import {
  DEFAULT_THEME,
  getNextTheme,
  resolveTheme,
  THEME_STORAGE_KEY,
  type Theme,
} from "@/lib/theme";


export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>(DEFAULT_THEME);

  useEffect(() => {
    setTheme(resolveTheme(document.documentElement.dataset.theme ?? null));
  }, []);

  const toggleTheme = () => {
    const nextTheme = getNextTheme(theme);
    const root = document.documentElement;

    root.classList.remove("light", "dark");
    root.classList.add(nextTheme);
    root.dataset.theme = nextTheme;
    window.localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
    setTheme(nextTheme);
  };

  const isLight = theme === "light";

  return (
    <Button
      aria-label={`Switch to ${isLight ? "dark" : "light"} theme`}
      className={""}
      onClick={toggleTheme}
      size="icon-sm"
      variant="secondary"
    >
      <Icon aria-hidden="true" icon={isLight ? moonIcon : sunIcon} width={18} />
    </Button>
  );
}
