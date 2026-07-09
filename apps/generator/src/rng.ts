/** Mulberry32 — small seeded PRNG for reproducible demos. */
export function createRng(seed: number): () => number {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

export function pick<T>(rng: () => number, items: readonly T[]): T {
  return items[Math.floor(rng() * items.length)]!;
}

/** Skewed 0–100 scale: more mid values, occasional extremes. */
export function skewedScale(rng: () => number): number {
  const u = rng();
  const v = rng();
  // Beta-ish via product; stretch to 0–100
  const x = Math.pow(u, 0.7) * Math.pow(v, 0.5);
  return Math.round(Math.min(100, Math.max(0, x * 120)));
}
