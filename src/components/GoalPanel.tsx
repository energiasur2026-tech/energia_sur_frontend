'use client';

import { CheckCircle2, Lightbulb, TriangleAlert } from 'lucide-react';
import { formatCurrency, formatNumber } from '@/lib/format';
import type { GoalProgress, GoalStatus } from '@/lib/goal';
import type { Recommendation } from '@/lib/recommendations';
import { InfoTooltip } from './InfoTooltip';
import { ValueFade } from './ValueFade';
import { MonthChart } from './LazyCharts';
import type { MonthDailyPoint } from './MonthChart';

export type { MonthDailyPoint };

const STATUS: Record<
  Exclude<GoalStatus, 'no_goal' | 'no_data'>,
  { label: string; chip: string; icon: typeof CheckCircle2; message: (goal: GoalProgress) => string }
> = {
  on_track: {
    label: 'Vas bien',
    chip: 'border-ok/40 bg-ok/10 text-ok',
    icon: CheckCircle2,
    message: (goal) =>
      `Si seguís así, terminás el mes en ${formatNumber(goal.projectedMonthKwh, 1)} kWh y cumplís tu objetivo.`,
  },
  at_risk: {
    label: 'Justo al límite',
    chip: 'border-warn/40 bg-warn/10 text-warn',
    icon: TriangleAlert,
    message: (goal) =>
      `Al ritmo actual terminarías en ${formatNumber(goal.projectedMonthKwh, 1)} kWh, apenas por encima de tu objetivo. Un ajuste chico alcanza.`,
  },
  over: {
    label: 'Te estás pasando',
    chip: 'border-danger/40 bg-danger/10 text-danger',
    icon: TriangleAlert,
    message: (goal) =>
      `Al ritmo actual terminarías en ${formatNumber(goal.projectedMonthKwh, 1)} kWh, bastante por encima de tu objetivo.`,
  },
};

