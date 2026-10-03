'use client';

import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { CalendarDays } from 'lucide-react';
import { formatNumber } from '@/lib/format';
import type { GoalProgress } from '@/lib/goal';
import { useChartColors } from '@/lib/use-chart-colors';
import { InfoTooltip } from './InfoTooltip';

export type MonthDailyPoint = { day: string; consumedKwh: number | null };

/**
 * Consumo acumulado real contra el ritmo ideal. La lectura buscada es simple:
 * si la línea llena queda por debajo de la punteada, se llega al objetivo.
 */
export function MonthChart({ goal, monthDaily }: { goal: GoalProgress; monthDaily: MonthDailyPoint[] }) {
  const colors = useChartColors();

  if (monthDaily.length < 2 || goal.allowedPerDayKwh === null) return null;

  const data = monthDaily.map((point, index) => ({
    label: point.day.slice(8),
    real: point.consumedKwh,
    ideal: Number((goal.allowedPerDayKwh! * (index + 1)).toFixed(2)),
  }));

  return (
    <section className="rounded-2xl border border-border-soft bg-surface p-4 md:p-5 lg:p-6 mb-6 animate-fade-in">
      <div className="flex items-center gap-2 mb-1">
        <CalendarDays className="h-4 w-4 text-accent" />
        <h2 className="text-sm font-semibold">Tu consumo contra tu objetivo</h2>
        <InfoTooltip title="Tu consumo contra tu objetivo" text="La línea llena es lo que consumiste acumulado, día a día. La punteada es el ritmo que deberías llevar para cumplir el objetivo. Mientras la llena esté por debajo, vas bien." />
      </div>
      <p className="text-xs text-muted leading-relaxed mb-4">
        Días del mes en el eje de abajo, kWh acumulados en el de la izquierda.
      </p>

      <ResponsiveContainer width="100%" height={240}>
        <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
          <defs>
            <linearGradient id="goalFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={colors.power} stopOpacity={0.3} />
              <stop offset="100%" stopColor={colors.power} stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke={colors.grid} strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="label" stroke={colors.axis} fontSize={11} tickLine={false} axisLine={false} />
          <YAxis stroke={colors.axis} fontSize={11} tickLine={false} axisLine={false} width={54} />
          <Tooltip
            contentStyle={{
              background: colors.tooltipBg,
              border: `1px solid ${colors.grid}`,
              borderRadius: 10,
              fontSize: 12,
            }}
            labelStyle={{ color: colors.axis }}
            labelFormatter={(label) => `Día ${label}`}
            formatter={(value, name) => [
              `${formatNumber(typeof value === 'number' ? value : null, 2)} kWh`,
              name === 'real' ? 'Consumiste' : 'Deberías llevar',
            ]}
          />
          <Legend
            formatter={(value) => (value === 'real' ? 'Tu consumo' : 'Ritmo del objetivo')}
            wrapperStyle={{ fontSize: 11, color: colors.axis }}
          />
          <Area
            type="monotone"
            dataKey="real"
            stroke={colors.power}
            strokeWidth={2}
            fill="url(#goalFill)"
            connectNulls
            dot={false}
            isAnimationActive={false}
          />
          <Line
            type="monotone"
            dataKey="ideal"
            stroke={colors.axis}
            strokeWidth={2}
            strokeDasharray="5 4"
            dot={false}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </section>
  );
}
