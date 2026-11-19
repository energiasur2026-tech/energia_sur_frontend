export const LUMI_STATES = ['idle', 'greeting', 'question', 'analyzing', 'alert', 'success'] as const;
export type LumiState = (typeof LUMI_STATES)[number];

export const LUMI_LABELS: Record<LumiState, string> = {
  idle: 'En reposo', greeting: 'Hola, soy Lumi', question: 'Consulta pendiente',
  analyzing: 'Procesando tu solicitud', alert: 'Aviso pendiente', success: 'Acción completada',
};

export type LumiEvent = {
  id: string; type: string; at: string; evidence: string; question: string | null;
  consultationStatus?: 'pending' | 'answered' | 'snoozed' | 'skipped'; resumeAt?: string;
  active?: boolean;
  read: boolean; userLabels: string[]; answered?: boolean; answeredAt?: string | null; otherEquipment?: string; severity?: 'INFO' | 'WARNING' | 'CRITICAL';
};
export type LumiMemoryItem = {
  patternId?: string;
  id: string; equipment: string; kind: 'routine' | 'plan' | 'exception'; localTime?: string | null; weekdays?: number[];
  durationMinutes?: number; powerW?: number; timezone: string; updatedAt: string; occurrenceDate?: string; active?: boolean;
};
export type LumiSession = {
  routines?: { status: string; updatedAt: string; patterns: { id: string; hour: number; group: string; supportDays: number; eligibleDays: number; timezone: string }[] } | null;
  memories?: LumiMemoryItem[];
  supplyProfile?: { country?: string; province?: string; distributor?: string };
  recommendations?: { kind: string; adopted: boolean; adoptedAt: string }[];

  meterName?: string;
  dataStatus?: string;
  version: string;
  events: LumiEvent[];
  messages: { role: 'user' | 'assistant'; text: string; at: string }[];
  preferences?: { reducedMotion?: boolean; proactivePaused?: boolean; soundsEnabled?: boolean; briefResponses?: boolean; [key: string]: unknown };
};

// The v1 service doesn't assign severity yet. Electrical findings receive
// precedence; no voltage values or thresholds are inferred in the frontend.
export function isElectricalEvent(event: LumiEvent) {
  return ['voltage', 'current'].includes(event.type);
}
export function isPriorityEvent(event: LumiEvent) {
  return event.severity === 'CRITICAL' || isElectricalEvent(event);
}

export function resolveLumiState({ events, busy, success, greeting }: {
  events: LumiEvent[]; busy: boolean; success: boolean; greeting: boolean;
}): LumiState {
  const pending = events.filter(isPendingEvent);
  if (pending.some(isPriorityEvent)) return 'alert';
  if (busy) return 'analyzing';
  if (success) return 'success';
  if (pending.some(isConsultation)) return 'question';
  if (pending.length) return 'alert';
  return greeting ? 'greeting' : 'idle';
}

export function isConsultation(event: LumiEvent) {
  return event.type === 'unusual_power' && !!event.question && event.severity !== 'CRITICAL';
}
export function isAnswered(event: LumiEvent) {
  return event.answered ?? event.userLabels.length > 0;
}
export function isPendingEvent(event: LumiEvent) {
  return isConsultation(event) ? (event.consultationStatus ? event.consultationStatus === 'pending' : !isAnswered(event)) : !event.read;
}
export type EventFilter = 'all' | 'electrical' | 'consultations';
export function matchesEventFilter(event: LumiEvent, filter: EventFilter) {
  return filter === 'all' || (filter === 'electrical' ? isElectricalEvent(event) : isConsultation(event));
}
export function toggleEquipment(labels: string[], label: string) {
  if (labels.includes(label)) return labels.filter(value => value !== label);
  return label === 'No recuerdo' ? [label] : [...labels.filter(value => value !== 'No recuerdo'), label];
}


export const LUMI_TIME_ZONE = 'America/Argentina/Buenos_Aires';
export function formatLumiDate(value: string) {
  // Legacy SQLite CURRENT_TIMESTAMP is UTC but has no suffix.
  const explicit = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(value) ? value.replace(' ', 'T') + 'Z' : value;
  const date = new Date(explicit);
  if (!Number.isFinite(date.getTime())) return 'Fecha no disponible';
  return new Intl.DateTimeFormat('es-AR', { timeZone: LUMI_TIME_ZONE, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' }).format(date);
}
