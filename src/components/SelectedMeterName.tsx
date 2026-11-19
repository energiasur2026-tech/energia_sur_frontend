'use client';

import { useCallback, useState } from 'react';
import { usePathname } from 'next/navigation';
import { apiUrl, useMeterId } from '@/lib/use-meter-id';
import { usePolling } from '@/lib/use-polling';

export function useSelectedMeterName(deviceId: string | null) {
  const [meter, setMeter] = useState<{ deviceId: string | null; name: string }>();
  const load = useCallback(async () => {
    try {
      const response = await fetch(apiUrl('/api/meter/settings', deviceId), { cache: 'no-store' });
      if (response.ok) {
        const { name } = await response.json();
        setMeter({ deviceId, name });
      }
    } catch {
      // La lectura del nombre es complementaria.
    }
  }, [deviceId]);
  usePolling(load, 300000);
  return meter?.deviceId === deviceId ? meter.name : '';
}

function MeterNameLabel() {
  const name = useSelectedMeterName(useMeterId());
  return name ? <p className="max-w-6xl w-full mx-auto px-4 md:px-8 pt-3 text-xs text-muted">Medidor: {name}</p> : null;
}

export function SelectedMeterName() {
  const path = usePathname();
  return path === '/medidores' || path === '/dashboard' ? null : <MeterNameLabel />;
}
