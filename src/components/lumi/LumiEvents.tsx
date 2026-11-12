'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Archive, ChevronDown, CircleHelp, Droplets, Plug, type LucideIcon } from 'lucide-react';
import { APPLIANCES_BY_ID } from '@/lib/home-catalog';
import { formatLumiDate, isAnswered, isElectricalEvent, isConsultation, isPendingEvent, isPriorityEvent, matchesEventFilter, toggleEquipment, type EventFilter, type LumiEvent } from './lumi-state';
import styles from './lumi.module.css';

function Kettle() {
  return <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M6 9h10l1 10H5L6 9ZM8 9V7a3 3 0 0 1 6 0v2M16 10h3a3 3 0 0 1-2 6M6 10 2 8l3 7M4 21h14" /></svg>;
}
function Iron() {
  return <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M3 18h18l-2-8H9l-6 8ZM10 10V6h7l2 4M3 21h18M21 18v-4" /></svg>;
}
const applianceIcon = (id: string) => APPLIANCES_BY_ID.get(id)!.icon;
const EQUIPMENT: { label: string; Icon: LucideIcon | typeof Kettle }[] = [
  { label: 'Pava eléctrica', Icon: Kettle }, { label: 'Microondas', Icon: applianceIcon('microondas') },
  { label: 'Plancha', Icon: Iron }, { label: 'Lavarropas', Icon: applianceIcon('lavarropas') },
  { label: 'Calefactor', Icon: applianceIcon('calefactor') }, { label: 'Bomba de agua', Icon: Droplets },
  { label: 'Otro equipo', Icon: Plug }, { label: 'No recuerdo', Icon: CircleHelp },
];
export type LumiAction = Record<string, unknown>;
type Props = { events: LumiEvent[]; busy: boolean; onAction: (action: LumiAction) => Promise<boolean> };
const formatDate = formatLumiDate;

