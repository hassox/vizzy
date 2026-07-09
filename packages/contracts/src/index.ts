/**
 * Shared Vizzy contracts.
 * Shape source of truth: Rusl dan/schemas/vizzy.* (vendored under schemas/) + SCHEMA.md
 */

export {
  CONFIG_VERSION,
  PRESET_VERSION,
  PRESET_DEFAULTS,
  MAX_CONCURRENT_FLOOR as PRESET_MAX_CONCURRENT_FLOOR,
  MAX_CONCURRENT_CEILING as PRESET_MAX_CONCURRENT_CEILING,
  emptyVizConfig,
  hydratePreset,
  presetLabel,
  isVizConfig,
  isVizPreset,
  isVizSource,
  isSourceBinding,
  resolveSourceUrls,
  type VizConfig,
  type VizPreset,
  type VizSource,
  type SourceBinding,
  type SourceBindingCycle,
  type SourceBindingSaved,
  type SourceBindingUrl,
} from "./config.js";

/** GeoJSON Point — lon-first WGS84, optional altitude (meters convention). */
export type GeoPoint = {
  type: "Point";
  coordinates: [number, number] | [number, number, number];
  bbox?: number[];
};

/** Display-scale defaults when optional fields are omitted. */
export const GEO_EVENT_DEFAULTS = {
  magnitude: 50,
  priority: 50,
  velocity: 50,
} as const;

/**
 * A single geolocated journey. Visual lifecycle (launch → flight → impact)
 * is owned by the visualizer, not this type.
 */
export type GeoEvent = {
  id: string;
  correlationId?: string;
  origin: GeoPoint;
  destination: GeoPoint;
  /** Intrinsic scale 0–100. Default 50. */
  magnitude?: number;
  /** Relative urgency 0–100. Default 50. */
  priority?: number;
  /** Relative travel speed 0–100 (display scale). Default 50. */
  velocity?: number;
  metadata?: Record<string, unknown>;
  /** ISO 8601 when the producer emitted this event. */
  emittedAt: string;
};

export function scaleOrDefault(
  value: number | undefined,
  fallback: number = 50,
): number {
  if (value === undefined || Number.isNaN(value)) return fallback;
  return Math.min(100, Math.max(0, value));
}

export function isGeoPoint(value: unknown): value is GeoPoint {
  if (!value || typeof value !== "object") return false;
  const p = value as GeoPoint;
  if (p.type !== "Point" || !Array.isArray(p.coordinates)) return false;
  const [lon, lat, alt] = p.coordinates;
  if (typeof lon !== "number" || typeof lat !== "number") return false;
  if (lon < -180 || lon > 180 || lat < -90 || lat > 90) return false;
  if (alt !== undefined && typeof alt !== "number") return false;
  return true;
}

export function isGeoEvent(value: unknown): value is GeoEvent {
  if (!value || typeof value !== "object") return false;
  const e = value as GeoEvent;
  if (typeof e.id !== "string" || e.id.length === 0) return false;
  if (typeof e.emittedAt !== "string" || e.emittedAt.length === 0) return false;
  if (!isGeoPoint(e.origin) || !isGeoPoint(e.destination)) return false;
  if (e.correlationId !== undefined && typeof e.correlationId !== "string") {
    return false;
  }
  for (const key of ["magnitude", "priority", "velocity"] as const) {
    const v = e[key];
    if (v !== undefined && (typeof v !== "number" || v < 0 || v > 100)) {
      return false;
    }
  }
  if (e.metadata !== undefined) {
    if (!e.metadata || typeof e.metadata !== "object" || Array.isArray(e.metadata)) {
      return false;
    }
  }
  return true;
}
