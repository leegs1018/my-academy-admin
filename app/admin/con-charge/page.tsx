'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';

const PACKAGES = [
  { amount: 1000,  price: '10,000원',  bonus: 0 },
  { amount: 3000,  price: '30,000원',  bonus: 5 },
  { amount: 5000,  price: '50,000원',  bonus: 7 },
  { amount: 10000, price: '100,000원', bonus: 10 },
];

const getBonus = (amount: number) => {
  if (amount >= 10000) return 10;
  if (amount >= 5000)  return 7;
  if (amount >= 3000)  return 5;
  return 0;
};

const getBonusCon = (amount: number) => Math.floor(amount * getBonus(amount) / 100);

function ConChargeContent() {
  const searchParams = useSearchParams();
  const [bankName, setBankName] = useState('');
  const [bankAccount, setBankAccount] = useState('');
  const [bankHolder, setBankHolder] = useState('');
  const [copied, setCopied] = useState(false);
  const [selected, setSelected] = useState<number | null>(null);
  const [customInput, setCustomInput] = useState('');
  const [isCustom, setIsCustom] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  const [payTab, setPayTab] = useState<'card' | 'bank'>('card');
  const [cardLoading, setCardLoading] = useState(false);
  const [cardError, setCardError] = useState('');
  const [cardSuccess, setCardSuccess] = useState(false);

  const selectedAmount = isCustom ? (parseInt(customInput) || 0) : (selected ?? 0);
  const bonusCon = getBonusCon(selectedAmount);
  const totalCon = selectedAmount + bonusCon;
  const bonusPct = getBonus(selectedAmount);

  useEffect(() => {
    if (searchParams.get('payment') === 'complete' && typeof window !== 'undefined') {
      if (window.opener) {
        window.opener.postMessage('payapp_payment_complete', '*');
        window.close();
      } else {
        setCardSuccess(true);
      }
    }
  }, [searchParams]);

  useEffect(() => {
    const handler = (e: MessageEvent) => {
      if (e.data === 'payapp_payment_complete') {
        setCardSuccess(true);
        setCardLoading(false);
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUserId(session?.user?.id ?? null);
    });
  }, []);

  useEffect(() => {
    fetch('/api/site-settings')
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (!d?.settings) return;
        setBankName(d.settings.bank_name ?? '');
        setBankAccount(d.settings.bank_account ?? '');
        setBankHolder(d.settings.bank_holder ?? '');
      })
      .catch(() => {});
  }, []);

  const copyAccount = () => {
    if (!bankAccount) return;
    navigator.clipboard.writeText(bankAccount).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleCardPayment = useCallback(async () => {
    if (!userId) { setCardError('로그인이 필요합니다.'); return; }
    if (selectedAmount < 100) { setCardError('충전할 CON을 먼저 선택해주세요.'); return; }

    setCardLoading(true);
    setCardError('');
    setCardSuccess(false);

    try {
      const res = await fetch('/api/payapp/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, conAmount: selectedAmount }),
      });
      const data = await res.json();

      if (!data.ok || !data.payurl) {
        setCardError(data.error || '결제 요청 실패. 잠시 후 다시 시도해주세요.');
        setCardLoading(false);
        return;
      }

      const popup = window.open(
        data.payurl,
        'payapp_payment',
        'width=500,height=700,top=100,left=100,scrollbars=yes'
      );

      if (!popup) {
        setCardError('팝업이 차단되었습니다. 팝업 허용 후 다시 시도해주세요.');
        setCardLoading(false);
        return;
      }

      const timer = setInterval(() => {
        if (popup.closed) {
          clearInterval(timer);
          setCardLoading(false);
        }
      }, 500);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : '오류 발생';
      setCardError(msg);
      setCardLoading(false);
    }
  }, [userId, selectedAmount]);

  const packageSummary = (selected || (isCustom && parseInt(customInput) > 0)) && selectedAmount > 0;

  return (
    <div className="max-w-xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-black text-gray-900 dark:text-white">CON 충전</h1>
        <p className="text-sm text-gray-500 dark:text-slate-400 mt-1 font-bold">CON을 충전하여 서비스를 이용하세요.</p>
      </div>

      {/* 패키지 선택 */}
      <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl p-6">
        <h2 className="text-sm font-black text-gray-700 dark:text-slate-300 mb-4">충전 패키지 선택</h2>
        <div className="grid grid-cols-2 gap-3">
          {PACKAGES.map(pkg => {
            const isSelected = !isCustom && selected === pkg.amount;
            const bonus = getBonusCon(pkg.amount);
            return (
              <button
                key={pkg.amount}
                onClick={() => { setSelected(pkg.amount); setIsCustom(false); }}
                className={`p-4 rounded-2xl border-2 text-left transition-all relative ${
                  isSelected
                    ? 'border-yellow-400 bg-yellow-50 dark:bg-yellow-900/20'
                    : 'border-gray-200 dark:border-slate-700 hover:border-yellow-300 dark:hover:border-yellow-700'
                }`}
              >
                {pkg.bonus > 0 && (
                  <span className="absolute top-2.5 right-2.5 text-[10px] font-black bg-yellow-400 text-yellow-900 px-1.5 py-0.5 rounded-full">
                    +{pkg.bonus}%
                  </span>
                )}
                <p className={`text-2xl font-black ${isSelected ? 'text-yellow-500' : 'text-gray-900 dark:text-white'}`}>
                  {pkg.amount.toLocaleString()}<span className="text-sm ml-0.5">C</span>
                </p>
                {bonus > 0 && (
                  <p className="text-[11px] font-black text-yellow-500 mt-0.5">+{bonus.toLocaleString()}C 추가 적립</p>
                )}
                <p className="text-xs font-bold text-gray-400 dark:text-slate-500 mt-1">{pkg.price}</p>
              </button>
            );
          })}

          {/* 직접 입력 */}
          <button
            onClick={() => { setIsCustom(true); setSelected(null); }}
            className={`p-4 rounded-2xl border-2 text-left transition-all col-span-2 ${
              isCustom
                ? 'border-yellow-400 bg-yellow-50 dark:bg-yellow-900/20'
                : 'border-gray-200 dark:border-slate-700 hover:border-yellow-300 dark:hover:border-yellow-700'
            }`}
          >
            <p className={`text-sm font-black mb-2 ${isCustom ? 'text-yellow-600' : 'text-gray-600 dark:text-slate-400'}`}>직접 입력</p>
            <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
              <input
                type="number"
                min="100"
                placeholder="충전할 CON 입력 (최소 100C)"
                value={customInput}
                onFocus={() => { setIsCustom(true); setSelected(null); }}
                onChange={e => { setCustomInput(e.target.value); setIsCustom(true); setSelected(null); }}
                className="flex-1 border border-gray-200 dark:border-slate-700 px-3 py-2 rounded-xl font-bold text-gray-800 dark:text-white bg-white dark:bg-slate-800 focus:outline-none focus:border-yellow-400 text-sm"
              />
              <span className="font-black text-gray-600 dark:text-slate-400 text-sm">C</span>
            </div>
            {isCustom && parseInt(customInput) >= 10000 && (
              <p className="text-[11px] font-black text-yellow-500 mt-1.5">+{getBonusCon(parseInt(customInput)).toLocaleString()}C 추가 적립 (10%)</p>
            )}
            {isCustom && parseInt(customInput) >= 5000 && parseInt(customInput) < 10000 && (
              <p className="text-[11px] font-black text-yellow-500 mt-1.5">+{getBonusCon(parseInt(customInput)).toLocaleString()}C 추가 적립 (7%)</p>
            )}
            {isCustom && parseInt(customInput) >= 3000 && parseInt(customInput) < 5000 && (
              <p className="text-[11px] font-black text-yellow-500 mt-1.5">+{getBonusCon(parseInt(customInput)).toLocaleString()}C 추가 적립 (5%)</p>
            )}
          </button>
        </div>
        <div className="mt-4 space-y-1">
          <p className="text-xs text-gray-400 dark:text-slate-500 font-bold">1,000 CON = 10,000원 · 부가세 포함</p>
          <p className="text-xs text-gray-400 dark:text-slate-500 font-bold">최소 충전 금액은 100 CON 이상입니다.</p>
          <p className="text-xs text-gray-400 dark:text-slate-500 font-bold">직접 입력 시 10,000C 이상이면 +10% 추가 적립됩니다.</p>
        </div>
      </div>

      {/* 결제 방법 탭 */}
      <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl overflow-hidden">
        {/* 탭 버튼 */}
        <div className="flex border-b border-gray-200 dark:border-slate-700">
          <button
            onClick={() => setPayTab('card')}
            className={`flex-1 py-3 text-sm font-black transition-colors ${
              payTab === 'card'
                ? 'text-yellow-600 dark:text-yellow-400 border-b-2 border-yellow-400 bg-yellow-50 dark:bg-yellow-900/10'
                : 'text-gray-400 dark:text-slate-500 hover:text-gray-600 dark:hover:text-slate-300'
            }`}
          >
            💳 카드결제
          </button>
          <button
            onClick={() => setPayTab('bank')}
            className={`flex-1 py-3 text-sm font-black transition-colors ${
              payTab === 'bank'
                ? 'text-yellow-600 dark:text-yellow-400 border-b-2 border-yellow-400 bg-yellow-50 dark:bg-yellow-900/10'
                : 'text-gray-400 dark:text-slate-500 hover:text-gray-600 dark:hover:text-slate-300'
            }`}
          >
            무통장 입금
          </button>
        </div>

        <div className="p-6 space-y-4">
          {/* 카드결제 탭 */}
          {payTab === 'card' && (
            <div className="space-y-4">
              {cardSuccess ? (
                <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-2xl p-6 text-center space-y-2">
                  <p className="text-2xl">✅</p>
                  <p className="text-sm font-black text-green-700 dark:text-green-400">결제가 완료되었습니다!</p>
                  <p className="text-xs font-bold text-green-600 dark:text-green-500">잠시 후 CON 잔액이 업데이트됩니다.</p>
                  <button
                    onClick={() => window.location.reload()}
                    className="mt-2 text-xs font-black text-green-600 dark:text-green-400 underline"
                  >
                    새로고침
                  </button>
                </div>
              ) : (
                <>
                  {packageSummary && (
                    <div className="bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-2xl p-4 space-y-2">
                      <p className="text-xs font-black text-gray-500 dark:text-slate-400 mb-2">결제 내역</p>
                      <div className="flex justify-between items-center">
                        <span className="text-xs font-bold text-gray-500 dark:text-slate-400">결제 금액</span>
                        <span className="text-sm font-black text-gray-900 dark:text-white">{(selectedAmount * 10).toLocaleString()}원</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-xs font-bold text-gray-500 dark:text-slate-400">충전 CON</span>
                        <span className="text-sm font-black text-gray-900 dark:text-white">{selectedAmount.toLocaleString()} C</span>
                      </div>
                      {bonusCon > 0 && (
                        <div className="flex justify-between items-center">
                          <span className="text-xs font-bold text-yellow-500">추가 적립 (+{bonusPct}%)</span>
                          <span className="text-sm font-black text-yellow-500">+{bonusCon.toLocaleString()} C</span>
                        </div>
                      )}
                      <div className="flex justify-between items-center border-t border-gray-200 dark:border-slate-700 pt-2 mt-1">
                        <span className="text-xs font-black text-gray-700 dark:text-slate-300">최종 지급 CON</span>
                        <span className="text-base font-black text-gray-900 dark:text-white">{totalCon.toLocaleString()} C</span>
                      </div>
                    </div>
                  )}

                  {!packageSummary && (
                    <div className="bg-gray-50 dark:bg-slate-800 rounded-2xl p-5 text-center">
                      <p className="text-sm font-bold text-gray-400 dark:text-slate-500">위에서 충전 패키지를 먼저 선택해주세요.</p>
                    </div>
                  )}

                  {cardError && (
                    <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-3">
                      <p className="text-xs font-bold text-red-600 dark:text-red-400">{cardError}</p>
                    </div>
                  )}

                  <button
                    onClick={handleCardPayment}
                    disabled={!packageSummary || cardLoading}
                    className={`w-full py-4 rounded-2xl font-black text-sm transition-all ${
                      packageSummary && !cardLoading
                        ? 'bg-yellow-400 hover:bg-yellow-500 text-yellow-900 shadow-md hover:shadow-lg'
                        : 'bg-gray-200 dark:bg-slate-700 text-gray-400 dark:text-slate-500 cursor-not-allowed'
                    }`}
                  >
                    {cardLoading
                      ? '결제창 열리는 중...'
                      : packageSummary
                        ? `💳 ${(selectedAmount * 10).toLocaleString()}원 카드결제`
                        : '패키지를 먼저 선택해주세요'
                    }
                  </button>

                  <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-2xl p-4 space-y-1">
                    <p className="text-xs font-black text-blue-700 dark:text-blue-400">카드결제 안내</p>
                    <ul className="text-xs font-bold text-blue-600 dark:text-blue-500 space-y-1">
                      <li>• 결제 후 즉시 CON이 자동으로 지급됩니다.</li>
                      <li>• 결제창이 팝업으로 열립니다. 팝업 허용 후 이용해주세요.</li>
                      <li>• 카드, 가상계좌, 계좌이체 등 다양한 결제 수단 지원.</li>
                    </ul>
                  </div>
                </>
              )}
            </div>
          )}

          {/* 무통장 입금 탭 */}
          {payTab === 'bank' && (
            <>
              <h2 className="text-sm font-black text-gray-700 dark:text-slate-300">입금 계좌</h2>

              {bankName || bankAccount ? (
                <div className="bg-gray-50 dark:bg-slate-800 rounded-2xl p-5 space-y-3">
                  {bankName && (
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-black text-gray-400 dark:text-slate-500">은행</span>
                      <span className="text-sm font-black text-gray-900 dark:text-white">{bankName}</span>
                    </div>
                  )}
                  {bankAccount && (
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-black text-gray-400 dark:text-slate-500">계좌번호</span>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-black text-gray-900 dark:text-white tracking-widest">{bankAccount}</span>
                        <button
                          onClick={copyAccount}
                          className="px-2.5 py-1 text-[10px] font-black bg-gray-200 dark:bg-slate-700 hover:bg-yellow-100 dark:hover:bg-yellow-900/30 text-gray-600 dark:text-slate-300 rounded-lg transition-all"
                        >
                          {copied ? '복사됨 ✓' : '복사'}
                        </button>
                      </div>
                    </div>
                  )}
                  {bankHolder && (
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-black text-gray-400 dark:text-slate-500">예금주</span>
                      <span className="text-sm font-black text-gray-900 dark:text-white">{bankHolder}</span>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-sm font-bold text-gray-400 dark:text-slate-500 text-center py-4">계좌 정보를 불러오는 중...</p>
              )}

              <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-2xl p-4 space-y-2">
                <p className="text-xs font-black text-yellow-700 dark:text-yellow-400">입금 시 꼭 확인해주세요</p>
                <ul className="text-xs font-bold text-yellow-600 dark:text-yellow-500 space-y-1">
                  <li>• 입금자명을 <span className="font-black">학원명</span>으로 입력해주세요.</li>
                  <li>• 입금 확인 후 <span className="font-black">1시간 이내</span> CON이 지급됩니다.</li>
                  <li>• 3,000C 이상 <span className="font-black">+5%</span> · 5,000C 이상 <span className="font-black">+7%</span> · 10,000C 이상 <span className="font-black">+10%</span> 추가 적립</li>
                  <li>• 충전 관련 문의는 <a href="/admin/inquiries" className="underline font-black">문의하기</a>를 이용해주세요.</li>
                </ul>
              </div>

              {packageSummary && (
                <div className="bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-2xl p-4 space-y-2">
                  <p className="text-xs font-black text-gray-500 dark:text-slate-400 mb-2">선택한 패키지</p>
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-bold text-gray-500 dark:text-slate-400">충전 CON</span>
                    <span className="text-sm font-black text-gray-900 dark:text-white">{selectedAmount.toLocaleString()} C</span>
                  </div>
                  {bonusCon > 0 && (
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-bold text-yellow-500">추가 적립 (+{bonusPct}%)</span>
                      <span className="text-sm font-black text-yellow-500">+{bonusCon.toLocaleString()} C</span>
                    </div>
                  )}
                  <div className="flex justify-between items-center border-t border-gray-200 dark:border-slate-700 pt-2 mt-1">
                    <span className="text-xs font-black text-gray-700 dark:text-slate-300">최종 지급 CON</span>
                    <span className="text-base font-black text-gray-900 dark:text-white">{totalCon.toLocaleString()} C</span>
                  </div>
                  {!isCustom && (
                    <p className="text-xs font-bold text-gray-400 dark:text-slate-500">
                      입금 금액: {PACKAGES.find(p => p.amount === selected)?.price}
                    </p>
                  )}
                  <p className="text-xs font-bold text-gray-400 dark:text-slate-500 mt-1">위 계좌로 해당 금액을 입금해주세요.</p>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ConChargePage() {
  return (
    <Suspense fallback={<div className="max-w-xl mx-auto p-6 text-center text-sm text-gray-400">로딩 중...</div>}>
      <ConChargeContent />
    </Suspense>
  );
}
