/**
 * Viz client configuration types.
 * Shape source of truth: schemas/dan/viz-config.schema.json + SCHEMA.md
 *
 * One schema, three conceptual pieces via $defs:
 *   source         — named feed bookmark
 *   sourceBinding  — how a run connects (url | saved | cycle)
 *   preset         — full run / wall configuration
 * Root document    — library envelope (sources + presets) for localStorage
 */

export const CONFIG_VERSION = 1 as const;
export const PRESET_VERSION = 1 as const;

export const PRESET_DEFAULTS = {
  title: "",
  description: "",
  theme: "ember",
  maxConcurrent: 200,
  audio: false,
  spin: true,
  playbook: null as string | null,
  cycleIntervalSec: 60,
} as const;

export const MAX_CONCURRENT_FLOOR = 10;
export const MAX_CONCURRENT_CEILING = 500;

/** $defs/source — named event feed bookmark. */
export type VizSource = {
  id: string;
  name: string;
  url: string;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
};

export type SourceBindingUrl = {
  mode: "url";
  url: string;
  sourceId?: undefined;
  sourceIds?: undefined;
  cycleIntervalSec?: number;
};

export type SourceBindingSaved = {
  mode: "saved";
  sourceId: string;
  url?: undefined;
  sourceIds?: undefined;
  cycleIntervalSec?: number;
};

export type SourceBindingCycle = {
  mode: "cycle";
  sourceIds: string[];
  cycleIntervalSec?: number;
  url?: undefined;
  sourceId?: undefined;
};

/** $defs/sourceBinding — how a preset connects to a feed. */
export type SourceBinding =
  | SourceBindingUrl
  | SourceBindingSaved
  | SourceBindingCycle;

/** $defs/preset — full configuration for one viz run. Title is the label. */
export type VizPreset = {
  id: string;
  version: typeof PRESET_VERSION;
  /** Wall title and picker label. */
  title: string;
  description?: string;
  theme?: string;
  maxConcurrent?: number;
  audio?: boolean;
  spin?: boolean;
  playbook?: string | null;
  source: SourceBinding;
  createdAt?: string;
  updatedAt?: string;
};

/**
 * Root of viz-config.schema.json — client library document
 * (localStorage key e.g. `vizzy.config.v1` / export file).
 */
export type VizConfig = {
  version: typeof CONFIG_VERSION;
  sources: VizSource[];
  presets: VizPreset[];
  activePresetId?: string | null;
  updatedAt?: string;
};

export function isVizSource(value: unknown): value is VizSource {
  if (!value || typeof value !== "object") return false;
  const s = value as VizSource;
  if (typeof s.id !== "string" || s.id.length === 0) return false;
  if (typeof s.name !== "string" || s.name.length === 0 || s.name.length > 80) {
    return false;
  }
  if (typeof s.url !== "string" || s.url.length === 0 || s.url.length > 512) {
    return false;
  }
  if (s.notes !== undefined) {
    if (typeof s.notes !== "string" || s.notes.length > 400) return false;
  }
  if (s.createdAt !== undefined && typeof s.createdAt !== "string") return false;
  if (s.updatedAt !== undefined && typeof s.updatedAt !== "string") return false;
  return true;
}

export function isSourceBinding(value: unknown): value is SourceBinding {
  if (!value || typeof value !== "object") return false;
  const b = value as SourceBinding;
  if (b.mode === "url") {
    return typeof b.url === "string" && b.url.length > 0 && b.url.length <= 512;
  }
  if (b.mode === "saved") {
    return typeof b.sourceId === "string" && b.sourceId.length > 0;
  }
  if (b.mode === "cycle") {
    if (!Array.isArray(b.sourceIds) || b.sourceIds.length === 0) return false;
    if (b.sourceIds.length > 32) return false;
    if (!b.sourceIds.every((id) => typeof id === "string" && id.length > 0)) {
      return false;
    }
    if (b.cycleIntervalSec !== undefined) {
      if (
        typeof b.cycleIntervalSec !== "number" ||
        b.cycleIntervalSec < 5 ||
        b.cycleIntervalSec > 3600
      ) {
        return false;
      }
    }
    return true;
  }
  return false;
}

