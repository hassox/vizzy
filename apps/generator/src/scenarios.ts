import type { ProfileId } from "./profiles.js";

export type ScenarioStep = {
  /** Seconds from scenario start. */
  at: number;
  rate: number;
  profile: ProfileId;
  label: string;
};

export type Scenario = {
  id: string;
  label: string;
  /** One-line what this playbook does. */
  blurb: string;
  durationSec: number;
  steps: ScenarioStep[];
};

/**
 * Timed playbooks: they drive generator rate + profile over time.
 * The viz mirrors profile → theme so you see + feel each beat.
 */
export const SCENARIOS: Record<string, Scenario> = {
  showcase: {
    id: "showcase",
    label: "Showcase",
    blurb: "90s story: calm → packet flood → missile crisis → cool-down",
    durationSec: 90,
    steps: [
      { at: 0, rate: 1, profile: "ember", label: "Calm open" },
      { at: 10, rate: 6, profile: "packets", label: "Network chatter" },
      { at: 28, rate: 14, profile: "packets", label: "Traffic spike" },
      { at: 45, rate: 3, profile: "nukes", label: "Strategic tension" },
      { at: 58, rate: 9, profile: "nukes", label: "Crisis" },
      { at: 75, rate: 1.5, profile: "ember", label: "Cool-down" },
    ],
  },
  pacific: {
    id: "pacific",
    label: "Pacific",
    blurb: "60s long-haul missile build-up across the Pacific",
    durationSec: 60,
    steps: [
      { at: 0, rate: 1.5, profile: "nukes", label: "Pacific watch" },
      { at: 12, rate: 5, profile: "nukes", label: "Escalation" },
      { at: 30, rate: 11, profile: "nukes", label: "Peak" },
      { at: 48, rate: 2, profile: "ember", label: "Stand down" },
    ],
  },
  blackfriday: {
    id: "blackfriday",
    label: "Black Friday",
    blurb: "45s checkout flood — dense short hops, cyan packets",
    durationSec: 45,
    steps: [
      { at: 0, rate: 5, profile: "packets", label: "Doors open" },
      { at: 8, rate: 16, profile: "packets", label: "Checkout flood" },
      { at: 28, rate: 8, profile: "packets", label: "Steady rush" },
      { at: 38, rate: 2, profile: "ember", label: "Wind down" },
    ],
  },
};

export function resolveScenario(id: string | null | undefined): Scenario | null {
  if (!id) return null;
  return SCENARIOS[id] ?? null;
}

export function listScenarios(): Scenario[] {
  return Object.values(SCENARIOS);
}
