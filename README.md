# EnergIA Sur — Frontend

Pantallas web del monitor energético EnergIA Sur: login, panel de monitoreo,
consumo y costo, eventos, proyección, medidores y ajustes.

Este repo es **la mitad de frontend** de un proyecto separado en dos. La otra
mitad —las rutas de API, el recolector programado y el esquema SQL— vive en
**[energiasur2026-tech/energIA_sur_backend](https://github.com/energiasur2026-tech/energIA_sur_backend)**.
Acá no hay ninguna ruta `/api`.

## Cómo hablan las dos mitades

```
Navegador
   │  (siempre llama a /api/... de SU propio dominio)
   ▼
FRONTEND  (este repo)      pantallas + login + refresco de sesión
   │  rewrite  /api/*  →  BACKEND_URL/api/*   (del lado del servidor)
   ▼
BACKEND   (repo aparte)    las rutas /api + el recolector programado
   │
   ├──► Supabase · Tuya · Resend
```

El navegador **nunca** conoce la URL del backend: para él todo sigue siendo
`/api/...` del mismo dominio. El reenvío lo hace el servidor del frontend
(`next.config.ts`), así la cookie de sesión viaja en la petición y no hace
falta CORS ni cookies de terceros. Por eso las pantallas no cambiaron una
línea al separar los repos.

Lo único que el frontend habla directo con Supabase es el **login**
(`src/lib/supabase-browser.ts`, con la clave anónima). Los datos del medidor
siempre pasan por el backend.

## Pantallas

| Ruta | Qué muestra |
| --- | --- |
| `/` | Pantalla inicial con el botón Ingresar |
| `/login` | Inicio de sesión |
| `/register` | Alta de cuenta |
| `/dashboard` | Panel de monitoreo: métricas en vivo, histórico y anomalías en curso |
| `/consumo` | Consumo real del período y costo estimado |
| `/eventos` | Historial de anomalías con filtros y gráfico |
| `/proyeccion` | Objetivo mensual, avance y proyección de consumo |
| `/medidores` | Medidores del domicilio |
| `/medidores/hogar` | Contexto del hogar: ambientes y aparatos |
| `/ajustes` | Perfil, tema, avisos y frecuencia de guardado |

## Puesta en marcha

```bash
npm install
cp .env.example .env.local   # y completar
BACKEND_URL=https://energia-sur-backend.netlify.app npm run build
npm start
```

Para desarrollo, `npm run dev` (también necesita `BACKEND_URL`).

> **El orden importa: `npm run build` va antes de `npx tsc --noEmit`.** Next 16
> genera tipos en `.next/types/` que el código usa (`LayoutProps` en
> `src/app/layout.tsx`). Si se corre `tsc` sobre el repo recién clonado, falla
> con `error TS2304: Cannot find name 'LayoutProps'`. No es un error del
> código.

### Variables de entorno

| Variable | Dónde se obtiene | Secreta |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Project Settings → API → *Project URL* | no |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → Project Settings → API → *Publishable key* | no |
| `BACKEND_URL` | URL pública del backend desplegado | no |

Ninguna tiene valor por defecto: si falta alguna, la aplicación lo informa en
pantalla nombrando cuáles, en vez de apuntar en silencio a un recurso
equivocado. Con `BACKEND_URL` el build directamente **falla**, para no generar
un sitio que reenvíe a `undefined`.

**`BACKEND_URL` se lee al compilar, no al arrancar.** El destino del rewrite
queda escrito en `.next/routes-manifest.json`; arrancar el servidor con otro
valor no cambia nada. En Netlify hay que cargarla **antes del primer deploy**,
y cambiarla después exige volver a desplegar.

Este repo **no debe contener nunca** la service role key de Supabase, las
claves de Tuya o Resend, ni `COLLECTOR_SECRET`. Son del backend y el frontend
no las usa.

## Sesión y cookies

El login lo hace el navegador contra Supabase Auth (email + contraseña) y la
sesión queda en una cookie del dominio del frontend. A partir de ahí:

- **`proxy.ts`** refresca esa cookie al navegar entre páginas y redirige a
  `/dashboard` si una cuenta con sesión entra a `/login` o `/register`. Su
  `matcher` lista las rutas una por una a propósito —está explicado en el
  propio archivo—; **cada pantalla nueva tiene que sumarse ahí**.
- **`src/app/(app)/layout.tsx`** es la guardia real: sin sesión redirige a
  `/login` antes de renderizar nada. Usa `getCurrentUser()` de
  `src/lib/auth.ts`. Además cada ruta del backend repite el chequeo por su
  cuenta: la documentación de Next.js 16 advierte explícitamente contra
  confiar solo en Proxy, porque un matcher mal ajustado puede dejar una ruta
  sin cobertura.
- El backend no escribe cookies: el refresco es responsabilidad de `proxy.ts`.
  Por eso una pantalla abierta mucho tiempo sin navegar puede empezar a
  recibir 401 hasta que se navegue.

Sin sesión, las rutas del backend responden `401 {"error":"No autenticado."}`.
Un **404** en `/api/...` significa que el rewrite no quedó aplicado (se
compiló sin `BACKEND_URL` o con otro valor).

## Qué espera del backend

Las pantallas ya están escritas contra este contrato. Se documenta para que,
si algo no funciona, se sepa dónde mirar.

| Ruta | Métodos | La usa |
| --- | --- | --- |
| `/api/meter/live` | GET | Dashboard |
| `/api/meter/history` | GET | Dashboard |
| `/api/meter/forecast` | GET | Dashboard, ForecastView |
| `/api/meter/events` | GET | Dashboard, EventsView, ActiveEventsBanner |
| `/api/meter/event-series` | GET | EventChart |
| `/api/meter/consumption` | GET | ConsumptionView |
| `/api/meter/collector-status` | GET | CollectorStatus |
| `/api/meter/goal` | PUT | GoalSetter |
| `/api/meter/home` | GET, PUT | HomeSetup |
| `/api/meter/settings` | GET, PUT | SettingsView |
| `/api/meters` | GET | MetersView |
| `/api/profile` | GET, PUT | ProfileForm |

`/api/meter/collect` existe en el backend pero el frontend **no la usa**: es
solo para la función programada.

## Stack

- **Next.js 16** (App Router) + **React 19** + **TypeScript**
- **Tailwind CSS 4** para el estilado
- **Recharts** para los gráficos y **framer-motion** para las transiciones
- **@supabase/ssr** y **@supabase/supabase-js** para el login

> Next.js 16 tiene cambios incompatibles con versiones anteriores (entre otros,
> `middleware.ts` pasó a llamarse `proxy.ts` — de ahí el `proxy.ts` de este
> repo). Ver `AGENTS.md`: antes de escribir código de Next, consultar
> `node_modules/next/dist/docs/`.

## Arquitectura

```
proxy.ts                         Refresca la sesión y protege login/register
netlify.toml                     Configuración de despliegue (plugin de Next.js)
src/
  app/
    page.tsx                     Pantalla inicial con el botón Ingresar
    login/page.tsx               Inicio de sesión
    register/page.tsx            Alta de cuenta
    (app)/layout.tsx             Guardia de sesión + navegación
    (app)/dashboard/page.tsx     Panel de monitoreo
    (app)/consumo/page.tsx       Panel de consumo y costo
    (app)/eventos/page.tsx       Historial de anomalías
    (app)/proyeccion/page.tsx    Objetivo mensual y proyección
    (app)/medidores/page.tsx     Panel de medidores del domicilio
    (app)/medidores/hogar/page.tsx  Ambientes y aparatos del hogar
    (app)/ajustes/page.tsx       Perfil, tema, avisos y frecuencia de guardado
    manifest.ts / robots.ts / sitemap.ts
  components/                    29 componentes de pantalla
  lib/                           26 módulos (formato, tema, tipos, cálculos de vista)
```

### Sobre `src/lib`

De los 26 módulos, **17 están duplicados a propósito** con el repo del
backend: `auth`, `collection-intervals`, `env-public`, `errors`,
`event-types`, `forecast`, `goal`, `home-catalog`, `home-types`, `periods`,
`profile-types`, `ranges`, `recommendations`, `supabase-server`, `tariffs`,
`threshold-types` y `types`. Varios se usan acá **solo por sus tipos**; la
lógica de cálculo vive en el backend.

**Si se toca una de esas constantes, hay que tocarla en los dos repos.** El
caso más delicado es `home-catalog`: si el frontend ofrece un aparato cuyo id
el backend no conoce, el backend lo descarta en silencio al guardar.
Unificarlos en un paquete compartido es una mejora pendiente.

`auth.ts` y `supabase-server.ts` parecen de backend, pero van acá también: los
usa la guardia de sesión de `src/app/(app)/layout.tsx`.

## Despliegue

Netlify, cuenta **energiasur2026-tech**. El `netlify.toml` del repo ya trae la
configuración de build, así que no hay que tocarla en el panel. Lo único que
hay que cargar a mano son las tres variables de entorno —`BACKEND_URL`
**antes** del primer deploy— y acordarse de hacer el sitio público: Netlify
pone su propia pantalla de login delante de los sitios privados.

## Comandos

```bash
npm run dev     # desarrollo
npm run build   # build de producción (necesita BACKEND_URL)
npm run lint    # eslint
```
