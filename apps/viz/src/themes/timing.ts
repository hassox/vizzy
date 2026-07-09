import { clamp } from "../geo.js";

export function velocityFactor(velocity: number): number {
  // 0 → slow (~1.8x duration), 50 → 1x, 100 → fast (~0.35x)
  return clamp(1.8 - (velocity / 100) * 1.45, 0.35, 1.8);
}

export function distanceFactor(km: number): number {
  // Short hops stay visible; long hauls stretch without endless crawls
  const t = clamp(km / 12_000, 0.15, 1.35);
  return 0.55 + t * 0.9;
}

export function flightMsFrom(
  distanceKm: number,
  velocity: number,
  baseMs: number,
  minMs: number,
  maxMs: number,
): number {
  return clamp(
    baseMs * distanceFactor(distanceKm) * velocityFactor(velocity),
    minMs,
    maxMs,
  );
}
