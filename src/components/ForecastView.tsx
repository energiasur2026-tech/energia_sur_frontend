'use client';

import { useCallback, useState } from 'react';
import { Hourglass, Info, Receipt, TrendingUp } from 'lucide-react';
import { formatCurrency, formatDateTime, formatNumber, NO_DATA } from '@/lib/format';
import type { Forecast, ForecastConfidence } from '@/lib/forecast';
import type { GoalProgress } from '@/lib/goal';
import type { Recommendation } from '@/lib/recommendations';
import { GoalPanel, type MonthDailyPoint } from './GoalPanel';
import { GoalSetter } from './GoalSetter';
import type { ApiErrorPayload } from '@/lib/types';
import { usePolling } from '@/lib/use-polling';
import { InfoTooltip } from './InfoTooltip';
import { ValueFade } from './ValueFade';
import { HourlyProfile } from './LazyCharts';
import type { ProfilePoint } from './HourlyProfile';
import { SetupNotice } from './SetupNotice';

/** La proyección cambia lentamente: no tiene sentido refrescarla seguido. */
const POLL_INTERVAL_MS = 300000;

type Payload = {
  forecast: Forecast;
  profile: ProfilePoint[] | null;
  profileMinDays: number;
  lookbackDays: number;
  goal: GoalProgress;
  monthDaily: MonthDailyPoint[];
  recommendations: Recommendation[];
};

const CONFIDENCE: Record<ForecastConfidence, { label: string; chip: string; note: string }> = {
  low: {
    label: 'Confianza baja',
    chip: 'border-warn/40 bg-warn/10 text-warn',
    note: 'Con pocos días medidos, un día atípico distorsiona la proyección. Va a mejorar sola con el tiempo.',
  },
  medium: {
    label: 'Confianza media',
    chip: 'border-accent/40 bg-accent-soft/50 text-accent',
    note: 'Ya cubre varios días. Todavía no alcanza a reflejar diferencias entre días de semana y fin de semana.',
  },
  high: {
    label: 'Confianza alta',
    chip: 'border-ok/40 bg-ok/10 text-ok',
    note: 'La muestra cubre al menos dos semanas, así que incluye la variación entre días hábiles y fines de semana.',
  },
};

const UNAVAILABLE: Record<string, string> = {
  no_data: 'Todavía no hay lecturas suficientes para proyectar nada.',
  insufficient_span:
    'Las lecturas cubren menos de un día completo. Proyectar a un mes a partir de unas pocas horas multiplicaría por 30 el sesgo de esa franja horaria, así que no se estima.',
  counter_decreased:
    'El contador de energía del medidor retrocedió (posible reinicio o reemplazo). No se proyecta hasta tener una serie consistente.',
};

