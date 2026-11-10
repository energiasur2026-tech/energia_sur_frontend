/** Shared URL contract. deviceId is canonical; meterId remains compatible with older links/backends. */
export function selectedDeviceId(params: Pick<URLSearchParams, 'get'>): string | null {
  const id = params.get('deviceId')?.trim() || params.get('meterId')?.trim();
  return id || null;
}
export function withMeterSelection(input: string, deviceId: string | null, api = true): string {
  if (!deviceId) return input;
  const url = new URL(input, 'http://selection.invalid');
  url.searchParams.set('deviceId', deviceId);
  if (api) url.searchParams.set('meterId', deviceId);
  else url.searchParams.delete('meterId');
  return url.pathname + url.search + url.hash;
}
