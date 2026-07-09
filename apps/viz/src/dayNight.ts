/**
 * Soft solar drift on globe.gl's default lighting.
 *
 * Three.js r155+ (physically correct lights) needs ambient ≈ π for a
 * fully lit Phong globe — globe.gl ships AmbientLight(0xcccccc, Math.PI).
 * Replacing those with low intensities blacks out the earth texture.
 */
export function createDayNight(globe: {
  lights: (lights?: unknown[]) => unknown;
}) {
  let raf = 0;
  let running = true;
  let sun: {
    position: { set: (x: number, y: number, z: number) => void };
    intensity: number;
  } | null = null;

  async function start(): Promise<void> {
    try {
      const THREE = await import("three");
      // Match globe.gl factory defaults (see globe.gl stateInit lights)
      const ambient = new THREE.AmbientLight(0xcccccc, Math.PI);
      sun = new THREE.DirectionalLight(0xffffff, 0.6 * Math.PI);
      sun.position.set(1, 1, 1);
      globe.lights([ambient, sun]);

      const tick = () => {
        if (!running || !sun) return;
        // Slow orbit so the terminator drifts (~3 min cycle)
        const t = Date.now() / 1000;
        const angle = (t / 180) * Math.PI * 2;
        sun.position.set(
          Math.cos(angle) * 2,
          0.6 + Math.sin(angle * 0.4) * 0.35,
          Math.sin(angle) * 2,
        );
        raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    } catch (err) {
      console.warn("[viz] day/night lighting unavailable", err);
    }
  }

  function dispose(): void {
    running = false;
    cancelAnimationFrame(raf);
  }

  return { start, dispose };
}
