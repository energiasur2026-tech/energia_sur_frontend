'use client';
import { useCallback, useEffect, useRef } from 'react';
import { LumiAudio, type LumiSound } from './lumi-sound';
export function useLumiSounds(enabled: boolean) {
  const audio = useRef<LumiAudio | null>(null);
  useEffect(() => {
    const engine = new LumiAudio(); audio.current = engine;
    const unlock = () => engine.unlock();
    const hide = () => { if (document.visibilityState === 'hidden') engine.stop(); };
    document.addEventListener('pointerdown', unlock, true); document.addEventListener('keydown', unlock, true);
    document.addEventListener('visibilitychange', hide);
    return () => { document.removeEventListener('pointerdown', unlock, true); document.removeEventListener('keydown', unlock, true); document.removeEventListener('visibilitychange', hide); engine.dispose(); audio.current = null; };
  }, []);
  useEffect(() => { audio.current?.setEnabled(enabled); }, [enabled]);
  return useCallback((sound: LumiSound) => { audio.current?.play(sound); }, []);
}
