'use client';
<<<<<<< HEAD
import { useEffect,useRef,useState } from 'react';
import { meterFetch } from '@/lib/meter-fetch';
import { formatCurrency,formatNumber } from '@/lib/format';
import { parseGoalText,editableGoalNumber } from '@/lib/goal-draft';
import type { GoalProgress,GoalInputMode } from '@/lib/goal';
import type { GoalChoice,TariffInfo } from '@/lib/monthly-projection';
type Quote={kwh:number|null;ars:number|null;error:string|null;tariff:TariffInfo};
export function GoalSetter({goal,choice,tariff,onSaved,preview=false}:{preview?:boolean;goal:GoalProgress;choice?:GoalChoice;tariff?:TariffInfo;onSaved:()=>void}){
 const original=choice??(goal.goalKwh===null?null:{mode:'kwh' as const,value:goal.goalKwh});
 const [open,setOpen]=useState(preview||!original),[mode,setMode]=useState<GoalInputMode>(original?.mode??'kwh');
 const [text,setText]=useState(original?editableGoalNumber(original.value):'');
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
 <div className="inline-flex rounded-xl bg-surface-raised p-1 gap-1 mb-4" aria-label="Unidad del objetivo">{(['ars','kwh'] as const).map(unit=><button key={unit} type="button" aria-pressed={mode===unit} onClick={()=>changeMode(unit)} className={'rounded-lg px-4 py-2 text-sm '+(mode===unit?'bg-accent text-white':'text-muted')}>{unit==='ars'?'En pesos':'En kWh'}</button>)}</div>
 <div className="grid md:grid-cols-2 gap-3 md:items-end"><label className="text-xs font-semibold text-muted">{mode==='ars'?'Presupuesto mensual · ARS':'Energía mensual · kWh'}<input aria-describedby="goal-equivalence goal-error" className="mt-2 block w-full rounded-xl border border-border-soft bg-surface-raised p-3 text-base text-foreground outline-none focus:border-accent" type="text" readOnly={preview} inputMode="decimal" value={text} onChange={e=>{++sequence.current;const t=e.target.value;setText(t);const n=parseGoalText(t);setAnchor(n===null?null:{mode,value:n});setQuote(null);setQuoting(n!==null);setError('');}} placeholder={mode==='ars'?'Ej.: 50.000':'Ej.: 266'} /></label>
 <p id="goal-equivalence" aria-live="polite" className="rounded-xl bg-surface-raised px-4 py-3 text-sm">{quoting?'Calculando equivalencia…':equivalence!==null&&equivalence!==undefined?'≈ '+(mode==='ars'?formatNumber(equivalence,2)+' kWh/mes':formatCurrency(equivalence)+'/mes'):quote?.error??(currentTariff&&!currentTariff.valid?'Equivalencia en pesos no disponible: falta una tarifa válida.':'Ingresá un valor para ver su equivalencia.')}</p></div>
 <p className="text-xs text-muted mt-2">Equivalencia estimada según tu tarifa configurada. Usá coma para decimales.</p>
 {(error||quote?.error||text.trim()&&!anchor)&&<p id="goal-error" role="alert" className="mt-3 text-sm text-danger">{error||quote?.error||'Ingresá un número mayor a cero, con coma para decimales.'}</p>}
 <div className="flex flex-wrap gap-3 mt-4"><button disabled={preview||saving||quoting||!anchor||!!quote?.error} className="rounded-xl bg-accent text-white px-4 py-2.5 text-sm font-semibold disabled:opacity-50">{saving?'Guardando…':'Guardar objetivo'}</button>{original&&!preview&&<button disabled={saving} type="button" className="text-sm text-muted" onClick={()=>void save(true)}>Quitar objetivo</button>}</div>
 </form>}
 {currentTariff&&<details className="text-xs text-muted mt-4"><summary className="cursor-pointer">Tarifa y cargos incluidos</summary><div className="mt-3 space-y-2"><p>{currentTariff.category}. Vigencia: {currentTariff.effectiveDate??'no registrada'}.</p><p>Incluye: {currentTariff.included.join(', ')}.</p><p>No incluye: {currentTariff.excluded.join(', ')}.</p><p>{currentTariff.note}</p>{!currentTariff.valid&&<p>No hay tarifa válida: el objetivo en kWh sigue disponible.</p>}</div></details>}
 </section>;
=======

import { useState } from 'react';
import { Target, Trash2 } from 'lucide-react';
import { formatCurrency, formatNumber } from '@/lib/format';
import type { GoalInputMode, GoalProgress } from '@/lib/goal';
import { apiUrl, useMeterId } from '@/lib/use-meter-id';
import type { MeterRole } from '@/domain/meter-role';
import { InfoTooltip } from './InfoTooltip';

/**
 * Definición de la meta mensual.
 *
 * En un medidor central se puede escribir en kWh o en pesos, porque la gente
 * piensa su factura de las dos maneras. En pesos se convierte con el cuadro
 * tarifario del lado del servidor: acá solo se elige la unidad.
 *
 * En un medidor de área la única unidad es el kWh. Un área no es una factura
 * aparte —el cargo fijo se paga una vez por instalación— así que "que la
 * factura no pase de" no significa nada ahí.
 */
