'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

// 프로필 완성 조건: 학원명 + (전화번호 or 휴대폰)
function isProfileComplete(name: string, phone: string, mobile: string) {
  return name.trim().length > 0 && (phone.trim().length > 0 || mobile.trim().length > 0);
}

const RANDOM_ACADEMY_NAMES = [
  '오리온', '페가수스', '시리우스', '카시오페이아', '안드로메다',
  '처녀자리', '사자자리', '전갈자리', '쌍둥이자리', '독수리자리',
  '백조자리', '큰곰자리', '작은곰자리', '에리다누스', '켄타우루스',
  '에메랄드', '사파이어', '루비', '오팔', '토파즈',
  '아폴로', '아테나', '헤르메스', '아르테미스', '포세이돈',
  '북극성', '은하수', '금성', '새벽별', '달빛',
];

function generateRandomAcademyName() {
  const base = RANDOM_ACADEMY_NAMES[Math.floor(Math.random() * RANDOM_ACADEMY_NAMES.length)];
  const num = Math.floor(Math.random() * 900) + 100;
  return `${base}_${num}`;
}

export default function RegisterContent() {
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
    smsMarketingAgreed: false,
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
      const { data, error: authError } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: {
          data: {
            academy_name: formData.academyName || null,
            role: 'admin',
          },
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });

      if (authError) throw authError;

      if (data.user) {
        // 기본 보너스 100C, 프로필 완성 시 추가 200C
        const BASE_BONUS = 100;
        const PROFILE_BONUS = 200;
        const profileComplete = isProfileComplete(formData.academyName, formData.academyPhone, formData.mobile);
        let initialPoints = BASE_BONUS + (profileComplete ? PROFILE_BONUS : 0);

        // 추천인 코드 검증
        let referrerFound = false;
        let referralExtra = 0;
        const enteredCode = formData.referralCode?.trim().toUpperCase();
        if (enteredCode) {
          // DB에서 추천인 추가 보너스 조회
          let referralBonusAmt = 400;
          try {
            const res = await fetch('/api/credits/pricing');
            if (res.ok) {
              const pricingData = await res.json();
              const items: { feature_key: string; cost_per_use: number }[] = pricingData.pricing ?? [];
              const extra = items.find(p => p.feature_key === 'signup_bonus_referral');
              if (extra) referralBonusAmt = extra.cost_per_use;
            }
          } catch {}

          const { data: referrer } = await supabase
            .from('academy_config')
            .select('user_id')
            .eq('own_referral_code', enteredCode)
            .single();
          if (referrer) {
            referrerFound = true;
            referralExtra = referralBonusAmt;
            initialPoints += referralExtra;
          }
        }

        // 학원명 미입력 시 랜덤 이름 생성
        const academyName = formData.academyName.trim() || generateRandomAcademyName();

        const generateKioskCode = () => Math.floor(100000 + Math.random() * 900000).toString();
        let kioskCode = generateKioskCode();
        const ownReferralCode = Math.random().toString(36).slice(2, 10).toUpperCase();

        let dbError = null;
        for (let attempt = 0; attempt < 3; attempt++) {
          const { error } = await supabase
            .from('academy_config')
            .insert([{
              user_id: data.user.id,
              academy_name: academyName,
              academy_phone: formData.academyPhone.trim() || null,
              mobile: formData.mobile.trim() || null,
              referral_code: enteredCode || null,
              points: initialPoints,
              kiosk_code: kioskCode,
              own_referral_code: ownReferralCode,
              sms_marketing_agreed: formData.smsMarketingAgreed,
            }]);
          if (!error) { dbError = null; break; }
          if (error.code === '23505') { kioskCode = generateKioskCode(); dbError = error; }
          else { dbError = error; break; }
        }

        if (dbError) {
          console.error('DB 저장 실패:', dbError);
          alert('가입은 완료되었으나 학원 정보 설정 중 오류가 발생했습니다. 고객센터로 문의해주세요.');
        } else {
          const { data: { session: newSession } } = await supabase.auth.getSession();
          const token = newSession?.access_token;
          // 가입 보너스 CON 이력 기록
          if (token) {
            fetch('/api/signup-record', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
              body: JSON.stringify({ base_amount: BASE_BONUS, referral_amount: referralExtra }),
            }).catch(() => {});
            // 프로필 완성 보너스 기록
            if (profileComplete) {
              fetch('/api/profile-complete-bonus', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
              }).catch(() => {});
            }
          }
          // 추천인 보상
          if (referrerFound && enteredCode && token) {
            fetch('/api/referral-reward', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
              body: JSON.stringify({ referral_code: enteredCode }),
            }).catch(() => {});
          }
          await supabase.auth.signOut();
          const bonusParts = [`기본 ${BASE_BONUS}C`];
          if (profileComplete) bonusParts.push(`프로필 완성 ${PROFILE_BONUS}C`);
          if (referrerFound) bonusParts.push(`추천인 ${referralExtra}C`);
          alert(`축하합니다! 총 ${initialPoints}C가 지급되었습니다.\n(${bonusParts.join(' + ')})\n방금 가입하신 정보로 로그인을 진행해주세요!`);
          router.replace('/login');
        }
      }
    } catch (error: any) {
      if (error.message?.includes('already registered')) {
        alert('이미 가입된 이메일입니다.');
      } else {
        alert('가입 중 오류가 발생했습니다: ' + error.message);
      }
    } finally {
      setLoading(false);
    }
  };

  const profileComplete = isProfileComplete(formData.academyName, formData.academyPhone, formData.mobile);

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center py-12 px-6">
      <div className="max-w-xl w-full bg-white rounded-[2.5rem] shadow-2xl p-10 border border-slate-100">
        <div className="text-center mb-10">
          <div className="inline-flex w-12 h-12 bg-slate-900 rounded-2xl items-center justify-center rotate-3 mb-4 shadow-lg shadow-slate-200">
            <span className="text-yellow-400 font-black text-2xl italic">C</span>
          </div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tighter">CON EDU 시작하기</h1>
          <p className="text-slate-400 font-medium mt-2">AI 영어 문제 생성 솔루션 계정 만들기</p>
        </div>

        <form onSubmit={handleRegister} className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* 아이디/비밀번호 (필수) */}
          <div className="md:col-span-2 border-b border-slate-100 pb-2 mb-2">
            <h2 className="text-xs font-black text-indigo-600 uppercase tracking-widest">계정 정보 (필수)</h2>
          </div>

          <div className="md:col-span-2">
            <Input label="아이디 (이메일)" name="email" type="email" placeholder="example@email.com" value={formData.email} onChange={handleChange} required />
          </div>
          <Input label="비밀번호" name="password" type="password" placeholder="••••••••" value={formData.password} onChange={handleChange} required />
          <Input label="비밀번호 확인" name="confirmPassword" type="password" placeholder="••••••••" value={formData.confirmPassword} onChange={handleChange} required />

          {/* 학원 정보 (선택) + 보너스 안내 */}
          <div className="md:col-span-2 border-b border-slate-100 pb-2 mt-4 mb-1">
            <h2 className="text-xs font-black text-indigo-600 uppercase tracking-widest">학원 정보 (선택)</h2>
          </div>

          {/* 보너스 안내 배너 */}
          <div className={`md:col-span-2 rounded-2xl px-4 py-3 flex items-center gap-3 transition-all ${profileComplete ? 'bg-emerald-50 border border-emerald-200' : 'bg-amber-50 border border-amber-200'}`}>
            <span className="text-lg">{profileComplete ? '✅' : '🎁'}</span>
            <div>
              <p className={`text-xs font-black ${profileComplete ? 'text-emerald-700' : 'text-amber-700'}`}>
                {profileComplete ? '프로필 완성! +200C 추가 지급 예정' : '학원명 + 전화번호 입력 시 +200C 추가 지급'}
              </p>
              <p className="text-[11px] font-bold text-slate-400 mt-0.5">미입력 시 나중에 계정 설정에서 완성하면 지급됩니다</p>
            </div>
          </div>

          <div className="md:col-span-2">
            <Input label="학원명" name="academyName" placeholder="미입력 시 랜덤 이름으로 생성됩니다" value={formData.academyName} onChange={handleChange} />
          </div>
          <Input label="학원 전화번호" name="academyPhone" placeholder="02-1234-5678" value={formData.academyPhone} onChange={handleChange} />
          <Input label="휴대폰 번호" name="mobile" placeholder="010-1234-5678" value={formData.mobile} onChange={handleChange} />

          {/* 추천인 코드 */}
          <div className="md:col-span-2 mt-2">
            <Input label="추천인 코드 (선택)" name="referralCode" placeholder="추천인 코드가 있다면 입력해주세요" value={formData.referralCode} onChange={handleChange} />
          </div>

          {/* 약관 동의 */}
          <div className="md:col-span-2 space-y-3 mt-4 bg-slate-50 p-6 rounded-3xl border border-slate-100">
            <AgreementCheckbox id="terms" name="termsAgreed" checked={formData.termsAgreed} onChange={handleChange} label="이용약관에 동의합니다. (필수)" />
            <AgreementCheckbox id="privacy" name="privacyAgreed" checked={formData.privacyAgreed} onChange={handleChange} label="개인정보처리방침에 동의합니다. (필수)" />
            <AgreementCheckbox id="smsMarketing" name="smsMarketingAgreed" checked={formData.smsMarketingAgreed} onChange={handleChange} label="마케팅 문자 수신에 동의합니다. (선택)" />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="md:col-span-2 w-full py-5 mt-6 bg-slate-900 text-white font-black rounded-2xl hover:bg-slate-800 transition-all shadow-xl shadow-slate-200 disabled:bg-slate-400 disabled:shadow-none"
          >
            {loading ? '정보를 저장하고 있습니다...' : `무료로 시작하기 — 기본 100C 지급`}
          </button>
        </form>

        <p className="text-center mt-8 text-sm font-bold text-slate-400">
          이미 계정이 있으신가요? <Link href="/login" className="text-slate-900 underline underline-offset-4 decoration-2">로그인</Link>
        </p>
      </div>
    </div>
  );
}

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
      />
      <label htmlFor={id} className="text-sm font-bold text-slate-600 cursor-pointer group-hover:text-slate-900 transition-colors">
        {label}
      </label>
    </div>
  );
}
