import {
  hydratePreset,
  resolveSourceUrls,
  type VizPreset,
} from "@vizzy/contracts";
import Globe from "globe.gl";
import {
  ArcEngine,
  MAX_CONCURRENT_CEILING,
  MAX_CONCURRENT_DEFAULT,
  MAX_CONCURRENT_FLOOR,
  type GlobeLike,
} from "./arcEngine.js";
import { createImpactAudio } from "./audio.js";
import { createCameraDirector } from "./camera.js";
import {
  deletePreset,
  deleteSource,
  getPreset,
  listPresets,
  listSources,
  loadConfig,
  savePresetFromSnapshot,
  saveSourceBookmark,
  setActivePresetId,
} from "./configStore.js";
import {
  mountControls,
  normalizeWsUrl,
  type ConnectionStatus,
  type DashboardCopy,
} from "./controls.js";
import { createDayNight } from "./dayNight.js";
import { mountLegend } from "./legend.js";
import { createStats } from "./stats.js";
import { listThemes, resolveTheme } from "./themes/index.js";
import type { Theme } from "./themes/types.js";
import { formatTickText, mountTickStrip } from "./tickStrip.js";
import { connectGeoEvents } from "./wsClient.js";

const params = new URLSearchParams(window.location.search);
let theme = resolveTheme(params.get("theme"));
let wsUrl = normalizeWsUrl(
  params.get("ws") ??
    `${location.protocol === "https:" ? "wss" : "ws"}://${location.hostname}:8787`,
);
let copy: DashboardCopy = {
  title: params.get("title") ?? "",
  description: params.get("description") ?? "",
};
let maxConcurrent = parseMaxArcs(params.get("maxArcs"));
let audioOn = params.get("audio") === "1";
/** Auto-rotate; ?spin=0 starts pinned. */
let spinOn = params.get("spin") !== "0";
let activePresetId: string | null = null;
let activeSourceId: string | null = null;
let activePlaybook: string | null = null;
/** When a playbook is running, mirror generator profile → theme. */
let followingScenario = false;

/** Source cycle state (preset mode=cycle). */
let cycleUrls: string[] = [];
let cycleIndex = 0;
let cycleTimer: ReturnType<typeof setInterval> | null = null;

const container = document.getElementById("app");
if (!container) throw new Error("#app missing");

const globe = new Globe(container, {
  animateIn: false,
  waitForGlobeReady: false,
})
  .globeImageUrl("/earth-night.jpg")
  .bumpImageUrl("/earth-topology.png")
  .showGlobe(true)
  .showAtmosphere(true)
  .enablePointerInteraction(false)
  .onGlobeReady(() => {
    console.info("[viz] globe ready");
  });

applyGlobeTheme(theme);

const controlsOrbit = globe.controls();
if (controlsOrbit) {
  controlsOrbit.autoRotate = spinOn;
  controlsOrbit.autoRotateSpeed = 0.35;
  controlsOrbit.enableDamping = true;
  controlsOrbit.dampingFactor = 0.08;
}

const camera = createCameraDirector(
  globe as unknown as Parameters<typeof createCameraDirector>[0],
  { ...theme.globe.pointOfView },
);
camera.setSpinEnabled(spinOn);

const dayNight = createDayNight(
  globe as unknown as Parameters<typeof createDayNight>[0],
);
void dayNight.start();

const audio = createImpactAudio();
audio.setEnabled(audioOn);

let engine!: ArcEngine;

const ticks = mountTickStrip({
  onSelect: (item) => {
    if (item.lat === undefined || item.lng === undefined) return;
    engine.flashSink(item.lat, item.lng, item.color);
    camera.punch(item.lat, item.lng, 0.85);
  },
});

