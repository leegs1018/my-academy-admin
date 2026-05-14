'use client';

import { useState, useEffect } from 'react';

interface PricingItem {
  id: string;
  feature_key: string;
  feature_name: string;
  cost_per_use: number;
  unit_description: string;
  is_active: boolean;
  updated_at: string;
}

const SECTION_ORDER: { key: string; label: string; color: string; keys: string[] }[] = [
  {
    key: 'exam',
    label: '실전변형 문제',
    color: 'text-blue-400',
    keys: ['ai_question_per_type'],
  },
  {
    key: 'pdf',
    label: '지문분석 툴 / 워크북',
    color: 'text-teal-400',
    keys: ['pdf_analysis'],
  },
  {
    key: 'sms',
    label: 'SMS 문자 발송',
    color: 'text-violet-400',
    keys: ['sms', 'lms'],
  },
];

export default function ConPricingPage() {
  const [pricing, setPricing] = useState<PricingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [saveMsg, setSaveMsg] = useState<Record<string, string>>({});

  useEffect(() => {
    fetch('/api/superadmin/credits/pricing')
      .then(r => r.json())
      .then(d => {
        setPricing(d.pricing || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const pricingMap = Object.fromEntries(pricing.map(p => [p.feature_key, p]));

  const startEdit = (featureKey: string, current: number) => {
    setEditing(prev => ({ ...prev, [featureKey]: String(current) }));
  };

  const cancelEdit = (featureKey: string) => {
    setEditing(prev => { const n = { ...prev }; delete n[featureKey]; return n; });
    setSaveMsg(prev => { const n = { ...prev }; delete n[featureKey]; return n; });
  };

  const handleSave = async (featureKey: string) => {
    const newCost = parseInt(editing[featureKey] ?? '', 10);
    if (isNaN(newCost) || newCost < 0) return;
    setSaving(featureKey);
    try {
      const res = await fetch('/api/superadmin/credits/pricing', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ feature_key: featureKey, cost_per_use: newCost }),
      });
      const data = await res.json();
      if (data.success) {
        setPricing(prev => prev.map(p => p.feature_key === featureKey ? { ...p, cost_per_use: newCost } : p));
        cancelEdit(featureKey);
        setSaveMsg(prev => ({ ...prev, [featureKey]: '저장됨' }));
        setTimeout(() => setSaveMsg(prev => { const n = { ...prev }; delete n[featureKey]; return n; }), 2000);
      } else {
        setSaveMsg(prev => ({ ...prev, [featureKey]: `오류: ${data.error}` }));
      }
    } catch {
      setSaveMsg(prev => ({ ...prev, [featureKey]: '서버 오류' }));
    } finally {
      setSaving(null);
    }
  };

  const renderRow = (item: PricingItem) => {
    const editValue = editing[item.feature_key];
    const isSavingThis = saving === item.feature_key;
    const msg = saveMsg[item.feature_key];
    return (
      <tr key={item.id} className="border-t border-slate-800 hover:bg-slate-800/20 transition-colors">
        <td className="py-4 px-6">
          <p className="font-black text-white">{item.feature_name}</p>
          <p className="text-xs text-slate-500 font-bold mt-0.5">{item.feature_key}</p>
        </td>
        <td className="py-4 px-6 text-slate-400 font-bold text-sm">{item.unit_description}</td>
        <td className="py-4 px-6 text-center">
          {editValue !== undefined ? (
            <input
              type="number"
              min="0"
              value={editValue}
              onChange={e => setEditing(prev => ({ ...prev, [item.feature_key]: e.target.value }))}
              className="w-24 text-center px-3 py-2 bg-slate-800 border-2 border-yellow-500 rounded-lg text-white font-black focus:outline-none text-sm"
              autoFocus
            />
          ) : (
            <span className="font-black text-yellow-400 text-base">{item.cost_per_use} C</span>
          )}
          {msg && (
            <p className={`text-xs font-bold mt-1 ${msg.startsWith('오류') || msg === '서버 오류' ? 'text-red-400' : 'text-green-400'}`}>
              {msg}
            </p>
          )}
        </td>
        <td className="py-4 px-6 text-center">
          {editValue !== undefined ? (
            <div className="flex items-center justify-center gap-2">
              <button
                onClick={() => handleSave(item.feature_key)}
                disabled={isSavingThis}
                className="px-4 py-1.5 text-xs font-black bg-yellow-500 hover:bg-yellow-400 text-slate-900 rounded-lg transition-all disabled:opacity-50"
              >
                {isSavingThis ? '저장 중...' : '저장'}
              </button>
              <button
                onClick={() => cancelEdit(item.feature_key)}
                className="px-4 py-1.5 text-xs font-black bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg transition-all"
              >
                취소
              </button>
            </div>
          ) : (
            <button
              onClick={() => startEdit(item.feature_key, item.cost_per_use)}
              className="px-4 py-1.5 text-xs font-black bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg transition-all"
            >
              수정
            </button>
          )}
        </td>
        <td className="py-4 px-6 text-right text-xs text-slate-500 font-bold">
          {new Date(item.updated_at).toLocaleDateString('ko-KR')}
        </td>
      </tr>
    );
  };

  const examPrice = pricingMap['ai_question_per_type']?.cost_per_use ?? 20;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-black text-white">⭐ CON 단가 관리</h1>
        <p className="text-sm text-slate-500 mt-1 font-bold">기능별 CON 차감 단가를 설정합니다</p>
      </div>

      <div className="bg-slate-800/50 border border-slate-700 rounded-xl px-4 py-3">
        <p className="text-xs font-bold text-slate-400">
          💡 단가 변경은 즉시 적용됩니다. 기존 사용 이력은 변경되지 않습니다.
        </p>
      </div>

      {loading ? (
        <div className="text-center py-16 text-slate-400 font-bold">불러오는 중...</div>
      ) : (
        <div className="space-y-4">
          {SECTION_ORDER.map(section => {
            const items = section.keys.map(k => pricingMap[k]).filter(Boolean);
            if (items.length === 0) return null;
            return (
              <div key={section.key} className="bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden">
                <div className="px-6 py-3 bg-slate-800/60 flex items-center justify-between">
                  <h2 className={`text-sm font-black ${section.color}`}>{section.label}</h2>
                  {section.key === 'exam' && (
                    <span className="text-xs font-bold text-slate-400">
                      8유형 모두 선택 시 최대 <span className="text-yellow-400 font-black">{examPrice * 8} C</span>
                    </span>
                  )}
                  {section.key === 'sms' && (
                    <span className="text-xs font-bold text-slate-400">
                      90바이트 이하 SMS · 초과 시 LMS 자동 적용
                    </span>
                  )}
                </div>
                <table className="w-full text-sm">
                  <thead className="bg-slate-800/30">
                    <tr>
                      <th className="py-2.5 px-6 text-left text-xs font-black text-slate-500">기능</th>
                      <th className="py-2.5 px-6 text-left text-xs font-black text-slate-500">단위</th>
                      <th className="py-2.5 px-6 text-center text-xs font-black text-slate-500">현재 단가 (CON)</th>
                      <th className="py-2.5 px-6 text-center text-xs font-black text-slate-500">수정</th>
                      <th className="py-2.5 px-6 text-right text-xs font-black text-slate-500">마지막 수정</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map(item => renderRow(item))}
                  </tbody>
                </table>
              </div>
            );
          })}

          {/* 미분류 항목 */}
          {(() => {
            const knownKeys = SECTION_ORDER.flatMap(s => s.keys);
            const others = pricing.filter(p => !knownKeys.includes(p.feature_key) && p.is_active);
            if (others.length === 0) return null;
            return (
              <div className="bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden">
                <div className="px-6 py-3 bg-slate-800/60">
                  <h2 className="text-sm font-black text-slate-400">기타</h2>
                </div>
                <table className="w-full text-sm">
                  <thead className="bg-slate-800/30">
                    <tr>
                      <th className="py-2.5 px-6 text-left text-xs font-black text-slate-500">기능</th>
                      <th className="py-2.5 px-6 text-left text-xs font-black text-slate-500">단위</th>
                      <th className="py-2.5 px-6 text-center text-xs font-black text-slate-500">현재 단가 (CON)</th>
                      <th className="py-2.5 px-6 text-center text-xs font-black text-slate-500">수정</th>
                      <th className="py-2.5 px-6 text-right text-xs font-black text-slate-500">마지막 수정</th>
                    </tr>
                  </thead>
                  <tbody>{others.map(item => renderRow(item))}</tbody>
                </table>
              </div>
            );
          })()}
        </div>
      )}

      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-3">
        <h3 className="text-sm font-black text-white">📦 CON 패키지 안내</h3>
        <div className="grid grid-cols-3 gap-3">
          {[
            { amount: 100, price: '10,000원' },
            { amount: 300, price: '30,000원' },
            { amount: 500, price: '50,000원' },
          ].map(pkg => (
            <div key={pkg.amount} className="bg-slate-800 rounded-xl px-4 py-3 text-center">
              <p className="text-xl font-black text-yellow-400">{pkg.amount} C</p>
              <p className="text-xs font-bold text-slate-400 mt-1">{pkg.price}</p>
            </div>
          ))}
        </div>
        <p className="text-xs text-slate-500 font-bold">위 패키지 정보는 참고용입니다. 실제 충전은 학원 관리 페이지에서 직접 진행해주세요.</p>
      </div>
    </div>
  );
}
