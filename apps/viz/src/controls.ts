import type { Theme } from "./themes/types.js";

export type ConnectionStatus = "connecting" | "open" | "closed" | "error";

export type DashboardCopy = {
  title: string;
  description: string;
};

export type ScenarioOption = { id: string; label: string; blurb?: string };

export type PresetOption = { id: string; title: string };
export type SourceOption = { id: string; name: string; url: string };

export type ControlsHandlers = {
  onThemeChange: (themeId: string) => void;
  onSourceChange: (url: string) => void;
  onCopyChange: (copy: DashboardCopy) => void;
  onMaxConcurrentChange: (n: number) => void;
  onAudioChange?: (enabled: boolean) => void;
  onSpinChange?: (enabled: boolean) => void;
  onScenarioPlay?: (id: string) => void;
  onScenarioStop?: () => void;
  onSavePreset?: () => void;
  onLoadPreset?: (id: string) => void;
  onDeletePreset?: (id: string) => void;
  onSaveSource?: () => void;
  onPickSource?: (id: string) => void;
  onDeleteSource?: (id: string) => void;
};

export type ControlsApi = {
  setTheme: (id: string) => void;
  setSource: (url: string) => void;
  setCopy: (copy: DashboardCopy) => void;
  setMaxConcurrent: (n: number) => void;
  setStatus: (status: ConnectionStatus) => void;
  setAudio: (enabled: boolean) => void;
  setSpin: (enabled: boolean) => void;
  setScenarios: (list: ScenarioOption[], activeId: string | null) => void;
  setPresets: (list: PresetOption[], activeId: string | null) => void;
  setSources: (list: SourceOption[], activeId: string | null) => void;
  setSaveFlash: (msg: string) => void;
  setGeneratorMeta: (meta: {
    profile: string;
    rate: number;
    step?: string | null;
    scenario?: string | null;
  }) => void;
  /** Read live form fields (for save snapshot). */
  getForm: () => {
    title: string;
    description: string;
    sourceUrl: string;
  };
  open: () => void;
  close: () => void;
  destroy: () => void;
};

export type ControlsInitial = {
  themeId: string;
  sourceUrl: string;
  title: string;
  description: string;
  maxConcurrent: number;
  maxConcurrentMin: number;
  maxConcurrentMax: number;
  audioEnabled?: boolean;
  spinEnabled?: boolean;
};

