'use client';

import { useRouter } from 'next/navigation';
import { useEffect, ReactNode } from 'react';
import { useAppSelector } from '@/store/hooks';

export default function ProtectedLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  // const state = useAppSelector((state) => state);
  // console.log('ProtectedLayout state:', state);
  const user = useAppSelector((state) => state.user);

  useEffect(() => {
    if (!user || !user.id) {
      // Not logged in → back to home or login
      router.push('/sign-in');
    }
  }, [user, router]);


  if (!user || !user.id) {
    return null;
  }

  // Once we know there is a user:
  return <>{children}</>;
}
