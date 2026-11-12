'use client';
import Link from 'next/link';
import {meterHref,useMeterId} from '@/lib/use-meter-id';
export function ConfigureTariffLink(){const id=useMeterId();return <Link className="inline-flex text-sm text-accent underline my-3" href={meterHref('/ajustes',id)+'#proveedor-tarifa'}>Configurar tarifa</Link>;}
