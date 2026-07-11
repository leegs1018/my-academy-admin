'use client';

import { useState, useEffect } from 'react';

const PACKAGES = [
  { amount: 1000,  price: '10,000원',  bonus: 0 },
  { amount: 3000,  price: '30,000원',  bonus: 2 },
  { amount: 5000,  price: '50,000원',  bonus: 3 },
  { amount: 10000, price: '100,000원', bonus: 5 },
];

const getBonus = (amount: number) => {
  if (amount >= 10000) return 5;
  if (amount >= 5000)  return 3;
  if (amount >= 3000)  return 2;
  return 0;
};

const getBonusCon = (amount: number) => Math.floor(amount * getBonus(amount) / 100);

export default function ConChargePage() {
  const [bankName, setBankName] = useState('');
  const [bankAccount, setBankAccount] = useState('');
  const [bankHolder, setBankHolder] = useState('');
  const [copied, setCopied] = useState(false);
  const [selected, setSelected] = useState<number | null>(null);
  const [customInput, setCustomInput] = useState('');
  const [isCustom, setIsCustom] = useState(false);

  const selectedAmount = isCustom ? (parseInt(customInput) || 0) : (selected ?? 0);
  const bonusCon = getBonusCon(selectedAmount);
  const totalCon = selectedAmount + bonusCon;
  const bonusPct = getBonus(selectedAmount);

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

  return (
    <div className="max-w-xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-black text-gray-900 dark:text-white">CON 충전</h1>
        <p className="text-sm text-gray-500 dark:text-slate-400 mt-1 font-bold">무통장 입금으로 CON을 충전할 수 있습니다.</p>
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
                min="1"
                placeholder="충전할 CON 입력"
                value={customInput}
                onFocus={() => { setIsCustom(true); setSelected(null); }}
                onChange={e => { setCustomInput(e.target.value); setIsCustom(true); setSelected(null); }}
                className="flex-1 border border-gray-200 dark:border-slate-700 px-3 py-2 rounded-xl font-bold text-gray-800 dark:text-white bg-white dark:bg-slate-800 focus:outline-none focus:border-yellow-400 text-sm"
              />
              <span className="font-black text-gray-600 dark:text-slate-400 text-sm">C</span>
            </div>
            {isCustom && parseInt(customInput) >= 10000 && (
              <p className="text-[11px] font-black text-yellow-500 mt-1.5">+{getBonusCon(parseInt(customInput)).toLocaleString()}C 추가 적립 (5%)</p>
            )}
          </button>
        </div>
        <p className="text-xs text-gray-400 dark:text-slate-500 font-bold mt-4">1,000 CON = 10,000원 · 부가세 포함</p>
      </div>

      {/* 입금 계좌 안내 */}
      <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl p-6 space-y-4">
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

        {/* 입금 안내 */}
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-2xl p-4 space-y-2">
          <p className="text-xs font-black text-yellow-700 dark:text-yellow-400">입금 시 꼭 확인해주세요</p>
          <ul className="text-xs font-bold text-yellow-600 dark:text-yellow-500 space-y-1">
            <li>• 입금자명을 <span className="font-black">학원명</span>으로 입력해주세요.</li>
            <li>• 입금 확인 후 <span className="font-black">1시간 이내</span> CON이 지급됩니다.</li>
            <li>• 3,000C 이상 <span className="font-black">+2%</span> · 5,000C 이상 <span className="font-black">+3%</span> · 10,000C 이상 <span className="font-black">+5%</span> 추가 적립</li>
            <li>• 직접 입력 시 10,000C 이상이면 <span className="font-black">+5%</span> 추가 적립됩니다.</li>
            <li>• 충전 관련 문의는 <a href="/admin/inquiries" className="underline font-black">문의하기</a>를 이용해주세요.</li>
          </ul>
        </div>

        {(selected || (isCustom && parseInt(customInput) > 0)) && selectedAmount > 0 && (
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
      </div>

      {/* 카드결제 예정 안내 */}
      <div className="bg-gray-50 dark:bg-slate-800/50 border border-gray-200 dark:border-slate-700 rounded-2xl p-4">
        <p className="text-xs font-bold text-gray-400 dark:text-slate-500">
          💳 카드결제는 준비 중입니다. 현재는 무통장 입금만 지원합니다.
        </p>
      </div>
    </div>
  );
}
