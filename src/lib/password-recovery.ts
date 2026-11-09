import type { SupabaseClient } from '@supabase/supabase-js';

export type RecoveryCallback =
  | { kind: 'error' }
  | { kind: 'code'; code: string; flowId?: string }
  | { kind: 'tokens'; accessToken: string; refreshToken: string }
  | { kind: 'otp'; tokenHash: string }
  | { kind: 'session' };

/** Read once, before removing credentials from the address bar. Never log it. */
export function parseRecoveryCallback(href: string): RecoveryCallback {
  const url = new URL(href);
  const hash = new URLSearchParams(url.hash.slice(1));
  if (hash.has('error') || hash.has('error_code') || url.searchParams.has('error') || url.searchParams.has('error_code')) return { kind: 'error' };
  if (url.searchParams.has('code')) {
    const code = url.searchParams.get('code');
    const flowId = url.searchParams.get('sb_flow_id') || undefined;
    return code ? { kind: 'code', code, ...(flowId ? { flowId } : {}) } : { kind: 'error' };
  }
  if (hash.has('access_token') || hash.has('refresh_token')) {
    const accessToken = hash.get('access_token');
    const refreshToken = hash.get('refresh_token');
    return hash.get('type') === 'recovery' && accessToken && refreshToken
      ? { kind: 'tokens', accessToken, refreshToken } : { kind: 'error' };
  }
  if (url.searchParams.has('token_hash')) {
    const tokenHash = url.searchParams.get('token_hash');
    return url.searchParams.get('type') === 'recovery' && tokenHash ? { kind: 'otp', tokenHash } : { kind: 'error' };
  }
  return { kind: 'session' };
}

export function isLegacyRecoveryCallback(href: string): boolean {
  const url = new URL(href);
  const hash = new URLSearchParams(url.hash.slice(1));
  return hash.get('type') === 'recovery' || url.searchParams.get('type') === 'recovery'
    || hash.has('error_code') || url.searchParams.get('recovery') === '1';
}

export const INVALID_RECOVERY = 'El enlace no es válido o venció. Solicitá un nuevo correo de recuperación y abrilo en el mismo navegador donde lo pediste.';

/** Supabase verifies all credentials. A fragment or query flag alone grants nothing. */
export async function completePasswordRecovery(auth: SupabaseClient['auth'], callback: RecoveryCallback) {
  if (callback.kind === 'error') throw new Error(INVALID_RECOVERY);
  if (callback.kind === 'code') {
    const { error } = await auth.exchangeCodeForSession(callback.code, callback.flowId ? { flowId: callback.flowId } : undefined);
    if (error) throw new Error(INVALID_RECOVERY);
  } else if (callback.kind === 'tokens') {
    const { error } = await auth.setSession({ access_token: callback.accessToken, refresh_token: callback.refreshToken });
    if (error) throw new Error(INVALID_RECOVERY);
  } else if (callback.kind === 'otp') {
    const { error } = await auth.verifyOtp({ token_hash: callback.tokenHash, type: 'recovery' });
    if (error) throw new Error(INVALID_RECOVERY);
  }
  const { data, error } = await auth.getUser();
  if (error || !data.user) throw new Error(INVALID_RECOVERY);
}

export function validateNewPassword(password: string, confirmation: string): string | null {
  if (password.length < 8) return 'Usá al menos 8 caracteres para tu nueva contraseña.';
  if (password !== confirmation) return 'Las contraseñas no coinciden.';
  return null;
}

/** Display safe copy, never the SDK response, credential or request URL. */
export function recoveryErrorMessage(error: unknown): string {
  const code = error && typeof error === 'object' && 'code' in error ? error.code : '';
  if (code === 'same_password') return 'Elegí una contraseña diferente de la anterior.';
  if (code === 'weak_password') return 'La contraseña no cumple los requisitos del proyecto. Usá una más larga, con letras, números y símbolos.';
  if (code === 'over_email_send_rate_limit' || code === 'over_request_rate_limit') return 'Se alcanzó el límite de solicitudes. Esperá unos minutos antes de intentar nuevamente.';
  if (code === 'reauthentication_needed' || code === 'reauthentication_not_valid' || code === 'session_not_found' || code === 'refresh_token_not_found') return INVALID_RECOVERY;
  return 'No se pudo completar la operación. Revisá tu conexión e intentá nuevamente.';
}
