export type ProfileId = "ember" | "nukes" | "packets";

export type EmitProfile = {
  id: ProfileId;
  label: string;
  /** Prefer longer great-circle hops (0–1). */
  longHaulBias: number;
  magnitudeSkew: number; // >1 pushes high
  prioritySkew: number;
  velocitySkew: number;
  /** Chance to start a multi-hop correlation chain. */
  chainChance: number;
  defaultRate: number;
};

export const PROFILES: Record<ProfileId, EmitProfile> = {
  ember: {
    id: "ember",
    label: "Ember",
    longHaulBias: 0.35,
    magnitudeSkew: 1,
    prioritySkew: 1,
    velocitySkew: 1,
    chainChance: 0.08,
    defaultRate: 3,
  },
  nukes: {
    id: "nukes",
    label: "Nukes",
    longHaulBias: 0.75,
    magnitudeSkew: 1.45,
    prioritySkew: 1.35,
    velocitySkew: 1.25,
    chainChance: 0.18,
    defaultRate: 2.5,
  },
  packets: {
    id: "packets",
    label: "Packets",
    longHaulBias: 0.12,
    magnitudeSkew: 0.7,
    prioritySkew: 0.85,
    velocitySkew: 1.4,
    chainChance: 0.22,
    defaultRate: 8,
  },
};

export function resolveProfile(id: string | undefined | null): EmitProfile {
  if (id && id in PROFILES) return PROFILES[id as ProfileId]!;
  return PROFILES.ember;
}
