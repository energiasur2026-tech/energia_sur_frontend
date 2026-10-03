'use client';

import { useCallback, useRef, useState } from 'react';
import { Activity, Eye, EyeOff, Gauge, Plug, RefreshCw, Target, TriangleAlert, Zap } from 'lucide-react';
import { ActionCard } from './ActionCard';
import { ActiveEventsBanner } from './ActiveEventsBanner';
import { CollectorStatus } from './CollectorStatus';
import { HistoryChart } from './LazyCharts';
import { MetricCard } from './MetricCard';
import { SetupNotice } from './SetupNotice';
import { formatClock, formatDateTime, formatNumber, NO_DATA } from '@/lib/format';
import { DEFAULT_RANGE, RANGES, RANGE_KEYS, type RangeKey } from '@/lib/ranges';
import { usePolling } from '@/lib/use-polling';
import type { EventRecord } from '@/lib/event-types';
import type { GoalProgress } from '@/lib/goal';
import type { Recommendation } from '@/lib/recommendations';
import type { MeterThresholds } from '@/lib/threshold-types';
import type { ApiErrorPayload, HistoryPayload, LiveReading } from '@/lib/types';

/** Cadencia del sondeo en vivo, alineada con la cubeta de 5 s de la base. */
const LIVE_INTERVAL_MS = 5000;
/** El histórico se refresca mas espaciado: agrega, no necesita cada muestra. */
const HISTORY_INTERVAL_MS = 60000;
/** Objetivo y eventos cambian lento; se leen junto al histórico. */
const CONTEXT_INTERVAL_MS = 60000;

type Context = {
  goal: GoalProgress | null;
  recommendations: Recommendation[];
  events: EventRecord[];
  thresholds: MeterThresholds | null;
};

