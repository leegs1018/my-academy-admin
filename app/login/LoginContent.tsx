'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

const SNS_ERROR_MESSAGES: Record<string, string> = {
  auth_failed: '로그인에 실패했습니다. 다시 시도해주세요.',
  naver_failed: '네이버 로그인 중 오류가 발생했습니다.',
  naver_no_email: '네이버 계정의 이메일 제공에 동의해주세요.',
};

const AUTO_LOGIN_KEY = 'con-edu-auto-login';
const SAVED_EMAIL_KEY = 'con-edu-saved-email';

function GoogleIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
  );
}

function KakaoIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="#3C1E1E">
      <path d="M12 3C6.477 3 2 6.477 2 10.5c0 2.57 1.578 4.83 3.978 6.218L5.1 20.2a.5.5 0 0 0 .72.55l4.44-2.96c.57.08 1.15.12 1.74.12 5.523 0 10-3.477 10-7.5S17.523 3 12 3z"/>
    </svg>
  );
}

function NaverIcon() {
  return (
    <span className="w-5 h-5 flex items-center justify-center font-black text-sm leading-none">N</span>
  );
}

export default function LoginContent() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [autoLogin, setAutoLogin] = useState(false);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const savedEmail = localStorage.getItem(SAVED_EMAIL_KEY);
    const savedAutoLogin = localStorage.getItem(AUTO_LOGIN_KEY) === 'true';

    if (savedEmail) setEmail(savedEmail);
    if (savedAutoLogin) setAutoLogin(true);

    if (savedAutoLogin) {
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (session) {
          const dest = session.user.email === process.env.NEXT_PUBLIC_SUPER_ADMIN_EMAIL ? '/superadmin' : '/admin';
          router.replace(dest);
        }
      });
    }

    // SNS 로그인 오류 메시지 표시
    const params = new URLSearchParams(window.location.search);
    const errorKey = params.get('error');
    if (errorKey && SNS_ERROR_MESSAGES[errorKey]) {
      alert(SNS_ERROR_MESSAGES[errorKey]);
    }
  }, [router]);

  const handleSocialLogin = async (provider: 'google' | 'kakao') => {
    const justWithdrew = localStorage.getItem('just-withdrew') === '1';
    if (justWithdrew) localStorage.removeItem('just-withdrew');

    await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        // 탈퇴 직후 재로그인 시 카카오에서 계정 재인증 강제
        ...(justWithdrew && provider === 'kakao' && {
          queryParams: { prompt: 'login' },
        }),
      },
    });
  };

  const handleNaverLogin = () => {
    window.location.href = '/api/auth/naver';
  };

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
        if (autoLogin) {
          localStorage.setItem(AUTO_LOGIN_KEY, 'true');
          localStorage.setItem(SAVED_EMAIL_KEY, email);
        } else {
          localStorage.removeItem(AUTO_LOGIN_KEY);
          localStorage.removeItem(SAVED_EMAIL_KEY);
        }
        const dest = data.session.user.email === process.env.NEXT_PUBLIC_SUPER_ADMIN_EMAIL ? '/superadmin' : '/admin';
        router.push(dest);
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

        {/* SNS 로그인 */}
        <div className="mt-8">
          <div className="flex items-center gap-3 mb-5">
            <div className="flex-1 h-px bg-slate-100" />
            <span className="text-xs font-bold text-slate-400 whitespace-nowrap">소셜 계정으로 로그인</span>
            <div className="flex-1 h-px bg-slate-100" />
          </div>
          <div className="space-y-3">
            <button
              type="button"
              onClick={() => handleSocialLogin('google')}
              className="w-full flex items-center gap-3 px-5 py-4 bg-white border-2 border-slate-100 rounded-2xl hover:border-slate-200 hover:bg-slate-50 transition-all font-bold text-slate-700"
            >
              <GoogleIcon />
              <span className="flex-1 text-center">Google로 로그인</span>
            </button>
            <button
              type="button"
              onClick={() => handleSocialLogin('kakao')}
              className="w-full flex items-center gap-3 px-5 py-4 bg-[#FEE500] border-2 border-[#FEE500] rounded-2xl hover:bg-[#FFDC00] transition-all font-black text-[#3C1E1E]"
            >
              <KakaoIcon />
              <span className="flex-1 text-center">카카오로 로그인</span>
            </button>
            <button
              type="button"
              onClick={handleNaverLogin}
              className="w-full flex items-center gap-3 px-5 py-4 bg-[#03C75A] border-2 border-[#03C75A] rounded-2xl hover:bg-[#02B350] transition-all font-black text-white"
            >
              <NaverIcon />
              <span className="flex-1 text-center">네이버로 로그인</span>
            </button>
          </div>
        </div>

        <div className="flex justify-between mt-8 text-sm font-bold text-slate-400 px-2">
          <Link href="/register" className="hover:text-slate-900 transition-colors">계정 만들기</Link>
          <span className="text-slate-200">|</span>
          <Link href="/find-account" className="hover:text-slate-900 transition-colors">아이디 찾기</Link>
          <span className="text-slate-200">|</span>
          <Link href="/find-account" className="hover:text-slate-900 transition-colors">비밀번호 찾기</Link>
        </div>
      </div>
    </div>
  );
}
