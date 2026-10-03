import type { MetadataRoute } from 'next';

/**
 * Manifiesto de aplicación instalable.
 *
 * Con esto el navegador ofrece "Agregar a pantalla de inicio", y al abrirla
 * desde ahí se ve sin barra de direcciones, como una aplicación del sistema.
 * Es lo que más acerca la app a comportarse como una app nativa, que es como
 * se viene diseñando toda la interfaz.
 *
 * `start_url` apunta al Monitor y no a la raíz: quien ya tiene sesión entra
 * directo a lo que vino a ver, y quien no, es redirigido al login igual.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'EnergIA Sur · Monitor de consumo eléctrico',
    short_name: 'EnergIA Sur',
    description:
      'Seguí el consumo eléctrico de tu casa en tiempo real y enterate a tiempo si algo anda mal en la instalación.',
    start_url: '/dashboard',
    display: 'standalone',
    orientation: 'portrait',
    lang: 'es-AR',
    background_color: '#0b1017',
    theme_color: '#0b1017',
    categories: ['utilities', 'productivity'],
    icons: [
      { src: '/favicon.ico', sizes: '48x48', type: 'image/x-icon' },
      { src: '/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
    ],
  };
}
