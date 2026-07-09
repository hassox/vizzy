import { GEO_EVENT_DEFAULTS, scaleOrDefault } from "@vizzy/contracts";
import { flightMsFrom } from "./timing.js";
import type { Theme, VisualParams } from "./types.js";

function lerpColor(priority: number): string {
  // Low priority: deep amber; high: bright ember / near-white core
  const t = priority / 100;
  const r = Math.round(180 + t * 75);
  const g = Math.round(70 + t * 90);
  const b = Math.round(20 + t * 40);
  return `rgb(${r},${g},${b})`;
}

export const emberTheme: Theme = {
  id: "ember",
  label: "Ember",
  globe: {
    backgroundColor: "#02040a",
    atmosphereColor: "#c4783a",
    atmosphereAltitude: 0.18,
    pointOfView: { lat: 18, lng: 10, altitude: 2.15 },
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
      arcColor: lerpColor(priority),
      // globe.gl stroke is in world units — keep hairline–medium
      arcStroke: 0.12 + (magnitude / 100) * 0.35,
      arcAltitude: 0.15 + (magnitude / 100) * 0.35,
      flightMs: flightMsFrom(ctx.distanceKm, velocity, 4200, 1800, 9000),
      launchMs: 400 + priority * 2,
      impactMs: 600 + magnitude * 5,
      impactRadius: 1.2 + (magnitude / 100) * 4,
      glow: priority / 100,
    };
  },
};
