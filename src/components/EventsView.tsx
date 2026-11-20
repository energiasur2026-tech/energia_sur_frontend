'use client';

import { useCallback, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { AlertTriangle, ChevronDown, CircleAlert, Info, ShieldCheck } from 'lucide-react';
import { formatDateShort, formatDateTime, formatDuration, formatNumber } from '@/lib/format';
import {
  EVENT_DESCRIPTION,
  EVENT_LABEL,
  type EventRecord,
  type EventSeverity,
  type EventType,
} from '@/lib/event-types';
import type { MeterThresholds } from '@/lib/threshold-types';
import type { ApiErrorPayload } from '@/lib/types';
import { apiUrl, useMeterId } from '@/lib/use-meter-id';
import { usePolling } from '@/lib/use-polling';
import { EventChart } from './LazyCharts';
import { InfoTooltip } from './InfoTooltip';
import { SwitchToggle } from './SwitchToggle';
import { SetupNotice } from './SetupNotice';

const POLL_INTERVAL_MS = 60000;

type Payload = {
  events: EventRecord[];
  thresholds: MeterThresholds | null;
  effectiveGapMinutes: number;
  bounds: { from: string | null; lastDay: string | null };
};

const SEVERITY_STYLE: Record<EventSeverity, { chip: string; icon: typeof Info; label: string }> = {
  INFO: { chip: 'border-border-soft bg-surface-raised text-muted', icon: Info, label: 'Informativo' },
  WARNING: { chip: 'border-warn/40 bg-warn/10 text-warn', icon: AlertTriangle, label: 'Advertencia' },
  CRITICAL: { chip: 'border-danger/40 bg-danger/10 text-danger', icon: CircleAlert, label: 'Crítico' },
};

// A fixed height keeps native date inputs and selects aligned across browsers.
const FILTER_FIELD =
  'h-11 w-full min-w-0 rounded-xl border border-border-soft bg-surface-raised px-3 text-sm text-foreground outline-none focus:border-accent';

const FILTER_LABEL =
  'block text-[11px] font-semibold uppercase tracking-wide text-muted mb-1.5';

const TYPE_FILTERS: { value: EventType | 'ALL'; label: string }[] = [
  { value: 'ALL', label: 'Todos los tipos' },
  { value: 'LOW_VOLTAGE', label: EVENT_LABEL.LOW_VOLTAGE },
  { value: 'HIGH_VOLTAGE', label: EVENT_LABEL.HIGH_VOLTAGE },
  { value: 'OVERCURRENT', label: EVENT_LABEL.OVERCURRENT },
  { value: 'DATA_GAP', label: EVENT_LABEL.DATA_GAP },
];

const PERIODS = [
  { value: 'current', label: 'Período actual' },
  { value: '7d', label: 'Últimos 7 días' },
  { value: '30d', label: 'Últimos 30 días' },
  { value: 'custom', label: 'Personalizado' },
  { value: 'all', label: 'Todo el historial' },
] as const;
type Period = typeof PERIODS[number]['value'];

export function EventsView() {
  const deviceId = useMeterId();
  const params = useSearchParams();
  const from = params.get('from');
  const to = params.get('to');
  const fromMonitor = params.get('period') === 'current';
  return <EventsFilters key={JSON.stringify([deviceId, fromMonitor, from, to])}
    deviceId={deviceId} fromMonitor={fromMonitor} from={from} to={to} />;
}

function EventsFilters({ deviceId, fromMonitor, from, to }: {
  deviceId: string | null;
  fromMonitor: boolean;
  from: string | null;
  to: string | null;
}) {
  const [period, setPeriod] = useState<Period>(fromMonitor ? 'current' : 'all');
  const [pinned, setPinned] = useState(fromMonitor && !!from && !!to);
  const [onlyActive, setOnlyActive] = useState(false);
  const [typeFilter, setTypeFilter] = useState<EventType | 'ALL'>('ALL');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const filtersApplied = period !== 'all' || typeFilter !== 'ALL' || onlyActive;
  const params = new URLSearchParams({ period });
  if (pinned && from && to) {
    params.set('from', from);
    params.set('to', to);
  }
  if (period === 'custom') {
    if (fromDate) params.set('from', fromDate);
    if (toDate) params.set('to', toDate);
  }
  const url = apiUrl(`/api/meter/events?${params}`, deviceId);
  const invalidDates = period === 'custom' && !!fromDate && !!toDate && fromDate > toDate;

  return (
    <div className="flex-1 p-4 md:p-6 lg:p-8 max-w-6xl w-full mx-auto">
      <header className="mb-5 md:mb-7">
        <h1 className="text-xl md:text-2xl font-bold tracking-tight">Eventos</h1>
        <p className="text-sm text-muted mt-0.5">
          Problemas detectados en tu instalación eléctrica
        </p>
      </header>

      <section className="mb-4 rounded-2xl border border-border-soft bg-surface p-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 lg:items-end">
          <label className="min-w-0">
            <span className={FILTER_LABEL}>Período</span>
            <select value={period} className={FILTER_FIELD} onChange={(e) => {
              setPinned(false);
              setPeriod(e.target.value as Period);
            }}>
              {PERIODS.map(({ value, label }) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
          <label className="min-w-0">
            <span className={FILTER_LABEL}>Tipo</span>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value as EventType | 'ALL')}
              className={FILTER_FIELD}
            >
              {TYPE_FILTERS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <div className="sm:self-end lg:w-48">
            <SwitchToggle
              label="Qué eventos mostrar"
              value={onlyActive ? 'activos' : 'todos'}
              onChange={(valor) => setOnlyActive(valor === 'activos')}
              options={[
                { value: 'todos', label: 'Todos' },
                {
                  value: 'activos',
                  label: 'En curso',
                },
              ]}
            />
          </div>
        </div>

        {period === 'custom' && (
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <label className="min-w-0">
              <span className={FILTER_LABEL}>Desde</span>
              <input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className={FILTER_FIELD}
              />
            </label>

            <label className="min-w-0">
              <span className={FILTER_LABEL}>Hasta</span>
              <input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className={FILTER_FIELD}
              />
            </label>
          </div>
        )}
        {filtersApplied && (
          <button type="button" className="mt-3 text-xs font-semibold text-accent hover:underline" onClick={() => {
            setTypeFilter('ALL');
            setOnlyActive(false);
            setPeriod('all');
            setPinned(false);
            setFromDate('');
            setToDate('');
          }}>
            Restablecer filtros
          </button>
        )}
      </section>

      {invalidDates ? <p role="alert" className="text-sm text-danger">La fecha Desde debe ser anterior o igual a Hasta.</p> : (
        <EventResults key={url} url={url} onlyActive={onlyActive} typeFilter={typeFilter}
          filtered={filtersApplied} fromMonitor={pinned} period={period} />
      )}
    </div>
  );
}

function EventResults({ url, onlyActive, typeFilter, filtered, fromMonitor, period }: {
  url: string;
  onlyActive: boolean;
  typeFilter: EventType | 'ALL';
  filtered: boolean;
  fromMonitor: boolean;
  period: Period;
}) {
  const [data, setData] = useState<Payload | null>(null);
  const [error, setError] = useState<ApiErrorPayload | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const fetchEvents = useCallback(async () => {
    try {
      const response = await fetch(url, { cache: 'no-store' });
      const payload = await response.json();
      if (!response.ok) {
        setError(payload as ApiErrorPayload);
        return;
      }
      setData(payload as Payload);
      setError(null);
    } catch {
      setError({ error: 'No se pudo contactar al servidor.' });
    }
  }, [url]);
  usePolling(fetchEvents, POLL_INTERVAL_MS);

  if (error?.missingEnv) return <SetupNotice missing={error.missingEnv} />;
  if (error) return <p role="alert" className="rounded-xl border border-danger/40 bg-danger/10 p-4 text-sm text-danger">{error.error}</p>;
  if (!data) return <p role="status" className="py-12 text-center text-sm text-muted">Cargando eventos…</p>;

  const visible = data.events.filter((event) =>
    (!onlyActive || event.endedAt === null) && (typeFilter === 'ALL' || event.type === typeFilter));
  const active = visible.filter((event) => event.endedAt === null).length;
  const resolved = visible.length - active;
  const { from, lastDay } = data.bounds;
  const label = PERIODS.find((option) => option.value === period)?.label;
  const range = from && lastDay ? `${formatDateShort(from)} al ${formatDateShort(lastDay)}`
    : from ? `Desde el ${formatDateShort(from)}`
    : lastDay ? `Hasta el ${formatDateShort(lastDay)}` : '';
  return (
    <>
      <section aria-label="Resumen de anomalías" className="mb-4 rounded-xl border border-border-soft bg-surface px-4 py-3 text-xs">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <h2 className="text-sm font-semibold">Anomalías del período</h2>
          <span className="text-muted">{fromMonitor ? 'Período de Monitor' : label}{range && ` · ${range}`}</span>
        </div>
        <p aria-live="polite" className="mt-1.5 text-muted">
          <strong className="text-foreground">{visible.length}</strong> {visible.length === 1 ? 'episodio detectado' : 'episodios detectados'} · {active} en curso · {resolved} {resolved === 1 ? 'resuelto' : 'resueltos'}
        </p>
      </section>
      {data?.thresholds && (
        <div className="mb-4 rounded-xl border border-border-soft bg-surface px-4 py-3 text-xs text-muted">
          <p className="font-semibold text-foreground mb-1.5">Umbrales vigentes del medidor</p>
          <ul className="grid gap-1 sm:grid-cols-2 lg:grid-cols-4">
            <li>Tensión menor a {formatNumber(data.thresholds.lowVoltageV, 1)} V</li>
            <li>Tensión mayor a {formatNumber(data.thresholds.highVoltageV, 1)} V</li>
            <li>Corriente mayor a {formatNumber(data.thresholds.overcurrentA, 1)} A</li>
            <li>Más de {data.effectiveGapMinutes} min sin lecturas</li>
          </ul>
        </div>
      )}

      {visible.length === 0 ? (
        <EmptyState filtered={filtered} />
      ) : (
        // La `key` incluye los filtros: al cambiarlos, React reemplaza la
        // lista y el desvanecido vuelve a correr, que es justo la senal de que
        // el resultado cambio.
        <ul
          key={`${typeFilter}-${onlyActive}`}
          className="space-y-3 animate-fade-in"
        >
          {visible.map((event) => (
            <EventCard
              key={event.id}
              event={event}
              expanded={expandedId === event.id}
              onToggle={() => setExpandedId(expandedId === event.id ? null : event.id)}
            />
          ))}
        </ul>
      )}
    </>
  );
}

function EventCard({
  event,
  expanded,
  onToggle,
}: {
  event: EventRecord;
  expanded: boolean;
  onToggle: () => void;
}) {
  // Se monta al primer despliegue y queda montado: evita pedir la serie de
  // cada evento del historial al entrar, sin perder la animación de cierre.
  const [mounted, setMounted] = useState(expanded);
  if (expanded && !mounted) setMounted(true);

  const style = SEVERITY_STYLE[event.severity];
  const Icon = style.icon;
  const ongoing = event.endedAt === null;

  return (
    <li className="rounded-2xl border border-border-soft bg-surface p-4 md:p-5">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-1.5 sm:gap-3 mb-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${style.chip}`}>
            <Icon className="h-3.5 w-3.5" />
            {style.label}
          </span>
          <h3 className="text-sm font-semibold">{EVENT_LABEL[event.type]}</h3>
          <InfoTooltip text={EVENT_DESCRIPTION[event.type]} title={EVENT_LABEL[event.type]} />
          {ongoing ? (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-danger/40 bg-danger/10 px-2.5 py-1 text-xs font-semibold text-danger">
              <span className="h-1.5 w-1.5 rounded-full bg-danger animate-pulse" />
              En curso
            </span>
          ) : (
            <span className="rounded-full border border-ok/40 bg-ok/10 px-2.5 py-1 text-xs font-semibold text-ok">Resuelto</span>
          )}
        </div>
        <span className="text-xs text-muted shrink-0">
          {event.samples === 1 && event.type !== 'DATA_GAP'
            ? 'Detectado en una lectura'
            : event.type === 'DATA_GAP'
              ? `Intervalo sin lecturas · ${formatDuration(event.startedAt, event.endedAt)}`
              : `Entre lecturas anómalas · ${formatDuration(event.startedAt, event.lastViolationAt)}`}
        </span>
      </div>

      <dl className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-2 text-xs">
        <Field label="Inicio" value={formatDateTime(event.startedAt)} />
        <Field label="Fin" value={ongoing ? 'En curso' : formatDateTime(event.endedAt)} />
        {event.type === 'LOW_VOLTAGE' && (
          <Field label="Tensión mínima" value={`${formatNumber(event.minVoltage, 1)} V`} />
        )}
        {event.type === 'HIGH_VOLTAGE' && (
          <Field label="Tensión máxima" value={`${formatNumber(event.maxVoltage, 1)} V`} />
        )}
        {event.type === 'OVERCURRENT' && (
          <Field label="Corriente máxima" value={`${formatNumber(event.maxCurrent, 3)} A`} />
        )}
        {event.type !== 'DATA_GAP' && (
          <Field label="Lecturas" value={event.samples.toLocaleString('es-AR')} />
        )}
      </dl>

      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-accent hover:underline"
      >
        {expanded ? 'Ocultar detalle' : 'Ver qué pasó'}
        <ChevronDown className={`h-3.5 w-3.5 transition-transform ${expanded ? 'rotate-180' : ''}`} />
      </button>

      {/*
        Despliegue con `grid-template-rows` de 0fr a 1fr: es la forma nativa de
        CSS de animar hacia una altura automática. Animar `height` con
        JavaScript exige medir el contenido, y acá adentro hay un gráfico que
        se dimensiona después de montarse — la medición daba cero y el panel
        quedaba cerrado aunque su contenido existiera.

        El gráfico se monta la primera vez que se abre y ya no se desmonta:
        así el cierre también se ve animado, y no se vuelve a pedir la serie
        al reabrir.
      */}
      {mounted && (
        <div
          className="grid transition-[grid-template-rows] duration-300 ease-in-out motion-reduce:transition-none"
          style={{ gridTemplateRows: expanded ? '1fr' : '0fr' }}
        >
          <div className="overflow-hidden">
            <p className="mt-3 text-xs leading-relaxed text-muted">{eventExplanation(event)}</p>
            <EventChart event={event} />
          </div>
        </div>
      )}
    </li>
  );
}

function eventExplanation(event: EventRecord): string {
  const details = {
    LOW_VOLTAGE: { value: event.minVoltage, unit: 'V', comparison: 'por debajo' },
    HIGH_VOLTAGE: { value: event.maxVoltage, unit: 'V', comparison: 'por encima' },
    OVERCURRENT: { value: event.maxCurrent, unit: 'A', comparison: 'por encima' },
  };
  const threshold = event.detectionThreshold;
  const start = `Inicio registrado el ${formatDateTime(event.startedAt)}.`;
  if (event.type === 'DATA_GAP') {
    const limit = threshold == null ? 'El umbral histórico no está disponible.' : `El límite aplicado era de ${threshold} min.`;
    return `Se registró un intervalo sin lecturas. ${limit} ${start}`;
  }
  const { value, unit, comparison } = details[event.type];
  const limit = threshold == null ? 'El umbral histórico no está disponible.' : `La lectura quedó ${comparison} del umbral de ${formatNumber(threshold, 1)} ${unit}.`;
  const measured = value == null ? '' : `Valor registrado: ${formatNumber(value, unit === 'A' ? 3 : 1)} ${unit}. `;
  const state = event.endedAt === null ? 'El episodio sigue abierto.' : 'El detector cerró el episodio después de evaluar las lecturas posteriores.';
  return `${measured}${limit} ${start} ${state}`;
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-muted">{label}</dt>
      <dd className="font-medium text-foreground mt-0.5">{value}</dd>
    </div>
  );
}

function EmptyState({ filtered }: { filtered: boolean }) {
  return (
    <div className="rounded-2xl border border-border-soft bg-surface p-10 text-center">
      <ShieldCheck className="h-8 w-8 text-ok mx-auto mb-3" />
      <p className="text-sm font-medium">
        {filtered
          ? 'Ningún evento coincide con los filtros elegidos.'
          : 'No se detectaron anomalías todavía.'}
      </p>
      <p className="mt-1 text-xs text-muted">
        {filtered
          ? 'Probá ampliando el rango de fechas o cambiando el tipo.'
          : 'El historial se actualiza con cada evaluación de lecturas.'}
      </p>
    </div>
  );
}
