import type { GeoEvent } from "@vizzy/contracts";
import { GEO_EVENT_DEFAULTS, scaleOrDefault } from "@vizzy/contracts";
import { greatCircleKm, lonLat } from "./geo.js";
import type { Theme, VisualParams } from "./themes/types.js";

export const MAX_CONCURRENT_FLOOR = 10;
export const MAX_CONCURRENT_CEILING = 500;
export const MAX_CONCURRENT_DEFAULT = 200;

export type ArcDatum = {
  id: string;
  startLat: number;
  startLng: number;
  endLat: number;
  endLng: number;
  color: string;
  /** Gradient tip — brighter head for "missile/packet" read. */
  tipColor: string;
  stroke: number;
  altitude: number;
  flightMs: number;
  priority: number;
  magnitude: number;
  addedAt: number;
};

export type PathDatum = {
  id: string;
  coords: { lat: number; lng: number; alt?: number }[];
  color: string;
  expiresAt: number;
};

export type RingDatum = {
  id: string;
  lat: number;
  lng: number;
  maxR: number;
  color: string;
  propagationSpeed: number;
  repeatPeriod: number;
  expiresAt: number;
};

/** Rendered point on the globe (derived from sink energy). */
export type GlowDatum = {
  id: string;
  lat: number;
  lng: number;
  color: string;
  radius: number;
  altitude: number;
};

/**
 * Aggregated heat at a location (source or sink).
 * Energy stacks on hits and decays exponentially over time.
 */
type HeatNode = {
  key: string;
  kind: "source" | "sink";
  lat: number;
  lng: number;
  /** Unbounded-ish heat; soft-capped on deposit. */
  energy: number;
  /** Last hit RGB components for color blending. */
  r: number;
  g: number;
  b: number;
  lastHitAt: number;
};

export type AcceptedEventInfo = {
  id: string;
  originLabel: string;
  destLabel: string;
  priority: number;
  magnitude: number;
  color: string;
  origin: { lat: number; lng: number };
  dest: { lat: number; lng: number };
  correlationId?: string;
};

export type ImpactInfo = {
  id: string;
  lat: number;
  lng: number;
  magnitude: number;
  priority: number;
  color: string;
  /** 0–1 relative to current live arcs (top of set). */
  relativeRank: number;
};

export type ArcEngineOptions = {
  maxConcurrent?: number;
  onAccepted?: (info: AcceptedEventInfo) => void;
  onImpact?: (info: ImpactInfo) => void;
  onRejected?: (reason: "capacity") => void;
};

/** Minimal globe.gl surface used by the engine (chainable setters). */
export type GlobeLike = {
  arcsData: (data?: ArcDatum[]) => GlobeLike;
  ringsData: (data?: RingDatum[]) => GlobeLike;
  pointsData: (data?: GlowDatum[]) => GlobeLike;
  pathsData: (data?: PathDatum[]) => GlobeLike;
  arcColor: (
    fn: string | ((d: ArcDatum) => string | string[]),
  ) => GlobeLike;
  arcStroke: (fn: string | number | ((d: ArcDatum) => number)) => GlobeLike;
  arcAltitude: (fn: string | number | ((d: ArcDatum) => number)) => GlobeLike;
  arcDashLength: (v: number) => GlobeLike;
  arcDashGap: (v: number) => GlobeLike;
  arcDashInitialGap: (fn: number | ((d: ArcDatum) => number)) => GlobeLike;
  arcDashAnimateTime: (fn: number | ((d: ArcDatum) => number)) => GlobeLike;
  arcsTransitionDuration: (ms: number) => GlobeLike;
  ringColor: (
    fn: string | ((d: RingDatum) => string | string[] | ((t: number) => string)),
  ) => GlobeLike;
  ringMaxRadius: (fn: string | number | ((d: RingDatum) => number)) => GlobeLike;
  ringPropagationSpeed: (
    fn: string | number | ((d: RingDatum) => number),
  ) => GlobeLike;
  ringRepeatPeriod: (
    fn: string | number | ((d: RingDatum) => number),
  ) => GlobeLike;
  pointLat: (fn: string | ((d: GlowDatum) => number)) => GlobeLike;
  pointLng: (fn: string | ((d: GlowDatum) => number)) => GlobeLike;
  pointColor: (fn: string | ((d: GlowDatum) => string)) => GlobeLike;
  pointAltitude: (fn: string | number | ((d: GlowDatum) => number)) => GlobeLike;
  pointRadius: (fn: string | number | ((d: GlowDatum) => number)) => GlobeLike;
  pointsMerge: (merge: boolean) => GlobeLike;
  pointsTransitionDuration: (ms: number) => GlobeLike;
  pathPoints: (fn: string | ((d: PathDatum) => unknown)) => GlobeLike;
  pathPointLat: (fn: string | ((p: { lat: number }) => number)) => GlobeLike;
  pathPointLng: (fn: string | ((p: { lng: number }) => number)) => GlobeLike;
  pathPointAlt: (fn: string | number | ((p: { alt?: number }) => number)) => GlobeLike;
  pathColor: (fn: string | ((d: PathDatum) => string | string[])) => GlobeLike;
  pathStroke: (fn: string | number | ((d: PathDatum) => number)) => GlobeLike;
  pathDashLength: (v: number) => GlobeLike;
  pathDashGap: (v: number) => GlobeLike;
  pathDashAnimateTime: (v: number) => GlobeLike;
  pathTransitionDuration: (ms: number) => GlobeLike;
};

