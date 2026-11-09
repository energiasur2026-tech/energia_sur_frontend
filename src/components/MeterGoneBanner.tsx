'use client';

import { useEffect } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { TriangleAlert } from 'lucide-react';
import { useMeterId } from '@/lib/use-meter-id';

/**
 * Qué pasa cuando la dirección apunta a un medidor que ya no está.
 *
 * Es el caso que va a ocurrir: alguien desvincula un medidor desde otra
 * sesión, o le revocan un acceso compartido, y vuelve a una pestaña abierta o
 * a un enlace guardado. Sin esto, todas las pantallas responderían 404 y la
 * persona vería una app rota sin entender por qué.
 *
 * Se explica y se corrige: se vuelve a la misma pantalla sin medidor elegido
 * —y entonces el backend resuelve el primero accesible— con un cartel que
 * dice qué pasó. Ese es el motivo de tener la elección en la dirección y no
 * escondida en memoria: acá hay algo concreto que contar.
 *
 * **La corrección recarga la página, no navega.** Las pantallas ya tenían
 * pedidos en vuelo contra el medidor que no existe, y esas respuestas vuelven
 * con su 404 *después* de la corrección: pisaban el estado bueno y dejaban un
 * cartel rojo de "no tenés medidor" encima de datos que cargaban bien. Una
 * recarga no deja nada viejo con qué pisar. Es un camino raro —un medidor que
 * se fue— así que el costo no importa; la contradicción sí.
 *
 * El aviso viaja en la dirección (`meterGone`) justamente para sobrevivir a
 * esa recarga.
 *
 * Solo consulta cuando hay un medidor en la dirección. Una cuenta con uno
 * solo nunca lo tiene, así que no paga nada.
 */
/** Marca en la dirección de que el medidor pedido ya no estaba. */
const MARCA = 'meterGone';

export function MeterGoneBanner() {
  const deviceId = useMeterId();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const gone = params.get(MARCA) === '1';

  useEffect(() => {
    // Sin medidor en la dirección no hay nada que verificar.
    if (!deviceId) return;

    let cancelado = false;

    (async () => {
      try {
        const response = await fetch('/api/meters', { cache: 'no-store' });
        if (!response.ok || cancelado) return;

        const payload = await response.json();
        const existe = (payload.meters as { deviceId: string }[]).some(
          (meter) => meter.deviceId === deviceId
        );

        if (existe || cancelado) return;

        // Recarga completa, no navegación: ver el encabezado.
        window.location.replace(`${pathname}?${MARCA}=1`);
      } catch {
        // Un problema de red no es un medidor que falta. Callarse acá es
        // mejor que avisar de algo que no pasó.
      }
    })();

    return () => {
      cancelado = true;
    };
  }, [deviceId, pathname]);

  if (!gone) return null;

  return (
    <div className="border-b border-warn/40 bg-warn/10 px-4 py-3 md:px-6">
      <div className="mx-auto flex max-w-6xl items-start gap-2.5">
        <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-warn" />
        <p className="text-xs leading-relaxed text-warn">
          El medidor que estabas mirando ya no está en tu cuenta: puede haber sido
          desvinculado, o te revocaron el acceso. Te mostramos otro de los tuyos.
        </p>
        <button
          type="button"
          onClick={() => router.replace(pathname)}
          aria-label="Cerrar aviso"
          className="ml-auto shrink-0 text-warn transition-opacity hover:opacity-70"
        >
          ×
        </button>
      </div>
    </div>
  );
}
