'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function ResetPasswordPage() {
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setReady(true);
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password.length < 6) {
      setError('비밀번호는 6자 이상이어야 합니다.');
      return;
    }
    if (password !== confirm) {
      setError('비밀번호가 일치하지 않습니다.');
      return;
    }

    setLoading(true);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setLoading(false);

    if (updateError) {
      setError('비밀번호 변경 중 오류가 발생했습니다: ' + updateError.message);
    } else {
      setDone(true);
      setTimeout(() => router.replace('/login'), 3000);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
      <div className="max-w-md w-full bg-white rounded-[2.5rem] shadow-2xl shadow-slate-200 p-10 border border-slate-100">

        <div className="text-center mb-10">
          <Link href="/" className="inline-flex w-12 h-12 bg-slate-900 rounded-2xl items-center justify-center rotate-3 mb-4 hover:scale-110 transition-transform">
            <span className="text-yellow-400 font-black text-2xl italic">C</span>
          </Link>
          <h1 className="text-2xl font-black text-slate-900 tracking-tighter">새 비밀번호 설정</h1>
          <p className="text-slate-400 font-medium mt-1 text-sm">새로 사용할 비밀번호를 입력해주세요.</p>
        </div>

        {done ? (
          <div className="text-center space-y-4">
            <div className="text-5xl mb-2">✅</div>
            <p className="font-black text-slate-900">비밀번호가 변경되었습니다</p>
            <p className="text-sm font-medium text-slate-400">잠시 후 로그인 페이지로 이동합니다...</p>
          </div>
        ) : !ready ? (
          <div className="text-center space-y-4">
            <div className="text-5xl mb-2 animate-pulse">🔗</div>
            <p className="font-black text-slate-900">링크 확인 중...</p>
            <p className="text-sm font-medium text-slate-400 leading-relaxed">
              이메일의 비밀번호 재설정 링크를 클릭하셨나요?<br />
              링크가 만료되었을 수 있습니다.
            </p>
            <Link href="/find-account" className="inline-block mt-4 text-sm font-black text-slate-500 hover:text-slate-900 underline underline-offset-4 transition-colors">
              다시 요청하기
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-black text-slate-700 mb-2 ml-1 uppercase tracking-wider">새 비밀번호</label>
              <input
                type="password"
                placeholder="6자 이상 입력"
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="w-full px-5 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:border-slate-900 focus:bg-white outline-none transition-all font-bold text-slate-900 placeholder:text-slate-300"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-black text-slate-700 mb-2 ml-1 uppercase tracking-wider">비밀번호 확인</label>
              <input
                type="password"
                placeholder="비밀번호 재입력"
                value={confirm}
                onChange={e => setConfirm(e.target.value)}
                className="w-full px-5 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:border-slate-900 focus:bg-white outline-none transition-all font-bold text-slate-900 placeholder:text-slate-300"
                required
              />
            </div>
            {error && <p className="text-sm font-bold text-red-500 px-1">{error}</p>}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-5 bg-slate-900 text-white font-black rounded-2xl hover:bg-slate-800 transition-all shadow-xl shadow-slate-200 disabled:bg-slate-400 disabled:shadow-none mt-2 text-lg"
            >
              {loading ? '변경 중...' : '비밀번호 변경'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
