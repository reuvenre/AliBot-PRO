'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/hooks/useAuth';
import { Sidebar } from '@/components/layout/Sidebar';
import { Loader2 } from 'lucide-react';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, isLoading, router]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#080a13] flex items-center justify-center">
        <Loader2 size={24} className="animate-spin text-blue-400" />
      </div>
    );
  }

  if (!isAuthenticated) return null;

  return (
    <div className="min-h-screen bg-[#080a13]">
      <Sidebar />
      <main className="mr-60 min-h-screen bg-[#080a13]">
        <div className="max-w-[1080px] mx-auto px-6 py-7">
          {children}
        </div>
      </main>
    </div>
  );
}
