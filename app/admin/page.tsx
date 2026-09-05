'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function DashboardPage() {
  const router = useRouter();
  const [stats, setStats] = useState({ studentCount: 0, classCount: 0, attendanceCount: 0 });
  const [ongoingClasses, setOngoingClasses] = useState<any[]>([]);
  const [recentNotices, setRecentNotices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [todayStr, setTodayStr] = useState('');
  const [profileComplete, setProfileComplete] = useState<boolean | null>(null);


  const fetchDashboardData = useCallback(async (userId: string) => {
    try {
      const now = new Date();
      const today = now.toISOString().split('T')[0];
      
      // 💡 시간 형식 맞춤 (HH:mm:ss)
      const hours = String(now.getHours()).padStart(2, '0');
      const minutes = String(now.getMinutes()).padStart(2, '0');
      const seconds = String(now.getSeconds()).padStart(2, '0');
      const currentTime = `${hours}:${minutes}:${seconds}`;

      const dayNames = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
      const todayField = dayNames[now.getDay()];

      // 🚀 병렬 데이터 로딩 (전체 쿼리를 동시에 처리)
      const [
        { count: sCount },
        { count: cCount },
        { count: aCount },
        { data: classData },
        { data: noticeData }
      ] = await Promise.all([
        supabase.from('students').select('*', { count: 'exact', head: true }).eq('academy_id', userId),
        supabase.from('classes').select('*', { count: 'exact', head: true }).eq('academy_id', userId),
        supabase.from('attendance').select('*', { count: 'exact', head: true })
          .eq('academy_id', userId)
          .eq('attendance_date', today)
          .eq('status', '등원'),
        // 💡 현재 요일에 해당하고, 시간이 겹치는 수업 필터링
        supabase.from('classes').select('*')
          .eq('academy_id', userId)
          .eq(todayField, true)
          .lte('start_time', currentTime)
          .gte('end_time', currentTime),
        // 시스템 공지 최신 3개
        supabase.from('system_notices').select('*')
          .order('is_important', { ascending: false })
          .order('created_at', { ascending: false })
          .limit(3)
      ]);

      setStats({
        studentCount: sCount || 0,
        classCount: cCount || 0,
        attendanceCount: aCount || 0
      });
      setOngoingClasses(classData || []);
      setRecentNotices(noticeData || []);

    } catch (error) {
      console.error("데이터 로드 실패:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    setTodayStr(new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' }));
  }, []);

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.replace('/login');
      } else {
        fetchDashboardData(session.user.id);
        // 프로필 완성 여부 확인
        const { data: cfg } = await supabase
          .from('academy_config')
          .select('academy_name, academy_phone, mobile')
          .eq('user_id', session.user.id)
          .single();
        if (cfg) {
          const complete = !!cfg.academy_name && (!!cfg.academy_phone || !!cfg.mobile);
          setProfileComplete(complete);
        }
      }
    };
    checkAuth();
  }, [router, fetchDashboardData]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="font-black text-indigo-500 text-xl animate-pulse">원장님, 데이터를 불러오고 있어요! 🚀</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-10 pb-20">
      {/* 상단 헤더 */}
      <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h1 className="text-3xl font-black text-gray-900 tracking-tight">대시보드</h1>
          <p className="text-gray-400 font-bold mt-1">오늘도 원장님의 열정을 응원합니다! 🔥</p>
        </div>
        <div className="bg-white px-5 py-2.5 rounded-2xl border border-gray-100 shadow-sm">
          <p className="font-black text-gray-700 text-sm">
            {todayStr}
          </p>
        </div>
      </header>

      {/* 프로필 미완성 배너 */}
      {profileComplete === false && (
        <Link href="/admin/account" className="flex items-center gap-4 bg-amber-50 border border-amber-200 rounded-3xl px-6 py-4 hover:bg-amber-100 transition-colors group">
          <span className="text-2xl">🎁</span>
          <div className="flex-1">
            <p className="font-black text-amber-800 text-sm">프로필을 완성하면 +200C를 드려요!</p>
            <p className="text-xs font-bold text-amber-500 mt-0.5">학원명 + 전화번호(또는 휴대폰)를 등록해주세요</p>
          </div>
          <span className="text-amber-400 font-black text-sm group-hover:translate-x-1 transition-transform">프로필 완성하기 ➜</span>
        </Link>
      )}

      {/* 핵심 요약 카드 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <StatCard label="Total Students" value={stats.studentCount} unit="명" color="border-indigo-500" icon="👤" />
        <StatCard label="Today Attendance" value={stats.attendanceCount} unit="명" color="border-emerald-500" icon="✅" />
        <StatCard label="Active Classes" value={stats.classCount} unit="개" color="border-orange-500" icon="🏫" />
      </div>

      {/* AI 문제 생성 섹션 */}
      <section>
        <div className="flex items-center gap-3 mb-5">
          <span className="w-2.5 h-7 bg-violet-500 rounded-full"></span>
          <h2 className="text-2xl font-black text-gray-900">AI 문제 생성</h2>
          <span className="text-xs bg-violet-100 text-violet-700 font-black px-3 py-1 rounded-full uppercase tracking-widest">NEW</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <Link href="/admin/pdf-editor" className="group relative bg-gradient-to-br from-indigo-600 to-indigo-800 p-7 rounded-[2.5rem] shadow-xl hover:-translate-y-1 hover:shadow-2xl transition-all duration-300 overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -mr-8 -mt-8 blur-2xl"></div>
            <div className="relative">
              <span className="text-4xl mb-4 block">📝</span>
              <h3 className="text-xl font-black text-white mb-1.5">지문 분석</h3>
              <p className="text-indigo-200 text-sm font-bold leading-relaxed mb-5">지문을 입력하면 AI가 자동으로<br/>어휘·구문·요약을 분석해드려요</p>
              <span className="inline-flex items-center gap-2 text-white font-black text-sm group-hover:gap-3 transition-all">
                바로가기 <span className="group-hover:translate-x-1 transition-transform">→</span>
              </span>
            </div>
          </Link>

          <Link href="/admin/vocab-choice" className="group relative bg-gradient-to-br from-emerald-500 to-teal-700 p-7 rounded-[2.5rem] shadow-xl hover:-translate-y-1 hover:shadow-2xl transition-all duration-300 overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -mr-8 -mt-8 blur-2xl"></div>
            <div className="relative">
              <span className="text-4xl mb-4 block">📒</span>
              <h3 className="text-xl font-black text-white mb-1.5">워크북</h3>
              <p className="text-emerald-100 text-sm font-bold leading-relaxed mb-5">어휘·어법·해석 등 다양한 유형의<br/>워크북 PDF를 자동 생성해드려요</p>
              <span className="inline-flex items-center gap-2 text-white font-black text-sm group-hover:gap-3 transition-all">
                바로가기 <span className="group-hover:translate-x-1 transition-transform">→</span>
              </span>
            </div>
          </Link>

          <Link href="/admin/ai-questions" className="group relative bg-gradient-to-br from-orange-500 to-rose-600 p-7 rounded-[2.5rem] shadow-xl hover:-translate-y-1 hover:shadow-2xl transition-all duration-300 overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -mr-8 -mt-8 blur-2xl"></div>
            <div className="relative">
              <span className="text-4xl mb-4 block">🎯</span>
              <h3 className="text-xl font-black text-white mb-1.5">실전 변형문제</h3>
              <p className="text-orange-100 text-sm font-bold leading-relaxed mb-5">수능 스타일의 변형문제를<br/>AI가 즉시 출제해드려요</p>
              <span className="inline-flex items-center gap-2 text-white font-black text-sm group-hover:gap-3 transition-all">
                바로가기 <span className="group-hover:translate-x-1 transition-transform">→</span>
              </span>
            </div>
          </Link>
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
        {/* 진행 중인 수업 현황 */}
        <section className="bg-slate-900 p-8 rounded-[3rem] shadow-2xl text-white relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 rounded-full -mr-10 -mt-10 blur-3xl"></div>
          <h3 className="text-2xl font-black mb-8 flex items-center gap-3">
            <span className="w-2.5 h-7 bg-indigo-400 rounded-full"></span>
            진행 중인 수업
          </h3>
          <div className="space-y-4">
            {ongoingClasses.length > 0 ? ongoingClasses.map((c, i) => (
              <div key={i} className="flex justify-between items-center p-6 bg-white/5 backdrop-blur-md rounded-[2rem] border border-white/10 hover:bg-white/10 transition-colors">
                <div>
                  <div className="font-black text-2xl mb-1">{c.class_name}</div>
                  <div className="text-indigo-300 font-bold">👤 {c.teacher_name} 선생님</div>
                </div>
                <div className="text-right">
                  <div className="font-black text-indigo-200 text-xl">
                    {c.start_time.slice(0, 5)} - {c.end_time.slice(0, 5)}
                  </div>
                  <div className="text-[10px] text-white/30 font-bold tracking-widest uppercase mt-1">ON AIR</div>
                </div>
              </div>
            )) : (
              <div className="py-16 text-center text-slate-500 font-bold italic border-2 border-dashed border-white/5 rounded-[2rem]">
                <p className="text-4xl mb-4">☕</p>
                현재는 진행 중인 수업이 없습니다.
              </div>
            )}
          </div>
        </section>

        {/* 최신 공지사항 */}
        <section className="bg-white p-8 rounded-[3rem] shadow-xl border border-slate-50">
          <div className="flex justify-between items-center mb-8">
            <h3 className="text-2xl font-black text-slate-900 flex items-center gap-3">
              <span className="w-2.5 h-7 bg-indigo-400 rounded-full"></span>
              공지사항
            </h3>
            <Link href="/admin/notices" className="text-sm font-black text-slate-300 hover:text-indigo-600 transition-colors">전체보기 ➜</Link>
          </div>
          <div className="space-y-4">
            {recentNotices.length > 0 ? recentNotices.map((n, i) => (
              <Link href="/admin/notices" key={i} className={`block p-5 rounded-[2rem] transition-all border-2 ${n.is_important ? 'bg-indigo-50 border-indigo-100' : 'bg-slate-50 border-transparent hover:border-slate-100 hover:bg-white'}`}>
                <div className="flex items-center gap-3 mb-2">
                  {n.is_important && <span className="text-[10px] bg-indigo-600 text-white px-2 py-0.5 rounded-full font-black uppercase tracking-widest">중요</span>}
                  <span className="font-black text-slate-800 truncate text-lg">{n.title}</span>
                </div>
                <div className="text-xs text-slate-400 font-bold flex items-center gap-1">
                  📅 {new Date(n.created_at).toLocaleDateString()}
                </div>
              </Link>
            )) : (
              <div className="py-16 text-center text-slate-300 font-bold italic">등록된 공지가 없습니다.</div>
            )}
          </div>
        </section>
      </div>

      {/* 퀵 메뉴 */}
      <nav className="grid grid-cols-2 md:grid-cols-4 gap-6">
        <QuickMenu label="출석체크" icon="✅" href="/admin/attendance" color="bg-emerald-50 text-emerald-600" />
        <QuickMenu label="학생등록" icon="👤" href="/admin/student" color="bg-blue-50 text-blue-600" />
        <QuickMenu label="클래스관리" icon="🏫" href="/admin/class" color="bg-indigo-50 text-indigo-600" />
        <QuickMenu label="공지사항" icon="📢" href="/admin/notices" color="bg-yellow-50 text-yellow-600" />
      </nav>
    </div>
  );
}

// 💡 보조 컴포넌트 (StatCard)
function StatCard({ label, value, unit, color, icon }: any) {
  return (
    <div className={`bg-white p-8 rounded-[2.5rem] shadow-xl border-b-[10px] ${color} hover:-translate-y-2 transition-all duration-300`}>
      <div className="flex justify-between items-start mb-4">
        <p className="font-black text-slate-400 text-xs uppercase tracking-[0.2em]">{label}</p>
        <span className="text-2xl opacity-50">{icon}</span>
      </div>
      <h2 className="text-5xl font-black text-slate-900 flex items-baseline gap-1">
        {value}<span className="text-xl text-slate-400">{unit}</span>
      </h2>
    </div>
  );
}

// 💡 보조 컴포넌트 (QuickMenu)
function QuickMenu({ label, icon, href, color }: any) {
  return (
    <Link href={href} className={`${color} p-8 rounded-[2.5rem] flex flex-col items-center gap-4 transition-all hover:scale-105 hover:shadow-2xl active:scale-95 border border-white/50`}>
      <span className="text-5xl drop-shadow-sm">{icon}</span>
      <span className="font-black text-xl tracking-tighter">{label}</span>
    </Link>
  );
}