import type { LumiSession } from './lumi-state';
export type LumiMessage = LumiSession['messages'][number];

/** Stable across polling and the server's rolling history window. */
export function messageKeys(messages: LumiMessage[]): string[] {
  const counts = new Map<string, number>();
  return messages.map(message => {
    const signature = JSON.stringify([message.at, message.role, message.text]);
    const occurrence = counts.get(signature) ?? 0;
    counts.set(signature, occurrence + 1);
    return signature + ':' + occurrence;
  });
}
export function isNearHistoryEnd(scrollHeight: number, clientHeight: number, scrollTop: number) {
  return scrollHeight - clientHeight - scrollTop <= 64;
}
