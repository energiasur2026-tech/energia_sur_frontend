'use client';

import { useCallback, useRef, useState, useSyncExternalStore } from 'react';
import Link from 'next/link';
import { ArrowRight, Check, Gauge, House, Layers, Link2Off, MoreHorizontal, Plus, Target, TriangleAlert, Zap } from 'lucide-react';
import { formatDateTime, formatNumber } from '@/lib/format';
import type { GoalProgress } from '@/lib/goal';
import type { HomeSummary } from '@/domain/home-types';
import { PHASE_LABEL, type MeterPhases } from '@/domain/installation-types';
import { type MeterRole } from '@/domain/meter-role';
import type { ApiErrorPayload } from '@/lib/types';
import { meterHref } from '@/lib/use-meter-id';
import { DeviceArt, deviceKinds, type DeviceKind } from './DeviceArt';
import { groupDevices, readAssignments, readingStatus } from '@/lib/device-inventory';
import { usePolling } from '@/lib/use-polling';
import { InfoTooltip } from './InfoTooltip';
import { LinkMeterForm, type LinkResult } from './LinkMeterForm';
import { SetupNotice } from './SetupNotice';
import { UnlinkMeterDialog } from './UnlinkMeterDialog';

/** Panorama, no tablero en vivo: alcanza con refrescar cada minuto. */
const POLL_INTERVAL_MS = 60000;

type MeterSummary = {
  deviceId: string;
  name: string;
  latest: { recordedAt: string; voltage: number | null; powerW: number | null } | null;
  activeEvents: number;
  collectionIntervalMinutes?:number;
  syncError?:boolean;
  goal: GoalProgress;
  home: HomeSummary;
  role: MeterRole;
  /** Dónde está instalado, si es de área. `null` en un central. */
  areaLabel: string | null;
  phases: MeterPhases;
  /**
   * Si esta cuenta vinculó el medidor o es una invitada.
   *
   * Manda sobre la acción de desvincular: una cuenta invitada que la viera
   * terminaría en un 403. Es preferible no ofrecer lo que no se puede hacer.
   */
  isOwner: boolean;
};

const assignmentEvent='energia:inventory-assignment';
const primary='inline-flex items-center justify-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-white hover:bg-accent/85 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent';
function subscribeAssignments(onChange:()=>void) {
  window.addEventListener('storage',onChange);
  window.addEventListener(assignmentEvent,onChange);
  return ()=>{window.removeEventListener('storage',onChange);window.removeEventListener(assignmentEvent,onChange);};
}
const emptyAssignments=()=> '{}';
const physicalKinds={general:'Medidor de tablero',circuit:'Submedidor',plug:'Enchufe inteligente'} as const;
function storedInventory(key:string) {
  try{return localStorage.getItem(key)??'{}';}catch{return '{}';}
}

