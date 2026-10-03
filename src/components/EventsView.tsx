'use client';

import { useCallback, useMemo, useState } from 'react';
import { AlertTriangle, ChevronDown, CircleAlert, Info, ShieldCheck } from 'lucide-react';
import { formatDateTime, formatDuration, formatNumber } from '@/lib/format';
import {
  EVENT_DESCRIPTION,
  EVENT_LABEL,
  type EventRecord,
  type EventSeverity,
  type EventType,
} from '@/lib/event-types';
import type { MeterThresholds } from '@/lib/threshold-types';
import type { ApiErrorPayload } from '@/lib/types';
import { usePolling } from '@/lib/use-polling';
import { EventChart } from './LazyCharts';
import { InfoTooltip } from './InfoTooltip';
import { SwitchToggle } from './SwitchToggle';
import { SetupNotice } from './SetupNotice';

const POLL_INTERVAL_MS = 60000;

type Payload = { events: EventRecord[]; thresholds: MeterThresholds | null };

const SEVERITY_STYLE: Record<EventSeverity, { chip: string; icon: typeof Info; label: string }> = {
  INFO: { chip: 'border-border-soft bg-surface-raised text-muted', icon: Info, label: 'Informativo' },
  WARNING: { chip: 'border-warn/40 bg-warn/10 text-warn', icon: AlertTriangle, label: 'Advertencia' },
  CRITICAL: { chip: 'border-danger/40 bg-danger/10 text-danger', icon: CircleAlert, label: 'Crítico' },
};

/**
 * Los tres campos de filtro comparten alto y estilo. `h-11` (44 px) es ademas
 * el minimo recomendado para un objetivo tactil, y hace que `<select>` e
 * `<input type="date">` midan igual pese a sus alturas intrinsecas distintas.
 */
/**
 * `min-w-0` no es decorativo: un item de grilla tiene `min-width: auto`, o sea
 * que no puede achicarse por debajo de su contenido. Safari en iOS dibuja la
 * fecha como "14 ago 2026" —bastante mas ancha que el "14/08/2026" de Chrome—
 * y ese ancho intrinseco estiraba la celda hasta desbordar la tarjeta, con un
 * campo mas ancho que el otro. Con `min-w-0` la celda manda sobre el contenido.
 */
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

