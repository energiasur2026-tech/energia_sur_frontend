'use client';

import { useCallback, useState } from 'react';
import { intervalLabel } from '@/lib/collection-intervals';
import { formatRelativeMinutes } from '@/lib/format';
import { usePolling } from '@/lib/use-polling';
import { InfoTooltip } from './InfoTooltip';

type Status = { lastScheduledAt: string | null; active: boolean; intervalMinutes: number };

/** El estado no cambia rápido: alcanza con revisarlo una vez por minuto. */
const POLL_INTERVAL_MS = 60000;

export function CollectorStatus() {
  const [status, setStatus] = useState<Status | null>(null);

  const fetchStatus = useCallback(async () => {
    try {
      const response = await fetch('/api/meter/collector-status', { cache: 'no-store' });
      if (!response.ok) return;
      setStatus((await response.json()) as Status);
    } catch {
      // Es un indicador informativo; si falla, simplemente no se actualiza.
    }
  }, []);

  usePolling(fetchStatus, POLL_INTERVAL_MS);

  if (!status) return null;

  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium ${
        status.active ? 'border-ok/40 bg-ok/10 text-ok' : 'border-warn/40 bg-warn/10 text-warn'
      }`}
    >
      <span className={`h-2 w-2 rounded-full ${status.active ? 'bg-ok' : 'bg-warn'}`} />
      Recolección automática · {formatRelativeMinutes(status.lastScheduledAt)}
      <InfoTooltip
        title="Recolección automática"
        text={`Un proceso en el servidor guarda una lectura ${intervalLabel(
          status.intervalMinutes
        ).toLowerCase()}, aunque no tengas esta página abierta. Podés cambiar la frecuencia en Ajustes.`}
      />
    </span>
  );
}
