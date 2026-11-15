'use client';
import {useMeterId} from '@/lib/use-meter-id';
import {CATEGORY_HELP_OPEN,type CategoryHelpRequest} from '@/lib/lumi-category-help';
import {LumiCategoryHelp} from './LumiCategoryHelp';
import { meterFetch } from '@/lib/meter-fetch';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { usePolling } from '@/lib/use-polling';
import { LumiAvatar } from './LumiAvatar';
import { LumiHistory } from './LumiHistory';
import { LumiEvents } from './LumiEvents';
import {LumiResponseStyle} from './LumiResponseStyle';
import { LumiMemory } from './LumiMemory';
import { useLumiSounds } from './use-lumi-sounds';
import { newEventSound } from './lumi-sound';
import { useLumiReducedMotion } from './use-reduced-motion';
import { LUMI_LABELS, isConsultation, isPendingEvent, isPriorityEvent, resolveLumiState, type LumiSession } from './lumi-state';
import styles from './lumi.module.css';

type Tab = 'chat' | 'events' | 'preferences';
const API = '/api/lumi/v1';

export function LumiWidget({ userId }: { userId: string }) {
  const deviceId=useMeterId();
  const [categoryHelp,setCategoryHelp]=useState<CategoryHelpRequest|null>(null);
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
  const [freshChat, setFreshChat] = useState(true);
  const chatEpoch = useRef(0);
  const trigger = useRef<HTMLButtonElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const inFlight = useRef(false);
  const mutating = useRef(false);
  const mounted = useRef(true);
  const request = useRef<AbortController | null>(null);
  const successTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reducedMotion = useLumiReducedMotion(session?.preferences?.reducedMotion ?? false);
  const playSound = useLumiSounds(!!session && session.preferences?.soundsEnabled !== false);
  const knownEvents = useRef<Set<string> | null>(null);
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
      setSession(current => action && (action.action === 'read' || action.action === 'label' || data.snapshot) && current ? { ...current, ...data } : data);
      setError('');
      const cue = newEventSound(knownEvents.current, data.events, !!data.preferences?.proactivePaused);
      knownEvents.current = new Set(data.events.map((event: { id: string }) => event.id));
      if (data.preferences?.soundsEnabled !== false) {
        if (action?.action === 'chat') playSound(data.answer?.intent === 'saving' || data.answer?.intent === 'appliance' ? 'suggestion' : 'reply');
        else if (action && !(action.action === 'preferences' && action.preferences && 'soundsEnabled' in (action.preferences as object))) playSound('success');
        else if (!action && cue) playSound(cue);
      }
      if (action && action.action !== 'chat') {
        setSuccess(true);
        if (successTimer.current) clearTimeout(successTimer.current);
        successTimer.current = setTimeout(() => setSuccess(false), 2000);
      }
      return true;
    } catch (failure) {
      if (!mounted.current || request.current !== controller) return false;
      if (action) playSound('error');
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
  }, [playSound]);

  const refresh = useCallback(() => { void load(); }, [load]);
  usePolling(refresh, 120000);

  const closePanel = useCallback(() => {
    chatEpoch.current += 1;
    setFreshChat(true);
    setQuestion('');
    setConfirmClear(false);
    playSound('close');
    if (reducedMotion) setOpen(false);
    else setClosing(true);
  }, [reducedMotion, playSound]);

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

  useEffect(()=>{
    const onHelp=(event:Event)=>{const detail=(event as CustomEvent<CategoryHelpRequest>).detail;if(!detail||detail.meterSelection!==deviceId||typeof detail.requestId!=='string'||!detail.context||['province','locality','provider'].some(k=>typeof detail.context[k as keyof typeof detail.context]!=='string'))return;setCategoryHelp(detail);setTab('chat');setClosing(false);setOpen(true);setIntro(false);setGreeting(false);};
    window.addEventListener(CATEGORY_HELP_OPEN,onHelp);return()=>window.removeEventListener(CATEGORY_HELP_OPEN,onHelp);
  },[deviceId]);

  const events = session?.events ?? [];
  const unread = events.filter(isPendingEvent);
  const attentionEvents = session?.preferences?.proactivePaused ? events.filter(event => !isConsultation(event)) : events;
  const state = resolveLumiState({ events: attentionEvents, busy, success, greeting });
  const pending = session?.preferences?.proactivePaused ? [] : unread.filter(isConsultation);

  async function send(event: React.FormEvent) {
    event.preventDefault();
    const text = question.trim();
    if (!text || busy) return;
    const epoch = chatEpoch.current;
    if (freshChat) {
      // Clear server-side dialogue context as well: hiding messages alone would reuse old references.
      if (!await load({ action: 'clear' }) || chatEpoch.current !== epoch) return;
      setFreshChat(false);
    }
    playSound('send');
    if (await load({ action: 'chat', question: text })) setQuestion('');
  }

  return <>
    <div className={styles.launcher}>
      {intro && !open && <span className={styles.intro}>Lumi · Tu asistente energético</span>}
      <button ref={trigger} type="button" className={styles.trigger} aria-label="Abrir Lumi, tu asistente energético"
        aria-describedby="lumi-status"
        aria-haspopup="dialog" aria-expanded={open} aria-controls={open ? 'lumi-panel' : undefined}
        onClick={() => { setCategoryHelp(null); playSound(unread.some(isPriorityEvent) ? 'alert' : pending.length ? 'question' : unread.length ? 'suggestion' : 'open'); setClosing(false); setOpen(true); setIntro(false); setGreeting(false); }}>
        <span className={styles.suspended} data-reduced-motion={reducedMotion || undefined}>
          <LumiAvatar state={state} reducedMotion={reducedMotion} decorative />
        </span>
        {unread.length > 0 && <span className={styles.counter} aria-label={`${unread.length} elementos pendientes`}>{unread.length > 99 ? '99+' : unread.length}</span>}
      </button>
      <span id="lumi-status" className="sr-only" role="status">{LUMI_LABELS[state]}{unread.length ? `. ${unread.length} avisos pendientes.` : ''}</span>
    </div>
    {open && createPortal(
      <dialog ref={dialog} id="lumi-panel" className={styles.panel} aria-labelledby="lumi-title"
        data-closing={closing || undefined} data-reduced-motion={reducedMotion || undefined} inert={closing}
        onAnimationEnd={event => { if (event.target === event.currentTarget && closing) setOpen(false); }}
        onClickCapture={event => {
          const control = (event.target as HTMLElement).closest('button, input[type="checkbox"]');
          if (control && !control.hasAttribute('disabled') && !control.hasAttribute('data-sound-control') && !control.closest('header') && control.getAttribute('type') !== 'submit') playSound('tap');
        }}
        onCancel={event => { event.preventDefault(); closePanel(); }} onClick={event => { if (event.target === event.currentTarget) {
          const rect = event.currentTarget.getBoundingClientRect();
          if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) closePanel();
        } }}>
        <header className={styles.header}>
          <div><h2 id="lumi-title">Lumi <span>· EnergIA Sur</span></h2><p>{session?.meterName ?? 'Tu asistente energético'}</p></div>
          <button autoFocus type="button" onClick={closePanel} aria-label="Cerrar Lumi"><span aria-hidden="true">×</span></button>
        </header>
        <div className={styles.hero} data-section={tab}>
          <LumiAvatar state={state} reducedMotion={reducedMotion} decorative />
          <div><strong>{categoryHelp&&tab==='chat'?'Te ayudo a identificar tu categoría':state === 'alert' ? 'Tenés avisos para revisar' : pending.length ? 'Tengo una consulta sobre tu consumo' : busy ? 'Procesando tu solicitud…' : success ? 'Listo, se guardó el cambio' : 'Entendamos tu energía'}</strong>
          <p>{state === 'alert' ? 'Revisá el detalle y la prioridad en Avisos.' : 'Consumo, consultas y recomendaciones en un solo lugar.'}</p></div>
        </div>
        <nav className={styles.tabs} aria-label="Secciones de Lumi">
          <button type="button" aria-pressed={tab === 'chat'} onClick={() => {setTab('chat');setCategoryHelp(null);}}>Chat</button>
          <button type="button" aria-pressed={tab === 'events'} onClick={() => setTab('events')}>Avisos{unread.length ? ` (${unread.length})` : ''}</button>
          <button type="button" aria-pressed={tab === 'preferences'} onClick={() => setTab('preferences')}>Preferencias</button>
        </nav>
        <div className={tab === 'chat' && !categoryHelp ? styles.chat : tab === 'events' ? styles.eventsPane : styles.content}>
          {tab !== 'chat' && error && <div className={styles.error} role="status"><p>{error}</p><button type="button" disabled={busy} onClick={refresh}>Volver a intentar</button></div>}
          {tab === 'chat' && categoryHelp && <LumiCategoryHelp key={categoryHelp.requestId} request={categoryHelp} onBack={()=>{setCategoryHelp(null);closePanel();}}/>}
          {tab === 'chat' && !categoryHelp && <>
            {freshChat && !!session?.messages.length && <div className={styles.chatTools}><div className={styles.clear}><button type="button" disabled={busy} onClick={() => setFreshChat(false)}>Continuar chat anterior</button></div><p className={styles.note}>Si enviás una consulta nueva, se borra la conversación anterior. Tus hábitos y patrones se conservan.</p></div>}
            {session && !freshChat && <div className={styles.chatTools}><div className={styles.clear}>
              {confirmClear ? <><span>¿Borrar tu historial de este medidor?</span><button type="button" disabled={busy} onClick={async () => { if (await load({ action: 'clear' })) { setConfirmClear(false); setFreshChat(true); } }}>Borrar historial</button><button type="button" onClick={() => setConfirmClear(false)}>Cancelar</button></> : <button type="button" onClick={() => setConfirmClear(true)}>Borrar conversación</button>}
            </div></div>}
            <LumiHistory messages={freshChat ? [] : session?.messages ?? []} loaded={session !== null} busy={busy}
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
          {tab === 'events' && (session ? <LumiEvents events={events} busy={busy} onAction={load} /> : <p className={styles.empty}>Los avisos aparecerán cuando Lumi esté disponible.</p>)}
          {tab === 'preferences' && <section className={styles.preferences} aria-label="Preferencias de Lumi">
            <h3>A tu ritmo</h3><p>Estas preferencias se guardan en tu cuenta.</p>
            {session?.preferences ? <>
              <LumiResponseStyle enabled={session.preferences.briefResponses===true} busy={busy} onSave={value=>load({action:'preferences',preferences:{briefResponses:value}})}/>
              <label><input type="checkbox" disabled={busy} checked={!!session.preferences.reducedMotion} onChange={event => void load({ action: 'preferences', preferences: { ...session.preferences, reducedMotion: event.target.checked } })} />Reducir movimientos de Lumi</label>
              <label><input type="checkbox" disabled={busy} checked={!!session.preferences.proactivePaused} onChange={event => void load({ action: 'preferences', preferences: { ...session.preferences, proactivePaused: event.target.checked } })} />Pausar consultas proactivas</label>
              <label><input data-sound-control type="checkbox" disabled={busy} checked={session.preferences.soundsEnabled !== false} onChange={event => void load({ action: 'preferences', preferences: { soundsEnabled: event.target.checked } })} />Sonidos de Lumi</label>
              <p>Tonos breves para preguntas, avisos, sugerencias y acciones. Se activan después de interactuar y se silencian si esta pestaña queda oculta.</p>
              <button data-sound-control type="button" disabled={busy || session.preferences.soundsEnabled === false} onClick={() => playSound('question')}>Probar sonido</button>
              <LumiMemory session={session} busy={busy} onAction={load} />
            </> : <p>Las preferencias estarán disponibles cuando el servicio responda.</p>}
          </section>}
        </div>
      </dialog>, document.body)}
  </>;
}
