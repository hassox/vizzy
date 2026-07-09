# Vizzy — Architecture

High-level design for the monorepo. For contracts, prefer **[SCHEMA.md](../../SCHEMA.md)**.

## Overview

A 3D visualization engine that renders geolocated journeys on a globe. Events are schema-agnostic of “type”: a nuke and a packet are the same wire shape; **themes** decide how they look.

## Stack

| Layer | Choice |
|---|---|
| Viz | [globe.gl](https://github.com/vasturiano/globe.gl) + Three.js `0.185.x` (single version via npm `overrides`) |
| Client build | Vite |
| Generator | Node + `ws` |
| Contracts | TypeScript in `packages/contracts`, shapes from JSON Schema under `schemas/` |
| Persistence | Browser `localStorage` for `viz-config` (presets + sources) |

## Data flow

```
┌──────────────┐    WebSocket     ┌──────────────────┐
│  generator   │ ── geo-event ──► │   apps/viz        │
│  or any WS   │                  │   ArcEngine       │
└──────────────┘                  └────────┬─────────┘
                                           │
                                    themes mapEvent()
                                           │
                                    arcs / rings / heat
```

- **Wire:** only `geo-event` messages (plus optional generator `status` / `cmd` for the demo server)
- **Config:** `viz-config` stays client-side (never on the event socket)

## Components

**Generator** (`apps/generator`) — synthetic city-pair traffic, profiles, multi-hop `correlationId` chains, playbook scenarios. Validates with `isGeoEvent` before send.

**Viz** (`apps/viz`) — globe, `ArcEngine` (admit, heat, paths, rings), themes, controls, camera, audio, preset store.

**Contracts** (`packages/contracts`) — `GeoEvent` + `VizConfig` types and validators.

## Theme contract

Themes implement `mapEvent(event, { distanceKm }) → VisualParams` and must not allocate Three.js objects. Lifecycle (launch → flight → impact) is owned by the viz, not the wire format.

## OpenTelemetry

Do not merge OTel spans into geo-event. Use an **adapter**: spans → enrich origin/dest → emit geo-event (`correlationId` ← `traceId`, attrs in `metadata`).

## Deferred ideas

- Aggregated `event-group` schema for extreme volume
- Swap globe.gl for custom R3F renderer behind the same `ArcEngine` boundary
