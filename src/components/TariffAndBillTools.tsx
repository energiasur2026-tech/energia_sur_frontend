'use client';
import {ConfigureTariffLink} from './ConfigureTariffLink';
import {useState} from 'react';
import {meterFetch} from '@/lib/meter-fetch';
import {formatCurrency,formatNumber} from '@/lib/format';
import {ElectricityBreakdown} from './ElectricityBreakdown';
import {TariffSimulator} from './TariffSimulator';
import type {ElectricityBreakdown as Breakdown} from '@/lib/tariffs';
type Comparison={status:string;appKwh:number|null;billedKwh?:number;deltaKwh:number|null;coverage?:number;firstAt?:string|null;lastAt?:string|null;electricityChargeCalculated?:number|null;electricityChargeBilled?:number;electricityDifference:number|null;pending:string[]};
export function TariffAndBillTools({isArea=false}:{onSaved?:()=>void;isArea?:boolean}){
 const [message,setMessage]=useState(''),[busy,setBusy]=useState(false);
 const [from,setFrom]=useState(''),[to,setTo]=useState(''),[kwh,setKwh]=useState(''),[amount,setAmount]=useState('');
 const [result,setResult]=useState<{comparison:Comparison;breakdown:Breakdown|null}|null>(null);
 const number=(text:string)=>/^(?:\d+|\d{1,3}(?:\.\d{3})+)(?:,\d+)?$/.test(text.trim())?Number(text.trim().replace(/\./g,'').replace(',','.')):NaN;
 async function compare(event:React.FormEvent){event.preventDefault();setBusy(true);setMessage('');setResult(null);try{const r=await meterFetch('/api/meter/bill-comparison',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({from:new Date(from+(from.length===16?':00':'')+'-03:00').toISOString(),to:new Date(to+(to.length===16?':00':'')+'-03:00').toISOString(),billedKwh:number(kwh),electricityCharge:number(amount)})});const data=await r.json();if(!r.ok)throw new Error(data.error);setResult(data);}catch(error){setMessage(error instanceof Error?error.message:'No se pudo comparar.');}finally{setBusy(false);}}
 return <section className="rounded-2xl border border-border-soft bg-surface p-5 mb-6"><h2 className="font-semibold">Tarifa y comparación con tu factura</h2><p className="text-xs text-muted mt-2">La configuración del suministro se administra desde Ajustes. La comparación usa el cuadro verificado para el período seleccionado y muestra los cargos eléctricos disponibles.</p>
 <ConfigureTariffLink/>
 <TariffSimulator/>
 {isArea&&<p className="text-xs text-warn mt-4">Este medidor es de área: el costo es una referencia de ese sector. Para comparar toda la factura seleccioná el medidor central.</p>}
 <details className="mt-5"><summary className="cursor-pointer font-semibold text-sm">Comparar el intervalo facturado</summary><p className="text-xs text-muted mt-3">Usá ambas fechas y horas de lectura, no el mes de emisión ni el vencimiento. Horas de Argentina. Si la factura solo informa una fecha, necesitás el historial o la factura anterior; no inventes la otra. Si solo conocés el día, la comparación horaria será aproximada.</p>
 <form onSubmit={compare} className="grid sm:grid-cols-2 gap-3 mt-4">
 <label className="text-sm">Lectura inicial<input required type="datetime-local" value={from} onChange={e=>setFrom(e.target.value)} className="block w-full p-3 mt-1 border border-border-soft rounded-xl bg-surface-raised"/></label>
 <label className="text-sm">Lectura final<input required type="datetime-local" value={to} onChange={e=>setTo(e.target.value)} className="block w-full p-3 mt-1 border border-border-soft rounded-xl bg-surface-raised"/></label>
 <label className="text-sm">Consumo facturado · kWh<input required inputMode="decimal" placeholder="Ej.: 214" value={kwh} onChange={e=>setKwh(e.target.value)} className="block w-full p-3 mt-1 border border-border-soft rounded-xl bg-surface-raised"/></label>
 <label className="text-sm">Solo cargo de energía · ARS<input required inputMode="decimal" placeholder="Sin agua, energía pública ni IVA global" value={amount} onChange={e=>setAmount(e.target.value)} className="block w-full p-3 mt-1 border border-border-soft rounded-xl bg-surface-raised"/></label>
 <button disabled={isArea||busy||!from||!to||!kwh||!amount} className="rounded-xl bg-accent text-white p-3 disabled:opacity-50">{busy?'Consultando…':'Comparar factura eléctrica'}</button></form>
 {result&&<div className="mt-5 space-y-3" role="status"><p>Datos: {result.comparison.status==='period_aligned'?'lecturas en ambos extremos':'comparación parcial'}. Cobertura de muestreo: {formatNumber((result.comparison.coverage??0)*100,1)} %.</p><p>Proveedor: {formatNumber(result.comparison.billedKwh??null,3)} kWh · Medidor propio: {formatNumber(result.comparison.appKwh,3)} kWh · Diferencia: {formatNumber(result.comparison.deltaKwh,3)} kWh.</p><p>Cargo eléctrico facturado: {formatCurrency(result.comparison.electricityChargeBilled??null)} · Cargos calculados antes de ajustes: {formatCurrency(result.comparison.electricityChargeCalculated??null)} · Diferencia: {formatCurrency(result.comparison.electricityDifference)}.</p>{result.comparison.pending.map(text=><p key={text} className="text-xs text-warn">{text}</p>)}{result.breakdown&&<ElectricityBreakdown cost={{tier:{minKwh:0,maxKwh:0,cargoFijo:0,valorTramo:0},fixedCharge:result.breakdown.fixedCharge,variableCharge:result.breakdown.variableCharge,total:result.breakdown.knownTotal,breakdown:result.breakdown}}/>}</div>}
 </details><p role="status" className="text-sm text-muted mt-3">{message}</p></section>;
}
