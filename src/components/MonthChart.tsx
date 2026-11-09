'use client';
import { useState } from 'react';
import { CartesianGrid,ComposedChart,Line,ReferenceLine,ResponsiveContainer,Tooltip,XAxis,YAxis } from 'recharts';
import { formatNumber } from '@/lib/format';
import { useChartColors } from '@/lib/use-chart-colors';
import type { GoalProgress } from '@/lib/goal';
import type { MonthlyProjection } from '@/lib/monthly-projection';
export type MonthDailyPoint={day:string;consumedKwh:number|null;at?:string;x?:number};
export function MonthChart({projection}:{projection?:MonthlyProjection;goal?:GoalProgress;monthDaily?:MonthDailyPoint[]}){
 const colors=useChartColors();const [pace,setPace]=useState(true),[target,setTarget]=useState(true);
 if(!projection)return null;
 const p=projection,g=p.goal;
 const data=p.chart.references, measured=p.chart.observed, predicted=p.chart.estimated;
 const ymax=Math.max(g.goalKwh??0,g.projectedMonthKwh??0,...p.monthDaily.map(r=>r.consumedKwh??0),1)*1.12;
 const names:Record<string,string>={real:'Acumulado observado · medido',projected:'Cierre mensual · estimado',pace:'Ritmo del objetivo · referencia',target:'Objetivo mensual · referencia'};
 return <section className="rounded-2xl border border-border-soft bg-surface p-4 md:p-6 mb-6"><h2 className="font-semibold text-sm">Tu consumo contra tu objetivo</h2><p className="text-xs text-muted mt-1">Mes completo · kWh acumulados. Línea continua: observado. Discontinua: estimado.</p>
 <div className="flex flex-wrap gap-3 text-xs mt-4 mb-3"><span>━━ Observado</span><span>┄┄ Estimado</span><button type="button" aria-pressed={pace} onClick={()=>setPace(!pace)} className="text-muted underline">{pace?'Ocultar':'Mostrar'} ritmo de referencia</button><button type="button" aria-pressed={target} onClick={()=>setTarget(!target)} className="text-muted underline">{target?'Ocultar':'Mostrar'} objetivo mensual</button></div>
 <div className="h-64 md:h-80 w-full" role="img" aria-label={'Gráfico del mes '+p.month+'. Acumulado observado '+formatNumber(p.measuredKwh,2)+' kWh. Estimado al cierre '+formatNumber(g.projectedMonthKwh,2)+' kWh.'}>
 <ResponsiveContainer width="100%" height="100%"><ComposedChart data={data} margin={{top:20,right:20,left:-12,bottom:12}}>
 <CartesianGrid stroke={colors.grid} strokeDasharray="3 3" vertical={false}/>
 <XAxis dataKey="x" type="number" domain={[1,p.daysInMonth+1]} ticks={[1,8,15,22,p.daysInMonth+1]} tickFormatter={x=>String(x===p.daysInMonth+1?p.daysInMonth:x)} stroke={colors.axis} fontSize={11}/>
 <YAxis domain={[0,ymax]} stroke={colors.axis} width={58} fontSize={11} tickFormatter={n=>formatNumber(n,0)}/>
 <Tooltip contentStyle={{background:colors.tooltipBg,border:'1px solid '+colors.grid,borderRadius:12,fontSize:12}} labelFormatter={x=>new Date(Date.parse(p.monthStart)+(Number(x)-1)*86400000).toLocaleString('es-AR',{timeZone:'America/Argentina/Buenos_Aires',day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'})} formatter={(v,n)=>[formatNumber(typeof v==='number'?v:null,2)+' kWh',names[String(n)]??String(n)]}/>
 {pace&&<Line type="linear" dataKey="pace" data={data} name="pace" stroke={colors.axis} strokeDasharray="2 5" dot={false} isAnimationActive={false}/>}
 {target&&g.goalKwh!==null&&<Line type="linear" dataKey="target" data={data} name="target" stroke={colors.axis} strokeDasharray="8 4" dot={false} isAnimationActive={false}/>}
 {p.todayX!==null&&<ReferenceLine x={p.todayX} stroke={colors.axis} strokeDasharray="3 3" label={{value:'Hoy',fill:colors.axis,fontSize:11}}/>}
 <Line type="linear" dataKey="real" data={measured} name="real" stroke={colors.power} strokeWidth={2.5} connectNulls={false} dot={{r:2}} isAnimationActive={false}/>
 <Line type="linear" dataKey="projected" data={predicted} name="projected" stroke={colors.power} strokeWidth={2.5} strokeDasharray="7 5" connectNulls={false} dot={false} isAnimationActive={false}/>
 </ComposedChart></ResponsiveContainer></div>
 <p className="text-xs text-muted mt-4 leading-relaxed">Superar el ritmo de referencia indica que estás consumiendo más rápido de lo previsto. Todavía podés compensarlo durante el resto del mes.</p>
 {p.missingStart&&<p className="text-xs text-warn mt-2">El acumulado observado comienza en la primera lectura disponible. El cierre estimado incluye una estimación separada del inicio no medido.</p>}
 {!!p.quality.gaps&&<p className="text-xs text-muted mt-2">Hay períodos sin mediciones: la línea observada se interrumpe; no se completan como consumo cero.</p>}
 </section>;
}
