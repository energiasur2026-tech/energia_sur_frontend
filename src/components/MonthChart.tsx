'use client';
import { useState } from 'react';
import { CartesianGrid,ComposedChart,Line,ReferenceLine,ResponsiveContainer,Tooltip,XAxis,YAxis } from 'recharts';
import { formatCurrency,formatNumber } from '@/lib/format';
import { useChartColors } from '@/lib/use-chart-colors';
import type { GoalProgress } from '@/lib/goal';
import type { MonthlyProjection } from '@/lib/monthly-projection';
export type MonthDailyPoint={day:string;consumedKwh:number|null;at?:string;x?:number};
export function MonthChart({projection}:{projection?:MonthlyProjection;goal?:GoalProgress;monthDaily?:MonthDailyPoint[]}){
 const colors=useChartColors();const [pace,setPace]=useState(true),[target,setTarget]=useState(true),[unit,setUnit]=useState<'kwh'|'ars'>('kwh');
 if(!projection)return null;
 const p=projection,g=p.goal;
 const moneyAvailable=p.tariff.valid&&!!p.chart.cost;
 const money=unit==='ars'&&moneyAvailable;
 const series=money?p.chart.cost!:p.chart;
 const data=series.references, measured=series.observed, predicted=series.estimated;
 const value=(n:number|null)=>money?formatCurrency(n):formatNumber(n,2)+' kWh';
 const ymax=Math.max(...data.map(r=>r.target??0),...measured.map(r=>r.real??0),...predicted.map(r=>r.projected),1)*1.12;
 const names:Record<string,string>={real:money?'Costo del consumo observado · estimado':'Acumulado observado · medido',projected:'Cierre mensual · estimado',pace:'Ritmo del objetivo · referencia',target:'Objetivo mensual · referencia'};
 return <section className="rounded-2xl border border-border-soft bg-surface p-4 md:p-6 mb-6"><div className="flex flex-wrap items-center justify-between gap-3"><h2 className="font-semibold text-sm">Tu consumo contra tu objetivo</h2><div role="group" aria-label="Unidad del gráfico de consumo" className="inline-flex rounded-xl border border-border-soft p-1 gap-1">{(['kwh','ars'] as const).map(mode=><button key={mode} type="button" disabled={mode==='ars'&&!moneyAvailable} aria-pressed={(money?'ars':'kwh')===mode} onClick={()=>setUnit(mode)} className={'rounded-lg px-3 py-2 text-sm border disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-accent '+((money?'ars':'kwh')===mode?'bg-accent-soft border-accent font-semibold text-foreground':'border-transparent text-muted')}>{mode==='ars'?'$ ARS':'kWh'}</button>)}</div></div><p className="text-xs text-muted mt-1">{money?'Mes completo · pesos argentinos estimados. Línea continua: costo del consumo observado. Discontinua: cierre estimado.':'Mes completo · kWh acumulados. Línea continua: observado. Discontinua: estimado.'}</p>
 <div className="flex flex-wrap gap-3 text-xs mt-4 mb-3"><span>━━ Observado</span><span>┄┄ Estimado</span><button type="button" aria-pressed={pace} onClick={()=>setPace(!pace)} className="text-muted underline">{pace?'Ocultar':'Mostrar'} ritmo de referencia</button><button type="button" aria-pressed={target} onClick={()=>setTarget(!target)} className="text-muted underline">{target?'Ocultar':'Mostrar'} objetivo mensual</button></div>
 <div className="h-64 md:h-80 w-full" role="img" aria-label={'Gráfico del mes '+p.month+'. '+(money?'Costo estimado del consumo observado ':'Acumulado observado ')+value(money?measured.filter(r=>r.real!==null).at(-1)?.real??null:p.measuredKwh)+'. Estimado al cierre '+value(money?g.projectedCostArs:g.projectedMonthKwh)+'.'}>
 <ResponsiveContainer width="100%" height="100%"><ComposedChart data={data} margin={{top:20,right:20,left:-12,bottom:12}}>
 <CartesianGrid stroke={colors.grid} strokeDasharray="3 3" vertical={false}/>
 <XAxis dataKey="x" type="number" domain={[1,p.daysInMonth+1]} ticks={[1,8,15,22,p.daysInMonth+1]} tickFormatter={x=>String(x===p.daysInMonth+1?p.daysInMonth:x)} stroke={colors.axis} fontSize={11}/>
 <YAxis domain={[0,ymax]} stroke={colors.axis} width={money?84:58} fontSize={11} tickFormatter={n=>money?'$ '+formatNumber(n,0):formatNumber(n,0)}/>
 <Tooltip contentStyle={{background:colors.tooltipBg,border:'1px solid '+colors.grid,borderRadius:12,fontSize:12}} labelFormatter={x=>new Date(Date.parse(p.monthStart)+(Number(x)-1)*86400000).toLocaleString('es-AR',{timeZone:'America/Argentina/Buenos_Aires',hourCycle:'h23',day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'})} formatter={(v,n)=>[value(typeof v==='number'?v:null),names[String(n)]??String(n)]}/>
 {pace&&<Line type="linear" dataKey="pace" data={data} name="pace" stroke={colors.axis} strokeDasharray="2 5" dot={false} isAnimationActive={false}/>}
 {target&&g.goalKwh!==null&&<Line type="linear" dataKey="target" data={data} name="target" stroke={colors.axis} strokeDasharray="8 4" dot={false} isAnimationActive={false}/>}
 {p.todayX!==null&&<ReferenceLine x={p.todayX} stroke={colors.axis} strokeDasharray="3 3" label={{value:'Hoy',fill:colors.axis,fontSize:11}}/>}
 <Line type="linear" dataKey="real" data={measured} name="real" stroke={colors.power} strokeWidth={2.5} connectNulls={false} dot={{r:2}} isAnimationActive={false}/>
 <Line type="linear" dataKey="projected" data={predicted} name="projected" stroke={colors.power} strokeWidth={2.5} strokeDasharray="7 5" connectNulls={false} dot={false} isAnimationActive={false}/>
 </ComposedChart></ResponsiveContainer></div>
 <p className="text-xs text-muted mt-4 leading-relaxed">Superar el ritmo de referencia indica que estás consumiendo más rápido de lo previsto. Todavía podés compensarlo durante el resto del mes.</p>
 {money&&<p className="text-xs text-muted mt-2">Importes orientativos con el cuadro configurado ({p.tariff.category}). {p.tariff.includeFixed?'Incluyen el cargo fijo mensual completo.':'Incluyen solo el cargo variable; no se agrega otro cargo fijo al área.'} No son una factura total. {p.tariff.note}</p>}
 {!moneyAvailable&&<p className="text-xs text-muted mt-2">La vista en pesos estará disponible cuando el backend entregue una conversión con tarifa válida.</p>}
 {p.missingStart&&<p className="text-xs text-warn mt-2">El acumulado observado comienza en la primera lectura disponible. El cierre estimado incluye una estimación separada del inicio no medido.</p>}
 {!!p.quality.gaps&&<p className="text-xs text-muted mt-2">Hay períodos sin mediciones: la línea observada se interrumpe; no se completan como consumo cero.</p>}
 </section>;
}
