/** Quiet corner legend — how to read the globe. */
export function mountLegend(): { destroy: () => void } {
  const el = document.createElement("div");
  el.className = "viz-legend";
  el.innerHTML = `
    <div class="viz-legend__title">Read</div>
    <div class="viz-legend__row"><span class="viz-legend__swatch viz-legend__swatch--arc"></span> Arc = journey</div>
    <div class="viz-legend__row"><span class="viz-legend__swatch viz-legend__swatch--hot"></span> Color / glow = priority</div>
    <div class="viz-legend__row"><span class="viz-legend__swatch viz-legend__swatch--mag"></span> Impact size = magnitude</div>
    <div class="viz-legend__row"><span class="viz-legend__swatch viz-legend__swatch--heat"></span> Ground glow = heat (decays)</div>
  `;
  document.body.appendChild(el);
  return {
    destroy() {
      el.remove();
    },
  };
}
