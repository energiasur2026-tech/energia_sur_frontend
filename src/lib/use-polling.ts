'use client';

import { useEffect } from 'react';

/**
 * Ejecuta `task` de forma periódica mientras el componente esté montado Y la
 * pestaña esté a la vista.
 *
 * La primera ejecución se agenda (no se dispara en el cuerpo del efecto) para
 * que la actualización de estado ocurra siempre en un callback asincrónico y no
 * encadene renders. Al desmontar, se cancelan tanto el timer como la corrida en
 * vuelo, evitando que una respuesta tardía escriba estado ya descartado.
 *
 * Con la pestaña oculta el ciclo se detiene. El Monitor consulta el medidor
 * cada 5 segundos: una pestaña olvidada en segundo plano hacía 720 consultas
 * por hora a la API de Tuya, con sus escrituras en la base, para una pantalla
 * que nadie está mirando. Al volver, se ejecuta de inmediato en vez de esperar
 * el próximo turno, así lo primero que se ve es un dato fresco y no el de hace
 * media hora.
 */
export function usePolling(task: () => void, intervalMs: number) {
  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setInterval> | null = null;

    const run = () => {
      if (!cancelled) task();
    };

    const start = () => {
      if (timer !== null) return;
      timer = setInterval(run, intervalMs);
    };

    const stop = () => {
      if (timer === null) return;
      clearInterval(timer);
      timer = null;
    };

    const onVisibility = () => {
      if (document.hidden) {
        stop();
      } else {
        run();
        start();
      }
    };

    const initial = setTimeout(run, 0);
    if (!document.hidden) start();
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      cancelled = true;
      clearTimeout(initial);
      stop();
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [task, intervalMs]);
}
