import type { GeoEvent } from "@vizzy/contracts";

/** Pure visual params — themes never allocate Three.js objects. */
export type VisualParams = {
  arcColor: string;
  arcStroke: number;
  arcAltitude: number;
  flightMs: number;
  launchMs: number;
  impactMs: number;
  impactRadius: number;
  glow: number;
};

export type ThemeContext = {
  distanceKm: number;
};

export type Theme = {
  id: string;
  label: string;
  /** Globe background / atmosphere hints for the engine. */
  globe: {
    backgroundColor: string;
    atmosphereColor: string;
    atmosphereAltitude: number;
    pointOfView: { lat: number; lng: number; altitude: number };
  };
  mapEvent(event: GeoEvent, ctx: ThemeContext): VisualParams;
};
