'use client';

import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { TriangleAlert } from 'lucide-react';
import { modalExit, modalSpring } from '@/lib/motion';
import { SENSITIVITY_LABEL, SENSITIVITY_RANGES, type Sensitivity } from '@/domain/sensitivity';
import type { MeterThresholds } from '@/lib/threshold-types';

/**
 * Confirmación antes de reemplazar unos umbrales puestos a mano.
 *
 * Unos umbrales personalizados son una decisión de alguien, y a veces una que
 * importa: el valor histórico de este proyecto (202,4 – 237,6 V) es la
 * tolerancia de ±8% del ENRE, y ninguno de los tres grados coincide con ella.
 * Elegir un grado los reemplaza. El backend acepta umbrales explícitos, así
 * que la vuelta es posible, pero solo para quien se haya anotado los números:
 * una vez reemplazados, la aplicación ya no los recuerda en ningún lado.
 *
 * Ese es todo el motivo de este cartel. Tocar una opción para ver qué hace no
 * puede ser suficiente para perderlos sin haberlos visto.
 *
 * Solo aparece cuando hay algo que perder: si la sensibilidad ya es uno de
 * los tres grados, cambiarla no destruye nada y no se pregunta nada.
 */
export function ReplaceThresholdsDialog({
  open,
  target,
  current,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  /** El grado que el usuario acaba de elegir. */
  target: Sensitivity | null;
  /** Los umbrales que hay hoy, los que se van a perder. */
  current: MeterThresholds | null;
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

  const nuevo = target && target !== 'personalizada' ? SENSITIVITY_RANGES[target] : null;

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
            aria-labelledby="replace-thresholds-title"
            initial={{ opacity: 0, scale: 0.85, y: 24 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.94, y: 8, transition: modalExit }}
            transition={modalSpring}
            className="relative w-full max-w-sm rounded-3xl border border-border-soft bg-surface p-5 shadow-2xl"
          >
            <span className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-warn/15">
              <TriangleAlert className="h-5 w-5 text-warn" aria-hidden />
            </span>

            <h2 id="replace-thresholds-title" className="text-base font-bold tracking-tight mb-2">
              Esto reemplaza tus umbrales
            </h2>

            <p className="text-sm leading-relaxed text-muted mb-4">
              Este medidor avisa fuera de{' '}
              <b className="text-foreground tabular-nums">
                {current ? `${current.lowVoltageV}–${current.highVoltageV} V` : 'un rango propio'}
              </b>
              , un rango puesto a mano. Si elegís{' '}
              <b className="text-foreground">
                {target ? SENSITIVITY_LABEL[target] : 'otro grado'}
              </b>
              , pasa a avisar fuera de{' '}
              <b className="text-foreground tabular-nums">
                {nuevo ? `${nuevo.lowVoltageV}–${nuevo.highVoltageV} V` : 'otro rango'}
              </b>
              .
            </p>

            <p className="rounded-xl border border-warn/40 bg-warn/10 px-4 py-3 text-xs leading-relaxed text-warn mb-5">
              Si querés volver a estos valores después, vas a tener que
              escribirlos de nuevo. Anotalos antes de seguir.
            </p>

            <div className="flex flex-col gap-2.5">
              <button
                type="button"
                onClick={onCancel}
                className="inline-flex w-full items-center justify-center rounded-2xl bg-accent px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-accent/85"
              >
                Dejar los míos como están
              </button>
              <button
                type="button"
                onClick={onConfirm}
                className="inline-flex w-full items-center justify-center rounded-2xl bg-surface-raised px-4 py-3 text-sm font-semibold text-muted transition-colors hover:text-foreground"
              >
                Reemplazar de todos modos
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body
  );
}
