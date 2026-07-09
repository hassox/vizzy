import { isGeoEvent, type GeoEvent } from "@vizzy/contracts";

export type GeneratorStatus = {
  type: "status";
  rate: number;
  profile: string;
  scenario: string | null;
  step: string | null;
  scenarios: { id: string; label: string; blurb?: string }[];
};

export type WsHandlers = {
  onEvent: (event: GeoEvent) => void;
  onStatus?: (status: "connecting" | "open" | "closed") => void;
  onGeneratorStatus?: (status: GeneratorStatus) => void;
};

/**
 * WebSocket client with exponential backoff reconnect.
 * Supports outbound commands to the generator.
 */
export function connectGeoEvents(
  url: string,
  handlers: WsHandlers,
): { close: () => void; send: (msg: unknown) => void } {
  let ws: WebSocket | null = null;
  let closed = false;
  let attempt = 0;
  let timer: ReturnType<typeof setTimeout> | null = null;

  const validate =
    typeof import.meta !== "undefined" &&
    Boolean((import.meta as ImportMeta & { env?: { DEV?: boolean } }).env?.DEV);

  function scheduleReconnect(): void {
    if (closed) return;
    const delay = Math.min(10_000, 400 * 2 ** attempt);
    attempt += 1;
    timer = setTimeout(connect, delay);
  }

  function connect(): void {
    if (closed) return;
    handlers.onStatus?.("connecting");
    ws = new WebSocket(url);

    ws.onopen = () => {
      attempt = 0;
      handlers.onStatus?.("open");
      send({ type: "cmd", cmd: "status" });
    };

    ws.onmessage = (msg) => {
      let data: unknown;
      try {
        data = JSON.parse(String(msg.data));
      } catch {
        return;
      }
      if (
        data &&
        typeof data === "object" &&
        (data as { type?: string }).type === "status"
      ) {
        handlers.onGeneratorStatus?.(data as GeneratorStatus);
        return;
      }
      if (!isGeoEvent(data)) {
        if (validate) console.warn("[viz] dropped invalid event", data);
        return;
      }
      handlers.onEvent(data);
    };

    ws.onclose = () => {
      handlers.onStatus?.("closed");
      scheduleReconnect();
    };

    ws.onerror = () => {
      ws?.close();
    };
  }

  function send(msg: unknown): void {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(msg));
    }
  }

  connect();

  return {
    close() {
      closed = true;
      if (timer) clearTimeout(timer);
      ws?.close();
    },
    send,
  };
}
