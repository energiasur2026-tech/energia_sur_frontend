'use client';

import { useSearchParams } from 'next/navigation';

/**
 * De qué medidor habla la pantalla que se está mirando.
 *
 * La fuente de verdad es la **dirección del navegador**, no un estado
 * guardado. Eso se decidió a propósito y tiene un motivo que pesa más que
 * poder compartir enlaces: un medidor recordado puede dejar de existir. Si
 * alguien lo desvincula desde otra sesión, o le revocan el acceso compartido,
 * una selección escondida devuelve una pantalla rota sin explicación. Con la
 * dirección a la vista, la persona ve a qué medidor apunta y el error se
 * puede contar.
 *
 * `null` significa "no lo dice", y entonces el backend resuelve el primero
 * accesible — el comportamiento de siempre. Por eso una cuenta con un solo
 * medidor nunca ve un parámetro en la dirección: no hay nada que elegir.
 */
export function useMeterId(): string | null {
  const params = useSearchParams();
  const id = params.get('deviceId');
  return id && id.trim() !== '' ? id : null;
}

/**
 * Agrega el medidor a una ruta de la API, conservando lo que ya tenga.
 *
 * Se usa en cada llamada en vez de resolverlo en un solo lugar porque las
 * rutas del backend lo leen una por una: omitirlo en alguna no da error,
 * silenciosamente trabaja sobre otro medidor. Eso es peor que un error.
 */
export function apiUrl(path: string, deviceId: string | null): string {
  if (!deviceId) return path;
  const separador = path.includes('?') ? '&' : '?';
  return `${path}${separador}deviceId=${encodeURIComponent(deviceId)}`;
}

/** Lo mismo para un enlace entre pantallas, así la elección viaja al navegar. */
export function meterHref(path: string, deviceId: string | null): string {
  return apiUrl(path, deviceId);
}
