'use client';
import {ConfigureTariffLink} from '../ConfigureTariffLink';
import { useState } from 'react';
import { Brain, Pencil, Trash2 } from 'lucide-react';
import { formatLumiDate, type LumiSession, type LumiMemoryItem } from './lumi-state';
import styles from './lumi.module.css';

type Props = { session: LumiSession; busy: boolean; onAction: (action: Record<string, unknown>) => Promise<boolean> };
const days = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'];
function editable(habit: LumiMemoryItem) {
  return (habit.kind === 'plan' ? 'Mañana usaré ' : habit.kind === 'exception' ? 'Hoy usé ' : 'Siempre uso ') + habit.equipment +
    (habit.localTime ? ' a las ' + habit.localTime : '') + (habit.weekdays?.length ? ' los ' + habit.weekdays.map(day => days[day]).join(', ') : '') +
    (habit.durationMinutes ? ' durante ' + habit.durationMinutes + ' minutos' : '') + (habit.powerW ? ' con potencia de ' + habit.powerW + ' W' : '');
}
function MemoryCard({ habit, busy, onAction }: { habit: LumiMemoryItem } & Pick<Props, 'busy' | 'onAction'>) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState('');
  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (await onAction({ action: 'memory', operation: 'update', id: habit.id, text })) { setEditing(false); setError(''); }
    else setError('No pude guardar la corrección. Conservé tu texto para reintentar.');
  }
  return <article className={styles.memoryCard}>
    <strong>{habit.equipment}</strong>
    <p>{habit.kind === 'routine' ? 'Hábito habitual' : habit.kind === 'plan' ? 'Plan futuro' : 'Evento puntual'} · Declarado por vos · Sin confirmar con mediciones</p>
    <p>{habit.localTime ? 'Horario: ' + habit.localTime : 'Horario no indicado'} · {habit.timezone}</p>
    {habit.weekdays?.length ? <p>Días: {habit.weekdays.map(day => days[day]).join(', ')}</p> : <p>Días no indicados</p>}
    {(habit.durationMinutes || habit.powerW) && <p>{habit.durationMinutes ? habit.durationMinutes.toLocaleString('es-AR') + ' min' : 'Duración desconocida'} · {habit.powerW ? habit.powerW.toLocaleString('es-AR') + ' W declarados' : 'Potencia desconocida'}</p>}
    {habit.occurrenceDate && <p>Fecha declarada: {habit.occurrenceDate.split('-').reverse().join('/')}{habit.active === false ? ' · Fuera de vigencia' : ''}</p>}
    <p>Actualizado: <time dateTime={habit.updatedAt}>{formatLumiDate(habit.updatedAt)}</time></p>
    {editing ? <form onSubmit={save} className={styles.memoryForm}>
      <label>Corregí este recuerdo<textarea maxLength={1000} value={text} disabled={busy} onChange={event => setText(event.target.value)} /></label>
      <div className={styles.eventActions}><button disabled={busy || !text.trim()} type="submit">Guardar recuerdo</button><button disabled={busy} type="button" onClick={() => { setEditing(false); setError(''); }}>Cancelar</button></div>
    </form> : <div className={styles.eventActions}>
      <button disabled={busy} type="button" onClick={() => { setText(editable(habit)); setEditing(true); setConfirmDelete(false); }}><Pencil size={15} aria-hidden="true" /> Corregir recuerdo</button>
      <button disabled={busy} type="button" onClick={() => setConfirmDelete(true)}><Trash2 size={15} aria-hidden="true" /> Eliminar recuerdo</button>
    </div>}
    {confirmDelete && <div><p>¿Eliminar este recuerdo? Dejará de usarse en las recomendaciones. La conversación se administra por separado.</p><div className={styles.eventActions}>
      <button disabled={busy} type="button" onClick={async () => { if (!await onAction({ action: 'memory', operation: 'delete', id: habit.id })) setError('No pude eliminarlo. Podés reintentar.'); }}>Confirmar eliminación</button>
      <button disabled={busy} type="button" onClick={() => setConfirmDelete(false)}>Cancelar</button>
    </div></div>}
    {error && <p role="alert" className={styles.error}>{error}</p>}
  </article>;
}
function SupplyProfile({session}:Props){return <details className={styles.memoryCard}><summary>Referencia de tu suministro</summary><p>La ubicación, el proveedor y la tarifa se administran desde Ajustes para este medidor. No se copian del domicilio personal.</p><p>{session.supplyProfile?.province??'Provincia sin configurar'} · {session.supplyProfile?.distributor??'Proveedor sin confirmar'}</p><ConfigureTariffLink/></details>;}
export function LumiMemory({ session, busy, onAction }: Props) {
  return <section className={styles.memorySection} aria-label="Lo que Lumi recuerda">
    <h3><Brain size={18} aria-hidden="true" /> Lo que Lumi recuerda</h3>
    <p>Los recuerdos pertenecen a tu cuenta y a este medidor. Guardar una declaración no confirma un patrón ni entrena un modelo.</p>
    <label><input type="checkbox" checked={session.preferences?.memoryEnabled !== false} disabled={busy} onChange={event => void onAction({ action: 'preferences', preferences: { memoryEnabled: event.target.checked } })} />Permitir guardar y usar hábitos energéticos</label>
    <p>Pausar conserva los recuerdos para administrarlos; no se usan hasta que vuelvas a habilitarlos.</p>
    {!session.memories?.length && <p>Todavía no hay recuerdos. Podés contarme, por ejemplo, cuándo usás la pava.</p>}
    {session.memories?.map(habit => <MemoryCard key={habit.id} habit={habit} busy={busy} onAction={onAction} />)}
    <SupplyProfile session={session} busy={busy} onAction={onAction} />
    <details className={styles.memoryCard}><summary>Consejo de uso eficiente de la pava</summary><p>Calentar solo el agua necesaria, respetando el mínimo del fabricante, y evitar recalentamientos. No se cuantificó ahorro.</p>
      <label><input type="checkbox" disabled={busy} checked={session.recommendations?.some(item => item.kind === 'kettle-water' && item.adopted) ?? false} onChange={event => void onAction({ action: 'recommendation', kind: 'kettle-water', adopted: event.target.checked })} />Adopté este consejo</label>
      <p>Podés preguntarme por la mejora después de una semana. Compararé cobertura y períodos equivalentes; una diferencia no prueba causalidad.</p>
    </details>
    <details className={styles.memoryCard}><summary>Redacción con un proveedor opcional</summary><p>Solo si el administrador lo configuró. Al habilitarlo autorizás enviar las consultas no reconocidas y la estructura de la respuesta al proveedor configurado, que podría ser externo. No recibe mediciones, recuerdos, credenciales ni identificadores de cuenta o medidor. Sin habilitarlo, funcionan las respuestas por reglas.</p>
      <label><input type="checkbox" disabled={busy} checked={!!session.preferences?.modelEnabled} onChange={event => void onAction({ action: 'preferences', preferences: { modelEnabled: event.target.checked } })} />Permitir el proveedor de lenguaje</label>
    </details>
  </section>;
}