engine = new ArcEngine(globe as unknown as GlobeLike, theme, {
  maxConcurrent,
  onAccepted: (info) => {
    ticks.push({
      id: info.id,
      color: info.color,
      text: formatTickText(info.originLabel, info.destLabel, info.magnitude),
      lat: info.dest.lat,
      lng: info.dest.lng,
    });
  },
  onImpact: (info) => {
    const energy =
      (info.magnitude / 100) * 0.55 + info.relativeRank * 0.45;
    if (energy >= 0.55) {
      camera.punch(info.lat, info.lng, energy);
    }
    if (energy >= 0.28) {
      audio.impact(0.35 + energy * 0.65);
    }
  },
});

const stats = createStats(() => engine.getLiveCount());
const legend = mountLegend();

const panel = mountControls(
  listThemes(),
  {
    themeId: theme.id,
    sourceUrl: wsUrl,
    title: copy.title,
    description: copy.description,
    maxConcurrent,
    maxConcurrentMin: MAX_CONCURRENT_FLOOR,
    maxConcurrentMax: MAX_CONCURRENT_CEILING,
    audioEnabled: audioOn,
    spinEnabled: spinOn,
  },
  {
    onThemeChange: (id) => setTheme(id, { driveGenerator: true }),
    onSourceChange: (url) => setSource(url, { clearCycle: true }),
    onCopyChange: (next) => setCopy(next),
    onMaxConcurrentChange: (n) => setMaxConcurrent(n),
    onAudioChange: (on) => setAudio(on),
    onSpinChange: (on) => setSpin(on),
    onScenarioPlay: (id) => playPlaybook(id),
    onScenarioStop: () => stopPlaybook(),
    onSavePreset: () => handleSavePreset(),
    onLoadPreset: (id) => handleLoadPreset(id),
    onDeletePreset: (id) => handleDeletePreset(id),
    onSaveSource: () => handleSaveSource(),
    onPickSource: (id) => handlePickSource(id),
    onDeleteSource: (id) => handleDeleteSource(id),
  },
);

let client = connectTo(wsUrl);

// Restore last active preset if URL didn't override title/theme heavily
bootstrapFromLibrary();
refreshLibraryUi();

function bootstrapFromLibrary(): void {
  const cfg = loadConfig();
  // URL params win when explicitly set; otherwise restore last preset
  const urlForced =
    params.has("theme") ||
    params.has("ws") ||
    params.has("title") ||
    params.has("preset");
  const presetParam = params.get("preset");
  if (presetParam) {
    const p = getPreset(presetParam, cfg);
    if (p) applyPreset(p, { skipUrlSync: false });
    return;
  }
  if (!urlForced && cfg.activePresetId) {
    const p = getPreset(cfg.activePresetId, cfg);
    if (p) applyPreset(p, { skipUrlSync: false });
  }
}

function refreshLibraryUi(): void {
  const cfg = loadConfig();
  panel.setPresets(
    listPresets(cfg).map((p) => ({ id: p.id, title: p.title })),
    activePresetId,
  );
  panel.setSources(
    listSources(cfg).map((s) => ({ id: s.id, name: s.name, url: s.url })),
    activeSourceId,
  );
}

function handleSavePreset(): void {
  const form = panel.getForm();
  const title = form.title.trim();
  if (!title) {
    panel.setSaveFlash("Add a title first — it names the save");
    panel.open();
    return;
  }
  try {
    // Keep form URL in sync with live connection
    const sourceUrl = normalizeWsUrl(form.sourceUrl || wsUrl);
    if (sourceUrl !== wsUrl) setSource(sourceUrl, { clearCycle: true });

    const { preset, created } = savePresetFromSnapshot(
      {
        title,
        description: form.description,
        theme: theme.id,
        maxConcurrent,
        audio: audioOn,
        spin: spinOn,
        playbook: activePlaybook,
        sourceUrl: wsUrl,
        preferredSourceId: activeSourceId,
      },
      { activePresetId },
    );
    activePresetId = preset.id;
    copy = { title: preset.title, description: preset.description ?? "" };
    panel.setCopy(copy);
    refreshLibraryUi();
    syncUrl();
    panel.setSaveFlash(created ? `Saved “${preset.title}”` : `Updated “${preset.title}”`);
    console.info(`[viz] preset ${created ? "created" : "updated"} ${preset.id}`);
  } catch (err) {
    panel.setSaveFlash(err instanceof Error ? err.message : "Save failed");
  }
}

