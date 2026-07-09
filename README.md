# Vizzy

Real-time 3D Earth for **geolocated journeys** — origin → destination as animated arcs. Built for wall displays and kiosks: one event schema, theme-owned art direction, high FPS under flood.

```
generator (WebSocket) ──geo-event──► viz (globe.gl)
```

## Features

- **Schema-driven events** — magnitude, priority, velocity as 0–100 display scales; themes own look & lifecycle
- **Relative concurrency** — top-N arcs by priority (default 200, max 500), not a hard severity cutoff
- **Heat memory** — sinks stack energy and decay exponentially
- **Themes** — Ember, Nukes, Packets (generator profiles follow the theme)
- **Playbooks** — timed scenarios (Showcase, Pacific, Black Friday)
- **Wall chrome** — title, description, live tick strip, legend, FPS
- **Presets** — save/load full dashboards + source bookmarks in `localStorage` (`viz-config`)
- **Spin pin** — stop auto-rotate (Space or settings); drag to aim
- **Optional impact audio**

## Quick start

Requires Node 20+.

```sh
npm install
npm run dev
```

| Service | URL |
|---|---|
| Viz | http://localhost:5173 |
| Generator WebSocket | `ws://localhost:8787` |

Separate processes:

```sh
npm run dev:generator
npm run dev:viz
```

### Generator environment

| Variable | Default | Meaning |
|---|---|---|
| `PORT` | `8787` | WebSocket listen port |
| `RATE` | profile default | Events per second |
| `SEED` | `42` | PRNG seed |
| `BUFFER` | `50` | Recent events replayed on connect |
| `PROFILE` | `ember` | Emit profile: `ember` \| `nukes` \| `packets` |

```sh
RATE=8 PROFILE=packets npm run dev:generator
```

## Settings (gear, top-right)

| Section | Controls |
|---|---|
| **Wall** | Title, about, **Save** / load / delete presets (title is the save name) |
| **Feed** | Source URL, Connect, **Pin** bookmarks |
| **Look** | Theme, slots, playbook, spin, audio |

**Keyboard:** `Space` toggle spin · `⌘S` / `Ctrl+S` save preset

### URL params

| Param | Example | Meaning |
|---|---|---|
| `theme` | `nukes` | Theme id |
| `ws` | `ws://192.168.1.10:8787` | Event source |
| `title` / `description` | wall chrome | |
| `maxArcs` | `200` | Concurrent slot cap |
| `audio` | `1` | Impact sounds on |
| `spin` | `0` | Start with auto-rotate off |
| `preset` | `<uuid>` | Load saved preset by id |

```
http://localhost:5173/?theme=nukes&title=Global%20Strike%20Map&maxArcs=200
http://localhost:5173/?ws=ws://192.168.1.10:8787&spin=0
```

## Themes

| Id | Look |
|---|---|
| `ember` | Warm amber arcs (default) |
| `nukes` | Ballistic loft, hot trails, wide impacts |
| `packets` | Cool cyan, low hops, dense traffic |

## Production / kiosk

```sh
npm run build
# serve apps/viz/dist with any static host
# run generator where the kiosk can reach it:
npm run start -w @vizzy/generator
```

Chrome kiosk example:

```sh
/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome \
  --kiosk --fullscreen \
  "http://localhost:4173/?theme=ember&ws=ws://127.0.0.1:8787"
```

(`vite preview` or your static server on the port you choose.)

## Layout

```
apps/generator       synthetic geo-events over WebSocket
apps/viz             globe.gl client, arc engine, themes, UI
packages/contracts   shared TypeScript types + validators
schemas/             vendored from Rusl (`rusl install`)
SCHEMA.md            contract source of truth
docs/plans           design notes
```

## Schemas

This repo is **schema-driven**. Before changing event or config shapes, read **[SCHEMA.md](./SCHEMA.md)**.

| Resource | Role |
|---|---|
| `dan/schemas/vizzy.geo-event` | Wire format: one journey message |
| `dan/schemas/vizzy.viz-config` | Client library: sources + presets (not on the wire) |
| `pragmatic/schemas/geo` | GeoJSON point primitives |

```sh
# requires Rusl CLI ≥ 0.6
rusl install
```

## License

[MIT](./LICENSE). Imagery notes in [ATTRIBUTION.md](./ATTRIBUTION.md).
