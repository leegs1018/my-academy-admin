'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';


export default function AccountPage() {
  const router = useRouter();

  // 비밀번호 확인 단계
  const [verified, setVerified] = useState(false);
  const [verifyPassword, setVerifyPassword] = useState('');
  const [verifyLoading, setVerifyLoading] = useState(false);
  const [verifyError, setVerifyError] = useState('');

  // 계정 정보
  const [email, setEmail] = useState('');
  const [provider, setProvider] = useState('email'); // 가입 방법
  const [academyName, setAcademyName] = useState('');
  const [academyPhone, setAcademyPhone] = useState('');
  const [mobile, setMobile] = useState('');
  const [points, setPoints] = useState(0);
  const [kioskCode, setKioskCode] = useState('');
  const [userId, setUserId] = useState('');

  const SNS_PROVIDERS = ['google', 'kakao', 'naver'];
  const PROVIDER_LABEL: Record<string, string> = {
    google: 'Google',
    kakao: '카카오',
    naver: '네이버',
  };

  // 추천인 코드
  const [ownReferralCode, setOwnReferralCode] = useState('');
  const [referralCopied, setReferralCopied] = useState(false);

  // 수정 상태
  const [saving, setSaving] = useState(false);
  const [kioskResetting, setKioskResetting] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');

  // 비밀번호 변경
  const [showPwChange, setShowPwChange] = useState(false);
  const [newPw, setNewPw] = useState('');
  const [newPwConfirm, setNewPwConfirm] = useState('');
  const [pwSaving, setPwSaving] = useState(false);


  // VIP 알림 설정
  const [isVip, setIsVip] = useState(false);
  const [vipConfig, setVipConfig] = useState({
    ppurio_account: '',
    ppurio_api_key: '',
    ppurio_sender_number: '',
    kakao_sender_key: '',
    kakao_template_arrival: '',
    kakao_template_departure: '',
    kakao_template_grade: '',
  });
  const [vipSaving, setVipSaving] = useState(false);
  const [vipMsg, setVipMsg] = useState('');

  // 회원 탈퇴
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [withdrawConfirm, setWithdrawConfirm] = useState('');
  const [withdrawChecked, setWithdrawChecked] = useState(false);
  const [withdrawLoading, setWithdrawLoading] = useState(false);

  // ── 초기 세션 확인 ───────────────────────────────
  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.replace('/login'); return; }
      setEmail(session.user.email || '');
      setUserId(session.user.id);

      // SNS 로그인 감지 → 비밀번호 확인 단계 자동 스킵
      // identities 배열도 확인 (기존 이메일 계정에 SNS 연결된 경우 app_metadata.provider가 'email'로 남음)
      const identities = session.user.identities ?? [];
      const snsIdentity = identities.find((i: { provider: string }) => SNS_PROVIDERS.includes(i.provider));
      const detectedProvider =
        session.user.user_metadata?.provider ||
        snsIdentity?.provider ||
        session.user.app_metadata?.provider ||
        'email';
      setProvider(detectedProvider);

      if (SNS_PROVIDERS.includes(detectedProvider)) {
        // SNS 사용자는 이미 인증된 상태이므로 바로 정보 로드
        const { data } = await supabase
          .from('academy_config')
          .select('academy_name, academy_phone, mobile, points, kiosk_code, own_referral_code, sms_enabled, ppurio_account, ppurio_api_key, ppurio_sender_number, kakao_sender_key, kakao_template_arrival, kakao_template_departure, kakao_template_grade')
          .eq('user_id', session.user.id)
          .single();
        if (data) {
          setAcademyName(data.academy_name || '');
          setAcademyPhone(data.academy_phone || '');
          setMobile(data.mobile || '');
          setPoints(data.points || 0);
          setKioskCode(data.kiosk_code || '');
          setOwnReferralCode(data.own_referral_code || '');
          setIsVip(data.sms_enabled ?? false);
          setVipConfig({
            ppurio_account:        data.ppurio_account        || '',
            ppurio_api_key:        data.ppurio_api_key        || '',
            ppurio_sender_number:  data.ppurio_sender_number  || '',
            kakao_sender_key:      data.kakao_sender_key      || '',
            kakao_template_arrival:   data.kakao_template_arrival   || '',
            kakao_template_departure: data.kakao_template_departure || '',
            kakao_template_grade:     data.kakao_template_grade     || '',
          });
        }
        setVerified(true);
      }
    };
    init();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  // ── 비밀번호 확인 ────────────────────────────────
  const handleVerify = async (e: { preventDefault: () => void }) => {
    e.preventDefault();
    setVerifyLoading(true);
    setVerifyError('');

    const { error } = await supabase.auth.signInWithPassword({ email, password: verifyPassword });
    if (error) {
      setVerifyError('비밀번호가 일치하지 않습니다.');
      setVerifyLoading(false);
      return;
    }

    const { data } = await supabase
      .from('academy_config')
      .select('academy_name, academy_phone, mobile, points, kiosk_code, own_referral_code, sms_enabled, ppurio_account, ppurio_api_key, ppurio_sender_number, kakao_sender_key, kakao_template_arrival, kakao_template_departure, kakao_template_grade')
      .eq('user_id', userId)
      .single();

    if (data) {
      setAcademyName(data.academy_name || '');
      setAcademyPhone(data.academy_phone || '');
      setMobile(data.mobile || '');
      setPoints(data.points || 0);
      setKioskCode(data.kiosk_code || '');
      setOwnReferralCode(data.own_referral_code || '');
      setIsVip(data.sms_enabled ?? false);
      setVipConfig({
        ppurio_account:           data.ppurio_account           || '',
        ppurio_api_key:           data.ppurio_api_key           || '',
        ppurio_sender_number:     data.ppurio_sender_number     || '',
        kakao_sender_key:         data.kakao_sender_key         || '',
        kakao_template_arrival:   data.kakao_template_arrival   || '',
        kakao_template_departure: data.kakao_template_departure || '',
        kakao_template_grade:     data.kakao_template_grade     || '',
      });
    }

    setVerifyLoading(false);
    setVerified(true);
  };

  // ── 학원 정보 저장 ────────────────────────────────
  const handleSave = async () => {
    setSaving(true);
    setSaveMsg('');
    const { error } = await supabase
      .from('academy_config')
      .update({ academy_name: academyName, academy_phone: academyPhone, mobile })
      .eq('user_id', userId);

    setSaving(false);
    setSaveMsg(error ? '저장 중 오류가 발생했습니다.' : '저장되었습니다.');
    setTimeout(() => setSaveMsg(''), 3000);
  };

  // ── VIP 설정 저장 ────────────────────────────────
  const handleVipSave = async () => {
    setVipSaving(true);
    setVipMsg('');
    const { error } = await supabase
      .from('academy_config')
      .update(vipConfig)
      .eq('user_id', userId);
    setVipSaving(false);
    setVipMsg(error ? '저장 중 오류가 발생했습니다.' : '저장되었습니다.');
    setTimeout(() => setVipMsg(''), 3000);
  };

  // ── 키오스크 코드 재발급 ──────────────────────────
  const handleKioskReset = async () => {
    if (!confirm('키오스크 코드를 재발급하면 기존 코드로 연결된 키오스크에서 재입력이 필요합니다. 계속할까요?')) return;
    setKioskResetting(true);
    const newCode = Math.floor(100000 + Math.random() * 900000).toString();
    const { error } = await supabase
      .from('academy_config')
      .update({ kiosk_code: newCode })
      .eq('user_id', userId);
    setKioskResetting(false);
    if (!error) setKioskCode(newCode);
    else alert('재발급 중 오류가 발생했습니다.');
  };

  // ── 회원 탈퇴 ────────────────────────────────────
  const handleWithdraw = async () => {
    if (withdrawConfirm !== '탈퇴합니다' || !withdrawChecked) return;
    setWithdrawLoading(true);

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { router.replace('/login'); return; }

    const res = await fetch('/api/auth/withdraw', { method: 'POST' });
    const data = await res.json();

    if (!res.ok) {
      if (data.error === 'paid_con_exists') {
        alert('유료 충전한 CON 잔액이 있습니다.\n문의하기 페이지에서 환불 문의 후 탈퇴를 진행해주세요.');
      } else {
        alert('탈퇴 처리 중 오류가 발생했습니다. 고객센터로 문의해주세요.');
      }
      setWithdrawLoading(false);
      return;
    }

    await supabase.auth.signOut();
    localStorage.removeItem('con-edu-auto-login');
    router.replace('/?withdrawn=1');
  };

  // ── 비밀번호 변경 ────────────────────────────────
  const handlePwChange = async () => {
    if (!newPw || newPw !== newPwConfirm) {
      alert('새 비밀번호를 확인해주세요.');
      return;
    }
    if (newPw.length < 6) {
      alert('비밀번호는 6자 이상이어야 합니다.');
      return;
    }
    setPwSaving(true);
    const { error } = await supabase.auth.updateUser({ password: newPw });
    setPwSaving(false);

    if (error) {
      alert('비밀번호 변경 실패: ' + error.message);
    } else {
      alert('비밀번호가 변경되었습니다.');
      setNewPw('');
      setNewPwConfirm('');
      setShowPwChange(false);
    }
  };

  // ── 비밀번호 확인 화면 ───────────────────────────
  if (!verified) {
    return (
      <div className="max-w-md mx-auto pt-10">
        <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-8 py-6 border-b border-gray-100">
            <h1 className="text-xl font-black text-gray-800">계정 정보 확인</h1>
            <p className="text-sm text-gray-400 mt-1">보안을 위해 현재 비밀번호를 입력해주세요.</p>
          </div>
          <form onSubmit={handleVerify} className="px-8 py-6 space-y-5">
            <div>
              <label className="block text-xs font-black text-gray-500 uppercase tracking-wider mb-2">이메일 (아이디)</label>
              <div className="px-4 py-3 bg-gray-50 rounded-2xl border border-gray-100 text-sm font-bold text-gray-400">
                {email || '로딩 중...'}
              </div>
            </div>
            <div>
              <label className="block text-xs font-black text-gray-500 uppercase tracking-wider mb-2">현재 비밀번호</label>
              <input
                type="password"
                placeholder="현재 비밀번호 입력"
                value={verifyPassword}
                onChange={e => setVerifyPassword(e.target.value)}
                className="w-full px-4 py-3 bg-gray-50 border-2 border-gray-100 rounded-2xl focus:border-gray-900 focus:bg-white outline-none transition-all font-bold text-gray-900 placeholder:text-gray-300"
                required
                autoFocus
              />
              {verifyError && <p className="mt-2 text-xs font-bold text-red-500">{verifyError}</p>}
            </div>
            <button
              type="submit"
              disabled={verifyLoading}
              className="w-full py-4 bg-gray-900 text-white font-black rounded-2xl hover:bg-gray-800 transition-all disabled:bg-gray-300 text-sm"
            >
              {verifyLoading ? '확인 중...' : '확인 후 계정 정보 보기'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // ── 계정 정보 화면 ───────────────────────────────
  return (
    <div className="max-w-2xl mx-auto py-2">
      <div className="mb-6">
        <h1 className="text-2xl font-black text-gray-800">계정 정보</h1>
        <p className="text-sm text-gray-400 mt-1">학원 정보 및 계정을 관리합니다</p>
      </div>

      <div className="space-y-4">

        {/* 포인트 배지 */}
        <div className="bg-gray-900 rounded-3xl p-6 flex items-center justify-between">
          <div>
            <p className="text-xs font-black text-gray-400 tracking-wider">MY CON</p>
            <p className="text-3xl font-black text-white mt-1">{points.toLocaleString()}<span className="text-lg text-gray-400 ml-1">C</span></p>
            <p className="text-xs text-gray-500 mt-1.5">1,000 CON = 10,000원 · 충전 및 환불 문의는 문의하기 게시판을 이용해주세요</p>
          </div>
          <div className="w-14 h-14 bg-yellow-400 rounded-2xl flex items-center justify-center text-2xl">⭐</div>
        </div>

        {/* 계정 기본 정보 */}
        <div className="bg-white rounded-3xl border border-gray-100 overflow-hidden shadow-sm">
          <div className="px-6 py-4 border-b border-gray-50">
            <h2 className="text-sm font-black text-gray-600 uppercase tracking-wider">계정 정보</h2>
          </div>
          <div className="px-6 py-5 space-y-4">
            <div>
              <label className="block text-xs font-black text-gray-400 mb-1.5">이메일 (아이디)</label>
              <div className="px-4 py-3 bg-gray-50 rounded-2xl text-sm font-bold text-gray-500 border border-gray-100">
                {email}
              </div>
            </div>
            <div>
              <label className="block text-xs font-black text-gray-400 mb-1.5">가입 방법</label>
              <div className="flex items-center gap-2">
                <span className={`px-3 py-1.5 text-xs font-black rounded-xl border ${
                  provider === 'google' ? 'bg-blue-50 text-blue-600 border-blue-200' :
                  provider === 'kakao'  ? 'bg-yellow-50 text-yellow-700 border-yellow-200' :
                  provider === 'naver'  ? 'bg-green-50 text-green-600 border-green-200' :
                  'bg-gray-50 text-gray-500 border-gray-200'
                }`}>
                  {PROVIDER_LABEL[provider] ?? '이메일'} 로그인
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* 학원 정보 */}
        <div className="bg-white rounded-3xl border border-gray-100 overflow-hidden shadow-sm">
          <div className="px-6 py-4 border-b border-gray-50">
            <h2 className="text-sm font-black text-gray-600 uppercase tracking-wider">학원 정보</h2>
          </div>
          <div className="px-6 py-5 space-y-4">
            <div>
              <label className="block text-xs font-black text-gray-400 mb-1.5">학원명</label>
              <input
                type="text"
                value={academyName}
                onChange={e => setAcademyName(e.target.value)}
                className="w-full px-4 py-3 bg-gray-50 border-2 border-gray-100 rounded-2xl focus:border-gray-900 focus:bg-white outline-none transition-all font-bold text-gray-900 text-sm"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-black text-gray-400 mb-1.5">학원 전화번호</label>
                <input
                  type="text"
                  value={academyPhone}
                  onChange={e => setAcademyPhone(e.target.value)}
                  placeholder="02-1234-5678"
                  className="w-full px-4 py-3 bg-gray-50 border-2 border-gray-100 rounded-2xl focus:border-gray-900 focus:bg-white outline-none transition-all font-bold text-gray-900 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-black text-gray-400 mb-1.5">휴대폰 번호</label>
                <input
                  type="text"
                  value={mobile}
                  onChange={e => setMobile(e.target.value)}
                  placeholder="010-1234-5678"
                  className="w-full px-4 py-3 bg-gray-50 border-2 border-gray-100 rounded-2xl focus:border-gray-900 focus:bg-white outline-none transition-all font-bold text-gray-900 text-sm"
                />
              </div>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-6 py-3 bg-gray-900 text-white font-black rounded-2xl hover:bg-gray-800 transition-all disabled:bg-gray-300 text-sm"
              >
                {saving ? '저장 중...' : '변경사항 저장'}
              </button>
              {saveMsg && (
                <span className={`text-sm font-bold ${saveMsg.includes('오류') ? 'text-red-500' : 'text-green-500'}`}>
                  {saveMsg}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* 키오스크 코드 */}
        <div className="bg-white rounded-3xl border border-gray-100 overflow-hidden shadow-sm">
          <div className="px-6 py-4 border-b border-gray-50">
            <h2 className="text-sm font-black text-gray-600 uppercase tracking-wider">출결 키오스크 코드</h2>
          </div>
          <div className="px-6 py-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-gray-400 mb-1">현재 코드</p>
              <p className="text-4xl font-black text-gray-900 tracking-[0.25em]">{kioskCode || '------'}</p>
            </div>
            <button
              onClick={handleKioskReset}
              disabled={kioskResetting}
              className="px-5 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-black rounded-2xl transition-all disabled:opacity-50 text-sm"
            >
              {kioskResetting ? '재발급 중...' : '🔄 재발급'}
            </button>
          </div>
        </div>

        {/* 내 추천인 코드 */}
        <div className="bg-white rounded-3xl border border-gray-100 overflow-hidden shadow-sm">
          <div className="px-6 py-4 border-b border-gray-50">
            <h2 className="text-sm font-black text-gray-600 uppercase tracking-wider">내 추천인 코드</h2>
          </div>
          <div className="px-6 py-5 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-gray-400 mb-1">내 코드</p>
                <p className="text-3xl font-black text-gray-900 tracking-[0.2em]">{ownReferralCode || '------'}</p>
              </div>
              {ownReferralCode && (
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(ownReferralCode);
                    setReferralCopied(true);
                    setTimeout(() => setReferralCopied(false), 2000);
                  }}
                  className="px-5 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-black rounded-2xl transition-all text-sm"
                >
                  {referralCopied ? '✅ 복사됨' : '📋 복사'}
                </button>
              )}
            </div>
            <div className="bg-yellow-50 rounded-2xl px-4 py-3 border border-yellow-100">
              <p className="text-xs font-black text-yellow-700 mb-1">추천인 보상 안내</p>
              <p className="text-xs font-bold text-yellow-600">신규 회원이 가입 시 내 추천인 코드를 입력하면, 신규 회원에게 추가 CON이 지급됩니다.</p>
            </div>
          </div>
        </div>

        {/* VIP 알림 설정 — sms_enabled 계정만 표시 */}
        {isVip && (
          <div className="bg-white rounded-3xl border border-yellow-200 overflow-hidden shadow-sm">
            <div className="px-6 py-4 border-b border-yellow-100 flex items-center gap-2">
              <span className="text-base">⭐</span>
              <div>
                <h2 className="text-sm font-black text-gray-700">VIP 알림 설정</h2>
                <p className="text-xs text-gray-400 mt-0.5">뿌리오 계정으로 SMS / 카카오 알림톡 발송</p>
              </div>
            </div>
            <div className="px-6 py-5 space-y-4">
              {[
                { key: 'ppurio_sender_number',     label: 'SMS 발신번호' },
                { key: 'kakao_sender_key',         label: '카카오 발신프로파일 키 (senderKey)' },
                { key: 'kakao_template_arrival',   label: '등원 알림 템플릿 코드' },
                { key: 'kakao_template_departure', label: '하원 알림 템플릿 코드' },
                { key: 'kakao_template_grade',     label: '성적 알림 템플릿 코드' },
              ].map(f => (
                <div key={f.key}>
                  <label className="block text-xs font-black text-gray-400 mb-1.5">{f.label}</label>
                  <input
                    type="text"
                    value={vipConfig[f.key as keyof typeof vipConfig]}
                    onChange={e => setVipConfig(prev => ({ ...prev, [f.key]: e.target.value }))}
                    className="w-full px-4 py-3 bg-gray-50 border-2 border-gray-100 rounded-2xl focus:border-yellow-400 focus:bg-white outline-none transition-all font-bold text-gray-900 text-sm"
                  />
                </div>
              ))}
              <div className="flex items-center gap-3 pt-1">
                <button
                  onClick={handleVipSave}
                  disabled={vipSaving}
                  className="px-6 py-3 bg-yellow-400 text-gray-900 font-black rounded-2xl hover:bg-yellow-300 transition-all disabled:opacity-50 text-sm"
                >
                  {vipSaving ? '저장 중...' : '저장'}
                </button>
                {vipMsg && (
                  <span className={`text-sm font-bold ${vipMsg.includes('오류') ? 'text-red-500' : 'text-green-500'}`}>
                    {vipMsg}
                  </span>
                )}
              </div>
            </div>
          </div>
        )}

        {/* 비밀번호 변경 - SNS 사용자는 숨김 */}
        {!SNS_PROVIDERS.includes(provider) && <div className="bg-white rounded-3xl border border-gray-100 overflow-hidden shadow-sm">
          <button
            onClick={() => setShowPwChange(!showPwChange)}
            className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <span className="text-lg">🔐</span>
              <span className="text-sm font-black text-gray-700">비밀번호 변경</span>
            </div>
            <span className="text-gray-400 text-sm">{showPwChange ? '▲' : '▼'}</span>
          </button>

          {showPwChange && (
            <div className="px-6 pb-6 space-y-3 border-t border-gray-50 pt-4">
              <div>
                <label className="block text-xs font-black text-gray-400 mb-1.5">새 비밀번호</label>
                <input
                  type="password"
                  value={newPw}
                  onChange={e => setNewPw(e.target.value)}
                  placeholder="새 비밀번호 (6자 이상)"
                  className="w-full px-4 py-3 bg-gray-50 border-2 border-gray-100 rounded-2xl focus:border-gray-900 focus:bg-white outline-none transition-all font-bold text-gray-900 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-black text-gray-400 mb-1.5">새 비밀번호 확인</label>
                <input
                  type="password"
                  value={newPwConfirm}
                  onChange={e => setNewPwConfirm(e.target.value)}
                  placeholder="새 비밀번호 재입력"
                  className="w-full px-4 py-3 bg-gray-50 border-2 border-gray-100 rounded-2xl focus:border-gray-900 focus:bg-white outline-none transition-all font-bold text-gray-900 text-sm"
                />
                {newPw && newPwConfirm && newPw !== newPwConfirm && (
                  <p className="mt-1.5 text-xs font-bold text-red-400">비밀번호가 일치하지 않습니다.</p>
                )}
              </div>
              <button
                onClick={handlePwChange}
                disabled={pwSaving || !newPw || newPw !== newPwConfirm}
                className="px-6 py-3 bg-gray-900 text-white font-black rounded-2xl hover:bg-gray-800 transition-all disabled:bg-gray-300 text-sm"
              >
                {pwSaving ? '변경 중...' : '비밀번호 변경'}
              </button>
            </div>
          )}
        </div>}

        {/* 회원 탈퇴 */}
        <div className="bg-white rounded-3xl border border-red-100 overflow-hidden shadow-sm">
          <div className="px-6 py-5 flex items-center justify-between">
            <div>
              <p className="text-sm font-black text-gray-700">회원 탈퇴</p>
              <p className="text-xs text-gray-400 mt-0.5">탈퇴 시 모든 데이터가 삭제되며 복구할 수 없습니다.</p>
            </div>
            <button
              onClick={() => { setShowWithdrawModal(true); setWithdrawConfirm(''); setWithdrawChecked(false); }}
              className="px-4 py-2 text-sm font-black text-red-500 bg-red-50 hover:bg-red-100 rounded-2xl transition-all border border-red-100"
            >
              회원 탈퇴
            </button>
          </div>
        </div>
      </div>

      {/* 회원 탈퇴 모달 */}
      {showWithdrawModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => !withdrawLoading && setShowWithdrawModal(false)} />
          <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="px-6 py-5 border-b border-gray-100">
              <h3 className="text-lg font-black text-gray-900">회원 탈퇴</h3>
              <p className="text-xs text-gray-400 mt-1">탈퇴 전 아래 내용을 꼭 확인해주세요.</p>
            </div>

            <div className="px-6 py-5 space-y-4">
              {/* 삭제 데이터 안내 */}
              <div className="bg-red-50 rounded-2xl p-4 space-y-2">
                <p className="text-xs font-black text-red-600 uppercase tracking-wider">탈퇴 시 삭제되는 데이터</p>
                <ul className="text-xs font-bold text-red-500 space-y-1">
                  <li>• 학원 정보 (학원명, 전화번호, 담당자 정보)</li>
                  <li>• 등록된 학생 데이터</li>
                  <li>• AI 문제 생성 이력</li>
                  <li>• 지문분석 워크북 이력</li>
                  <li>• 잔여 무료 CON (소멸)</li>
                </ul>
              </div>

              {/* CON 환불 안내 */}
              <div className="bg-yellow-50 rounded-2xl p-4">
                <p className="text-xs font-black text-yellow-700 mb-1">💰 유료 충전 CON 안내</p>
                <p className="text-xs font-bold text-yellow-600">
                  유료로 충전한 CON 잔액이 있는 경우 탈퇴가 제한됩니다.<br />
                  <a href="/admin/inquiries" className="underline font-black">문의하기</a> 페이지에서 환불 문의 후 탈퇴를 진행해주세요.
                </p>
              </div>

              {/* 동의 체크 */}
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={withdrawChecked}
                  onChange={e => setWithdrawChecked(e.target.checked)}
                  className="w-4 h-4 mt-0.5 accent-red-500 cursor-pointer flex-shrink-0"
                />
                <span className="text-xs font-bold text-gray-600">
                  위 내용을 확인하였으며, 유료 충전 CON 잔액이 없음을 확인합니다. 탈퇴 후 데이터 복구가 불가능함에 동의합니다.
                </span>
              </label>

              {/* 확인 입력 */}
              <div>
                <label className="block text-xs font-black text-gray-500 mb-2">
                  확인을 위해 <span className="text-red-500">탈퇴합니다</span> 를 입력해주세요.
                </label>
                <input
                  type="text"
                  value={withdrawConfirm}
                  onChange={e => setWithdrawConfirm(e.target.value)}
                  placeholder="탈퇴합니다"
                  className="w-full px-4 py-3 bg-gray-50 border-2 border-gray-100 rounded-2xl focus:border-red-400 focus:bg-white outline-none transition-all font-bold text-gray-900 text-sm placeholder:text-gray-300"
                />
              </div>
            </div>

            <div className="px-6 pb-6 flex gap-3">
              <button
                onClick={() => setShowWithdrawModal(false)}
                disabled={withdrawLoading}
                className="flex-1 py-3 text-sm font-black text-gray-500 bg-gray-100 hover:bg-gray-200 rounded-2xl transition-all disabled:opacity-50"
              >
                취소
              </button>
              <button
                onClick={handleWithdraw}
                disabled={withdrawLoading || withdrawConfirm !== '탈퇴합니다' || !withdrawChecked}
                className="flex-1 py-3 text-sm font-black text-white bg-red-500 hover:bg-red-600 rounded-2xl transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {withdrawLoading ? '처리 중...' : '탈퇴하기'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
