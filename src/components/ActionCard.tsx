'use client';

import Link from 'next/link';
import { ArrowRight, ListChecks } from 'lucide-react';
import type { Recommendation } from '@/lib/recommendations';

/**
 * Acciones sugeridas en el Monitor.
 *
 * Muestra solo las accionables (no las de "vas bien") y a lo sumo dos: el
 * Monitor es una pantalla de un vistazo, y el detalle completo vive en
 * Proyección.
 */
export function ActionCard({ recommendations }: { recommendations: Recommendation[] }) {
  const actionable = recommendations.filter((item) => item.tone === 'action').slice(0, 2);
  if (actionable.length === 0) return null;

  return (
    <section className="mb-6 rounded-2xl border border-warn/40 bg-warn/5 p-4 md:p-5">
      <div className="flex items-center gap-2 mb-3">
        <ListChecks className="h-4 w-4 text-warn" />
        <h2 className="text-sm font-semibold">Para volver a tu objetivo</h2>
      </div>

      {/* Título y ahorro en líneas separadas: mezclados en un mismo párrafo,
          el corte de línea caía en cualquier parte y se leía desprolijo. */}
      <ul className="space-y-3">
        {actionable.map((item) => (
          <li key={item.id}>
            <p className="text-sm font-medium leading-snug">{item.title}</p>
            {item.impact && (
              <p className="mt-0.5 text-xs text-muted">Ahorro estimado: {item.impact}</p>
            )}
          </li>
        ))}
      </ul>

      <Link
        href="/proyeccion"
        className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold text-accent hover:underline"
      >
        Ver el detalle y cómo hacerlo
        <ArrowRight className="h-3.5 w-3.5" />
      </Link>
    </section>
  );
}