export function GoalSetter({
  goal,
  role,
  onSaved,
}: {
  goal: GoalProgress;
  role: MeterRole;
  onSaved: () => void;
}) {
  // De qué medidor habla esta pantalla. Lo dice la dirección del navegador.
  const deviceId = useMeterId();
  const isArea = role === 'area';
  const [open, setOpen] = useState(goal.status === 'no_goal');
  const [mode, setMode] = useState<GoalInputMode>(isArea ? 'kwh' : goal.inputMode);
  const [value, setValue] = useState(() => initialValue(goal));
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function save(nextValue: number | null) {
    setSaving(true);
    setError(null);

    try {
      const response = await fetch(apiUrl('/api/meter/goal', deviceId), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode, value: nextValue }),
      });
      const payload = await response.json();

      if (!response.ok) {
        setError(payload.error ?? 'No se pudo guardar el objetivo.');
        return;
      }

      setOpen(false);
      onSaved();
    } catch {
      setError('No se pudo contactar al servidor.');
    } finally {
      setSaving(false);
    }
  }

  if (!open) {
    return (
      <section className="rounded-2xl border border-border-soft bg-surface p-4 md:p-5 mb-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Target className="h-4 w-4 text-accent" />
            <span className="text-sm text-muted">Tu objetivo del mes:</span>
            <strong className="text-sm">
              {formatNumber(goal.goalKwh, 0)} kWh
              {!isArea && goal.goalCostArs !== null && (
                <span className="font-normal text-muted"> · ≈ {formatCurrency(goal.goalCostArs)}</span>
              )}
            </strong>
          </div>
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="text-xs font-semibold text-accent hover:underline"
          >
            Cambiar objetivo
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-accent/40 bg-surface p-4 md:p-5 lg:p-6 mb-6">
      <div className="flex items-center gap-2 mb-1">
        <Target className="h-4 w-4 text-accent" />
        <h2 className="text-sm font-semibold">
          {goal.status === 'no_goal' ? 'Ponete un objetivo mensual' : 'Cambiar tu objetivo'}
        </h2>
        <InfoTooltip title="Tu objetivo mensual" text="Es cuánto querés gastar de luz este mes. Con eso, la app te dice cuánto podés consumir por día y te avisa si te estás pasando, con tiempo para corregir." />
      </div>
      <p className="text-xs text-muted leading-relaxed mb-4">
        {isArea
          ? 'El objetivo de un sector se fija en energía: es lo que ese lugar consume, no una factura aparte.'
          : 'Escribilo como te resulte natural: en pesos, si pensás en la factura, o en kWh si mirás el consumo. Es lo mismo, convertido con el cuadro tarifario.'}
      </p>

      {error && (
        <p className="mb-4 rounded-xl border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
          {error}
        </p>
      )}

      {/* En un área no hay unidad que elegir: mostrar un selector de una sola
          opción sería ofrecer una decisión que no existe. */}
      {!isArea && (
      <div className="flex gap-1 rounded-xl bg-surface-raised p-1 mb-4 w-fit">
        {(['ars', 'kwh'] as GoalInputMode[]).map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => setMode(option)}
            className={`rounded-lg px-4 py-1.5 text-xs font-semibold transition-colors ${
              mode === option ? 'bg-accent text-white' : 'text-muted hover:text-foreground'
            }`}
          >
            {option === 'ars' ? 'En pesos' : 'En kWh'}
          </button>
        ))}
      </div>
      )}

      <form
        onSubmit={(event) => {
          event.preventDefault();
          const parsed = Number(value);
          if (!Number.isFinite(parsed) || parsed <= 0) {
            setError('Ingresá un número mayor a cero.');
            return;
          }
          save(parsed);
        }}
        className="flex flex-wrap items-end gap-3"
      >
        <label className="flex-1 min-w-[10rem]">
          <span className="text-xs font-semibold uppercase tracking-wide text-muted">
            {mode === 'ars' ? 'Quiero que la factura no pase de' : 'Quiero consumir como máximo'}
          </span>
          <span className="relative mt-1.5 flex items-center">
            {mode === 'ars' && (
              <span className="absolute left-3 text-sm text-muted">$</span>
            )}
            <input
              type="number"
              inputMode="decimal"
              min={1}
              step="any"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder={mode === 'ars' ? '30000' : '150'}
              className={`w-full rounded-xl border border-border-soft bg-surface-raised py-2.5 pr-14 text-sm text-foreground outline-none focus:border-accent ${
                mode === 'ars' ? 'pl-7' : 'pl-3'
              }`}
            />
            <span className="absolute right-3 text-xs text-muted">
              {mode === 'ars' ? 'por mes' : 'kWh'}
            </span>
          </span>
        </label>

        <button
          type="submit"
          disabled={saving}
          className="rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-accent/85 disabled:opacity-50"
        >
          {saving ? 'Guardando…' : 'Guardar objetivo'}
        </button>

        {goal.status !== 'no_goal' && (
          <button
            type="button"
            onClick={() => save(null)}
            disabled={saving}
            className="inline-flex items-center gap-1.5 rounded-xl border border-border-soft px-3 py-2.5 text-xs font-medium text-muted transition-colors hover:text-danger"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Quitar
          </button>
        )}
      </form>
    </section>
  );
}

function initialValue(goal: GoalProgress): string {
  if (goal.goalKwh === null) return '';
  return goal.inputMode === 'ars' && goal.goalCostArs !== null
    ? String(Math.round(goal.goalCostArs))
    : String(Math.round(goal.goalKwh));
>>>>>>> 7f21ccba3e0b56e6065aa996f9b48d8a51260d79
}
