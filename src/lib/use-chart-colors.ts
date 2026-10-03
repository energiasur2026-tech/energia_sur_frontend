'use client';

import { useSyncExternalStore } from 'react';
import { THEME_CHANGE_EVENT } from './theme';

export type ChartColors = {
  grid: string;
  axis: string;
  tooltipBg: string;
  power: string;
  voltage: string;
  ok: string;
  warn: string;
  danger: string;
};

/** Paleta del tema claro. Es también la respuesta del render de servidor. */
const INITIAL: ChartColors = {
  grid: '#dbe3ec',
  axis: '#5b6b7d',
  tooltipBg: '#ffffff',
  power: '#1e6fd9',
  voltage: '#15803d',
  ok: '#15803d',
  warn: '#b45309',
  danger: '#c0392b',
};

/**
 * `useSyncExternalStore` exige que dos lecturas seguidas sin cambios
 * devuelvan el MISMO objeto, o React vuelve a renderizar sin parar. Por eso
 * el snapshot se cachea y solo se reconstruye cuando algún color cambió de
 * verdad.
 */
let cached: ChartColors = INITIAL;
let cachedKey = '';

function subscribe(onChange: () => void) {
  const media = window.matchMedia('(prefers-color-scheme: dark)');
  window.addEventListener(THEME_CHANGE_EVENT, onChange);
  media.addEventListener('change', onChange);

  return () => {
    window.removeEventListener(THEME_CHANGE_EVENT, onChange);
    media.removeEventListener('change', onChange);
  };
}

function getSnapshot(): ChartColors {
  const styles = getComputedStyle(document.documentElement);
  const read = (name: string, fallback: string) =>
    styles.getPropertyValue(name).trim() || fallback;

  const next: ChartColors = {
    grid: read('--chart-grid', INITIAL.grid),
    axis: read('--chart-axis', INITIAL.axis),
    tooltipBg: read('--chart-tooltip-bg', INITIAL.tooltipBg),
    power: read('--chart-power', INITIAL.power),
    voltage: read('--chart-voltage', INITIAL.voltage),
    // Los semánticos se leen de la paleta general: son los mismos que usa la
    // interfaz para advertencias y errores, y deben coincidir.
    ok: read('--ok', INITIAL.ok),
    warn: read('--warn', INITIAL.warn),
    danger: read('--danger', INITIAL.danger),
  };

  const key = `${next.grid}|${next.axis}|${next.tooltipBg}|${next.power}|${next.voltage}|${next.ok}|${next.warn}|${next.danger}`;
  if (key !== cachedKey) {
    cachedKey = key;
    cached = next;
  }

  return cached;
}

function getServerSnapshot(): ChartColors {
  return INITIAL;
}

/**
 * Colores de gráfico tomados del tema activo.
 *
 * Recharts recibe los colores como atributos SVG, no como clases de Tailwind,
 * así que no puede resolver `var(--chart-grid)` por su cuenta: hay que leer el
 * valor computado. Se relee al cambiar el tema y al cambiar la preferencia del
 * sistema operativo.
 */
export function useChartColors(): ChartColors {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
