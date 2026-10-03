'use client';

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { CalendarClock } from 'lucide-react';
import { formatNumber } from '@/lib/format';
import { useChartColors } from '@/lib/use-chart-colors';
import { InfoTooltip } from './InfoTooltip';

export type ProfilePoint = { hour: number; samples: number; avgPowerW: number | null };

type Props = { data: { profile: ProfilePoint[] | null; profileMinDays: number } };

export function HourlyProfile({ data }: Props) {
  const colors = useChartColors();

  if (!data.profile) {
    return (
      <section className="rounded-2xl border border-border-soft bg-surface p-6">
        <div className="flex items-center gap-2 mb-2">
          <CalendarClock className="h-4 w-4 text-muted" />
          <h3 className="text-sm font-semibold">Perfil por hora del día</h3>
        </div>
        <p className="text-xs text-muted leading-relaxed">
          Necesita al menos {data.profileMinDays} días con lecturas para no ser
          el retrato de una sola jornada. Se habilita solo cuando haya base
          suficiente.
        </p>
      </section>
    );
  }

  const points = Array.from({ length: 24 }, (_, hour) => {
    const found = data.profile?.find((p) => p.hour === hour);
    return { hour, label: `${String(hour).padStart(2, '0')}h`, avgPowerW: found?.avgPowerW ?? null };
  });

  return (
    <section className="rounded-2xl border border-border-soft bg-surface p-4 md:p-5 lg:p-6">
      <div className="flex items-center gap-2 mb-4">
        <CalendarClock className="h-4 w-4 text-accent" />
        <h3 className="text-sm font-semibold">Perfil por hora del día</h3>
        <InfoTooltip title="Perfil por hora del día" text="Potencia media en cada hora, promediando todos los días medidos. Sirve para ver en qué franjas se concentra el consumo." />
      </div>

      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={points} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
          <CartesianGrid stroke={colors.grid} strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="label"
            stroke={colors.axis}
            fontSize={11}
            tickLine={false}
            axisLine={false}
            interval={2}
          />
          <YAxis stroke={colors.axis} fontSize={11} tickLine={false} axisLine={false} width={54} />
          <Tooltip
            contentStyle={{
              background: colors.tooltipBg,
              border: `1px solid ${colors.grid}`,
              borderRadius: 10,
              fontSize: 12,
            }}
            labelStyle={{ color: colors.axis }}
            formatter={(value) => [
              `${formatNumber(typeof value === 'number' ? value : null, 0)} W`,
              'Potencia media',
            ]}
          />
          <Bar dataKey="avgPowerW" fill={colors.power} radius={[3, 3, 0, 0]} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </section>
  );
}
