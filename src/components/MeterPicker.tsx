'use client';

import { useCallback, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Check, ChevronDown, MapPin, Zap } from 'lucide-react';
import { ROLE_LABEL, type MeterRole } from '@/domain/meter-role';
import { useMeterId } from '@/lib/use-meter-id';
import { usePolling } from '@/lib/use-polling';

/**
 * De qué medidor habla la pantalla, cuando hay más de uno.
 *
 * **No aparece con un solo medidor.** Un selector de una sola opción es una
 * decisión que no existe, y ocupa lugar en la barra de todas las pantallas.
 *
 * Al elegir se navega a la misma pantalla con el medidor en la dirección: así
 * la elección sobrevive al botón atrás, se puede compartir el enlace, y si el
 * medidor deja de existir el error es legible en vez de fantasma.
 *
 * Muestra lo que distingue a cada uno —el nombre, y si es central o de área
 * con su etiqueta— porque dos identificadores no le dicen nada a nadie. Lo
 * que **no** hace es relacionarlos: no hay totales, ni porcentajes, ni
 * jerarquía. Cada medidor mide lo suyo.
 */

type Option = {
  deviceId: string;
  name: string;
  role: MeterRole;
  areaLabel: string | null;
};

/** La lista cambia poco: alcanza con releerla de vez en cuando. */
const POLL_INTERVAL_MS = 300000;

export function MeterPicker() {
  const router = useRouter();
  const pathname = usePathname();
  const selected = useMeterId();

  const [meters, setMeters] = useState<Option[] | null>(null);
  const [open, setOpen] = useState(false);

  const load = useCallback(async () => {
    try {
      const response = await fetch('/api/meters', { cache: 'no-store' });
      if (!response.ok) return;
      const payload = await response.json();
      setMeters(payload.meters as Option[]);
    } catch {
      // Sin lista no se puede elegir, y no hay nada que avisar: el selector
      // simplemente no aparece. Las pantallas siguen funcionando con el
      // medidor que resuelva el backend.
    }
  }, []);

  usePolling(load, POLL_INTERVAL_MS);

  if (!meters || meters.length < 2) return null;

  const actual = meters.find((meter) => meter.deviceId === selected) ?? meters[0];

  function choose(deviceId: string) {
    setOpen(false);
    router.push(`${pathname}?deviceId=${encodeURIComponent(deviceId)}`);
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="inline-flex max-w-[12rem] items-center gap-1.5 rounded-lg border border-border-soft bg-surface-raised px-2.5 py-1.5 text-xs font-semibold text-foreground transition-colors hover:border-accent"
      >
        {actual.role === 'central' ? (
          <Zap className="h-3.5 w-3.5 shrink-0 text-accent" />
        ) : (
          <MapPin className="h-3.5 w-3.5 shrink-0 text-accent" />
        )}
        <span className="truncate">{actual.name}</span>
        <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted" />
      </button>

      {open && (
        <>
          {/* Cierra al tocar afuera, sin atrapar el foco: es un selector, no
              un diálogo. */}
          <button
            type="button"
            aria-label="Cerrar"
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-40 cursor-default"
          />

          <ul
            role="listbox"
            className="absolute right-0 top-full z-50 mt-1.5 w-60 overflow-hidden rounded-xl border border-border-soft bg-surface shadow-xl"
          >
            {meters.map((meter) => {
              const isSelected = meter.deviceId === actual.deviceId;
              return (
                <li key={meter.deviceId}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    onClick={() => choose(meter.deviceId)}
                    className={`flex w-full items-center gap-2.5 px-3 py-2.5 text-left transition-colors ${
                      isSelected ? 'bg-accent-soft' : 'hover:bg-surface-raised'
                    }`}
                  >
                    <span className={isSelected ? 'text-accent' : 'text-muted'}>
                      {meter.role === 'central' ? (
                        <Zap className="h-4 w-4" />
                      ) : (
                        <MapPin className="h-4 w-4" />
                      )}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold">{meter.name}</span>
                      <span className="block truncate text-[11px] text-muted">
                        {meter.role === 'central'
                          ? ROLE_LABEL.central
                          : meter.areaLabel || ROLE_LABEL.area}
                      </span>
                    </span>
                    {isSelected && <Check className="h-4 w-4 shrink-0 text-accent" />}
                  </button>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </div>
  );
}
