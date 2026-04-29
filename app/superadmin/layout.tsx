'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';

const menuItems = [
  { href: '/superadmin',             label: '데이터 분석',    icon: '📊' },
  { href: '/superadmin/academies',   label: '학원 관리',      icon: '🏫' },
  { href: '/superadmin/sms',         label: 'SMS 발송',       icon: '📱' },
  { href: '/superadmin/notices',     label: '공지사항 관리',  icon: '📢' },
  { href: '/superadmin/inquiries',   label: '문의 관리',      icon: '💬' },
];

export default function SuperAdminLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const check = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.replace('/login'); return; }
      if (session.user.email !== process.env.NEXT_PUBLIC_SUPER_ADMIN_EMAIL) {
        router.replace('/admin');
      }
    };
    check();
  }, [router]);

  const handleLogout = async () => {
    if (!confirm('로그아웃 하시겠습니까?')) return;
    await supabase.auth.signOut();
    router.replace('/login');
  };

  return (
    <div className="flex h-screen overflow-hidden bg-slate-950">

          {/* 사이드바 */}
          <aside className={`fixed top-0 left-0 h-full z-40 flex flex-col bg-slate-900 border-r border-slate-800 transition-all duration-300 ease-in-out ${sidebarOpen ? 'w-64 shadow-2xl' : 'w-0 overflow-hidden'}`}>
            <div className="flex items-center gap-3 px-6 h-16 border-b border-slate-800 flex-shrink-0">
              <div className="w-9 h-9 bg-indigo-600 rounded-xl flex items-center justify-center flex-shrink-0">
                <span className="text-white font-black text-base">S</span>
              </div>
              <div>
                <p className="text-base font-black text-white whitespace-nowrap">CON EDU 관리자</p>
                <p className="text-[9px] font-bold text-slate-500 tracking-widest whitespace-nowrap">CON EDU 운영 관리</p>
              </div>
            </div>

            <nav className="flex-1 overflow-y-auto py-4 px-3">
              <div className="space-y-0.5">
                {menuItems.map((item) => {
                  const isActive = item.href === '/superadmin' ? pathname === '/superadmin' : pathname.startsWith(item.href);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setSidebarOpen(false)}
                      className={`flex items-center gap-3 px-4 py-3 rounded-xl text-base font-bold transition-all whitespace-nowrap ${isActive ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}
                    >
                      <span className="text-lg flex-shrink-0">{item.icon}</span>
                      <span>{item.label}</span>
                    </Link>
                  );
                })}
              </div>
            </nav>

            <div className="flex-shrink-0 px-3 py-4 border-t border-slate-800">
              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold text-slate-500 hover:bg-red-900/30 hover:text-red-400 transition-all whitespace-nowrap"
              >
                <span>🚪</span>
                <span>로그아웃</span>
              </button>
            </div>
          </aside>

          {/* 메인 */}
          <div className={`flex-1 flex flex-col overflow-hidden transition-all duration-300 ${sidebarOpen ? 'ml-64' : 'ml-0'}`}>
            <header className="flex-shrink-0 h-16 flex items-center justify-between px-4 md:px-6 bg-slate-900 border-b border-slate-800 z-30">
              <div className="flex items-center gap-4">
                <button
                  onClick={() => setSidebarOpen(!sidebarOpen)}
                  className="flex flex-col gap-1.5 p-2 rounded-xl hover:bg-slate-800 transition-all"
                >
                  <span className={`block w-5 h-0.5 bg-slate-400 rounded-full transition-all duration-300 ${sidebarOpen ? 'rotate-45 translate-y-2' : ''}`}></span>
                  <span className={`block w-5 h-0.5 bg-slate-400 rounded-full transition-all duration-300 ${sidebarOpen ? 'opacity-0' : ''}`}></span>
                  <span className={`block w-5 h-0.5 bg-slate-400 rounded-full transition-all duration-300 ${sidebarOpen ? '-rotate-45 -translate-y-2' : ''}`}></span>
                </button>
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
                    <span className="text-white font-black text-sm">S</span>
                  </div>
                  <span className="font-black text-white text-lg hidden sm:block">CON EDU <span className="text-indigo-400">관리자</span></span>
                </div>
              </div>
              <button
                onClick={handleLogout}
                className="px-4 py-2 text-sm font-black text-slate-400 hover:text-red-400 hover:bg-slate-800 rounded-xl transition-all"
              >
                로그아웃
              </button>
            </header>

            <main className="flex-1 overflow-y-auto bg-slate-950">
              <div className="max-w-7xl mx-auto px-4 md:px-6 py-6">
                {children}
              </div>
            </main>
          </div>
    </div>
  );
}
