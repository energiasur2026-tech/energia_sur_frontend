'use client';
import { Fragment, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabaseBrowser } from '@/lib/supabase-browser';

/** Unmount previous requests and visible tenant data before changing identity or meter. */
export function MeterContextBoundary({ userId, children }: { userId: string; children: React.ReactNode }) {
  const search = useSearchParams();
  const meter = search.get('meterId') ?? '';
  const router = useRouter();
  const [invalidIdentity, setInvalidIdentity] = useState(false);
  useEffect(() => {
    const { data } = supabaseBrowser().auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT' || (session?.user.id && session.user.id !== userId)) {
        setInvalidIdentity(true);
        router.replace('/login');
        router.refresh();
      }
    });
    return () => data.subscription.unsubscribe();
  }, [router, userId]);
  if (invalidIdentity) return null;
  return <Fragment key={userId + ':' + meter}>{children}</Fragment>;
}