/** Floating settings button + collapsible panel; title/description wall chrome. */
export function mountControls(
  themes: Theme[],
  initial: ControlsInitial,
  handlers: ControlsHandlers,
): ControlsApi {
  const shell = document.createElement("div");
  shell.className = "viz-ui";
  shell.innerHTML = `
    <div class="viz-masthead" aria-live="polite">
      <h1 class="viz-masthead__title"></h1>
      <p class="viz-masthead__desc"></p>
    </div>

    <button
      type="button"
      class="viz-fab"
      id="viz-fab"
      aria-label="Open settings"
      aria-expanded="false"
      aria-controls="viz-panel"
      title="Settings"
    >
      <svg class="viz-fab__icon" viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
        <path fill="currentColor" d="M19.14 12.94c.04-.31.06-.63.06-.94s-.02-.63-.06-.94l2.03-1.58a.5.5 0 0 0 .12-.64l-1.92-3.32a.5.5 0 0 0-.6-.22l-2.39.96a7.03 7.03 0 0 0-1.63-.94l-.36-2.54A.5.5 0 0 0 14.9 2h-3.8a.5.5 0 0 0-.49.42l-.36 2.54c-.58.23-1.12.54-1.63.94l-2.39-.96a.5.5 0 0 0-.6.22L3.71 8.48a.5.5 0 0 0 .12.64l2.03 1.58c-.04.31-.06.63-.06.94s.02.63.06.94L3.83 14.5a.5.5 0 0 0-.12.64l1.92 3.32c.13.22.4.3.6.22l2.39-.96c.5.4 1.05.72 1.63.94l.36 2.54c.05.24.25.42.49.42h3.8c.24 0 .44-.18.49-.42l.36-2.54c.58-.23 1.12-.54 1.63-.94l2.39.96c.22.08.47 0 .6-.22l1.92-3.32a.5.5 0 0 0-.12-.64l-2.03-1.58zM12 15.5A3.5 3.5 0 1 1 12 8.5a3.5 3.5 0 0 1 0 7z"/>
      </svg>
    </button>

    <div class="viz-panel" id="viz-panel" role="dialog" aria-label="Visualization settings" hidden>
      <div class="viz-panel__header">
        <span class="viz-panel__heading">Settings</span>
        <button type="button" class="viz-panel__close" id="viz-panel-close" aria-label="Close settings">×</button>
      </div>

      <div class="viz-controls__section">
        <div class="viz-controls__section-label">Wall</div>

        <div class="viz-controls__row">
          <label class="viz-controls__label" for="dash-title">Title</label>
          <input
            id="dash-title"
            class="viz-controls__input viz-controls__input--text"
            type="text"
            maxlength="120"
            placeholder="Dashboard title (also the save name)"
            value="${escapeAttr(initial.title)}"
            aria-label="Dashboard title"
          />
        </div>

        <div class="viz-controls__row viz-controls__row--top">
          <label class="viz-controls__label" for="dash-desc">About</label>
          <textarea
            id="dash-desc"
            class="viz-controls__input viz-controls__textarea"
            rows="2"
            maxlength="400"
            placeholder="Short description"
            aria-label="Dashboard description"
          >${escapeHtml(initial.description)}</textarea>
        </div>

        <div class="viz-controls__row">
          <label class="viz-controls__label" for="preset-select">Saved</label>
          <div class="viz-controls__source">
            <select id="preset-select" class="viz-controls__select" aria-label="Saved dashboards">
              <option value="">— none yet —</option>
            </select>
            <button type="button" class="viz-controls__btn" id="preset-save" title="Save current wall as this title">Save</button>
            <button type="button" class="viz-controls__btn viz-controls__btn--ghost" id="preset-delete" disabled title="Delete selected">✕</button>
          </div>
        </div>
        <p class="viz-controls__flash" id="save-flash" hidden></p>
      </div>

      <div class="viz-controls__section">
        <div class="viz-controls__section-label">Feed</div>

        <div class="viz-controls__row">
          <label class="viz-controls__label" for="source-pick">Bookmarks</label>
          <div class="viz-controls__source">
            <select id="source-pick" class="viz-controls__select" aria-label="Saved sources">
              <option value="">— enter URL below —</option>
            </select>
            <button type="button" class="viz-controls__btn viz-controls__btn--ghost" id="source-save" title="Bookmark current URL">Pin</button>
            <button type="button" class="viz-controls__btn viz-controls__btn--ghost" id="source-delete" disabled title="Delete bookmark">✕</button>
          </div>
        </div>

        <div class="viz-controls__row viz-controls__row--source">
          <label class="viz-controls__label" for="source-url">Source</label>
          <div class="viz-controls__source">
            <span class="viz-controls__dot" data-status="connecting" title="Connection status" aria-hidden="true"></span>
            <input
              id="source-url"
              class="viz-controls__input"
              type="text"
              spellcheck="false"
              autocomplete="off"
              inputmode="url"
              placeholder="ws://localhost:8787"
              value="${escapeAttr(initial.sourceUrl)}"
              aria-label="Event source WebSocket URL"
            />
            <button type="button" class="viz-controls__btn" id="source-apply">Connect</button>
          </div>
        </div>
      </div>

      <div class="viz-controls__section">
        <div class="viz-controls__section-label">Look</div>

        <div class="viz-controls__row">
          <label class="viz-controls__label" for="theme-select">Theme</label>
          <select id="theme-select" class="viz-controls__select" aria-label="Visualization theme">
            ${themes
              .map(
                (t) =>
                  `<option value="${escapeAttr(t.id)}"${t.id === initial.themeId ? " selected" : ""}>${escapeHtml(t.label)}</option>`,
              )
              .join("")}
          </select>
        </div>

        <div class="viz-controls__row">
          <label class="viz-controls__label" for="max-arcs" title="Max concurrent arcs — highest priority only">Slots</label>
          <div class="viz-controls__source">
            <input
              id="max-arcs"
              class="viz-controls__input viz-controls__input--num"
              type="number"
              min="${initial.maxConcurrentMin}"
              max="${initial.maxConcurrentMax}"
              step="10"
              value="${initial.maxConcurrent}"
              aria-label="Max concurrent arcs"
            />
            <span class="viz-controls__hint">top-N · max ${initial.maxConcurrentMax}</span>
          </div>
        </div>

        <div class="viz-controls__row">
          <label class="viz-controls__label" for="scenario-select" title="Timed playbooks">Playbook</label>
          <div class="viz-controls__source">
            <select id="scenario-select" class="viz-controls__select" aria-label="Play scenario" disabled>
              <option value="">— pick a story —</option>
            </select>
            <button type="button" class="viz-controls__btn viz-controls__btn--ghost" id="scenario-stop" disabled title="Stop playbook">Stop</button>
          </div>
        </div>
        <p class="viz-controls__blurb" id="scenario-blurb" hidden></p>

        <div class="viz-controls__row">
          <label class="viz-controls__label" for="spin-toggle">Spin</label>
          <div class="viz-controls__source">
            <label class="viz-controls__check">
              <input
                id="spin-toggle"
                type="checkbox"
                ${initial.spinEnabled !== false ? "checked" : ""}
                aria-label="Auto-rotate globe"
              />
              <span>Auto-rotate</span>
            </label>
            <span class="viz-controls__hint">Space · drag to aim</span>
          </div>
        </div>

        <div class="viz-controls__row">
          <label class="viz-controls__label" for="audio-toggle">Audio</label>
          <div class="viz-controls__source">
            <label class="viz-controls__check">
              <input
                id="audio-toggle"
                type="checkbox"
                ${initial.audioEnabled ? "checked" : ""}
                aria-label="Impact audio"
              />
              <span>Impact sounds</span>
            </label>
          </div>
        </div>
      </div>

      <p class="viz-controls__live" id="gen-meta" aria-live="polite"></p>
    </div>
  `;

  const fab = shell.querySelector("#viz-fab") as HTMLButtonElement;
  const panel = shell.querySelector("#viz-panel") as HTMLElement;
  const closeBtn = shell.querySelector("#viz-panel-close") as HTMLButtonElement;
  const titleEl = shell.querySelector(".viz-masthead__title") as HTMLElement;
  const descEl = shell.querySelector(".viz-masthead__desc") as HTMLElement;
  const masthead = shell.querySelector(".viz-masthead") as HTMLElement;
  const select = shell.querySelector("#theme-select") as HTMLSelectElement;
  const sourceInput = shell.querySelector("#source-url") as HTMLInputElement;
  const applyBtn = shell.querySelector("#source-apply") as HTMLButtonElement;
  const titleInput = shell.querySelector("#dash-title") as HTMLInputElement;
  const descInput = shell.querySelector("#dash-desc") as HTMLTextAreaElement;
  const maxArcsInput = shell.querySelector("#max-arcs") as HTMLInputElement;
  const audioToggle = shell.querySelector("#audio-toggle") as HTMLInputElement;
  const spinToggle = shell.querySelector("#spin-toggle") as HTMLInputElement;
  const scenarioSelect = shell.querySelector(
    "#scenario-select",
  ) as HTMLSelectElement;
  const scenarioStop = shell.querySelector("#scenario-stop") as HTMLButtonElement;
  const scenarioBlurb = shell.querySelector("#scenario-blurb") as HTMLElement;
  const presetSelect = shell.querySelector("#preset-select") as HTMLSelectElement;
  const presetSave = shell.querySelector("#preset-save") as HTMLButtonElement;
  const presetDelete = shell.querySelector("#preset-delete") as HTMLButtonElement;
  const sourcePick = shell.querySelector("#source-pick") as HTMLSelectElement;
  const sourceSave = shell.querySelector("#source-save") as HTMLButtonElement;
  const sourceDelete = shell.querySelector("#source-delete") as HTMLButtonElement;
  const saveFlash = shell.querySelector("#save-flash") as HTMLElement;
  const genMeta = shell.querySelector("#gen-meta") as HTMLElement;
  const dot = shell.querySelector(".viz-controls__dot") as HTMLElement;

  let open = false;
  let scenarios: ScenarioOption[] = [];
  let activeScenario: string | null = null;
  let presets: PresetOption[] = [];
  let activePresetId: string | null = null;
  let sources: SourceOption[] = [];
  let activeSourceId: string | null = null;
  let suppressScenarioChange = false;
  let suppressPresetChange = false;
  let suppressSourcePick = false;
  let flashTimer: ReturnType<typeof setTimeout> | null = null;

  function setOpen(next: boolean): void {
    open = next;
    panel.hidden = !next;
    shell.classList.toggle("viz-ui--open", next);
    fab.setAttribute("aria-expanded", String(next));
    fab.setAttribute("aria-label", next ? "Close settings" : "Open settings");
    if (next) titleInput.focus();
  }

  function renderMasthead(title: string, description: string): void {
    const t = title.trim();
    const d = description.trim();
    titleEl.textContent = t;
    descEl.textContent = d;
    masthead.hidden = !t && !d;
    titleEl.hidden = !t;
    descEl.hidden = !d;
    if (t) document.title = `${t} · Vizzy`;
    else document.title = "Vizzy";
  }

  function renderScenarios(): void {
    const has = scenarios.length > 0;
    scenarioSelect.disabled = !has;
    scenarioStop.disabled = !activeScenario;

    const keep = activeScenario ?? scenarioSelect.value;
    suppressScenarioChange = true;
    scenarioSelect.innerHTML =
      `<option value="">— pick a story —</option>` +
      scenarios
        .map(
          (s) =>
            `<option value="${escapeAttr(s.id)}">${escapeHtml(s.label)}</option>`,
        )
        .join("");
    if (keep && scenarios.some((s) => s.id === keep)) {
      scenarioSelect.value = keep;
    }
    suppressScenarioChange = false;
    updateBlurb();
  }

  function renderPresets(): void {
    const keep = activePresetId ?? presetSelect.value;
    suppressPresetChange = true;
    presetSelect.innerHTML =
      `<option value="">— live (unsaved) —</option>` +
      presets
        .map(
          (p) =>
            `<option value="${escapeAttr(p.id)}">${escapeHtml(p.title)}</option>`,
        )
        .join("");
    if (keep && presets.some((p) => p.id === keep)) {
      presetSelect.value = keep;
    } else {
      presetSelect.value = "";
    }
    suppressPresetChange = false;
    presetDelete.disabled = !presetSelect.value;
  }

  function renderSources(): void {
    const keep = activeSourceId ?? sourcePick.value;
    suppressSourcePick = true;
    sourcePick.innerHTML =
      `<option value="">— enter URL below —</option>` +
      sources
        .map(
          (s) =>
            `<option value="${escapeAttr(s.id)}">${escapeHtml(s.name)}</option>`,
        )
        .join("");
    if (keep && sources.some((s) => s.id === keep)) {
      sourcePick.value = keep;
    } else {
      sourcePick.value = "";
    }
    suppressSourcePick = false;
    sourceDelete.disabled = !sourcePick.value;
  }

  function updateBlurb(): void {
    const id = scenarioSelect.value;
    const s = scenarios.find((x) => x.id === id);
    if (s?.blurb) {
      scenarioBlurb.hidden = false;
      scenarioBlurb.textContent = s.blurb;
    } else {
      scenarioBlurb.hidden = true;
      scenarioBlurb.textContent = "";
    }
  }

  function flash(msg: string): void {
    saveFlash.hidden = false;
    saveFlash.textContent = msg;
    if (flashTimer) clearTimeout(flashTimer);
    flashTimer = setTimeout(() => {
      saveFlash.hidden = true;
    }, 2400);
  }

  renderMasthead(initial.title, initial.description);
  renderScenarios();
  renderPresets();
  renderSources();

  fab.addEventListener("click", (e) => {
    e.stopPropagation();
    setOpen(!open);
  });
  closeBtn.addEventListener("click", () => setOpen(false));

  document.addEventListener("pointerdown", (e) => {
    if (!open) return;
    const target = e.target as Node;
    if (shell.contains(target)) return;
    setOpen(false);
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && open) setOpen(false);
  });

  select.addEventListener("change", () => {
    handlers.onThemeChange(select.value);
  });

  const commitSource = () => {
    const next = normalizeWsUrl(sourceInput.value);
    sourceInput.value = next;
    handlers.onSourceChange(next);
  };

  applyBtn.addEventListener("click", commitSource);
  sourceInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      commitSource();
    }
  });

  let copyTimer: ReturnType<typeof setTimeout> | null = null;
  const emitCopy = () => {
    const copy = {
      title: titleInput.value,
      description: descInput.value,
    };
    renderMasthead(copy.title, copy.description);
    handlers.onCopyChange(copy);
  };

  const scheduleCopy = () => {
    if (copyTimer) clearTimeout(copyTimer);
    copyTimer = setTimeout(emitCopy, 200);
  };

  titleInput.addEventListener("input", scheduleCopy);
  descInput.addEventListener("input", scheduleCopy);
  titleInput.addEventListener("change", emitCopy);
  descInput.addEventListener("change", emitCopy);

  const commitMaxArcs = () => {
    const n = Number(maxArcsInput.value);
    handlers.onMaxConcurrentChange(n);
  };
  maxArcsInput.addEventListener("change", commitMaxArcs);
  maxArcsInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      commitMaxArcs();
    }
  });

  audioToggle.addEventListener("change", () => {
    handlers.onAudioChange?.(audioToggle.checked);
  });

  spinToggle.addEventListener("change", () => {
    handlers.onSpinChange?.(spinToggle.checked);
  });

  scenarioSelect.addEventListener("change", () => {
    if (suppressScenarioChange) return;
    updateBlurb();
    const id = scenarioSelect.value;
    if (id) handlers.onScenarioPlay?.(id);
    else handlers.onScenarioStop?.();
  });
  scenarioStop.addEventListener("click", () => {
    handlers.onScenarioStop?.();
    suppressScenarioChange = true;
    scenarioSelect.value = "";
    suppressScenarioChange = false;
    updateBlurb();
  });

  presetSave.addEventListener("click", () => {
    handlers.onSavePreset?.();
  });
  presetSelect.addEventListener("change", () => {
    if (suppressPresetChange) return;
    const id = presetSelect.value;
    presetDelete.disabled = !id;
    if (id) handlers.onLoadPreset?.(id);
  });
  presetDelete.addEventListener("click", () => {
    const id = presetSelect.value;
    if (id) handlers.onDeletePreset?.(id);
  });

  sourceSave.addEventListener("click", () => {
    handlers.onSaveSource?.();
  });
  sourcePick.addEventListener("change", () => {
    if (suppressSourcePick) return;
    const id = sourcePick.value;
    sourceDelete.disabled = !id;
    if (id) handlers.onPickSource?.(id);
  });
  sourceDelete.addEventListener("click", () => {
    const id = sourcePick.value;
    if (id) handlers.onDeleteSource?.(id);
  });

  // ⌘S / Ctrl+S saves
  document.addEventListener("keydown", (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
      e.preventDefault();
      handlers.onSavePreset?.();
    }
  });

  document.body.appendChild(shell);

  return {
    setTheme(id: string) {
      select.value = id;
    },
    setSource(url: string) {
      sourceInput.value = url;
    },
    setCopy(copy: DashboardCopy) {
      titleInput.value = copy.title;
      descInput.value = copy.description;
      renderMasthead(copy.title, copy.description);
    },
    setMaxConcurrent(n: number) {
      maxArcsInput.value = String(n);
    },
    setStatus(status: ConnectionStatus) {
      dot.dataset.status = status;
      const labels: Record<ConnectionStatus, string> = {
        connecting: "Connecting…",
        open: "Connected",
        closed: "Disconnected",
        error: "Error",
      };
      dot.title = labels[status];
    },
    setAudio(enabled: boolean) {
      audioToggle.checked = enabled;
    },
    setSpin(enabled: boolean) {
      spinToggle.checked = enabled;
    },
    setScenarios(list: ScenarioOption[], activeId: string | null) {
      scenarios = list;
      activeScenario = activeId;
      renderScenarios();
    },
    setPresets(list: PresetOption[], activeId: string | null) {
      presets = list;
      activePresetId = activeId;
      renderPresets();
    },
    setSources(list: SourceOption[], activeId: string | null) {
      sources = list;
      activeSourceId = activeId;
      renderSources();
    },
    setSaveFlash(msg: string) {
      flash(msg);
    },
    setGeneratorMeta(meta: {
      profile: string;
      rate: number;
      step?: string | null;
      scenario?: string | null;
    }) {
      const parts = [`${meta.profile} · ${meta.rate.toFixed(1)}/s`];
      if (meta.scenario && meta.step) {
        parts.push(`▶ ${meta.step}`);
      } else if (meta.scenario) {
        parts.push(`▶ ${meta.scenario}`);
      }
      genMeta.textContent = parts.join("  ·  ");
    },
    getForm() {
      return {
        title: titleInput.value,
        description: descInput.value,
        sourceUrl: normalizeWsUrl(sourceInput.value),
      };
    },
    open() {
      setOpen(true);
    },
    close() {
      setOpen(false);
    },
    destroy() {
      if (copyTimer) clearTimeout(copyTimer);
      if (flashTimer) clearTimeout(flashTimer);
      shell.remove();
    },
  };
}

/** Accept bare host:port and http(s) URLs; always return a ws(s) URL. */
export function normalizeWsUrl(raw: string): string {
  let s = raw.trim();
  if (!s) {
    return `${location.protocol === "https:" ? "wss" : "ws"}://${location.hostname}:8787`;
  }
  if (s.startsWith("http://")) s = "ws://" + s.slice("http://".length);
  if (s.startsWith("https://")) s = "wss://" + s.slice("https://".length);
  if (!/^wss?:\/\//i.test(s)) s = `ws://${s}`;
  return s.replace(/\/+$/, "");
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escapeAttr(s: string): string {
  return escapeHtml(s);
}
