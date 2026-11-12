'use client';
import {useCallback,useState} from 'react';
import {usePathname} from 'next/navigation';
import {meterFetch} from '@/lib/meter-fetch';
import {usePolling} from '@/lib/use-polling';
export function SelectedMeterName(){const path=usePathname();const [name,setName]=useState('');const load=useCallback(()=>{void meterFetch('/api/meter/settings').then(r=>r.ok?r.json():null).then(data=>{if(data)setName(data.name);}).catch(()=>{});},[]);usePolling(load,300000);if(path==='/medidores'||!name)return null;return <p className="max-w-6xl w-full mx-auto px-4 md:px-8 pt-3 text-xs text-muted">Medidor: {name}</p>;}
