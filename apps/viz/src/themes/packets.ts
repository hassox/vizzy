import { GEO_EVENT_DEFAULTS, scaleOrDefault } from "@vizzy/contracts";
import { flightMsFrom } from "./timing.js";
import type { Theme, VisualParams } from "./types.js";

/**
 * Network / fiber aesthetic: cool cyan packets, low arcs, tight impacts.
 */
function fiberColor(priority: number): string {
  const t = priority / 100;
  // Dim teal → electric cyan → near-white
  const r = Math.round(20 + t * 160);
  const g = Math.round(140 + t * 100);
  const b = Math.round(180 + t * 75);
  return `rgb(${r},${g},${b})`;
}

export const packetsTheme: Theme = {
  id: "packets",
  label: "Packets",
  globe: {
    backgroundColor: "#02060f",
    atmosphereColor: "#2a6f9e",
    atmosphereAltitude: 0.16,
    pointOfView: { lat: 15, lng: -30, altitude: 2.2 },
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
    const velocity = scaleOrDefault(
      event.velocity,
      GEO_EVENT_DEFAULTS.velocity,
    );

    return {
      arcColor: fiberColor(priority),
      arcStroke: 0.08 + (magnitude / 100) * 0.22,
      // Hop near the surface like fiber routes
      arcAltitude: 0.06 + (magnitude / 100) * 0.14,
      flightMs: flightMsFrom(ctx.distanceKm, velocity, 2200, 600, 5000),
      launchMs: 180 + priority,
      impactMs: 280 + magnitude * 2,
      impactRadius: 0.6 + (magnitude / 100) * 1.8,
      glow: priority / 100,
    };
  },
};