export function MetersView({userId}:{userId:string}) {
  const assignmentKey='energia:device-places:v1:'+userId;
  const kindKey='energia:device-hardware:v1:'+userId;
  const raw=useSyncExternalStore(subscribeAssignments,()=>storedInventory(assignmentKey),emptyAssignments);
  const rawKinds=useSyncExternalStore(subscribeAssignments,()=>storedInventory(kindKey),emptyAssignments);
  const assignments=readAssignments(raw);
  const assignedKinds=readAssignments(rawKinds);
  const [filter,setFilter]=useState('all');
  const [linkOpen,setLinkOpen]=useState(false);
  const wizardRef=useRef<HTMLDivElement>(null);
  const [assignmentError,setAssignmentError]=useState('');
  const [renamingPlace,setRenamingPlace]=useState<string|null>(null);
  const [place,setPlace]=useState('');
  const [hardware,setHardware]=useState('');
  function assign(deviceId:string,group:string,key=assignmentKey) {
    try {
      const next=readAssignments(localStorage.getItem(key)??'{}');
      if(group.trim())Object.defineProperty(next,deviceId,{value:group.trim(),enumerable:true,configurable:true,writable:true});
      else delete next[deviceId];
      localStorage.setItem(key,JSON.stringify(next));
      window.dispatchEvent(new Event(assignmentEvent));
      setAssignmentError('');
      return true;
    } catch {
      setAssignmentError('No pudimos guardar la organización del dispositivo en este navegador.');
      return false;
    }
  }
  function openWizard() {
    setLinkOpen(true);
    requestAnimationFrame(()=>wizardRef.current?.focus());
  }

  const [meters, setMeters] = useState<MeterSummary[] | null>(null);
  const [error, setError] = useState<ApiErrorPayload | null>(null);
  /** El medidor cuya baja se está confirmando. */
  const [unlinking, setUnlinking] = useState<MeterSummary | null>(null);
  const [unlinked, setUnlinked] = useState<{ name: string; readings: number } | null>(null);
  /**
   * El resultado del último alta.
   *
   * Vive acá y no en el formulario porque vincular el primer medidor cambia
   * la lista y vuelve a montar el formulario: el aviso duraba dos segundos.
   */
  const [linked, setLinked] = useState<LinkResult | null>(null);

  const fetchMeters = useCallback(async () => {
    try {
      const response = await fetch('/api/meters', { cache: 'no-store' });
      const payload = await response.json();

      if (!response.ok) {
        setError(payload as ApiErrorPayload);
        return;
      }

      setMeters(payload.meters as MeterSummary[]);
      setError(null);
    } catch {
      setError({ error: 'No se pudo contactar al servidor.' });
    }
  }, []);

  usePolling(fetchMeters, POLL_INTERVAL_MS);

  async function unlink(meter: MeterSummary) {
    try {
      const response = await fetch(
        `/api/meters?deviceId=${encodeURIComponent(meter.deviceId)}`,
        { method: 'DELETE' }
      );
      const payload = await response.json();

      if (!response.ok) {
        setError(payload as ApiErrorPayload);
        return;
      }

      setUnlinked({ name: meter.name, readings: Number(payload.keptReadings ?? 0) });
      setLinked(null);
      setError(null);
      await fetchMeters();
    } catch {
      setError({ error: 'No se pudo contactar al servidor.' });
    } finally {
      setUnlinking(null);
    }
  }

  if (error?.missingEnv) return <SetupNotice missing={error.missingEnv} />;

  const groups=groupDevices(meters??[],assignments);
  const supplies=groups.flatMap(group=>group.name?[group.name]:[]);
  const visibleGroups=filter==='all'||!groups.some(group=>'supply:'+group.id===filter)?groups:groups.filter(group=>'supply:'+group.id===filter);
  return (
    <div className="mx-auto w-full min-w-0 max-w-7xl flex-1 p-4 md:p-6 lg:p-8">
      <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Mis dispositivos</h1>
          <p className="mt-1 text-sm text-muted">Administrá tus medidores y conocé qué está consumiendo energía.</p>
        </div>
        <button type="button" onClick={openWizard} className={primary}><Plus size={17} aria-hidden="true"/>Vincular dispositivo</button>
      </header>

      {assignmentError&&<p role="alert" className="mb-4 text-sm text-danger">{assignmentError}</p>}
      {linkOpen&&<div ref={wizardRef} tabIndex={-1}>
        <LinkMeterForm supplies={supplies} onClose={()=>setLinkOpen(false)} onLinked={result=>{
          if(result.supply)assign(result.deviceId,result.supply);
          setLinked(result);setUnlinked(null);setLinkOpen(false);setFilter('all');void fetchMeters();
        }}/>
      </div>}

      {error && !error.missingEnv && (
        <p className="mb-6 rounded-xl border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
          {error.error}
        </p>
      )}

      {linked && (
        <div className="mb-6 flex items-start gap-2.5 rounded-xl border border-ok/40 bg-ok/5 px-4 py-3 animate-fade-in">
          <Check className="h-4 w-4 mt-0.5 shrink-0 text-ok" />
          <p className="text-xs text-muted leading-relaxed">
            Vinculamos <b className="text-foreground">{linked.name}</b>.{' '}
            {linked.existingReadings > 0 ? (
              <>
                Encontramos{' '}
                <b className="text-foreground">
                  {linked.existingReadings.toLocaleString('es-AR')} mediciones anteriores
                </b>{' '}
                de este medidor: ya tenés su historial completo, sin esperar a juntar
                datos nuevos.
              </>
            ) : (
              <>
                Todavía no tiene mediciones: van a empezar a aparecer en los próximos
                minutos.
              </>
            )}
          </p>
          <button
            type="button"
            onClick={() => setLinked(null)}
            aria-label="Cerrar aviso"
            className="ml-auto shrink-0 text-muted transition-colors hover:text-foreground"
          >
            ×
          </button>
        </div>
      )}

      {unlinked && (
        <div className="mb-6 flex items-start gap-2.5 rounded-xl border border-border-soft bg-surface px-4 py-3 animate-fade-in">
          <Link2Off className="h-4 w-4 mt-0.5 shrink-0 text-muted" />
          <p className="text-xs text-muted leading-relaxed">
            Desvinculamos <b className="text-foreground">{unlinked.name}</b>. Sus{' '}
            <b className="text-foreground">
              {unlinked.readings.toLocaleString('es-AR')} mediciones
            </b>{' '}
            quedaron guardadas: si lo volvés a vincular, las recuperás.
          </p>
          <button
            type="button"
            onClick={() => setUnlinked(null)}
            aria-label="Cerrar aviso"
            className="ml-auto shrink-0 text-muted transition-colors hover:text-foreground"
          >
            ×
          </button>
        </div>
      )}

      {!meters&&!error&&<p role="status" className="py-12 text-center text-sm text-muted">Consultando tus dispositivos…</p>}
      {error&&!meters&&<button type="button" onClick={()=>void fetchMeters()} className="text-sm text-accent underline">Reintentar</button>}

      {meters?.length===0&&!linkOpen&&<section className="rounded-2xl border border-border-soft bg-surface p-8 text-center">
        <DeviceArt kind="general" className="mx-auto h-32 w-52 max-w-full" decorative/>
        <h2 className="mt-3 text-lg font-semibold">Empezá a conocer tu consumo eléctrico</h2>
        <p className="mt-2 text-sm text-muted">Vinculá tu primer dispositivo para comenzar a monitorear tu energía.</p>
        <button type="button" className={primary+' mt-4'} onClick={openWizard}>Vincular mi primer dispositivo</button>
      </section>}

      {groups.length>1&&<label className="mb-5 flex flex-wrap items-center gap-3 text-sm font-semibold">Suministro
        <select value={visibleGroups===groups?'all':filter} onChange={event=>setFilter(event.target.value)} className="max-w-full rounded-xl border border-border-soft bg-surface px-3 py-2 text-sm">
          <option value="all">Todos los suministros</option>
          {groups.map(group=><option value={'supply:'+group.id} key={group.id}>{group.name||'Sin suministro asignado'}</option>)}
        </select>
      </label>}

      <div className="space-y-7">
        {visibleGroups.map(group=><section key={group.id} aria-label={group.name||'Sin suministro asignado'}>
          <div className="mb-3 flex items-center gap-3">
            <House size={18} className="text-accent" aria-hidden="true"/>
            <h2 className="min-w-0 break-words text-lg font-semibold">{group.name||'Sin suministro asignado'}</h2>
          </div>
          <p className="mb-4 text-xs text-muted">{group.name
            ? group.meters.filter(meter=>meter.role==='central').length===1
              ? 'El medidor general representa el total de la instalación. Los circuitos muestran su propio consumo.'
              : 'Cada dispositivo muestra su medición. El total del suministro requiere un medidor general confirmado.'
            :'Asigná un suministro desde el menú de cada dispositivo.'}</p>
          <div className="device-inventory-grid grid gap-4">
            {group.meters.map(meter=><MeterCard key={meter.deviceId} meter={meter} supply={group.name}
              hardware={Object.hasOwn(physicalKinds,assignedKinds[meter.deviceId])?assignedKinds[meter.deviceId] as DeviceKind:undefined}
              onUnlink={()=>setUnlinking(meter)} onGroup={()=>{setPlace(group.name);setHardware(assignedKinds[meter.deviceId]??'');setRenamingPlace(meter.deviceId);}}>
              {renamingPlace===meter.deviceId&&<form className="mt-3" onSubmit={event=>{
                event.preventDefault();
                if(assign(meter.deviceId,place)&&assign(meter.deviceId,hardware,kindKey)){setRenamingPlace(null);setFilter('all');}
              }}>
                <label className="block text-sm">Suministro o lugar<input value={place} onChange={event=>setPlace(event.target.value)}
                  maxLength={60} className="mt-1 block w-full rounded-lg border border-border-soft bg-surface-raised p-2"/></label>
                <label className="mt-2 block text-sm">Tipo físico<select value={hardware} onChange={event=>setHardware(event.target.value)} className="mt-1 block w-full rounded-lg border border-border-soft bg-surface-raised p-2">
                  <option value="">Sin confirmar</option>{Object.entries(physicalKinds).map(([key,label])=><option key={key} value={key}>{label}</option>)}
                </select></label>
                <p className="mt-1 text-xs text-muted">La función de medición se cambia en Ajustes del dispositivo.</p>
                <div className="mt-2 flex flex-wrap gap-3 text-sm">
                  <button className="font-semibold text-accent" type="submit">Guardar organización</button>
                  <button className="text-muted" type="button" onClick={()=>setRenamingPlace(null)}>Cancelar</button>
                </div>
              </form>}
            </MeterCard>)}
          </div>
          {group.name&&group.meters.length===1&&group.meters[0].role==='central'&&
            <p className="mt-4 text-sm text-muted"><b>¿Querés conocer qué consume cada sector?</b> Agregá un medidor de circuito para ver el consumo de un sector.</p>}
        </section>)}
      </div>

      <UnlinkMeterDialog
        open={unlinking !== null}
        meterName={unlinking?.name ?? ''}
        onCancel={() => setUnlinking(null)}
        onConfirm={() => (unlinking ? unlink(unlinking) : Promise.resolve())}
      />
    </div>
  );
}

