'use client';

import { useSyncExternalStore } from 'react';
const query = '(prefers-reduced-motion: reduce)';
function subscribe(callback: () => void) {
  const media = window.matchMedia(query);
  media.addEventListener('change', callback);
  return () => media.removeEventListener('change', callback);
}
function snapshot() { return window.matchMedia(query).matches; }
function serverSnapshot() { return false; }
export function useLumiReducedMotion(preference = false) {
  const system = useSyncExternalStore(subscribe, snapshot, serverSnapshot);
  return preference || system;
}
