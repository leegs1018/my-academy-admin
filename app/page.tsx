'use client';

import { useState, useEffect } from 'react';
import { supabase } from './lib/supabase';
import Link from 'next/link';
import { useRouter } from 'next/navigation'; // 1. 라우터 추가

export default function DashboardPage() {
  const router = useRouter(); // 2. 라우터 선언
  const [stats, setStats] = useState({ studentCount: 0, classCount: 0, attendanceCount: 0 });
  const [ongoingClasses, setOngoingClasses] = useState<any[]>([]);
  const [recentNotices, setRecentNotices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 3. 페이지 접속 시 로그인 상태부터 체크!
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        // 세션 없으면 로그인으로 강제 이동
        router.replace('/login');
      } else {
        // 세션 있으면 데이터 불러오기
        fetchDashboardData();
      }
    };

    checkAuth();
  }, [router]);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      const today = new Date().toISOString().split('T')[0];
      const now = new Date();
      const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:00`;
      const dayNames = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
      const todayField = dayNames[now.getDay()];

      // 1. 통계 데이터
      const { count: sCount } = await supabase.from('students').select('*', { count: 'exact', head: true });
      const { count: cCount } = await supabase.from('classes').select('*', { count: 'exact', head: true });
      const { count: aCount } = await supabase.from('attendance').select('*', { count: 'exact', head: true }).eq('attendance_date', today).eq('status', '등원');

      setStats({ studentCount: sCount || 0, classCount: cCount || 0, attendanceCount: aCount || 0 });

      // 2. 현재 진행 중인 수업
      const { data: classData } = await supabase
        .from('classes')
        .select('*')
        .eq(todayField, true)
        .lte('start_time', currentTime)
        .gte('end_time', currentTime);
      
      setOngoingClasses(classData || []);

      // 3. 최신 공지사항 불러오기 (최근 3개)
      const { data: noticeData } = await supabase
        .from('notices')
        .select('*')
        .order('is_important', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(3);
      
      setRecentNotices(noticeData || []);
    } catch (error) {
      console.error("데이터 로드 실패:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="p-10 text-center font-black text-indigo-500 animate-pulse">원장님, 데이터를 가져오고 있어요... 🚀</div>;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8 pb-20">
      <header className="flex justify-between items-end">
        <div>
          <h1 className="text-4xl font-black text-gray-800 italic">DASHBOARD</h1>
          <p className="text-gray-400 font-bold mt-1 text-lg overflow-hidden border-r-2 border-gray-400 whitespace-nowrap animate-typing">오늘도 원장님의 열정을 응원합니다! 🔥</p>
        </div>
        <div className="text-right hidden md:block">
          <p className="font-black text-gray-800 text-xl">{new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' })}</p>
        </div>
      </header>

      {/* 1. 상단 핵심 요약 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-3xl shadow-lg border-b-8 border-indigo-500 hover:-translate-y-1 transition-all">
          <p className="font-black text-gray-400 text-sm uppercase">Students</p>
          <h2 className="text-4xl font-black text-gray-800 mt-1">{stats.studentCount}명</h2>
        </div>
        <div className="bg-white p-6 rounded-3xl shadow-lg border-b-8 border-emerald-500 hover:-translate-y-1 transition-all">
          <p className="font-black text-gray-400 text-sm uppercase">Attendance</p>
          <h2 className="text-4xl font-black text-gray-800 mt-1">{stats.attendanceCount}명</h2>
        </div>
        <div className="bg-white p-6 rounded-3xl shadow-lg border-b-8 border-orange-500 hover:-translate-y-1 transition-all">
          <p className="font-black text-gray-400 text-sm uppercase">Classes</p>
          <h2 className="text-4xl font-black text-gray-800 mt-1">{stats.classCount}개</h2>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* 2. 현재 수업 현황 */}
        <div className="bg-indigo-900 p-8 rounded-[2rem] shadow-2xl text-white relative overflow-hidden">
          <div className="relative z-10">
            <h3 className="text-2xl font-black mb-6 flex items-center gap-2">
              <span className="w-2 h-6 bg-indigo-400 rounded-full"></span>
              진행 중인 수업
            </h3>
            <div className="space-y-4">
              {ongoingClasses.length > 0 ? ongoingClasses.map((c, i) => (
                <div key={i} className="flex justify-between items-center p-5 bg-white/10 backdrop-blur-md rounded-2xl border border-white/20">
                  <div>
                    <div className="font-black text-xl">{c.class_name}</div>
                    <div className="text-sm text-indigo-300 font-bold">{c.teacher_name} 선생님</div>
                  </div>
                  <div className="text-right">
                    <div className="font-black text-indigo-200">{c.start_time.slice(0,5)} ~ {c.end_time.slice(0,5)}</div>
                  </div>
                </div>
              )) : (
                <div className="py-10 text-center text-indigo-300 font-bold italic">현재는 수업이 없습니다.</div>
              )}
            </div>
          </div>
          <div className="absolute -top-10 -right-10 w-40 h-40 bg-indigo-800 rounded-full blur-3xl opacity-50"></div>
        </div>

        {/* 3. 최신 공지사항 */}
        <div className="bg-white p-8 rounded-[2rem] shadow-xl border border-gray-50 flex flex-col">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-2xl font-black text-gray-800 flex items-center gap-2">
              <span className="w-2 h-6 bg-yellow-400 rounded-full"></span>
              학원 공지사항
            </h3>
            <Link href="/notices" className="text-sm font-black text-gray-400 hover:text-yellow-600 transition-colors">전체보기 ➜</Link>
          </div>
          <div className="space-y-4 flex-1">
            {recentNotices.length > 0 ? recentNotices.map((n, i) => (
              <Link href="/notices" key={i} className={`block p-4 rounded-2xl transition-all border-2 ${n.is_important ? 'bg-yellow-50 border-yellow-200' : 'bg-gray-50 border-transparent hover:border-gray-200'}`}>
                <div className="flex items-center gap-2 mb-1">
                  {n.is_important && <span className="text-[10px] bg-yellow-400 text-white px-1.5 py-0.5 rounded font-black">중요</span>}
                  <span className="font-black text-gray-800 truncate">{n.title}</span>
                </div>
                <div className="text-xs text-gray-400 font-bold">{new Date(n.created_at).toLocaleDateString()}</div>
              </Link>
            )) : (
              <div className="py-10 text-center text-gray-300 font-bold italic">등록된 공지가 없습니다.</div>
            )}
          </div>
        </div>
      </div>

      {/* 4. 퀵 메뉴 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
        {[
          { label: '출석체크', icon: '✅', href: '/attendance', bg: 'bg-green-50 text-green-600' },
          { label: '학생등록', icon: '👤', href: '/student', bg: 'bg-blue-50 text-blue-600' },
          { label: '클래스관리', icon: '🏫', href: '/class', bg: 'bg-indigo-50 text-indigo-600' },
          { label: '공지사항', icon: '📢', href: '/notices', bg: 'bg-yellow-50 text-yellow-600' },
        ].map((menu, i) => (
          <Link key={i} href={menu.href} className={`${menu.bg} p-6 rounded-3xl flex flex-col items-center gap-3 transition-all hover:scale-105 hover:shadow-lg active:scale-95`}>
            <span className="text-4xl">{menu.icon}</span>
            <span className="font-black text-lg">{menu.label}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}