function handleLoadPreset(id: string): void {
  const p = getPreset(id);
  if (!p) {
    panel.setSaveFlash("Preset not found");
    refreshLibraryUi();
    return;
  }
  applyPreset(p);
  panel.setSaveFlash(`Loaded “${p.title}”`);
}

function handleDeletePreset(id: string): void {
  deletePreset(id);
  if (activePresetId === id) activePresetId = null;
  refreshLibraryUi();
  panel.setSaveFlash("Preset deleted");
}

function handleSaveSource(): void {
  const form = panel.getForm();
  const url = normalizeWsUrl(form.sourceUrl || wsUrl);
  const nameHint = form.title.trim() || undefined;
  const { source, created } = saveSourceBookmark(url, nameHint);
  activeSourceId = source.id;
  if (url !== wsUrl) setSource(url, { clearCycle: true, sourceId: source.id });
  else activeSourceId = source.id;
  refreshLibraryUi();
  panel.setSaveFlash(
    created ? `Pinned “${source.name}”` : `Updated pin “${source.name}”`,
  );
}

function handlePickSource(id: string): void {
  const s = listSources().find((x) => x.id === id);
  if (!s) {
    refreshLibraryUi();
    return;
  }
  setSource(s.url, { clearCycle: true, sourceId: s.id });
}

function handleDeleteSource(id: string): void {
  deleteSource(id);
  if (activeSourceId === id) activeSourceId = null;
  refreshLibraryUi();
  panel.setSaveFlash("Source removed");
}

function applyPreset(
  preset: VizPreset,
  opts: { skipUrlSync?: boolean } = {},
): void {
  stopCycle();
  const h = hydratePreset(preset);
  activePresetId = preset.id;
  setActivePresetId(preset.id);

  copy = { title: h.title, description: h.description };
  panel.setCopy(copy);

  maxConcurrent = parseMaxArcs(String(h.maxConcurrent));
  engine.setMaxConcurrent(maxConcurrent);
  panel.setMaxConcurrent(maxConcurrent);

  setAudio(h.audio, { announce: false });
  setSpin(h.spin);

  // Theme without generator drive until source is up; then playbook/profile
  const nextTheme = resolveTheme(h.theme);
  if (nextTheme.id !== theme.id) {
    theme = nextTheme;
    engine.setTheme(nextTheme);
    applyGlobeTheme(nextTheme);
    camera.setHome({ ...nextTheme.globe.pointOfView });
    panel.setTheme(nextTheme.id);
  }

  const cfg = loadConfig();
  const resolved = resolveSourceUrls(preset.source, cfg.sources);
  if ("error" in resolved) {
    panel.setSaveFlash(resolved.error);
    // Fall back: if mode was url-ish missing, keep current
  } else if (resolved.urls.length === 1) {
    const url = normalizeWsUrl(resolved.urls[0]!);
    if (preset.source.mode === "saved") {
      activeSourceId = preset.source.sourceId;
    } else {
      activeSourceId =
        cfg.sources.find((s) => s.url === url)?.id ?? null;
    }
    setSource(url, { clearCycle: true, sourceId: activeSourceId });
  } else if (resolved.urls.length > 1) {
    startCycle(resolved.urls, resolved.cycleIntervalSec);
  }

  // Playbook after connect
  if (h.playbook) {
    // slight delay so WS is open
    setTimeout(() => playPlaybook(h.playbook!), 400);
  } else if (!followingScenario) {
    client.send({ type: "cmd", cmd: "setProfile", profile: theme.id });
  }

  refreshLibraryUi();
  if (!opts.skipUrlSync) syncUrl();
  console.info(`[viz] applied preset ${preset.id} “${preset.title}”`);
}

