import { emberTheme } from "./ember.js";
import { nukesTheme } from "./nukes.js";
import { packetsTheme } from "./packets.js";
import type { Theme } from "./types.js";

const themes: Theme[] = [emberTheme, nukesTheme, packetsTheme];

const registry: Record<string, Theme> = Object.fromEntries(
  themes.map((t) => [t.id, t]),
);

export function listThemes(): Theme[] {
  return themes.slice();
}

export function resolveTheme(id: string | null | undefined): Theme {
  if (id && registry[id]) return registry[id]!;
  return emberTheme;
}

export type { Theme, VisualParams, ThemeContext } from "./types.js";
