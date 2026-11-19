'use client';

import {useState} from 'react';
import {formatCurrency} from '@/lib/format';
import type {ElectricityBreakdown as Breakdown} from '@/lib/tariffs';
import {ElectricityBreakdown} from './ElectricityBreakdown';

type Version = {id:string;provider:string;jurisdiction:string;category:string;segment:string;effectiveFrom:string;reviewedOn:string};
const names:Record<string,string> = {SPSE:'SPSE', EDESUR:'Edesur', COOPRG:'Cooperativa Eléctrica de Río Grande'};
const input = 'block w-full p-3 mt-1 border border-border-soft rounded-xl bg-surface-raised';

export function TariffSimulator() {
  const [catalog,setCatalog] = useState<Version[]|null>(null);
  const [provider,setProvider] = useState('');
  const [versionKey,setVersionKey] = useState('');
  const [construction,setConstruction] = useState(false);
  const [busy,setBusy] = useState(false);
  const [error,setError] = useState('');
  const [result,setResult] = useState<{quotes:Breakdown[];difference:number|null}|null>(null);
  const key = (version:Version)=>version.id+'|'+version.jurisdiction;

  async function load() {
    setError('');
    try {
      const response = await fetch('/api/meter/tariff-simulator');
      if(!response.ok)throw new Error();
      setCatalog(await response.json());
    } catch {setError('No se pudieron cargar los cuadros. Reintentá.');}
  }

  async function simulate(event:React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const version = catalog?.find(item=>key(item)===versionKey);
    if(!version)return;
    const scenarios = [Number(form.get('kwh'))];
    if(form.get('comparison')!=='')scenarios.push(Number(form.get('comparison')));
    const declaredAmount = form.get('constructionAmount');
    const contractedKw = form.get('contractedKw');
    setBusy(true);setError('');setResult(null);
    try {
      const response = await fetch('/api/meter/tariff-simulator',{method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({id:version.id,jurisdiction:version.jurisdiction,construction,scenarios,
          constructionAmount:declaredAmount?Number(declaredAmount):undefined,
          contractedKw:contractedKw?Number(contractedKw):undefined})});
      const data = await response.json();
      if(!response.ok)throw new Error(data.error);
      setResult(data);
    } catch(error) {setError(error instanceof Error?error.message:'No se pudo simular el consumo.');}
    finally {setBusy(false);}
  }

  return <details className="mt-5">
    <summary className="cursor-pointer font-semibold text-sm">Simular costos por consumo</summary>
    {!catalog?<button type="button" onClick={load} className="mt-3 underline">Cargar cuadros tarifarios</button>:
      <form onSubmit={simulate} className="grid sm:grid-cols-2 gap-3 mt-4">
        <label>Proveedor<select required value={provider} className={input} onChange={e=>{setProvider(e.target.value);setVersionKey('');setResult(null);setConstruction(false);}}>
          <option value="">Seleccionar</option>{Array.from(new Set(catalog.map(item=>item.provider))).map(id=><option value={id} key={id}>{names[id]??id}</option>)}
        </select></label>
        <label>Categoría y período<select required value={versionKey} className={input} onChange={e=>{setVersionKey(e.target.value);setResult(null);}}>
          <option value="">Seleccionar cuadro</option>{catalog.filter(item=>item.provider===provider).map(item=><option key={key(item)} value={key(item)}>{item.category} · {item.segment==='subsidized'?'Con subsidio':item.segment==='unsubsidized'?'Sin subsidio':'Uso específico'} · {item.effectiveFrom} · {item.jurisdiction.slice(3)}</option>)}
        </select></label>
        <label>Consumo mensual (kWh)<input className={input} required name="kwh" type="number" min="0" max="1000000" step="any"/></label>
        <label>Consumo alternativo (kWh)<input className={input} name="comparison" type="number" min="0" max="1000000" step="any"/></label>
        {catalog.find(item=>key(item)===versionKey)?.category==='T2P'&&
          <label>Potencia contratada (kW, opcional)<input className={input} name="contractedKw" type="number" step="any"/></label>}
        {provider==='COOPRG'&&<label className="sm:col-span-2"><input type="checkbox" checked={construction} onChange={e=>{setConstruction(e.target.checked);setResult(null);}}/> Mi factura incluye luz de obra</label>}
        {construction&&<label>Luz de obra de mi factura (ARS, opcional)<input className={input} name="constructionAmount" type="number" min="0" max="100000000" step="0.01"/></label>}
        <button disabled={busy} className="rounded-xl bg-accent text-white p-3 disabled:opacity-50">{busy?'Calculando…':'Calcular'}</button>
      </form>}
    {error&&<p role="alert" className="mt-3 text-danger">{error}</p>}
    {result&&<div className="mt-4" aria-live="polite">
      {result.quotes.map((quote,index)=><div key={index}><h3 className="font-semibold mb-2">{index?'Escenario alternativo':'Escenario principal'} · cargos calculados {formatCurrency(quote.knownTotal)}</h3>
        <ElectricityBreakdown cost={{tier:{minKwh:0,maxKwh:0,cargoFijo:0,valorTramo:0},fixedCharge:quote.fixedCharge,variableCharge:quote.variableCharge,total:quote.knownTotal,breakdown:quote}}/></div>)}
      {result.difference!==null&&<p>Diferencia de cargos calculados {formatCurrency(result.difference)}</p>}
    </div>}
  </details>;
}
