'use client';

import { useCallback, useRef, useState } from 'react';
import { Activity, Eye, EyeOff, Gauge, Plug, RefreshCw, Zap } from 'lucide-react';
import { ActionCard } from './ActionCard';
import { ActiveEventsBanner } from './ActiveEventsBanner';
import { CollectorStatus } from './CollectorStatus';
import { HistoryChart } from './LazyCharts';
import { MonitorPeriodCards, type MonitorPeriod } from './MonitorPeriodCards';
import { MetricCard } from './MetricCard';
import { useSelectedMeterName } from './SelectedMeterName';
import { SetupNotice } from './SetupNotice';
import { toEventBands } from '@/lib/chart-markers';
import { formatDateTime, formatNumber, NO_DATA } from '@/lib/format';
import { DEFAULT_RANGE, RANGES, RANGE_KEYS, type RangeKey } from '@/lib/ranges';
import { apiUrl, useMeterId } from '@/lib/use-meter-id';
import { usePolling } from '@/lib/use-polling';
import type { EventRecord } from '@/lib/event-types';
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
  recommendations: Recommendation[];
  events: EventRecord[];
  thresholds: MeterThresholds | null;
};

export function Dashboard() {
  // De qué medidor habla esta pantalla. Lo dice la dirección del navegador.
  const deviceId=useMeterId();
  return <MeterDashboard key={deviceId??'default'} deviceId={deviceId}/>;
}

