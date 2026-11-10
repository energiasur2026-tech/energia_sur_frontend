# Resolución local de conflictos

Se resolvieron los marcadores de conflicto guardados en b9a883c en 16 archivos, sin modificar el historial Git, hacer commit, stage, push o merge.

- Lumi: se conservan los componentes, recursos, historial, movimiento reducido y el montaje en el layout.
- Proyección: se conserva la implementación mensual de 0344e51, el editor con equivalencias y la validación de respuestas del backend. Se mantiene la distinción de medidores centrales y de área.
- Consumo: se conserva Desde último cierre junto con la selección de medidor y la presentación de áreas.
- Ajustes: se incorporan en la copia de trabajo las versiones actuales de origin/main (3f7d5e1 y 1a6a883), incluida la escritura de umbrales. Su nueva petición de guardado ahora también incluye el medidor seleccionado.
- HomeSetup, alta/baja de medidores, selector y aviso de medidor no disponible: se preservan los cambios remotos del merge original.
- Se unifica la selección: deviceId es la URL canónica; meterId sigue aceptándose en enlaces anteriores. Las peticiones API envían ambos con el mismo identificador para ser compatibles con las dos versiones del backend. No se usa el identificador como autorización. El cambio de medidor reinicia el contexto visible de Lumi y las pantallas.
- Monitor: se conserva Tensión como selección inicial y los enlaces de Objetivo/Eventos conservan el medidor.

Verificación: sin marcadores de conflicto, TypeScript y ESLint correctos. 66 comprobaciones aprobadas: selección de medidor, estados e historial de Lumi, edición y contrato de Proyección, recuperación de contraseña. Next build --webpack finalizó con código 0 y generó BUILD_ID, manifiestos y archivos de producción. No se desplegó.

El historial sigue mostrando main 2 commits por delante y 2 por detrás de origin/main. Las correcciones están sin commit en la copia de trabajo; los commits remotos de Ajustes todavía no se integraron en la ascendencia de la rama. Revisar y guardar estas correcciones antes de una futura sincronización/publicación.
