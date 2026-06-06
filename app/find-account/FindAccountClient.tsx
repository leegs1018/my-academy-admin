'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';

type Tab = 'find-id' | 'find-pw';

export default function FindAccountClient() {
  const [activeTab, setActiveTab] = useState<Tab>('find-id');

  // 아이디 찾기 상태
  const [academyName, setAcademyName] = useState('');
  const [mobile, setMobile] = useState('');
  const [findIdLoading, setFindIdLoading] = useState(false);
  const [foundEmail, setFoundEmail] = useState('');
  const [findIdError, setFindIdError] = useState('');

  // 비밀번호 찾기 상태
  const [email, setEmail] = useState('');
  const [findPwLoading, setFindPwLoading] = useState(false);
  const [pwSent, setPwSent] = useState(false);
  const [findPwError, setFindPwError] = useState('');

  const handleFindId = async (e: React.FormEvent) => {
    e.preventDefault();
    setFindIdError('');
    setFoundEmail('');
    setFindIdLoading(true);
    try {
      const res = await fetch('/api/auth/find-id', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ academy_name: academyName, mobile }),
      });
      const data = await res.json();
      if (!res.ok) {
        setFindIdError(data.error ?? '오류가 발생했습니다.');
      } else {
        setFoundEmail(data.maskedEmail);
      }
    } catch {
      setFindIdError('서버 연결 오류가 발생했습니다.');
    } finally {
      setFindIdLoading(false);
    }
  };

  const handleFindPw = async (e: React.FormEvent) => {
    e.preventDefault();
    setFindPwError('');
    setFindPwLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/reset-password`,
      });
      if (error) {
        setFindPwError('이메일 발송 중 오류가 발생했습니다: ' + error.message);
      } else {
        setPwSent(true);
      }
    } catch {
      setFindPwError('서버 연결 오류가 발생했습니다.');
    } finally {
      setFindPwLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
      <div className="max-w-md w-full bg-white rounded-[2.5rem] shadow-2xl shadow-slate-200 p-10 border border-slate-100">

        {/* 로고 */}
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex w-12 h-12 bg-slate-900 rounded-2xl items-center justify-center rotate-3 mb-4 hover:scale-110 transition-transform">
            <span className="text-yellow-400 font-black text-2xl italic">C</span>
          </Link>
          <h1 className="text-2xl font-black text-slate-900 tracking-tighter">계정 찾기</h1>
          <p className="text-slate-400 font-medium mt-1 text-sm">가입 시 입력한 정보로 계정을 찾으세요.</p>
        </div>

        {/* 탭 */}
        <div className="flex gap-1 bg-slate-100 rounded-2xl p-1 mb-8">
          <button
            onClick={() => { setActiveTab('find-id'); setFoundEmail(''); setFindIdError(''); }}
            className={`flex-1 py-2.5 text-sm font-black rounded-xl transition-all ${activeTab === 'find-id' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
          >
            아이디 찾기
          </button>
          <button
            onClick={() => { setActiveTab('find-pw'); setPwSent(false); setFindPwError(''); }}
            className={`flex-1 py-2.5 text-sm font-black rounded-xl transition-all ${activeTab === 'find-pw' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
          >
            비밀번호 찾기
          </button>
        </div>

        {/* 아이디 찾기 */}
        {activeTab === 'find-id' && (
          <>
            {foundEmail ? (
              <div className="text-center space-y-6">
                <div className="bg-slate-50 rounded-2xl p-6 border border-slate-100">
                  <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-2">등록된 아이디</p>
                  <p className="text-xl font-black text-slate-900">{foundEmail}</p>
                </div>
                <button
                  onClick={() => { setFoundEmail(''); setAcademyName(''); setMobile(''); }}
                  className="w-full py-3 text-sm font-black text-slate-500 hover:text-slate-700 transition-colors"
                >
                  다시 찾기
                </button>
              </div>
            ) : (
              <form onSubmit={handleFindId} className="space-y-4">
                <div>
                  <label className="block text-sm font-black text-slate-700 mb-2 ml-1 uppercase tracking-wider">학원명</label>
                  <input
                    type="text"
                    placeholder="가입 시 입력한 학원명"
                    value={academyName}
                    onChange={e => setAcademyName(e.target.value)}
                    className="w-full px-5 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:border-slate-900 focus:bg-white outline-none transition-all font-bold text-slate-900 placeholder:text-slate-300"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-black text-slate-700 mb-2 ml-1 uppercase tracking-wider">휴대폰 번호</label>
                  <input
                    type="text"
                    placeholder="010-1234-5678"
                    value={mobile}
                    onChange={e => setMobile(e.target.value)}
                    className="w-full px-5 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:border-slate-900 focus:bg-white outline-none transition-all font-bold text-slate-900 placeholder:text-slate-300"
                    required
                  />
                </div>
                {findIdError && (
                  <p className="text-sm font-bold text-red-500 px-1">{findIdError}</p>
                )}
                <button
                  type="submit"
                  disabled={findIdLoading}
                  className="w-full py-4 bg-slate-900 text-white font-black rounded-2xl hover:bg-slate-800 transition-all shadow-xl shadow-slate-200 disabled:bg-slate-400 disabled:shadow-none mt-2"
                >
                  {findIdLoading ? '조회 중...' : '아이디 찾기'}
                </button>
              </form>
            )}
          </>
        )}

        {/* 비밀번호 찾기 */}
        {activeTab === 'find-pw' && (
          <>
            {pwSent ? (
              <div className="text-center space-y-4">
                <div className="text-5xl mb-2">📬</div>
                <p className="font-black text-slate-900">이메일을 발송했습니다</p>
                <p className="text-sm font-medium text-slate-400 leading-relaxed">
                  <span className="font-black text-slate-700">{email}</span>로<br />
                  비밀번호 재설정 링크를 보냈습니다.<br />
                  이메일을 확인해주세요.
                </p>
                <p className="text-xs font-medium text-slate-300">스팸함도 함께 확인해보세요.</p>
              </div>
            ) : (
              <form onSubmit={handleFindPw} className="space-y-4">
                <div>
                  <label className="block text-sm font-black text-slate-700 mb-2 ml-1 uppercase tracking-wider">이메일 주소</label>
                  <input
                    type="email"
                    placeholder="가입 시 사용한 이메일"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    className="w-full px-5 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:border-slate-900 focus:bg-white outline-none transition-all font-bold text-slate-900 placeholder:text-slate-300"
                    required
                  />
                </div>
                <p className="text-xs font-medium text-slate-400 px-1">
                  입력한 이메일로 비밀번호 재설정 링크가 발송됩니다.
                </p>
                {findPwError && (
                  <p className="text-sm font-bold text-red-500 px-1">{findPwError}</p>
                )}
                <button
                  type="submit"
                  disabled={findPwLoading}
                  className="w-full py-4 bg-slate-900 text-white font-black rounded-2xl hover:bg-slate-800 transition-all shadow-xl shadow-slate-200 disabled:bg-slate-400 disabled:shadow-none mt-2"
                >
                  {findPwLoading ? '발송 중...' : '재설정 링크 발송'}
                </button>
              </form>
            )}
          </>
        )}

        {/* 하단 링크 */}
        <div className="flex justify-center mt-8 text-sm font-bold text-slate-400">
          <Link href="/login" className="hover:text-slate-900 transition-colors">← 로그인으로 돌아가기</Link>
        </div>
      </div>
    </div>
  );
}
