'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { authUtils } from '@/lib/auth';

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    // Check authentication status and redirect accordingly
    if (authUtils.isAuthenticated()) {
      router.push('/dashboard');
    } else {
      router.push('/login');
    }
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-indigo-600 mx-auto"></div>
        <p className="mt-4 text-gray-600">Ачаалж байна...</p>
      </div>
    </div>
  );
}