export function Dashboard() {
  const [live, setLive] = useState<LiveReading | null>(null);
  const [history, setHistory] = useState<HistoryPayload | null>(null);
  const [range, setRange] = useState<RangeKey>(DEFAULT_RANGE);
  const [metric, setMetric] = useState<'power' | 'voltage'>('power');
  const [error, setError] = useState<ApiErrorPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [context, setContext] = useState<Context>({
    goal: null,
    recommendations: [],
    events: [],
    thresholds: null,
  });
  const [showReferences, setShowReferences] = useState(true);

  // Evita que una respuesta lenta de un rango anterior pise a la del rango actual.
  const lastHistoryRequest = useRef(0);

  const fetchLive = useCallback(async () => {
    try {
      const response = await fetch('/api/meter/live', { cache: 'no-store' });
      const payload = await response.json();

      if (!response.ok) {
        setError(payload as ApiErrorPayload);
        return;
      }

      setLive(payload as LiveReading);
      setError(null);
    } catch {
      setError({ error: 'No se pudo contactar al servidor.' });
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchHistory = useCallback(async (key: RangeKey) => {
    const requestId = lastHistoryRequest.current + 1;
    lastHistoryRequest.current = requestId;

    try {
      const response = await fetch(`/api/meter/history?range=${key}`, { cache: 'no-store' });
      const payload = await response.json();
      if (!response.ok) return;
      // Descarta la respuesta si mientras tanto se pidió otro rango.
      if (lastHistoryRequest.current !== requestId) return;

      setHistory(payload as HistoryPayload);
    } catch {
      // El histórico es complementario: su fallo no debe tapar la lectura viva.
    }
  }, []);

  /**
   * Objetivo, eventos y umbrales alimentan los KPIs nuevos y las marcas del
   * gráfico. Se piden juntos y su falla no interrumpe la lectura en vivo.
   */
  const fetchContext = useCallback(async () => {
    try {
      const [forecastResponse, eventsResponse] = await Promise.all([
        fetch('/api/meter/forecast', { cache: 'no-store' }),
        fetch('/api/meter/events', { cache: 'no-store' }),
      ]);

      if (!forecastResponse.ok || !eventsResponse.ok) return;

      const forecast = await forecastResponse.json();
      const events = await eventsResponse.json();

      setContext({
        goal: forecast.goal ?? null,
        recommendations: forecast.recommendations ?? [],
        events: events.events ?? [],
        thresholds: events.thresholds ?? null,
      });
    } catch {
      // Complementario: el Monitor sigue funcionando sin este contexto.
    }
  }, []);

  const pollHistory = useCallback(() => fetchHistory(range), [fetchHistory, range]);

  usePolling(fetchLive, LIVE_INTERVAL_MS);
  usePolling(pollHistory, HISTORY_INTERVAL_MS);
  usePolling(fetchContext, CONTEXT_INTERVAL_MS);

  if (error?.missingEnv) {
    return <SetupNotice missing={error.missingEnv} />;
  }

  const summary = history?.summary;
  const activeEvents = context.events.filter((event) => event.endedAt === null);

  /**
   * Potencia media equivalente al objetivo: si el consumo se mantuviera parejo
   * todo el mes, este sería el nivel. Sirve como línea de referencia en el
   * gráfico de potencia — comparar contra ella dice, de un vistazo, si el
   * ritmo actual alcanza para cumplir la meta.
   */
  const goalPowerW =
    context.goal?.allowedPerDayKwh != null
      ? (context.goal.allowedPerDayKwh * 1000) / 24
      : null;

  return (
    <div className="flex-1 p-4 md:p-6 lg:p-8 max-w-6xl w-full mx-auto">
      <Header live={live} loading={loading} onRefresh={fetchLive} />

      <ActiveEventsBanner />

      {error && (
        <p className="mb-6 rounded-xl border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
          {error.error}
        </p>
      )}

      {/* `skipped` es lo normal: significa que todavía no toca guardar según
          el intervalo configurado. Solo `failed` es un problema real. */}
      {live?.persisted === 'failed' && (
        <p className="mb-6 rounded-xl border border-warn/40 bg-warn/10 px-4 py-3 text-sm text-warn">
          Lectura en vivo disponible, pero no se pudo guardar en la base. El histórico no avanza.
        </p>
      )}

      <ActionCard recommendations={context.recommendations} />

      {/* Los tooltips explican QUÉ ES cada magnitud, no qué número muestra:
          quien no sabe de electricidad necesita lo primero, no lo segundo. */}
      <section className="grid gap-3 md:gap-4 grid-cols-2 md:grid-cols-3 2xl:grid-cols-6 mb-6 md:mb-8">
        <MetricCard
          label="Tensión"
          value={formatNumber(live?.voltage, 1)}
          unit="V"
          icon={<Zap className="h-4 w-4" />}
          hint={summary?.avgVoltage ? `Promedio ${formatNumber(summary.avgVoltage, 1)} V` : ''}
          tip="Es la 'fuerza' con la que llega la electricidad a tu casa, medida en voltios. Acá debería rondar los 220 V. Si baja mucho, los motores (heladera, bomba) sufren; si sube mucho, se pueden dañar los aparatos electrónicos."
        />
        <MetricCard
          label="Corriente"
          value={formatNumber(live?.current, 3)}
          unit="A"
          icon={<Activity className="h-4 w-4" />}
          hint={summary?.maxCurrent ? `Máxima ${formatNumber(summary.maxCurrent, 3)} A` : ''}
          tip="Es cuánta electricidad está pasando en este momento por la instalación, medida en amperes. Sube cuando prendés algo y baja cuando lo apagás. Si sube demasiado, salta la térmica."
        />
        <MetricCard
          label="Potencia"
          value={formatNumber(live?.powerW, 0)}
          unit="W"
          icon={<Gauge className="h-4 w-4" />}
          hint={summary?.maxPowerW ? `Pico ${formatNumber(summary.maxPowerW, 0)} W` : ''}
          tone="ok"
          tip="Es cuánta electricidad estás usando ahora mismo, medida en watts. Una lámpara LED son unos 10 W; una pava eléctrica, unos 2000 W. Es el número que más se mueve durante el día."
        />
        <MetricCard
          label="Energía acumulada"
          value={formatNumber(live?.totalEnergyKwh, 2)}
          unit="kWh"
          icon={<Plug className="h-4 w-4" />}
          hint="Total del medidor"
          tip="Es el total que lleva contado el medidor desde que se instaló, en kilowatt-hora. Es el mismo número que mira la empresa de luz: la diferencia entre dos fechas es lo que consumiste en el medio, y es lo que te facturan."
        />
        <MetricCard
          label="Objetivo"
          value={goalValue(context.goal)}
          unit=""
          icon={<Target className="h-4 w-4" />}
          hint={goalHint(context.goal)}
          tone={goalTone(context.goal)}
          tip="Es la meta de consumo que vos elegís para el mes. La app la usa para avisarte si vas bien o si te estás pasando, con tiempo para corregir antes de que llegue la factura."
          action={{
            label: context.goal?.goalKwh ? 'Ver mi objetivo' : 'Configurar objetivo',
            href: '/proyeccion',
          }}
        />
        <MetricCard
          label="Anomalías"
          value={String(activeEvents.length)}
          unit=""
          icon={<TriangleAlert className="h-4 w-4" />}
          hint={activeEvents.length > 0 ? 'en curso ahora' : `${context.events.length} en el historial`}
          tone={activeEvents.length > 0 ? 'danger' : 'ok'}
          tip="Son problemas detectados en tu instalación: que la tensión se haya ido por debajo o por encima de lo normal, o que el medidor haya dejado de reportar. Cada uno queda registrado con su horario y duración."
          action={{ label: 'Ver eventos', href: '/eventos' }}
        />
      </section>

      <section className="rounded-2xl border border-border-soft bg-surface p-4 md:p-5 lg:p-6">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-5">
          <div className="flex gap-1 rounded-xl bg-surface-raised p-1">
            <Toggle active={metric === 'power'} onClick={() => setMetric('power')}>
              Potencia
            </Toggle>
            <Toggle active={metric === 'voltage'} onClick={() => setMetric('voltage')}>
              Tensión
            </Toggle>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Las referencias se pueden ocultar: con umbrales, objetivo y
                bandas de anomalía a la vez, el gráfico se vuelve ilegible. */}
            <button
              type="button"
              onClick={() => setShowReferences((visible) => !visible)}
              aria-pressed={showReferences}
              className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-semibold transition-colors ${
                showReferences
                  ? 'border-accent/40 bg-accent-soft/40 text-accent'
                  : 'border-border-soft text-muted hover:text-foreground'
              }`}
            >
              {showReferences ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
              Referencias
            </button>

            <div className="flex gap-1 rounded-xl bg-surface-raised p-1">
              {RANGE_KEYS.map((key) => (
                <Toggle key={key} active={range === key} onClick={() => setRange(key)}>
                  {key}
                </Toggle>
              ))}
            </div>
          </div>
        </div>

        <HistoryChart
          series={history?.series ?? []}
          bucketSeconds={history?.bucketSeconds ?? 900}
          metric={metric}
          thresholds={context.thresholds}
          goalPowerW={goalPowerW}
          events={context.events}
          showReferences={showReferences}
        />

        {showReferences && (
          <ChartLegend metric={metric} hasGoal={goalPowerW !== null} hasEvents={context.events.length > 0} />
        )}

        <footer className="mt-5 pt-4 border-t border-border-soft flex flex-wrap gap-x-6 gap-y-2 text-xs text-muted">
          <span>{RANGES[range].label}</span>
          <span>
            {summary?.samples ? `${summary.samples.toLocaleString('es-AR')} lecturas` : 'Sin lecturas'}
          </span>
          {summary?.firstAt && (
            <span>
              Desde {formatDateTime(summary.firstAt)} hasta {formatDateTime(summary.lastAt)}
            </span>
          )}
        </footer>
      </section>
    </div>
  );
}

/** Explica qué significa cada marca del gráfico, en palabras simples. */
function ChartLegend({
  metric,
  hasGoal,
  hasEvents,
}: {
  metric: 'power' | 'voltage';
  hasGoal: boolean;
  hasEvents: boolean;
}) {
  const items: { color: string; label: string }[] = [];

  if (metric === 'voltage') {
    items.push({
      color: 'bg-danger',
      label: 'Líneas cortadas: mínimo y máximo aceptables de tensión',
    });
  } else if (hasGoal) {
    items.push({
      color: 'bg-ok',
      label: 'Línea cortada: el nivel parejo que cumple tu objetivo',
    });
  }

  if (hasEvents) {
    items.push({ color: 'bg-warn/40', label: 'Franjas sombreadas: momentos con anomalías' });
  }

  if (items.length === 0) return null;

  return (
    <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5 text-[11px] text-muted">
      {items.map((item) => (
        <li key={item.label} className="inline-flex items-center gap-1.5">
          <span className={`h-2 w-3 rounded-sm ${item.color}`} />
          {item.label}
        </li>
      ))}
    </ul>
  );
}

function goalValue(goal: GoalProgress | null): string {
  if (!goal || goal.goalKwh === null) return NO_DATA;
  return `${formatNumber(goal.dailyRateKwh ?? 0, 1)} / ${formatNumber(goal.allowedPerDayKwh, 1)}`;
}

function goalHint(goal: GoalProgress | null): string {
  if (!goal || goal.goalKwh === null) return 'sin objetivo definido';
  if (goal.status === 'no_data') return 'esperando lecturas del mes';
  return 'kWh por día: usás / podés';
}

function goalTone(goal: GoalProgress | null): 'default' | 'ok' | 'warn' | 'danger' {
  if (!goal || goal.goalKwh === null) return 'default';
  if (goal.status === 'on_track') return 'ok';
  if (goal.status === 'at_risk') return 'warn';
  if (goal.status === 'over') return 'danger';
  return 'default';
}

function Header({
  live,
  loading,
  onRefresh,
}: {
  live: LiveReading | null;
  loading: boolean;
  onRefresh: () => void;
}) {
  return (
    <header className="mb-5 md:mb-7">
      {/* En celular el título y el botón comparten fila, y los indicadores
          bajan a una tira propia: apilar todo en columna comía media pantalla
          antes de mostrar un solo dato. */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-bold tracking-tight">Monitor del medidor</h1>
          <p className="text-sm text-muted mt-0.5">
            Última lectura {live ? formatClock(live.recordedAt) : NO_DATA}
          </p>
        </div>

        <button
          type="button"
          onClick={onRefresh}
          aria-label="Actualizar lectura"
          className="shrink-0 inline-flex items-center gap-2 rounded-xl border border-border-soft bg-surface px-3 py-2 text-sm font-medium text-muted transition-colors hover:text-foreground"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          <span className="hidden sm:inline">Actualizar</span>
        </button>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <StatusPill online={live?.online ?? false} known={live !== null} />
        <CollectorStatus />
      </div>
    </header>
  );
}

function StatusPill({ online, known }: { online: boolean; known: boolean }) {
  if (!known) {
    return (
      <span className="inline-flex items-center gap-2 rounded-full border border-border-soft px-3 py-1.5 text-xs font-medium text-muted">
        <span className="h-2 w-2 rounded-full bg-muted" />
        Conectando
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium ${
        online ? 'border-ok/40 bg-ok/10 text-ok' : 'border-danger/40 bg-danger/10 text-danger'
      }`}
    >
      <span className={`h-2 w-2 rounded-full ${online ? 'bg-ok' : 'bg-danger'}`} />
      {online ? 'Medidor en línea' : 'Medidor fuera de línea'}
    </span>
  );
}

function Toggle({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
        active ? 'bg-accent text-white' : 'text-muted hover:text-foreground'
      }`}
    >
      {children}
    </button>
  );
}