export function isVizPreset(value: unknown): value is VizPreset {
  if (!value || typeof value !== "object") return false;
  const p = value as VizPreset;
  if (typeof p.id !== "string" || p.id.length === 0) return false;
  if (
    typeof p.title !== "string" ||
    p.title.length === 0 ||
    p.title.length > 120
  ) {
    return false;
  }
  if (p.version !== PRESET_VERSION) return false;
  if (!isSourceBinding(p.source)) return false;

  if (p.description !== undefined) {
    if (typeof p.description !== "string" || p.description.length > 400) {
      return false;
    }
  }
  if (p.theme !== undefined) {
    if (
      typeof p.theme !== "string" ||
      p.theme.length === 0 ||
      p.theme.length > 64
    ) {
      return false;
    }
  }
  if (p.maxConcurrent !== undefined) {
    if (
      typeof p.maxConcurrent !== "number" ||
      !Number.isInteger(p.maxConcurrent) ||
      p.maxConcurrent < MAX_CONCURRENT_FLOOR ||
      p.maxConcurrent > MAX_CONCURRENT_CEILING
    ) {
      return false;
    }
  }
  if (p.audio !== undefined && typeof p.audio !== "boolean") return false;
  if (p.spin !== undefined && typeof p.spin !== "boolean") return false;
  if (p.playbook !== undefined && p.playbook !== null) {
    if (typeof p.playbook !== "string" || p.playbook.length > 64) return false;
  }
  if (p.createdAt !== undefined && typeof p.createdAt !== "string") return false;
  if (p.updatedAt !== undefined && typeof p.updatedAt !== "string") return false;
  return true;
}

export function isVizConfig(value: unknown): value is VizConfig {
  if (!value || typeof value !== "object") return false;
  const lib = value as VizConfig;
  if (lib.version !== CONFIG_VERSION) return false;
  if (!Array.isArray(lib.sources) || lib.sources.length > 100) return false;
  if (!Array.isArray(lib.presets) || lib.presets.length > 50) return false;
  if (!lib.sources.every(isVizSource)) return false;
  if (!lib.presets.every(isVizPreset)) return false;
  if (
    lib.activePresetId !== undefined &&
    lib.activePresetId !== null &&
    typeof lib.activePresetId !== "string"
  ) {
    return false;
  }
  if (lib.updatedAt !== undefined && typeof lib.updatedAt !== "string") {
    return false;
  }
  return true;
}

/** Resolve a preset's source binding against the library → concrete WS URL(s). */
export function resolveSourceUrls(
  binding: SourceBinding,
  sources: VizSource[],
): { urls: string[]; cycleIntervalSec: number } | { error: string } {
  const byId = new Map(sources.map((s) => [s.id, s]));
  if (binding.mode === "url") {
    return {
      urls: [binding.url],
      cycleIntervalSec: PRESET_DEFAULTS.cycleIntervalSec,
    };
  }
  if (binding.mode === "saved") {
    const s = byId.get(binding.sourceId);
    if (!s) return { error: `Unknown source id: ${binding.sourceId}` };
    return {
      urls: [s.url],
      cycleIntervalSec: PRESET_DEFAULTS.cycleIntervalSec,
    };
  }
  const urls: string[] = [];
  for (const id of binding.sourceIds) {
    const s = byId.get(id);
    if (!s) return { error: `Unknown source id in cycle: ${id}` };
    urls.push(s.url);
  }
  return {
    urls,
    cycleIntervalSec:
      binding.cycleIntervalSec ?? PRESET_DEFAULTS.cycleIntervalSec,
  };
}

export function emptyVizConfig(): VizConfig {
  return {
    version: CONFIG_VERSION,
    sources: [],
    presets: [],
    activePresetId: null,
  };
}

/** Apply defaults for runtime use (does not mutate). */
export function hydratePreset(
  p: VizPreset,
): Required<
  Pick<
    VizPreset,
    | "title"
    | "description"
    | "theme"
    | "maxConcurrent"
    | "audio"
    | "spin"
    | "playbook"
  >
> &
  VizPreset {
  return {
    ...p,
    title: p.title,
    description: p.description ?? PRESET_DEFAULTS.description,
    theme: p.theme ?? PRESET_DEFAULTS.theme,
    maxConcurrent: p.maxConcurrent ?? PRESET_DEFAULTS.maxConcurrent,
    audio: p.audio ?? PRESET_DEFAULTS.audio,
    spin: p.spin ?? PRESET_DEFAULTS.spin,
    playbook: p.playbook === undefined ? PRESET_DEFAULTS.playbook : p.playbook,
  };
}

/** Display label for a preset (title is canonical). */
export function presetLabel(p: VizPreset): string {
  return p.title.trim() || "Untitled";
}
