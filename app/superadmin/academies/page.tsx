'use client';

import { useState, useEffect, useMemo } from 'react';

interface Academy {
  user_id: string;
  academy_name: string;
  email: string;
  academy_phone: string;
  mobile: string;
  points: number;
  kiosk_code: string;
  referral_code: string;
  own_referral_code: string | null;
  created_at: string;
  student_count: number;
  sms_count: number;
  sms_enabled: boolean;
  role: 'ai_only' | 'admin';
  provider: string;
  profile_completed: boolean;
}

const PROVIDER_BADGE: Record<string, { label: string; className: string }> = {
  google:  { label: 'Google',  className: 'bg-blue-900/40 text-blue-300 border border-blue-800' },
  kakao:   { label: '카카오',  className: 'bg-yellow-900/40 text-yellow-300 border border-yellow-800' },
  naver:   { label: '네이버',  className: 'bg-green-900/40 text-green-300 border border-green-800' },
  email:   { label: '이메일',  className: 'bg-slate-800 text-slate-400 border border-slate-700' },
};

interface ChargeModal {
  academy: Academy;
  amount: string;
  description: string;
  is_free: boolean;
  loading: boolean;
  result: string;
}

export default function AcademiesPage() {
  const [academies, setAcademies] = useState<Academy[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [chargeModal, setChargeModal] = useState<ChargeModal | null>(null);
  const [roleLoading, setRoleLoading] = useState<string | null>(null);
  const [smsLoading, setSmsLoading] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/superadmin/academies')
      .then(r => r.json())
      .then(d => { setAcademies(d.academies || []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const filtered = useMemo(() =>
    academies.filter(a =>
      a.academy_name?.includes(search) ||
      a.email?.includes(search) ||
      a.academy_phone?.includes(search) ||
      a.own_referral_code?.includes(search.toUpperCase())
    ),
    [academies, search]
  );

  const handleRoleChange = async (academy: Academy, newRole: 'ai_only' | 'admin') => {
    if (roleLoading) return;
    setRoleLoading(academy.user_id);
    try {
      const res = await fetch('/api/superadmin/users/role', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: academy.user_id, role: newRole }),
      });
      const data = await res.json() as { success?: boolean; error?: string };
      if (data.success) {
        setAcademies(prev => prev.map(a =>
          a.user_id === academy.user_id ? { ...a, role: newRole } : a
        ));
      } else {
        alert(data.error || '역할 변경 실패');
      }
    } catch {
      alert('서버 오류가 발생했습니다.');
    } finally {
      setRoleLoading(null);
    }
  };

  const handleSmsToggle = async (academy: Academy) => {
    if (smsLoading) return;
    setSmsLoading(academy.user_id);
    try {
      const res = await fetch('/api/superadmin/users/sms-enabled', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: academy.user_id, smsEnabled: !academy.sms_enabled }),
      });
      const data = await res.json() as { success?: boolean; error?: string };
      if (data.success) {
        setAcademies(prev => prev.map(a =>
          a.user_id === academy.user_id ? { ...a, sms_enabled: !academy.sms_enabled } : a
        ));
      } else {
        alert(data.error || 'SMS 권한 변경 실패');
      }
    } catch {
      alert('서버 오류가 발생했습니다.');
    } finally {
      setSmsLoading(null);
    }
  };

  const openChargeModal = (academy: Academy) => {
    setChargeModal({ academy, amount: '', description: '', is_free: false, loading: false, result: '' });
  };

  const handleCharge = async () => {
    if (!chargeModal || !chargeModal.amount) return;
    const amount = parseInt(chargeModal.amount, 10);
    if (isNaN(amount) || amount <= 0) return;

    setChargeModal(prev => prev ? { ...prev, loading: true, result: '' } : null);

    try {
      const res = await fetch('/api/superadmin/credits/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          academy_id: chargeModal.academy.user_id,
          amount,
          description: chargeModal.description,
          is_free: chargeModal.is_free,
        }),
      });
      const data = await res.json();

      if (data.success) {
        setAcademies(prev =>
          prev.map(a =>
            a.user_id === chargeModal.academy.user_id
              ? { ...a, points: data.new_balance }
              : a
          )
        );
        setChargeModal(prev => prev ? { ...prev, loading: false, result: `충전 완료! 새 잔액: ${data.new_balance.toLocaleString()} CON` } : null);
      } else {
        setChargeModal(prev => prev ? { ...prev, loading: false, result: `오류: ${data.error}` } : null);
      }
    } catch {
      setChargeModal(prev => prev ? { ...prev, loading: false, result: '서버 오류가 발생했습니다.' } : null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="text-4xl mb-4 animate-pulse">🏫</div>
          <p className="text-slate-400 font-bold">데이터 불러오는 중...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-black text-white">🏫 학원 관리</h1>
        <p className="text-sm text-slate-500 mt-1 font-bold">총 {academies.length}개 학원 가입</p>
      </div>

      <div className="flex gap-3">
        <input
          type="text"
          placeholder="학원명 / 이메일 / 전화번호 검색..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="flex-1 bg-slate-900 border-2 border-slate-800 rounded-xl px-4 py-2.5 text-sm font-bold text-white placeholder:text-slate-600 focus:border-indigo-500 focus:outline-none"
        />
        <span className="px-4 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-sm font-black text-slate-400">
          {filtered.length}개
        </span>
      </div>

      <div className="bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-800/50">
              <tr>
                <th className="py-3 px-4 text-left text-xs font-black text-slate-500">학원명</th>
                <th className="py-3 px-4 text-center text-xs font-black text-slate-500">가입방법</th>
                <th className="py-3 px-4 text-left text-xs font-black text-slate-500">이메일</th>
                <th className="py-3 px-4 text-left text-xs font-black text-slate-500 hidden md:table-cell">전화번호</th>
                <th className="py-3 px-4 text-center text-xs font-black text-slate-500">키오스크</th>
                <th className="py-3 px-4 text-center text-xs font-black text-slate-500">추천인코드</th>
                <th className="py-3 px-4 text-center text-xs font-black text-slate-500">잔여 콘</th>
                <th className="py-3 px-4 text-center text-xs font-black text-slate-500">학생수</th>
                <th className="py-3 px-4 text-center text-xs font-black text-slate-500">SMS발송수</th>
                <th className="py-3 px-4 text-center text-xs font-black text-slate-500">SMS권한</th>
                <th className="py-3 px-4 text-center text-xs font-black text-slate-500">역할</th>
                <th className="py-3 px-4 text-right text-xs font-black text-slate-500">가입일</th>
                <th className="py-3 px-4 text-center text-xs font-black text-slate-500">CON</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((a) => {
                const date = new Date(a.created_at);
                const dateStr = `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, '0')}.${String(date.getDate()).padStart(2, '0')}`;
                return (
                  <tr key={a.user_id} className="border-t border-slate-800 hover:bg-slate-800/30 transition-colors">
                    <td className="py-3 px-4">
                      <span className="font-black text-white">{a.academy_name || '(미설정)'}</span>
                      {!a.profile_completed && (
                        <span className="ml-1.5 text-[9px] font-black px-1.5 py-0.5 rounded bg-red-900/50 text-red-400 border border-red-800">프로필 미완성</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-center">
                      {(() => {
                        const badge = PROVIDER_BADGE[a.provider] ?? PROVIDER_BADGE.email;
                        return (
                          <span className={`inline-block px-2 py-0.5 text-[10px] font-black rounded-md ${badge.className}`}>
                            {badge.label}
                          </span>
                        );
                      })()}
                    </td>
                    <td className="py-3 px-4 text-slate-400 font-bold text-xs">{a.email}</td>
                    <td className="py-3 px-4 text-slate-400 font-bold text-xs hidden md:table-cell">
                      {a.academy_phone || a.mobile || '-'}
                    </td>
                    <td className="py-3 px-4 text-center font-black text-slate-300 tracking-widest">
                      {a.kiosk_code || '-'}
                    </td>
                    <td className="py-3 px-4 text-center">
                      {a.own_referral_code
                        ? <span className="font-black text-indigo-300 tracking-widest text-xs">{a.own_referral_code}</span>
                        : <span className="text-slate-600 text-xs">-</span>}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className="font-black text-yellow-400">{(a.points || 0).toLocaleString()}</span>
                      <span className="text-xs text-slate-500 ml-0.5">C</span>
                    </td>
                    <td className="py-3 px-4 text-center font-black text-emerald-400">{a.student_count}</td>
                    <td className="py-3 px-4 text-center font-black text-indigo-400">{a.sms_count}</td>
                    <td className="py-3 px-4 text-center">
                      <button
                        onClick={() => handleSmsToggle(a)}
                        disabled={smsLoading === a.user_id}
                        className={`relative inline-flex items-center w-10 h-5 rounded-full transition-colors duration-200 disabled:opacity-50 focus:outline-none ${
                          a.sms_enabled ? 'bg-emerald-500' : 'bg-slate-600'
                        }`}
                      >
                        <span className={`inline-block w-3.5 h-3.5 bg-white rounded-full shadow transition-transform duration-200 ${
                          a.sms_enabled ? 'translate-x-5' : 'translate-x-1'
                        }`} />
                      </button>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <div className="flex flex-col items-center gap-1.5">
                        {/* 현재 역할 뱃지 */}
                        <span className={`px-2 py-0.5 text-[10px] font-black rounded-md ${
                          a.role === 'admin'
                            ? 'bg-indigo-900/60 text-indigo-300'
                            : 'bg-slate-800 text-slate-400'
                        }`}>
                          {a.role === 'admin' ? '전체기능' : 'AI전용'}
                        </span>
                        {/* 변경 버튼 */}
                        <button
                          onClick={() => handleRoleChange(a, a.role === 'admin' ? 'ai_only' : 'admin')}
                          disabled={roleLoading === a.user_id}
                          className={`px-2 py-0.5 text-[9px] font-black rounded-md transition-all disabled:opacity-50 ${
                            a.role === 'admin'
                              ? 'bg-slate-700 hover:bg-slate-600 text-slate-400 hover:text-white'
                              : 'bg-indigo-700 hover:bg-indigo-600 text-indigo-200'
                          }`}
                        >
                          {roleLoading === a.user_id ? '변경 중...' : a.role === 'admin' ? '→ AI전용' : '→ 전체기능'}
                        </button>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-right text-xs font-bold text-slate-500">{dateStr}</td>
                    <td className="py-3 px-4 text-center">
                      <button
                        onClick={() => openChargeModal(a)}
                        className="px-3 py-1.5 text-xs font-black bg-yellow-500 hover:bg-yellow-400 text-slate-900 rounded-lg transition-all"
                      >
                        충전
                      </button>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr><td colSpan={13} className="py-16 text-center text-slate-600 font-bold">검색 결과 없음</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* CON 충전 모달 */}
      {chargeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => !chargeModal.loading && setChargeModal(null)} />
          <div className="relative bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-sm mx-4 overflow-hidden">
            <div className="px-6 py-5 border-b border-slate-800">
              <h3 className="text-base font-black text-white">⭐ CON 충전</h3>
              <p className="text-xs text-slate-400 mt-1 font-bold">{chargeModal.academy.academy_name || chargeModal.academy.email}</p>
              <p className="text-xs text-slate-500 mt-0.5">현재 잔액: <span className="text-yellow-400 font-black">{(chargeModal.academy.points || 0).toLocaleString()} C</span></p>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div>
                <label className="block text-xs font-black text-slate-400 mb-2">충전량 (CON)</label>
                <div className="flex gap-1.5 mb-2">
                  {[1000, 3000, 5000, 10000].map(n => (
                    <button key={n}
                      onClick={() => setChargeModal(prev => prev ? { ...prev, amount: String(n) } : null)}
                      className="flex-1 py-1.5 text-xs font-black bg-slate-700 hover:bg-yellow-500 hover:text-slate-900 text-slate-300 rounded-lg transition-all">
                      {n.toLocaleString()}
                    </button>
                  ))}
                </div>
                <input
                  type="number"
                  min="1"
                  placeholder="예: 1000"
                  value={chargeModal.amount}
                  onChange={e => setChargeModal(prev => prev ? { ...prev, amount: e.target.value } : null)}
                  className="w-full px-4 py-3 bg-slate-800 border-2 border-slate-700 rounded-xl text-white font-black focus:border-yellow-500 focus:outline-none text-sm"
                />
                <p className="text-xs text-slate-500 mt-1.5 font-bold">1,000 CON = 10,000원</p>
              </div>
              {/* 무료 / 유료 선택 */}
              <div>
                <label className="block text-xs font-black text-slate-400 mb-2">충전 유형</label>
                <div className="flex gap-2">
                  {[
                    { value: false, label: '유료충전', desc: '실제 결제 충전', color: 'border-yellow-500 bg-yellow-500/10 text-yellow-300' },
                    { value: true,  label: '무료지급', desc: '이벤트/보상 지급', color: 'border-blue-500 bg-blue-500/10 text-blue-300' },
                  ].map(opt => (
                    <button key={String(opt.value)}
                      onClick={() => setChargeModal(prev => prev ? { ...prev, is_free: opt.value } : null)}
                      className={`flex-1 py-2.5 rounded-xl border-2 text-left px-3 transition-all ${
                        chargeModal.is_free === opt.value
                          ? opt.color
                          : 'border-slate-700 bg-slate-800 text-slate-400'
                      }`}>
                      <p className="text-xs font-black">{opt.label}</p>
                      <p className="text-[10px] font-bold opacity-70 mt-0.5">{opt.desc}</p>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-black text-slate-400 mb-2">메모 (선택)</label>
                <input
                  type="text"
                  placeholder={chargeModal.is_free ? '예: 신규 가입 혜택' : '예: 1만원 결제 충전'}
                  value={chargeModal.description}
                  onChange={e => setChargeModal(prev => prev ? { ...prev, description: e.target.value } : null)}
                  className="w-full px-4 py-3 bg-slate-800 border-2 border-slate-700 rounded-xl text-white font-bold focus:border-yellow-500 focus:outline-none text-sm placeholder:text-slate-600"
                />
              </div>

              {chargeModal.result && (
                <div className={`rounded-xl px-4 py-3 text-sm font-bold ${chargeModal.result.startsWith('오류') || chargeModal.result.startsWith('서버') ? 'bg-red-900/30 text-red-400' : 'bg-green-900/30 text-green-400'}`}>
                  {chargeModal.result}
                </div>
              )}
            </div>
            <div className="px-6 pb-6 flex gap-3">
              <button
                onClick={() => setChargeModal(null)}
                disabled={chargeModal.loading}
                className="flex-1 py-3 text-sm font-black text-slate-400 bg-slate-800 rounded-xl hover:bg-slate-700 transition-all disabled:opacity-50"
              >
                닫기
              </button>
              <button
                onClick={handleCharge}
                disabled={chargeModal.loading || !chargeModal.amount}
                className="flex-1 py-3 text-sm font-black text-slate-900 bg-yellow-500 hover:bg-yellow-400 rounded-xl transition-all disabled:opacity-50"
              >
                {chargeModal.loading ? '처리 중...' : '충전하기'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
