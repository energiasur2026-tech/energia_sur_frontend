'use client';
import {ElectricityBreakdown} from './ElectricityBreakdown';
import {TariffAndBillTools} from './TariffAndBillTools';
import { BillingCycleForm } from './BillingCycleForm';

import { useCallback, useRef, useState } from 'react';
import { Info, Plug, Receipt } from 'lucide-react';
import { formatCurrency, formatDateTime, formatNumber, NO_DATA } from '@/lib/format';
import { DEFAULT_PERIOD, PERIOD_KEYS, type PeriodKey } from '@/lib/periods';
import { apiUrl, useMeterId } from '@/lib/use-meter-id';
import { usePolling } from '@/lib/use-polling';
import type { ApiErrorPayload, ConsumptionPayload } from '@/lib/types';
import { InfoTooltip } from './InfoTooltip';
import { ValueFade } from './ValueFade';
import { SetupNotice } from './SetupNotice';

/** El consumo avanza lento: alcanza con refrescar cada minuto. */
const POLL_INTERVAL_MS = 60000;

const REASON_MESSAGE: Record<string, string> = {
  billing_date_required: 'Configurá la fecha de cierre de tu última factura para ver el consumo desde ese día.',
  insufficient_readings:
    'Todavía no hay suficientes mediciones guardadas en este período para calcular cuánto consumiste.',
  meter_counter_decreased:
    'El contador del medidor retrocedió en este período, que pasa cuando se reinicia o se reemplaza el equipo. No se calcula nada hasta tener mediciones consistentes.',
};

