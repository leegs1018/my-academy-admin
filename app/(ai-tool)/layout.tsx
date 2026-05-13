'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';

export default function AiToolLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [conBalance, setConBalance] = useState<number | null>(null);
  const [academyName, setAcademyName] = useState('');

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      setAcademyName(session.user.user_metadata?.academy_name ?? '');

      const res = await fetch('/api/credits/transactions', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (res.ok) {
        const json = await res.json() as { balance?: number };
        if (json.balance !== undefined) setConBalance(json.balance);
      }
    };
    init();
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* 헤더 */}
      <header className="bg-white border-b border-gray-100 shadow-sm sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-6 py-3 flex items-center justify-between">
          {/* 로고 + 타이틀 */}
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-indigo-600 rounded-xl flex items-center justify-center">
              <span className="text-white font-black text-sm">C</span>
            </div>
            <div>
              <p className="text-xs text-gray-400 font-bold leading-none">콘에듀</p>
              <p className="text-sm font-black text-gray-800 leading-tight">AI 문제생성</p>
            </div>
          </div>

          {/* 우측: 학원명 + CON + 로그아웃 */}
          <div className="flex items-center gap-4">
            {academyName && (
              <span className="text-sm font-bold text-gray-500 hidden sm:block">{academyName}</span>
            )}
            {conBalance !== null && (
              <div className="flex items-center gap-1.5 bg-amber-50 border border-amber-200 px-3 py-1.5 rounded-xl">
                <span className="text-xs font-black text-amber-600">CON</span>
                <span className="text-sm font-black text-amber-700">{conBalance.toLocaleString()}</span>
              </div>
            )}
            <button
              onClick={handleLogout}
              className="text-sm font-bold text-gray-400 hover:text-gray-700 border border-gray-200 hover:border-gray-300 px-3 py-1.5 rounded-xl transition-all"
            >
              로그아웃
            </button>
          </div>
        </div>
      </header>

      {/* 본문 */}
      <main className="flex-1 max-w-6xl mx-auto w-full px-6 py-8">
        {children}
      </main>
    </div>
  );
}
