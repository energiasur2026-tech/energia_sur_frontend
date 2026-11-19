'use client';

import {useEffect,useRef,useState} from 'react';
import {FileUp, ScanLine} from 'lucide-react';
import {analyzeInvoice,invoiceChecks,parseInvoiceNumber,type InvoiceAnalysis,type InvoiceFields} from '@/lib/invoice-analysis';
import {inspectInvoiceFile,invoiceMaxMb} from '@/lib/invoice-document';
import {formatCurrency} from '@/lib/format';

type Provider={id:string;name:string;categories:string[];province?:string;provinces?:string[];locality?:string};
export type InvoiceApplication={provider:string;providerName:string;province:string;locality:string;category:string;segment:string;supplyType:string;constructionCharge:boolean;closedOn:string};
type Version={provider:string;jurisdiction:string;segment:string;effectiveFrom:string|null;effectiveTo:string|null;source:string};
const fieldsToReview=[
  ['period','Período facturado','month'],['issuedOn','Fecha de emisión','date'],['dueOn','Primer vencimiento','date'],
  ['closedOn','Fecha de cierre','date'],['kwh','Consumo (kWh)','text'],['previousReading','Lectura anterior (kWh)','text'],
  ['currentReading','Lectura actual (kWh)','text'],['meterType','Tipo de medidor','text'],['total','Total facturado (ARS)','text'],
] as const;
const input='mt-1 block w-full min-w-0 rounded-lg border border-border-soft bg-surface-raised p-2';
const button='rounded-xl bg-accent px-4 py-2.5 font-semibold text-white disabled:opacity-50';

