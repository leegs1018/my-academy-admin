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

  const startEdit = (item: PricingItem) => {
    setEditing(prev => ({ ...prev, [item.feature_key]: String(item.cost_per_use) }));
  };

  const cancelEdit = (featureKey: string) => {
    setEditing(prev => {
      const next = { ...prev };
      delete next[featureKey];
      return next;
    });
    setSaveMsg(prev => {
      const next = { ...prev };
      delete next[featureKey];
      return next;
    });
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
        setPricing(prev =>
          prev.map(p =>
            p.feature_key === featureKey ? { ...p, cost_per_use: newCost } : p
          )
        );
        cancelEdit(featureKey);
        setSaveMsg(prev => ({ ...prev, [featureKey]: '저장되었습니다.' }));
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
        <div className="bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-800/50">
              <tr>
                <th className="py-3 px-6 text-left text-xs font-black text-slate-500">기능</th>
                <th className="py-3 px-6 text-left text-xs font-black text-slate-500">단위</th>
                <th className="py-3 px-6 text-center text-xs font-black text-slate-500">현재 단가 (CON)</th>
                <th className="py-3 px-6 text-center text-xs font-black text-slate-500">수정</th>
                <th className="py-3 px-6 text-right text-xs font-black text-slate-500">마지막 수정</th>
              </tr>
            </thead>
            <tbody>
              {pricing.map(item => {
                const editValue = editing[item.feature_key];
                const isSavingThis = saving === item.feature_key;
                const msg = saveMsg[item.feature_key];

                return (
                  <tr key={item.id} className="border-t border-slate-800 hover:bg-slate-800/20 transition-colors">
                    <td className="py-4 px-6">
                      <p className="font-black text-white">{item.feature_name}</p>
                      <p className="text-xs text-slate-500 font-bold mt-0.5">{item.feature_key}</p>
                    </td>
                    <td className="py-4 px-6 text-slate-400 font-bold">{item.unit_description}</td>
                    <td className="py-4 px-6 text-center">
                      {editValue !== undefined ? (
                        <input
                          type="number"
                          min="0"
                          value={editValue}
                          onChange={e => setEditing(prev => ({ ...prev, [item.feature_key]: e.target.value }))}
                          className="w-28 text-center px-3 py-2 bg-slate-800 border-2 border-yellow-500 rounded-lg text-white font-black focus:outline-none text-sm"
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
                          onClick={() => startEdit(item)}
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
              })}
            </tbody>
          </table>
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
