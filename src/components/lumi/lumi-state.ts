export const LUMI_STATES = ['idle', 'greeting', 'question', 'analyzing', 'alert', 'success'] as const;
export type LumiState = (typeof LUMI_STATES)[number];

export const LUMI_LABELS: Record<LumiState, string> = {
  idle: 'En reposo', greeting: 'Hola, soy Lumi', question: 'Consulta pendiente',
  analyzing: 'Procesando tu solicitud', alert: 'Aviso pendiente', success: 'Acción completada',
};

export type LumiEvent = {
  id: string; type: string; at: string; evidence: string; question: string | null;
  read: boolean; userLabels: string[]; severity?: 'INFO' | 'WARNING' | 'CRITICAL';
};
export type LumiSession = {
  meterName?: string;
  dataStatus?: string;
  version: string;
  events: LumiEvent[];
  messages: { role: 'user' | 'assistant'; text: string; at: string }[];
  preferences?: { reducedMotion?: boolean; proactivePaused?: boolean; [key: string]: unknown };
};

// The v1 service doesn't assign severity yet. Electrical findings receive
// precedence; no voltage values or thresholds are inferred in the frontend.
export function isPriorityEvent(event: LumiEvent) {
  return event.severity === 'CRITICAL' || ['voltage', 'current'].includes(event.type);
}

export function resolveLumiState({ events, busy, success, greeting }: {
  events: LumiEvent[]; busy: boolean; success: boolean; greeting: boolean;
}): LumiState {
  const pending = events.filter(event => !event.read);
  if (pending.some(isPriorityEvent)) return 'alert';
  if (busy) return 'analyzing';
  if (success) return 'success';
  if (pending.some(event => event.question && !event.userLabels.length)) return 'question';
  if (pending.length) return 'alert';
  return greeting ? 'greeting' : 'idle';
}