function MeterCard({meter,supply,hardware,onUnlink,onGroup,children}:{
  meter:MeterSummary;supply:string;hardware?:DeviceKind;onUnlink:()=>void;onGroup:()=>void;children:React.ReactNode;
}) {
  const kind=meter.role==='central'?'general':'circuit';
  const [connection,setConnection]=useState<{online:boolean|null;checkedAt:string}|null>(null);
  const [checking,setChecking]=useState(false);
  const [connectionError,setConnectionError]=useState('');
  async function checkConnection() {
    setChecking(true);setConnectionError('');
    try{
      const response=await fetch(meterHref('/api/meter/connection',meter.deviceId),{cache:'no-store'});
      const payload=await response.json();
      if(!response.ok)throw new Error(payload.error);
      setConnection({online:typeof payload.online==='boolean'?payload.online:null,checkedAt:new Date().toISOString()});
    }catch{setConnection(null);setConnectionError('No pudimos comprobar la conexión con Tuya.');}
    finally{setChecking(false);}
  }
  const offline=connection?.online===false&&(!meter.latest||Date.parse(meter.latest.recordedAt)<=Date.parse(connection.checkedAt));
  const status=offline?{label:'Sin conexión al consultar',tone:'warn'} as const
    :readingStatus(meter.latest,meter.collectionIntervalMinutes,meter.syncError);
  const tone={danger:'text-danger',warn:'text-warn',ok:'text-ok',muted:'text-muted'}[status.tone];
  const goal=goalSummary(meter.goal);
  const details=useRef<HTMLDetailsElement>(null);
  const settings=meterHref('/ajustes/dispositivos',meter.deviceId);
  const action='block w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-surface-raised focus-visible:outline-2 focus-visible:outline-accent';
  return <article className="flex min-w-0 flex-col rounded-2xl border border-border-soft bg-surface p-4">
    <div className="relative flex min-h-24 items-center justify-center rounded-xl bg-surface-raised">
      <DeviceArt kind={hardware??kind} className="h-24 w-40 max-w-full"/>
      <details className="absolute right-2 top-2 z-10">
        <summary className="grid size-9 cursor-pointer list-none place-items-center rounded-lg border border-border-soft bg-surface focus-visible:outline-2 focus-visible:outline-accent" aria-label={'Acciones de '+meter.name}>
          <MoreHorizontal size={19} aria-hidden="true"/>
        </summary>
        <div className="absolute right-0 mt-1 w-48 rounded-xl border border-border-soft bg-surface p-1 shadow-lg">
          {meter.isOwner&&<Link href={settings+'#nombre-dispositivo'} className={action}>Editar nombre</Link>}
          <Link href={settings+'#ubicacion-dispositivo'} className={action}>Cambiar ubicación</Link>
          <button type="button" onClick={event=>{event.currentTarget.closest('details')?.removeAttribute('open');onGroup();}} className={action}>Cambiar suministro o tipo físico</button>
          <button type="button" onClick={event=>{
            event.currentTarget.closest('details')?.removeAttribute('open');
            if(details.current){details.current.open=true;details.current.querySelector('summary')?.focus();}
          }} className={action}>Ver detalles</button>
          <Link href={settings} className={action}>Administrar configuración</Link>
          {meter.isOwner&&<button type="button" onClick={event=>{event.currentTarget.closest('details')?.removeAttribute('open');onUnlink();}} className={action+' text-danger'}>Desvincular</button>}
        </div>
      </details>
    </div>
    <div className="mt-3">
      <p className="text-xs font-semibold text-accent">{deviceKinds[kind].label}</p>
      <h3 className="mt-1 break-words text-base font-bold">{meter.name}</h3>
      {hardware&&<p className="mt-1 text-xs text-muted">Equipo: {physicalKinds[hardware]}</p>}
      <p className="mt-1 break-words text-xs text-muted">{[supply,meter.areaLabel||(meter.role==='central'?'Tablero general':'Sector sin indicar')].filter(Boolean).join(' · ')}</p>
      <p className={'mt-3 flex items-center gap-2 text-xs font-semibold '+tone}><span aria-hidden="true" className="size-2 rounded-full bg-current"/>{status.label}</p>
      {meter.latest&&<p className="mt-1 text-xs text-muted">Última lectura: {formatDateTime(meter.latest.recordedAt)}</p>}
    </div>
    {meter.latest&&(meter.latest.voltage!=null||meter.latest.powerW!=null)&&<dl className="mt-3 grid grid-cols-2 gap-2">
      {meter.latest.voltage!=null&&<Stat icon={<Zap size={13}/>} label="Tensión" value={formatNumber(meter.latest.voltage,1)+' V'}/>}
      {meter.latest.powerW!=null&&<Stat icon={<Gauge size={13}/>} label="Potencia" value={formatNumber(meter.latest.powerW,0)+' W'}/>}
    </dl>}
    {children}
    <details ref={details} className="mb-4 mt-3 text-sm">
      <summary className="cursor-pointer text-muted focus-visible:outline-2 focus-visible:outline-accent">Ver detalles</summary>
      <p className="mt-2 text-xs text-muted">Función: {deviceKinds[kind].label} · {PHASE_LABEL[meter.phases]}. {deviceKinds[kind].description}</p>
      <button type="button" onClick={()=>void checkConnection()} disabled={checking} className="mt-2 text-xs font-semibold text-accent underline disabled:opacity-50">
        {checking?'Consultando conexión…':'Comprobar conexión con Tuya'}
      </button>
      <p role="status" className="mt-1 text-xs text-muted">{connectionError||
        (connection?(connection.online===null?'Tuya no informó el estado':connection.online?'En línea al consultar':'Sin conexión al consultar')+' · '+formatDateTime(connection.checkedAt):'')}</p>
      <div className="my-3 space-y-2">
        <Row icon={<Target size={14}/>} label="Objetivo" value={goal.text} tone={goal.tone} tip="Avance frente al objetivo del mes."/>
        <Row icon={<TriangleAlert size={14}/>} label="Anomalías" value={meter.activeEvents===0?'Ninguna en curso':meter.activeEvents+' en curso'}
          tone={meter.activeEvents===0?'ok':'danger'} tip="Alertas que siguen activas para este dispositivo."/>
      </div>
      <HomeStatus home={meter.home} deviceId={meter.deviceId}/>
    </details>
    <Link href={meterHref('/dashboard',meter.deviceId)} className={primary+' mt-auto'}>Ver monitor <ArrowRight size={16} aria-hidden="true"/></Link>
  </article>;
}