export function EventsView() {
  const [data, setData] = useState<Payload | null>(null);
  const [error, setError] = useState<ApiErrorPayload | null>(null);
  const [onlyActive, setOnlyActive] = useState(false);
  const [typeFilter, setTypeFilter] = useState<EventType | 'ALL'>('ALL');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const fetchEvents = useCallback(async () => {
    try {
      const response = await fetch('/api/meter/events', { cache: 'no-store' });
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
  }, []);

  usePolling(fetchEvents, POLL_INTERVAL_MS);

  const events = useMemo(() => data?.events ?? [], [data]);
  const active = useMemo(() => events.filter((e) => e.endedAt === null), [events]);

  /**
   * El filtrado ocurre en el navegador porque el historial completo ya vino en
   * la respuesta: pedirlo de nuevo al servidor por cada cambio de filtro
   * sumaría latencia sin traer nada nuevo.
   */
  const visible = useMemo(() => {
    // Las fechas del formulario son locales; el fin se corre al final del día
    // para que elegir el mismo día en ambos campos incluya esa jornada entera.
    const fromMs = fromDate ? new Date(`${fromDate}T00:00:00`).getTime() : null;
    const toMs = toDate ? new Date(`${toDate}T23:59:59`).getTime() : null;

    return events.filter((event) => {
      if (onlyActive && event.endedAt !== null) return false;
      if (typeFilter !== 'ALL' && event.type !== typeFilter) return false;

      const startedMs = new Date(event.startedAt).getTime();
      if (fromMs !== null && startedMs < fromMs) return false;
      if (toMs !== null && startedMs > toMs) return false;

      return true;
    });
  }, [events, onlyActive, typeFilter, fromDate, toDate]);

  const filtersApplied = typeFilter !== 'ALL' || fromDate !== '' || toDate !== '' || onlyActive;

  if (error?.missingEnv) return <SetupNotice missing={error.missingEnv} />;

  return (
    <div className="flex-1 p-4 md:p-6 lg:p-8 max-w-6xl w-full mx-auto">
      <header className="mb-5 md:mb-7">
        <h1 className="text-xl md:text-2xl font-bold tracking-tight">Eventos</h1>
        <p className="text-sm text-muted mt-0.5">
          Problemas detectados en tu instalación eléctrica
        </p>
      </header>

      {error && !error.missingEnv && (
        <p className="mb-6 rounded-xl border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
          {error.error}
        </p>
      )}

      <section className="mb-6 rounded-2xl border border-border-soft bg-surface p-4">
        {/* Grilla en vez de `flex`: `<select>` e `<input type="date">` tienen
            alturas intrinsecas distintas segun el navegador, y alineados por
            abajo sus etiquetas quedaban a distinta altura. Con columnas
            explicitas y una altura fija para los tres campos, las etiquetas y
            las cajas quedan a la misma linea.

            En celular cada campo ocupa la fila entera. Safari en iOS le impone
            a `input[type=date]` un ancho minimo interno que `width: 100%` no
            puede vencer, asi que en media columna el campo se desbordaba de la
            tarjeta y quedaba mas ancho que su par. A fila completa esa
            condicion no existe, y de paso el area para tocar es mas grande. */}
        <div className="grid grid-cols-2 gap-3 md:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_minmax(0,1fr)_auto] md:items-end">
          <label className="col-span-2 min-w-0 md:col-span-1">
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

          <label className="col-span-2 min-w-0 md:col-span-1">
            <span className={FILTER_LABEL}>Desde</span>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className={FILTER_FIELD}
            />
          </label>

          <label className="col-span-2 min-w-0 md:col-span-1">
            <span className={FILTER_LABEL}>Hasta</span>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className={FILTER_FIELD}
            />
          </label>

          {/* Interruptor con las dos opciones a la vista. Un boton que
              rotara entre estados ocuparia menos, pero esconde la alternativa:
              quien entra por primera vez ve una sola opcion y no tiene forma
              de saber que hay otra salvo tocando a ver que pasa. */}
          <div className="col-span-2 md:col-span-1 md:w-48">
            <SwitchToggle
              label="Qué eventos mostrar"
              value={onlyActive ? 'activos' : 'todos'}
              onChange={(valor) => setOnlyActive(valor === 'activos')}
              options={[
                { value: 'todos', label: 'Todos' },
                {
                  value: 'activos',
                  label: active.length > 0 ? `En curso (${active.length})` : 'En curso',
                },
              ]}
            />
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-muted">
          <span>
            {visible.length === events.length
              ? `${events.length} evento${events.length === 1 ? '' : 's'}`
              : `${visible.length} de ${events.length} eventos`}
          </span>
          {filtersApplied && (
            <button
              type="button"
              onClick={() => {
                setTypeFilter('ALL');
                setFromDate('');
                setToDate('');
                setOnlyActive(false);
              }}
              className="font-semibold text-accent hover:underline"
            >
              Limpiar filtros
            </button>
          )}
        </div>
      </section>

      {data?.thresholds && (
        <div className="mb-6 rounded-xl border border-border-soft bg-surface px-4 py-3 text-xs text-muted">
          <p className="font-semibold text-foreground mb-1.5">Se considera anomalía cuando</p>
          <ul className="grid gap-1 sm:grid-cols-2 lg:grid-cols-4">
            <li>Tensión menor a {formatNumber(data.thresholds.lowVoltageV, 1)} V</li>
            <li>Tensión mayor a {formatNumber(data.thresholds.highVoltageV, 1)} V</li>
            <li>Corriente mayor a {formatNumber(data.thresholds.overcurrentA, 1)} A</li>
            <li>Más de {data.thresholds.gapMinutes} min sin lecturas</li>
          </ul>
        </div>
      )}

      {visible.length === 0 ? (
        <EmptyState filtered={filtersApplied} loaded={data !== null} />
      ) : (
        // La `key` incluye los filtros: al cambiarlos, React reemplaza la
        // lista y el desvanecido vuelve a correr, que es justo la senal de que
        // el resultado cambio.
        <ul
          key={`${typeFilter}-${fromDate}-${toDate}-${onlyActive}`}
          className="space-y-3 animate-fade-in"
        >
          {visible.map((event) => (
            <EventCard
              key={event.id}
              event={event}
              thresholds={data?.thresholds ?? null}
              expanded={expandedId === event.id}
              onToggle={() => setExpandedId(expandedId === event.id ? null : event.id)}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function EventCard({
  event,
  thresholds,
  expanded,
  onToggle,
}: {
  event: EventRecord;
  thresholds: MeterThresholds | null;
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
          {ongoing && (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-danger/40 bg-danger/10 px-2.5 py-1 text-xs font-semibold text-danger">
              <span className="h-1.5 w-1.5 rounded-full bg-danger animate-pulse" />
              En curso
            </span>
          )}
        </div>
        <span className="text-xs text-muted shrink-0">
          Duró {formatDuration(event.startedAt, event.endedAt)}
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
        {expanded ? 'Ocultar gráfico' : 'Ver qué pasó'}
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
            <EventChart event={event} thresholds={thresholds} />
          </div>
        </div>
      )}
    </li>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-muted">{label}</dt>
      <dd className="font-medium text-foreground mt-0.5">{value}</dd>
    </div>
  );
}

function EmptyState({ filtered, loaded }: { filtered: boolean; loaded: boolean }) {
  if (!loaded) {
    return <p className="text-center text-sm text-muted py-16">Cargando eventos…</p>;
  }

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
          : 'La detección corre en cada ciclo del recolector. Que no haya eventos es una buena noticia.'}
      </p>
    </div>
  );
}
