'use client';

import { useEffect } from 'react';
import { Loader2 } from 'lucide-react';

export default function GoogleSuccessPage() {
  useEffect(() => {
    // The backend already set the HttpOnly refresh cookie. A hard redirect remounts
    // AuthProvider, whose bootstrap() exchanges that cookie for an access token via
    // /auth/refresh — no token is ever passed through the URL.
    window.location.replace('/dashboard');
  }, []);

  return (
    <div className="min-h-screen bg-surface-primary flex items-center justify-center">
      <Loader2 size={28} className="animate-spin text-blue-400" />
    </div>
  );
}
