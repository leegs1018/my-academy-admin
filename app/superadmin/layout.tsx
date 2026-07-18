'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';

const menuItems = [
  { href: '/superadmin',                   label: '데이터 분석',       icon: '📊' },
  { href: '/superadmin/academies',         label: '학원 관리',         icon: '🏫' },
  { href: '/superadmin/credits-pricing',   label: 'CON 관리',          icon: '⭐' },
  { href: '/superadmin/con-history',       label: 'CON 이력 조회',     icon: '📋' },
  { href: '/superadmin/sms',               label: 'SMS 발송',          icon: '📱' },
  { href: '/superadmin/mock-exams',        label: '모의고사 지문 관리', icon: '📚' },
  { href: '/superadmin/question-reports',  label: '문제 신고 관리',    icon: '🚨' },
  { href: '/superadmin/inquiries',         label: '문의 관리',         icon: '💬' },
  { href: '/superadmin/notices',           label: '공지사항 관리',     icon: '📢' },
  { href: '/superadmin/site-settings',     label: '사이트 설정',       icon: '⚙️' },
];

interface NotifCounts {
  inquiries: number;
  newAcademies: number;
  reports: number;
}

export default function SuperAdminLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [notifs, setNotifs] = useState<NotifCounts>({ inquiries: 0, newAcademies: 0, reports: 0 });
  const [notifOpen, setNotifOpen] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);
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

  const fetchNotifs = useCallback(async () => {
    try {
      const res = await fetch('/api/superadmin/notifications');
      if (!res.ok) return;
      const data = await res.json() as NotifCounts;
      setNotifs(data);
    } catch { /* silent */ }
  }, []);

  useEffect(() => {
    fetchNotifs();
    const interval = setInterval(fetchNotifs, 60_000);
    return () => clearInterval(interval);
  }, [fetchNotifs]);

  // 알림 패널 바깥 클릭 시 닫기
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setNotifOpen(false);
      }
    };
    if (notifOpen) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [notifOpen]);

  const handleLogout = async () => {
    if (!confirm('로그아웃 하시겠습니까?')) return;
    await supabase.auth.signOut();
    router.replace('/login');
  };

  const totalCount = notifs.inquiries + notifs.newAcademies + notifs.reports;

  const notifItems = [
    {
      label: '미답변 문의',
      count: notifs.inquiries,
      icon: '💬',
      href: '/superadmin/inquiries',
      color: 'text-sky-400',
      bg: 'bg-sky-500/10',
    },
    {
      label: '신규 가입 학원',
      count: notifs.newAcademies,
      icon: '🏫',
      href: '/superadmin/academies',
      color: 'text-emerald-400',
      bg: 'bg-emerald-500/10',
      sub: '7일 이내',
    },
    {
      label: '미처리 문제 신고',
      count: notifs.reports,
      icon: '🚨',
      href: '/superadmin/question-reports',
      color: 'text-rose-400',
      bg: 'bg-rose-500/10',
    },
  ];

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

          <div className="flex items-center gap-2">
            {/* 알림 벨 */}
            <div className="relative" ref={notifRef}>
              <button
                onClick={() => setNotifOpen(prev => !prev)}
                className={`relative p-2.5 rounded-xl transition-all ${notifOpen ? 'bg-slate-700 text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
                {totalCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] flex items-center justify-center bg-rose-500 text-white text-[10px] font-black rounded-full px-1 animate-pulse">
                    {totalCount > 99 ? '99+' : totalCount}
                  </span>
                )}
              </button>

              {/* 드롭다운 */}
              {notifOpen && (
                <div className="absolute right-0 top-full mt-2 w-72 bg-slate-800 border border-slate-700 rounded-2xl shadow-2xl shadow-black/40 overflow-hidden z-50">
                  <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700">
                    <p className="text-sm font-black text-white">알림</p>
                    {totalCount > 0 && (
                      <span className="text-xs font-black bg-rose-500 text-white px-2 py-0.5 rounded-full">{totalCount}건</span>
                    )}
                  </div>

                  <div className="py-2">
                    {notifItems.map(item => (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={() => setNotifOpen(false)}
                        className="flex items-center gap-3 px-4 py-3 hover:bg-slate-700/50 transition-all"
                      >
                        <div className={`w-9 h-9 ${item.bg} rounded-xl flex items-center justify-center flex-shrink-0 text-base`}>
                          {item.icon}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold text-slate-200">{item.label}</p>
                          {item.sub && <p className="text-[10px] text-slate-500 font-medium">{item.sub}</p>}
                        </div>
                        <div className="flex-shrink-0">
                          {item.count > 0 ? (
                            <span className={`text-sm font-black ${item.color}`}>{item.count}건</span>
                          ) : (
                            <span className="text-xs font-bold text-slate-600">없음</span>
                          )}
                        </div>
                      </Link>
                    ))}
                  </div>

                  <div className="px-4 py-2.5 border-t border-slate-700">
                    <button
                      onClick={() => { fetchNotifs(); }}
                      className="w-full text-xs font-bold text-slate-500 hover:text-slate-300 transition-colors flex items-center justify-center gap-1.5"
                    >
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                      새로고침
                    </button>
                  </div>
                </div>
              )}
            </div>

            <button
              onClick={handleLogout}
              className="px-4 py-2 text-sm font-black text-slate-400 hover:text-red-400 hover:bg-slate-800 rounded-xl transition-all"
            >
              로그아웃
            </button>
          </div>
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
