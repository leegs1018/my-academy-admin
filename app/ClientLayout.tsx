'use client';

import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';

type FlatMenuItem = { href: string; label: string; icon: string; children?: never };
type GroupMenuItem = { label: string; icon: string; children: FlatMenuItem[]; href?: never };
type MenuItem = FlatMenuItem | GroupMenuItem;

const menuItems: MenuItem[] = [
  { href: '/admin',              label: '홈 대시보드',     icon: '🏠' },
  { href: '/admin/student',      label: '학생 등록',       icon: '👤' },
  { href: '/admin/class',        label: '클래스 관리',     icon: '🏫' },
  { href: '/admin/student-list', label: '학생 명부',       icon: '📋' },
  { href: '/admin/grade-input',  label: '성적 관리',       icon: '✍️' },
  { href: '/admin/report',       label: '성적표 발행',     icon: '📈' },
  { href: '/admin/attendance',   label: '일정 및 출석관리', icon: '✅' },
  { href: '/admin/sms',          label: '문자 발송',       icon: '📱' },
  {
    label: 'AI 문제 생성',
    icon: '🤖',
    children: [
      { href: '/admin/pdf-editor',    label: '지문분석',      icon: '📝' },
      { href: '/admin/vocab-choice',  label: '워크북',          icon: '📒' },
      { href: '/admin/ai-questions',  label: '실전 변형 문제', icon: '🎯' },
    ],
  },
  { href: '/admin/guide',        label: '이용 가이드',     icon: '📖' },
  { href: '/admin/con-charge',   label: 'CON 충전',        icon: '💳' },
  { href: '/admin/con-history',  label: 'CON 사용 이력',   icon: '⭐' },
  { href: '/admin/notices',      label: '공지사항',        icon: '📢' },
  { href: '/admin/inquiries',    label: '문의하기',        icon: '💬' },
];

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [academyName, setAcademyName] = useState('');
  const [kioskCode, setKioskCode] = useState('');
  const [ownReferralCode, setOwnReferralCode] = useState('');
  const [copiedReferral, setCopiedReferral] = useState(false);
  const [referralRewardCon, setReferralRewardCon] = useState<number | null>(null);
  const [points, setPoints] = useState<number>(0);
  const [userRole, setUserRole] = useState<string>('');
  const [smsEnabled, setSmsEnabled] = useState(false);
  const [notificationMethod, setNotificationMethod] = useState<'sms' | 'alimtalk'>('sms');
  const [notifyMethodSaving, setNotifyMethodSaving] = useState(false);
  const [isDark, setIsDark] = useState(false);
  const [showAccountMenu, setShowAccountMenu] = useState(false);
  const [userId, setUserId] = useState('');
  const [userEmail, setUserEmail] = useState('');
  const [expandedGroup, setExpandedGroup] = useState<string | null>(null);
  const accountMenuRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const pathname = usePathname();

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

  useEffect(() => {
    const getAcademyInfo = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user?.id) {
        setUserId(session.user.id);
        setUserEmail(session.user.email ?? '');
        const { data } = await supabase
          .from('academy_config')
          .select('academy_name, kiosk_code, points, role, own_referral_code, sms_enabled, notification_method')
          .eq('user_id', session.user.id)
          .single();
        if (data?.academy_name) setAcademyName(data.academy_name);
        if (data?.kiosk_code) setKioskCode(data.kiosk_code);
        if (data?.points !== undefined) setPoints(data.points);
        setUserRole(data?.role ?? 'ai_only');
        setSmsEnabled(data?.sms_enabled ?? false);
        setNotificationMethod((data?.notification_method ?? 'sms') as 'sms' | 'alimtalk');
        if (data?.own_referral_code) {
          setOwnReferralCode(data.own_referral_code);
        } else {
          // 코드가 없으면 생성 후 저장
          const newCode = Math.random().toString(36).slice(2, 10).toUpperCase();
          setOwnReferralCode(newCode);
          await supabase.from('academy_config')
            .update({ own_referral_code: newCode })
            .eq('user_id', session.user.id);
        }
        // 추천인 보상 단가 조회
        fetch('/api/credits/pricing')
          .then(r => r.ok ? r.json() : null)
          .then(d => {
            const item = (d?.pricing ?? []).find((p: { feature_key: string; cost_per_use: number }) => p.feature_key === 'referral_reward');
            if (item) setReferralRewardCon(item.cost_per_use);
          })
          .catch(() => {});
      }
    };
    getAcademyInfo();
  }, [pathname]);

  useEffect(() => {
    const aiPaths = ['/admin/pdf-editor', '/admin/ai-questions', '/admin/vocab-choice'];
    if (aiPaths.some(p => pathname.startsWith(p))) setExpandedGroup('AI 문제 생성');
  }, [pathname]);

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (accountMenuRef.current && !accountMenuRef.current.contains(e.target as Node)) {
        setShowAccountMenu(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  const handleNotificationMethodChange = async (method: 'sms' | 'alimtalk') => {
    setNotifyMethodSaving(true);
    setNotificationMethod(method);
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user?.id) {
      await supabase.from('academy_config').update({ notification_method: method }).eq('user_id', session.user.id);
    }
    setNotifyMethodSaving(false);
  };

  const handleLogout = async () => {
    if (!confirm('로그아웃 하시겠습니까?')) return;
    setShowAccountMenu(false);
    await supabase.auth.signOut();
    localStorage.removeItem('con-edu-auto-login');
    router.replace('/');
  };

  // 채널톡 부트 (어드민 페이지 + 로그인 상태일 때만)
  useEffect(() => {
    const isAdminPage = pathname.startsWith('/admin');
    if (!isAdminPage || !userId) return;

    const w = window as Window & { ChannelIO?: (...args: unknown[]) => void; ChannelIOInitialized?: boolean };
    if (!w.ChannelIO) {
      const ch = (...args: unknown[]) => { (ch as unknown as { q: unknown[][] }).q.push(args); };
      (ch as unknown as { q: unknown[][] }).q = [];
      w.ChannelIO = ch;
    }
    if (!w.ChannelIOInitialized) {
      w.ChannelIOInitialized = true;
      const s = document.createElement('script');
      s.type = 'text/javascript';
      s.async = true;
      s.src = 'https://cdn.channel.io/plugin/ch-plugin-web.js';
      document.head.appendChild(s);
    }
    w.ChannelIO?.('boot', {
      pluginKey: '726879dd-d88e-45b4-9be0-d5783785e361',
      memberId: userId,
      profile: { name: academyName || undefined, email: userEmail || undefined },
    });

    return () => {
      w.ChannelIO?.('shutdown');
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, userId, academyName]);

  const isLandingPage = pathname === '/';
  const isLoginPage = pathname === '/login';
  const isRegisterPage = pathname === '/register';
  const isKioskPage = pathname === '/kiosk';
  const isSuperAdminPage = pathname.startsWith('/superadmin');
  const isPublicPage = pathname === '/guide' || pathname === '/support' || pathname === '/privacy' || pathname === '/terms'
    || pathname === '/find-account' || pathname.startsWith('/auth/reset-password') || pathname.startsWith('/auth/complete-profile');
  const showLayout = !isLandingPage && !isLoginPage && !isRegisterPage && !isKioskPage && !isSuperAdminPage && !isPublicPage;

  if (!showLayout) {
    return <>{children}</>;
  }

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50 dark:bg-gray-900">

      {/* 사이드바 */}
      <aside
        className={`
          fixed top-0 left-0 h-full z-40
          flex flex-col
          bg-white border-r border-gray-100
          transition-all duration-300 ease-in-out
          ${sidebarOpen ? 'w-64 shadow-xl' : 'w-0 overflow-hidden'}
        `}
      >
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

        <nav className="flex-1 overflow-y-auto custom-scrollbar py-4 px-3">
          <div className="space-y-0.5">
            {(userRole === 'admin'
              ? menuItems
              : menuItems.filter(item =>
                  item.label === 'AI 문제 생성' || item.label === '이용 가이드' || item.label === 'CON 충전' || item.label === 'CON 사용 이력' || item.label === '공지사항' || item.label === '문의하기'
                )
            ).filter(item =>
              item.label !== '문자 발송' || smsEnabled
            ).map((item) => {
              if (item.children) {
                const isAnyChildActive = item.children.some(c => pathname.startsWith(c.href));
                const isExpanded = expandedGroup === item.label || isAnyChildActive;
                return (
                  <div key={item.label}>
                    <button
                      onClick={() => setExpandedGroup(isExpanded ? null : item.label)}
                      className={`
                        w-full flex items-center gap-3 px-4 py-3 rounded-xl
                        text-base font-bold transition-all whitespace-nowrap
                        ${isAnyChildActive
                          ? 'text-gray-900 bg-gray-50'
                          : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                        }
                      `}
                    >
                      <span className="text-lg flex-shrink-0">{item.icon}</span>
                      <span className="flex-1 text-left">{item.label}</span>
                      <span className="text-xs text-gray-400">{isExpanded ? '▾' : '▸'}</span>
                    </button>
                    {isExpanded && (
                      <div className="ml-4 mt-0.5 space-y-0.5">
                        {item.children.map((child) => {
                          const isChildActive = pathname === child.href;
                          return (
                            <Link
                              key={child.href}
                              href={child.href}
                              onClick={() => setSidebarOpen(false)}
                              className={`
                                flex items-center gap-3 pl-4 pr-4 py-2.5 rounded-xl
                                text-sm font-bold transition-all whitespace-nowrap
                                ${isChildActive
                                  ? 'bg-gray-900 text-white shadow-sm'
                                  : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900'
                                }
                              `}
                            >
                              <span className="text-base flex-shrink-0">{child.icon}</span>
                              <span>{child.label}</span>
                            </Link>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              }
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

      {/* 메인 영역 */}
      <div className={`flex-1 flex flex-col overflow-hidden transition-all duration-300 ${sidebarOpen ? 'ml-64' : 'ml-0'}`}>

        {/* 상단 네비게이션 바 */}
        <header className="flex-shrink-0 h-16 flex items-center justify-between px-4 md:px-6 bg-white border-b border-gray-100 z-30 shadow-sm">
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

          <div className="flex items-center gap-2 md:gap-3">
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
                <span className="hidden sm:block text-xs font-black text-yellow-600 bg-yellow-50 px-2 py-0.5 rounded-lg whitespace-nowrap">
                  {points.toLocaleString()}C
                </span>
                <span className="text-gray-400 text-xs">▼</span>
              </button>

              {showAccountMenu && (
                <div className="absolute right-0 top-full mt-2 w-64 bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden z-50">
                  <div className="px-5 py-4 bg-gray-50 border-b border-gray-100">
                    <p className="font-black text-gray-900 text-sm">{academyName || '내 학원'}</p>
                    {kioskCode && (
                      <div className="mt-2">
                        <p className="text-[10px] text-gray-400 font-bold">출결 키오스크 코드</p>
                        <p className="text-xl font-black text-gray-900 tracking-[0.2em] mt-0.5">{kioskCode}</p>
                      </div>
                    )}
                    {ownReferralCode && (
                      <div className="mt-2">
                        <p className="text-[10px] text-gray-400 font-bold">내 추천인 코드</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <p className="text-base font-black text-indigo-700 tracking-[0.15em]">{ownReferralCode}</p>
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(ownReferralCode);
                              setCopiedReferral(true);
                              setTimeout(() => setCopiedReferral(false), 2000);
                            }}
                            className="text-[10px] font-black px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-600 hover:bg-indigo-200 transition-colors"
                          >
                            {copiedReferral ? '복사됨!' : '복사'}
                          </button>
                        </div>
                        <p className="text-[9px] text-gray-400 font-bold mt-0.5">
                          내 코드로 가입 시 나에게{referralRewardCon !== null ? ` ${referralRewardCon}C` : ''} 보상 적립
                        </p>
                      </div>
                    )}
                  </div>
                  <div className="py-2">
                    {smsEnabled && (
                      <div className="px-5 py-3 border-b border-gray-100">
                        <p className="text-[10px] text-gray-400 font-bold mb-2">출결 알림 방법</p>
                        <div className="flex rounded-xl overflow-hidden border-2 border-gray-200 text-xs font-black">
                          <button
                            onClick={() => handleNotificationMethodChange('sms')}
                            disabled={notifyMethodSaving}
                            className={`flex-1 py-2 transition-all ${notificationMethod === 'sms' ? 'bg-green-600 text-white' : 'bg-white text-gray-400 hover:bg-gray-50'}`}
                          >
                            SMS
                          </button>
                          <button
                            onClick={() => handleNotificationMethodChange('alimtalk')}
                            disabled={notifyMethodSaving}
                            className={`flex-1 py-2 transition-all ${notificationMethod === 'alimtalk' ? 'bg-yellow-400 text-black' : 'bg-white text-gray-400 hover:bg-gray-50'}`}
                          >
                            알림톡
                          </button>
                        </div>
                      </div>
                    )}
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

        <main className="flex-1 overflow-y-auto bg-gray-50">
          <div className="max-w-7xl mx-auto px-4 md:px-6 py-6">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
