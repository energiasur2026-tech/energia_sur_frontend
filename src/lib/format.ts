const TIME_ZONE = 'America/Argentina/Buenos_Aires';

/** Placeholder unico para valores ausentes: nunca se muestra 0 en su lugar. */
export const NO_DATA = '--';

export function formatNumber(value: number | null | undefined, decimals: number): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return NO_DATA;
  return value.toLocaleString('es-AR', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

export function formatClock(iso: string | null | undefined): string {
  if (!iso) return NO_DATA;
  return new Intl.DateTimeFormat('es-AR', {
    timeZone: TIME_ZONE,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(new Date(iso));
}

/** Etiqueta de eje: hora sola en rangos cortos, dia y hora en los largos. */
export function formatAxisLabel(iso: string, bucketSeconds: number): string {
  const date = new Date(iso);
  const withDate = bucketSeconds >= 3600;

  return new Intl.DateTimeFormat('es-AR', {
    timeZone: TIME_ZONE,
    ...(withDate ? { day: '2-digit', month: '2-digit' } : {}),
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

/**
 * Duración entre dos instantes. Un evento de una sola muestra dura 0 s —
 * se dice "instantáneo" en vez de "0 s", que se leería como un error.
 */
export function formatDuration(startIso: string, endIso: string | null): string {
  const end = endIso ? new Date(endIso).getTime() : Date.now();
  const seconds = Math.max(0, Math.round((end - new Date(startIso).getTime()) / 1000));

  if (seconds < 5) return 'instantáneo';
  if (seconds < 60) return `${seconds} s`;

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min`;

  const hours = Math.floor(minutes / 60);
  const restMinutes = minutes % 60;
  if (hours < 24) return restMinutes === 0 ? `${hours} h` : `${hours} h ${restMinutes} min`;

  const days = Math.floor(hours / 24);
  const restHours = hours % 24;
  return restHours === 0 ? `${days} d` : `${days} d ${restHours} h`;
}

export function formatRelativeMinutes(iso: string | null): string {
  if (!iso) return 'nunca';

  const minutes = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (minutes < 1) return 'hace instantes';
  if (minutes === 1) return 'hace 1 min';
  if (minutes < 60) return `hace ${minutes} min`;

  const hours = Math.round(minutes / 60);
  return hours === 1 ? 'hace 1 h' : `hace ${hours} h`;
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return NO_DATA;
  return new Intl.DateTimeFormat('es-AR', {
    timeZone: TIME_ZONE,
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso));
}

/** Importes en pesos. Centralizado para no repetir el formato en cada vista. */
export function formatCurrency(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return NO_DATA;
  return value.toLocaleString('es-AR', {
    style: 'currency',
    currency: 'ARS',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}