export function LumiEvents({ events, busy, onAction }: Props) {
  const [filter, setFilter] = useState<EventFilter>('all');
  const [view, setView] = useState<'pending' | 'history'>('pending');
  const [notice, setNotice] = useState('');
  const [lastSaved, setLastSaved] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const list = useRef<HTMLDivElement>(null);
  const historyTarget = useRef<string | null>(null);
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(''), 6000);
    return () => clearTimeout(timer);
  }, [notice, lastSaved]);
  const anchor = useRef<{ removed: string; next?: string; offset: number; scrollTop: number } | null>(null);
  const filtered = events.filter(event => matchesEventFilter(event, filter));
  const pendingCount = filtered.filter(isPendingEvent).length;
  // History includes every stored event, including pending ones.
  const visible = filtered.filter(event => view === 'history' || isPendingEvent(event))
    .sort((a, b) => Number(isPriorityEvent(b)) - Number(isPriorityEvent(a)) || Date.parse(b.at) - Date.parse(a.at));
  useLayoutEffect(() => {
    const saved = anchor.current;
    const scroller = list.current;
    if (view === 'history' && scroller && historyTarget.current) {
      const node = Array.from(scroller.querySelectorAll<HTMLElement>('[data-event-id]')).find(item => item.dataset.eventId === historyTarget.current);
      if (node) { scroller.scrollTop += node.getBoundingClientRect().top - scroller.getBoundingClientRect().top; node.querySelector<HTMLButtonElement>('button')?.focus({ preventScroll: true }); }
      historyTarget.current = null;
    }
    if (!saved || !scroller || visible.some(event => event.id === saved.removed)) return;
    const next = Array.from(scroller.querySelectorAll<HTMLElement>('[data-event-id]')).find(node => node.dataset.eventId === saved.next);
    if (next) {
      scroller.scrollTop += next.getBoundingClientRect().top - scroller.getBoundingClientRect().top - saved.offset;
      next.focus({ preventScroll: true });
    } else {
      scroller.scrollTop = Math.min(saved.scrollTop, Math.max(0, scroller.scrollHeight - scroller.clientHeight));
      scroller.focus({ preventScroll: true });
    }
    anchor.current = null;
  }, [events, view, visible]);

  async function act(id: string, action: LumiAction) {
    const scroller = list.current;
    if (view === 'pending' && scroller && ((action.action === 'label' && Array.isArray(action.labels) && action.labels.length) || (action.action === 'read' && action.read === true))) {
      const nodes = Array.from(scroller.querySelectorAll<HTMLElement>('[data-event-id]'));
      const index = nodes.findIndex(node => node.dataset.eventId === id);
      if (index >= 0) anchor.current = { removed: id, next: nodes[index + 1]?.dataset.eventId,
        offset: Math.max(0, nodes[index].getBoundingClientRect().top - scroller.getBoundingClientRect().top), scrollTop: scroller.scrollTop };
    }
    try {
      const ok = await onAction(action);
      if (!ok) anchor.current = null;
      return ok;
    } catch { anchor.current = null; return false; }
  }
  function toggle(id: string) {
    setExpanded(previous => { const next = new Set(previous); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  }
  return <section className={styles.eventsLayout} aria-label="Avisos y consultas">
    <div className={styles.eventFilters}>
      <p className={styles.note}>Horarios de Argentina · UTC−3 · formato 24 h</p>
      <div className={styles.filterRow} role="group" aria-label="Tipo de aviso">
        {([['all', 'Todos'], ['electrical', 'Avisos eléctricos'], ['consultations', 'Consultas']] as const).map(([key, label]) =>
          <button key={key} type="button" aria-pressed={filter === key} onClick={() => { anchor.current = null; setFilter(key); }}>{label} ({events.filter(event => matchesEventFilter(event, key) && isPendingEvent(event)).length})</button>)}
      </div>
      <div className={styles.filterRow} role="group" aria-label="Estado de avisos">
        <button type="button" className={styles.pendingView} aria-pressed={view === 'pending'} onClick={() => { anchor.current = null; setView('pending'); }}>Pendientes ({pendingCount})</button>
        <button type="button" className={styles.historyView} aria-pressed={view === 'history'} onClick={() => { anchor.current = null; setView('history'); }}><Archive aria-hidden="true" size={16} />Historial ({filtered.length})</button>
      </div>
      <div className={styles.eventNotice} role="status" aria-live="polite">
        <span>{notice}</span>
        {lastSaved && notice === 'Respuesta guardada' && view === 'pending' && <button type="button" onClick={() => { anchor.current = null; historyTarget.current = lastSaved; setView('history'); setExpanded(previous => new Set(previous).add(lastSaved)); }}>Ver en historial</button>}
      </div>
    </div>
    <div ref={list} className={styles.eventList} tabIndex={-1} aria-label={view === 'pending' ? 'Elementos pendientes' : 'Historial de avisos'}>
      {!visible.length && <p className={styles.empty}>{view === 'pending' && filter !== 'electrical' && !filtered.some(event => isConsultation(event) && isPendingEvent(event)) ? 'No tenés consultas pendientes' : 'No hay elementos en este filtro.'}</p>}
      {visible.map(event => <LumiEventCard key={event.id} event={event} busy={busy} onAction={action => act(event.id, action)}
        compact={view === 'history'} expanded={expanded.has(event.id)} onToggle={() => toggle(event.id)}
        onSaved={() => { setLastSaved(event.id); setNotice('Respuesta guardada'); }}
        onWithdrawn={() => { setLastSaved(null); setNotice('Respuesta retirada. La consulta vuelve a estar pendiente.'); }}
        onReadChange={read => { setLastSaved(null); setNotice(read ? 'Aviso marcado como leído. Sigue en el historial; no se considera resuelto.' : 'Aviso marcado como no leído.'); }} />)}
    </div>
  </section>;
}

export function LumiEventCard({ event, busy, onAction, onSaved, onWithdrawn, onReadChange, compact = false, expanded = false, onToggle }: Omit<Props, 'events'> & {
  compact?: boolean; expanded?: boolean; onToggle?: () => void; event: LumiEvent; onSaved: () => void; onWithdrawn: () => void; onReadChange: (read: boolean) => void;
}) {
  const consultation = isConsultation(event);
  const answered = isAnswered(event);
  const [editing, setEditing] = useState(false);
  const [labels, setLabels] = useState(event.userLabels);
  const [other, setOther] = useState(event.otherEquipment ?? '');
  const [confirmWithdraw, setConfirmWithdraw] = useState(false);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState<{ action: LumiAction; kind: 'read' | 'save' | 'withdraw' } | null>(null);
  const [saving, setSaving] = useState(false);
  const disabled = busy || saving;
  async function commit(action: LumiAction, kind: 'read' | 'save' | 'withdraw') {
    setSaving(true); setError('');
    let ok = false;
    try { ok = await onAction(action); } catch { /* Keep the draft and retry action. */ }
    setSaving(false);
    if (!ok) { setError('No se pudo guardar el cambio. Tu selección se conserva; volvé a intentar.'); setRetry({ action, kind }); return; }
    setRetry(null); setConfirmWithdraw(false);
    if (kind === 'save') { setEditing(false); onSaved(); }
    else if (kind === 'withdraw') { setEditing(false); setLabels([]); setOther(''); onWithdrawn(); }
    else onReadChange(action.read as boolean);
  }
  const stateLabel = consultation ? answered ? 'Respondida' : 'Sin responder' : event.read ? 'Leído' : 'No leído';
  const severity = event.severity === 'CRITICAL' ? 'Crítico' : event.severity === 'WARNING' || isPriorityEvent(event) ? 'Atención' : 'Informativo';
  const title = consultation ? 'Consulta sobre tu consumo' : isElectricalEvent(event) ? 'Aviso eléctrico' : 'Aviso de consumo';
  return <article className={styles.event} data-event-id={event.id} tabIndex={-1} data-history={compact || undefined} data-priority={isPriorityEvent(event)} data-pending={isPendingEvent(event)}>
    {compact ? <button type="button" className={styles.historySummary} aria-expanded={expanded} aria-controls={'lumi-event-' + event.id} onClick={onToggle}>
      <span><strong>{title}</strong><time dateTime={event.at}>Evento: {formatDate(event.at)}</time><span className={styles.summaryState}>{severity} · {stateLabel}</span></span>
      <ChevronDown aria-hidden="true" size={20} />
    </button> : <strong>{title}</strong>}
    <div id={'lumi-event-' + event.id} hidden={compact && !expanded}>
    <div className={styles.eventBadges}><span>{severity}</span><span>{stateLabel}</span></div>
    <time dateTime={event.at}>Evento: {formatDate(event.at)}</time>
    <p>{event.evidence}</p>
    {consultation ? <>
      <p>{event.question}</p>
      {answered && !editing ? <>
        <p><b>Tu respuesta:</b> {event.userLabels.join(', ')}{event.otherEquipment ? ' · ' + event.otherEquipment : ''}</p>
        {event.answeredAt ? <time dateTime={event.answeredAt}>Respuesta modificada: {formatDate(event.answeredAt)}</time> : <p className={styles.note}>Respuesta anterior: fecha de envío no registrada.</p>}
        <div className={styles.eventActions}>
          <button type="button" disabled={disabled} onClick={() => { setLabels([...event.userLabels]); setOther(event.otherEquipment ?? ''); setEditing(true); setConfirmWithdraw(false); setError(''); setRetry(null); }}>Editar respuesta</button>
          <button type="button" disabled={disabled} onClick={() => setConfirmWithdraw(true)}>Retirar respuesta</button>
        </div>
      </> : <form onSubmit={e => { e.preventDefault(); void commit({ action: 'label', eventId: event.id, labels, otherEquipment: labels.includes('Otro equipo') ? other.trim() : '' }, 'save'); }}>
        <fieldset disabled={disabled} className={styles.equipmentGrid}>
          <legend>{editing ? 'Corregí tu respuesta' : 'Equipos que recordás utilizar (podés elegir varios)'}</legend>
          {EQUIPMENT.map(({ label, Icon }) => <label key={label} className={styles.equipmentOption} data-selected={labels.includes(label)}>
            <input type="checkbox" checked={labels.includes(label)} onChange={() => { setLabels(current => toggleEquipment(current, label)); setRetry(null); setError(''); }} />
            <Icon aria-hidden="true" size={20} /><span>{label}</span>
          </label>)}
        </fieldset>
        {labels.includes('Otro equipo') && <label className={styles.otherEquipment}>¿Cuál? (opcional)
          <input type="text" maxLength={200} value={other} disabled={disabled} onChange={e => { setOther(e.target.value); setRetry(null); }} />
        </label>}
        <p className={styles.note}>Es información que vos recordás, no una identificación confirmada del aparato. “No recuerdo” excluye las demás opciones.</p>
        <div className={styles.eventActions}>
          <button type="submit" disabled={disabled || labels.length === 0}>{saving ? 'Guardando…' : editing ? 'Guardar cambios' : 'Enviar respuesta'}</button>
          {editing && <button type="button" disabled={disabled} onClick={() => { setEditing(false); setLabels([...event.userLabels]); setOther(event.otherEquipment ?? ''); setError(''); setRetry(null); }}>Cancelar</button>}
        </div>
      </form>}
      {confirmWithdraw && <div className={styles.error}>
        <p>¿Retirar tu respuesta? La consulta volverá a estar pendiente.</p>
        <div className={styles.eventActions}><button type="button" disabled={disabled} onClick={() => void commit({ action: 'label', eventId: event.id, labels: [] }, 'withdraw')}>Confirmar retiro</button>
        <button type="button" disabled={disabled} onClick={() => { setConfirmWithdraw(false); setError(''); setRetry(null); }}>Cancelar</button></div>
      </div>}
    </> : <>
      <button disabled={disabled} type="button" onClick={() => void commit({ action: 'read', eventId: event.id, read: !event.read }, 'read')}>{event.read ? 'Marcar como no leído' : 'Marcar como leído'}</button>
      <p className={styles.note}>La lectura no elimina ni resuelve este aviso.</p>
    </>}
    {error && <div className={styles.error} role="alert"><p>{error}</p>{retry && <button type="button" disabled={disabled} onClick={() => void commit(retry.action, retry.kind)}>Reintentar guardado</button>}</div>}
    </div>
  </article>;
}