/** Exponential half-life: sinks linger; sources fade faster. */
const SINK_HALF_LIFE_MS = 14_000;
const SOURCE_HALF_LIFE_MS = 6_000;
/** Drop node when energy falls below this. */
const ENERGY_FLOOR = 0.03;
/** Soft cap so floods don't blow out the globe. */
const ENERGY_CAP = 4;
/** Quantize degrees so hits on the same city stack. ~0.15° ≈ 15km. */
const SINK_GRID_DEG = 0.15;
const HEAT_TICK_MS = 80;
const MAX_HEAT_NODES = 350;

function clampConcurrent(n: number): number {
  if (!Number.isFinite(n)) return MAX_CONCURRENT_DEFAULT;
  return Math.min(
    MAX_CONCURRENT_CEILING,
    Math.max(MAX_CONCURRENT_FLOOR, Math.round(n)),
  );
}

export class ArcEngine {
  private readonly globe: GlobeLike;
  private theme: Theme;
  private maxConcurrent: number;
  private readonly onAccepted?: (info: AcceptedEventInfo) => void;
  private readonly onImpact?: (info: ImpactInfo) => void;
  private readonly onRejected?: (reason: "capacity") => void;

  private arcs: ArcDatum[] = [];
  private rings: RingDatum[] = [];
  private paths: PathDatum[] = [];
  private readonly heat = new Map<string, HeatNode>();
  /** Last landing per correlationId for multi-hop ghost trails. */
  private readonly corrLast = new Map<
    string,
    { lat: number; lng: number; color: string }
  >();
  private readonly timers = new Map<string, ReturnType<typeof setTimeout>[]>();
  private heatTick: ReturnType<typeof setInterval> | null = null;

