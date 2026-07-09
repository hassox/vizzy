import { WebSocketServer, type WebSocket } from "ws";
import type { GeoEvent } from "@vizzy/contracts";
import { createEmitter } from "./emit.js";
import { resolveProfile, type ProfileId } from "./profiles.js";
import { RingBuffer } from "./ringBuffer.js";
import {
  listScenarios,
  resolveScenario,
  type Scenario,
} from "./scenarios.js";

const PORT = Number(process.env.PORT ?? 8787);
const SEED = Number(process.env.SEED ?? 42);
const BUFFER = Number(process.env.BUFFER ?? 50);
const START_PROFILE = process.env.PROFILE ?? "ember";

let rate = Number(process.env.RATE ?? resolveProfile(START_PROFILE).defaultRate);
const emitter = createEmitter(SEED, START_PROFILE);
const recent = new RingBuffer<GeoEvent>(BUFFER);
const clients = new Set<WebSocket>();

type StatusMsg = {
  type: "status";
  rate: number;
  profile: string;
  scenario: string | null;
  step: string | null;
  scenarios: { id: string; label: string; blurb: string }[];
};

let scenario: Scenario | null = null;
let scenarioStartedAt = 0;
let scenarioStepLabel: string | null = null;
let scenarioTimer: ReturnType<typeof setInterval> | null = null;
let emitTimer: ReturnType<typeof setInterval> | null = null;

const wss = new WebSocketServer({ port: PORT });

function send(ws: WebSocket, data: unknown): void {
  if (ws.readyState === ws.OPEN) {
    ws.send(JSON.stringify(data));
  }
}

function broadcast(event: GeoEvent): void {
  recent.push(event);
  for (const ws of clients) send(ws, event);
}

function broadcastStatus(): void {
  const msg: StatusMsg = {
    type: "status",
    rate,
    profile: emitter.getProfile().id,
    scenario: scenario?.id ?? null,
    step: scenarioStepLabel,
    scenarios: listScenarios().map((s) => ({
      id: s.id,
      label: s.label,
      blurb: s.blurb,
    })),
  };
  for (const ws of clients) send(ws, msg);
}

function setRate(next: number): void {
  rate = Math.min(40, Math.max(0.2, next));
  restartEmitLoop();
  broadcastStatus();
}

function setProfile(id: string): void {
  emitter.setProfile(id);
  // Only auto-rate if not in a scenario
  if (!scenario) {
    rate = emitter.getProfile().defaultRate;
    restartEmitLoop();
  }
  broadcastStatus();
}

function applyScenarioStep(): void {
  if (!scenario) return;
  const elapsed = (Date.now() - scenarioStartedAt) / 1000;
  if (elapsed >= scenario.durationSec) {
    stopScenario();
    return;
  }
  let active = scenario.steps[0]!;
  for (const step of scenario.steps) {
    if (elapsed >= step.at) active = step;
  }
  const prevProfile = emitter.getProfile().id;
  const prevRate = rate;
  const prevStep = scenarioStepLabel;
  emitter.setProfile(active.profile);
  scenarioStepLabel = active.label;
  if (Math.abs(rate - active.rate) > 0.05) {
    rate = active.rate;
    restartEmitLoop();
  }
  // Always announce step/profile changes so the viz can follow theme + HUD
  if (
    prevStep !== active.label ||
    prevProfile !== active.profile ||
    Math.abs(prevRate - rate) > 0.05
  ) {
    broadcastStatus();
    console.log(
      `[generator] step="${active.label}" profile=${active.profile} rate=${rate}/s`,
    );
  }
}

function playScenario(id: string): void {
  const s = resolveScenario(id);
  if (!s) return;
  scenario = s;
  scenarioStartedAt = Date.now();
  scenarioStepLabel = null;
  if (scenarioTimer) clearInterval(scenarioTimer);
  applyScenarioStep();
  scenarioTimer = setInterval(applyScenarioStep, 400);
  broadcastStatus();
  console.log(`[generator] scenario=${s.id}`);
}

function stopScenario(): void {
  scenario = null;
  scenarioStepLabel = null;
  if (scenarioTimer) clearInterval(scenarioTimer);
  scenarioTimer = null;
  rate = emitter.getProfile().defaultRate;
  restartEmitLoop();
  broadcastStatus();
  console.log("[generator] scenario stopped");
}

function restartEmitLoop(): void {
  if (emitTimer) clearInterval(emitTimer);
  const intervalMs = Math.max(40, Math.round(1000 / Math.max(0.1, rate)));
  emitTimer = setInterval(() => {
    try {
      broadcast(emitter.nextEvent());
    } catch (err) {
      console.error("emit failed", err);
    }
  }, intervalMs);
}

function handleCommand(raw: string): void {
  let msg: unknown;
  try {
    msg = JSON.parse(raw);
  } catch {
    return;
  }
  if (!msg || typeof msg !== "object") return;
  const m = msg as { type?: string; cmd?: string; profile?: string; rate?: number; scenario?: string };
  if (m.type !== "cmd") return;
  switch (m.cmd) {
    case "setProfile":
      if (typeof m.profile === "string") setProfile(m.profile as ProfileId);
      break;
    case "setRate":
      if (typeof m.rate === "number") setRate(m.rate);
      break;
    case "playScenario":
      if (typeof m.scenario === "string") playScenario(m.scenario);
      break;
    case "stopScenario":
      stopScenario();
      break;
    case "status":
      broadcastStatus();
      break;
    default:
      break;
  }
}

wss.on("connection", (ws) => {
  clients.add(ws);
  for (const event of recent.snapshot()) send(ws, event);
  send(ws, {
    type: "status",
    rate,
    profile: emitter.getProfile().id,
    scenario: scenario?.id ?? null,
    step: scenarioStepLabel,
    scenarios: listScenarios().map((s) => ({
      id: s.id,
      label: s.label,
      blurb: s.blurb,
    })),
  } satisfies StatusMsg);

  ws.on("message", (data) => handleCommand(String(data)));
  ws.on("close", () => clients.delete(ws));
  ws.on("error", () => clients.delete(ws));
});

restartEmitLoop();

function shutdown(): void {
  if (emitTimer) clearInterval(emitTimer);
  if (scenarioTimer) clearInterval(scenarioTimer);
  wss.close();
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

console.log(
  `[generator] ws://localhost:${PORT}  rate=${rate}/s  seed=${SEED}  profile=${emitter.getProfile().id}`,
);
