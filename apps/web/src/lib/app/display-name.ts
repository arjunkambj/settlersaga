import { DISPLAY_NAME_MAX_LENGTH } from "@settersaga/backend/convex/model/constants";

export function cleanDisplayName(displayName: string): string {
  return displayName.trim().slice(0, DISPLAY_NAME_MAX_LENGTH) || "Explorer";
}
