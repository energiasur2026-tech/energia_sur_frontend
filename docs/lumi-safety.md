# Consejos preventivos de Lumi

Implementación local al frontend, independiente del servicio ML. Los originales siguen en machine_learning/img. La copia pública está en public/assets/lumi/safety.

- safety-policy.ts: catálogo, configuración y política pura de rotación.
- LumiSafety.tsx: tiempo activo, almacenamiento por usuario, exclusión entre pestañas con Web Locks, biblioteca manual y preferencia.
- safety.module.css: aviso compacto y diálogo adaptable, sin animaciones.
- LumiWidget.tsx: entrada Consejos de seguridad dentro de Lumi.
- ActiveEventsBanner.tsx: marcador de alerta crítica activa.

Producción: 90 segundos de actividad (pestaña visible, con foco y una interacción en el último minuto); una presentación por sesión de pestaña, persistida en sessionStorage; 72 horas entre presentaciones en localStorage. Ambas claves incluyen el usuario autenticado. Web Locks serializa la comprobación y escritura entre pestañas. Navegadores sin Web Locks o almacenamiento disponible conservan consulta manual y no presentan consejos automáticamente. Al cerrar, el intervalo ya está registrado. Al completar los tres consejos comienza otro ciclo.

La preferencia y el historial son locales a este navegador; no se sincronizan entre dispositivos. Se mantienen separados de las preferencias del servicio ML para permitir usarlos aunque dicho servicio esté caído.

Se posterga durante conversaciones, otros diálogos, campos en edición, configuración/medidores, pestaña oculta y alertas críticas conocidas. Las alertas activas se consultan con la API existente de eventos cada minuto. Integraciones futuras pueden usar data-lumi-safety-block="true" para procesos importantes y data-critical-active="true" para alertas críticas.

## Prueba rápida

Iniciar el frontend en desarrollo y abrir /dashboard?lumiSafetyTest=1. Solo en development: espera activa de 5 segundos e intervalo de 15 segundos; producción ignora el parámetro. Hacer clic en un lugar libre de la pantalla y mantenerla visible, con Lumi cerrado. El aviso abre la imagen únicamente al pulsar Ver consejo.

La regla de una presentación por sesión sigue vigente. Para repetir en la misma pestaña, borrar únicamente la clave `energia-sur:lumi-safety:v1:<id-usuario>:session` de sessionStorage desde las herramientas del navegador, esperar el intervalo y recargar. Para iniciar desde cero, borrar también la clave homónima sin :session de localStorage. No borrar el resto del almacenamiento.

Lumi → Consejos de seguridad permite consultar los tres consejos y desactivar presentaciones automáticas. Comprobar Tab, Escape, ampliación y cerrar. Escape primero reduce la imagen ampliada; luego cierra el diálogo y devuelve el foco al control de origen. Simular recurso no disponible para comprobar el texto alternativo de respaldo.

Pruebas: node --test scripts/verify-lumi-safety.cjs scripts/verify-lumi-safety-ui.cjs scripts/verify-lumi-chat-reset.cjs (Node 22 o superior). La política usa tiempos simulados sin modificar los intervalos de producción.
