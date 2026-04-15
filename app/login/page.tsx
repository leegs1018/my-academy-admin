'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

const AUTO_LOGIN_KEY = 'con-edu-auto-login';
const SAVED_EMAIL_KEY = 'con-edu-saved-email';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [autoLogin, setAutoLogin] = useState(false);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  // 저장된 이메일 및 자동 로그인 설정 불러오기
  useEffect(() => {
    const savedEmail = localStorage.getItem(SAVED_EMAIL_KEY);
    const savedAutoLogin = localStorage.getItem(AUTO_LOGIN_KEY) === 'true';

    if (savedEmail) setEmail(savedEmail);
    if (savedAutoLogin) setAutoLogin(true);

    // 자동 로그인 설정이 있고 세션이 유효하면 바로 이동
    if (savedAutoLogin) {
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (session) router.replace('/admin');
      });
    }
  }, [router]);

  const handleLogin = async (e: { preventDefault: () => void }) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });

      if (error) {
        if (error.message.includes('Invalid login credentials')) {
          alert('이메일 또는 비밀번호가 일치하지 않습니다.');
        } else {
          alert('로그인 중 오류가 발생했습니다: ' + error.message);
        }
        setLoading(false);
        return;
      }

      if (data.session) {
        // 자동 로그인 설정 저장
        if (autoLogin) {
          localStorage.setItem(AUTO_LOGIN_KEY, 'true');
          localStorage.setItem(SAVED_EMAIL_KEY, email);
        } else {
          localStorage.removeItem(AUTO_LOGIN_KEY);
          localStorage.removeItem(SAVED_EMAIL_KEY);
        }
        router.push('/admin');
        router.refresh();
      }
    } catch (err) {
      console.error('Login Error:', err);
      alert('예기치 못한 오류가 발생했습니다.');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
      <div className="max-w-md w-full bg-white rounded-[2.5rem] shadow-2xl shadow-slate-200 p-10 border border-slate-100">

        {/* 로고 */}
        <div className="text-center mb-10">
          <Link href="/" className="inline-flex w-12 h-12 bg-slate-900 rounded-2xl items-center justify-center rotate-3 mb-4 hover:scale-110 transition-transform">
            <span className="text-yellow-400 font-black text-2xl italic">C</span>
          </Link>
          <h1 className="text-3xl font-black text-slate-900 tracking-tighter">CON EDU 로그인</h1>
          <p className="text-slate-400 font-medium mt-2">원장님 전용 관리 센터로 접속합니다.</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-5">
          <div>
            <label className="block text-sm font-black text-slate-700 mb-2 ml-1 uppercase tracking-wider">Email Address</label>
            <input
              type="email"
              placeholder="example@email.com"
              className="w-full px-5 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:border-slate-900 focus:bg-white outline-none transition-all font-bold text-slate-900 placeholder:text-slate-300"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div>
            <label className="block text-sm font-black text-slate-700 mb-2 ml-1 uppercase tracking-wider">Password</label>
            <input
              type="password"
              placeholder="••••••••"
              className="w-full px-5 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:border-slate-900 focus:bg-white outline-none transition-all font-bold text-slate-900 placeholder:text-slate-300"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          {/* 자동 로그인 체크박스 */}
          <label className="flex items-center gap-3 cursor-pointer group py-1">
            <div
              onClick={() => setAutoLogin(!autoLogin)}
              className={`w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-all
                ${autoLogin ? 'bg-slate-900 border-slate-900' : 'border-slate-300 hover:border-slate-500'}`}
            >
              {autoLogin && <span className="text-white text-xs font-black">✓</span>}
            </div>
            <span className="text-sm font-bold text-slate-600 group-hover:text-slate-900 transition-colors select-none">
              자동 로그인 (다음 방문 시 자동으로 접속)
            </span>
          </label>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-5 bg-slate-900 text-white font-black rounded-2xl hover:bg-slate-800 transition-all shadow-xl shadow-slate-200 disabled:bg-slate-400 disabled:shadow-none mt-2 text-lg"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                접속 중...
              </span>
            ) : '관리 센터 로그인'}
          </button>
        </form>

        <div className="flex justify-between mt-10 text-sm font-bold text-slate-400 px-2">
          <Link href="/register" className="hover:text-slate-900 transition-colors">계정 만들기</Link>
          <span className="text-slate-200">|</span>
          <button
            onClick={() => alert('등록된 휴대폰 번호로 임시 비밀번호를 발송해 드립니다. (준비 중)')}
            className="hover:text-slate-900 transition-colors"
          >
            비밀번호 찾기
          </button>
        </div>
      </div>
    </div>
  );
}
