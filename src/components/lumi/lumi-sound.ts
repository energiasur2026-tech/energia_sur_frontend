import { isConsultation, isPendingEvent, isPriorityEvent, type LumiEvent } from './lumi-state';
export type LumiSound = 'open' | 'close' | 'tap' | 'send' | 'reply' | 'question' | 'suggestion' | 'alert' | 'success' | 'error';
// Original synthesized cues: no downloaded audio, microphone or external requests.
export const CUES: Record<LumiSound, readonly number[]> = {
  open: [523, 784], close: [659, 440], tap: [660], send: [440, 660], reply: [660, 880],
  question: [523, 659, 784], suggestion: [659, 784, 988], alert: [392, 392, 523], success: [523, 659, 1047], error: [330, 262],
};
export function newEventSound(previous: Set<string> | null, events: LumiEvent[], paused = false): LumiSound | null {
  if (previous === null) return null; // Initial history is not a stream of new notifications.
  const fresh = events.filter(event => !previous.has(event.id) && isPendingEvent(event));
  if (fresh.some(isPriorityEvent)) return 'alert';
  if (!paused && fresh.some(isConsultation)) return 'question';
  return fresh.some(event => !isConsultation(event)) ? 'suggestion' : null;
}
export class LumiAudio {
  private context: AudioContext | null = null;
  private enabled = true;
  private next = 0;
  private nodes = new Set<OscillatorNode>();
  setEnabled(enabled: boolean) { this.enabled = enabled; if (!enabled) this.stop(); }
  unlock() {
    if (!this.enabled || typeof window === 'undefined') return;
    try {
      const Audio = window.AudioContext ?? (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Audio) return;
      this.context ??= new Audio();
      if (this.context.state === 'suspended') void this.context.resume().catch(() => {});
    } catch { /* Audio is optional, and never blocks an action. */ }
  }
  play(kind: LumiSound) {
    const context = this.context;
    if (!this.enabled || !context || context.state !== 'running' || document.visibilityState === 'hidden') return;
    const now = context.currentTime;
    if (now < this.next) return;
    const short = kind === 'tap';
    const step = short ? .055 : .105;
    this.next = now + CUES[kind].length * step + .03;
    try {
      CUES[kind].forEach((frequency, index) => {
        const oscillator = context.createOscillator(), gain = context.createGain();
        const start = now + index * step, end = start + step * .9;
        oscillator.type = 'sine'; oscillator.frequency.value = frequency;
        gain.gain.setValueAtTime(0, start); gain.gain.linearRampToValueAtTime(short ? .025 : .06, start + .008);
        gain.gain.exponentialRampToValueAtTime(.0001, end);
        oscillator.connect(gain); gain.connect(context.destination); this.nodes.add(oscillator);
        oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); this.nodes.delete(oscillator); };
        oscillator.start(start); oscillator.stop(end + .01);
      });
    } catch { /* Device/context interruptions must not affect the UI. */ }
  }
  stop() { for (const oscillator of this.nodes) { try { oscillator.stop(); } catch {} } this.nodes.clear(); this.next = 0; }
  dispose() { this.stop(); if (this.context) void this.context.close().catch(() => {}); this.context = null; }
}
