'use client';

import { useEffect } from 'react';
import { isLegacyRecoveryCallback } from '@/lib/password-recovery';

/** Existing dashboard emails may still target /login#...&type=recovery. */
export function LegacyRecoveryRedirect() {
  useEffect(() => {
    if (isLegacyRecoveryCallback(window.location.href)) {
      window.location.replace(`/restablecer-clave${window.location.search}${window.location.hash}`);
    }
  }, []);
  return null;
}
