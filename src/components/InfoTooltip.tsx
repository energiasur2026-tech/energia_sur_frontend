'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Info, X } from 'lucide-react';
import { DURATION_FAST, EASE_OUT, modalExit, modalSpring } from '@/lib/motion';
import { useCoarsePointer } from '@/lib/use-coarse-pointer';

/**
 * Tamanos del icono, proporcionales al texto que acompanan.
 *
 * La caja del boton mide EXACTAMENTE lo que el dibujo. El area tactil se
 * agranda con un pseudo-elemento absoluto (`after:-inset-2`), que no ocupa
 * lugar en el layout. Antes se agrandaba con padding y margen negativo: eso
 * convertia un icono de 15 px en una caja de 27 px, y como la fila alinea por
 * arriba, el dibujo quedaba 6 px mas abajo que el texto de al lado. Se veia
 * en todas las secciones.
 */
const SIZE = {
  sm: 'h-[15px] w-[15px]',
  md: 'h-[17px] w-[17px]',
} as const;

export type InfoTooltipSize = keyof typeof SIZE;

type Props = {
  text: string;
  /**
   * De que dato habla esta explicacion. En celular el modal tapa la pantalla:
   * sin titulo, quien lo abre pierde de vista cual de todos los indicadores
   * estaba consultando.
   */
  title?: string;
  size?: InfoTooltipSize;
};

export function InfoTooltip({ text, title, size = 'sm' }: Props) {
  const [open, setOpen] = useState(false);
  const isCoarse = useCoarsePointer();
  const wrapRef = useRef<HTMLSpanElement>(null);
  const tooltipId = useId();

  // En escritorio, un clic afuera cierra el cartel anclado.
  useEffect(() => {
    if (!open || isCoarse) return;

    function onOutside(event: PointerEvent) {
      if (wrapRef.current && !wrapRef.current.contains(event.target as Node)) setOpen(false);
    }

    document.addEventListener('pointerdown', onOutside);
    return () => document.removeEventListener('pointerdown', onOutside);
  }, [open, isCoarse]);

  // Con el modal abierto, Escape cierra y el fondo no scrollea.
  useEffect(() => {
    if (!open || !isCoarse) return;

    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false);
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', onKey);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', onKey);
    };
  }, [open, isCoarse]);

  return (
    <span
      ref={wrapRef}
      className="relative inline-flex shrink-0 align-middle"
      onMouseEnter={() => !isCoarse && setOpen(true)}
      onMouseLeave={() => !isCoarse && setOpen(false)}
    >
      <button
        type="button"
        onClick={() => setOpen((visible) => !visible)}
        aria-expanded={open}
        aria-controls={open ? tooltipId : undefined}
        aria-label={title ? `Que significa ${title}` : 'Mas informacion'}
        className="relative inline-flex text-muted transition-colors hover:text-foreground after:absolute after:-inset-2 after:content-['']"
      >
        <Info className={SIZE[size]} aria-hidden />
      </button>

      {/* Escritorio: cartel anclado al icono. */}
      {!isCoarse && (
        <AnimatePresence>
          {open && (
            <motion.span
              id={tooltipId}
              role="tooltip"
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -2 }}
              transition={{ duration: DURATION_FAST, ease: EASE_OUT }}
              className="absolute z-30 top-full mt-2 left-1/2 -translate-x-1/2 w-60 rounded-lg border border-border-soft bg-surface-raised px-3 py-2.5 text-xs leading-relaxed text-muted shadow-lg"
            >
              {title && (
                <span className="mb-1 block font-semibold uppercase tracking-wide text-foreground">
                  {title}
                </span>
              )}
              {text}
            </motion.span>
          )}
        </AnimatePresence>
      )}

      {/* Celular: modal centrado. Va por portal para que ningun contenedor
          con overflow oculto lo recorte. */}
      {isCoarse &&
        createPortal(
          <AnimatePresence>
            {open && (
              <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
                <motion.button
                  type="button"
                  aria-label="Cerrar"
                  onClick={() => setOpen(false)}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="absolute inset-0 bg-background/60 backdrop-blur-md"
                />

                <motion.div
                  id={tooltipId}
                  role="dialog"
                  aria-modal="true"
                  aria-labelledby={title ? `${tooltipId}-title` : undefined}
                  initial={{ opacity: 0, scale: 0.85, y: 24 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.94, y: 8, transition: modalExit }}
                  transition={modalSpring}
                  className="relative w-full max-w-xs rounded-3xl border border-border-soft bg-surface p-5 shadow-2xl"
                >
                  <div className="flex items-start gap-3">
                    <span className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-accent-soft">
                      <Info className="h-[18px] w-[18px] text-accent" aria-hidden />
                    </span>
                    <div className="min-w-0">
                      {title && (
                        <h2
                          id={`${tooltipId}-title`}
                          className="mb-1 text-sm font-semibold leading-snug text-foreground"
                        >
                          {title}
                        </h2>
                      )}
                      <p className="text-sm leading-relaxed text-muted">{text}</p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    className="mt-5 inline-flex w-full items-center justify-center gap-1.5 rounded-2xl bg-surface-raised px-4 py-3 text-sm font-semibold text-muted transition-colors hover:text-foreground"
                  >
                    <X className="h-3.5 w-3.5" />
                    Entendido
                  </button>
                </motion.div>
              </div>
            )}
          </AnimatePresence>,
          document.body
        )}
    </span>
  );
}
