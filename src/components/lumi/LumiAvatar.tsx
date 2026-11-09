'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { LUMI_LABELS, LUMI_STATES, type LumiState } from './lumi-state';
import styles from './lumi.module.css';

/** Stable image layers crossfade; poses are never animation frames. */
export function LumiAvatar({ state = 'idle', compact = false, reducedMotion = false, decorative = false }: {
  state?: LumiState; compact?: boolean; reducedMotion?: boolean; decorative?: boolean;
}) {
  const [displayState, setDisplayState] = useState(state);
  const [ready, setReady] = useState<Partial<Record<LumiState, boolean>>>({});
  useEffect(() => {
    if (displayState === state || (!compact && !ready[state])) return;
    // Filter fleeting processing states, without delaying responses or urgent notices.
    // Never keep the analyzing pose after its actual operation has finished.
    const delay = reducedMotion || state === 'alert' || displayState === 'analyzing' ? 0 : 120;
    const timer = setTimeout(() => setDisplayState(state), delay);
    return () => clearTimeout(timer);
  }, [state, displayState, ready, compact, reducedMotion]);

  return (
    <span className={styles.avatar + (compact ? ' ' + styles.compact : '')}
      data-state={displayState} data-reduced-motion={reducedMotion || undefined}
      role={decorative ? undefined : 'img'} aria-label={decorative ? undefined : 'Lumi: ' + LUMI_LABELS[state]}
      aria-hidden={decorative || undefined}>
      {(compact ? ['head' as const] : LUMI_STATES).map(pose => (
        <Image key={pose} className={styles.character} src={'/assets/lumi/lumi-' + pose + '.png'}
          data-active={compact || displayState === pose} width={compact ? 320 : 480}
          height={compact ? 320 : 520} alt="" unoptimized loading="eager"
          onLoad={event => {
            if (pose === 'head') return;
            const image = event.currentTarget;
            void image.decode().catch(() => {}).then(() => setReady(previous => previous[pose] ? previous : { ...previous, [pose]: true }));
          }} />
      ))}
      {['question', 'alert', 'success', 'analyzing'].includes(displayState) && (
        <span className={styles.indicator} aria-hidden="true">
          {displayState === 'question' ? '?' : displayState === 'alert' ? '!' : displayState === 'success' ? '✓' : '•••'}
        </span>
      )}
    </span>
  );
}
