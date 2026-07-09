import { GEO_EVENT_DEFAULTS, scaleOrDefault } from "@vizzy/contracts";
import { flightMsFrom } from "./timing.js";
import type { Theme, VisualParams } from "./types.js";

/**
 * Missile / nuke aesthetic: white-hot trails, toxic green glows,
 * high ballistic arcs, hard launch flash, wide fireball impacts.
 */
function missileColor(priority: number, magnitude: number): string {
  const heat = Math.max(priority, magnitude) / 100;
  // Low: toxic green; mid: amber fire; high: white-hot
  if (heat > 0.75) {
    const t = (heat - 0.75) / 0.25;
    const r = Math.round(255);
    const g = Math.round(220 + t * 35);
    const b = Math.round(120 + t * 100);
    return `rgb(${r},${g},${b})`;
  }
  if (heat > 0.4) {
    const t = (heat - 0.4) / 0.35;
    const r = Math.round(180 + t * 75);
    const g = Math.round(90 + t * 80);
    const b = Math.round(30 + t * 40);
    return `rgb(${r},${g},${b})`;
  }
  const t = heat / 0.4;
  const r = Math.round(40 + t * 100);
  const g = Math.round(180 + t * 40);
  const b = Math.round(60 + t * 20);
  return `rgb(${r},${g},${b})`;
}

export const nukesTheme: Theme = {
  id: "nukes",
  label: "Nukes",
  globe: {
    backgroundColor: "#010308",
    atmosphereColor: "#3d8f4a",
    atmosphereAltitude: 0.22,
    pointOfView: { lat: 28, lng: 20, altitude: 2.05 },
  },
  mapEvent(event, ctx): VisualParams {
    const magnitude = scaleOrDefault(
      event.magnitude,
      GEO_EVENT_DEFAULTS.magnitude,
    );
    const priority = scaleOrDefault(
      event.priority,
      GEO_EVENT_DEFAULTS.priority,
    );
    // Missiles bias faster than raw velocity suggests
    const velocity = Math.min(
      100,
      scaleOrDefault(event.velocity, GEO_EVENT_DEFAULTS.velocity) + 15,
    );

    return {
      arcColor: missileColor(priority, magnitude),
      arcStroke: 0.18 + (magnitude / 100) * 0.45,
      // Ballistic loft — higher than ember
      arcAltitude: 0.28 + (magnitude / 100) * 0.45,
      // Streakier flights
      flightMs: flightMsFrom(ctx.distanceKm, velocity, 2800, 900, 6500),
      launchMs: 220 + priority * 1.5,
      impactMs: 900 + magnitude * 8,
      // Big fireball
      impactRadius: 2.5 + (magnitude / 100) * 7,
      glow: Math.min(1, priority / 80),
    };
  },
};
