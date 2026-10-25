import type { PathType } from "./walletKeys";

export interface AccountPreferences {
  addresses: string[];
  names: string[];
  visible: boolean[];
  selected: number;
  pathType: PathType;
}

export const accountPreferencesKey = (rootAddress: string) => `accountPreferences_${rootAddress.toLowerCase()}`;

export function parseStringList(value: string | null): string[] {
  if (!value) return [];
  try {
    const parsed: unknown = JSON.parse(value);
    if (Array.isArray(parsed) && parsed.every((item) => typeof item === "string")) return parsed;
  } catch { /* Old installs used comma-separated values. */ }
  return value.split(",");
}
