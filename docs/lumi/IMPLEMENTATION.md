# Lumi: identidad visual y verificación

La carpeta inspeccionada es `energia_sur_frontend` (Next.js 16). No tenía un
componente de Lumi ni chat previo. Se agregó `LumiWidget` al layout autenticado,
sin modificar backend, modelos, login ni datos de medidores.

## Recursos

`public/assets/lumi/` contiene seis poses RGBA de 480 × 520 y una cabeza de
320 × 320 solo para la demostración histórica del recorte de cabeza.
El flotante de producción usa las seis poses de cuerpo completo: lienzo y área
interactiva transparentes de 108 × 117 px en escritorio y 90 × 97,5 px en móvil.
El blanco del cuerpo se conserva; el botón no tiene fondo, borde ni sombra.
El contorno aparece solo al navegar con teclado como señal accesible de foco.
`reference/lumi-original.png` conserva la lámina local original del personaje;
`reference/lumi-clean-sheet.png` conserva la limpieza asistida de fondo y
símbolos. Se verificó que el original tenía canal alfa pero conservaba residuos
de fondo: tener RGBA no garantiza un recorte limpio. El procesamiento elimina
el halo residual y mantiene bordes suavizados. No son capas articuladas ni
fotogramas de una animación; pueden existir pequeñas diferencias de borde
debidas a la limpieza automática, sin sustituir el diseño del personaje.

Para reproducir la extracción: instalar Pillow y ejecutar desde este frontend
`python scripts/prepare-lumi-assets.py`. Un único tamaño y anclas explícitas
de cabeza y fila mantienen la escala y posición al cambiar de estado.
Los signos `?`, `!`, `✓` y puntos se renderizan en HTML; no están duplicados
en los PNG de producción. El flotante conserva el mismo lienzo y anclas al
cambiar de estado, sin recortar rayo, manos ni parte inferior.

## Estados y contrato

`LumiAvatar` admite idle, greeting, question, analyzing, alert y success.
El selector puro de estado prioriza avisos críticos o eléctricos, solicitud
manual real, confirmación temporal, preguntas pendientes y otros avisos.
La bienvenida es breve; las animaciones de atención del panel no son continuas y se
reinician al cambiar el aviso prioritario. El procesamiento solo anima durante
una solicitud real; el sondeo de fondo no activa analyzing.

El frontend usa el contrato documentado en el proyecto machine learning:
`GET/POST /api/lumi/v1`, sobre el rewrite y autenticación existentes. Historial,
lectura de avisos, etiquetas múltiples de equipos, borrar conversación y
preferencias usan sus acciones documentadas. No se persiste conversación ni
preferencias en localStorage. Solo la introducción de interfaz se recuerda por
usuario y navegador. Las preferencias no editadas, incluidos canales y
horarios, se conservan al enviar el objeto actualizado.

**Bloqueo funcional encontrado:** este checkout del backend no contiene esa
ruta de Lumi. El servicio Python privado no es una API pública para el
navegador y no debe llamarse directamente desde el componente. Hasta que el
backend exponga el contrato, la interfaz muestra indisponibilidad, permite
reintentar y deshabilita consultas. No fabrica lecturas, respuestas ni avisos.
La integración HTTP con datos reales sigue pendiente; los estados no aparecen
artificialmente para simular una conexión.

## Vista previa y comprobaciones

- `/lumi-preview` muestra seis estados y el recorte compacto en desarrollo;
  devuelve 404 en producción y no incluye datos o notificaciones de ejemplo.
- `node scripts/verify-lumi-state.cjs`: 11 comprobaciones de prioridad,
  actividad real, lectura y respuesta de preguntas aprobadas.
- TypeScript de los nuevos componentes y página: aprobado con tipos de React,
  Node y Next. No equivale a una compilación completa de toda la aplicación.
- Recursos: dimensiones uniformes, transparencia real, padding y contornos
  comprobados sobre fondos claro y oscuro.
- Se abrió una vista aislada que ejecuta los componentes reales con React;
  solo `next/image` usa un adaptador `img` en ese entorno de verificación.
  Las capturas `six-states-preview.jpg` y `mobile-panel.jpg` corresponden a
  esa vista, **no al dashboard autenticado**.
- Escritorio y móvil 390 × 844: galería sin desbordamiento horizontal, botón
  de cuerpo completo, panel dentro del viewport, apertura, foco inicial, cierre con
  Escape y retorno de foco al botón comprobados en navegador.
- `dialog.showModal()` mantiene el foco dentro del panel e inactiva el fondo.
  Foco visible y nombres accesibles en botón, cierre, envío y campos.
- `prefers-reduced-motion` y preferencia de cuenta desactivan animaciones.
  La vista aislada incluye un control de demostración para comprobarlo.
- Se reserva espacio sobre la navegación móvil y el botón se desplaza sobre
  la barra de guardado de configuración del hogar. Las superposiciones finales
  con cada pantalla del dashboard real siguen pendientes de verificación.

## Limitaciones del entorno

`npm ci` no pudo completar las dependencias: las solicitudes al registro
fallaron con EACCES. Faltan, entre otras, baseline-browser-mapping y lucide-react.
`next dev` inicia pero falla al compilar por el primer módulo ausente. El
chequeo global de TypeScript encuentra además el tipo d3-shape ausente y
ESLint no puede arrancar por brace-expansion. No se declara build/lint global
aprobado ni verificación de una sesión real del dashboard.

