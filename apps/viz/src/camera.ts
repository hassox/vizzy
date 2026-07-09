export type CameraGlobe = {
  pointOfView: (
    pov?: { lat?: number; lng?: number; altitude?: number },
    ms?: number,
  ) => { lat: number; lng: number; altitude: number } | unknown;
  controls: () => {
    autoRotate: boolean;
    autoRotateSpeed: number;
  } | null;
};

/**
 * Brief damped look-at for high-impact events.
 * When spin is off (pinned), never re-enables auto-rotate and restores
 * to the view the user had — not theme home.
 */
export function createCameraDirector(
  globe: CameraGlobe,
  home: { lat: number; lng: number; altitude: number },
) {
  let cooldownUntil = 0;
  let restoreTimer: ReturnType<typeof setTimeout> | null = null;
  /** User wants the globe to stay put. */
  let spinEnabled = true;

  function punch(lat: number, lng: number, intensity = 1): void {
    const now = performance.now();
    if (now < cooldownUntil) return;
    cooldownUntil = now + 2800;

    const controls = globe.controls();
    if (controls) controls.autoRotate = false;

    // Capture where we were so a pinned view can return there
    const before = globe.pointOfView() as {
      lat: number;
      lng: number;
      altitude: number;
    };
    const returnTo = spinEnabled
      ? home
      : {
          lat: before.lat,
          lng: before.lng,
          altitude: before.altitude,
        };

    const alt = Math.max(1.35, returnTo.altitude - 0.25 * intensity);
    globe.pointOfView({ lat, lng, altitude: alt }, 700);

    if (restoreTimer) clearTimeout(restoreTimer);
    restoreTimer = setTimeout(() => {
      globe.pointOfView(returnTo, spinEnabled ? 1400 : 900);
      if (spinEnabled) {
        setTimeout(() => {
          const c = globe.controls();
          if (c) c.autoRotate = true;
        }, 1450);
      }
    }, 1100);
  }

  function setHome(next: { lat: number; lng: number; altitude: number }): void {
    home = next;
  }

  function setSpinEnabled(on: boolean): void {
    spinEnabled = on;
    const c = globe.controls();
    if (c) c.autoRotate = on;
    // Cancel in-flight restore that might flip spin back on
    if (!on && restoreTimer) {
      clearTimeout(restoreTimer);
      restoreTimer = null;
    }
  }

  function isSpinEnabled(): boolean {
    return spinEnabled;
  }

  function dispose(): void {
    if (restoreTimer) clearTimeout(restoreTimer);
  }

  return { punch, setHome, setSpinEnabled, isSpinEnabled, dispose };
}
