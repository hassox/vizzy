# Vizzy — Vision (implemented baseline)

Original decisions from 2026-07-08 brainstorm. Kept as product intent, not a backlog.

## Goals

Wall kiosk that people film with their phones: cinematic, narrative, theme-driven, high FPS.

## Performance model

**Relative concurrency cap** (not an absolute priority threshold):

- At most `maxConcurrent` arcs live at once (default **200**, ceiling **500**)
- Under the cap → every event renders
- At the cap → only the highest-priority events stay; lower incoming is rejected
- Ties: prefer keeping the existing arc when priorities equal (see `ArcEngine.admit`)

## Delivered pillars

| Pillar | Status |
|---|---|
| Cinema (impact FX, camera punch, audio, day/night lights, arc heads) | Done |
| Narrative density (ticks, heat afterglow, correlation ghosts) | Done |
| Theme packs + generator profiles | Done |
| Scenario playbooks | Done |
| Relative concurrency + lean FX | Done |
| Dashboard presets + source bookmarks (`viz-config`) | Done |

## Explicit non-goals (still)

- Absolute priority cutoff
- Particle Earth / R3F rewrite (globe.gl boundary is fine)
- Always-on heavy post-processing

## Possible later (not required for public v1)

- Real telemetry adapter (e.g. OpenTelemetry → geo-event)
- Focus mode / stream pause
- Config export file UI
- Publish schemas to Rusl
