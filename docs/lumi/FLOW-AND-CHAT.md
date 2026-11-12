# Pendientes, historial y conversación

La navegación automática estaba en onSaved: setView('history'). Ahora guardar solo actualiza la confirmación y los datos; el cambio de vista ocurre por un botón del usuario. La selección sigue siendo un borrador. En Pendientes se ancla la siguiente tarjeta con scroll relativo al contenedor y foco sin desplazamiento adicional; el retiro de la última consulta muestra un estado vacío.

El historial usa encabezados de acordeón con fecha del evento, tipo y estado. La fecha de respuesta se muestra aparte y no interviene en el orden. Editar conserva el registro abierto. Los filtros están fuera de la única lista desplazable y el encabezado ilustrado se reduce en Avisos.

Pruebas: npm run test:lumi (Node 24) ejecuta los componentes reales en DOM e incluye selección, envíos consecutivos, scroll/foco, última respuesta, edición, cancelación, errores, acordeones, contexto y contraste de ambas paletas.

El chat conserva el análisis existente al recibir snapshots de saludos/aclaraciones sin lecturas. No guarda contexto entre medidores en el navegador: MeterContextBoundary desmonta el widget al cambiar usuario o medidor.

Compilación local verificada con `next build --webpack` en frontend y backend. El iniciador `npm run local:stack` detecta Node 22+ y Python 3.11+ instalados; debe mantenerse abierta la terminal. Las verificaciones visuales usan el componente real y datos sintéticos, no la sesión ni las lecturas de un cliente.

## Memoria v2
Preferencias incorpora Lo que Lumi recuerda, edición explícita, borrado confirmado, pausa, referencia de suministro y adopción de consejo. verify-lumi-memory.cjs prueba los controles reales. La revisión visual nueva quedó bloqueada por el control de navegador; falta confirmarla manualmente. Ver IMPLEMENTATION-v2.md en ML.