  constructor(globe: GlobeLike, theme: Theme, options: ArcEngineOptions = {}) {
    this.globe = globe;
    this.theme = theme;
    this.maxConcurrent = clampConcurrent(
      options.maxConcurrent ?? MAX_CONCURRENT_DEFAULT,
    );
    this.onAccepted = options.onAccepted;
    this.onImpact = options.onImpact;
    this.onRejected = options.onRejected;

    // Match globe.gl emit-arcs pattern: dashed flight, gap > 1 so one dash is visible.
    // Gradient color = brighter arc tip (head).
    // No arcStroke → Line2 hairlines (setting stroke forces fat TubeGeometry)
    globe
      .arcsData([])
      .arcColor((d) => [d.color, d.tipColor])
      .arcAltitude((d) => d.altitude)
      .arcDashLength(0.35)
      .arcDashGap(2)
      .arcDashInitialGap(1)
      .arcDashAnimateTime((d) => d.flightMs)
      .arcsTransitionDuration(0)
      .ringsData([])
      .ringColor((d) => {
        const c = d.color;
        return (t: number) => {
          if (c.startsWith("rgb(")) {
            return c.replace("rgb(", "rgba(").replace(")", `,${1 - t})`);
          }
          if (c.startsWith("rgba(")) {
            return c.replace(/,\s*[\d.]+\)$/, `,${1 - t})`);
          }
          return c;
        };
      })
      .ringMaxRadius((d) => d.maxR)
      .ringPropagationSpeed((d) => d.propagationSpeed)
      .ringRepeatPeriod((d) => d.repeatPeriod)
      .pointsData([])
      .pointLat("lat")
      .pointLng("lng")
      .pointColor("color")
      .pointAltitude((d) => d.altitude)
      .pointRadius((d) => d.radius)
      .pointsMerge(false)
      .pointsTransitionDuration(0)
      .pathsData([])
      .pathPoints("coords")
      .pathPointLat("lat")
      .pathPointLng("lng")
      .pathPointAlt((p) => p.alt ?? 0.05)
      .pathColor((d) => d.color)
      .pathStroke(0.4)
      .pathDashLength(0.08)
      .pathDashGap(0.05)
      .pathDashAnimateTime(4000)
      .pathTransitionDuration(0);

