/// <reference types="vite/client" />

declare module "globe.gl" {
  export interface GlobeInstance {
    (element?: HTMLElement): GlobeInstance;
    globeImageUrl(url: string): GlobeInstance;
    bumpImageUrl(url: string): GlobeInstance;
    backgroundColor(color: string): GlobeInstance;
    atmosphereColor(color: string): GlobeInstance;
    atmosphereAltitude(alt: number): GlobeInstance;
    showGlobe(show: boolean): GlobeInstance;
    showAtmosphere(show: boolean): GlobeInstance;
    onGlobeReady(cb: () => void): GlobeInstance;
    enablePointerInteraction(enable: boolean): GlobeInstance;
    pointOfView(
      pov: { lat: number; lng: number; altitude: number },
      transitionMs?: number,
    ): GlobeInstance;
    controls(): {
      autoRotate: boolean;
      autoRotateSpeed: number;
      enableDamping: boolean;
      dampingFactor: number;
    } | null;
    width(w: number): GlobeInstance;
    height(h: number): GlobeInstance;
    lights(lights?: unknown[]): GlobeInstance | unknown[];
    scene(): { add: (o: unknown) => void };
    arcsData(data?: unknown[]): unknown[] | GlobeInstance;
    ringsData(data?: unknown[]): unknown[] | GlobeInstance;
    pointsData(data?: unknown[]): unknown[] | GlobeInstance;
    pathsData(data?: unknown[]): unknown[] | GlobeInstance;
    arcColor(fn: unknown): GlobeInstance;
    arcStroke(fn: unknown): GlobeInstance;
    arcAltitude(fn: unknown): GlobeInstance;
    arcDashLength(v: number): GlobeInstance;
    arcDashGap(v: number): GlobeInstance;
    arcDashInitialGap(fn: unknown): GlobeInstance;
    arcDashAnimateTime(fn: unknown): GlobeInstance;
    arcsTransitionDuration(ms: number): GlobeInstance;
    ringColor(fn: unknown): GlobeInstance;
    ringMaxRadius(fn: unknown): GlobeInstance;
    ringPropagationSpeed(fn: unknown): GlobeInstance;
    ringRepeatPeriod(fn: unknown): GlobeInstance;
    pointLat(fn: unknown): GlobeInstance;
    pointLng(fn: unknown): GlobeInstance;
    pointColor(fn: unknown): GlobeInstance;
    pointAltitude(fn: unknown): GlobeInstance;
    pointRadius(fn: unknown): GlobeInstance;
    pointsMerge(merge: boolean): GlobeInstance;
    pointsTransitionDuration(ms: number): GlobeInstance;
    pathPoints(fn: unknown): GlobeInstance;
    pathPointLat(fn: unknown): GlobeInstance;
    pathPointLng(fn: unknown): GlobeInstance;
    pathPointAlt(fn: unknown): GlobeInstance;
    pathColor(fn: unknown): GlobeInstance;
    pathStroke(fn: unknown): GlobeInstance;
    pathDashLength(v: number): GlobeInstance;
    pathDashGap(v: number): GlobeInstance;
    pathDashAnimateTime(v: number): GlobeInstance;
    pathTransitionDuration(ms: number): GlobeInstance;
  }

  interface GlobeConstructor {
    new (
      element?: HTMLElement,
      configOptions?: {
        animateIn?: boolean;
        waitForGlobeReady?: boolean;
        rendererConfig?: object;
      },
    ): GlobeInstance;
    (element?: HTMLElement): GlobeInstance;
  }

  const Globe: GlobeConstructor;
  export default Globe;
}
