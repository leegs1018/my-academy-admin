'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase'; // 💡 본체 열쇠만 가져옵니다
import Link from 'next/link';

export default function Navbar() {
  const [academyName, setAcademyName] = useState('학원 관리');
  const [points, setPoints] = useState(0);

  // 💡 학원 정보(이름, 포인트) 가져오기
  useEffect(() => {
    const fetchAcademyInfo = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const myId = session?.user?.id;

      if (myId) {
        const { data } = await supabase
          .from('academy_config')
          .select('academy_name, points')
          .eq('user_id', myId) // 💡 내 설정만 가져오기
          .single();

        if (data) {
          setAcademyName(data.academy_name);
          setPoints(data.points);
        }
      }
    };

    fetchAcademyInfo();
  }, []);

  const handleLogout = async () => {
    if (!confirm('로그아웃 하시겠습니까?')) return;
    await supabase.auth.signOut();
    localStorage.clear();
    window.location.href = '/'; 
  };

  return (
    <nav className="w-full border-b border-slate-100 bg-white/80 backdrop-blur-md sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        {/* 로고 및 학원 이름 */}
        <div className="flex items-center gap-4">
          <Link href="/admin" className="flex items-center gap-2">
            <div className="w-8 h-8 bg-slate-900 rounded-lg flex items-center justify-center rotate-3">
              <span className="text-yellow-400 font-black text-sm italic">C</span>
            </div>
            <span className="font-black text-slate-900 text-xl tracking-tight">클래스허브</span>
          </Link>
          <div className="h-4 w-[1px] bg-slate-200 mx-1"></div>
          <span className="font-bold text-indigo-600 bg-indigo-50 px-3 py-1 rounded-full text-sm">
            {academyName} 🏫
          </span>
        </div>

        {/* 포인트 & 메뉴 & 로그아웃 */}
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2 bg-amber-50 px-3 py-1.5 rounded-xl border border-amber-100">
            <span className="text-sm font-black text-amber-600 italic">P</span>
            <span className="text-sm font-bold text-amber-700">{points.toLocaleString()}P</span>
          </div>
          
          <Link href="/admin/student" className="text-sm font-bold text-slate-600 hover:text-slate-900 transition-colors">학생 관리</Link>
          
          <button 
            onClick={handleLogout}
            className="flex items-center gap-1.5 text-slate-400 hover:text-red-600 font-bold transition-all text-sm group"
          >
            <span className="text-lg group-hover:rotate-12 transition-transform">🚪</span>
            <span className="hidden md:inline">로그아웃</span>
          </button>
        </div>
      </div>
    </nav>
  );
}