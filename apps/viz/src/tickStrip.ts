export type TickItem = {
  id: string;
  text: string;
  color: string;
  lat?: number;
  lng?: number;
};

const MAX_TICKS = 5;
const TICK_TTL_MS = 6000;

/** Bottom mono feed of recent accepted events. */
export function mountTickStrip(handlers?: {
  onSelect?: (item: TickItem) => void;
}): {
  push: (item: TickItem) => void;
  destroy: () => void;
} {
  const root = document.createElement("div");
  root.className = "viz-ticks";
  root.setAttribute("aria-live", "polite");
  root.setAttribute("aria-label", "Recent events");
  document.body.appendChild(root);

  const items: {
    item: TickItem;
    el: HTMLElement;
    timer: ReturnType<typeof setTimeout>;
  }[] = [];

  function push(item: TickItem): void {
    const el = document.createElement("div");
    el.className = "viz-ticks__row";
    el.style.setProperty("--tick-color", item.color);
    el.innerHTML = `<span class="viz-ticks__dot"></span><span class="viz-ticks__text"></span>`;
    (el.querySelector(".viz-ticks__text") as HTMLElement).textContent =
      item.text;
    if (item.lat !== undefined && item.lng !== undefined) {
      el.classList.add("viz-ticks__row--clickable");
      el.title = "Focus sink";
      el.addEventListener("click", () => handlers?.onSelect?.(item));
    }
    root.prepend(el);

    requestAnimationFrame(() => el.classList.add("viz-ticks__row--in"));

    const timer = setTimeout(() => remove(item.id), TICK_TTL_MS);
    items.unshift({ item, el, timer });

    while (items.length > MAX_TICKS) {
      const old = items.pop()!;
      clearTimeout(old.timer);
      old.el.remove();
    }
  }

  function remove(id: string): void {
    const idx = items.findIndex((x) => x.item.id === id);
    if (idx < 0) return;
    const [row] = items.splice(idx, 1);
    if (!row) return;
    clearTimeout(row.timer);
    row.el.classList.remove("viz-ticks__row--in");
    row.el.classList.add("viz-ticks__row--out");
    setTimeout(() => row.el.remove(), 280);
  }

  return {
    push,
    destroy() {
      for (const row of items) clearTimeout(row.timer);
      root.remove();
    },
  };
}

export function formatTickText(
  originLabel: string,
  destLabel: string,
  magnitude: number,
): string {
  return `${originLabel} → ${destLabel}  ·  mag ${Math.round(magnitude)}`;
}
