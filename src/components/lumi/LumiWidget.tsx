'use client';
import { meterFetch } from '@/lib/meter-fetch';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { usePolling } from '@/lib/use-polling';
import { LumiAvatar } from './LumiAvatar';
import { LumiHistory } from './LumiHistory';
import { useLumiReducedMotion } from './use-reduced-motion';
import { LUMI_LABELS, isPriorityEvent, resolveLumiState, type LumiSession } from './lumi-state';
import styles from './lumi.module.css';

const EQUIPMENT = ['Pava eléctrica', 'Microondas', 'Plancha', 'Lavarropas', 'Calefactor', 'Bomba de agua', 'Otro equipo', 'No recuerdo'];
type Tab = 'chat' | 'events' | 'preferences';
const API = '/api/lumi/v1';

export function LumiWidget({ userId }: { userId: string }) {
  const [open, setOpen] = useState(false);
  const [closing, setClosing] = useState(false);
  const [tab, setTab] = useState<Tab>('chat');
  const [session, setSession] = useState<LumiSession | null>(null);
  const [busy, setBusy] = useState(false);
  const [success, setSuccess] = useState(false);
  const [greeting, setGreeting] = useState(false);
  const [intro, setIntro] = useState(false);
  const [error, setError] = useState('');
  const [question, setQuestion] = useState('');
  const [confirmClear, setConfirmClear] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const inFlight = useRef(false);
  const mutating = useRef(false);
  const mounted = useRef(true);
  const request = useRef<AbortController | null>(null);
  const successTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reducedMotion = useLumiReducedMotion(session?.preferences?.reducedMotion ?? false);
  const introKey = `energia-sur:lumi-intro:v1:${userId}`;

  // Only UI onboarding is stored locally. Conversation/preferences stay on the server.
  useEffect(() => {
    const start = setTimeout(() => {
      let visits = 0;
      try {
        visits = Number(localStorage.getItem(introKey) || 0);
        localStorage.setItem(introKey, String(Math.min(visits + 1, 3)));
      } catch { /* Storage may be disabled. */ }
      setIntro(visits < 3);
      setGreeting(visits === 0);
    }, 0);
    const finish = setTimeout(() => { setGreeting(false); setIntro(false); }, 6000);
    return () => { clearTimeout(start); clearTimeout(finish); };
  }, [introKey]);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      request.current?.abort();
      if (successTimer.current) clearTimeout(successTimer.current);
    };
  }, []);

  const load = useCallback(async (action?: Record<string, unknown>) => {
    if (inFlight.current && (!action || mutating.current)) return false;
    // A manual action may supersede a background refresh, never another write.
    if (inFlight.current) request.current?.abort();
    inFlight.current = true;
    mutating.current = !!action;
    const controller = new AbortController();
    request.current = controller;
    const timeout = setTimeout(() => controller.abort(), 20000);
    // Background polling never makes Lumi appear to be analyzing.
    if (action) setBusy(true);
    try {
      const response = await meterFetch(API, {
        method: action ? 'POST' : 'GET', cache: 'no-store', credentials: 'same-origin',
        headers: action ? { 'Content-Type': 'application/json' } : undefined,
        body: action ? JSON.stringify(action) : undefined, signal: controller.signal,
      });
      const data = await response.json().catch(() => null);
      if (!mounted.current || request.current !== controller) return false;
      if (response.status === 401 || response.status === 403) { setSession(null); setQuestion(''); }
      if (!response.ok) throw new Error(response.status === 401 ? 'Tu sesión venció. Volvé a ingresar.' : data?.error ?? (response.status === 404 ? 'La ruta de Lumi no está publicada en el backend configurado.' : 'Lumi no está disponible temporalmente.'));
      if (!data) throw new Error('La respuesta del servicio de Lumi no es compatible.');
      if (data.version !== '1' || !Array.isArray(data.events) || !Array.isArray(data.messages)) {
        throw new Error('La respuesta de Lumi no es compatible. Intentá nuevamente más tarde.');
      }
      if (!mounted.current || request.current !== controller) return false;
      setSession(data);
      setError('');
      if (action && action.action !== 'chat') {
        setSuccess(true);
        if (successTimer.current) clearTimeout(successTimer.current);
        successTimer.current = setTimeout(() => setSuccess(false), 2000);
      }
      return true;
    } catch (failure) {
      if (!mounted.current || request.current !== controller) return false;
      if (!controller.signal.aborted) setError(failure instanceof Error ? failure.message : 'No pude conectar con Lumi.');
      else setError('La solicitud se interrumpió. Podés volver a intentar.');
      return false;
    } finally {
      clearTimeout(timeout);
      if (request.current === controller) {
        inFlight.current = false;
        mutating.current = false;
        if (mounted.current) setBusy(false);
      }
    }
  }, []);

  const refresh = useCallback(() => { void load(); }, [load]);
  usePolling(refresh, 120000);

  const closePanel = useCallback(() => {
    if (reducedMotion) setOpen(false);
    else setClosing(true);
  }, [reducedMotion]);

  useEffect(() => {
    if (!open) return;
    const panel = dialog.current;
    const restoreFocus = trigger.current;
    if (panel && !panel.open) panel.showModal();
    return () => { panel?.close(); restoreFocus?.focus({ preventScroll: true }); };
  }, [open]);

  useEffect(() => {
    if (!closing) return;
    // animationend normally completes the exit; fallback handles interrupted CSS.
    const timer = setTimeout(() => setOpen(false), reducedMotion ? 0 : 300);
    return () => clearTimeout(timer);
  }, [closing, reducedMotion]);

  useEffect(() => {
    if (!open) return;
    const panel = dialog.current;
    if (!panel) return;
    const viewport = window.visualViewport;
    const originalHeight = window.innerHeight;
    const update = () => {
      const height = viewport?.height ?? window.innerHeight;
      const top = viewport?.offsetTop ?? 0;
      const obscured = Math.max(0, window.innerHeight - height - top);
      const keyboard = window.matchMedia('(max-width: 767px)').matches
        && (obscured > 100 || height < originalHeight - 120);
      panel.style.setProperty('--lumi-viewport-height', height + 'px');
      panel.style.setProperty('--lumi-viewport-bottom', obscured + 'px');
      panel.dataset.keyboard = String(keyboard);
    };
    update();
    viewport?.addEventListener('resize', update);
    viewport?.addEventListener('scroll', update);
    window.addEventListener('resize', update);
    return () => {
      viewport?.removeEventListener('resize', update);
      viewport?.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
    };
  }, [open]);

  const events = session?.events ?? [];
  const unread = events.filter(event => !event.read);
  const state = resolveLumiState({ events, busy, success, greeting });
  const pending = unread.filter(event => event.question && !event.userLabels.length);
  const sortedEvents = [...events].sort((a, b) => Number(isPriorityEvent(b)) - Number(isPriorityEvent(a)) || Number(a.read) - Number(b.read));

  async function send(event: React.FormEvent) {
    event.preventDefault();
    const text = question.trim();
    if (!text || busy) return;
    if (await load({ action: 'chat', question: text })) setQuestion('');
  }

  return <>
    <div className={styles.launcher}>
      {intro && !open && <span className={styles.intro}>Lumi · Tu asistente energético</span>}
      <button ref={trigger} type="button" className={styles.trigger} aria-label="Abrir Lumi, tu asistente energético"
        aria-describedby="lumi-status"
        aria-haspopup="dialog" aria-expanded={open} aria-controls={open ? 'lumi-panel' : undefined}
        onClick={() => { setClosing(false); setOpen(true); setIntro(false); setGreeting(false); }}>
        <span className={styles.suspended} data-reduced-motion={reducedMotion || undefined}>
          <LumiAvatar state={state} reducedMotion={reducedMotion} decorative />
        </span>
        {unread.length > 0 && <span className={styles.counter} aria-label={`${unread.length} avisos pendientes`}>{unread.length > 99 ? '99+' : unread.length}</span>}
      </button>
      <span id="lumi-status" className="sr-only" role="status">{LUMI_LABELS[state]}{unread.length ? `. ${unread.length} avisos pendientes.` : ''}</span>
    </div>
    {open && createPortal(
      <dialog ref={dialog} id="lumi-panel" className={styles.panel} aria-labelledby="lumi-title"
        data-closing={closing || undefined} data-reduced-motion={reducedMotion || undefined} inert={closing}
        onAnimationEnd={event => { if (event.target === event.currentTarget && closing) setOpen(false); }}
        onCancel={event => { event.preventDefault(); closePanel(); }} onClick={event => { if (event.target === event.currentTarget) {
          const rect = event.currentTarget.getBoundingClientRect();
          if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) closePanel();
        } }}>
        <header className={styles.header}>
          <div><h2 id="lumi-title">Lumi <span>· EnergIA Sur</span></h2><p>{session?.meterName ?? 'Tu asistente energético'}</p></div>
          <button autoFocus type="button" onClick={closePanel} aria-label="Cerrar Lumi"><span aria-hidden="true">×</span></button>
        </header>
        <div className={styles.hero}>
          <LumiAvatar state={state} reducedMotion={reducedMotion} decorative />
          <div><strong>{state === 'alert' ? 'Tenés avisos para revisar' : pending.length ? 'Tengo una consulta sobre tu consumo' : busy ? 'Procesando tu solicitud…' : success ? 'Listo, se guardó el cambio' : 'Entendamos tu energía'}</strong>
          <p>{state === 'alert' ? 'Revisá el detalle y la prioridad en Avisos.' : 'Consumo, consultas y recomendaciones en un solo lugar.'}</p></div>
        </div>
        <nav className={styles.tabs} aria-label="Secciones de Lumi">
          <button type="button" aria-pressed={tab === 'chat'} onClick={() => setTab('chat')}>Chat</button>
          <button type="button" aria-pressed={tab === 'events'} onClick={() => setTab('events')}>Avisos{unread.length ? ` (${unread.length})` : ''}</button>
          <button type="button" aria-pressed={tab === 'preferences'} onClick={() => setTab('preferences')}>Preferencias</button>
        </nav>
        <div className={tab === 'chat' ? styles.chat : styles.content}>
          {tab !== 'chat' && error && <div className={styles.error} role="status"><p>{error}</p><button type="button" disabled={busy} onClick={refresh}>Volver a intentar</button></div>}
          {tab === 'chat' && <>
            {session && <div className={styles.chatTools}><div className={styles.clear}>
              {confirmClear ? <><span>¿Borrar tu historial de este medidor?</span><button type="button" disabled={busy} onClick={async () => { if (await load({ action: 'clear' })) setConfirmClear(false); }}>Borrar historial</button><button type="button" onClick={() => setConfirmClear(false)}>Cancelar</button></> : <button type="button" onClick={() => setConfirmClear(true)}>Borrar conversación</button>}
            </div></div>}
            <LumiHistory messages={session?.messages ?? []} loaded={session !== null} busy={busy}
              reducedMotion={reducedMotion} error={error} onRetry={refresh} />
            <footer className={styles.chatFooter}>
              <p className={styles.note} role="status">{busy ? 'Procesando tu solicitud…' : success ? 'Cambio guardado.' : session?.dataStatus === 'no_measurements' ? 'Este medidor todavía no tiene mediciones almacenadas.' : session?.dataStatus === 'insufficient_history' ? 'Hay lecturas disponibles, pero falta historial para algunos análisis.' : 'Las respuestas dependen de las lecturas disponibles.'}</p>
              <form className={styles.composer} onSubmit={send}>
                <label className="sr-only" htmlFor="lumi-question">Tu consulta sobre energía</label>
                <input id="lumi-question" value={question} onChange={event => setQuestion(event.target.value)} maxLength={1000} placeholder="Preguntale a Lumi…" disabled={!session || busy} />
                <button type="submit" disabled={!session || busy || !question.trim()} aria-label="Enviar consulta"><svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m22 2-7 20-4-9-9-4Z M22 2 11 13" /></svg></button>
              </form>
            </footer>
          </>}
          {tab === 'events' && <section aria-label="Preguntas y notificaciones">
            {!events.length && <p className={styles.empty}>{session ? 'No hay avisos en el historial disponible.' : 'Los avisos aparecerán cuando Lumi esté disponible.'}</p>}
            {sortedEvents.map(event => <article key={event.id} className={styles.event} data-priority={isPriorityEvent(event)}>
              <strong>{isPriorityEvent(event) ? 'Aviso eléctrico · Revisar con prioridad' : event.question ? 'Consulta sobre tu consumo' : 'Aviso de consumo'}</strong>
              <time dateTime={event.at}>{new Date(event.at).toLocaleString('es-AR')}</time>
              <p>{event.evidence}</p>
              {event.question && <><p>{event.question}</p><fieldset disabled={busy}><legend>Equipos que recordás utilizar (podés elegir varios)</legend>{EQUIPMENT.map(label => <label key={label}><input type="checkbox" checked={event.userLabels.includes(label)} onChange={e => void load({ action: 'label', eventId: event.id, labels: e.target.checked ? [...event.userLabels, label] : event.userLabels.filter(value => value !== label) })} />{label}</label>)}</fieldset></>}
              {!event.read && <button disabled={busy} type="button" onClick={() => void load({ action: 'read', eventId: event.id })}>Marcar como leído</button>}
            </article>)}
          </section>}
          {tab === 'preferences' && <section className={styles.preferences} aria-label="Preferencias de Lumi">
            <h3>A tu ritmo</h3><p>Estas preferencias se guardan en tu cuenta.</p>
            {session?.preferences ? <>
              <label><input type="checkbox" disabled={busy} checked={!!session.preferences.reducedMotion} onChange={event => void load({ action: 'preferences', preferences: { ...session.preferences, reducedMotion: event.target.checked } })} />Reducir movimientos de Lumi</label>
              <label><input type="checkbox" disabled={busy} checked={!!session.preferences.proactivePaused} onChange={event => void load({ action: 'preferences', preferences: { ...session.preferences, proactivePaused: event.target.checked } })} />Pausar consultas proactivas</label>
            </> : <p>Las preferencias estarán disponibles cuando el servicio responda.</p>}
          </section>}
        </div>
      </dialog>, document.body)}
  </>;
}
