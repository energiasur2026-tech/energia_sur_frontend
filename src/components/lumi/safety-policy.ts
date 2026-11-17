export const SAFETY_CONFIG = { activeMs: 90_000, intervalMs: 72 * 60 * 60 * 1000, pollMs: 1000, idleMs: 60_000 };
export const SAFETY_TIPS = [
  { id: 'alta-potencia', title: 'No todo va a la zapatilla', message: 'Conectá los equipos de alta potencia a un toma adecuado.', explanation: 'Respetá la potencia máxima y las instrucciones del fabricante. Consultá a un electricista si necesitás un toma adecuado para tus equipos.', image: 'alta-potencia.png', alt: 'Zapatilla y ejemplos de equipos de alta potencia: caloventor, pava eléctrica, plancha y microondas.' },
  { id: 'sujetar-ficha', title: 'Para desenchufar, agarrá la ficha', message: 'Para desenchufar, sujetá la ficha sin tirar del cable.', explanation: 'Tirar del cable puede dañar sus conexiones. Si el cable o la ficha están dañados, dejá de usarlos y consultá a un electricista.', image: 'sujetar-ficha.png', alt: 'Comparación entre tirar del cable y sujetar la ficha correctamente para desenchufar.' },
  { id: 'sin-cadenas', title: 'Una zapatilla no se conecta a otra', message: 'Evitá conectar una zapatilla a otra.', explanation: 'Respetá la carga máxima indicada. Si necesitás más tomas, consultá a un electricista en lugar de encadenar zapatillas o improvisar adaptadores.', image: 'sin-cadenas.png', alt: 'Conexiones entre zapatillas tachadas y una zapatilla usada sin conexiones en cadena.' },
] as const;
export type SafetyState = { enabled: boolean; lastAt: number; shown: string[] };
export const safetyKey = (userId: string) => `energia-sur:lumi-safety:v1:${userId}`;
export function readSafety(raw: string | null): SafetyState {
  try {
    const value = JSON.parse(raw || '{}');
    return { enabled: value.enabled !== false, lastAt: Number.isFinite(value.lastAt) ? value.lastAt : 0, shown: Array.isArray(value.shown) ? value.shown.filter((id: unknown) => SAFETY_TIPS.some(t => t.id === id)) : [] };
  } catch { return { enabled: true, lastAt: 0, shown: [] }; }
}
export function nextSafety(state: SafetyState, now: number, activeMs: number, sessionShown: boolean, config = SAFETY_CONFIG) {
  if (!state.enabled || sessionShown || activeMs < config.activeMs || (state.lastAt > 0 && now - state.lastAt < config.intervalMs)) return null;
  const shown = SAFETY_TIPS.every(t => state.shown.includes(t.id)) ? [] : state.shown;
  const tip = SAFETY_TIPS.find(t => !shown.includes(t.id))!;
  return { tip, state: { ...state, lastAt: now, shown: [...shown, tip.id] } };
}
