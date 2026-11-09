'use client';
<<<<<<< HEAD
import { useCallback,useRef,useState } from 'react';
import { isMonthlyProjection,PROJECTION_CONTRACT_ERROR } from '@/lib/projection-contract';
import { meterFetch } from '@/lib/meter-fetch';
import { usePolling } from '@/lib/use-polling';
import { formatCurrency,formatNumber } from '@/lib/format';
import { GoalSetter } from './GoalSetter';
import { MonthChart,HourlyProfile } from './LazyCharts';
import type { MonthlyProjection } from '@/lib/monthly-projection';
export function ForecastView({preview}:{preview?:MonthlyProjection}={}){
 const [month,setMonth]=useState(''),[data,setData]=useState<MonthlyProjection|null>(preview??null),[error,setError]=useState('');
 const sequence=useRef(0);
 const refresh=useCallback(async()=>{if(preview)return;const id=++sequence.current;try{const r=await meterFetch('/api/meter/forecast'+(month?'?month='+month:''));const p=await r.json();if(id!==sequence.current)return;if(!r.ok)throw new Error(p.error??'No se pudo obtener la proyección.');if(!isMonthlyProjection(p)){setData(null);throw new Error(PROJECTION_CONTRACT_ERROR);}setData(p);setError('');}catch(e){if(id===sequence.current)setError(e instanceof Error?e.message:'Servicio no disponible.');}},[month,preview]);
 usePolling(refresh,300000);
 const g=data?.goal;
 return <div className="flex-1 p-4 md:p-6 lg:p-8 max-w-6xl w-full mx-auto"><header className="flex flex-wrap items-end justify-between gap-4 mb-6"><div><h1 className="text-xl md:text-2xl font-bold tracking-tight">Proyección</h1><p className="text-sm text-muted mt-1">Tu consumo, tu objetivo y una estimación del cierre del mes.</p></div><label className="text-xs text-muted">Mes analizado<input type="month" disabled={!!preview} aria-label="Mes analizado" value={month||data?.month||''} onChange={e=>{++sequence.current;setData(null);setMonth(e.target.value);}} className="block mt-1 rounded-xl border border-border-soft bg-surface p-2 text-foreground"/></label></header>
 {error&&<p role="alert" className="rounded-xl border border-danger/40 p-4 text-sm text-danger mb-5">{error}</p>}
 {!data&&<p className="text-sm text-muted py-12">{error?'No se pudo cargar este período.':'Consultando las mediciones del mes…'}</p>}
 {data&&g&&<><p className="text-xs text-muted mb-4">{data.meterName} · Mes calendario · hora de Argentina</p>
 <GoalSetter key={JSON.stringify(data.choice)} preview={!!preview} goal={g} choice={data.choice} tariff={data.tariff} onSaved={refresh}/>
 <section className="rounded-2xl border border-border-soft bg-surface p-4 md:p-6 mb-6"><div className="flex flex-wrap gap-2 items-center justify-between mb-5"><h2 className="font-semibold text-sm">Cómo podría terminar {data.month}</h2><span className="text-xs rounded-full bg-accent-soft px-3 py-1 text-accent">Estimación por ritmo observado</span></div>
 <dl className="grid grid-cols-2 lg:grid-cols-4 gap-x-5 gap-y-6">
 <Kpi title={data.missingStart?'Acumulado observado · parcial':'Consumo acumulado observado'} value={energy(data.measuredKwh)} hint={data.missingStart?'Desde la primera lectura disponible':'Hasta la última lectura'}/>
 <Kpi title="Objetivo mensual" value={energy(g.goalKwh)} hint={data.choice?.mode==='ars'?'Equivalente de '+formatCurrency(data.choice.value):'Energía definida por vos'}/>
 <Kpi title="Estimado al cierre" value={energy(g.projectedMonthKwh)} hint="Mes calendario completo"/>
 <Kpi title="Diferencia frente al objetivo" value={g.deviationKwh===null?'—':(g.deviationKwh>0?'+':'')+energy(g.deviationKwh)} hint={g.deviationKwh===null?'Faltan datos u objetivo':g.deviationKwh>0?'Por encima del objetivo':'Por debajo del objetivo'}/>
 <Kpi title="Promedio diario observado" value={energy(g.dailyRateKwh)} hint="Por 24 h de tiempo medido"/>
 <Kpi title={data.exceededKwh&&data.exceededKwh>0?'Objetivo ya superado':'Margen diario restante'} value={data.exceededKwh&&data.exceededKwh>0?energy(data.exceededKwh)+' de exceso':energy(g.remainingPerDayKwh)} hint={data.exceededKwh&&data.exceededKwh>0?'No es consumo permitido':data.missingStart?'Usa el inicio del mes estimado':'Tiempo restante, incluido el día parcial'}/>
 <Kpi title="Costo estimado al cierre" value={data.tariff.valid?formatCurrency(g.projectedCostArs):'No disponible'} hint="Estimación parcial de energía"/>
 <Kpi title="Cobertura de muestreo" value={formatNumber(data.quality.coverage*100,0)+' %'} hint={data.quality.completeDays+' días completos · '+data.quality.gaps+' huecos'}/>
 </dl>
 {data.warnings.length>0&&<ul className="mt-5 rounded-xl bg-surface-raised p-4 space-y-2 text-xs text-muted">{data.warnings.map(note=><li key={note}>{note}</li>)}</ul>}
 <details className="mt-5 text-xs text-muted"><summary className="cursor-pointer">Cómo se calcula y qué datos se usan</summary><p className="mt-3 leading-relaxed">{data.method} Se respeta la fracción del día actual. No es un modelo de machine learning ni una garantía de consumo o facturación.</p><p className="mt-2">Desde {projectionDate(data.measuredFrom)} hasta {projectionDate(data.measuredTo)} · {data.quality.samples} lecturas. La cobertura describe muestreo; no equivale a confianza predictiva. Los contadores permiten medir energía entre extremos aunque haya huecos, pero no su distribución exacta.</p></details>
 </section>
 <MonthChart projection={data}/>
 {data.recommendations.length>0&&<section className="rounded-2xl border border-border-soft bg-surface p-4 md:p-6 mb-6"><h2 className="font-semibold text-sm mb-4">Qué te muestran las mediciones</h2><ul className="space-y-3">{data.recommendations.map(r=><li key={r.id} className="rounded-xl bg-surface-raised border border-border-soft p-4"><h3 className="font-semibold text-sm">{r.title}</h3><p className="text-xs text-muted mt-2 leading-relaxed">{r.detail}</p>{r.impact&&<p className="text-xs text-muted mt-2">Escenario estimado: {r.impact}</p>}</li>)}</ul></section>}
 <HourlyProfile data={data}/>
 </>}
 </div>;
=======

import { useCallback, useState } from 'react';
import { Hourglass, Info, Receipt, TrendingUp } from 'lucide-react';
import { formatCurrency, formatDateTime, formatNumber, NO_DATA } from '@/lib/format';
import type { Forecast, ForecastConfidence } from '@/lib/forecast';
import type { GoalProgress } from '@/lib/goal';
import type { Recommendation } from '@/lib/recommendations';
import type { MeterRole } from '@/domain/meter-role';
import { GoalPanel, type MonthDailyPoint } from './GoalPanel';
import { GoalSetter } from './GoalSetter';
import type { ApiErrorPayload } from '@/lib/types';
import { apiUrl, useMeterId } from '@/lib/use-meter-id';
import { usePolling } from '@/lib/use-polling';
import { InfoTooltip } from './InfoTooltip';
import { ValueFade } from './ValueFade';
import { HourlyProfile } from './LazyCharts';
import type { ProfilePoint } from './HourlyProfile';
import { SetupNotice } from './SetupNotice';

/** La proyección cambia lentamente: no tiene sentido refrescarla seguido. */
const POLL_INTERVAL_MS = 300000;

type Payload = {
  /**
   * Dónde está instalado el medidor. Viaja en esta respuesta para que la
   * pantalla sepa cómo presentarse sin pedir los ajustes por separado.
   */
  role: MeterRole;
  /** `false` en un área: el costo proyectado no incluye el cargo fijo. */
  billable: boolean;
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
  // De qué medidor habla esta pantalla. Lo dice la dirección del navegador.
  const deviceId = useMeterId();
  const [data, setData] = useState<Payload | null>(null);
  const [error, setError] = useState<ApiErrorPayload | null>(null);

  const fetchForecast = useCallback(async () => {
    try {
      const response = await fetch(apiUrl('/api/meter/forecast', deviceId), { cache: 'no-store' });
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
  }, [deviceId]);

  usePolling(fetchForecast, POLL_INTERVAL_MS);

  if (error?.missingEnv) return <SetupNotice missing={error.missingEnv} />;

  const forecast = data?.forecast;
  // Un área se lee en energía: el costo baja a referencia y el objetivo deja
  // de poder escribirse en pesos.
  const isArea = data?.role === 'area';

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
          <GoalSetter goal={data.goal} role={data.role} onSaved={fetchForecast} />
          <GoalPanel
            role={data.role}
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
          <section
            className={`grid gap-4 grid-cols-1 mb-6 ${isArea ? '' : 'sm:grid-cols-2'}`}
          >
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

              {/* En un área el costo es una referencia dentro de la tarjeta de
                  energía, no un número principal al lado. */}
              {isArea && (
                <p className="mt-4 flex items-start gap-2 border-t border-border-soft pt-3 text-xs text-muted leading-relaxed">
                  <Receipt className="h-3.5 w-3.5 mt-0.5 shrink-0 text-ok" />
                  <span>
                    Representaría unos{' '}
                    <b className="text-foreground">{formatCurrency(forecast.cost.total)}</b> de
                    tu factura.
                    <InfoTooltip
                      title="De dónde sale esa referencia"
                      text="Es el precio por kWh del cuadro tarifario aplicado al consumo proyectado de este sector. No incluye el cargo fijo: ese se paga una vez por instalación, no por área."
                    />
                  </span>
                </p>
              )}
            </article>

            {!isArea && (
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
            )}
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
>>>>>>> 7f21ccba3e0b56e6065aa996f9b48d8a51260d79
}
function energy(value:number|null){return value===null?'—':formatNumber(value,2)+' kWh';}
function Kpi({title,value,hint}:{title:string;value:string;hint:string}){return <div><dt className="text-xs text-muted">{title}</dt><dd className="text-lg md:text-xl font-bold tracking-tight mt-1 tabular-nums">{value}</dd><p className="text-[11px] text-muted mt-1">{hint}</p></div>;}

function projectionDate(value:string|null){if(!value)return '—';const parts=new Intl.DateTimeFormat('es-AR',{timeZone:'America/Argentina/Buenos_Aires',day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date(value));const part=(name:string)=>parts.find(p=>p.type===name)?.value??'';return part('day')+'/'+part('month')+'/'+part('year')+' '+part('hour')+':'+part('minute');}
