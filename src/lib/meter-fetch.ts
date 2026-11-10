import { selectedDeviceId, withMeterSelection } from './meter-selection';
/** Selection is only a hint: the backend revalidates session and meter membership. */
export function selectedMeterUrl(input: string) {
  if (typeof window === 'undefined') return input;
  const url = new URL(input, window.location.origin);
  const meter = selectedDeviceId(url.searchParams) ?? selectedDeviceId(new URLSearchParams(window.location.search));
  return withMeterSelection(input, meter);
}
export function meterFetch(input: string, init?: RequestInit) {
  return fetch(selectedMeterUrl(input), { ...init, credentials: 'same-origin', cache: 'no-store' });
}
