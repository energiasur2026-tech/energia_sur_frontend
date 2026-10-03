'use client';

import {
  Area,
  AreaChart,
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
import type { AxisDomain } from 'recharts/types/util/types';
import { bandAt, toEventBands } from '@/lib/chart-markers';
import type { EventRecord } from '@/lib/event-types';
import { formatAxisLabel, formatDateTime, formatNumber } from '@/lib/format';
import type { MeterThresholds } from '@/lib/threshold-types';
import type { SeriesPoint } from '@/lib/types';
import { useChartColors } from '@/lib/use-chart-colors';

type Props = {
  series: SeriesPoint[];
  bucketSeconds: number;
  metric: 'power' | 'voltage';
  /** Umbrales de tensión; sin ellos no se dibujan las líneas de referencia. */
  thresholds?: MeterThresholds | null;
  /** Potencia media que corresponde al objetivo mensual, si hay uno fijado. */
  goalPowerW?: number | null;
  events?: EventRecord[];
  /** El usuario decide si ve las líneas de referencia o el gráfico limpio. */
  showReferences?: boolean;
};

const CONFIG = {
  power: { key: 'avgPowerW', unit: 'W', decimals: 0, label: 'Potencia' },
  voltage: { key: 'avgVoltage', unit: 'V', decimals: 1, label: 'Tensión' },
} as const;

export function HistoryChart({
  series,
  bucketSeconds,
  metric,
  thresholds = null,
  goalPowerW = null,
  events = [],
  showReferences = true,
}: Props) {
  const config = CONFIG[metric];
  const colors = useChartColors();
  // El color de la serie sale del tema activo, no de una constante: así el
  // gráfico sigue al modo claro/oscuro como el resto de la interfaz.
  const seriesColor = metric === 'power' ? colors.power : colors.voltage;

  if (series.length === 0) {
    return (
      <div className="h-64 flex items-center justify-center text-sm text-muted">
        Sin lecturas registradas en este período.
      </div>
    );
  }

  const data = series.map((point) => ({
    bucket: point.bucket,
    value: metric === 'power' ? point.avgPowerW : point.avgVoltage,
  }));

  const windowStartMs = new Date(series[0].bucket).getTime();
  const windowEndMs = new Date(series[series.length - 1].bucket).getTime();
  const bands = showReferences ? toEventBands(events, windowStartMs, windowEndMs) : [];

  const axis = {
    stroke: colors.axis,
    fontSize: 11,
    tickLine: false,
    axisLine: false,
  };

  const tooltip = (
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
        `${formatNumber(typeof value === 'number' ? value : null, config.decimals)} ${config.unit}`,
        config.label,
      ]}
    />
  );

  /**
   * Bandas de anomalía: se pintan por debajo de la serie para señalar cuándo
   * pasó algo sin tapar el dato. Cada cubeta dentro de un evento se marca
   * individualmente, que es más simple y robusto que calcular los extremos
   * exactos de cada banda contra el eje categórico de Recharts.
   */
  const anomalyAreas = bands.length
    ? data
        .map((point, index) => {
          const band = bandAt(bands, new Date(point.bucket).getTime());
          if (!band) return null;
          const next = data[index + 1];
          return (
            <ReferenceArea
              key={`${band.id}-${point.bucket}`}
              x1={point.bucket}
              x2={next ? next.bucket : point.bucket}
              fill={band.severity === 'CRITICAL' ? colors.danger : colors.warn}
              fillOpacity={0.16}
              stroke="none"
              ifOverflow="extendDomain"
            />
          );
        })
        .filter(Boolean)
    : null;

  /** Líneas de referencia: umbrales de tensión, u objetivo en potencia. */
  const referenceLines =
    !showReferences
      ? null
      : metric === 'voltage' && thresholds
        ? [
            <ReferenceLine
              key="low"
              y={thresholds.lowVoltageV}
              stroke={colors.danger}
              strokeDasharray="4 4"
              strokeWidth={1.5}
              label={{
                value: `Mínimo ${thresholds.lowVoltageV} V`,
                position: 'insideBottomLeft',
                fill: colors.danger,
                fontSize: 10,
              }}
            />,
            <ReferenceLine
              key="high"
              y={thresholds.highVoltageV}
              stroke={colors.danger}
              strokeDasharray="4 4"
              strokeWidth={1.5}
              label={{
                value: `Máximo ${thresholds.highVoltageV} V`,
                position: 'insideTopLeft',
                fill: colors.danger,
                fontSize: 10,
              }}
            />,
          ]
        : metric === 'power' && goalPowerW
          ? [
              <ReferenceLine
                key="goal"
                y={goalPowerW}
                stroke={colors.ok}
                strokeDasharray="6 4"
                strokeWidth={1.5}
                label={{
                  value: `Objetivo ${Math.round(goalPowerW)} W`,
                  position: 'insideTopLeft',
                  fill: colors.ok,
                  fontSize: 10,
                }}
              />,
            ]
          : null;

  const commonAxes = (
    <>
      <CartesianGrid stroke={colors.grid} strokeDasharray="3 3" vertical={false} />
      <XAxis
        dataKey="bucket"
        tickFormatter={(iso: string) => formatAxisLabel(iso, bucketSeconds)}
        minTickGap={40}
        {...axis}
      />
    </>
  );

  // Potencia como area (arranca en cero y el volumen comunica consumo);
  // tension como linea, porque oscila alrededor de un nominal lejos de cero.
  // Sin animacion: el grafico se redibuja en cada refresco del historico y
  // reanimarlo cada vez distrae, ademas de dejar trazos a medio dibujar al
  // alternar de metrica.
  if (metric === 'power') {
    return (
      <ResponsiveContainer width="100%" height={256}>
        <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
          <defs>
            <linearGradient id="powerFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={seriesColor} stopOpacity={0.35} />
              <stop offset="100%" stopColor={seriesColor} stopOpacity={0.02} />
            </linearGradient>
          </defs>
          {commonAxes}
          <YAxis width={54} {...axis} />
          {anomalyAreas}
          {referenceLines}
          {tooltip}
          <Area
            type="monotone"
            dataKey="value"
            stroke={seriesColor}
            strokeWidth={2}
            fill="url(#powerFill)"
            connectNulls
            dot={false}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={256}>
      <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
        {commonAxes}
        <YAxis width={54} domain={voltageDomain(thresholds, showReferences)} {...axis} />
        {anomalyAreas}
        {referenceLines}
        {tooltip}
        <Line
          type="monotone"
          dataKey="value"
          stroke={seriesColor}
          strokeWidth={2}
          connectNulls
          dot={false}
          isAnimationActive={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

/**
 * Con las líneas de umbral visibles el eje tiene que abarcarlas, o quedarían
 * fuera del área dibujada. Sin ellas, se ajusta a los datos.
 */
function voltageDomain(
  thresholds: MeterThresholds | null,
  showReferences: boolean
): AxisDomain {
  if (!showReferences || !thresholds) return ['dataMin - 5', 'dataMax + 5'];

  return ([dataMin, dataMax]: readonly [number, number]) =>
    [
      Math.min(dataMin - 3, thresholds.lowVoltageV - 3),
      Math.max(dataMax + 3, thresholds.highVoltageV + 3),
    ] as [number, number];
}