export function ConsumptionView() {
  const deviceId = useMeterId();
  const [period, setPeriod] = useState<PeriodKey | 'billing'>(DEFAULT_PERIOD);
  const [data, setData] = useState<ConsumptionPayload | null>(null);
  const [error, setError] = useState<ApiErrorPayload | null>(null);
  const requestId=useRef(0);

  const fetchConsumption = useCallback(async () => {
    const id=++requestId.current;
    try {
      const response = await fetch(apiUrl(`/api/meter/consumption?period=${period}`, deviceId), {
        cache: 'no-store',
      });
      const payload = await response.json();
      if(id!==requestId.current)return;

      if (!response.ok) {
        setError(payload as ApiErrorPayload);
        return;
      }

      if(payload.period!==period){setData(null);throw new Error('El backend configurado no admite este período todavía. Actualizá el backend de EnergIA Sur.');}
      setData(payload as ConsumptionPayload);
      setError(null);
    } catch (failure) {
      if(id!==requestId.current)return;
      setError({ error: failure instanceof Error ? failure.message : 'No se pudo contactar al servidor.' });
    }
  }, [period, deviceId]);

  usePolling(fetchConsumption, POLL_INTERVAL_MS);
  if (error?.missingEnv) {
    return <SetupNotice missing={error.missingEnv} />;
  }

  // Un medidor de área no es una factura aparte: el cargo fijo se paga una
  // vez por instalación, así que acá la unidad es la energía y el costo es
  // apenas una referencia de cuánto de la factura explica este lugar.
  const isArea = data?.role === 'area';

  return (
    <div className="flex-1 p-4 md:p-6 lg:p-8 max-w-6xl w-full mx-auto">
      <header className="flex flex-wrap items-start justify-between gap-4 mb-5 md:mb-7">
        <div>
          <h1 className="text-xl md:text-2xl font-bold tracking-tight">
            {isArea ? 'Cuánta luz usó este lugar' : 'Cuánto gastaste de luz'}
          </h1>
          <p className="text-sm text-muted mt-0.5">
            {isArea
              ? 'La electricidad que consumió este sector en el período'
              : 'Lo que consumiste y lo que costaría esa energía en tu factura'}
          </p>
        </div>

        <div className="flex flex-wrap gap-1 rounded-xl bg-surface-raised p-1">
          {([...PERIOD_KEYS,'billing'] as const).map((key) => (
            <button
              key={key}
              type="button"
              aria-pressed={period===key}
              onClick={() => {++requestId.current;setData(null);setError(null);setPeriod(key);}}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                period === key ? 'bg-accent text-white' : 'text-muted hover:text-foreground'
              }`}
            >
              {PERIOD_LABEL[key]}
            </button>
          ))}
        </div>
      </header>

      {period==='billing'&&<BillingCycleForm key={`billing-cycle:${deviceId ?? ''}`} onSaved={()=>void fetchConsumption()}/>}
      {period==='billing'&&data?.from&&<p className="text-xs text-muted mb-5">Período consultado: {formatDateTime(data.from)} a {formatDateTime(data.to)}.</p>}
      {period==='billing'&&data?.partialPeriod&&<p className="rounded-xl border border-warn/40 bg-warn/10 p-4 text-sm text-warn mb-5">El historial no comienza exactamente en el cierre. Se muestra el consumo observado entre las lecturas disponibles, no el total completo del ciclo.</p>}

      {error && !error.missingEnv && (
        <p className="mb-6 rounded-xl border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
          {error.error}
        </p>
      )}

      {data && !data.available && (
        <p className="mb-6 flex items-start gap-2 rounded-xl border border-warn/40 bg-warn/10 px-4 py-3 text-sm text-warn">
          <Info className="h-4 w-4 mt-0.5 shrink-0" />
          {REASON_MESSAGE[data.reason]}
        </p>
      )}

      <section
        className={`grid gap-3 md:gap-4 grid-cols-1 mb-6 md:mb-8 ${
          isArea ? '' : 'sm:grid-cols-2'
        }`}
      >
        <article className="rounded-2xl border border-border-soft bg-surface p-5 md:p-6">
          <header className="flex items-center gap-2 mb-3">
            <Plug className="h-4 w-4 text-accent" />
            <h2 className="text-sm font-semibold">
              Electricidad usada · {data?.label ?? '···'}
            </h2>
            <InfoTooltip title="Electricidad usada" text="Es cuánta electricidad consumiste en el período elegido, medida en kilowatt-hora (kWh). Un kWh es lo que gasta una plancha encendida durante una hora, o una heladera moderna en medio día. Es la unidad con la que te cobra la empresa de luz." />
          </header>
          <p className="flex items-baseline gap-1.5">
            <ValueFade
              className="text-4xl font-bold tabular-nums tracking-tight"
              value={formatNumber(data?.consumedKwh ?? null, 2)}
            />
            <span className="text-sm font-medium text-muted">kWh</span>
          </p>
          <p className="mt-2 text-xs text-muted leading-relaxed">
            Kilowatt-hora: la unidad con la que se mide y se cobra la luz.
          </p>

          {/* En un área el costo baja de categoría: es una referencia dentro
              de la tarjeta de energía, no un número principal al lado. */}
          {isArea && data?.available && data.cost && (
            <p className="mt-4 flex items-start gap-2 border-t border-border-soft pt-3 text-xs text-muted leading-relaxed">
              <Receipt className="h-3.5 w-3.5 mt-0.5 shrink-0 text-ok" />
              <span>
                Esto representa unos{' '}
                <b className="text-foreground">{formatCurrency(data.cost.total)}</b> de cargos eléctricos, antes de ajustes pendientes.
                <InfoTooltip
                  title="De dónde sale esa referencia"
                  text="Es el precio por kWh del cuadro tarifario aplicado a lo que consumió este sector. No incluye el cargo fijo: ese se paga una vez por instalación, no por área, así que sumarlo acá daría un número inventado."
                />
              </span>
            </p>
          )}
        </article>

        {!isArea && (
          <article className="rounded-2xl border border-border-soft bg-surface p-5 md:p-6">
            <header className="flex items-center gap-2 mb-3">
              <Receipt className="h-4 w-4 text-ok" />
              <h2 className="text-sm font-semibold">Referencia de cargos eléctricos</h2>
              <InfoTooltip title="Cuánto costaría" text="Referencia de cargos fijos y variables con la versión configurada para el período. No se completa el total final si faltan bases tributarias o créditos confirmados." />
            </header>
            <p>
              <ValueFade
                className="text-4xl font-bold tabular-nums tracking-tight"
                value={data?.cost ? formatCurrency(data.cost.total) : NO_DATA}
              />
            </p>
            <p className="mt-2 text-xs text-muted leading-relaxed">
              Referencia antes de impuestos y créditos no confirmados. El total final eléctrico puede diferir; agua y energía pública se excluyen.
            </p>
          </article>
        )}
      </section>

      {/* El desglose de la factura es del medidor central: es el que mide lo
          que factura la distribuidora. En un área, con el cargo fijo afuera,
          la tabla mostraría una factura que no existe. */}
      {data?.available && data.cost && <ElectricityBreakdown cost={data.cost} />}
      {data?.available && !data.cost && <p className="text-sm text-warn mb-5">{data.costUnavailableReason??'No hay un cuadro documentado para el período elegido.'}</p>}
      <TariffAndBillTools isArea={!!isArea} key={`tariff-tools:${deviceId ?? ''}`} onSaved={()=>void fetchConsumption()} />

      {data?.available && isArea && (
        <p className="text-xs text-muted leading-relaxed animate-fade-in">
          Calculado con {data.samples.toLocaleString('es-AR')} mediciones tomadas
          entre el {formatDateTime(data.firstAt)} y el {formatDateTime(data.lastAt)}.
        </p>
      )}
    </div>
  );
}

const PERIOD_LABEL: Record<PeriodKey | 'billing', string> = {
  billing: 'Desde último cierre',
  today: 'Hoy',
  week: '7 días',
  month: '30 días',
};
