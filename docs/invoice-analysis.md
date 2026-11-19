# Análisis local de facturas

Desde Ajustes → Servicio eléctrico y tarifas, el usuario elige un PDF, JPG o PNG y confirma el análisis. PDF.js extrae texto digital. Para páginas sin texto útil, renderiza la página y la pasa a Tesseract en español. Las imágenes se leen con ese mismo OCR. La revisión usa reglas deterministas y el catálogo devuelto por la API de tarifas.

El archivo, el texto extraído, la vista previa y los datos de revisión quedan en memoria del navegador. No se suben archivos ni se almacena su contenido. Los recursos de PDF.js, Tesseract y el diccionario se sirven desde el mismo origen en `/invoice-engine/` y se preparan con `npm ci` o `npm run postinstall`. Las dependencias no requieren suscripción ni llamadas pagas.

El límite inicial es de 10 MB y se puede ajustar antes de compilar con `NEXT_PUBLIC_INVOICE_MAX_MB` entre 1 y 25. El PDF admite hasta ocho páginas, la imagen hasta 20 megapíxeles y la lectura dispone de dos minutos. La detección de múltiples suministros se basa en señales reconocibles y requiere intervención cuando se detectan discordancias.

Al confirmar se guardan únicamente los campos del suministro que admite la API existente y, si fue seleccionado expresamente, el cierre. Los dos guardados son independientes. Si el cierre falla tras guardar el suministro, la revisión informa el estado parcial y deja reintentar. El nombre de una distribuidora pendiente requiere la migración 0026. Para tipo de suministro y luz de obra, el esquema incluye la migración 0025. El cierre utiliza la migración 0020. Las reglas de acceso y RLS se conservan. Una fecha de emisión o vencimiento nunca se utiliza como cierre.

El cotejo histórico comprueba disponibilidad del cuadro registrado al inicio del mes declarado. Las líneas facturadas se usan para reconciliar importes, sin publicar tarifas ni inferir montos faltantes. La calidad depende del diseño, legibilidad y disposición de las tablas.
