# Recuperación de contraseña

Implementación solo del frontend, con el cliente público Supabase existente.
No usa service_role, SQL, backend propio ni nuevas dependencias.

## Flujo

1. `/login` incluye **Olvidé mi contraseña**, que abre `/recuperar-clave`.
2. El formulario llama `resetPasswordForEmail` y pasa como redirectTo el origen
   actual más `/restablecer-clave`. La respuesta visible no revela si el email
   tiene cuenta. Abrir el correo en el mismo navegador y origen de la solicitud
   conserva el verificador PKCE almacenado por el SDK.
3. `/restablecer-clave` procesa el código PKCE, el enlace implícito emitido desde
   el dashboard o un token_hash de recuperación (para una plantilla personalizada).
   Los códigos y tokens se retiran de la barra de direcciones antes de validar.
   No se registran tokens, respuestas crudas, emails ni contraseñas en logs.
4. Supabase valida la sesión; luego `getUser()` verifica la identidad antes de
   habilitar el formulario y nuevamente al guardar. Un enlace inválido no usa
   como alternativa una sesión anterior. Una visita directa solo permite
   continuar si Supabase verifica al usuario ya autenticado.
5. El usuario ingresa la nueva contraseña y su confirmación. Se requieren al
   menos 8 caracteres y se respetan los requisitos adicionales del proyecto.
   `updateUser({ password })` conserva el ID del usuario y sus datos vinculados.
6. Se limpia la sesión local y se ofrece volver a ingresar. No hay redirección
   automática que oculte la confirmación de guardado.

Un cliente de recuperación aislado desactiva el consumo automático de URLs,
para no competir con el intercambio explícito de códigos. La inicialización
se comparte solo durante la vida de ese componente para impedir doble uso del
código con React Strict Mode. El resto del login/registro conserva su cliente.

## Enlaces anteriores al cambio

Los enlaces que vuelven a `/login#...&type=recovery` pasan por un componente
cliente que los lleva a la nueva ruta sin consumirlos ni exponerlos al servidor.
El proxy ya no redirige automáticamente `/login` por una cookie existente:
los fragmentos son invisibles al servidor y esa redirección podía perder el
enlace. El registro conserva su redirección habitual para usuarios autenticados.
Las rutas privadas mantienen su guardia de sesión original.

## Configuración necesaria antes de probar en producción

En **Supabase → Authentication → URL Configuration**:

- Site URL: `https://energia-sur.netlify.app/login` (para los enlaces enviados
  desde el dashboard que no incluyen redirectTo explícito).
- Redirect URLs: agregar `https://energia-sur.netlify.app/restablecer-clave`.
- Para desarrollo: agregar `http://localhost:3000/restablecer-clave` y conservar
  `http://localhost:3000/login` si aún se usan los enlaces anteriores.

Si el dominio final cambia, usar ese dominio. No dejar localhost como Site URL
de producción. En la plantilla de recuperación conservar el enlace de Supabase
`{{ .ConfirmationURL }}`; no apuntar directamente al login omitiendo la
verificación. La app utiliza el destino explícito de cada solicitud.

Las claves públicas y BACKEND_URL existentes siguen en las variables del
frontend. Nunca publicar `.env.local`, claves privadas ni tokens de recuperación.
No se cambiaron ajustes externos de Supabase ni se enviaron correos de prueba.

## Validación

- `node scripts/verify-password-recovery.cjs`: pruebas offline de códigos PKCE,
  flow ID, enlaces implícitos, OTP recovery, enlaces vencidos, sesión ausente,
  no reutilización de sesiones ante fallos, confirmación y errores sin secretos.
- Ejecutar `npm run build` y `npm run lint` antes de publicar.
- Prueba final con correo real, una vez desplegado y configurados los redirect
  URLs: pedir enlace desde la app → abrir en el mismo navegador → guardar una
  contraseña elegida por el usuario → volver a iniciar sesión. Probar también
  un enlace vencido/reutilizado y confirmaciones distintas. No usar contraseñas
  reales ni enlaces de recuperación en capturas, tickets o logs.

El envío de email y el cambio de contraseña reales requieren Supabase y deben
ser completados por el usuario. Los tests offline no acreditan la configuración
del correo ni del dominio de producción.

### Resultado de esta revisión local

- 13 pruebas offline aprobadas y TypeScript global sin errores.
- Rutas locales de solicitud y restablecimiento accesibles; campo de email
  obligatorio, redirección de enlace vencido desde /login y limpieza de query
  y fragmento comprobados en navegador. Formulario revisado en escritorio y
  en viewport móvil de 390 × 844.
- La compilación de producción se intentó, pero el entorno bloqueó la descarga
  de Geist y Geist Mono de Google Fonts (EACCES). Esto ocurre en el layout
  existente y no se cambió la tipografía como parte de la recuperación.
- No se enviaron correos, no se modificó la contraseña real y no se publicó
  ningún repositorio ni despliegue.