function startCycle(urls: string[], intervalSec: number): void {
  stopCycle();
  cycleUrls = urls.map(normalizeWsUrl);
  cycleIndex = 0;
  if (cycleUrls.length === 0) return;
  setSource(cycleUrls[0]!, { clearCycle: false });
  if (cycleUrls.length === 1) return;
  cycleTimer = setInterval(() => {
    cycleIndex = (cycleIndex + 1) % cycleUrls.length;
    const url = cycleUrls[cycleIndex]!;
    console.info(`[viz] cycle → ${url}`);
    setSource(url, { clearCycle: false });
    panel.setSaveFlash(`Cycle ${cycleIndex + 1}/${cycleUrls.length}`);
  }, Math.max(5, intervalSec) * 1000);
}

function stopCycle(): void {
  if (cycleTimer) clearInterval(cycleTimer);
  cycleTimer = null;
  cycleUrls = [];
  cycleIndex = 0;
}

function playPlaybook(id: string): void {
  activePlaybook = id;
  client.send({ type: "cmd", cmd: "playScenario", scenario: id });
}

function stopPlaybook(): void {
  activePlaybook = null;
  client.send({ type: "cmd", cmd: "stopScenario" });
}

function setTheme(
  id: string,
  opts: { driveGenerator?: boolean } = {},
): void {
  const next = resolveTheme(id);
  if (next.id === theme.id) return;
  theme = next;
  engine.setTheme(next);
  applyGlobeTheme(next);
  camera.setHome({ ...next.globe.pointOfView });
  panel.setTheme(next.id);
  if (opts.driveGenerator !== false && !followingScenario) {
    client.send({ type: "cmd", cmd: "setProfile", profile: next.id });
  }
  syncUrl();
  console.info(`[viz] theme=${next.id}`);
}

function setSource(
  url: string,
  opts: { clearCycle?: boolean; sourceId?: string | null } = {},
): void {
  if (opts.clearCycle !== false) stopCycle();
  const next = normalizeWsUrl(url);
  if (opts.sourceId !== undefined) activeSourceId = opts.sourceId;
  panel.setSource(next);
  if (next === wsUrl) {
    refreshLibraryUi();
    return;
  }
  wsUrl = next;
  syncUrl();
  reconnect(next);
  refreshLibraryUi();
  console.info(`[viz] source=${next}`);
}

function setCopy(next: DashboardCopy): void {
  copy = {
    title: next.title.trim(),
    description: next.description.trim(),
  };
  syncUrl();
}

function setMaxConcurrent(n: number): void {
  maxConcurrent = parseMaxArcs(String(n));
  engine.setMaxConcurrent(maxConcurrent);
  panel.setMaxConcurrent(engine.getMaxConcurrent());
  maxConcurrent = engine.getMaxConcurrent();
  syncUrl();
  console.info(`[viz] maxArcs=${maxConcurrent}`);
}

function setAudio(on: boolean, opts: { announce?: boolean } = {}): void {
  const was = audioOn;
  audioOn = on;
  audio.setEnabled(on);
  panel.setAudio(on);
  // Only thud when the user turns audio on (not when loading a preset)
  if (on && !was && opts.announce !== false) audio.impact(0.7);
  syncUrl();
}

function setSpin(on: boolean): void {
  spinOn = on;
  camera.setSpinEnabled(on);
  panel.setSpin(on);
  syncUrl();
  console.info(`[viz] spin=${on ? "on" : "off"}`);
}

function reconnect(url: string): void {
  client.close();
  engine.clear();
  client = connectTo(url);
}

