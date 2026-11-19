'use client';

import { useEffect, useState } from 'react';
import { meterFetch } from '@/lib/meter-fetch';
import { useMeterId } from '@/lib/use-meter-id';

export function BillingCycleForm({onSaved}:{onSaved?:()=>void}={}) {
  const deviceId=useMeterId();
  const [date,setDate]=useState('');
  const [saved,setSaved]=useState<string|null>(null);
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState('');
  const [error,setError]=useState('');
  const [retry,setRetry]=useState(0);
  const [today]=useState(()=>new Date(Date.now()-10800000).toISOString().slice(0,10));
  useEffect(()=>{
    const controller=new AbortController();
    void (async()=>{
      try {
        const result=await meterFetch('/api/meter/billing-cycle',{signal:controller.signal});
        const payload=await result.json();
        if(!result.ok)throw new Error(payload.error??'No se pudo consultar el cierre.');
        if(!controller.signal.aborted){setDate(payload.closedOn??'');setSaved(payload.closedOn??'');setError('');}
      } catch(error) {
        if(!controller.signal.aborted)setError(error instanceof Error?error.message:'No se pudo consultar el cierre.');
      }
    })();
    return ()=>controller.abort();
  },[deviceId,retry]);
  useEffect(()=>{
    const sync=(event:Event)=>{
      const next=(event as CustomEvent<unknown>).detail;
      if(typeof next!=='string')return;
      if(date===saved)setDate(next);
      setSaved(next);
    };
    window.addEventListener('energia:billing-close-changed',sync);
    return ()=>window.removeEventListener('energia:billing-close-changed',sync);
  },[date,saved]);
  async function save(event:React.FormEvent) {
    event.preventDefault();
    setBusy(true);setError('');setMessage('');
    try {
      const result=await meterFetch('/api/meter/billing-cycle',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({closedOn:date})});
      const payload=await result.json();
      if(!result.ok)throw new Error(payload.error??'No se pudo guardar el cierre.');
      if(payload.closedOn!==date)throw new Error('No pudimos confirmar que la fecha quedara guardada.');
      setSaved(payload.closedOn);setMessage('Fecha de cierre guardada correctamente.');
      window.dispatchEvent(new CustomEvent('energia:billing-close-changed',{detail:payload.closedOn}));
      window.dispatchEvent(new Event('energia:configuration-changed'));
      onSaved?.();
    } catch(error) {setError(error instanceof Error?error.message:'No se pudo guardar el cierre.');}
    finally {setBusy(false);}
  }
  return <section className="mb-6 rounded-2xl border border-border-soft bg-surface p-5" data-unsaved={saved!==null&&date!==saved}>
    <h3 className="text-sm font-semibold">Cierre de factura</h3>
    <p className="mt-2 text-xs text-muted">Si la factura indica cuándo empieza el nuevo período, usá esa fecha. Si solo indica el cierre, usamos ese día desde las 00:00 de Argentina. El vencimiento es la fecha límite de pago.</p>
    {saved===null&&!error&&<p className="mt-3 text-sm text-muted">Consultando el cierre…</p>}
    {error&&<p role="alert" className="mt-3 text-sm text-danger">{error} {saved===null&&<button type="button" className="underline" onClick={()=>{setError('');setRetry(n=>n+1);}}>Reintentar</button>}</p>}
    {saved!==null&&<form onSubmit={save} className="mt-4 flex flex-wrap items-end gap-3">
      <label className="text-sm">Fecha de cierre<input type="date" required max={today} value={date} onChange={event=>{setDate(event.target.value);setMessage('');}} className="mt-1 block rounded-xl border border-border-soft bg-surface-raised px-3 py-2.5"/></label>
      <button disabled={busy||!date||date===saved} className="rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{busy?'Guardando…':'Guardar cierre'}</button>
    </form>}
    {message&&<p role="status" className="mt-3 text-sm text-ok">{message}</p>}
  </section>;
}