    this.heatTick = setInterval(() => this.tickHeat(), HEAT_TICK_MS);
  }

  ingest(event: GeoEvent): void {
    const distanceKm = greatCircleKm(event.origin, event.destination);
    const visuals = this.theme.mapEvent(event, { distanceKm });
    const priority = scaleOrDefault(
      event.priority,
      GEO_EVENT_DEFAULTS.priority,
    );
    const magnitude = scaleOrDefault(
      event.magnitude,
      GEO_EVENT_DEFAULTS.magnitude,
    );

    // Relative concurrency: only the highest-priority N arcs stay live.
    if (!this.admit(priority)) {
      this.onRejected?.("capacity");
      return;
    }

    const origin = lonLat(event.origin);
    const dest = lonLat(event.destination);
    const now = performance.now();

    const tipColor = brighten(visuals.arcColor, 0.45);

    // Correlation ghost trail — register on accept (not impact) so rapid
    // multi-hop chains still link even when follow-ups emit before landing.
    if (event.correlationId) {
      const prev = this.corrLast.get(event.correlationId);
      if (prev) {
        this.spawnPath({
          id: `${event.id}-corr`,
          coords: [
            { lat: prev.lat, lng: prev.lng, alt: 0.05 },
            { lat: origin.lat, lng: origin.lng, alt: 0.08 },
            { lat: dest.lat, lng: dest.lng, alt: 0.12 },
          ],
          color: "rgba(255,255,255,0.28)",
          ttlMs: visuals.flightMs + 3200,
        });
      }
      this.corrLast.set(event.correlationId, {
        lat: dest.lat,
        lng: dest.lng,
        color: visuals.arcColor,
      });
    }

    const arc: ArcDatum = {
      id: event.id,
      startLat: origin.lat,
      startLng: origin.lng,
      endLat: dest.lat,
      endLng: dest.lng,
      color: visuals.arcColor,
      tipColor,
      stroke: visuals.arcStroke,
      altitude: visuals.arcAltitude,
      flightMs: visuals.flightMs,
      priority,
      magnitude,
      addedAt: now,
    };

    this.arcs = [...this.arcs, arc];
    this.pushArcs();

    const originLabel = cityLabel(event, "origin", origin);
    const destLabel = cityLabel(event, "destination", dest);

    this.onAccepted?.({
      id: event.id,
      originLabel,
      destLabel,
      priority,
      magnitude,
      color: visuals.arcColor,
      origin,
      dest,
      correlationId: event.correlationId,
    });

    // Launch ring at origin
    this.spawnRing({
      id: `${event.id}-launch`,
      lat: origin.lat,
      lng: origin.lng,
      maxR: visuals.impactRadius * 0.45,
      color: visuals.arcColor,
      propagationSpeed: 2.5 + visuals.glow * 2,
      repeatPeriod: 100_000,
      ttlMs: visuals.launchMs,
    });

    // Source heat (weaker, faster decay)
    this.depositHeat("source", origin.lat, origin.lng, magnitude * 0.45, visuals.arcColor);

    const flightTimers: ReturnType<typeof setTimeout>[] = [];

    flightTimers.push(
      setTimeout(() => {
        this.spawnRing({
          id: `${event.id}-impact`,
          lat: dest.lat,
          lng: dest.lng,
          maxR: visuals.impactRadius,
          color: visuals.arcColor,
          propagationSpeed: 1.8 + visuals.glow,
          repeatPeriod: 100_000,
          ttlMs: visuals.impactMs,
        });
        // Sink heat — stacks + exponential decay (the map "remembers")
        this.depositHeat("sink", dest.lat, dest.lng, magnitude, visuals.arcColor);

        const relativeRank = this.relativeRank(priority);
        this.onImpact?.({
          id: event.id,
          lat: dest.lat,
          lng: dest.lng,
          magnitude,
          priority,
          color: visuals.arcColor,
          relativeRank,
        });
      }, visuals.flightMs),
    );

    const lifetime = visuals.flightMs + Math.max(400, visuals.impactMs * 0.5);
    flightTimers.push(
      setTimeout(() => {
        this.removeArc(event.id);
      }, lifetime),
    );

    this.timers.set(event.id, flightTimers);
  }

  setMaxConcurrent(n: number): void {
    this.maxConcurrent = clampConcurrent(n);
    // Evict lowest until under cap
    while (this.arcs.length > this.maxConcurrent) {
      const victim = this.findLowestPriorityArc();
      if (!victim) break;
      this.removeArc(victim.id);
    }
  }

  getMaxConcurrent(): number {
    return this.maxConcurrent;
  }

  getLiveCount(): number {
    return this.arcs.length;
  }

  /** Flash a sink (e.g. tick click) — heat deposit + ring. */
  flashSink(lat: number, lng: number, color = "rgb(255,200,120)"): void {
    this.depositHeat("sink", lat, lng, 90, color);
    this.spawnRing({
      id: `flash-${performance.now()}`,
      lat,
      lng,
      maxR: 3.5,
      color,
      propagationSpeed: 3.5,
      repeatPeriod: 100_000,
      ttlMs: 900,
    });
  }

  /** Swap theme; clears in-flight visuals so the new look takes over cleanly. */
  setTheme(theme: Theme): void {
    this.theme = theme;
    this.clear();
  }

  getTheme(): Theme {
    return this.theme;
  }

  clear(): void {
    for (const list of this.timers.values()) {
      for (const t of list) clearTimeout(t);
    }
    this.timers.clear();
    this.arcs = [];
    this.rings = [];
    this.paths = [];
    this.heat.clear();
    this.corrLast.clear();
    this.pushArcs();
    this.pushRings();
    this.pushPaths();
    this.pushHeat();
  }

  dispose(): void {
    if (this.heatTick) clearInterval(this.heatTick);
    this.heatTick = null;
    this.clear();
  }

  /**
   * Admit if under capacity, or if incoming outranks the current lowest.
   * Reject if at capacity and not competitive — keeps the live set as top-N by priority.
   */
  private admit(incomingPriority: number): boolean {
    if (this.arcs.length < this.maxConcurrent) return true;

    const victim = this.findLowestPriorityArc();
    if (!victim) return true;

    if (incomingPriority < victim.priority) return false;
    if (
      incomingPriority === victim.priority &&
      // Prefer keeping existing when equal priority
      true
    ) {
      return false;
    }

    this.removeArc(victim.id);
    return true;
  }

  private findLowestPriorityArc(): ArcDatum | null {
    if (this.arcs.length === 0) return null;
    let victim = this.arcs[0]!;
    for (let i = 1; i < this.arcs.length; i++) {
      const a = this.arcs[i]!;
      if (
        a.priority < victim.priority ||
        (a.priority === victim.priority && a.addedAt < victim.addedAt)
      ) {
        victim = a;
      }
    }
    return victim;
  }

  private removeArc(id: string): void {
    const timers = this.timers.get(id);
    if (timers) {
      for (const t of timers) clearTimeout(t);
      this.timers.delete(id);
    }
    this.arcs = this.arcs.filter((a) => a.id !== id);
    this.pushArcs();
  }

  /** 1 = highest priority among live arcs, 0 = lowest. */
  private relativeRank(priority: number): number {
    if (this.arcs.length <= 1) return 1;
    let lo = Infinity;
    let hi = -Infinity;
    for (const a of this.arcs) {
      if (a.priority < lo) lo = a.priority;
      if (a.priority > hi) hi = a.priority;
    }
    if (hi <= lo) return 1;
    return (priority - lo) / (hi - lo);
  }

  private spawnPath(path: Omit<PathDatum, "expiresAt"> & { ttlMs: number }): void {
    const expiresAt = performance.now() + path.ttlMs;
    this.paths = [
      ...this.paths.filter((p) => p.id !== path.id),
      {
        id: path.id,
        coords: path.coords,
        color: path.color,
        expiresAt,
      },
    ];
    this.pushPaths();
    setTimeout(() => {
      this.paths = this.paths.filter((p) => p.id !== path.id);
      this.pushPaths();
    }, path.ttlMs + 50);
  }

  private spawnRing(
    ring: Omit<RingDatum, "expiresAt"> & { ttlMs: number },
  ): void {
    const expiresAt = performance.now() + ring.ttlMs;
    const datum: RingDatum = {
      id: ring.id,
      lat: ring.lat,
      lng: ring.lng,
      maxR: ring.maxR,
      color: ring.color,
      propagationSpeed: ring.propagationSpeed,
      repeatPeriod: ring.repeatPeriod,
      expiresAt,
    };
    this.rings = [...this.rings, datum];
    this.pushRings();

    setTimeout(() => {
      this.rings = this.rings.filter((r) => r.id !== ring.id);
      this.pushRings();
    }, ring.ttlMs + 50);
  }

  /**
   * Deposit heat at a source/sink. Same grid cell stacks energy;
   * continuous exponential decay runs on the heat tick.
   *
   *   energy(t) = energy0 * 2^(-t / halfLife)
   *
   * Deposit size scales with magnitude; soft-capped so floods don't blow out.
   */
  private depositHeat(
    kind: "source" | "sink",
    lat: number,
    lng: number,
    magnitude: number,
    color: string,
  ): void {
    const key = heatKey(kind, lat, lng);
    const now = performance.now();
    const rgb = parseRgb(color);
    // 0.25..1.0 per hit; sinks get full weight, sources already scaled by caller
    const deposit = 0.25 + (Math.min(100, Math.max(0, magnitude)) / 100) * 0.75;

    const existing = this.heat.get(key);
    if (existing) {
      // Decay to "now" before stacking so timing is continuous
      decayNode(existing, now);
      existing.energy = Math.min(ENERGY_CAP, existing.energy + deposit);
      // Blend color toward latest hit
      const w = deposit / (existing.energy + 1e-6);
      existing.r = existing.r * (1 - w) + rgb.r * w;
      existing.g = existing.g * (1 - w) + rgb.g * w;
      existing.b = existing.b * (1 - w) + rgb.b * w;
      // Nudge lat/lng toward latest hit (stable centroid-ish)
      existing.lat = existing.lat * 0.85 + lat * 0.15;
      existing.lng = existing.lng * 0.85 + lng * 0.15;
      existing.lastHitAt = now;
    } else {
      this.heat.set(key, {
        key,
        kind,
        lat,
        lng,
        energy: Math.min(ENERGY_CAP, deposit),
        r: rgb.r,
        g: rgb.g,
        b: rgb.b,
        lastHitAt: now,
      });
    }

    // Cap node count: drop coldest
    if (this.heat.size > MAX_HEAT_NODES) {
      let coldest: HeatNode | null = null;
      for (const n of this.heat.values()) {
        if (!coldest || n.energy < coldest.energy) coldest = n;
      }
      if (coldest) this.heat.delete(coldest.key);
    }

    this.pushHeat();
  }

  private tickHeat(): void {
    const now = performance.now();
    let dirty = false;
    for (const [key, node] of this.heat) {
      const before = node.energy;
      decayNode(node, now);
      if (node.energy < ENERGY_FLOOR) {
        this.heat.delete(key);
        dirty = true;
      } else if (node.energy !== before) {
        dirty = true;
      }
    }
    if (dirty || this.heat.size > 0) this.pushHeat();
  }

  private pushArcs(): void {
    this.globe.arcsData(this.arcs);
  }

  private pushRings(): void {
    const now = performance.now();
    this.rings = this.rings.filter((r) => r.expiresAt > now);
    this.globe.ringsData(this.rings);
  }

  private pushPaths(): void {
    const now = performance.now();
    this.paths = this.paths.filter((p) => p.expiresAt > now);
    this.globe.pathsData(this.paths);
  }

  private pushHeat(): void {
    const points: GlowDatum[] = [];
    for (const node of this.heat.values()) {
      // Soft normalize energy → 0..1 for visuals
      const t = node.energy / (1 + node.energy);
      // Ease: stay bright early, then fall off (ease-out cubic on remaining heat)
      const visual = t * t * (3 - 2 * t); // smoothstep
      const isSink = node.kind === "sink";
      const radius =
        (isSink ? 0.18 : 0.1) + visual * (isSink ? 0.95 : 0.45);
      const altitude = 0.008 + visual * (isSink ? 0.02 : 0.012);
      // Alpha decays with energy — sinks stay more opaque longer
      const alpha = Math.min(1, (isSink ? 0.15 : 0.08) + visual * (isSink ? 0.85 : 0.55));
      points.push({
        id: node.key,
        lat: node.lat,
        lng: node.lng,
        color: `rgba(${Math.round(node.r)},${Math.round(node.g)},${Math.round(node.b)},${alpha.toFixed(3)})`,
        radius,
        altitude,
      });
    }
    this.globe.pointsData(points);
  }
}

