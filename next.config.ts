import type { NextConfig } from "next";

/**
 * Las pantallas siguen llamando a `/api/...` de su propio dominio, igual que
 * cuando el repo era uno solo. Este rewrite reenvía esas peticiones al backend
 * del lado del servidor, así la cookie de sesión viaja en la petición y no hace
 * falta CORS ni cookies de terceros.
 *
 * BACKEND_URL es obligatoria y NO lleva el prefijo NEXT_PUBLIC_: el navegador
 * no debe conocer la URL del backend.
 */
const backendUrl = process.env.BACKEND_URL;

const nextConfig: NextConfig = {
  async rewrites() {
    if (!backendUrl) {
      throw new Error(
        'Falta la variable de entorno BACKEND_URL. Sin ella las pantallas no ' +
          'tienen a dónde mandar sus llamadas a /api. Ver .env.example.'
      );
    }
    return [
      {
        source: '/api/:path*',
        destination: `${backendUrl.replace(/\/$/, '')}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
