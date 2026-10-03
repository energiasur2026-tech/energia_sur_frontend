/** Manejo del tema. Sin 'server-only': vive en el navegador. */

/**
 * Dos temas, no tres.
 *
 * Antes existia una tercera opcion, "Sistema", que seguia la preferencia del
 * sistema operativo. Se saco porque obligaba a un selector de tres estados: en
 * la barra superior eso era un solo icono que rotaba, y quien lo veia por
 * primera vez no tenia forma de saber cuantas opciones habia ni cual estaba
 * activa sin ir tocando.
 *
 * Seguir al sistema no se perdio: si el usuario nunca eligio, la app usa la
 * preferencia del sistema. Lo que desaparecio es tener que elegir "seguir al
 * sistema" como si fuera un tema mas.
 */
export type Theme = 'light' | 'dark';

export const THEME_STORAGE_KEY = 'energia-sur-theme';

/** Se dispara al cambiar el tema, para que los graficos relean sus colores. */
export const THEME_CHANGE_EVENT = 'energia-sur-themechange';

export const DARK_MEDIA_QUERY = '(prefers-color-scheme: dark)';

export function applyTheme(theme: Theme) {
  document.documentElement.setAttribute('data-theme', theme);

  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // Modo privado o almacenamiento bloqueado: el tema igual se aplica en
    // esta sesion, solo no sobrevive a la recarga.
  }

  window.dispatchEvent(new Event(THEME_CHANGE_EVENT));
}

/**
 * El tema que el usuario eligio explicitamente, o `null` si nunca eligio.
 *
 * Las cuentas que quedaron con el valor 'system' guardado de la version
 * anterior caen en `null`, que es exactamente lo que 'system' significaba:
 * seguir al sistema operativo. No hace falta migrar nada.
 */
export function readStoredTheme(): Theme | null {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    if (stored === 'light' || stored === 'dark') return stored;
  } catch {
    // Ver arriba.
  }
  return null;
}

/** El tema que se esta viendo: el elegido, o el del sistema si nunca eligio. */
export function currentTheme(): Theme {
  const stored = readStoredTheme();
  if (stored) return stored;

  return window.matchMedia(DARK_MEDIA_QUERY).matches ? 'dark' : 'light';
}

/**
 * Script que corre antes del primer pintado para aplicar el tema guardado.
 *
 * Sin esto, la pagina se pinta con el tema por defecto y recien despues React
 * lo corrige: se ve un fogonazo blanco al entrar con tema oscuro. Va inline
 * en el <head> a proposito — un archivo externo llegaria tarde.
 *
 * Si no hay nada guardado no toca el atributo, y el CSS resuelve el tema por
 * `prefers-color-scheme`.
 */
export const THEME_INIT_SCRIPT = `(function(){try{var t=localStorage.getItem('${THEME_STORAGE_KEY}');if(t==='light'||t==='dark'){document.documentElement.setAttribute('data-theme',t);}}catch(e){}})();`;

/**
 * Oculta la pantalla de carga cuando el navegador termino de cargar.
 *
 * Va inline junto al script del tema, sin depender de React ni de ningun
 * bundle: si el JavaScript de la aplicacion fallara, esto igual se ejecuta y
 * el loader no queda trabado. El temporizador es la red de seguridad para un
 * recurso que nunca termina de bajar.
 */
export const LOADER_INIT_SCRIPT = `(function(){function d(){document.documentElement.classList.add('app-loaded');}if(document.readyState==='complete'){d();}else{window.addEventListener('load',d);}setTimeout(d,6000);})();`;