export function GoalPanel({
  goal,
  monthDaily,
  recommendations,
}: {
  goal: GoalProgress;
  monthDaily: MonthDailyPoint[];
  recommendations: Recommendation[];
}) {
  if (goal.status === 'no_goal') return null;

  if (goal.status === 'no_data') {
    return (
      <section className="rounded-2xl border border-border-soft bg-surface p-4 md:p-5 lg:p-6 mb-6 animate-fade-in">
        <h2 className="text-sm font-semibold mb-2">Avance del mes</h2>
        <p className="text-sm text-muted leading-relaxed">
          Tu objetivo está definido, pero todavía no hay suficientes lecturas de
          este mes para medir cuánto llevás consumido. En cuanto se acumulen,
          esta sección te muestra si vas bien o te estás pasando.
        </p>
        <dl className="mt-4 grid grid-cols-2 gap-4 text-xs">
          <Kpi
            label="Podés consumir por día"
            value={`${formatNumber(goal.allowedPerDayKwh, 2)} kWh`}
            tip="Es tu objetivo mensual dividido por los días del mes. Si te mantenés en ese número cada día, llegás justo a la meta."
          />
          <Kpi
            label="Podés consumir por semana"
            value={`${formatNumber(goal.allowedPerWeekKwh, 1)} kWh`}
            tip="Lo mismo que el límite diario, pero acumulado en siete días. Sirve si preferís mirarlo semana a semana en vez de todos los días."
          />
        </dl>
      </section>
    );
  }

  const status = STATUS[goal.status];
  const StatusIcon = status.icon;

  return (
    <>
      <section className="rounded-2xl border border-border-soft bg-surface p-4 md:p-5 lg:p-6 mb-6 animate-fade-in">
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <span
            className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold ${status.chip}`}
          >
            <StatusIcon className="h-3.5 w-3.5" />
            {status.label}
          </span>
          <h2 className="text-sm font-semibold">Cómo venís este mes</h2>
        </div>

        <p className="text-sm text-muted leading-relaxed mb-4">{status.message(goal)}</p>

        {/* Si el medidor no cubrió todo el mes, decirlo: el cálculo asume que
            los días sin medir se parecieron a los medidos. */}
        {goal.coverage !== null && goal.coverage < 0.9 && (
          <p className="mb-4 rounded-xl border border-border-soft bg-surface-raised px-4 py-3 text-xs text-muted leading-relaxed">
            Hay {formatNumber(goal.measuredDays, 1)} de {formatNumber(goal.elapsedDays, 0)} días
            del mes con mediciones. La proyección supone que los días sin medir
            se parecieron a los medidos.
          </p>
        )}

        <dl className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Kpi
            label="Llevás consumido"
            value={`${formatNumber(goal.consumedKwh, 1)} kWh`}
            hint={`de ${formatNumber(goal.goalKwh, 0)} kWh del objetivo`}
            tip="Cuánta electricidad usaste desde el 1 del mes hasta ahora, medida por tu medidor."
          />
          <Kpi
            label="Gastás por día"
            value={`${formatNumber(goal.dailyRateKwh, 2)} kWh`}
            hint={deviationHint(goal)}
            tone={
              goal.dailyRateKwh !== null &&
              goal.allowedPerDayKwh !== null &&
              goal.dailyRateKwh > goal.allowedPerDayKwh
                ? 'warn'
                : 'ok'
            }
            tip="Tu consumo promedio por día, medido. Si es menor que lo que podés gastar por día, vas a cumplir el objetivo; si es mayor, te vas a pasar."
          />
          <Kpi
            label="Te quedan por día"
            value={`${formatNumber(goal.remainingPerDayKwh, 2)} kWh`}
            hint="para el resto del mes"
            tip="Cuánto podés consumir por día de acá en adelante para todavía llegar al objetivo. Si ya te pasaste, muestra cero."
          />
          <Kpi
            label="Terminarías pagando"
            value={formatCurrency(goal.projectedCostArs)}
            hint={`objetivo: ${formatCurrency(goal.goalCostArs)}`}
            tone={goal.status === 'on_track' ? 'ok' : 'warn'}
            tip="Cuánto saldría la parte de energía de tu factura si seguís consumiendo al ritmo de este mes. No incluye agua ni cloaca."
          />
        </dl>
      </section>

      <MonthChart goal={goal} monthDaily={monthDaily} />

      {recommendations.length > 0 && (
        <section className="rounded-2xl border border-border-soft bg-surface p-4 md:p-5 lg:p-6 mb-6 animate-fade-in">
          <div className="flex items-center gap-2 mb-1">
            <Lightbulb className="h-4 w-4 text-accent" />
            <h2 className="text-sm font-semibold">Qué podés hacer</h2>
            <InfoTooltip title="Qué podés hacer" text="Estas sugerencias salen de tus propias mediciones — a qué hora consumís más, cuánto gastan los equipos en espera — y no de una lista de consejos genéricos." />
          </div>
          <p className="text-xs text-muted leading-relaxed mb-4">
            Basado en lo que midió tu medidor.
          </p>

          <ul className="space-y-3">
            {recommendations.map((recommendation) => (
              <li
                key={recommendation.id}
                className={`rounded-xl border p-4 ${
                  recommendation.tone === 'good'
                    ? 'border-ok/30 bg-ok/5'
                    : recommendation.tone === 'action'
                      ? 'border-warn/30 bg-warn/5'
                      : 'border-border-soft bg-surface-raised'
                }`}
              >
                <div className="flex flex-wrap items-baseline justify-between gap-2 mb-1">
                  <h3 className="text-sm font-semibold">{recommendation.title}</h3>
                  {recommendation.impact && (
                    <span className="text-xs font-medium text-muted">
                      Ahorro: {recommendation.impact}
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted leading-relaxed">{recommendation.detail}</p>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}


function deviationHint(goal: GoalProgress): string {
  if (goal.dailyRateKwh === null || goal.allowedPerDayKwh === null) return '';

  const difference = goal.dailyRateKwh - goal.allowedPerDayKwh;
  if (Math.abs(difference) < 0.05) return 'justo en el límite diario';

  return difference > 0
    ? `${formatNumber(difference, 2)} kWh más de lo permitido`
    : `${formatNumber(Math.abs(difference), 2)} kWh menos de lo permitido`;
}

function Kpi({
  label,
  value,
  hint,
  tip,
  tone = 'default',
}: {
  label: string;
  value: string;
  hint?: string;
  tip: string;
  tone?: 'default' | 'ok' | 'warn';
}) {
  return (
    <div>
      <dt className="flex items-center gap-1.5 text-xs text-muted mb-1">
        {label}
        <InfoTooltip text={tip} title={label} />
      </dt>
      <dd>
        <ValueFade
          className={`block text-lg md:text-xl font-bold tabular-nums tracking-tight ${
            tone === 'ok' ? 'text-ok' : tone === 'warn' ? 'text-warn' : ''
          }`}
          value={value}
        />
        {hint && <span className="block text-[11px] text-muted mt-0.5">{hint}</span>}
      </dd>
    </div>
  );
}
