/**
 * Impact thud via Web Audio. Pure oscillators — no assets.
 * Unlocks on user gesture (browser autoplay policy).
 */
export function createImpactAudio() {
  let enabled = false;
  let ctx: AudioContext | null = null;
  let unlockBound = false;

  function getAC(): typeof AudioContext | null {
    return (
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext ||
      null
    );
  }

  function ensure(): AudioContext | null {
    if (!enabled) return null;
    if (!ctx) {
      const AC = getAC();
      if (!AC) return null;
      ctx = new AC();
    }
    if (ctx.state === "suspended") void ctx.resume();
    return ctx;
  }

  function unlock(): void {
    const ac = ensure();
    if (!ac) return;
    // Silent blip to fully unlock some browsers
    if (ac.state === "running") {
      const g = ac.createGain();
      g.gain.value = 0.0001;
      const o = ac.createOscillator();
      o.connect(g);
      g.connect(ac.destination);
      o.start();
      o.stop(ac.currentTime + 0.01);
    }
  }

  function bindUnlockOnce(): void {
    if (unlockBound) return;
    unlockBound = true;
    const go = () => {
      unlock();
      window.removeEventListener("pointerdown", go);
      window.removeEventListener("keydown", go);
    };
    window.addEventListener("pointerdown", go, { once: true });
    window.addEventListener("keydown", go, { once: true });
  }

  function setEnabled(on: boolean): void {
    enabled = on;
    if (on) {
      ensure();
      unlock();
      bindUnlockOnce();
    }
  }

  function isEnabled(): boolean {
    return enabled;
  }

  /** intensity 0–1 — layered click + low thud, actually audible */
  function impact(intensity = 0.5): void {
    const ac = ensure();
    if (!ac) return;
    if (ac.state === "suspended") {
      void ac.resume().then(() => play(ac, intensity));
      return;
    }
    play(ac, intensity);
  }

  function play(ac: AudioContext, intensity: number): void {
    const t = ac.currentTime;
    const i = Math.min(1, Math.max(0.2, intensity));

    // Low body thud
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(110 + i * 50, t);
    osc.frequency.exponentialRampToValueAtTime(45, t + 0.14);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.22 * i, t + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);
    osc.connect(gain);
    gain.connect(ac.destination);
    osc.start(t);
    osc.stop(t + 0.22);

    // Short click transient so it cuts through
    const click = ac.createOscillator();
    const cg = ac.createGain();
    click.type = "triangle";
    click.frequency.setValueAtTime(420 + i * 200, t);
    click.frequency.exponentialRampToValueAtTime(180, t + 0.04);
    cg.gain.setValueAtTime(0.0001, t);
    cg.gain.exponentialRampToValueAtTime(0.08 * i, t + 0.004);
    cg.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
    click.connect(cg);
    cg.connect(ac.destination);
    click.start(t);
    click.stop(t + 0.06);
  }

  return { setEnabled, isEnabled, impact, unlock };
}
