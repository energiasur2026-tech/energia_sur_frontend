'use client';

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { supabaseBrowser } from '@/lib/supabase-browser';
import { defaultNavigation, navigationMetadataKey, type NavigationPreference } from '@/lib/navigation-preference';
import { applyTheme } from '@/lib/theme';

type SaveState = 'idle' | 'saving' | 'saved' | 'error';
type NavigationContextValue = NavigationPreference & {
  status: SaveState;
  save: (change: Partial<NavigationPreference>) => void;
  waitForSave: () => Promise<void>;
};

const NavigationContext = createContext<NavigationContextValue>({
  ...defaultNavigation,
  status: 'idle',
  save: () => {},
  waitForSave: async () => {},
});

export function NavigationPreferences({ userId, initial, children }: {
  userId: string;
  initial: NavigationPreference | null;
  children: React.ReactNode;
}) {
  const [preference, setPreference] = useState(initial ?? defaultNavigation);
  const [status, setStatus] = useState<SaveState>('idle');
  const current = useRef(preference);
  const pending = useRef(Promise.resolve());

  const legacyKey = 'energia-sur:navigation:v1:' + userId;
  const save = useCallback((change: Partial<NavigationPreference>) => {
    const next = { ...current.current, ...change };
    current.current = next;
    setPreference(next);
    setStatus('saving');

    pending.current = pending.current.then(async () => {
      try {
        const { auth } = supabaseBrowser();
        const { data } = await auth.getSession();
        if (data.session?.user.id !== userId) throw new Error('Sesión cambiada');
        const { error } = await auth.updateUser({ data: { [navigationMetadataKey]: next } });
        if (error) throw error;
        try { localStorage.removeItem(legacyKey); } catch { /* Supabase already saved it. */ }
        if (current.current === next) setStatus('saved');
      } catch {
        if (current.current === next) setStatus('error');
      }
    });
  }, [legacyKey, userId]);

  useEffect(() => {
    if (initial?.theme) applyTheme(initial.theme);
  }, [initial?.theme]);

  useEffect(() => {
    if (initial) return;
    const timer = window.setTimeout(() => {
      if (current.current !== defaultNavigation) return;
      try {
        const previous = localStorage.getItem(legacyKey);
        if (previous === 'side' || previous === 'top') save({ position: previous });
      } catch { /* Fresh accounts use the default. */ }
    }, 0);
    return () => window.clearTimeout(timer);
  }, [initial, legacyKey, save]);

  return (
    <NavigationContext.Provider value={{ ...preference, status, save, waitForSave: () => pending.current }}>
      <div className="app-shell flex flex-1 flex-col" data-navigation={preference.position} data-sidebar-collapsed={preference.collapsed}>
        {children}
      </div>
    </NavigationContext.Provider>
  );
}

export function useNavigationPreferences() { return useContext(NavigationContext); }

export function NavigationSettings() {
  const { position, collapsed, save, status } = useNavigationPreferences();
  return (
    <fieldset className="mt-5 border-t border-border-soft pt-4">
      <legend className="sr-only">Ubicación del menú</legend>
      <p className="text-sm font-semibold">Ubicación del menú</p>
      <p className="mt-1 text-xs text-muted">Configuración para escritorio. En el celular se mantiene la barra inferior.</p>
      <div className="mt-3 grid grid-cols-1 gap-3 min-[420px]:grid-cols-2">
        {(['top', 'side'] as const).map(value => (
          <label key={value} className={'relative grid cursor-pointer gap-2 rounded-xl border p-3 text-sm transition-colors hover:border-accent focus-within:outline-2 focus-within:outline-accent motion-reduce:transition-none ' +
            (position === value ? 'border-accent bg-accent-soft' : 'border-border-soft bg-surface-raised')}>
            <span aria-hidden="true" className={'flex h-12 gap-1 rounded-md border border-border-soft bg-surface p-1 ' + (value === 'top' ? 'flex-col' : '')}>
              <span className={'rounded-sm bg-accent/70 ' + (value === 'top' ? 'h-2' : 'w-4')} />
              <span className="grid flex-1 grid-cols-2 gap-1 p-1">
                <span className="rounded-sm bg-accent/15" /><span className="rounded-sm bg-accent/15" />
              </span>
            </span>
            <span className="flex items-center gap-2 font-medium">
              <input type="radio" name="desktop-navigation" className="accent-accent" checked={position === value} onChange={() => save({ position: value })} />
              {value === 'top' ? 'Superior (horizontal)' : 'Lateral izquierda (vertical)'}
            </span>
          </label>
        ))}
      </div>
      {position==='side'&&<label className="mt-4 flex items-center gap-2 text-sm">
        <input type="checkbox" className="accent-accent" checked={collapsed} onChange={event=>save({collapsed:event.target.checked})}/>
        Usar barra lateral compacta
      </label>}
      {status === 'saving' && <p role="status" className="mt-2 text-xs text-muted">Guardando preferencia…</p>}
      {status === 'saved' && <p role="status" className="mt-2 text-xs text-muted">Preferencia guardada en tu cuenta.</p>}
      {status === 'error' && <div role="status" className="mt-2 text-xs text-warn">
        La preferencia se aplicó en esta sesión. <button type="button" className="underline" onClick={() => save({})}>Reintentar guardado</button>
      </div>}
    </fieldset>
  );
}