export function ForecastView() {
  const [data, setData] = useState<Payload | null>(null);
  const [error, setError] = useState<ApiErrorPayload | null>(null);

  const fetchForecast = useCallback(async () => {
    try {
      const response = await fetch('/api/meter/forecast', { cache: 'no-store' });
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

  usePolling(fetchForecast, POLL_INTERVAL_MS);

  if (error?.missingEnv) return <SetupNotice missing={error.missingEnv} />;

  const forecast = data?.forecast;

  return (
    <div className="flex-1 p-4 md:p-6 lg:p-8 max-w-6xl w-full mx-auto">
      <header className="mb-5 md:mb-7">
        <h1 className="text-xl md:text-2xl font-bold tracking-tight">Mi objetivo</h1>
        <p className="text-sm text-muted mt-0.5">
          Poné una meta de consumo y seguí si la estás cumpliendo
        </p>
      </header>

      {error && !error.missingEnv && (
        <p className="mb-6 rounded-xl border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
          {error.error}
        </p>
      )}

      {!data && <p className="text-center text-sm text-muted py-16">Calculando…</p>}

      {data && (
        <>
          <GoalSetter goal={data.goal} onSaved={fetchForecast} />
          <GoalPanel
            goal={data.goal}
            monthDaily={data.monthDaily}
            recommendations={data.recommendations}
          />
        </>
      )}

      {data && (
        <div className="mt-8 mb-3">
          <h2 className="text-sm font-semibold">Si seguís al ritmo actual</h2>
          <p className="text-xs text-muted mt-0.5">
            Proyección a 30 días desde hoy, independiente del mes calendario.
          </p>
        </div>
      )}

      {forecast && !forecast.available && (
        <section className="rounded-2xl border border-warn/40 bg-surface p-6">
          <div className="flex items-start gap-3">
            <Hourglass className="h-5 w-5 text-warn shrink-0 mt-0.5" />
            <div>
              <h2 className="text-sm font-semibold mb-1">Todavía no se puede proyectar</h2>
              <p className="text-sm text-muted leading-relaxed">{UNAVAILABLE[forecast.reason]}</p>
              <dl className="mt-4 grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-2 text-xs">
                <Field label="Datos disponibles" value={`${formatNumber(forecast.spanDays, 2)} días`} />
                <Field label="Días con lecturas" value={String(forecast.daysWithData)} />
                <Field label="Lecturas" value={forecast.samples.toLocaleString('es-AR')} />
              </dl>
            </div>
          </div>
        </section>
      )}

      {forecast?.available && (
        <div className="animate-fade-in">
          <section className="grid gap-4 grid-cols-1 sm:grid-cols-2 mb-6">
            <article className="rounded-2xl border border-border-soft bg-surface p-6">
              <header className="flex items-center gap-2 mb-4">
                <TrendingUp className="h-4 w-4 text-accent" />
                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">
                  Consumo proyectado · 30 días
                </h3>
                <InfoTooltip title="Consumo proyectado · 30 días" text="Cuánta electricidad vas a usar en los próximos 30 días si seguís consumiendo como hasta ahora. Se calcula con tu promedio diario medido; no adivina cambios de hábitos ni de estación." />
              </header>
              <p className="flex items-baseline gap-1.5">
                <ValueFade
                  className="text-4xl font-bold tabular-nums tracking-tight"
                  value={formatNumber(forecast.projectedKwh, 2)}
                />
                <span className="text-sm font-medium text-muted">kWh</span>
              </p>
              <p className="mt-1 text-xs text-muted">
                {formatNumber(forecast.dailyAverageKwh, 3)} kWh/día medidos
              </p>
            </article>

            <article className="rounded-2xl border border-border-soft bg-surface p-6">
              <header className="flex items-center gap-2 mb-4">
                <Receipt className="h-4 w-4 text-ok" />
                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">
                  Costo estimado de esos 30 días
                </h3>
                <InfoTooltip title="Costo estimado de esos 30 días" text="Lo que costaría esa electricidad proyectada, según el cuadro tarifario. Es solo la parte de energía de la factura: no incluye agua, cloaca ni otros conceptos." />
              </header>
              <p>
                <ValueFade
                  className="text-4xl font-bold tabular-nums tracking-tight"
                  value={formatCurrency(forecast.cost.total)}
                />
              </p>
              <p className="mt-1 text-xs text-muted">
                Residencial sin subsidio · no incluye agua ni cloaca
              </p>
            </article>
          </section>

          <section className="rounded-2xl border border-border-soft bg-surface p-4 md:p-5 lg:p-6 mb-6">
            <div className="flex flex-wrap items-center gap-3 mb-4">
              <span
                className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${
                  CONFIDENCE[forecast.confidence].chip
                }`}
              >
                <Info className="h-3.5 w-3.5" />
                {CONFIDENCE[forecast.confidence].label}
              </span>
              <h3 className="text-sm font-semibold">En qué se basa</h3>
              <InfoTooltip title="En qué se basa" text="El medidor lleva un contador de energía acumulado, así que la diferencia entre la primera y la última lectura captura todo el consumo del período, incluso lo que pasó entre muestras. Por eso la confianza depende de cuántos días abarca la serie, no de cada cuánto se guarda." />
            </div>

            <p className="text-xs text-muted leading-relaxed mb-4">
              {CONFIDENCE[forecast.confidence].note}
            </p>

            <dl className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-3 text-xs">
              <Field label="Consumo medido" value={`${formatNumber(forecast.measuredKwh, 3)} kWh`} />
              <Field label="Período medido" value={`${formatNumber(forecast.spanDays, 2)} días`} />
              <Field label="Días con lecturas" value={String(forecast.daysWithData)} />
              <Field label="Lecturas" value={forecast.samples.toLocaleString('es-AR')} />
              <Field label="Desde" value={formatDateTime(forecast.firstAt)} />
              <Field label="Hasta" value={formatDateTime(forecast.lastAt)} />
            </dl>

            <p className="mt-4 pt-4 border-t border-border-soft text-xs text-muted leading-relaxed">
              La proyección extrapola el promedio diario medido. Asume que el
              uso se mantiene parecido: no anticipa cambios de hábitos, de
              estación ni equipos nuevos.
            </p>
          </section>
        </div>
      )}

      {data && <HourlyProfile data={data} />}
    </div>
  );
}


function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-muted">{label}</dt>
      <dd className="font-medium text-foreground mt-0.5">{value === '' ? NO_DATA : value}</dd>
    </div>
  );
}