function connectTo(url: string) {
  panel.setStatus("connecting");
  return connectGeoEvents(url, {
    onEvent: (event) => engine.ingest(event),
    onStatus: (status) => {
      const mapped: ConnectionStatus =
        status === "open"
          ? "open"
          : status === "connecting"
            ? "connecting"
            : "closed";
      panel.setStatus(mapped);
      if (status === "open") console.info(`[viz] connected ${url}`);
      if (status === "closed") console.info("[viz] disconnected, reconnecting…");
    },
    onGeneratorStatus: (st) => {
      followingScenario = Boolean(st.scenario);
      activePlaybook = st.scenario;
      panel.setScenarios(st.scenarios, st.scenario);
      panel.setGeneratorMeta({
        profile: st.profile,
        rate: st.rate,
        step: st.step,
        scenario: st.scenario,
      });
      if (st.scenario && st.profile && st.profile !== theme.id) {
        setTheme(st.profile, { driveGenerator: false });
      }
    },
  });
}

function applyGlobeTheme(t: Theme): void {
  globe
    .backgroundColor(t.globe.backgroundColor)
    .atmosphereColor(t.globe.atmosphereColor)
    .atmosphereAltitude(t.globe.atmosphereAltitude)
    .pointOfView(t.globe.pointOfView, 800);
}

function parseMaxArcs(raw: string | null): number {
  if (raw === null || raw === "") return MAX_CONCURRENT_DEFAULT;
  const n = Number(raw);
  if (!Number.isFinite(n)) return MAX_CONCURRENT_DEFAULT;
  return Math.min(
    MAX_CONCURRENT_CEILING,
    Math.max(MAX_CONCURRENT_FLOOR, Math.round(n)),
  );
}

function syncUrl(): void {
  const url = new URL(window.location.href);
  url.searchParams.set("theme", theme.id);
  url.searchParams.set("ws", wsUrl);
  url.searchParams.set("maxArcs", String(maxConcurrent));
  if (audioOn) url.searchParams.set("audio", "1");
  else url.searchParams.delete("audio");
  if (!spinOn) url.searchParams.set("spin", "0");
  else url.searchParams.delete("spin");
  if (copy.title) url.searchParams.set("title", copy.title);
  else url.searchParams.delete("title");
  if (copy.description) url.searchParams.set("description", copy.description);
  else url.searchParams.delete("description");
  if (activePresetId) url.searchParams.set("preset", activePresetId);
  else url.searchParams.delete("preset");
  history.replaceState(null, "", url);
}

(window as unknown as { __viz: unknown }).__viz = {
  globe,
  engine,
  camera,
  audio,
  get theme() {
    return theme;
  },
  get wsUrl() {
    return wsUrl;
  },
  get copy() {
    return copy;
  },
  get maxConcurrent() {
    return maxConcurrent;
  },
  get activePresetId() {
    return activePresetId;
  },
  setTheme,
  setSource,
  setCopy,
  setMaxConcurrent,
  setAudio,
  setSpin,
  savePreset: handleSavePreset,
  loadPreset: handleLoadPreset,
};

function resize(): void {
  globe.width(window.innerWidth).height(window.innerHeight);
}
window.addEventListener("resize", resize);
resize();

window.addEventListener("keydown", (e) => {
  if (e.code !== "Space" && e.key !== " ") return;
  const t = e.target as HTMLElement | null;
  if (
    t &&
    (t.tagName === "INPUT" ||
      t.tagName === "TEXTAREA" ||
      t.tagName === "SELECT" ||
      t.isContentEditable)
  ) {
    return;
  }
  e.preventDefault();
  setSpin(!spinOn);
});

window.addEventListener("beforeunload", () => {
  stopCycle();
  client.close();
  engine.dispose();
  panel.destroy();
  ticks.destroy();
  stats.destroy();
  legend.destroy();
  camera.dispose();
  dayNight.dispose();
});

syncUrl();
console.info(
  `[viz] theme=${theme.id}  ws=${wsUrl}  maxArcs=${maxConcurrent}  audio=${audioOn ? "on" : "off"}  spin=${spinOn ? "on" : "off"}`,
);
