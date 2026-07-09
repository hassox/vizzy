import { randomUUID } from "node:crypto";
import {
  isGeoEvent,
  type GeoEvent,
  type GeoPoint,
} from "@vizzy/contracts";
import { CITIES, type City } from "./cities.js";
import { type EmitProfile, resolveProfile } from "./profiles.js";
import { createRng, pick } from "./rng.js";

function point(lon: number, lat: number): GeoPoint {
  return { type: "Point", coordinates: [lon, lat] };
}

function haversineKm(a: City, b: City): number {
  const R = 6371;
  const φ1 = (a.lat * Math.PI) / 180;
  const φ2 = (b.lat * Math.PI) / 180;
  const Δφ = ((b.lat - a.lat) * Math.PI) / 180;
  const Δλ = ((b.lon - a.lon) * Math.PI) / 180;
  const s =
    Math.sin(Δφ / 2) ** 2 +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(s)));
}

/** Skew 0–100 with profile exponent (>1 = more highs). */
function profileScale(rng: () => number, skew: number): number {
  const u = rng();
  const v = rng();
  const x = Math.pow(u * v, 1 / Math.max(0.4, skew));
  return Math.round(Math.min(100, Math.max(0, x * 100)));
}

type PendingHop = {
  correlationId: string;
  from: City;
  hopIndex: number;
  hopsLeft: number;
  magnitude: number;
  priority: number;
  velocity: number;
};

export function createEmitter(seed: number, initialProfile = "ember") {
  const rng = createRng(seed);
  let profile = resolveProfile(initialProfile);
  const pending: PendingHop[] = [];

  function setProfile(id: string): void {
    profile = resolveProfile(id);
  }

  function getProfile(): EmitProfile {
    return profile;
  }

  function pickPair(): { a: City; b: City } {
    // Rejection sampling toward preferred distance
    let bestA = pick(rng, CITIES);
    let bestB = pick(rng, CITIES);
    let bestScore = -Infinity;
    for (let i = 0; i < 12; i++) {
      let a = pick(rng, CITIES);
      let b = pick(rng, CITIES);
      let g = 0;
      while (a.name === b.name && g++ < 6) b = pick(rng, CITIES);
      const km = haversineKm(a, b);
      const norm = Math.min(1, km / 14000);
      // score: prefer long if longHaulBias high, short if low
      const score =
        profile.longHaulBias * norm +
        (1 - profile.longHaulBias) * (1 - norm) +
        rng() * 0.15;
      if (score > bestScore) {
        bestScore = score;
        bestA = a;
        bestB = b;
      }
    }
    return { a: bestA, b: bestB };
  }

  function buildEvent(
    a: City,
    b: City,
    opts: {
      correlationId?: string;
      magnitude?: number;
      priority?: number;
      velocity?: number;
      hopIndex?: number;
    } = {},
  ): GeoEvent {
    const event: GeoEvent = {
      id: randomUUID(),
      correlationId: opts.correlationId,
      origin: point(a.lon, a.lat),
      destination: point(b.lon, b.lat),
      magnitude:
        opts.magnitude ?? profileScale(rng, profile.magnitudeSkew),
      priority: opts.priority ?? profileScale(rng, profile.prioritySkew),
      velocity: opts.velocity ?? profileScale(rng, profile.velocitySkew),
      metadata: {
        originCity: a.name,
        destinationCity: b.name,
        profile: profile.id,
        hopIndex: opts.hopIndex ?? 0,
      },
      emittedAt: new Date().toISOString(),
    };
    if (!isGeoEvent(event)) {
      throw new Error("Generator produced invalid geo-event");
    }
    return event;
  }

  function nextEvent(): GeoEvent {
    // Drain multi-hop queue first
    if (pending.length > 0) {
      const hop = pending.shift()!;
      let next = pick(rng, CITIES);
      let g = 0;
      while (next.name === hop.from.name && g++ < 8) next = pick(rng, CITIES);
      // Prefer continuing long or short based on profile
      if (profile.longHaulBias > 0.5) {
        for (let i = 0; i < 6; i++) {
          const cand = pick(rng, CITIES);
          if (haversineKm(hop.from, cand) > haversineKm(hop.from, next)) {
            next = cand;
          }
        }
      }
      const event = buildEvent(hop.from, next, {
        correlationId: hop.correlationId,
        magnitude: hop.magnitude * (0.85 + rng() * 0.2),
        priority: hop.priority,
        velocity: hop.velocity,
        hopIndex: hop.hopIndex,
      });
      if (hop.hopsLeft > 1) {
        pending.push({
          ...hop,
          from: next,
          hopIndex: hop.hopIndex + 1,
          hopsLeft: hop.hopsLeft - 1,
        });
      }
      return event;
    }

    const { a, b } = pickPair();
    const startChain = rng() < profile.chainChance;
    if (startChain) {
      const correlationId = randomUUID();
      const hops = 1 + Math.floor(rng() * 2); // 1–2 follow-ups
      const magnitude = profileScale(rng, profile.magnitudeSkew);
      const priority = Math.min(
        100,
        profileScale(rng, profile.prioritySkew) + 10,
      );
      const velocity = profileScale(rng, profile.velocitySkew);
      pending.push({
        correlationId,
        from: b,
        hopIndex: 1,
        hopsLeft: hops,
        magnitude,
        priority,
        velocity,
      });
      return buildEvent(a, b, {
        correlationId,
        magnitude,
        priority,
        velocity,
        hopIndex: 0,
      });
    }

    return buildEvent(a, b);
  }

  return { nextEvent, setProfile, getProfile };
}
