'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';

export default function LandingPage() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setIsLoggedIn(!!session);
    };
    checkUser();
  }, []);

  return (
    <div className="min-h-screen bg-white font-sans text-slate-900">
      {/* GNB */}
      <nav className="flex items-center justify-between px-8 py-5 bg-white border-b border-slate-100 sticky top-0 z-50">
        <Link href="/" className="flex items-center gap-3">
          <div className="w-10 h-10 bg-slate-900 rounded-2xl flex items-center justify-center rotate-3 shadow-lg shadow-slate-200">
            <span className="text-yellow-400 font-black text-xl italic">C</span>
          </div>
          <div className="flex flex-col -space-y-1">
            <span className="text-2xl font-black tracking-tighter text-slate-900">
              CON <span className="text-yellow-500">EDU</span>
            </span>
            <span className="text-[10px] font-bold text-slate-400 tracking-[0.2em]">MANAGEMENT CENTER</span>
          </div>
        </Link>

        <div className="flex items-center gap-3">
          <Link
            href="/kiosk"
            className="px-5 py-2.5 text-sm font-bold border-2 border-slate-200 text-slate-600 rounded-full hover:border-slate-900 hover:text-slate-900 transition-all"
          >
            출결 키오스크
          </Link>
          {isLoggedIn ? (
            <Link
              href="/admin"
              className="px-6 py-2.5 text-sm font-bold bg-slate-900 text-white rounded-full hover:shadow-xl hover:-translate-y-0.5 transition-all"
            >
              대시보드로 이동 🚀
            </Link>
          ) : (
            <>
              <Link
                href="/register"
                className="px-5 py-2.5 text-sm font-bold border-2 border-slate-900 text-slate-900 rounded-full hover:bg-slate-900 hover:text-white transition-all"
              >
                솔루션 가입하기
              </Link>
              <Link
                href="/login"
                className="px-5 py-2.5 text-sm font-bold bg-slate-900 text-white rounded-full hover:shadow-xl hover:-translate-y-0.5 transition-all"
              >
                로그인
              </Link>
            </>
          )}
        </div>
      </nav>

      {/* 히어로 */}
      <section className="relative pt-24 pb-32 overflow-hidden">
        <div className="max-w-7xl mx-auto px-8 flex flex-col items-center text-center">
          <div className="inline-block px-4 py-1.5 mb-10 rounded-full bg-slate-50 border border-slate-200 text-slate-500 text-xs font-black uppercase tracking-widest">
            Next Generation Academy Solution
          </div>

          <h1 className="text-6xl md:text-8xl font-black text-slate-900 leading-[1.4] md:leading-[1.3] tracking-tight mb-10">
            학원 운영,<br />
            <div className="mt-4 relative inline-block">
              <span className="relative z-10 bg-slate-900 text-white px-6 py-3 rounded-[2.5rem]">압도적</span>
              <span className="absolute -bottom-2 -right-2 w-full h-full bg-yellow-400 rounded-[2.5rem] z-0"></span>
            </div>
            <span className="ml-2">으로 쉽게.</span>
          </h1>

          <p className="text-xl text-slate-400 font-medium leading-relaxed max-w-2xl mb-14">
            CON EDU 하나로 출결부터 성적, 수납까지.<br />
            원장님은 교육에만 집중하세요. 복잡한 관리는 저희가 합니다.
          </p>

          <div className="flex flex-col sm:flex-row gap-6">
            <Link
              href={isLoggedIn ? '/admin' : '/login'}
              className="px-12 py-5 bg-slate-900 text-white font-black rounded-full text-lg shadow-2xl shadow-slate-300 hover:bg-slate-800 transition-all hover:-translate-y-1"
            >
              {isLoggedIn ? '관리자 센터 입장하기' : '지금 시작하기'}
            </Link>
            <button className="px-12 py-5 bg-white text-slate-900 font-black rounded-full text-lg border-2 border-slate-900 hover:bg-slate-50 transition-all">
              서비스 가이드
            </button>
          </div>
        </div>
        <div className="absolute top-1/2 left-0 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-yellow-50 rounded-full blur-[120px] opacity-60 z-[-1]"></div>
      </section>

      {/* 3대 핵심 기능 */}
      <section className="max-w-7xl mx-auto px-8 py-20">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {[
            { title: '성적 리포트', label: 'Smart Analytics', desc: '학생별 성적 변화를 그래프로 자동 생성합니다. 상담 시 학부모님께 전문적인 데이터를 보여주세요.', icon: '📊', bg: 'bg-blue-50' },
            { title: '출결 알림톡',  label: 'Real-time Alert',  desc: '등/하원 즉시 카카오 알림톡이 발송됩니다. 학부모님이 가장 안심하고 만족하는 기능입니다.',        icon: '🔔', bg: 'bg-yellow-50' },
            { title: '자동 청구서 발행', label: 'Auto Billing', desc: '매달 번거로운 수납 안내를 자동화하세요. 모바일 청구서 한 장으로 미납 걱정을 덜어드립니다.',    icon: '📄', bg: 'bg-slate-100' },
          ].map((item, i) => (
            <div
              key={i}
              className="group relative p-12 bg-white border-2 border-slate-200 rounded-[3.5rem]
                         transition-all duration-500 hover:-translate-y-4
                         hover:shadow-[0_20px_40px_rgba(0,0,0,0.08)] hover:border-yellow-400 cursor-default"
            >
              <div className={`w-20 h-20 ${item.bg} rounded-[2rem] flex items-center justify-center text-4xl mb-8 group-hover:scale-110 group-hover:rotate-6 transition-transform duration-500`}>
                {item.icon}
              </div>
              <p className="text-yellow-600 font-black text-xs uppercase mb-2 tracking-widest opacity-80 group-hover:opacity-100">{item.label}</p>
              <h4 className="text-2xl font-black mb-4">{item.title}</h4>
              <p className="text-slate-500 font-medium leading-relaxed">{item.desc}</p>
              <div className="absolute top-8 right-8 text-slate-200 group-hover:text-yellow-400 transition-colors text-2xl font-bold">↗</div>
            </div>
          ))}
        </div>
      </section>

      {/* 하단 배너 */}
      <section className="mx-8 mb-20">
        <div className="max-w-7xl mx-auto bg-slate-900 rounded-[4rem] px-8 py-24 text-center relative overflow-hidden shadow-2xl shadow-slate-400">
          <div className="relative z-10">
            <h2 className="text-4xl md:text-5xl font-black text-white mb-6 leading-tight">
              성공하는 학원의 선택<br />
              <span className="text-yellow-400 italic">CON EDU</span>
            </h2>
            <p className="text-slate-400 font-medium mb-12">지금 가입하고 7일간 모든 기능을 무료로 체험해보세요.</p>
            <Link
              href={isLoggedIn ? '/admin' : '/register'}
              className="px-12 py-5 bg-yellow-400 text-slate-900 font-black rounded-full hover:bg-yellow-300 transition-all inline-block text-lg shadow-xl shadow-yellow-400/20"
            >
              {isLoggedIn ? '대시보드로 바로가기' : '지금 무료로 시작하기'}
            </Link>
          </div>
          <div className="absolute -bottom-10 -right-10 text-white opacity-[0.03] text-[250px] font-black pointer-events-none">CE</div>
        </div>
      </section>

      {/* 푸터 */}
      <footer className="max-w-7xl mx-auto px-8 py-12 border-t border-slate-100">
        <div className="flex flex-col md:flex-row justify-between items-center gap-6 text-slate-400 text-sm font-bold">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-slate-900 rounded flex items-center justify-center">
              <span className="text-yellow-400 text-[10px] font-black">C</span>
            </div>
            <span>CON EDU 관리센터</span>
          </div>
          <div className="flex gap-8">
            <span className="hover:text-slate-900 cursor-pointer">이용약관</span>
            <span className="text-slate-900 cursor-pointer underline decoration-2 underline-offset-4">개인정보처리방침</span>
            <span className="hover:text-slate-900 cursor-pointer">고객센터</span>
          </div>
          <p>© 2026 CON EDU. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
