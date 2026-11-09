/** Selection is a hint only: every backend request revalidates membership. */
export function selectedMeterUrl(input: string) {
  if (typeof window === 'undefined') return input;
  const meter = new URLSearchParams(window.location.search).get('meterId');
  if (!meter) return input;
  const url = new URL(input, window.location.origin);
  url.searchParams.set('meterId', meter);
  return url.pathname + url.search;
}
export function meterFetch(input: string, init?: RequestInit) {
  return fetch(selectedMeterUrl(input), { ...init, credentials: 'same-origin', cache: 'no-store' });
}