export function InvoiceAssistant({providers,provinces,versions,current,onApply}:{
  providers:Provider[];provinces:string[];versions:Version[];
  current:Pick<InvoiceFields,'provider'|'providerName'|'province'|'locality'|'category'|'segment'|'supplyType'>;
  onApply:(value:InvoiceApplication)=>Promise<void>;
}) {
  const [open,setOpen]=useState(false);
  const [selected,setSelected]=useState<{file:File;kind:ReturnType<typeof inspectInvoiceFile>;url:string|null}|null>(null);
  const [review,setReview]=useState<InvoiceAnalysis|null>(null);
  const [progress,setProgress]=useState('');
  const [error,setError]=useState('');
  const [status,setStatus]=useState('');
  const [preview,setPreview]=useState<string|null>(null);
  const [includeClose,setIncludeClose]=useState(false);
  const [confirmed,setConfirmed]=useState(false);
  const [busy,setBusy]=useState(false);
  const request=useRef<AbortController|null>(null);
  const fileInput=useRef<HTMLInputElement>(null);
  const providerInput=useRef<HTMLSelectElement>(null);
  useEffect(()=>()=>{request.current?.abort();},[]);
  useEffect(()=>()=>{if(selected?.url)URL.revokeObjectURL(selected.url);},[selected]);

  async function select(file:File|undefined) {
    if(!file)return;
    request.current?.abort();
    const controller=new AbortController();
    request.current=controller;
    setError('');setStatus('');setReview(null);setPreview(null);setSelected(null);setProgress('');setConfirmed(false);setIncludeClose(false);
    try {
      if(file.size>invoiceMaxMb*1024*1024)throw new Error('La factura supera el límite de '+invoiceMaxMb+' MB.');
      const kind=inspectInvoiceFile(new Uint8Array(await file.arrayBuffer()));
      if(!controller.signal.aborted)setSelected({file,kind,url:kind==='pdf'?null:URL.createObjectURL(new Blob([file],{type:kind==='png'?'image/png':'image/jpeg'}))});
    }catch(error){if(!controller.signal.aborted)setError(error instanceof Error?error.message:'No se pudo leer el archivo.');}
  }
  async function analyze() {
    if(!selected||progress||review)return;
    const controller=new AbortController();request.current=controller;setError('');setProgress('Preparando la lectura local…');
    const timeout=AbortSignal.timeout(120000);
    try {
      const {readInvoiceDocument}=await import('@/lib/invoice-document');
      const signal=AbortSignal.any([controller.signal,timeout]);
      const bytes=new Uint8Array(await selected.file.arrayBuffer());
      const {text,preview:page}=await new Promise<Awaited<ReturnType<typeof readInvoiceDocument>>>((resolve,reject)=>{
        signal.addEventListener('abort',()=>reject(signal.reason),{once:true});
        void readInvoiceDocument(bytes,selected.kind,signal,value=>{if(!signal.aborted)setProgress(value);}).then(resolve,reject);
      });
      if(text.trim().length<20)throw new Error('No pude leer esta factura. Probá con un PDF digital o una imagen más nítida.');
      const result=analyzeInvoice(text);
      if(!result.fields.provider&&!result.fields.providerName&&!result.fields.kwh&&!result.fields.total&&!result.charges.length)throw new Error('No encontré campos de facturación reconocibles. Probá con una imagen más nítida o completá el suministro manualmente.');
      const field=result.fields;
      const detected=providers.find(provider=>provider.id===field.provider||
        field.providerName&&provider.name.localeCompare(field.providerName,'es',{sensitivity:'base'})===0);
      if(detected)field.provider=detected.id;
      if(detected&&!detected.categories.includes(field.category))field.category='';
      if(!detected){field.provider=field.providerName?'other':'';}
      setPreview(page);setReview(result);
    }catch(error){
      if(!controller.signal.aborted)setError(timeout.aborted?'La lectura superó el tiempo disponible. Probá con una imagen más pequeña.':
        error instanceof Error&&error.name==='Error'?error.message:'No pude leer el documento. Verificá que se abra y que no tenga contraseña.');
    }finally{if(!controller.signal.aborted)setProgress('');}
  }
  function discard(){
    request.current?.abort();setSelected(null);setReview(null);setPreview(null);setProgress('');setError('');setOpen(false);
  }
  function change(field:keyof InvoiceFields,value:string) {
    setConfirmed(false);
    setReview(previous=>previous?{...previous,fields:{...previous.fields,[field]:value,
      ...(field==='provider'&&previous.fields.provider!==value?{category:'',segment:''}:{})}}:null);
  }
  const values=review?.fields;
  const provider=providers.find(item=>item.id===values?.provider);
  const compatible=provider&&values&&(!values.province||((provider.provinces??[provider.province]).includes(values.province)&&
    (!provider.locality||provider.locality.localeCompare(values.locality.trim(),'es',{sensitivity:'base'})===0)));
  const check=values&&review?invoiceChecks(values,review.charges):null;
  const tariffSegment=values?.provider==='COOPRG'&&values.category==='T1E'?'public-interest':
    values?.provider==='COOPRG'&&values.category==='T2P'?'demand':
    values?.category==='T1G'||/^G[1-3]$/.test(values?.category??'')?'general':values?.segment;
  const historical=values?.period&&versions.find(item=>item.provider===values.provider&&item.jurisdiction==='AR-'+values.province&&
    item.segment===tariffSegment&&item.effectiveFrom&&item.effectiveFrom<=values.period+'-01'&&(!item.effectiveTo||item.effectiveTo>values.period+'-01'));
  const proposed=values?([
    ['Proveedor',providers.find(item=>item.id===current.provider)?.name||current.providerName||current.provider,provider?.name||values.providerName||values.provider],
    ['Provincia',current.province,values.province],
    ['Localidad',current.locality,values.locality],
    ['Categoría',current.category,values.category||(current.provider!==values.provider?'Sin confirmar':'')],
    ['Subsidio',current.segment,values.segment||(current.provider!==values.provider?'Sin confirmar':'')],
    ['Tipo de suministro',current.supplyType,values.supplyType],
  ].filter(([,oldValue,newValue])=>newValue&&oldValue!==newValue)):[];
  async function apply(){
    if(!values||!review||review.ambiguous||!confirmed||busy)return;
    setBusy(true);setError('');
    try{
      await onApply({provider:values.provider,providerName:values.provider==='other'?values.providerName.trim():'',
        province:values.province,locality:values.locality.trim(),category:values.category,segment:values.segment,
        supplyType:values.supplyType,constructionCharge:review.charges.some(charge=>charge.name==='Luz de obra'),
        closedOn:includeClose?values.closedOn:''});
      discard();setStatus('Configuración de la factura guardada. Podés corregirla en Mi suministro.');
    }catch(error){setError(error instanceof Error?error.message:'No se pudo guardar la configuración.');}
    finally{setBusy(false);}
  }
  return <div className="mb-5 rounded-xl border border-border-soft bg-surface-raised p-4" data-unsaved={!!review}>
    <h3 className="font-semibold">Configurá tu suministro con Lumi</h3>
    <p className="mt-1 text-sm text-muted">Subí una factura de electricidad y te ayudamos a identificar tu proveedor, categoría y tarifa.</p>
    {!open&&<button type="button" className={button+' mt-3 inline-flex items-center gap-2'} onClick={()=>{setStatus('');setOpen(true);}}><ScanLine size={18} aria-hidden="true"/>Analizar mi factura con Lumi</button>}
    {status&&<p role="status" className="mt-3 text-sm text-ok">{status}</p>}
    {open&&<>
      <div className="mt-4 rounded-xl border border-dashed border-border-soft p-4" onDragOver={event=>event.preventDefault()}
        onDrop={event=>{event.preventDefault();if(!busy)void select(event.dataTransfer.files[0]);}}>
        <p className="text-sm text-muted">Arrastrá un PDF, JPG o PNG de hasta {invoiceMaxMb} MB. El documento se analiza en este navegador.</p>
        <input ref={fileInput} type="file" className="hidden" accept=".pdf,.jpg,.jpeg,.png" onChange={event=>{void select(event.target.files?.[0]);event.target.value='';}}/>
        <button type="button" disabled={busy} className="mt-3 inline-flex items-center gap-2 text-sm font-semibold text-accent underline" onClick={()=>fileInput.current?.click()}><FileUp size={16} aria-hidden="true"/>{selected?'Reemplazar archivo':'Seleccionar archivo'}</button>
      </div>
      {selected&&<div className="mt-3">
        <p className="break-all text-sm">{selected.file.name} · {(selected.file.size/1024).toFixed(0)} KB</p>
        {(preview||selected.url)&&<details className="mt-2 text-sm"><summary className="cursor-pointer">Vista previa local</summary>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={preview??selected.url!} alt="Vista previa de la factura seleccionada" className="mt-2 max-h-72 max-w-full rounded-lg object-contain"/>
        </details>}
        {!review&&<button type="button" disabled={!!progress} className={button+' mt-3'} onClick={()=>void analyze()}>Confirmar análisis</button>}
      </div>}
      {progress&&<p role="status" className="mt-3 text-sm">{progress}</p>}
      {error&&<p role="alert" className="mt-3 text-sm text-danger">{error}</p>}
      {review&&values&&<fieldset disabled={busy} className="mt-5 border-t border-border-soft pt-4">
        <legend className="sr-only">Revisar resultados de la factura</legend>
        <h4 className="font-semibold">Lumi analizó tu factura</h4>
        <p className="mt-2 text-sm text-muted">Estos datos corresponden al documento histórico. Corregí los campos detectados y completá los que falten.</p>
        {(provider||values.total||values.kwh)&&<p className="mt-2 text-sm">
          {provider&&<>Identifiqué {provider.name}{values.category?' y la categoría '+values.category:''}. </>}
          {values.kwh&&parseInvoiceNumber(values.kwh)!==null&&<>La factura registra {values.kwh} kWh. </>}
          {values.total&&parseInvoiceNumber(values.total)!==null&&<>El total informado es {formatCurrency(parseInvoiceNumber(values.total))}.</>}
        </p>}
        {review.charges.some(charge=>charge.name==='Luz de obra')&&<p className="mt-2 text-sm">Encontré luz de obra. La Cooperativa indica que puede corresponder cuando los planos de la instalación todavía no fueron aprobados.</p>}
        {review.ambiguous&&<p role="alert" className="mt-2 text-sm text-danger">Encontré indicios de más de un suministro o categoría. Seleccioná las páginas de una sola factura para aplicar datos.</p>}
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="text-sm">Proveedor<select ref={providerInput} className={input} value={values.provider} onChange={event=>change('provider',event.target.value)}>
            <option value="">No identificado</option>{providers.map(item=><option value={item.id} key={item.id}>{item.name}</option>)}<option value="other">Otro proveedor</option>
          </select></label>
          {values.provider==='other'&&<label className="text-sm">Nombre de la distribuidora<input className={input} maxLength={80} value={values.providerName} onChange={event=>change('providerName',event.target.value)}/>
            <span className="text-xs text-muted">La distribuidora se registra como pendiente de validación. Sus tarifas todavía no están cargadas.</span>
          </label>}
          <label className="text-sm">Provincia<select className={input} value={values.province} onChange={event=>change('province',event.target.value)}>
            <option value="">Confirmar provincia</option>{provinces.map(item=><option key={item}>{item}</option>)}
          </select></label>
          <label className="text-sm">Localidad<input className={input} maxLength={100} placeholder="Confirmar localidad" value={values.locality} onChange={event=>change('locality',event.target.value)}/></label>
          <label className="text-sm">Categoría<select className={input} value={values.category} onChange={event=>change('category',event.target.value)}>
            <option value="">Sin confirmar</option>{provider?.categories.map(item=><option key={item}>{item}</option>)}<option value="unknown">No sé mi categoría</option>
          </select></label>
          <label className="text-sm">Subsidio<select className={input} value={values.segment} onChange={event=>change('segment',event.target.value)}>
            <option value="">Sin confirmar</option><option value="unsubsidized">Sin subsidio</option><option value="subsidized">Con subsidio</option>
          </select></label>
          <label className="text-sm">Tipo de suministro<select className={input} value={values.supplyType} onChange={event=>change('supplyType',event.target.value)}>
            <option value="">Sin confirmar</option><option value="single-phase">Monofásico</option><option value="three-phase">Trifásico</option>
          </select></label>
          {fieldsToReview.map(([field,label,type])=><label className="text-sm" key={field}>{label}
            <input className={input} type={type} placeholder="No identificado" value={values[field]} onChange={event=>change(field,event.target.value)}/>
          </label>)}
        </div>
        {values.period&&<p className="mt-3 text-sm text-muted">{historical?<a href={historical.source} target="_blank" rel="noreferrer" className="underline">Cuadro oficial registrado para el inicio de ese mes</a>:'No pude verificar un cuadro compatible para ese mes y segmento.'}</p>}
        {review.charges.length>0&&<details className="mt-4 text-sm" open>
          <summary className="cursor-pointer font-semibold">Cargos detectados ({review.charges.length})</summary>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">{review.charges.map((charge,index)=><label key={index}>{charge.name}{charge.quantity!==undefined?' · '+charge.quantity+' kWh × '+charge.rate:''}
            <input className={input} inputMode="decimal" value={String(charge.amount).replace('.',',')} onChange={event=>{
              const amount=parseInvoiceNumber(event.target.value);
              if(amount===null)return;
              setConfirmed(false);setReview(value=>value?{...value,charges:value.charges.map((line,i)=>i===index?{...line,amount}:line)}:null);
            }}/>
          </label>)}</div>
        </details>}
        <div className="mt-3 space-y-1 text-sm text-muted">
          {check?.difference!==null&&check?.difference!==undefined&&<p>{check.difference===0?'La suma de los cargos detectados coincide con el total informado.':'Diferencia entre el total y los cargos detectados: '+formatCurrency(check.difference)+'. Puede haber conceptos por revisar.'}</p>}
          {check?.readingDifference!==null&&check?.readingDifference!==undefined&&<p>{check.readingDifference===0?'Las lecturas coinciden con el consumo indicado.':'La diferencia de lecturas no coincide con el consumo indicado.'}</p>}
        </div>
        <h5 className="mt-4 text-sm font-semibold">Cambios en Mi suministro</h5>
        <ul className="mt-2 space-y-1 text-sm text-muted">{proposed.map(([label,previous,next])=><li key={label}>{label}: {previous||'Sin configurar'} → {next}</li>)}</ul>
        {values.provider==='COOPRG'&&review.charges.some(charge=>charge.name==='Luz de obra')&&
          <p className="mt-2 text-sm text-muted">Se marcará la presencia de luz de obra. El importe de la factura queda solo en esta revisión.</p>}
        {values.closedOn&&<label className="mt-3 flex items-start gap-2 text-sm"><input type="checkbox" checked={includeClose} onChange={event=>{setIncludeClose(event.target.checked);setConfirmed(false);}}/>Actualizar el cierre del medidor al {values.closedOn}</label>}
        <label className="mt-3 flex items-start gap-2 text-sm"><input type="checkbox" checked={confirmed} onChange={event=>setConfirmed(event.target.checked)}/>Confirmo que estos datos corresponden al medidor seleccionado.</label>
        <button type="button" className={button+' mt-3'} disabled={!confirmed||review.ambiguous||!values.province||!values.locality.trim()||!values.provider||(values.provider==='other'?!values.providerName.trim():!compatible)} onClick={()=>void apply()}>
          {busy?'Guardando…':'Confirmar y configurar'}
        </button>
        <button type="button" className="ml-3 mt-3 text-sm text-accent underline" onClick={()=>providerInput.current?.focus()}>Corregir datos</button>
      </fieldset>}
      <button type="button" className="mt-3 block text-sm text-muted underline" disabled={busy} onClick={discard}>{progress?'Cancelar análisis':'Cancelar y quitar archivo'}</button>
    </>}
  </div>;
}
