'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useSyncExternalStore } from 'react';
import { ArrowLeft, Bell, ChevronRight, Gauge, Palette, Receipt, TrendingUp, UserRound } from 'lucide-react';
import { meterHref, useMeterId } from '@/lib/use-meter-id';
import { SettingsView } from './SettingsView';
import type { SettingsCategory } from '@/lib/settings-categories';
import { confirmDiscardSettingsDraft, hasSettingsDraft } from '@/lib/settings-draft';

const categories = [
  { id:'apariencia', label:'Apariencia y navegación', description:'Tema y disposición del menú', icon:Palette },
  { id:'dispositivos', label:'Mis dispositivos', description:'Medidores, ubicación y configuración del equipo', icon:Gauge },
  { id:'servicio', label:'Servicio eléctrico y tarifas', description:'Distribuidora, tarifa y cierre de factura', icon:Receipt },
  { id:'objetivos', label:'Objetivos y consumo', description:'Meta mensual en kWh o pesos', icon:TrendingUp },
  { id:'lumi', label:'Lumi y notificaciones', description:'Conversación, avisos y alertas', icon:Bell },
  { id:'mis-datos', label:'Mis datos y seguridad', description:'Perfil, contacto y contraseña', icon:UserRound },
] as const;

function subscribeHash(onChange:()=>void) {
  window.addEventListener('hashchange',onChange);
  return ()=>window.removeEventListener('hashchange',onChange);
}
function legacyCategory(): SettingsCategory | null {
  if (location.hash==='#proveedor-tarifa') return 'servicio';
  if (location.hash==='#cuenta') return 'mis-datos';
  return null;
}
const getServerCategory=()=>null;

export function SettingsHub({ category }: {category?:SettingsCategory}) {
  const deviceId=useMeterId();
  const router=useRouter();
  const legacy=useSyncExternalStore(subscribeHash,legacyCategory,getServerCategory);
  const active=categories.find(item=>item.id===(category??legacy));

  useEffect(()=>{
    if(!category&&legacy)router.replace(meterHref('/ajustes/'+legacy,deviceId),{scroll:false});
  },[category,deviceId,legacy,router]);

  useEffect(()=>{
    const beforeUnload=(event:BeforeUnloadEvent)=>{
      if(hasSettingsDraft()){event.preventDefault();event.returnValue='';}
    };
    const click=(event:MouseEvent)=>{
      if(event.defaultPrevented||event.button!==0||event.metaKey||event.ctrlKey||event.altKey||event.shiftKey)return;
      const link=event.target instanceof Element?event.target.closest('a[href]'):null;
      if(!(link instanceof HTMLAnchorElement)||link.target||link.hasAttribute('download')||link.href===location.href)return;
      if(!confirmDiscardSettingsDraft()){
        event.preventDefault();
        event.stopPropagation();
      }
    };
    document.addEventListener('click',click,true);
    window.addEventListener('beforeunload',beforeUnload);
    return ()=>{
      document.removeEventListener('click',click,true);
      window.removeEventListener('beforeunload',beforeUnload);
    };
  },[]);

  return <div className="mx-auto w-full min-w-0 max-w-7xl p-4 md:p-6 xl:p-8">
    <header className="mb-5">
      <h1 className="text-2xl font-bold tracking-tight">Ajustes</h1>
      <p className="mt-1 text-sm text-muted">Administrá tu cuenta, tus medidores y la aplicación.</p>
    </header>
    <div className={active?'grid min-w-0 gap-5 xl:grid-cols-[14rem_minmax(0,1fr)]':'grid min-w-0 gap-5'}>
      <nav aria-label="Categorías de ajustes" className={active?'hidden xl:block':''}>
        <ul className={active?'space-y-1':'grid gap-3 sm:grid-cols-2 xl:grid-cols-3'}>
          {categories.map(({id,label,description,icon:Icon})=><li key={id}>
            <Link href={meterHref('/ajustes/'+id,deviceId)} aria-current={active?.id===id?'page':undefined}
              className={'flex items-center gap-3 rounded-xl border p-3 text-sm font-semibold transition-colors hover:border-accent focus-visible:outline-2 focus-visible:outline-accent '+(active?.id===id?'border-accent bg-accent-soft text-accent':'border-border-soft bg-surface')}>
              <Icon size={17} aria-hidden="true" className="shrink-0 text-accent"/>
              <span className="min-w-0 flex-1">{label}{!active&&<span className="mt-1 block text-xs font-normal text-muted">{description}</span>}</span>
              {!active&&<ChevronRight size={15} aria-hidden="true" className="shrink-0 text-muted"/>}
            </Link>
          </li>)}
        </ul>
      </nav>
      {active&&<div data-settings-panel className="min-w-0">
        <Link href={meterHref('/ajustes',deviceId)} className="mb-4 inline-flex items-center gap-2 text-sm text-accent focus-visible:outline-2 focus-visible:outline-accent xl:hidden">
          <ArrowLeft size={16} aria-hidden="true"/>Todas las categorías
        </Link>
        <h2 className="mb-4 text-lg font-semibold">{active.label}</h2>
        <SettingsView key={active.id+':'+(deviceId??'default')} category={active.id}/>
      </div>}
    </div>
  </div>;
}
