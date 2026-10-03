'use client';

import { createBrowserClient } from '@supabase/ssr';
import { publicSupabaseEnv } from './env-public';

/** Cliente Supabase de navegador, para login/registro. Respeta RLS. */
export function supabaseBrowser() {
  const { url, anonKey } = publicSupabaseEnv();
  return createBrowserClient(url, anonKey);
}
