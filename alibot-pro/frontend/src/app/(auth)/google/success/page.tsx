'use client';

import { Suspense, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { setAccessToken } from '@/lib/api-client';
import { Loader2 } from 'lucide-react';

function Handler() {
  const params = useSearchParams();

  useEffect(() => {
    const token = params.get('token');
    if (token) {
      setAccessToken(token);
      // Hard redirect so AuthProvider remounts and re-runs bootstrap()
      // which picks up the new HttpOnly refresh cookie set by the backend
      window.location.replace('/dashboard');
    } else {
      window.location.replace('/login?error=google_failed');
    }
  }, [params]);

  return null;
}

export default function GoogleSuccessPage() {
  return (
    <div className="min-h-screen bg-[#080b14] flex items-center justify-center">
      <Loader2 size={28} className="animate-spin text-blue-400" />
      <Suspense><Handler /></Suspense>
    </div>
  );
}
