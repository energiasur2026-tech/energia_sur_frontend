# Ajustes y proyección

La barra de escritorio puede ser superior o lateral desde Ajustes. La preferencia se guarda por usuario en este navegador. En celular se conserva la navegación inferior. Mis datos permite entrar explícitamente en edición, cancelar el borrador y guardar mediante la API autenticada de perfiles.

## Reparación pendiente en Supabase

El error GOAL_SCHEMA_MISSING identifica una tabla o columna faltante. No se resuelve cambiando el proveedor ni convirtiendo el objetivo a kWh. Ejecutar en SQL Editor del proyecto Supabase usado por el backend el archivo `energIA_sur_backend/supabase/repairs/restore_settings_and_goals.sql`. Crea las estructuras de objetivos personales y perfiles cuando faltan, conserva registros existentes y mantiene RLS. No simula un guardado local ni reemplaza el objetivo anterior. La aplicación sigue guardando por usuario y medidor.

Después de ejecutar la reparación, guardar nuevamente el objetivo de 50.000 pesos y comprobar que se conserva después de recargar. La conversión depende de la tarifa documentada y configurada para ese suministro; no significa factura final.

## Lecturas hasta el 3 de noviembre

No se pudo consultar desde este entorno el historial real del proyecto Supabase. Se corrigió la paginación para respetar páginas REST configuradas con menos de 1000 filas y la interpretación de contadores numéricos recibidos como texto. La gráfica indica ahora hasta qué fecha dispone de energía válida, si existen registros posteriores sin energía válida, y permite actualizar las mediciones sin cambiar de pantalla.

El archivo `energIA_sur_backend/supabase/repairs/diagnose_monthly_readings.sql` es una consulta de solo lectura. Devuelve por medidor cantidad de muestras, fecha del último registro y fecha de la última lectura válida de energía del mes actual en Argentina. Si ambas fechas terminan el 3/11, revisar el recolector y su programación; si hay registros posteriores sin energía, revisar el contador recibido por la integración. No extender artificialmente la curva hasta hoy ni rellenar huecos con cero.

## Validación

Frontend: `npm run test:settings`, pruebas de gráfico mensual, borradores y contrato de proyección. Backend: pruebas `lumi-readings.test.ts`, `monthly-projection.test.ts` y `personal-goals.test.ts`, incluyendo paginación limitada a 100 filas y contador textual con muestras del 16/11. TypeScript y ESLint para los componentes modificados. La comprobación visual en el navegador del usuario y la aplicación del SQL permanecen pendientes.
