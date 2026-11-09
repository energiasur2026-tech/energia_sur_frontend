'use client';
import { meterFetch } from '@/lib/meter-fetch';

import { useCallback, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, TriangleAlert } from 'lucide-react';
import { formatDuration } from '@/lib/format';
import { EVENT_LABEL, type EventRecord } from '@/lib/event-types';
import { apiUrl, useMeterId } from '@/lib/use-meter-id';
import { usePolling } from '@/lib/use-polling';

const POLL_INTERVAL_MS = 60000;

/**
 * Aviso en el Monitor cuando hay anomalías en curso. No repite el historial
 * completo: solo señala que hay algo pasando ahora y lleva a la vista de
 * Eventos, que es donde está el detalle.
 */
export function ActiveEventsBanner() {
  // De qué medidor habla esta pantalla. Lo dice la dirección del navegador.
  const deviceId = useMeterId();
  const [active, setActive] = useState<EventRecord[]>([]);

  const fetchActive = useCallback(async () => {
    try {
<<<<<<< HEAD
      const response = await meterFetch('/api/meter/events', { cache: 'no-store' });
=======
      const response = await fetch(apiUrl('/api/meter/events', deviceId), { cache: 'no-store' });
>>>>>>> 7f21ccba3e0b56e6065aa996f9b48d8a51260d79
      if (!response.ok) return;

      const payload = (await response.json()) as { events: EventRecord[] };
      setActive(payload.events.filter((event) => event.endedAt === null));
    } catch {
      // Es un aviso complementario: si falla, el Monitor sigue funcionando.
    }
  }, [deviceId]);

  usePolling(fetchActive, POLL_INTERVAL_MS);

  if (active.length === 0) return null;

  const critical = active.some((event) => event.severity === 'CRITICAL');
  const tone = critical
    ? 'border-danger/40 bg-danger/10 text-danger'
    : 'border-warn/40 bg-warn/10 text-warn';

  return (
    <Link
      href="/eventos"
      className={`mb-6 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border px-4 py-3 text-sm transition-opacity hover:opacity-80 ${tone}`}
    >
      <TriangleAlert className="h-4 w-4 shrink-0" />
      <span className="font-semibold">
        {active.length === 1 ? '1 anomalía en curso' : `${active.length} anomalías en curso`}
      </span>
      <span className="opacity-80">
        {active
          .map((event) => `${EVENT_LABEL[event.type]} · ${formatDuration(event.startedAt, null)}`)
          .join(' — ')}
      </span>
      <ArrowRight className="h-4 w-4 ml-auto shrink-0" />
    </Link>
  );
}
