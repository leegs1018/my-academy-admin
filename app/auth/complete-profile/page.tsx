'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function CompleteProfilePage() {
  const [form, setForm] = useState({
    academyName: '',
    academyPhone: '',
    mobile: '',
    referralCode: '',
    termsAgreed: false,
    privacyAgreed: false,
  });
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [provider, setProvider] = useState<string>('');
  const router = useRouter();

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) { router.replace('/login'); return; }
      const { data } = await supabase
        .from('academy_config')
        .select('id')
        .eq('user_id', session.user.id)
        .single();
      if (data) {
        const role = session.user.user_metadata?.role ?? 'ai_only';
        router.replace(role === 'admin' ? '/admin' : '/admin/pdf-editor');
        return;
      }
      // 로그인 플랫폼 감지
      const p = session.user.user_metadata?.provider ?? session.user.app_metadata?.provider ?? '';
      setProvider(p);
      setChecking(false);
    });
  }, [router]);

  const providerLabel: Record<string, string> = {
    google: '구글',
    kakao: '카카오',
    naver: '네이버',
  };

  const change = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    setForm(p => ({ ...p, [name]: type === 'checkbox' ? checked : value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.termsAgreed || !form.privacyAgreed) {
      alert('필수 약관에 동의해주세요.');
      return;
    }
    setLoading(true);

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { router.replace('/login'); return; }

    const points = form.referralCode ? 2000 : 1000;
    let kioskCode = Math.floor(100000 + Math.random() * 900000).toString();

    let saved = false;
    for (let i = 0; i < 3; i++) {
      const { error } = await supabase.from('academy_config').insert({
        user_id: session.user.id,
        academy_name: form.academyName,
        academy_phone: form.academyPhone,
        mobile: form.mobile,
        referral_code: form.referralCode,
        points,
        kiosk_code: kioskCode,
      });
      if (!error) { saved = true; break; }
      if (error.code === '23505') { kioskCode = Math.floor(100000 + Math.random() * 900000).toString(); continue; }
      alert('학원 정보 저장 중 오류가 발생했습니다.');
      setLoading(false);
      return;
    }

    if (!saved) {
      alert('학원 정보 저장 중 오류가 발생했습니다. 고객센터로 문의해주세요.');
      setLoading(false);
      return;
    }

    await supabase.auth.updateUser({
      data: { role: 'ai_only', academy_name: form.academyName },
    });

    alert(`환영합니다! 가입 기념 ${points.toLocaleString()} CON이 지급되었습니다.`);
    router.replace('/admin/pdf-editor');
  };

  if (checking) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-4 border-slate-300 border-t-slate-900 rounded-full" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center py-12 px-6">
      <div className="max-w-xl w-full bg-white rounded-[2.5rem] shadow-2xl p-10 border border-slate-100">
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex w-12 h-12 bg-slate-900 rounded-2xl items-center justify-center rotate-3 mb-4 hover:scale-110 transition-transform">
            <span className="text-yellow-400 font-black text-2xl italic">C</span>
          </Link>
          <h1 className="text-3xl font-black text-slate-900 tracking-tighter">학원 정보 추가 입력</h1>
          <p className="text-slate-400 font-medium mt-2">
            {providerLabel[provider] ? (
              <><span className="text-slate-700 font-bold">{providerLabel[provider]} 로그인</span>이 완료되었습니다.<br /></>
            ) : null}
            서비스 이용을 위해 학원 정보를 입력해주세요.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2 border-b border-slate-100 pb-2 mb-2">
            <h2 className="text-xs font-black text-indigo-600 uppercase tracking-widest">Academy Information</h2>
          </div>

          <div className="md:col-span-2">
            <Field label="학원명" name="academyName" placeholder="학원명을 입력해주세요" value={form.academyName} onChange={change} required />
          </div>
          <Field label="학원 전화번호" name="academyPhone" placeholder="02-1234-5678" value={form.academyPhone} onChange={change} required />
          <Field label="휴대폰 번호" name="mobile" placeholder="010-1234-5678" value={form.mobile} onChange={change} required />

          <div className="md:col-span-2">
            <Field label="추천인 코드 (입력 시 2,000 CON)" name="referralCode" placeholder="추천인 코드가 있다면 입력해주세요" value={form.referralCode} onChange={change} />
          </div>

          <div className="md:col-span-2 space-y-3 mt-4 bg-slate-50 p-6 rounded-3xl border border-slate-100">
            <Check id="terms" name="termsAgreed" checked={form.termsAgreed} onChange={change} label="이용약관에 동의합니다. (필수)" />
            <Check id="privacy" name="privacyAgreed" checked={form.privacyAgreed} onChange={change} label="개인정보처리방침에 동의합니다. (필수)" />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="md:col-span-2 w-full py-5 mt-4 bg-slate-900 text-white font-black rounded-2xl hover:bg-slate-800 transition-all shadow-xl shadow-slate-200 disabled:bg-slate-400 disabled:shadow-none"
          >
            {loading ? '저장 중...' : '서비스 시작하기'}
          </button>
        </form>
      </div>
    </div>
  );
}

function Field({ label, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return (
    <div>
      <label className="block text-sm font-black text-slate-700 mb-2 ml-1">{label}</label>
      <input
        {...props}
        className="w-full px-5 py-3.5 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:border-indigo-500 focus:bg-white outline-none transition-all font-bold text-slate-900 placeholder:text-slate-300"
      />
    </div>
  );
}

function Check({ id, label, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { id: string; label: string }) {
  return (
    <div className="flex items-center gap-3 cursor-pointer group">
      <input type="checkbox" id={id} {...props} className="w-5 h-5 accent-slate-900 cursor-pointer" />
      <label htmlFor={id} className="text-sm font-bold text-slate-600 cursor-pointer group-hover:text-slate-900 transition-colors">
        {label}
      </label>
    </div>
  );
}
