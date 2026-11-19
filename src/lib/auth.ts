import 'server-only';

import { supabaseServer } from './supabase-server';
import { navigationMetadataKey, readNavigationPreference, type NavigationPreference } from './navigation-preference';

export type CurrentUser = { id: string; email: string | null; navigation: NavigationPreference | null };

/** Usuario autenticado según la cookie de sesión, o `null` si no hay sesión. */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  const client = await supabaseServer();
  const {
    data: { user },
  } = await client.auth.getUser();

  if (!user) return null;
  return { id: user.id, email: user.email ?? null, navigation: readNavigationPreference(user.user_metadata?.[navigationMetadataKey]) };
}