function MeterDashboard({deviceId}:{deviceId:string|null}) {
  const meterName = useSelectedMeterName(deviceId);
  const [period,setPeriod]=useState<MonitorPeriod|null>(null);
  const [periodFailed,setPeriodFailed]=useState(false);
  const [live, setLive] = useState<LiveReading | null>(null);
  const [history, setHistory] = useState<HistoryPayload | null>(null);
  const [range, setRange] = useState<RangeKey>(DEFAULT_RANGE);
  const [metric, setMetric] = useState<'power' | 'voltage'>('voltage');
  const [error, setError] = useState<ApiErrorPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [context, setContext] = useState<Context>({
    recommendations: [],
    events: [],
    thresholds: null,
  });
  const [showReferences, setShowReferences] = useState(true);

  // Evita que una respuesta lenta de un rango anterior pise a la del rango actual.
  const lastHistoryRequest = useRef(0);
  const lastPeriodRequest = useRef(0);

  const fetchLive = useCallback(async () => {
    try {
      const response = await fetch(apiUrl('/api/meter/live', deviceId), { cache: 'no-store' });
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
  }, [deviceId]);

  const fetchHistory = useCallback(async (key: RangeKey) => {
    const requestId = lastHistoryRequest.current + 1;
    lastHistoryRequest.current = requestId;

    try {
      const response = await fetch(apiUrl(`/api/meter/history?range=${key}`, deviceId), { cache: 'no-store' });
      const payload = await response.json();
      if (!response.ok) return;
      // Descarta la respuesta si mientras tanto se pidió otro rango.
      if (lastHistoryRequest.current !== requestId) return;

      setHistory(payload as HistoryPayload);
    } catch {
      // El histórico es complementario: su fallo no debe tapar la lectura viva.
    }
  }, [deviceId]);

  /**
   * Recomendaciones, eventos y umbrales alimentan las alertas y las marcas del
   * gráfico. Se consultan en paralelo pero de forma desacoplada para que un
   * error en Proyección no oculte los umbrales ni eventos del Monitor.
   */
  const fetchContext = useCallback(async () => {
    const [forecastResult, eventsResult] = await Promise.allSettled([
      fetch(apiUrl('/api/meter/forecast?period=billing', deviceId), { cache: 'no-store' }),
      fetch(apiUrl('/api/meter/events', deviceId), { cache: 'no-store' }),
    ]);

    let nextRecommendations: Recommendation[] | null = null;
    if (forecastResult.status === 'fulfilled' && forecastResult.value.ok) {
      try {
        const forecast = await forecastResult.value.json();
        nextRecommendations = forecast.recommendations ?? [];
      } catch {
        // Complementario
      }
    }

    let nextEvents: EventRecord[] | null = null;
    let nextThresholds: MeterThresholds | null | undefined = undefined;
    if (eventsResult.status === 'fulfilled' && eventsResult.value.ok) {
      try {
        const events = await eventsResult.value.json();
        nextEvents = events.events ?? [];
        nextThresholds = events.thresholds ?? null;
      } catch {
        // Complementario
      }
    }

    if (nextRecommendations !== null || nextEvents !== null || nextThresholds !== undefined) {
      setContext((prev) => ({
        recommendations: nextRecommendations ?? prev.recommendations,
        events: nextEvents ?? prev.events,
        thresholds: nextThresholds !== undefined ? nextThresholds : prev.thresholds,
      }));
    }
  }, [deviceId]);

  const fetchPeriod=useCallback(async()=>{
    const requestId=++lastPeriodRequest.current;
    try {
      const response=await fetch(apiUrl('/api/meter/monitor-period',deviceId),{cache:'no-store'});
      if(!response.ok)throw new Error();
      const payload=await response.json() as MonitorPeriod;
      if(requestId!==lastPeriodRequest.current)return;
      setPeriod(payload);setPeriodFailed(false);
    }catch{
      if(requestId!==lastPeriodRequest.current)return;
      setPeriod(null);setPeriodFailed(true);
    }
  },[deviceId]);
  usePolling(fetchPeriod, CONTEXT_INTERVAL_MS);

  const pollHistory = useCallback(() => fetchHistory(range), [fetchHistory, range]);

  usePolling(fetchLive, LIVE_INTERVAL_MS);
  usePolling(pollHistory, HISTORY_INTERVAL_MS);
  usePolling(fetchContext, CONTEXT_INTERVAL_MS);

  if (error?.missingEnv) {
    return <SetupNotice missing={error.missingEnv} />;
  }

  const summary = history?.summary;
  const series = history?.series ?? [];
  const averagePowerW = summary?.avgPowerW ?? null;
  const hasVisibleEvents =
    series.length > 0 &&
    toEventBands(
      context.events,
      new Date(series[0].bucket).getTime(),
      new Date(series[series.length - 1].bucket).getTime()
    ).length > 0;

  const voltageTip = context.thresholds
    ? `Tensión medida en vivo por el medidor y promedio del rango ${range}. Tus umbrales de alerta configurados son ${formatNumber(context.thresholds.lowVoltageV, 1)} V a ${formatNumber(context.thresholds.highVoltageV, 1)} V.`
    : `Tensión medida en vivo por el medidor y promedio del rango ${range}. Podés configurar los umbrales de alerta en Ajustes.`;
  const currentTip = context.thresholds
    ? `Corriente instantánea que circula por la instalación y máxima registrada en el rango ${range}. Se alerta sobrecorriente por encima de ${formatNumber(context.thresholds.overcurrentA, 1)} A.`
    : `Corriente instantánea que circula por la instalación y máxima registrada en el rango ${range}.`;
  const powerTip = `Potencia activa instantánea medida ahora (en W) y pico observado en el rango ${range}. Un pico puntual al encender un equipo no se clasifica automáticamente como anomalía.`;
  const energyTip =
    'Registro histórico acumulado del medidor desde su instalación (en kWh). No es el consumo del mes ni del período actual: el consumo y gasto del período se calculan por diferencia entre lecturas en "Gasto del período".';

  return (
    <div className="meter-monitor flex-1 min-w-0 w-full mx-auto">
      <Header name={meterName} live={live} loading={loading} failed={Boolean(error)} onRefresh={fetchLive} />

      <ActiveEventsBanner />

      {error && (
        <p className="mb-3 rounded-xl border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger">
          {error.error}
        </p>
      )}

      {/* `skipped` es lo normal: significa que todavía no toca guardar según
          el intervalo configurado. Solo `failed` es un problema real. */}
      {live?.persisted === 'failed' && (
        <p className="mb-3 rounded-xl border border-warn/40 bg-warn/10 px-3 py-2 text-sm text-warn">
          Lectura en vivo disponible, pero no se pudo guardar en la base. El histórico no avanza.
        </p>
      )}

      <section className="monitor-section grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4" aria-label="Indicadores eléctricos">
        <MetricCard
          label="Tensión"
          value={formatNumber(live?.voltage, 1)}
          unit="V"
          icon={<Zap className="h-4 w-4" />}
          hint={summary?.avgVoltage != null ? `Promedio ${formatNumber(summary.avgVoltage, 1)} V` : ''}
          tip={voltageTip}
        />
        <MetricCard
          label="Corriente"
          value={formatNumber(live?.current, 3)}
          unit="A"
          icon={<Activity className="h-4 w-4" />}
          hint={summary?.maxCurrent != null ? `Máxima ${formatNumber(summary.maxCurrent, 3)} A` : ''}
          tip={currentTip}
        />
        <MetricCard
          label="Potencia"
          value={formatNumber(live?.powerW, 0)}
          unit="W"
          icon={<Gauge className="h-4 w-4" />}
          hint={summary?.maxPowerW != null ? `Pico ${formatNumber(summary.maxPowerW, 0)} W` : ''}
          tone="ok"
          tip={powerTip}
        />
        <MetricCard
          label="Energía acumulada"
          value={formatNumber(live?.totalEnergyKwh, 2)}
          unit="kWh"
          icon={<Plug className="h-4 w-4" />}
          hint="Total histórico del medidor"
          tip={energyTip}
        />
      </section>
      <MonitorPeriodCards data={period} failed={periodFailed} deviceId={deviceId}/>

      <section aria-label="Historial de mediciones" className="rounded-2xl border border-border-soft bg-surface p-3 sm:p-4">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
          <div className="flex gap-1 rounded-xl bg-surface-raised p-1">
            <Toggle active={metric === 'voltage'} onClick={() => setMetric('voltage')}>
              Tensión
            </Toggle>
            <Toggle active={metric === 'power'} onClick={() => setMetric('power')}>
              Potencia
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

        <div className="monitor-chart">
          <HistoryChart
            series={series}
            bucketSeconds={history?.bucketSeconds ?? 900}
            metric={metric}
            thresholds={context.thresholds}
            averagePowerW={averagePowerW}
            events={context.events}
            showReferences={showReferences}
          />
        </div>

        {showReferences && (
          <ChartLegend
            metric={metric}
            thresholds={context.thresholds}
            averagePowerW={averagePowerW}
            hasEvents={hasVisibleEvents}
          />
        )}

        <footer className="mt-2 pt-2 border-t border-border-soft flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
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
      <div className="monitor-recommendations"><ActionCard recommendations={context.recommendations} deviceId={deviceId} /></div>
    </div>
  );
}

/** Distingue visualmente valores medidos, umbrales de alerta, referencias estadísticas y anomalías. */
function ChartLegend({
  metric,
  thresholds,
  averagePowerW,
  hasEvents,
}: {
  metric: 'power' | 'voltage';
  thresholds: MeterThresholds | null;
  averagePowerW: number | null;
  hasEvents: boolean;
}) {
  const items: { swatch: React.ReactNode; label: string }[] = [
    {
      swatch: (
        <span
          className={`inline-block h-0.5 w-4 rounded-full ${
            metric === 'voltage' ? 'bg-chart-voltage' : 'bg-chart-power'
          }`}
        />
      ),
      label: metric === 'voltage' ? 'Valores medidos (tensión)' : 'Valores medidos (potencia)',
    },
  ];

  if (metric === 'voltage' && thresholds) {
    items.push({
      swatch: <span className="inline-block w-4 border-t-2 border-dashed border-danger" />,
      label: `Umbrales de alerta configurados (${formatNumber(thresholds.lowVoltageV, 1)} V – ${formatNumber(thresholds.highVoltageV, 1)} V)`,
    });
  } else if (metric === 'power' && averagePowerW !== null) {
    items.push({
      swatch: <span className="inline-block w-4 border-t-2 border-dotted border-chart-reference" />,
      label: `Referencia estadística: promedio del rango (${Math.round(averagePowerW)} W)`,
    });
  }

  if (hasEvents) {
    items.push({
      swatch: <span className="inline-block h-2.5 w-3.5 rounded-sm border border-warn/50 bg-warn/25" />,
      label: 'Franjas sombreadas: episodios de anomalía en el rango',
    });
  }

  return (
    <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
      {items.map((item) => (
        <li key={item.label} className="inline-flex items-center gap-1.5">
          {item.swatch}
          {item.label}
        </li>
      ))}
    </ul>
  );
}

function Header({
  name, live, loading, failed, onRefresh,
}: {
  name: string;
  live: LiveReading | null;
  loading: boolean;
  failed: boolean;
  onRefresh: () => void;
}) {
  return (
    <header className="monitor-section grid grid-cols-[minmax(0,1fr)_auto] items-start gap-x-3 gap-y-1.5">
      <h1 className="self-center break-words text-xl md:text-2xl font-bold tracking-tight">
        {name ? `Monitor · ${name}` : 'Monitor del medidor'}
      </h1>
      <button
        type="button"
        onClick={onRefresh}
        aria-label="Actualizar lectura"
        className="inline-flex items-center gap-2 rounded-xl border border-border-soft bg-surface px-3 py-2 text-sm font-medium text-muted transition-colors hover:text-foreground"
      >
        <RefreshCw className={`h-4 w-4 ${loading ? 'motion-safe:animate-spin' : ''}`} aria-hidden="true" />
        <span className="hidden sm:inline">Actualizar</span>
      </button>
      <div className="col-span-full flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <p className="text-xs text-muted">
          Última lectura {live ? formatDateTime(live.recordedAt) : NO_DATA}
        </p>
        <StatusPill online={live?.online ?? false} known={live !== null} failed={failed} />
        <CollectorStatus />
      </div>
    </header>
  );
}

function StatusPill({ online, known, failed }: { online: boolean; known: boolean; failed: boolean }) {
  if (failed || !known) {
    return (
      <span className="inline-flex items-center gap-2 rounded-full border border-border-soft px-3 py-1.5 text-xs font-medium text-muted">
        <span className="h-2 w-2 rounded-full bg-muted" />
        {failed ? 'Estado del medidor sin confirmar' : 'Conectando'}
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full border px-2 py-1 text-xs font-medium ${
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
      aria-pressed={active}
      className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
        active ? 'bg-accent text-white' : 'text-muted hover:text-foreground'
      }`}
    >
      {children}
    </button>
  );
}
