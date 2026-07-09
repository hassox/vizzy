/**
 * localStorage persistence for VizConfig (schemas/dan/viz-config).
 */
import {
  CONFIG_VERSION,
  PRESET_VERSION,
  emptyVizConfig,
  isVizConfig,
  type SourceBinding,
  type VizConfig,
  type VizPreset,
  type VizSource,
} from "@vizzy/contracts";

export const STORAGE_KEY = "vizzy.config.v1";

function nowIso(): string {
  return new Date().toISOString();
}

function newId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
}

export function loadConfig(): VizConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyVizConfig();
    const parsed: unknown = JSON.parse(raw);
    if (!isVizConfig(parsed)) {
      console.warn("[viz] invalid config in localStorage — resetting");
      return emptyVizConfig();
    }
    return parsed;
  } catch {
    return emptyVizConfig();
  }
}

export function saveConfig(config: VizConfig): VizConfig {
  const next: VizConfig = {
    ...config,
    version: CONFIG_VERSION,
    updatedAt: nowIso(),
  };
  if (!isVizConfig(next)) {
    throw new Error("Refusing to save invalid VizConfig");
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  return next;
}

export function listPresets(config: VizConfig = loadConfig()): VizPreset[] {
  return config.presets
    .slice()
    .sort((a, b) => (b.updatedAt ?? "").localeCompare(a.updatedAt ?? ""));
}

export function listSources(config: VizConfig = loadConfig()): VizSource[] {
  return config.sources
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name));
}

export type SnapshotInput = {
  title: string;
  description: string;
  theme: string;
  maxConcurrent: number;
  audio: boolean;
  spin: boolean;
  playbook: string | null;
  /** Current live WebSocket URL. */
  sourceUrl: string;
  /**
   * Prefer binding to this library source id when it matches the URL.
   * Otherwise mode=url with the live URL.
   */
  preferredSourceId?: string | null;
};

/**
 * Upsert a preset from the live dashboard.
 *
 * Identity is the **title** (case-insensitive):
 * - Same title as an existing save → update that one
 * - New title → always create a new preset
 *
 * We deliberately do NOT update by activePresetId alone: after saving "A",
 * changing the title to "B" and saving must create "B", not rename "A".
 */
export function savePresetFromSnapshot(
  snap: SnapshotInput,
  _opts: { activePresetId?: string | null } = {},
): { config: VizConfig; preset: VizPreset; created: boolean } {
  const title = snap.title.trim();
  if (!title) {
    throw new Error("Title is required to save a preset");
  }

  let config = loadConfig();
  const t = nowIso();
  const titleKey = title.toLowerCase();
  const existing = config.presets.find(
    (p) => p.title.trim().toLowerCase() === titleKey,
  );

  const source = resolveBindingForSave(
    config,
    snap.sourceUrl,
    snap.preferredSourceId,
  );

  const base: Omit<VizPreset, "id" | "createdAt"> = {
    version: PRESET_VERSION,
    title,
    description: snap.description.trim(),
    theme: snap.theme,
    maxConcurrent: snap.maxConcurrent,
    audio: snap.audio,
    spin: snap.spin,
    playbook: snap.playbook,
    source,
    updatedAt: t,
  };

  let preset: VizPreset;
  let created: boolean;
  if (existing) {
    preset = {
      ...existing,
      ...base,
      id: existing.id,
      createdAt: existing.createdAt ?? t,
    };
    config = {
      ...config,
      presets: config.presets.map((p) => (p.id === preset.id ? preset : p)),
      activePresetId: preset.id,
    };
    created = false;
  } else {
    preset = {
      id: newId(),
      ...base,
      createdAt: t,
    };
    config = {
      ...config,
      presets: [...config.presets, preset],
      activePresetId: preset.id,
    };
    created = true;
  }

  return { config: saveConfig(config), preset, created };
}

function resolveBindingForSave(
  config: VizConfig,
  sourceUrl: string,
  preferredSourceId?: string | null,
): SourceBinding {
  if (preferredSourceId) {
    const hit = config.sources.find((s) => s.id === preferredSourceId);
    if (hit && hit.url === sourceUrl) {
      return { mode: "saved", sourceId: hit.id };
    }
  }
  const byUrl = config.sources.find((s) => s.url === sourceUrl);
  if (byUrl) return { mode: "saved", sourceId: byUrl.id };
  return { mode: "url", url: sourceUrl };
}

/**
 * Bookmark the current URL. Name defaults to title, else host:port.
 * Upserts by URL.
 */
export function saveSourceBookmark(
  url: string,
  nameHint?: string,
): { config: VizConfig; source: VizSource; created: boolean } {
  let config = loadConfig();
  const t = nowIso();
  const existing = config.sources.find((s) => s.url === url);
  const name =
    (nameHint?.trim() ||
      existing?.name ||
      hostLabel(url) ||
      "Source").slice(0, 80);

  let source: VizSource;
  let created: boolean;
  if (existing) {
    source = { ...existing, name, url, updatedAt: t };
    config = {
      ...config,
      sources: config.sources.map((s) => (s.id === source.id ? source : s)),
    };
    created = false;
  } else {
    source = {
      id: newId(),
      name,
      url,
      createdAt: t,
      updatedAt: t,
    };
    config = { ...config, sources: [...config.sources, source] };
    created = true;
  }
  return { config: saveConfig(config), source, created };
}

export function deletePreset(id: string): VizConfig {
  const config = loadConfig();
  const next: VizConfig = {
    ...config,
    presets: config.presets.filter((p) => p.id !== id),
    activePresetId:
      config.activePresetId === id ? null : config.activePresetId,
  };
  return saveConfig(next);
}

export function deleteSource(id: string): VizConfig {
  const config = loadConfig();
  // Drop cycle/saved refs that pointed at this source → demote to empty cycle skip
  const presets = config.presets.map((p) => scrubSourceRef(p, id));
  const next: VizConfig = {
    ...config,
    sources: config.sources.filter((s) => s.id !== id),
    presets,
  };
  return saveConfig(next);
}

function scrubSourceRef(p: VizPreset, sourceId: string): VizPreset {
  const s = p.source;
  if (s.mode === "saved" && s.sourceId === sourceId) {
    return {
      ...p,
      source: { mode: "url", url: "ws://localhost:8787" },
      updatedAt: nowIso(),
    };
  }
  if (s.mode === "cycle") {
    const sourceIds = s.sourceIds.filter((id) => id !== sourceId);
    if (sourceIds.length === 0) {
      return {
        ...p,
        source: { mode: "url", url: "ws://localhost:8787" },
        updatedAt: nowIso(),
      };
    }
    if (sourceIds.length !== s.sourceIds.length) {
      return { ...p, source: { ...s, sourceIds }, updatedAt: nowIso() };
    }
  }
  return p;
}

export function setActivePresetId(id: string | null): VizConfig {
  const config = loadConfig();
  return saveConfig({ ...config, activePresetId: id });
}

export function getPreset(
  id: string,
  config: VizConfig = loadConfig(),
): VizPreset | undefined {
  return config.presets.find((p) => p.id === id);
}

function hostLabel(url: string): string {
  try {
    const u = new URL(url);
    return u.host || url;
  } catch {
    return url.slice(0, 40);
  }
}
