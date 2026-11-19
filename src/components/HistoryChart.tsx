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
  /** Umbrales de alerta configurados en el medidor; sin ellos no se dibujan. */
  thresholds?: MeterThresholds | null;
  /** Referencia estadística: potencia promedio observada en el rango visible. */
  averagePowerW?: number | null;
  events?: EventRecord[];
  /** El usuario decide si ve las líneas de referencia o el gráfico limpio. */
  showReferences?: boolean;
};

const CONFIG = {
  power: { key: 'avgPowerW', unit: 'W', decimals: 0, label: 'Potencia medida' },
  voltage: { key: 'avgVoltage', unit: 'V', decimals: 1, label: 'Tensión medida' },
} as const;

export function HistoryChart({
  series,
  bucketSeconds,
  metric,
  thresholds = null,
  averagePowerW = null,
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
      <div className="h-full flex items-center justify-center text-sm text-muted">
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
        maxWidth: 'min(15rem, 62vw)',
        whiteSpace: 'normal',
      }}
      labelStyle={{ color: colors.axis }}
      labelFormatter={(label) => formatDateTime(typeof label === 'string' ? label : null)}
      formatter={(value) => {
        const numeric = typeof value === 'number' ? value : null;
        const formatted = `${formatNumber(numeric, config.decimals)} ${config.unit}`;
        if (metric === 'voltage' && numeric !== null && thresholds) {
          if (numeric < thresholds.lowVoltageV) {
            return [`${formatted} (bajo umbral ${thresholds.lowVoltageV} V)`, config.label];
          }
          if (numeric > thresholds.highVoltageV) {
            return [`${formatted} (sobre umbral ${thresholds.highVoltageV} V)`, config.label];
          }
        }
        return [formatted, config.label];
      }}
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

  /** Líneas de referencia: umbrales de alerta de tensión (configurados) o referencia estadística de potencia. */
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
                value: `Umbral alerta bajo ${thresholds.lowVoltageV} V`,
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
                value: `Umbral alerta alto ${thresholds.highVoltageV} V`,
                position: 'insideTopLeft',
                fill: colors.danger,
                fontSize: 10,
              }}
            />,
          ]
        : metric === 'power' && averagePowerW !== null
          ? [
              <ReferenceLine
                key="average"
                y={averagePowerW}
                stroke={colors.reference}
                strokeDasharray="2 4"
                strokeWidth={1.5}
                label={{
                  value: `Prom. rango ${Math.round(averagePowerW)} W`,
                  position: 'insideTopLeft',
                  fill: colors.reference,
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
      <ResponsiveContainer width="100%" height="100%">
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
    <ResponsiveContainer width="100%" height="100%">
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
