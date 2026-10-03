'use client';

import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { TriangleAlert } from 'lucide-react';
import { modalExit, modalSpring } from '@/lib/motion';

/**
 * Confirmación al salir del asistente sin terminar.
 *
 * No es un cartel de "¿estás seguro?" por costumbre: cargar los aparatos es
 * lo que separa una recomendación genérica de una que nombra cosas del hogar,
 * y quien recién entra no tiene forma de saberlo. El cartel existe para
 * decírselo una vez, no para trabar la salida — por eso la opción de irse
 * está igual de disponible que la de quedarse.
 *
 * Se anima con framer-motion, no con CSS. Acá sí corresponde: es contenido
 * efímero, y si la animación fallara no se pierde nada de la pantalla (a
 * diferencia de las secciones y los KPIs, que pasaron a CSS justamente porque
 * quedarse en el estado inicial los dejaba invisibles).
 */
export function SkipHomeDialog({
  open,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  useEffect(() => {
    if (!open) return;

    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') onCancel();
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', onKey);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', onKey);
    };
  }, [open, onCancel]);

  if (typeof document === 'undefined') return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
          <motion.button
            type="button"
            aria-label="Cerrar"
            onClick={onCancel}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="absolute inset-0 bg-background/60 backdrop-blur-md"
          />

          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="skip-home-title"
            initial={{ opacity: 0, scale: 0.85, y: 24 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.94, y: 8, transition: modalExit }}
            transition={modalSpring}
            className="relative w-full max-w-sm rounded-3xl border border-border-soft bg-surface p-5 shadow-2xl"
          >
            <span className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-warn/15">
              <TriangleAlert className="h-5 w-5 text-warn" aria-hidden />
            </span>

            <h2 id="skip-home-title" className="text-base font-bold tracking-tight mb-2">
              ¿Seguro que querés omitirlo?
            </h2>
            <p className="text-sm leading-relaxed text-muted mb-5">
              Especificar los elementos de tu hogar ayuda a que las recomendaciones
              y las predicciones de consumo tengan mucha más exactitud. Podés
              configurarlo cuando quieras desde Ajustes.
            </p>

            <div className="flex flex-col gap-2.5">
              <button
                type="button"
                onClick={onCancel}
                className="inline-flex w-full items-center justify-center rounded-2xl bg-accent px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-accent/85"
              >
                De acuerdo, quiero configurar ahora
              </button>
              <button
                type="button"
                onClick={onConfirm}
                className="inline-flex w-full items-center justify-center rounded-2xl bg-surface-raised px-4 py-3 text-sm font-semibold text-muted transition-colors hover:text-foreground"
              >
                Entendido, lo hago después
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body
  );
}
