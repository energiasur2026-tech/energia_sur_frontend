'use client';

import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import Image from 'next/image';
import { X } from 'lucide-react';

const STORAGE_KEY = 'energia-sur-welcome-oculto';

function readHidden() {
  try { return localStorage.getItem(STORAGE_KEY) === '1'; }
  catch { return false; }
}

function subscribe(onChange: () => void) {
  window.addEventListener('storage', onChange);
  return () => window.removeEventListener('storage', onChange);
}

export function WelcomeDialog() {
  const hidden = useSyncExternalStore(subscribe, readHidden, () => true);
  const [dismissed, setDismissed] = useState(false);
  const [remember, setRemember] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const open = !hidden && !dismissed;

  useEffect(() => {
    const element = dialog.current;
    if (!open || !element) return;
    element.showModal();
    return () => { if (element.open) element.close(); };
  }, [open]);

  function dismiss() {
    if (remember) {
      try { localStorage.setItem(STORAGE_KEY, '1'); }
      catch { /* Private browsing can block persistent storage. */ }
    }
    setDismissed(true);
  }

  if (!open) return null;

  return (
    <dialog ref={dialog} aria-labelledby="welcome-title" aria-describedby="welcome-description"
      onCancel={event => { event.preventDefault(); dismiss(); }}
      className="m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-sm overflow-y-auto rounded-3xl border border-border-soft bg-surface p-5 text-center text-foreground shadow-2xl backdrop:bg-background/65 backdrop:backdrop-blur-sm sm:p-6">
      <button type="button" aria-label="Cerrar bienvenida" onClick={dismiss}
        className="absolute right-3 top-3 grid size-10 place-items-center rounded-xl text-muted hover:bg-surface-raised hover:text-foreground focus-visible:outline-2 focus-visible:outline-accent">
        <X size={19} aria-hidden="true"/>
      </button>
      <Image src="/assets/lumi/lumi-greeting.png" width={480} height={520} alt="Lumi saludando"
        unoptimized className="mx-auto h-[min(10rem,32dvh)] w-auto object-contain"/>
      <h2 id="welcome-title" className="mt-3 text-lg font-bold tracking-tight">¡Bienvenido a EnergIA Sur!</h2>
      <p id="welcome-description" className="mt-2 text-sm leading-relaxed text-muted">
        ¡Hola! Soy Lumi, tu asistente inteligente. Estoy acá para ayudarte a entender tu consumo eléctrico,
        tus gastos y aprovechar mejor la energía.
      </p>
      <button type="button" onClick={dismiss}
        className="mt-4 w-full rounded-xl bg-accent px-4 py-3 text-sm font-semibold text-white hover:bg-accent/85 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">
        ¡Empecemos!
      </button>
      <label className="mt-2 flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-xl px-2 text-xs text-muted hover:text-foreground">
        <input type="checkbox" checked={remember} onChange={event=>setRemember(event.target.checked)}
          className="size-4 shrink-0 accent-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"/>
        No mostrar esta bienvenida nuevamente.
      </label>
    </dialog>
  );
}
