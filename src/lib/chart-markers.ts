import type { EventRecord, EventType } from './event-types';

/**
 * Traduce eventos a marcas sobre el eje temporal del gráfico.
 *
 * Un evento cubre un intervalo, así que se dibuja como banda (desde su inicio
 * hasta su fin) y no como un punto. Los eventos abiertos se extienden hasta el
 * final de la ventana visible.
 */
export type EventBand = {
  id: number;
  type: EventType;
  severity: EventRecord['severity'];
  /** Milisegundos, para comparar contra las cubetas del gráfico. */
  startMs: number;
  endMs: number;
};

export function toEventBands(
  events: EventRecord[],
  windowStartMs: number,
  windowEndMs: number
): EventBand[] {
  return events
    .map((event) => ({
      id: event.id,
      type: event.type,
      severity: event.severity,
      startMs: new Date(event.startedAt).getTime(),
      endMs: event.endedAt ? new Date(event.endedAt).getTime() : windowEndMs,
    }))
    // Solo lo que se superpone con la ventana visible.
    .filter((band) => band.endMs >= windowStartMs && band.startMs <= windowEndMs);
}

/** Si una cubeta del gráfico cae dentro de algún evento, y cuál es el más grave. */
export function bandAt(bands: EventBand[], bucketMs: number): EventBand | null {
  const matching = bands.filter((band) => bucketMs >= band.startMs && bucketMs <= band.endMs);
  if (matching.length === 0) return null;

  const rank = { CRITICAL: 3, WARNING: 2, INFO: 1 } as const;
  return matching.reduce((worst, band) => (rank[band.severity] > rank[worst.severity] ? band : worst));
}
