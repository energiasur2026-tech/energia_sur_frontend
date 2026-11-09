import { notFound } from 'next/navigation';
import { ForecastView } from '@/components/ForecastView';
import fixture from './fixture.json';
import type { MonthlyProjection } from '@/lib/monthly-projection';
export default function Page(){if(process.env.NODE_ENV!=='development')notFound();return <><div className="px-4 py-3 text-xs font-semibold bg-accent-soft text-accent text-center">VISTA PREVIA · Mediciones controladas · Edición y guardado deshabilitados · No usa datos de producción</div><ForecastView preview={fixture as MonthlyProjection}/></>;}
