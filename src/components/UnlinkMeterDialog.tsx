'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Check, TriangleAlert, X } from 'lucide-react';
import {
  DEFAULT_COLLECTION_INTERVAL_MINUTES,
  DEFAULT_SENSITIVITY,
} from '@/domain/meter-defaults';
import { SENSITIVITY_LABEL } from '@/domain/sensitivity';
import { modalExit, modalSpring } from '@/lib/motion';

/**
 * Confirmación al desvincular un medidor de la cuenta.
 *
 * Desvincular no es borrar, pero tampoco es inocuo, y las dos mitades hay que
 * decirlas **antes** y no después.
 *
 * Lo que se conserva va primero, y no por amabilidad: es lo que cambia cómo
 * se siente la decisión. Sin eso cualquiera asume que está por tirar meses de
 * mediciones. Y está comprobado, no supuesto — se desvinculó y revinculó el
 * medidor real varias veces y las 18.338 lecturas quedaron enteras.
 *
 * La lista de lo que se pierde enumeraba antes solo el contexto del lugar, y
 * **avisaba de menos**: también se van el intervalo de guardado, los
 * umbrales, la sensibilidad, el objetivo y la preferencia de avisos. Eso pasó
 * de verdad: un medidor revinculado quedó guardando cada 6 horas en lugar de
 * cada 5 minutos y el histórico dejó de crecer durante tres horas, sin un
 * solo error a la vista. Un cartel que avisa de menos es peor que no tener
 * cartel, porque se lo lee para decidir.
 *
 * "Cada cuánto guarda las mediciones" y no "intervalo de recolección": es
 * justo el ajuste cuya pérdida apagó el histórico, y si no se entiende no
 * sirve de aviso.
 *
 * El último párrafo nombra los números en vez de decir "vuelve a la
 * configuración inicial", que no le dice nada a nadie. Salen de
 * `meter-defaults.ts`, el mismo archivo con el que el backend da de alta un
 * medidor, para que la pantalla no pueda prometer algo distinto de lo que
 * realmente va a pasar.
 */
export function UnlinkMeterDialog({
  open,
  meterName,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  meterName: string;
  onConfirm: () => Promise<void> | void;
  onCancel: () => void;
}) {
  const [working, setWorking] = useState(false);

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
            aria-labelledby="unlink-title"
            initial={{ opacity: 0, scale: 0.85, y: 24 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.94, y: 8, transition: modalExit }}
            transition={modalSpring}
            className="relative w-full max-w-md rounded-3xl border border-border-soft bg-surface p-5 shadow-2xl"
          >
            <span className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-warn/15">
              <TriangleAlert className="h-5 w-5 text-warn" aria-hidden />
            </span>

            <h2 id="unlink-title" className="text-base font-bold tracking-tight mb-2">
              Vas a desvincular {meterName}
            </h2>
            <p className="text-sm leading-relaxed text-muted mb-4">
              El medidor sale de tu cuenta y dejás de ver sus pantallas.
            </p>

            <div className="space-y-2.5 mb-4">
              <div className="rounded-xl border border-ok/40 bg-ok/5 px-4 py-3">
                <p className="flex items-center gap-1.5 text-xs font-bold text-ok mb-1.5">
                  <Check className="h-3.5 w-3.5" />
                  Se conserva
                </p>
                <p className="text-xs leading-relaxed text-muted">
                  Todas las mediciones y todos los eventos registrados. Si volvés a
                  vincular este mismo medidor, recuperás el historial completo.
                </p>
              </div>

              <div className="rounded-xl border border-warn/40 bg-warn/10 px-4 py-3">
                <p className="flex items-center gap-1.5 text-xs font-bold text-warn mb-1.5">
                  <X className="h-3.5 w-3.5" />
                  Se pierde, y hay que volver a cargarlo
                </p>
                <ul className="space-y-1 text-xs leading-relaxed text-warn/90">
                  <li>· El tipo de lugar, sus ambientes y los aparatos.</li>
                  <li>· Cada cuánto guarda las mediciones.</li>
                  <li>· Los umbrales de tensión y el grado de sensibilidad.</li>
                  <li>· El objetivo de consumo del mes.</li>
                  <li>· Si los avisos están activados.</li>
                  <li>· Las cuentas invitadas a ver este medidor.</li>
                </ul>
              </div>
            </div>

            <p className="text-xs leading-relaxed text-muted mb-5">
              Al volver a vincularlo, el medidor arranca con la configuración
              inicial: guardado{' '}
              <b className="text-foreground">
                cada {DEFAULT_COLLECTION_INTERVAL_MINUTES} minutos
              </b>{' '}
              y sensibilidad{' '}
              <b className="text-foreground">
                {SENSITIVITY_LABEL[DEFAULT_SENSITIVITY].toLowerCase()}
              </b>
              .
            </p>

            <div className="flex flex-col gap-2.5">
              <button
                type="button"
                onClick={onCancel}
                disabled={working}
                className="inline-flex w-full items-center justify-center rounded-2xl bg-accent px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-accent/85 disabled:opacity-60"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={working}
                onClick={async () => {
                  setWorking(true);
                  try {
                    await onConfirm();
                  } finally {
                    setWorking(false);
                  }
                }}
                className="inline-flex w-full items-center justify-center rounded-2xl bg-surface-raised px-4 py-3 text-sm font-semibold text-muted transition-colors hover:text-danger disabled:opacity-60"
              >
                {working ? 'Desvinculando…' : 'Desvincular'}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body
  );
}