/** Grid key so nearby hits share a sink/source node. */
function heatKey(kind: "source" | "sink", lat: number, lng: number): string {
  const qLat = Math.round(lat / SINK_GRID_DEG) * SINK_GRID_DEG;
  const qLng = Math.round(lng / SINK_GRID_DEG) * SINK_GRID_DEG;
  return `${kind}:${qLat.toFixed(3)},${qLng.toFixed(3)}`;
}

/** Continuous exponential decay to `now`. */
function decayNode(node: HeatNode, now: number): void {
  const dt = Math.max(0, now - node.lastHitAt);
  if (dt <= 0) return;
  const halfLife =
    node.kind === "sink" ? SINK_HALF_LIFE_MS : SOURCE_HALF_LIFE_MS;
  // energy *= 2^(-dt / halfLife)
  const factor = Math.pow(2, -dt / halfLife);
  node.energy *= factor;
  node.lastHitAt = now;
}

function parseRgb(color: string): { r: number; g: number; b: number } {
  const m = color.match(
    /rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)/i,
  );
  if (m) {
    return {
      r: Number(m[1]),
      g: Number(m[2]),
      b: Number(m[3]),
    };
  }
  // fallback amber
  return { r: 255, g: 160, b: 60 };
}

/** Mix toward white for arc tip / head. */
function brighten(color: string, amount: number): string {
  const { r, g, b } = parseRgb(color);
  const t = Math.min(1, Math.max(0, amount));
  return `rgb(${Math.round(r + (255 - r) * t)},${Math.round(g + (255 - g) * t)},${Math.round(b + (255 - b) * t)})`;
}

function cityLabel(
  event: GeoEvent,
  which: "origin" | "destination",
  coords: { lat: number; lng: number },
): string {
  const meta = event.metadata;
  if (meta && typeof meta === "object") {
    const key = which === "origin" ? "originCity" : "destinationCity";
    const v = (meta as Record<string, unknown>)[key];
    if (typeof v === "string" && v.length > 0) return v;
  }
  return `${coords.lat.toFixed(1)}°, ${coords.lng.toFixed(1)}°`;
}

export type { VisualParams };
