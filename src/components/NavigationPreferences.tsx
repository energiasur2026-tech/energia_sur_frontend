'use client';

import { createContext, useContext, useEffect, useState } from 'react';

type Position = 'top' | 'side';
const NavigationContext = createContext<{ position: Position; save: (value: Position) => void; error: string }>({ position: 'top', save: () => {}, error: '' });

export function NavigationPreferences({ userId, children }: { userId: string; children: React.ReactNode }) {
  const [position, setPosition] = useState<Position>('top');
  const [error, setError] = useState('');
  const key = `energia-sur:navigation:v1:${userId}`;
  useEffect(() => {
    const sync = () => {
      try { setPosition(localStorage.getItem(key) === 'side' ? 'side' : 'top'); }
      catch { setError('El navegador no permite guardar esta preferencia.'); }
    };
    const timer = setTimeout(sync, 0);
    window.addEventListener('storage', sync);
    return () => { clearTimeout(timer); window.removeEventListener('storage', sync); };
  }, [key]);
  function save(value: Position) {
    setPosition(value);
    try { localStorage.setItem(key, value); setError(''); }
    catch { setError('La posición se aplicó, pero no pudo guardarse para la próxima visita.'); }
  }
  return <NavigationContext.Provider value={{ position, save, error }}><div className="app-shell flex flex-1 flex-col" data-navigation={position}>{children}</div></NavigationContext.Provider>;
}

export function useNavigationPreferences() { return useContext(NavigationContext); }

export function NavigationSettings() {
  const { position, save, error } = useNavigationPreferences();
  return <section className="rounded-2xl border border-border-soft bg-surface p-5 mb-6">
    <h2 className="text-sm font-semibold">Posición de la barra de navegación</h2>
    <p className="text-xs text-muted mt-2 mb-4">Elegí cómo navegar en escritorio. En el celular se mantiene la barra inferior. Se guarda para tu usuario en este navegador.</p>
    <div role="group" aria-label="Posición de la barra" className="flex gap-2">
      {(['top', 'side'] as const).map(value => <button key={value} type="button" aria-pressed={position === value} onClick={() => save(value)} className={'rounded-xl border px-4 py-3 text-sm focus-visible:outline-2 focus-visible:outline-accent ' + (position === value ? 'border-accent bg-accent-soft text-accent' : 'border-border-soft')}>{value === 'top' ? 'Superior' : 'Lateral'}</button>)}
    </div>
    {error && <p role="status" className="text-xs text-warn mt-3">{error}</p>}
  </section>;
}
