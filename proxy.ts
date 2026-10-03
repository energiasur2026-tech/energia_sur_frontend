import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { publicSupabaseEnv } from '@/lib/env-public';

const AUTH_PAGES = ['/login', '/register'];

/**
 * Refresca la cookie de sesión de Supabase en cada visita a una página de la
 * app, y redirige según corresponda (sin sesión fuera de /login o /register;
 * con sesión, afuera de esas dos).
 *
 * Esto es un chequeo adicional, no el único: cada punto de entrada (el
 * layout de (app), cada ruta de API) también verifica la sesión por su
 * cuenta — así lo recomienda la documentación de Next.js 16 para Proxy,
 * porque un matcher mal ajustado puede dejar una ruta sin cobertura.
 */
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  let user = null;
  try {
    const { url, anonKey } = publicSupabaseEnv();

    const supabase = createServerClient(url, anonKey, {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookiesToSet) => {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    });

    const {
      data: { user: sessionUser },
    } = await supabase.auth.getUser();
    user = sessionUser;
  } catch {
    // Sin las variables públicas configuradas no hay forma de resolver la
    // sesión; se deja pasar la request y que cada página lo maneje.
    return response;
  }

  const { pathname } = request.nextUrl;
  const isAuthPage = AUTH_PAGES.some((page) => pathname.startsWith(page));

  if (isAuthPage && user) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  return response;
}

/**
 * Todas las paginas de la app, no solo algunas.
 *
 * El matcher listaba unicamente /dashboard y /consumo, asi que en Eventos,
 * Proyeccion, Mis medidores y Ajustes no corria este proxy y la cookie de
 * sesion no se refrescaba: alguien que se quedaba trabajando en esas
 * pantallas podia ver caer su sesion sin motivo. La guardia del layout de
 * (app) igual impedia el acceso sin sesion, asi que no era un agujero de
 * seguridad, pero si una sesion que vencia antes de tiempo.
 *
 * Cada ruta nueva de la app tiene que sumarse aca.
 */
export const config = {
  matcher: [
    '/dashboard/:path*',
    '/consumo/:path*',
    '/eventos/:path*',
    '/proyeccion/:path*',
    '/medidores/:path*',
    '/ajustes/:path*',
    '/login',
    '/register',
  ],
};