Para cerrar la verificación: instalar las dependencias del lockfile, configurar
las variables existentes, ejecutar el frontend con una sesión válida y
comprobar el contrato público de Lumi con el backend real. No hay secretos ni
excepciones de autenticación agregadas para la vista previa.

## Ajuste del flotante de cuerpo completo

El layout de producto importa únicamente LumiWidget; no importa la galería
ni la sección de cabeza. El recorte de cabeza queda solo en las demostraciones.
Se amplió el espacio inferior desplazable del contenido para que el flotante
no impida acceder a los últimos controles de cada pantalla.

Se verificaron fondo computado rgba(0,0,0,0), borde 0px, sombra none y recurso
lumi-idle.png completo, tanto en escritorio como en móvil 390 × 844.
Se inspeccionó visualmente sobre fondo claro y oscuro; se conservó el blanco
del personaje. La apertura del panel y el cierre con Escape siguieron
funcionando. Las capturas full-body-*.jpg corresponden a la vista aislada.
El material de demostración queda colapsado y rotulado como tal en esa vista.
Continúan las limitaciones del dashboard real detalladas anteriormente.

### Presencia discreta del flotante

Se redujeron ancho y alto un 25 % respecto de la versión de cuerpo completo.
El botón queda inmóvil; un wrapper persistente anima al personaje y su indicador
4 px entre extremos (translateY de +2 a -2 px), cada 4,5 segundos, ease-in-out
infinito. El wrapper no se remonta al cambiar de pose. Solo en el flotante se
desactivan las transformaciones de las poses para evitar rebotes, inclinaciones
o movimientos superpuestos; el panel mantiene sus animaciones originales.
Los contadores y el foco permanecen anclados al botón.

prefers-reduced-motion: reduce y la preferencia de cuenta desactivan la
flotación. En navegador se comprobaron duración, curva y repetición computadas,
ausencia de animación adicional en la imagen y márgenes: escritorio 24 px;
móvil 16 px a la derecha y 84 px abajo, por encima de la reserva de navegación.
No hubo desbordamiento horizontal en 390 × 844. Apertura, Escape y retorno de
foco comprobados. Capturas actualizadas: discreet-desktop.jpg y
discreet-mobile.jpg. TypeScript de los componentes nuevos aprobado.


## Suavizado del movimiento y panel de conversación

- El wrapper suspended permanece montado y flota de +3 a -3 px cada 5 segundos,
  ease-in-out infinito. Ni su key ni el canvas del avatar cambian por polling,
  nuevos avisos, apertura o cierre. Solo cambia la opacidad de capas interiores.
- LumiAvatar mantiene las seis imágenes de 480 × 520 montadas con loading eager.
  Espera su carga/decodificación antes de seleccionar una pose y las funde durante
  250 ms. Una estabilización visual de 120 ms filtra estados transitorios; los
  avisos no esperan ese intervalo y no se retrasa ninguna respuesta del servicio.
- Se eliminaron las keys por estado/aviso y las animaciones de transformación de
  poses. Las imágenes estáticas no se deforman ni se simulan articulaciones.
- El diálogo entra con opacidad y translateY de 10 px en 220 ms. El cierre por
  botón, Escape o backdrop reproduce la salida antes de desmontar. El contenido
  queda inert durante la salida y al finalizar se devuelve el foco al flotante.
- Historial y pie están separados: el historial usa flex:1, min-height:0 y scroll
  propio; el footer no se contrae y deja 16 px debajo del compositor, más el área
  segura. Borrar conversación y su confirmación viven arriba del historial.
- Los mensajes recién agregados aparecen en 180 ms. Las claves permanecen estables
  incluso cuando el servidor recorta la ventana de historial a 100 entradas.
  Los snapshots iguales del polling no reinician las entradas ni el scroll.
- A 64 px o menos del final se sigue el nuevo contenido; al leer más arriba se
  conserva la posición/ancla y se ofrece Mensaje nuevo · Ir al final.
- visualViewport ajusta el alto y desplazamiento inferior del panel frente al
  teclado móvil. Cuando detecta teclado, se reduce la reserva inferior y se
  oculta el bloque ilustrado del encabezado, conservando campo y botón al pie.
- La preferencia del sistema y la de cuenta cancelan flotación, fundidos y
  desplazamientos; las entradas Web Animations se cancelan al activar reducción.

Verificación de esta revisión: TypeScript aprobado, ESLint de los componentes
sin errores/advertencias; 11 comprobaciones de estados y 7 pruebas de conversación
aprobadas. Ejecutar node scripts/verify-lumi-conversation.cjs para comprobar
identidad de mensajes, ventana móvil, umbral de seguimiento y las seis imágenes
precargadas. La ruta local /lumi-preview respondió HTTP 200 y compiló los estilos.

Limitación: no se completó la revisión visual del dashboard autenticado. El
control de Windows se detuvo al no poder determinar con certeza la URL de la
ventana del navegador. Las pruebas de código y SSR no acreditan una prueba real
con teclado virtual, historial largo ni animaciones en el dashboard. Queda esa
comprobación manual antes de publicar. No se cambiaron credenciales, APIs ni
repositorios backend/machine learning en esta revisión.
