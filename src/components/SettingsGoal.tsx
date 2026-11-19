'use client';

import { useCallback, useState } from 'react';
import Link from 'next/link';
import { GoalSetter } from './GoalSetter';
import { meterFetch } from '@/lib/meter-fetch';
import { meterHref, useMeterId } from '@/lib/use-meter-id';
import { usePolling } from '@/lib/use-polling';
import { isMonthlyProjection, PROJECTION_CONTRACT_ERROR } from '@/lib/projection-contract';
import type { MonthlyProjection } from '@/lib/monthly-projection';

export function SettingsGoal() {
  const deviceId=useMeterId();
  const [projection,setProjection]=useState<MonthlyProjection|null>(null);
  const [error,setError]=useState('');
  const [saved,setSaved]=useState(false);
  const refresh=useCallback(async()=>{
    try {
      const response=await meterFetch('/api/meter/forecast');
      const payload=await response.json();
      if(!response.ok)throw new Error(payload.error??'No se pudo consultar el objetivo.');
      if(!isMonthlyProjection(payload))throw new Error(PROJECTION_CONTRACT_ERROR);
      setProjection(payload);setError('');
    } catch(error) {setError(error instanceof Error?error.message:'No se pudo consultar el objetivo.');}
  },[]);
  usePolling(refresh,300000);
  return <>
    {error&&<p role="alert" className="mb-4 text-sm text-danger">{error} <button type="button" className="underline" onClick={()=>void refresh()}>Reintentar</button></p>}
    {!projection&&!error&&<p className="text-sm text-muted">Consultando el objetivo…</p>}
    {projection&&<GoalSetter key={JSON.stringify(projection.choice)} goal={projection.goal} choice={projection.choice} tariff={projection.tariff} role={projection.role}
      onSaved={()=>setSaved(true)}/>}
    {saved&&<p role="status" className="mb-4 text-sm text-ok">Objetivo actualizado.</p>}
    <div className="flex flex-wrap gap-4 text-sm text-accent underline">
      <Link href={meterHref('/proyeccion',deviceId)}>Ver proyección</Link>
      <Link href={meterHref('/ajustes/servicio',deviceId)}>Configurar cierre y tarifa</Link>
    </div>
  </>;
}
