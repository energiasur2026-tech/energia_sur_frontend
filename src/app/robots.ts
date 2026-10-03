import type { MetadataRoute } from 'next';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://energia-sur.netlify.app';

/**
 * Que puede recorrer un buscador.
 *
 * Todo lo que está detrás del login se bloquea explícitamente. No es por
 * seguridad —un buscador sin sesión recibe una redirección igual— sino para
 * no gastarle el presupuesto de rastreo en páginas que siempre le van a
 * devolver lo mismo, y para que esas URLs no aparezcan listadas.
 *
 * `/api` se bloquea por la misma razón: no son páginas.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/api/', '/dashboard', '/consumo', '/eventos', '/proyeccion', '/medidores', '/ajustes'],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
