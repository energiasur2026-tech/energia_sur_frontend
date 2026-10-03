'use client';

import { useSyncExternalStore } from 'react';
import { currentTheme, DARK_MEDIA_QUERY, THEME_CHANGE_EVENT, type Theme } from './theme';

function subscribe(onChange: () => void) {
  window.addEventListener(THEME_CHANGE_EVENT, onChange);
  // 'storage' llega cuando el tema se cambio en OTRA pestaña: asi las dos
  // quedan sincronizadas sin recargar.
  window.addEventListener('storage', onChange);

  // Mientras el usuario no haya elegido, el tema es el del sistema: si lo
  // cambia ahi (por ejemplo al anochecer), la app tiene que acompañarlo.
  const media = window.matchMedia(DARK_MEDIA_QUERY);
  media.addEventListener('change', onChange);

  return () => {
    window.removeEventListener(THEME_CHANGE_EVENT, onChange);
    window.removeEventListener('storage', onChange);
    media.removeEventListener('change', onChange);
  };
}

/**
 * El tema que se esta viendo.
 *
 * Es estado externo (vive en localStorage, en el atributo de <html> y en la
 * preferencia del sistema), no estado de React: `useSyncExternalStore` es la
 * forma correcta de leerlo sin encadenar renders. Devuelve un string, asi que
 * la igualdad referencial que exige el hook se cumple sola.
 *
 * En el servidor no hay forma de saber la preferencia del sistema. Se asume
 * 'dark' porque es el fondo que pinta el HTML inicial: si acertamos, no hay
 * cambio visible al hidratar; si no, el script del <head> ya corrigio el tema
 * antes del primer pintado y lo unico que se ajusta es la posicion del
 * interruptor.
 */
export function useTheme(): Theme {
  return useSyncExternalStore(subscribe, currentTheme, () => 'dark' as Theme);
}
