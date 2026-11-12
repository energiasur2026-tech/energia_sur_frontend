# Avisos y consultas

Lectura, respuestas y pendientes son estados separados. Los filtros usan no leído para avisos y sin responder para consultas; Historial muestra todos los eventos disponibles. El formulario guarda solo al confirmar. Cancelar no envía peticiones; retirar usa labels=[] y una confirmación. Los borradores no salen del componente ni sobreviven un cambio de usuario/medidor.

Pruebas DOM reales: node scripts/verify-lumi-events.cjs (Node 24). Incluyen lectura reversible, contadores, selección excluyente, edición/cancelación, retiro, reintento y cambio de contexto. Las mediciones de prueba nunca se importan en producción.

Los iconos disponibles se reutilizan del catálogo del hogar; pava y plancha usan SVG decorativos específicos. Los checkboxes nativos conservan acceso por teclado y nombre, con opciones completas clickeables y estados visibles en temas claro/oscuro.

Las respuestas anteriores sin fecha muestran explícitamente que no fue registrada. No se inventa una fecha durante la migración.
