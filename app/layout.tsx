'use client';

import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import './globals.css';

const menuItems = [
  { href: '/admin',              label: '홈 대시보드',     icon: '🏠' },
  { href: '/admin/student',      label: '학생 등록 관리',  icon: '👤' },
  { href: '/admin/class',        label: '클래스 관리',     icon: '🏫' },
  { href: '/admin/student-list', label: '학생 명부',       icon: '📋' },
  { href: '/admin/grade-input',  label: '성적 관리',       icon: '✍️' },
  { href: '/admin/report',       label: '성적표 발행',     icon: '📈' },
  { href: '/admin/attendance',   label: '일정 및 출석관리', icon: '✅' },
  { href: '/admin/sms',          label: '문자 발송',       icon: '📱' },
  { href: '/admin/pdf-editor',   label: '영어 문제 생성',  icon: '📝' },
  { href: '/admin/notices',      label: '공지사항',        icon: '📢' },
];

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [academyName, setAcademyName] = useState('');
  const [kioskCode, setKioskCode] = useState('');
  const [isDark, setIsDark] = useState(false);
  const [showAccountMenu, setShowAccountMenu] = useState(false);
  const accountMenuRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const pathname = usePathname();

  // ── 테마 초기화 ─────────────────────────────────
  useEffect(() => {
    const saved = localStorage.getItem('con-edu-theme');
    if (saved === 'dark') {
      setIsDark(true);
      document.documentElement.classList.add('dark');
    }
  }, []);

  const toggleTheme = () => {
    const next = !isDark;
    setIsDark(next);
    if (next) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('con-edu-theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('con-edu-theme', 'light');
    }
  };

  // ── 학원 정보 로드 ───────────────────────────────
  useEffect(() => {
    const getAcademyInfo = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user?.id) {
        const { data } = await supabase
          .from('academy_config')
          .select('academy_name, kiosk_code')
          .eq('user_id', session.user.id)
          .single();
        if (data?.academy_name) setAcademyName(data.academy_name);
        if (data?.kiosk_code) setKioskCode(data.kiosk_code);
      }
    };
    getAcademyInfo();
  }, [pathname]);

  // ── 외부 클릭 시 메뉴 닫기 ──────────────────────
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (accountMenuRef.current && !accountMenuRef.current.contains(e.target as Node)) {
        setShowAccountMenu(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  const handleLogout = async () => {
    if (!confirm('로그아웃 하시겠습니까?')) return;
    setShowAccountMenu(false);
    await supabase.auth.signOut();
    localStorage.removeItem('con-edu-auto-login');
    router.replace('/');
  };

  const isLandingPage = pathname === '/';
  const isLoginPage = pathname === '/login';
  const isRegisterPage = pathname === '/register';
  const isKioskPage = pathname === '/kiosk';
  const showLayout = !isLandingPage && !isLoginPage && !isRegisterPage && !isKioskPage;

  if (!showLayout) {
    return (
      <html lang="ko">
        <body>{children}</body>
      </html>
    );
  }

  return (
    <html lang="ko">
      <body className="bg-gray-50 dark:bg-gray-900">
        <div className="flex h-screen overflow-hidden">

          {/* ── 사이드바 ─────────────────────────────────── */}
          <aside
            className={`
              fixed top-0 left-0 h-full z-40
              flex flex-col
              bg-white border-r border-gray-100
              transition-all duration-300 ease-in-out
              ${sidebarOpen ? 'w-64 shadow-xl' : 'w-0 overflow-hidden'}
            `}
          >
            {/* 사이드바 상단 로고 */}
            <div className="flex items-center gap-3 px-6 h-16 border-b border-gray-100 flex-shrink-0">
              <div className="w-9 h-9 bg-gray-900 rounded-xl flex items-center justify-center rotate-3 flex-shrink-0">
                <span className="text-yellow-400 font-black text-base italic">C</span>
              </div>
              <div className="-space-y-0.5">
                <p className="text-xl font-black tracking-tight text-gray-900 whitespace-nowrap">
                  CON <span className="text-yellow-500">EDU</span>
                </p>
                <p className="text-[9px] font-bold text-gray-400 tracking-widest whitespace-nowrap">MANAGEMENT CENTER</p>
              </div>
            </div>

            {/* 메뉴 목록 */}
            <nav className="flex-1 overflow-y-auto custom-scrollbar py-4 px-3">
              <div className="space-y-0.5">
                {menuItems.map((item) => {
                  const isActive = pathname === item.href;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setSidebarOpen(false)}
                      className={`
                        flex items-center gap-3 px-4 py-3 rounded-xl
                        text-base font-bold transition-all whitespace-nowrap
                        ${isActive
                          ? 'bg-gray-900 text-white shadow-sm'
                          : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                        }
                      `}
                    >
                      <span className="text-lg flex-shrink-0">{item.icon}</span>
                      <span>{item.label}</span>
                    </Link>
                  );
                })}
              </div>
            </nav>

            {/* 로그아웃 */}
            <div className="flex-shrink-0 px-3 py-4 border-t border-gray-100">
              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold text-gray-400 hover:bg-red-50 hover:text-red-500 transition-all whitespace-nowrap"
              >
                <span className="text-base">🚪</span>
                <span>로그아웃</span>
              </button>
            </div>
          </aside>

          {/* ── 메인 영역 ────────────────────────────────── */}
          <div className={`flex-1 flex flex-col overflow-hidden transition-all duration-300 ${sidebarOpen ? 'ml-64' : 'ml-0'}`}>

            {/* ── 상단 네비게이션 바 ── */}
            <header className="flex-shrink-0 h-16 flex items-center justify-between px-4 md:px-6 bg-white border-b border-gray-100 z-30 shadow-sm">

              {/* 왼쪽: 햄버거 + 로고 */}
              <div className="flex items-center gap-4">
                <button
                  onClick={() => setSidebarOpen(!sidebarOpen)}
                  className="flex flex-col gap-1.5 p-2 rounded-xl hover:bg-gray-100 transition-all group"
                  aria-label="메뉴 열기/닫기"
                >
                  <span className={`block w-5 h-0.5 bg-gray-700 rounded-full transition-all duration-300 ${sidebarOpen ? 'rotate-45 translate-y-2' : ''}`}></span>
                  <span className={`block w-5 h-0.5 bg-gray-700 rounded-full transition-all duration-300 ${sidebarOpen ? 'opacity-0' : ''}`}></span>
                  <span className={`block w-5 h-0.5 bg-gray-700 rounded-full transition-all duration-300 ${sidebarOpen ? '-rotate-45 -translate-y-2' : ''}`}></span>
                </button>

                {!sidebarOpen && (
                  <Link href="/admin" className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-gray-900 rounded-lg flex items-center justify-center rotate-3">
                      <span className="text-yellow-400 font-black text-sm italic">C</span>
                    </div>
                    <span className="font-black text-gray-900 text-lg tracking-tight hidden sm:block">
                      CON <span className="text-yellow-500">EDU</span>
                    </span>
                  </Link>
                )}
              </div>

              {/* 오른쪽: 테마 선택 + 학원 이름 */}
              <div className="flex items-center gap-2 md:gap-3">

                {/* 테마 선택 버튼 2개 */}
                <div className="flex items-center gap-1 bg-gray-100 rounded-xl p-1">
                  <button
                    onClick={() => !isDark || toggleTheme()}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-bold transition-all ${
                      !isDark ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-400 hover:text-gray-600'
                    }`}
                  >
                    <span>☀️</span>
                    <span className="hidden sm:inline">라이트</span>
                  </button>
                  <button
                    onClick={() => isDark || toggleTheme()}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-bold transition-all ${
                      isDark ? 'bg-gray-900 text-white shadow-sm' : 'text-gray-400 hover:text-gray-600'
                    }`}
                  >
                    <span>🌙</span>
                    <span className="hidden sm:inline">다크</span>
                  </button>
                </div>

                {/* 학원 이름 드롭다운 */}
                <div className="relative" ref={accountMenuRef}>
                  <button
                    onClick={() => setShowAccountMenu(!showAccountMenu)}
                    className="flex items-center gap-2 px-3 py-2 rounded-xl hover:bg-gray-100 transition-all"
                  >
                    <div className="w-8 h-8 bg-gray-900 rounded-lg flex items-center justify-center flex-shrink-0">
                      <span className="text-white text-sm font-black">
                        {academyName ? academyName.charAt(0) : 'A'}
                      </span>
                    </div>
                    <span className="text-base font-black text-gray-800 hidden sm:block max-w-[140px] truncate">
                      {academyName || '내 학원'}
                    </span>
                    <span className="text-gray-400 text-xs">▼</span>
                  </button>

                  {/* 드롭다운 메뉴 */}
                  {showAccountMenu && (
                    <div className="absolute right-0 top-full mt-2 w-64 bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden z-50">
                      {/* 학원 정보 헤더 */}
                      <div className="px-5 py-4 bg-gray-50 border-b border-gray-100">
                        <p className="font-black text-gray-900 text-sm">{academyName || '내 학원'}</p>
                        {kioskCode && (
                          <div className="mt-2">
                            <p className="text-[10px] text-gray-400 font-bold">출결 키오스크 코드</p>
                            <p className="text-xl font-black text-gray-900 tracking-[0.2em] mt-0.5">{kioskCode}</p>
                          </div>
                        )}
                      </div>

                      {/* 메뉴 항목 */}
                      <div className="py-2">
                        <Link
                          href="/admin/account"
                          onClick={() => setShowAccountMenu(false)}
                          className="flex items-center gap-3 px-5 py-3 hover:bg-gray-50 transition-colors text-sm font-bold text-gray-700"
                        >
                          <span>👤</span> 계정 정보
                        </Link>
                        <div className="mx-4 border-t border-gray-100 my-1"></div>
                        <button
                          onClick={handleLogout}
                          className="w-full flex items-center gap-3 px-5 py-3 hover:bg-red-50 transition-colors text-sm font-bold text-red-500"
                        >
                          <span>🚪</span> 로그아웃
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </header>

            {/* ── 페이지 콘텐츠 ── */}
            <main className="flex-1 overflow-y-auto bg-gray-50">
              <div className="max-w-7xl mx-auto px-4 md:px-6 py-6">
                {children}
              </div>
            </main>
          </div>
        </div>
      </body>
    </html>
  );
}
