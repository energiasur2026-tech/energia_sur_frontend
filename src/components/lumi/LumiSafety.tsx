'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { usePathname } from 'next/navigation';
import { useMeterId, apiUrl } from '@/lib/use-meter-id';
import { usePolling } from '@/lib/use-polling';
import { SAFETY_CONFIG, SAFETY_TIPS, nextSafety, readSafety, safetyKey } from './safety-policy';
import styles from './safety.module.css';

export const OPEN_SAFETY = 'lumi:open-safety';
export function LumiSafety({ userId, blocked, onOpenChange }: { userId: string; blocked: boolean; onOpenChange?: (opened: boolean) => void }) {
  const pathname = usePathname();
  const meterId = useMeterId();
  const [critical, setCritical] = useState(false);
  const refreshCritical = useCallback(async () => {
    try {
      const response = await fetch(apiUrl('/api/meter/events', meterId), { cache: 'no-store' });
      if (!response.ok) return;
      const payload = await response.json();
      setCritical(Array.isArray(payload.events) && payload.events.some((event: { endedAt: string | null; severity: string }) => event.endedAt === null && event.severity === 'CRITICAL'));
    } catch { /* Educational content does not depend on this service. */ }
  }, [meterId]);
  usePolling(refreshCritical, 60000);
  const [notice, setNotice] = useState<(typeof SAFETY_TIPS)[number] | null>(null);
  const [opened, setOpened] = useState(false);
  const [enabled, setEnabled] = useState(true);
  const [selected, setSelected] = useState<string>(SAFETY_TIPS[0].id);
  const [preferencesOpen, setPreferencesOpen] = useState(false);
  const content = useRef<HTMLDivElement>(null);
  const opener = useRef<HTMLElement | null>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const preferences = useRef<HTMLElement>(null);
  const focusTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [failed, setFailed] = useState<string[]>([]);
  const [storageError, setStorageError] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const key = safetyKey(userId);
  const unavailable = useRef(false);
  const openViewer = useCallback((tipId?: string) => {
    // Capture the opener before suspending chat: closing its native dialog moves focus.
    opener.current = document.activeElement as HTMLElement | null;
    onOpenChange?.(true);
    if (tipId) setSelected(tipId);
    setPreferencesOpen(false);
    setNotice(null); setOpened(true);
  }, [onOpenChange]);
  function closeViewer() { setOpened(false); onOpenChange?.(false); }

  useEffect(() => {
    unavailable.current = blocked || opened || storageError || critical || /ajustes|medidores|config|login|setup|onboarding|registro/.test(pathname);
  }, [blocked, opened, storageError, critical, pathname]);

  useEffect(() => {
    let active = 0, previous = Date.now(), interaction = Date.now(), running = false;
    const sessionKey = key + ':session';
    const config = process.env.NODE_ENV === 'development' && new URLSearchParams(location.search).get('lumiSafetyTest') === '1'
      ? { ...SAFETY_CONFIG, activeMs: 5000, intervalMs: 15000 } : SAFETY_CONFIG;
    const sync = () => {
      try { const state = readSafety(localStorage.getItem(key)); setEnabled(state.enabled); if (!state.enabled || document.visibilityState !== 'visible') setNotice(null); }
      catch { setStorageError(true); setNotice(null); }
    };
    const touch = () => { interaction = Date.now(); };
    const open = () => openViewer();
    sync();
    window.addEventListener(OPEN_SAFETY, open);
    window.addEventListener('storage', sync);
    document.addEventListener('visibilitychange', sync);
    for (const name of ['pointerdown', 'keydown', 'scroll']) window.addEventListener(name, touch, { passive: true });
    const safe = () => !unavailable.current && document.visibilityState === 'visible' && document.hasFocus()
      && !document.querySelector('dialog[open], [aria-modal="true"], [data-critical-active="true"], [data-lumi-safety-block="true"]')
      && !document.activeElement?.matches('input, textarea, select, [contenteditable="true"]');
    const tick = async () => {
      const now = Date.now();
      if (document.visibilityState === 'visible' && document.hasFocus() && now - interaction < config.idleMs) active += Math.min(now - previous, config.pollMs * 2);
      previous = now;
      if (!safe()) { setNotice(null); return; }
      // Web Locks serializes the durable claim across tabs. Without it, fail closed for automatic offers.
      if (running || !navigator.locks) return;
      running = true;
      try {
        await navigator.locks.request(key, { ifAvailable: true }, lock => {
          if (!lock || !safe()) return;
          const state = readSafety(localStorage.getItem(key));
          const next = nextSafety(state, Date.now(), active, sessionStorage.getItem(sessionKey) === '1', config);
          if (!next) return;
          localStorage.setItem(key, JSON.stringify(next.state));
          sessionStorage.setItem(sessionKey, '1');
          setNotice(next.tip);
        });
      } catch { setStorageError(true); } finally { running = false; }
    };
    const timer = setInterval(() => void tick(), config.pollMs);
    return () => {
      clearInterval(timer); window.removeEventListener(OPEN_SAFETY, open); window.removeEventListener('storage', sync);
      document.removeEventListener('visibilitychange', sync);
      for (const name of ['pointerdown', 'keydown', 'scroll']) window.removeEventListener(name, touch);
    };
  }, [key, openViewer]);

  useEffect(() => {
    if (!opened) return;
    if (focusTimer.current) clearTimeout(focusTimer.current);
    const panel = dialog.current;
    const root = document.documentElement;
    const body = document.body;
    const previous = { rootOverflow: root.style.overflow, overflow: body.style.overflow, position: body.style.position, top: body.style.top, width: body.style.width };
    const scrollY = window.scrollY;
    root.style.overflow = 'hidden';
    body.style.overflow = 'hidden'; body.style.position = 'fixed'; body.style.top = `-${scrollY}px`; body.style.width = '100%';
    if (panel && !panel.open) panel.showModal();
    closeButton.current?.focus({ preventScroll: true });
    return () => {
      panel?.close();
      root.style.overflow = previous.rootOverflow;
      body.style.overflow = previous.overflow; body.style.position = previous.position; body.style.top = previous.top; body.style.width = previous.width;
      window.scrollTo({ top: scrollY, behavior: 'auto' });
      // Allow the parent chat dialog to be restored before returning to its button.
      const restore = opener.current;
      focusTimer.current = setTimeout(() => { if (restore?.isConnected) restore.focus({ preventScroll: true }); }, 0);
    };
  }, [opened]);

  useEffect(() => {
    if (content.current) content.current.scrollTop = 0;
  }, [selected]);

  useEffect(() => {
    if (preferencesOpen && content.current) content.current.scrollTop = content.current.scrollHeight;
  }, [preferencesOpen]);

  const index = SAFETY_TIPS.findIndex(tip => tip.id === selected);
  function move(direction: number) {
    const next = index + direction;
    if (next >= 0 && next < SAFETY_TIPS.length) {
      setSelected(SAFETY_TIPS[next].id); setPreferencesOpen(false);
    }
  }
  function keyboard(event: React.KeyboardEvent<HTMLDialogElement>) {
    // Native showModal supplies focus containment; cover explicit Tab boundaries too.
    if (event.key === 'Tab') {
      const controls = Array.from(event.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), [tabindex="0"]')).filter(element => !element.closest('[hidden]'));
      const first = controls[0], last = controls.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      return;
    }
    if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey || (event.target as HTMLElement).closest('input, textarea, select, [contenteditable="true"], [role="slider"]')) return;
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      event.preventDefault(); move(event.key === 'ArrowLeft' ? -1 : 1);
    }
  }

  function toggle(value: boolean) {
    try {
      localStorage.setItem(key, JSON.stringify({ ...readSafety(localStorage.getItem(key)), enabled: value }));
      setEnabled(value); setStorageError(false); if (!value) setNotice(null);
    } catch { setStorageError(true); }
  }
  const tip = SAFETY_TIPS[index];
  return <>
    {notice && !blocked && !critical && !opened && !/ajustes|medidores|config|login|setup|onboarding|registro/.test(pathname) && <aside className={styles.notice} aria-label="Consejo preventivo de Lumi">
      <button type="button" className={styles.dismiss} aria-label="Cerrar consejo preventivo" onClick={() => setNotice(null)}>×</button>
      <small>💡 Consejo preventivo</small><p>{notice.message}</p>
      <button type="button" onClick={() => openViewer(notice.id)}>Ver consejo</button>
    </aside>}
    {opened && createPortal(<dialog ref={dialog} className={styles.dialog} aria-labelledby="safety-title" aria-describedby="safety-subtitle" onKeyDown={keyboard}
      onCancel={event => { event.preventDefault(); closeViewer(); }}>
      <header className={styles.header}>
        <div className={styles.heading}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/assets/lumi/lumi-greeting.png" alt="" width="32" height="36" />
          <div className={styles.headingText}>
            <h2 id="safety-title">Consejos de seguridad</h2>
            <p id="safety-subtitle">Pequeños hábitos para cuidar tu instalación</p>
          </div>
        </div>
        <button ref={closeButton} type="button" className={styles.close} onClick={closeViewer} aria-label="Cerrar consejos de seguridad">Cerrar <span aria-hidden="true">×</span></button>
      </header>
      <div ref={content} className={styles.body}>
        <article className={styles.tip} aria-label={tip.title}>
          {failed.includes(tip.id) ? (
            <p className={styles.imageError} role="status">La imagen no está disponible. Podés leer la recomendación a continuación.</p>
          ) : (
            <figure className={styles.artwork}>
              <div className={styles.imageStage}>
                {/* The original image and logos are never cropped or rewritten. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  className={styles.tipImage}
                  src={'/assets/lumi/safety/' + tip.image}
                  alt={tip.alt}
                  loading="lazy"
                  width="1254"
                  height="1254"
                  onError={() => {
                    setFailed(current => [...current, tip.id]);
                  }}
                />
              </div>
            </figure>
          )}
          <div className={styles.explanation}>
            <p>{tip.explanation}</p>
            <small>Recomendación general de prevención</small>
          </div>
        </article>
        {preferencesOpen && (
          <section ref={preferences} id="safety-preferences" className={styles.preferences} aria-label="Preferencias de consejos">
            <label>
              <input type="checkbox" checked={enabled} onChange={event => toggle(event.target.checked)} />
              Recibir consejos preventivos de Lumi
            </label>
            <p>
              Como máximo un aviso por sesión, con al menos {SAFETY_CONFIG.intervalMs / 3600000} horas entre presentaciones. La consulta manual siempre está disponible.
            </p>
            <small>Preferencia guardada para tu usuario en este navegador.</small>
            {storageError && <p role="status">No se pudo guardar la preferencia. Revisá el almacenamiento del navegador; los consejos automáticos quedan suspendidos.</p>}
          </section>
        )}
      </div>
      <footer className={styles.footer}>
          <nav className={styles.pager} aria-label="Recorrer consejos">
            <button type="button" disabled={index === 0} onClick={() => move(-1)}>← Anterior</button>
            <span role="status" aria-live="polite" aria-atomic="true">Consejo {index + 1} de {SAFETY_TIPS.length}</span>
            <button type="button" disabled={index === SAFETY_TIPS.length - 1} onClick={() => move(1)}>Siguiente →</button>
          </nav>
          <button type="button" className={styles.configure} aria-expanded={preferencesOpen} aria-controls="safety-preferences" onClick={() => setPreferencesOpen(value => !value)}>Configurar frecuencia <span aria-hidden="true">{preferencesOpen ? '⌃' : '⌄'}</span></button>
      </footer>
    </dialog>, document.body)}
  </>;
}
