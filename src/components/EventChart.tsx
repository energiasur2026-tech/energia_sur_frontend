'use client';

import { useCallback, useState } from 'react';
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { formatAxisLabel, formatDateTime, formatNumber } from '@/lib/format';
import type { EventRecord } from '@/lib/event-types';
import type { MeterThresholds } from '@/lib/threshold-types';
import type { SeriesPoint } from '@/lib/types';
import { useChartColors } from '@/lib/use-chart-colors';
import { usePolling } from '@/lib/use-polling';

/**
 * Qué magnitud mirar según el tipo de anomalía: para una caída de tensión, la
 * tensión; para una sobrecorriente, la corriente. Mostrar siempre lo mismo
 * obligaría al usuario a saber qué buscar.
 */
const METRIC_BY_TYPE = {
  LOW_VOLTAGE: { key: 'avgVoltage', label: 'Tensión', unit: 'V', decimals: 1 },
  HIGH_VOLTAGE: { key: 'avgVoltage', label: 'Tensión', unit: 'V', decimals: 1 },
  OVERCURRENT: { key: 'avgCurrent', label: 'Corriente', unit: 'A', decimals: 3 },
  DATA_GAP: { key: 'avgPowerW', label: 'Potencia', unit: 'W', decimals: 0 },
} as const;

type Payload = { from: string; to: string; bucketSeconds: number; series: SeriesPoint[] };

export function EventChart({
  event,
  thresholds,
}: {
  event: EventRecord;
  thresholds: MeterThresholds | null;
}) {
  const [data, setData] = useState<Payload | null>(null);
  const [failed, setFailed] = useState(false);
  const colors = useChartColors();

  const fetchSeries = useCallback(async () => {
    try {
      const params = new URLSearchParams({
        from: event.startedAt,
        to: event.endedAt ?? new Date().toISOString(),
      });
      const response = await fetch(`/api/meter/event-series?${params}`, { cache: 'no-store' });

      if (!response.ok) {
        setFailed(true);
        return;
      }

      setData((await response.json()) as Payload);
      setFailed(false);
    } catch {
      setFailed(true);
    }
  }, [event.startedAt, event.endedAt]);

  // Se pide una vez al abrir; el intervalo largo solo cubre eventos en curso.
  usePolling(fetchSeries, 120000);

  if (failed) {
    return (
      <p className="mt-4 rounded-xl border border-border-soft bg-surface-raised px-4 py-3 text-xs text-muted">
        No se pudo cargar el gráfico de este evento.
      </p>
    );
  }

  if (!data) {
    return <p className="mt-4 text-xs text-muted">Cargando gráfico…</p>;
  }

  const metric = METRIC_BY_TYPE[event.type];

  const points = data.series.map((point) => ({
    bucket: point.bucket,
    value:
      metric.key === 'avgVoltage'
        ? point.avgVoltage
        : metric.key === 'avgCurrent'
          ? point.avgCurrent
          : point.avgPowerW,
  }));

  if (points.length === 0) {
    return (
      <p className="mt-4 rounded-xl border border-border-soft bg-surface-raised px-4 py-3 text-xs text-muted">
        {event.type === 'DATA_GAP'
          ? 'Este evento es justamente la ausencia de lecturas, así que no hay curva para mostrar en su ventana.'
          : 'No hay lecturas guardadas en la ventana de este evento.'}
      </p>
    );
  }

  const startMs = new Date(event.startedAt).getTime();
  const endMs = new Date(event.endedAt ?? data.to).getTime();

  // Cubetas que caen dentro del evento: se sombrean para ubicar el episodio
  // dentro de su contexto.
  const inside = points.filter((point) => {
    const ms = new Date(point.bucket).getTime();
    return ms >= startMs && ms <= endMs;
  });

  const threshold =
    event.type === 'LOW_VOLTAGE'
      ? thresholds?.lowVoltageV
      : event.type === 'HIGH_VOLTAGE'
        ? thresholds?.highVoltageV
        : event.type === 'OVERCURRENT'
          ? thresholds?.overcurrentA
          : null;

  return (
    <div className="mt-4 rounded-xl border border-border-soft bg-surface-raised p-3">
      <p className="mb-2 text-[11px] text-muted">
        {metric.label} alrededor del evento. La franja sombreada es el episodio;
        a los costados se ve cómo estaba antes y después.
      </p>

      <ResponsiveContainer width="100%" height={180}>
        <LineChart data={points} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
          <CartesianGrid stroke={colors.grid} strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="bucket"
            tickFormatter={(iso: string) => formatAxisLabel(iso, data.bucketSeconds)}
            minTickGap={44}
            stroke={colors.axis}
            fontSize={10}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            width={48}
            domain={['dataMin - 2', 'dataMax + 2']}
            stroke={colors.axis}
            fontSize={10}
            tickLine={false}
            axisLine={false}
          />

          {inside.length > 0 && (
            <ReferenceArea
              x1={inside[0].bucket}
              x2={inside[inside.length - 1].bucket}
              fill={event.severity === 'CRITICAL' ? colors.danger : colors.warn}
              fillOpacity={0.18}
              stroke="none"
            />
          )}

          {typeof threshold === 'number' && (
            <ReferenceLine
              y={threshold}
              stroke={colors.danger}
              strokeDasharray="4 4"
              strokeWidth={1.5}
              label={{
                value: `Límite ${threshold} ${metric.unit}`,
                position: 'insideTopRight',
                fill: colors.danger,
                fontSize: 10,
              }}
            />
          )}

          <Tooltip
            contentStyle={{
              background: colors.tooltipBg,
              border: `1px solid ${colors.grid}`,
              borderRadius: 10,
              fontSize: 12,
            }}
            labelStyle={{ color: colors.axis }}
            labelFormatter={(label) => formatDateTime(typeof label === 'string' ? label : null)}
            formatter={(value) => [
              `${formatNumber(typeof value === 'number' ? value : null, metric.decimals)} ${metric.unit}`,
              metric.label,
            ]}
          />
          <Line
            type="monotone"
            dataKey="value"
            stroke={colors.voltage}
            strokeWidth={2}
            connectNulls
            dot={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
