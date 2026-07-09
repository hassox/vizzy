/** Lightweight FPS + live arc counter (bottom-right HUD). */
export function createStats(getLive: () => number) {
  let frames = 0;
  let last = performance.now();
  let fps = 0;
  let raf = 0;
  let running = true;

  const el = document.createElement("div");
  el.className = "viz-stats";
  el.innerHTML = `<span data-fps>—</span> fps · <span data-live>0</span> arcs`;
  document.body.appendChild(el);

  const fpsEl = el.querySelector("[data-fps]") as HTMLElement;
  const liveEl = el.querySelector("[data-live]") as HTMLElement;

  const loop = (now: number) => {
    if (!running) return;
    frames += 1;
    if (now - last >= 500) {
      fps = Math.round((frames * 1000) / (now - last));
      frames = 0;
      last = now;
      fpsEl.textContent = String(fps);
      liveEl.textContent = String(getLive());
    }
    raf = requestAnimationFrame(loop);
  };
  raf = requestAnimationFrame(loop);

  return {
    destroy() {
      running = false;
      cancelAnimationFrame(raf);
      el.remove();
    },
  };
}
