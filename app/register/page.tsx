'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase'; // 💡 공통 클라이언트 사용으로 중복 제거
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function RegisterPage() {
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    academyName: '',
    academyPhone: '',
    mobile: '',
    referralCode: '',
    termsAgreed: false,
    privacyAgreed: false,
  });
  
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();

    // 1. 유효성 검사
    if (formData.password !== formData.confirmPassword) {
      alert('비밀번호가 일치하지 않습니다.');
      return;
    }
    if (!formData.termsAgreed || !formData.privacyAgreed) {
      alert('필수 약관에 동의해주세요.');
      return;
    }

    setLoading(true);

    try {
      // 2. Supabase Auth 회원가입 시도
      const { data, error: authError } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: {
          // 💡 메타데이터에 학원명을 미리 넣어두면 나중에 관리하기 편합니다.
          data: {
            academy_name: formData.academyName,
          },
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });

      if (authError) throw authError;

      if (data.user) {
        // [비즈니스 로직] 추천인 코드 유무에 따른 포인트 차등 지급
        const initialPoints = formData.referralCode ? 2000 : 1000;

        // 키오스크 코드 생성 (6자리 랜덤, 중복 시 최대 3회 재시도)
        const generateKioskCode = () => Math.floor(100000 + Math.random() * 900000).toString();
        let kioskCode = generateKioskCode();

        // 3. academy_config 테이블에 상세 정보 저장
        let dbError = null;
        for (let attempt = 0; attempt < 3; attempt++) {
          const { error } = await supabase
            .from('academy_config')
            .insert([
              {
                user_id: data.user.id,
                academy_name: formData.academyName,
                academy_phone: formData.academyPhone,
                mobile: formData.mobile,
                referral_code: formData.referralCode,
                points: initialPoints,
                kiosk_code: kioskCode,
              }
            ]);
          if (!error) { dbError = null; break; }
          if (error.code === '23505') { kioskCode = generateKioskCode(); dbError = error; }
          else { dbError = error; break; }
        }

        if (dbError) {
          // 💡 Auth는 성공했는데 DB 저장이 실패한 경우를 대비해 알림
          console.error('DB 저장 실패:', dbError);
          alert('가입은 완료되었으나 학원 정보 설정 중 오류가 발생했습니다. 고객센터로 문의해주세요.');
        } else {
          // 💡 가입 성공 후 세션 즉시 로그아웃 (원장님 의도 반영)
          await supabase.auth.signOut(); 
          
          alert(`축하합니다! 가입 기념 ${initialPoints.toLocaleString()}포인트가 지급되었습니다.\n방금 가입하신 정보로 로그인을 진행해주세요!`);
          
          router.replace('/login'); 
        }
      }
    } catch (error: any) {
      if (error.message.includes('already registered')) {
        alert('이미 가입된 이메일입니다.');
      } else {
        alert('가입 중 오류가 발생했습니다: ' + error.message);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center py-12 px-6">
      <div className="max-w-xl w-full bg-white rounded-[2.5rem] shadow-2xl p-10 border border-slate-100">
        <div className="text-center mb-10">
          <div className="inline-flex w-12 h-12 bg-slate-900 rounded-2xl items-center justify-center rotate-3 mb-4 shadow-lg shadow-slate-200">
            <span className="text-yellow-400 font-black text-2xl italic">C</span>
          </div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tighter">클래스허브 시작하기</h1>
          <p className="text-slate-400 font-medium mt-2">원장님 전용 관리 솔루션 계정 생성</p>
        </div>

        <form onSubmit={handleRegister} className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2 border-b border-slate-100 pb-2 mb-2">
            <h2 className="text-xs font-black text-indigo-600 uppercase tracking-widest">Academy Information</h2>
          </div>
          
          <div className="md:col-span-2">
            <Input label="학원명" name="academyName" placeholder="학원명을 입력해주세요" value={formData.academyName} onChange={handleChange} required />
          </div>
          
          <Input label="학원 전화번호" name="academyPhone" placeholder="02-1234-5678" value={formData.academyPhone} onChange={handleChange} required />
          <Input label="휴대폰 번호" name="mobile" placeholder="010-1234-5678" value={formData.mobile} onChange={handleChange} required />

          <div className="md:col-span-2 border-b border-slate-100 pb-2 mt-4 mb-2">
            <h2 className="text-xs font-black text-indigo-600 uppercase tracking-widest">Account Details</h2>
          </div>

          <div className="md:col-span-2">
            <Input label="아이디 (이메일)" name="email" type="email" placeholder="example@email.com" value={formData.email} onChange={handleChange} required />
          </div>
          
          <Input label="비밀번호" name="password" type="password" placeholder="••••••••" value={formData.password} onChange={handleChange} required />
          <Input label="비밀번호 확인" name="confirmPassword" type="password" placeholder="••••••••" value={formData.confirmPassword} onChange={handleChange} required />

          <div className="md:col-span-2">
            <Input label="추천인 코드 (입력 시 2,000P)" name="referralCode" placeholder="추천인 코드가 있다면 입력해주세요" value={formData.referralCode} onChange={handleChange} />
          </div>

          <div className="md:col-span-2 space-y-3 mt-6 bg-slate-50 p-6 rounded-3xl border border-slate-100">
            <AgreementCheckbox id="terms" name="termsAgreed" checked={formData.termsAgreed} onChange={handleChange} label="이용약관에 동의합니다. (필수)" />
            <AgreementCheckbox id="privacy" name="privacyAgreed" checked={formData.privacyAgreed} onChange={handleChange} label="개인정보처리방침에 동의합니다. (필수)" />
          </div>

          <button 
            type="submit" 
            disabled={loading}
            className="md:col-span-2 w-full py-5 mt-6 bg-slate-900 text-white font-black rounded-2xl hover:bg-slate-800 transition-all shadow-xl shadow-slate-200 disabled:bg-slate-400 disabled:shadow-none"
          >
            {loading ? '정보를 저장하고 있습니다...' : '무료로 시작하기'}
          </button>
        </form>

        <p className="text-center mt-8 text-sm font-bold text-slate-400">
          이미 계정이 있으신가요? <Link href="/login" className="text-slate-900 underline underline-offset-4 decoration-2">로그인</Link>
        </p>
      </div>
    </div>
  );
}

// 💡 재사용 가능한 서브 컴포넌트들
function Input({ label, ...props }: any) {
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

function AgreementCheckbox({ id, label, ...props }: any) {
  return (
    <div className="flex items-center gap-3 cursor-pointer group">
      <input 
        type="checkbox" 
        id={id} 
        {...props}
        className="w-5 h-5 accent-slate-900 cursor-pointer rounded-lg" 
        required 
      />
      <label htmlFor={id} className="text-sm font-bold text-slate-600 cursor-pointer group-hover:text-slate-900 transition-colors">
        {label}
      </label>
    </div>
  );
}