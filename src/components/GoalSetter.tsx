'use client';
import { useEffect,useRef,useState } from 'react';
import { meterFetch } from '@/lib/meter-fetch';
import { formatCurrency,formatNumber } from '@/lib/format';
import { parseGoalText,editableGoalNumber } from '@/lib/goal-draft';
import type { MeterRole } from '@/domain/meter-role';
import type { GoalProgress,GoalInputMode } from '@/lib/goal';
import type { GoalChoice,TariffInfo } from '@/lib/monthly-projection';
type Quote={kwh:number|null;ars:number|null;error:string|null;tariff:TariffInfo};
export function GoalSetter({goal,choice,tariff,onSaved,preview=false,role='central'}:{role?:MeterRole;preview?:boolean;goal:GoalProgress;choice?:GoalChoice;tariff?:TariffInfo;onSaved:()=>void}){
 const original=choice??(goal.goalKwh===null?null:{mode:'kwh' as const,value:goal.goalKwh});
 const isArea=role==='area';
 const initialMode:GoalInputMode=isArea?'kwh':original?.mode??'kwh';
 const [open,setOpen]=useState(preview||!original),[mode,setMode]=useState<GoalInputMode>(initialMode);
 const [text,setText]=useState(original?editableGoalNumber(initialMode===original.mode?original.value:goal.goalKwh??0):'');
 const [anchor,setAnchor]=useState<{mode:GoalInputMode;value:number}|null>(original);
 const [quote,setQuote]=useState<Quote|null>(preview&&tariff?{kwh:goal.goalKwh,ars:goal.goalCostArs,error:null,tariff}:null),[quoting,setQuoting]=useState(false),[saving,setSaving]=useState(false),[error,setError]=useState('');
 const sequence=useRef(0);
 useEffect(()=>{if(preview)return;const id=++sequence.current;const controller=new AbortController();
 if(!anchor)return;
 const timer=setTimeout(async()=>{setQuoting(true);try{const r=await meterFetch('/api/meter/goal?mode='+anchor.mode+'&value='+anchor.value,{signal:controller.signal});const q=await r.json();if(!r.ok)throw new Error(q.error??'No se pudo convertir.');if(id===sequence.current){setQuote(q);setError('');}}
 catch(e){if(!controller.signal.aborted&&id===sequence.current){setQuote(null);setError(e instanceof Error?e.message:'No se pudo convertir.');}}
 finally{if(id===sequence.current)setQuoting(false);}},180);
 return()=>{clearTimeout(timer);controller.abort();};},[anchor,preview]);
 function changeMode(next:GoalInputMode){if(next===mode)return;
 if(next==='kwh'&&(quote?.tariff??tariff)?.valid===false){++sequence.current;setMode('kwh');setText('');setAnchor(null);setQuote(null);setQuoting(false);setError('Sin una tarifa válida no puedo convertir el presupuesto. Ingresá directamente tu objetivo en kWh.');return;}
 if(!anchor){setMode(next);setText('');return;}
 const converted=next===anchor.mode?anchor.value:next==='ars'?quote?.ars:quote?.kwh;
 if(converted===null||converted===undefined||quoting){setError('Esperá la equivalencia válida antes de cambiar de unidad.');return;}
 setMode(next);setText(editableGoalNumber(converted));setError('');}
 async function save(clear=false){const value=clear?null:mode===anchor?.mode?anchor.value:mode==='ars'?quote?.ars:quote?.kwh;
 if(!clear&&(!value||value<=0)){setError('Ingresá un número válido mayor a cero.');return;}
 setSaving(true);setError('');try{const r=await meterFetch('/api/meter/goal',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({mode,value})});const p=await r.json();if(!r.ok)throw new Error(p.error??'No se pudo guardar.');setOpen(false);onSaved();}catch(e){setError(e instanceof Error?e.message:'No se pudo guardar.');}finally{setSaving(false);}}
 const currentTariff=quote?.tariff??tariff;
 const equivalence=mode==='ars'?quote?.kwh:quote?.ars;
 return <section className="rounded-2xl border border-border-soft bg-surface p-4 md:p-6 mb-6">
 <div className="flex flex-wrap justify-between gap-3 items-center"><div><h2 className="font-semibold text-sm">Tu objetivo mensual</h2><p className="text-xs text-muted mt-1">{original?original.mode==='ars'?formatCurrency(original.value)+' /mes':formatNumber(original.value,2)+' kWh/mes':'Elegí una meta a tu ritmo.'}</p></div><button className="text-sm text-accent font-semibold" onClick={()=>setOpen(!open)} type="button">{open?'Cerrar edición':'Editar objetivo'}</button></div>
 {choice?.tariffVersion&&currentTariff&&choice.tariffVersion!==currentTariff.version&&<p className="text-xs text-warn mt-3">La tarifa cambió o este objetivo proviene del formato anterior. Se conserva el valor original; la equivalencia se actualiza con el cuadro configurado.</p>}
 {open&&<form className="mt-5" onSubmit={e=>{e.preventDefault();void save();}}>
 <div className="inline-flex rounded-xl bg-surface-raised p-1 gap-1 mb-4" aria-label="Unidad del objetivo">{(isArea?['kwh'] as const:['ars','kwh'] as const).map(unit=><button key={unit} type="button" aria-pressed={mode===unit} onClick={()=>changeMode(unit)} className={'rounded-lg px-4 py-2 text-sm '+(mode===unit?'bg-accent text-white':'text-muted')}>{unit==='ars'?'En pesos':'En kWh'}</button>)}</div>
 <div className="grid md:grid-cols-2 gap-3 md:items-end"><label className="text-xs font-semibold text-muted">{mode==='ars'?'Presupuesto mensual · ARS':'Energía mensual · kWh'}<input aria-describedby="goal-equivalence goal-error" className="mt-2 block w-full rounded-xl border border-border-soft bg-surface-raised p-3 text-base text-foreground outline-none focus:border-accent" type="text" readOnly={preview} inputMode="decimal" value={text} onChange={e=>{++sequence.current;const t=e.target.value;setText(t);const n=parseGoalText(t);setAnchor(n===null?null:{mode,value:n});setQuote(null);setQuoting(n!==null);setError('');}} placeholder={mode==='ars'?'Ej.: 50.000':'Ej.: 266'} /></label>
 <p id="goal-equivalence" aria-live="polite" className="rounded-xl bg-surface-raised px-4 py-3 text-sm">{quoting?'Calculando equivalencia…':equivalence!==null&&equivalence!==undefined?'≈ '+(mode==='ars'?formatNumber(equivalence,2)+' kWh/mes':formatCurrency(equivalence)+'/mes'):quote?.error??(currentTariff&&!currentTariff.valid?'Equivalencia en pesos no disponible: falta una tarifa válida.':'Ingresá un valor para ver su equivalencia.')}</p></div>
 {isArea&&<p className="text-xs text-muted mt-2">Este medidor mide un área: el objetivo se define en kWh y el costo es una referencia sin cargo fijo.</p>}
 <p className="text-xs text-muted mt-2">Equivalencia estimada según tu tarifa configurada. Usá coma para decimales.</p>
 {(error||quote?.error||text.trim()&&!anchor)&&<p id="goal-error" role="alert" className="mt-3 text-sm text-danger">{error||quote?.error||'Ingresá un número mayor a cero, con coma para decimales.'}</p>}
 <div className="flex flex-wrap gap-3 mt-4"><button disabled={preview||saving||quoting||!anchor||!!quote?.error} className="rounded-xl bg-accent text-white px-4 py-2.5 text-sm font-semibold disabled:opacity-50">{saving?'Guardando…':'Guardar objetivo'}</button>{original&&!preview&&<button disabled={saving} type="button" className="text-sm text-muted" onClick={()=>void save(true)}>Quitar objetivo</button>}</div>
 </form>}
 {currentTariff&&<details className="text-xs text-muted mt-4"><summary className="cursor-pointer">Tarifa y cargos incluidos</summary><div className="mt-3 space-y-2"><p>{currentTariff.category}. Vigencia: {currentTariff.effectiveDate??'no registrada'}.</p><p>Incluye: {currentTariff.included.join(', ')}.</p><p>No incluye: {currentTariff.excluded.join(', ')}.</p><p>{currentTariff.note}</p>{!currentTariff.valid&&<p>No hay tarifa válida: el objetivo en kWh sigue disponible.</p>}</div></details>}
 </section>;
}
