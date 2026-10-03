import type { MetadataRoute } from 'next';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://energia-sur.netlify.app';

/**
 * Solo las páginas públicas.
 *
 * Listar las pantallas de la aplicación sería contraproducente: un buscador
 * que las visita recibe una redirección al login, y un mapa lleno de
 * redirecciones baja la confianza en el resto del sitio.
 *
 * Cuando exista una página de presentación abierta, va acá con prioridad 1.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  return [
    { url: `${SITE_URL}/login`, lastModified: now, changeFrequency: 'monthly', priority: 1 },
    { url: `${SITE_URL}/register`, lastModified: now, changeFrequency: 'monthly', priority: 0.8 },
  ];
}
