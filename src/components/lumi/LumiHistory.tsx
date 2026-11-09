'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { isNearHistoryEnd, messageKeys, type LumiMessage } from './lumi-conversation';
import styles from './lumi.module.css';

export function LumiHistory({ messages, loaded, busy, reducedMotion, error, onRetry }: {
  messages: LumiMessage[]; loaded: boolean; busy: boolean; reducedMotion: boolean;
  error: string; onRetry: () => void;
}) {
  const scroll = useRef<HTMLDivElement>(null);
  const nearEnd = useRef(true);
  const anchor = useRef<{ key: string; offset: number } | null>(null);
  const known = useRef<Set<string> | null>(null);
  const [hasNew, setHasNew] = useState(false);
  const keys = messageKeys(messages);
  // Equal snapshots from background polling must not restart entry animations/scroll.
  const revision = JSON.stringify(keys);

  useLayoutEffect(() => {
    const element = scroll.current;
    if (!element || !loaded) return;
    const currentKeys: string[] = JSON.parse(revision);
    const first = known.current === null;
    const added = new Set(currentKeys.filter(key => !known.current?.has(key)));
    const frame = requestAnimationFrame(() => {
      known.current = new Set(currentKeys);
      // Preserve the visible message even when the server drops older entries.
      if (!first && !nearEnd.current && anchor.current) {
        const position = anchor.current;
        const message = Array.from(element.querySelectorAll<HTMLElement>('[data-message-key]')).find(node => node.dataset.messageKey === position.key);
        if (message) element.scrollTop += message.getBoundingClientRect().top - element.getBoundingClientRect().top - position.offset;
      }
      if (reducedMotion) element.querySelectorAll<HTMLElement>('[data-message-key]').forEach(message => message.getAnimations().forEach(animation => animation.cancel()));
      if (!first && !reducedMotion) {
        element.querySelectorAll<HTMLElement>('[data-message-key]').forEach(message => {
          if (added.has(message.dataset.messageKey ?? '')) {
            message.animate([{ opacity: 0, transform: 'translateY(6px)' }, { opacity: 1, transform: 'translateY(0)' }],
              { duration: 180, easing: 'ease-out' });
          }
        });
      }
      if (first || (added.size > 0 && nearEnd.current)) {
        element.scrollTo({ top: element.scrollHeight, behavior: first || reducedMotion ? 'instant' : 'smooth' });
        setHasNew(false);
      } else if (added.size > 0) {
        setHasNew(true);
      }
      if (!currentKeys.length) setHasNew(false);
    });
    return () => cancelAnimationFrame(frame);
  }, [revision, loaded, reducedMotion]);

  useEffect(() => {
    const element = scroll.current;
    if (!element) return;
    let frame = 0;
    const observer = new ResizeObserver(() => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        if (nearEnd.current) element.scrollTo({ top: element.scrollHeight, behavior: reducedMotion ? 'instant' : 'smooth' });
      });
    });
    observer.observe(element);
    return () => { observer.disconnect(); cancelAnimationFrame(frame); };
  }, [reducedMotion]);

  return <div className={styles.historyArea}>
    <div ref={scroll} className={styles.history} role="log" aria-label="Historial de conversación"
      aria-live="polite" aria-relevant="additions text" aria-busy={busy} tabIndex={0}
      onScroll={event => {
        const element = event.currentTarget;
        nearEnd.current = isNearHistoryEnd(element.scrollHeight, element.clientHeight, element.scrollTop);
        if (nearEnd.current) {
          setHasNew(false);
          anchor.current = null;
        } else {
          const top = element.getBoundingClientRect().top;
          const first = Array.from(element.querySelectorAll<HTMLElement>('[data-message-key]')).find(message => message.getBoundingClientRect().bottom > top);
          if (first) anchor.current = { key: first.dataset.messageKey ?? '', offset: first.getBoundingClientRect().top - top };
        }
      }}>
      {error && <div className={styles.error} role="status"><p>{error}</p><button type="button" disabled={busy} onClick={onRetry}>Volver a intentar</button></div>}
      {!messages.length && !error && <p className={styles.empty}>{loaded ? '¿Qué querés conocer sobre tu consumo?' : 'Cargando tu conversación y las mediciones de este medidor…'}</p>}
      {messages.map((message, index) => <p className={styles.message} data-role={message.role}
        data-message-key={keys[index]} key={keys[index]}><strong>{message.role === 'user' ? 'Vos' : 'Lumi'}</strong>{message.text}</p>)}
    </div>
    {hasNew && <button className={styles.newMessages} type="button" onClick={() => {
      nearEnd.current = true;
      scroll.current?.scrollTo({ top: scroll.current.scrollHeight, behavior: reducedMotion ? 'instant' : 'smooth' });
      setHasNew(false);
    }}>Mensaje nuevo · Ir al final</button>}
  </div>;
}
