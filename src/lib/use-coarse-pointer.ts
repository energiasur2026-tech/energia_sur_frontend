'use client';

import { useSyncExternalStore } from 'react';

const QUERY = '(pointer: coarse)';

function subscribe(onChange: () => void) {
  const media = window.matchMedia(QUERY);
  media.addEventListener('change', onChange);
  return () => media.removeEventListener('change', onChange);
}

/**
 * `true` cuando el dispositivo apunta con el dedo y no con un mouse.
 *
 * Se prefiere sobre el ancho de pantalla porque describe la interacción real:
 * una tablet chica con touch necesita el mismo trato que un celular, y una
 * ventana angosta en escritorio no.
 *
 * En el render del servidor devuelve `false` — no hay forma de saberlo hasta
 * llegar al navegador, y asumir mouse deja el marcado más liviano, sin el
 * modal montado de más.
 */
export function useCoarsePointer(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(QUERY).matches,
    () => false
  );
}
