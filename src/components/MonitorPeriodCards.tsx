import Link from 'next/link';
import { ArrowRight, CheckCircle2, Receipt, TriangleAlert } from 'lucide-react';
import { formatCurrencyCompact, formatDateShort, formatDateTime, formatNumber } from '@/lib/format';
import { meterHref } from '@/lib/use-meter-id';
import { InfoTooltip } from './InfoTooltip';

export type SpendMissingReason =
  | 'readings'
  | 'tariff'
  | 'counter_reset'
  | 'truncated'
  | 'tariff_disabled'
  | null;

export type MonitorPeriod = {
  spend: {
    provisional?: boolean;
    costBreakdown?: { variableCharge: number; fixedCharge: number; lines: { kind: string; amount: number }[]; totalElectricity: number | null } | null;
    closedOn?: string | null;
    periodFrom?: string | null;
    periodTo?: string;
    cycleEnd?: string | null;
    currentCycle?: boolean;
    goalMode?: 'ars' | 'kwh' | null;
    spentArs: number | null;
    goalArs: number | null;
    goalKwh: number | null;
    projectedArs: number | null;
    measuredKwh: number | null;
    measuredFragment?: { from: string; to: string } | null;
    partial: boolean;
    tariffValid?: boolean;
    missing?: SpendMissingReason;
    reason: string | null;
    projectionReason: string | null;
  } | null;
  anomalies: {
    from: string | null;
    to: string;
    provisional?: boolean;
    detectionCurrent?: boolean;
    count: number | null;
    active: number;
    totalActive?: number;
    resolved?: number | null;
    historicalCount?: number;
  } | null;
};