/**
 * Estado del contexto del hogar, con su acceso para cargarlo o editarlo.
 *
 * Sin contexto cargado el recuadro es punteado y el enlace se destaca: es la
 * unica accion pendiente de la tarjeta. Una vez cargado pasa a ser un dato mas
 * —cuantos ambientes y aparatos hay— y el enlace baja a secundario, porque ya
 * no hay nada que reclamarle al usuario.
 */
function HomeStatus({ home, deviceId }: { home: HomeSummary; deviceId: string }) {
  return (
    <div className="mb-4 space-y-2">
      <div
        className={`flex items-center gap-2.5 rounded-xl px-3 py-2.5 ${
          home.configured
            ? 'bg-accent-soft'
            : 'border border-dashed border-border-soft'
        }`}
      >
        <span className={`shrink-0 ${home.configured ? 'text-accent' : 'text-muted'}`}>
          {home.configured ? <Layers className="h-4 w-4" /> : <House className="h-4 w-4" />}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold leading-tight">
            {home.configured ? 'Contexto del lugar cargado' : 'Sin contexto cargado'}
          </p>
          <p className={`text-[11px] leading-tight ${home.configured ? 'text-accent' : 'text-muted'}`}>
            {home.configured
              ? `${home.rooms} ${home.rooms === 1 ? 'lugar' : 'lugares'} · ${home.appliances} ${
                  home.appliances === 1 ? 'aparato' : 'aparatos'
                }`
              : 'Mejora tus recomendaciones y predicciones'}
          </p>
        </div>
      </div>

      {/* Contorneado y no solido: la accion principal de la tarjeta es "Ir a mi
          medidor", que ya es un boton lleno. Dos botones llenos del mismo color
          compiten entre si y ninguno de los dos termina destacando. */}
      <Link
        href={meterHref('/medidores/hogar', deviceId)}
        className={`inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors ${
          home.configured
            ? 'bg-surface-raised text-muted hover:text-foreground'
            : 'border border-accent text-accent hover:bg-accent-soft'
        }`}
      >
        {home.configured ? <Layers className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
        {home.configured ? 'Editar lo que hay en el lugar' : 'Cargar lo que hay en el lugar'}
      </Link>
    </div>
  );
}

function goalSummary(goal: GoalProgress): { text: string; tone: 'default' | 'ok' | 'warn' | 'danger' } {
  switch (goal.status) {
    case 'no_goal':
      return { text: 'Sin objetivo definido', tone: 'default' };
    case 'no_data':
      return { text: 'Esperando lecturas', tone: 'default' };
    case 'on_track':
      return { text: `Vas bien · ${formatNumber(goal.projectedMonthKwh, 0)} de ${formatNumber(goal.goalKwh, 0)} kWh`, tone: 'ok' };
    case 'at_risk':
      return { text: `Al límite · ${formatNumber(goal.projectedMonthKwh, 0)} de ${formatNumber(goal.goalKwh, 0)} kWh`, tone: 'warn' };
    case 'over':
      return { text: `Te estás pasando · ${formatNumber(goal.projectedMonthKwh, 0)} de ${formatNumber(goal.goalKwh, 0)} kWh`, tone: 'danger' };
  }
}

const TONE_TEXT = {
  default: 'text-muted',
  ok: 'text-ok',
  warn: 'text-warn',
  danger: 'text-danger',
} as const;

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-xl bg-surface-raised px-3 py-2.5">
      <dt className="flex items-center gap-1.5 text-[11px] text-muted mb-0.5">
        <span className="text-accent">{icon}</span>
        {label}
      </dt>
      <dd className="text-lg font-bold tabular-nums tracking-tight">{value}</dd>
    </div>
  );
}

function Row({
  icon,
  label,
  value,
  tone,
  tip,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  tone: 'default' | 'ok' | 'warn' | 'danger';
  tip: string;
}) {
  return (
    <div className="flex items-center justify-between gap-2 text-xs">
      <span className="flex items-center gap-1.5 text-muted">
        <span className={TONE_TEXT[tone]}>{icon}</span>
        {label}
        <InfoTooltip text={tip} title={label} />
      </span>
      <span className={`font-medium text-right ${TONE_TEXT[tone]}`}>{value}</span>
    </div>
  );
}
