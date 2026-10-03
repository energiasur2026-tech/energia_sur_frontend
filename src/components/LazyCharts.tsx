'use client';

import dynamic from 'next/dynamic';

/**
 * Los gráficos se cargan aparte del resto de la aplicación.
 *
 * Recharts pesa unos 390 KB — el paquete más grande que envía la app, más que
 * todo lo demás junto. Importándolo de la forma habitual viaja en el paquete
 * inicial, así que hay que terminar de descargarlo antes de que la pantalla
 * sea usable, aunque el gráfico esté abajo de todo o directamente no se llegue
 * a ver nunca. Con `next/dynamic` se descarga recién cuando un gráfico se va a
 * dibujar de verdad: los números y los controles aparecen primero, y quien
 * nunca despliega el gráfico de un evento jamás lo descarga.
 *
 * `ssr: false` no es una preferencia: estos gráficos leen sus colores del CSS
 * con `getComputedStyle`, que en el servidor no existe. Dibujarlos ahí daría
 * un gráfico sin colores que después habría que corregir al hidratar.
 *
 * El marcador de carga tiene EXACTAMENTE el alto del gráfico que reemplaza.
 * Sin eso, el contenido de abajo saltaría al llegar el gráfico, que es de las
 * cosas más molestas que puede hacer una página mientras carga.
 */

function Placeholder({ height }: { height: number }) {
  return (
    <div
      style={{ height }}
      aria-hidden
      className="w-full animate-pulse rounded-xl bg-surface-raised motion-reduce:animate-none"
    />
  );
}

export const HistoryChart = dynamic(
  () => import('./HistoryChart').then((mod) => mod.HistoryChart),
  { ssr: false, loading: () => <Placeholder height={256} /> }
);

export const EventChart = dynamic(() => import('./EventChart').then((mod) => mod.EventChart), {
  ssr: false,
  loading: () => <Placeholder height={180} />,
});

export const MonthChart = dynamic(() => import('./MonthChart').then((mod) => mod.MonthChart), {
  ssr: false,
  loading: () => <Placeholder height={240} />,
});

export const HourlyProfile = dynamic(
  () => import('./HourlyProfile').then((mod) => mod.HourlyProfile),
  { ssr: false, loading: () => <Placeholder height={220} /> }
);