export function MonitorPeriodCards({
  data,
  failed,
  deviceId,
}: {
  data: MonitorPeriod | null;
  failed: boolean;
  deviceId: string | null;
}) {
  const spend = data?.spend ?? null;
  const anomalies = data?.anomalies ?? null;
  const percent =
    spend?.spentArs != null && spend.goalArs != null && spend.goalArs > 0
      ? (100 * spend.spentArs) / spend.goalArs
      : null;
  const balance = spend?.spentArs != null && spend.goalArs != null ? spend.goalArs - spend.spentArs : null;
  const breakdown = spend?.costBreakdown;
  const componentAmount = (kind: string) => {
    const lines = breakdown?.lines.filter(line => line.kind === kind) ?? [];
    return lines.length || breakdown?.totalElectricity != null
      ? formatCurrencyCompact(lines.reduce((total, line) => total + line.amount, 0))
      : '—';
  };
  const clampedPercent = percent !== null ? Math.min(100, Math.max(0, percent)) : 0;
  const progressTone =
    percent === null
      ? 'bg-accent'
      : percent >= 100
        ? 'bg-danger'
        : percent >= 85
          ? 'bg-warn'
          : 'bg-gradient-to-r from-brand-teal to-brand-cyan';
  const percentTextTone =
    percent === null
      ? 'text-muted'
      : percent >= 100
        ? 'text-danger font-semibold'
        : percent >= 85
          ? 'text-warn font-semibold'
          : 'text-foreground font-medium';

  const fallback = failed || data ? 'No pudimos consultar este indicador.' : 'Consultando el período…';
  const panel =
    'flex min-w-0 flex-col rounded-2xl border border-border-soft bg-surface px-4 py-3';
  const primaryLink =
    'inline-flex items-center gap-1 text-xs font-semibold text-accent hover:underline focus-visible:outline-2 focus-visible:outline-accent';
  const secondaryLink =
    'inline-flex items-center gap-1 text-xs font-medium text-muted hover:text-foreground underline focus-visible:outline-2 focus-visible:outline-accent';

  const periodRangeLabel =
    spend?.periodFrom && spend?.periodTo
      ? `Período ${formatDateShort(spend.periodFrom)} al ${formatDateShort(spend.periodTo)}`
      : null;

  const anomaliesRangeLabel =
    anomalies?.from && anomalies?.to
      ? `Período ${formatDateShort(anomalies.from)} al ${formatDateShort(anomalies.to)}`
      : null;

  return (
    <div className="monitor-section grid min-w-0 items-stretch gap-3 md:grid-cols-2">
      {/* --- 1. Gasto del período --- */}
      <section className={panel} aria-label="Gasto del período">
        <div>
          <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <Receipt className="h-4 w-4 shrink-0 text-accent" aria-hidden="true" />
              Gasto del período
              <InfoTooltip
                title="Gasto del período"
                text="Calcula el consumo real del período por diferencia de lecturas dentro del rango indicado y aplica tu tarifa configurada. Diferencia los kWh medidos del costo eléctrico estimado en ARS."
              />
            </h2>
          </div>

          {spend ? (
            <div className="mt-2 space-y-1.5">
              {spend.spentArs != null ? (
                <>
                  <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
                  <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                    <p className="text-3xl leading-none font-bold tracking-tight tabular-nums text-foreground">
                      {formatCurrencyCompact(spend.spentArs)}
                    </p>
                    <span className="text-xs text-muted">
                      ARS estimados{spend.partial ? ' · datos parciales' : ''}
                    </span>
                  </div>

                  {spend.goalArs != null ? (
                    <p className="text-sm text-muted">
                      de un objetivo de{' '}
                      <span className="font-semibold text-foreground tabular-nums">
                        {formatCurrencyCompact(spend.goalArs)}
                      </span>
                      {spend.goalMode === 'kwh' && spend.goalKwh != null && (
                        <span className="text-xs text-muted">
                          {' '}
                          ({formatNumber(spend.goalKwh, 0)} kWh)
                        </span>
                      )}
                    </p>
                  ) : spend.goalKwh != null ? (
                    <p className="text-xs text-muted">
                      Objetivo configurado: {formatNumber(spend.goalKwh, 1)} kWh (sin tarifa vigente
                      para expresarlo en pesos).
                    </p>
                  ) : (
                    <p className="text-xs text-muted">Sin objetivo económico configurado.</p>
                  )}

                  </div>
                  {percent !== null && (
                    <div className="pt-1">
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className={percentTextTone}>
                          {formatNumber(percent, 1)}% utilizado
                        </span>
                        {percent > 100 && (
                          <span className="text-[11px] font-semibold text-danger">
                            Objetivo superado
                          </span>
                        )}
                      </div>
                      <div
                        role="progressbar"
                        aria-label="Porcentaje del objetivo económico utilizado"
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-valuenow={Math.round(clampedPercent)}
                        className="h-1.5 w-full rounded-full bg-surface-raised"
                      >
                        <div
                          className={`h-full rounded-full transition-[width] duration-300 ${progressTone}`}
                          style={{ width: `${clampedPercent}%` }}
                        />
                      </div>
                    </div>
                  )}

                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted tabular-nums">
                    {spend.measuredKwh != null && (
                      <p>{spend.measuredFragment ? 'Consumo medido en el tramo' : 'Consumo medido del período'}: {formatNumber(spend.measuredKwh, 2)} kWh</p>
                    )}
                    {balance !== null && (
                      <p>{balance < 0 ? 'Por encima del objetivo' : 'Saldo hasta el objetivo'}{spend.partial || spend.provisional ? ' (provisional)' : ''}: {formatCurrencyCompact(Math.abs(balance))}</p>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
                    <p>{spend.measuredFragment
                      ? `Lecturas del ${formatDateShort(spend.measuredFragment.from)} al ${formatDateShort(spend.measuredFragment.to)}`
                      : spend.partial ? 'Estimación con datos parciales' : 'Lecturas disponibles del período'}</p>
                    {spend.projectedArs != null && (
                      <p>{spend.provisional ? 'Proyección a fin de mes:' : 'Proyección al cierre:'} <strong className="text-foreground">{formatCurrencyCompact(spend.projectedArs)}</strong></p>
                    )}
                  </div>
                </>
              ) : (
                <div className="space-y-1.5">
                  <p className="text-sm font-medium text-foreground">Cálculo en pesos no disponible</p>
                  <p className="text-xs text-muted">
                    {spend.reason ?? 'Faltan datos para calcular el gasto del período.'}
                  </p>
                  {spend.measuredKwh != null && (
                    <p className="text-xs text-foreground tabular-nums">
                      Consumo medido del período:{' '}
                      <strong>{formatNumber(spend.measuredKwh, 2)} kWh</strong>
                    </p>
                  )}
                  {spend.goalArs != null ? (
                    <p className="text-xs text-muted tabular-nums">
                      Objetivo configurado: {formatCurrencyCompact(spend.goalArs)}
                    </p>
                  ) : spend.goalKwh != null ? (
                    <p className="text-xs text-muted tabular-nums">
                      Objetivo configurado: {formatNumber(spend.goalKwh, 1)} kWh
                    </p>
                  ) : (
                    <p className="text-xs text-muted">Sin objetivo económico configurado.</p>
                  )}
                </div>
              )}
            </div>
          ) : (
            <p className="mt-3 text-sm text-muted">{fallback}</p>
          )}
        </div>

        <div className="mt-auto flex flex-wrap items-center gap-x-4 gap-y-1 pt-2">
          {spend && (
            <details className="w-full text-xs text-muted">
              <summary className="w-fit cursor-pointer rounded-sm py-1 font-semibold text-foreground focus-visible:outline-2 focus-visible:outline-accent">Ver detalles del cálculo</summary>
              <div className="mt-1 space-y-1.5 rounded-xl bg-surface-raised p-3">
                {spend.provisional && <p>Mes calendario actual — provisional</p>}
                {periodRangeLabel && <p>{periodRangeLabel}</p>}
                {spend.periodFrom && <p>Desde {formatDateTime(spend.periodFrom)} hasta {formatDateTime(spend.periodTo)}</p>}
                {spend.cycleEnd && <p>Fin estimado del período: {formatDateTime(spend.cycleEnd)}</p>}
                {spend.measuredFragment && <p>Por reinicios del contador, se usó el tramo continuo del {formatDateTime(spend.measuredFragment.from)} al {formatDateTime(spend.measuredFragment.to)}.</p>}
                {spend.partial && <p>El importe corresponde a los cargos y lecturas disponibles.</p>}
                {spend.projectionReason && <p>{spend.projectionReason}</p>}
                {breakdown && (
                  <dl className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-1">
                    <dt>Energía</dt><dd>{formatCurrencyCompact(breakdown.variableCharge)}</dd>
                    <dt>Cargos fijos</dt><dd>{formatCurrencyCompact(breakdown.fixedCharge)}</dd>
                    <dt>Impuestos verificados</dt><dd>{componentAmount('tax')}</dd>
                    <dt>Bonificaciones verificadas</dt><dd>{componentAmount('credit')}</dd>
                    <dt>Otros cargos verificados</dt><dd>{componentAmount('surcharge')}</dd>
                    <dt>{breakdown.totalElectricity === null ? 'Subtotal de cargos conocidos' : 'Total eléctrico estimado'}</dt><dd>{formatCurrencyCompact(spend.spentArs)}</dd>
                  </dl>
                )}
              </div>
            </details>
          )}
          <Link className={primaryLink} href={meterHref('/proyeccion?period=billing', deviceId)}>
            Ver mi objetivo
            <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
          </Link>
          {(spend?.provisional || spend?.missing === 'tariff') && (
            <Link className={secondaryLink} href={meterHref('/ajustes/servicio', deviceId)}>
              Configurar en Ajustes
            </Link>
          )}
          {spend && ['readings', 'counter_reset', 'truncated'].includes(spend.missing ?? '') && (
            <Link className={secondaryLink} href={meterHref('/medidores', deviceId)}>Revisar medidor</Link>
          )}
        </div>
      </section>

      {/* --- 2. Anomalías del período --- */}
      <section className={panel} aria-label="Anomalías del período">
        <div>
          <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <TriangleAlert className="h-4 w-4 shrink-0 text-accent" aria-hidden="true" />
              Anomalías del período
              <InfoTooltip
                title="Anomalías del período"
                text="Cuenta episodios iniciados en el rango: tensión fuera de umbral, sobrecorriente e interrupciones de lecturas. Los episodios anteriores que siguen abiertos se muestran entre los activos."
              />
            </h2>
            {anomaliesRangeLabel && (
              <span className="text-[11px] text-muted tabular-nums">{anomaliesRangeLabel}</span>
            )}
          </div>

          {anomalies?.provisional && <p className="mt-1 text-xs text-muted">Mes calendario actual — provisional</p>}
          {anomalies ? (
            <div className="mt-2 space-y-2">
              {anomalies.count != null ? (
                <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                  <p className="text-3xl leading-none font-bold tracking-tight tabular-nums text-foreground">
                    {anomalies.count}
                  </p>
                  <span className="text-xs text-muted">
                    {anomalies.count === 1
                      ? 'episodio detectado en el período'
                      : 'episodios detectados en el período'}
                  </span>
                </div>
              ) : (
                <div className="space-y-1">
                  <p className="text-sm font-medium text-foreground">Período sin configurar</p>
                  <p className="text-xs text-muted">
                    Guardá la fecha de cierre de factura en Ajustes para contabilizar los episodios
                    de tu período.
                  </p>
                </div>
              )}

              <div className="flex flex-wrap items-center gap-2">
                {anomalies.active > 0 ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-danger/40 bg-danger/10 px-2.5 py-1 text-xs font-semibold text-danger">
                    <span className="h-1.5 w-1.5 rounded-full bg-danger animate-pulse" />
                    {anomalies.active === 1
                      ? '1 anomalía activa'
                      : `${anomalies.active} anomalías activas`}
                  </span>
                ) : anomalies.detectionCurrent ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-ok/40 bg-ok/10 px-2.5 py-1 text-xs font-semibold text-ok">
                    <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                    0 anomalías activas registradas
                  </span>
                ) : (
                  <span className="text-xs font-medium text-muted">0 abiertas registradas · estado sin confirmar por falta de datos recientes</span>
                )}
              </div>

              {anomalies.resolved != null && (
                <p className="text-xs text-muted">
                  {anomalies.resolved === 1
                    ? '1 episodio resuelto en este período.'
                    : `${anomalies.resolved} episodios resueltos en este período.`}
                </p>
              )}
            </div>
          ) : (
            <p className="mt-3 text-sm text-muted">{fallback}</p>
          )}
        </div>

        <div className="mt-auto flex flex-wrap items-center gap-3 pt-2">
          <Link className={primaryLink} href={meterHref('/eventos', deviceId)}>
            Ver historial
            <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
          </Link>
          {anomalies && (anomalies.provisional || anomalies.count === null) && (
            <Link className={secondaryLink} href={meterHref('/ajustes/servicio', deviceId)}>
              Configurar período
            </Link>
          )}
        </div>
      </section>
    </div>
  );
}
