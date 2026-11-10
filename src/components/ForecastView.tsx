'use client';
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
 <GoalSetter key={JSON.stringify(data.choice)} preview={!!preview} role={data.role??'central'} goal={g} choice={data.choice} tariff={data.tariff} onSaved={refresh}/>
 <section className="rounded-2xl border border-border-soft bg-surface p-4 md:p-6 mb-6"><div className="flex flex-wrap gap-2 items-center justify-between mb-5"><h2 className="font-semibold text-sm">Cómo podría terminar {data.month}</h2><span className="text-xs rounded-full bg-accent-soft px-3 py-1 text-accent">Estimación por ritmo observado</span></div>
 <dl className="grid grid-cols-2 lg:grid-cols-4 gap-x-5 gap-y-6">
 <Kpi title={data.missingStart?'Acumulado observado · parcial':'Consumo acumulado observado'} value={energy(data.measuredKwh)} hint={data.missingStart?'Desde la primera lectura disponible':'Hasta la última lectura'}/>
 <Kpi title="Objetivo mensual" value={energy(g.goalKwh)} hint={data.choice?.mode==='ars'?'Equivalente de '+formatCurrency(data.choice.value):'Energía definida por vos'}/>
 <Kpi title="Estimado al cierre" value={energy(g.projectedMonthKwh)} hint="Mes calendario completo"/>
 <Kpi title="Diferencia frente al objetivo" value={g.deviationKwh===null?'—':(g.deviationKwh>0?'+':'')+energy(g.deviationKwh)} hint={g.deviationKwh===null?'Faltan datos u objetivo':g.deviationKwh>0?'Por encima del objetivo':'Por debajo del objetivo'}/>
 <Kpi title="Promedio diario observado" value={energy(g.dailyRateKwh)} hint="Por 24 h de tiempo medido"/>
 <Kpi title={data.exceededKwh&&data.exceededKwh>0?'Objetivo ya superado':'Margen diario restante'} value={data.exceededKwh&&data.exceededKwh>0?energy(data.exceededKwh)+' de exceso':energy(g.remainingPerDayKwh)} hint={data.exceededKwh&&data.exceededKwh>0?'No es consumo permitido':data.missingStart?'Usa el inicio del mes estimado':'Tiempo restante, incluido el día parcial'}/>
 <Kpi title={data.role==='area'?'Costo de referencia al cierre':'Costo estimado al cierre'} value={data.tariff.valid?formatCurrency(g.projectedCostArs):'No disponible'} hint={data.role==='area'?'Referencia de energía, sin cargo fijo':'Estimación parcial de energía'}/>
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
}
function energy(value:number|null){return value===null?'—':formatNumber(value,2)+' kWh';}
function Kpi({title,value,hint}:{title:string;value:string;hint:string}){return <div><dt className="text-xs text-muted">{title}</dt><dd className="text-lg md:text-xl font-bold tracking-tight mt-1 tabular-nums">{value}</dd><p className="text-[11px] text-muted mt-1">{hint}</p></div>;}

function projectionDate(value:string|null){if(!value)return '—';const parts=new Intl.DateTimeFormat('es-AR',{timeZone:'America/Argentina/Buenos_Aires',day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date(value));const part=(name:string)=>parts.find(p=>p.type===name)?.value??'';return part('day')+'/'+part('month')+'/'+part('year')+' '+part('hour')+':'+part('minute');}
