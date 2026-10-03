'use client';

import { useCallback, useState, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { modalExit, modalSpring } from '@/lib/motion';

const STORAGE_KEY = 'energia-sur-welcome-oculto';

/**
 * Si el usuario pidio no volver a verlo.
 *
 * Vive en el navegador y no en la base: es una preferencia de interfaz sin
 * ningun efecto sobre los datos de la cuenta, igual que el tema. Guardarla en
 * la base obligaria a una tabla, una ruta de API y una consulta mas en cada
 * entrada, para recordar si alguien ya leyo un cartel.
 *
 * La contra honesta es que la decision no viaja entre dispositivos: quien lo
 * oculte en el celular lo va a ver una vez mas en la computadora. Para un
 * aviso que se cierra con un toque, es un precio razonable.
 */
function leerOculto(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === '1';
  } catch {
    // Modo privado o almacenamiento bloqueado: se muestra el aviso.
    return false;
  }
}

function suscribir(alCambiar: () => void) {
  window.addEventListener('storage', alCambiar);
  return () => window.removeEventListener('storage', alCambiar);
}

/**
 * Bienvenida que presenta el icono de ayuda.
 *
 * La app tiene explicaciones detras de cada "i", pero un icono chico no se
 * anuncia solo: quien entra por primera vez no tiene motivo para tocarlo. Este
 * cartel existe para decirlo una vez, en el momento en que reciengresa, y
 * despues desaparecer.
 *
 * Por eso el tono es liviano y el icono "habla" en primera persona: es mas
 * facil de recordar que una instruccion. Y por eso mismo se puede apagar para
 * siempre — un aviso util la primera vez es una molestia a la decima.
 *
 * Se renderiza en el servidor como `null` (el snapshot del servidor devuelve
 * `true`, o sea "oculto"): asi el HTML inicial no trae un modal que quizas
 * haya que sacar al hidratar.
 */
export function WelcomeDialog() {
  const ocultoGuardado = useSyncExternalStore(suscribir, leerOculto, () => true);

  const [cerrado, setCerrado] = useState(false);
  const [noMostrarMas, setNoMostrarMas] = useState(false);

  const cerrar = useCallback(() => {
    if (noMostrarMas) {
      try {
        localStorage.setItem(STORAGE_KEY, '1');
      } catch {
        // Ver arriba: si no se puede guardar, el aviso vuelve la proxima vez.
      }
    }
    setCerrado(true);
  }, [noMostrarMas]);

  const abierto = !ocultoGuardado && !cerrado;

  if (typeof document === 'undefined') return null;

  return createPortal(
    <AnimatePresence>
      {abierto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-5">
          <motion.div
            aria-hidden
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="absolute inset-0 bg-background/60 backdrop-blur-md"
          />

          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="welcome-title"
            initial={{ opacity: 0, scale: 0.85, y: 24 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.94, y: 8, transition: modalExit }}
            transition={modalSpring}
            className="relative w-full max-w-sm rounded-3xl border border-border-soft bg-surface p-6 text-center shadow-2xl"
          >
            <Mascota />

            <h2 id="welcome-title" className="mt-4 text-lg font-bold tracking-tight">
              ¡Bienvenido a tu cuenta!
            </h2>

            <p className="mt-2 text-sm leading-relaxed text-muted">
              Soy la <b className="text-accent">i</b> de información. Cuando me veas al lado
              de un dato, tocame y te explico qué significa, sin palabras raras.
            </p>

            <button
              type="button"
              onClick={cerrar}
              className="mt-6 inline-flex w-full items-center justify-center rounded-2xl bg-accent px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-accent/85"
            >
              Entendido
            </button>

            {/* El area tactil es la etiqueta entera, no solo el cuadrito: en
                celular apuntarle a una casilla de 16 px con el dedo es una
                pelea que no hace falta dar. */}
            <label className="mt-2 flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-xl px-2 text-xs text-muted transition-colors hover:text-foreground">
              <input
                type="checkbox"
                checked={noMostrarMas}
                onChange={(evento) => setNoMostrarMas(evento.target.checked)}
                className="h-4 w-4 shrink-0 accent-accent"
              />
              No mostrar este aviso otra vez
            </label>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body
  );
}

/**
 * El icono de ayuda, agrandado.
 *
 * Es el mismo dibujo que el usuario va a encontrar despues, chiquito, al lado
 * de cada dato — nada mas que a este tamaño y con un halo. La primera version
 * le agregaba ojos y sonrisa para que se leyera como personaje, pero el
 * resultado dejaba de leerse como la "i": no se entendia que era. El circulo
 * con la letra adentro es justamente lo reconocible; agregarle una cara lo
 * disfrazaba.
 */
function Mascota() {
  return (
    <span className="relative mx-auto flex h-24 w-24 items-center justify-center">
      {/* Halo que late, en CSS: la animacion infinita de framer-motion nunca
          termina, y eso impide que `AnimatePresence` desmonte el modal. */}
      <span
        aria-hidden
        className="absolute inset-0 animate-energia-pulse rounded-full bg-accent-soft"
      />

      <svg
        viewBox="0 0 80 80"
        role="img"
        aria-label="La i de información"
        className="relative h-20 w-20"
      >
        <circle cx="40" cy="40" r="34" className="fill-accent" />
        <circle cx="40" cy="26" r="4.2" className="fill-white" />
        <rect x="35.8" y="36" width="8.4" height="24" rx="4.2" className="fill-white" />
      </svg>
    </span>
  );
}
