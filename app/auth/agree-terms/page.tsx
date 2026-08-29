'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function AgreeTermsPage() {
  const [termsAgreed, setTermsAgreed] = useState(false);
  const [privacyAgreed, setPrivacyAgreed] = useState(false);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleAgree = async () => {
    if (!termsAgreed || !privacyAgreed) return;
    setLoading(true);

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { router.replace('/login'); return; }

    await supabase
      .from('academy_config')
      .update({ terms_agreed: true })
      .eq('user_id', session.user.id);

    router.replace('/admin');
  };

  const allAgreed = termsAgreed && privacyAgreed;

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-6 py-12">
      <div className="max-w-md w-full bg-white rounded-[2.5rem] shadow-2xl p-10 border border-slate-100">
        <div className="text-center mb-8">
          <div className="inline-flex w-12 h-12 bg-slate-900 rounded-2xl items-center justify-center rotate-3 mb-4 shadow-lg shadow-slate-200">
            <span className="text-yellow-400 font-black text-2xl italic">C</span>
          </div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tighter">서비스 이용 동의</h1>
          <p className="text-slate-400 font-medium mt-2 text-sm">CON EDU 서비스를 이용하기 전에<br />아래 약관에 동의해주세요.</p>
        </div>

        <div className="space-y-3 bg-slate-50 rounded-3xl p-6 border border-slate-100 mb-6">
          <label className="flex items-start gap-3 cursor-pointer group">
            <input
              type="checkbox"
              checked={termsAgreed}
              onChange={e => setTermsAgreed(e.target.checked)}
              className="w-5 h-5 mt-0.5 accent-slate-900 cursor-pointer flex-shrink-0"
            />
            <span className="text-sm font-bold text-slate-600 group-hover:text-slate-900 transition-colors">
              <Link href="/terms" target="_blank" className="underline underline-offset-2 text-indigo-600 hover:text-indigo-800">이용약관</Link>에 동의합니다. (필수)
            </span>
          </label>

          <label className="flex items-start gap-3 cursor-pointer group">
            <input
              type="checkbox"
              checked={privacyAgreed}
              onChange={e => setPrivacyAgreed(e.target.checked)}
              className="w-5 h-5 mt-0.5 accent-slate-900 cursor-pointer flex-shrink-0"
            />
            <span className="text-sm font-bold text-slate-600 group-hover:text-slate-900 transition-colors">
              <Link href="/privacy" target="_blank" className="underline underline-offset-2 text-indigo-600 hover:text-indigo-800">개인정보처리방침</Link>에 동의합니다. (필수)
            </span>
          </label>
        </div>

        <button
          onClick={handleAgree}
          disabled={!allAgreed || loading}
          className="w-full py-4 bg-slate-900 text-white font-black rounded-2xl hover:bg-slate-800 transition-all disabled:bg-slate-300 disabled:cursor-not-allowed text-sm"
        >
          {loading ? '처리 중...' : '동의하고 시작하기'}
        </button>
      </div>
    </div>
  );
}
