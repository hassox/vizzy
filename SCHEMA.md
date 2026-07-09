# SCHEMA.md — Vizzy Schema-Driven Contract

This repository is **schema-driven**. Data shapes are decided here, not in ad-hoc TypeScript. Read this before changing event or config types.

## Where shapes live

- **Registry (authoritative):** [Rusl](https://rusl.com) — schemas are versioned and published under the `dan` account (Vizzy package).
- **Vendored snapshots:** `./schemas/` — produced by `rusl install` from `rusl.bundle.toml` + `rusl.lock`. Do not edit by hand; change on Rusl, then reinstall.

Requires **Rusl CLI ≥ 0.6** so install writes real files (not absolute store symlinks).

## Current dependencies

| Resource | Version | Purpose |
|---|---|---|
| `pragmatic/schemas/geo` | `>=0.1.0` | GeoJSON geometry (RFC 7946) — point primitives for origin/destination |
| `dan/schemas/vizzy.geo-event` | `>=0.1.0` | Wire: one geolocated journey |
| `dan/schemas/vizzy.viz-config` | `>=0.1.0` | Client: sources + presets library (not on the event wire) |

Declared in `rusl.bundle.toml`. Refresh with:

```sh
rusl install          # re-resolve + vendor into ./schemas
rusl outdated         # check for newer versions
rusl add <schema-id>  # add a dependency
```

### `dan/schemas/vizzy.geo-event` (v0.1.0)

One message = one full journey. Visual phases (launch → flight → impact) are owned by the viz, not the wire format.

| Field | Required | Notes |
|---|---|---|
| `id` | yes | Unique event ID (UUID) |
| `correlationId` | no | Groups related journeys (maps to OTel `traceId` via adapter) |
| `origin` | yes | GeoJSON Point (`pragmatic/schemas/geo` `$defs/point`) |
| `destination` | yes | GeoJSON Point |
| `magnitude` | no | 0–100 intrinsic scale. Default 50 |
| `priority` | no | 0–100 urgency relative to peers. Default 50 |
| `velocity` | no | 0–100 relative travel speed (display scale). Default 50 |
| `metadata` | no | Theme-specific extras; unknown keys ignored |
| `emittedAt` | yes | ISO 8601 when the producer emitted the event |

**Rejected fields:** `type` (theme owns rendering), `severity` (use magnitude + priority), `stages` (viz-derived lifecycle).

**Semantics:** `magnitude` = how big; `priority` = how urgent vs peers; `velocity` = relative travel speed. All 0–100 are **display scales**, not SI units.

### `dan/schemas/vizzy.viz-config` (v0.1.0)

Client configuration only (localStorage / export). Root document + `$defs`.

```
viz-config (root = library envelope)
  $defs.source         named feed bookmark
  $defs.sourceBinding  how a run connects (url | saved | cycle)
  $defs.preset         full run / wall configuration
```

**Root:**

| Field | Required | Notes |
|---|---|---|
| `version` | yes | `1` |
| `sources` | yes | Array of `$defs/source` (max 100) |
| `presets` | yes | Array of `$defs/preset` (max 50) |
| `activePresetId` | no | Last applied preset |
| `updatedAt` | no | ISO 8601 |

**`$defs/preset`:** `id`, `version`, `title` (label + wall title), optional chrome/theme/slots/audio/spin/playbook, required `source` binding.

**`$defs/sourceBinding` modes:** `url` · `saved` · `cycle` (see published schema for conditionals).

Only **geo-event** rides the WebSocket.

## Deferred

| Resource | Notes |
|---|---|
| Event grouping / aggregation | High-volume buckets — not needed for v1 |

## How to change a shape

1. Propose/update the schema on Rusl (`dan` account, Vizzy package).
2. Publish a new version.
3. Bump the constraint in `rusl.bundle.toml` if needed.
4. Run `rusl install` to vendor.
5. Update TypeScript in `packages/contracts` and consumers.

## Meaning layer

Schemas define shape. Domain meaning (what `magnitude: 80` means in context) can live as Rusl annotations on the published version.

## Iron rule

Before creating, modifying, or generating code for any data type, you must read this file first.
