'use client';

import { useState, useEffect, useCallback } from 'react';

interface PricingItem {
  id: string;
  feature_key: string;
  feature_name: string;
  cost_per_use: number;
  unit_description: string;
  is_active: boolean;
  updated_at: string;
}

interface SubSection {
  label: string;
  keys: string[];
}

interface SectionConfig {
  key: string;
  label: string;
  color: string;
  subsections?: SubSection[];
  keys?: string[];
  noToggle?: boolean;
  note?: string;
}

const WB_DIRECT_KEYS = [
  'wb_direct_vocab_choice', 'wb_direct_vocab_fill',
  'wb_direct_grammar_choice', 'wb_direct_grammar_correct', 'wb_direct_grammar_correct_adv',
  'wb_direct_translation', 'wb_direct_word_order', 'wb_direct_english_writing',
  'wb_direct_passage_translation', 'wb_direct_paragraph_order', 'wb_direct_sentence_insertion',
  'wb_direct_suneung_vocab_right', 'wb_direct_suneung_vocab_wrong',
  'wb_direct_suneung_grammar_right', 'wb_direct_suneung_grammar_wrong',
  'wb_direct_combo_vocab_grammar', 'wb_direct_combo_vocab_fill',
  'wb_direct_combo_grammar_order', 'wb_direct_combo_grammar_insert',
];
const WB_MOCK_KEYS = WB_DIRECT_KEYS.map(k => k.replace('wb_direct_', 'wb_mock_'));

const AI_DIRECT_KEYS = [
  'ai_type_topic_title', 'ai_type_grammar', 'ai_type_vocab_paraphrase',
  'ai_type_vocab_blank', 'ai_type_fill_blank', 'ai_type_summary',
  'ai_type_flow', 'ai_type_phrase_meaning', 'ai_type_sentence_order',
];
const AI_MOCK_KEYS = AI_DIRECT_KEYS.map(k => k.replace('ai_type_', 'mock_ai_type_'));

const SECTIONS: SectionConfig[] = [
  {
    key: 'signup', label: '가입 CON', color: 'text-yellow-400',
    keys: ['signup_bonus', 'signup_bonus_referral', 'referral_reward'],
    noToggle: true,
    note: '추천인 코드 없이 가입 시 기본 CON · 신규회원은 두 항목 합산 · 추천인은 referral_reward 적립',
  },
  {
    key: 'sms', label: 'SMS 문자 발송', color: 'text-violet-400',
    keys: ['sms', 'lms'],
    noToggle: true,
    note: '90바이트 이하 SMS · 초과 시 LMS 자동 적용',
  },
  {
    key: 'pdf', label: '지문분석', color: 'text-teal-400',
    subsections: [
      { label: '직접 입력', keys: ['pdf_analysis_direct'] },
      { label: '모의고사',  keys: ['pdf_analysis_mock'] },
    ],
  },
  {
    key: 'workbook', label: '워크북', color: 'text-rose-400',
    subsections: [
      { label: '직접 입력', keys: WB_DIRECT_KEYS },
      { label: '모의고사',  keys: WB_MOCK_KEYS },
    ],
  },
  {
    key: 'exam_direct', label: '실전 변형 문제 (직접 입력)', color: 'text-blue-400',
    keys: AI_DIRECT_KEYS,
  },
  {
    key: 'exam_mock', label: '실전 변형 문제 (모의고사)', color: 'text-indigo-400',
    keys: AI_MOCK_KEYS,
  },
];

export default function ConPricingPage() {
  const [pricing, setPricing] = useState<PricingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [toggling, setToggling] = useState<string | null>(null);
  const [saveMsg, setSaveMsg] = useState<Record<string, string>>({});

  useEffect(() => {
    fetch('/api/superadmin/credits/pricing')
      .then(r => r.json())
      .then(d => { setPricing(d.pricing || []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const pricingMap = Object.fromEntries(pricing.map(p => [p.feature_key, p]));

  const startEdit = (key: string, cur: number) =>
    setEditing(prev => ({ ...prev, [key]: String(cur) }));

  const cancelEdit = (key: string) => {
    setEditing(prev => { const n = { ...prev }; delete n[key]; return n; });
    setSaveMsg(prev => { const n = { ...prev }; delete n[key]; return n; });
  };

  const handleSave = async (key: string) => {
    const v = parseInt(editing[key] ?? '', 10);
    if (isNaN(v) || v < 0) return;
    setSaving(key);
    try {
      const res = await fetch('/api/superadmin/credits/pricing', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ feature_key: key, cost_per_use: v }),
      });
      const d = await res.json();
      if (d.success) {
        setPricing(prev => prev.map(p => p.feature_key === key ? { ...p, cost_per_use: v } : p));
        cancelEdit(key);
        setSaveMsg(prev => ({ ...prev, [key]: '저장됨' }));
        setTimeout(() => setSaveMsg(prev => { const n = { ...prev }; delete n[key]; return n; }), 2000);
      } else {
        setSaveMsg(prev => ({ ...prev, [key]: `오류: ${d.error}` }));
      }
    } catch {
      setSaveMsg(prev => ({ ...prev, [key]: '서버 오류' }));
    } finally { setSaving(null); }
  };

  const handleToggle = useCallback(async (key: string, cur: boolean) => {
    setToggling(key);
    try {
      const res = await fetch('/api/superadmin/credits/pricing', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ feature_key: key, is_active: !cur }),
      });
      const d = await res.json();
      if (d.success) setPricing(prev => prev.map(p => p.feature_key === key ? { ...p, is_active: !cur } : p));
    } finally { setToggling(null); }
  }, []);

  const renderRow = (item: PricingItem, showToggle: boolean) => {
    const ev = editing[item.feature_key];
    const isSaving = saving === item.feature_key;
    const isToggling = toggling === item.feature_key;
    const msg = saveMsg[item.feature_key];
    return (
      <tr key={item.id} className={`border-t border-slate-800 transition-colors ${item.is_active ? 'hover:bg-slate-800/20' : 'opacity-40 hover:bg-slate-800/10'}`}>
        <td className="py-3 px-5">
          <p className="font-black text-white text-sm">{item.feature_name}</p>
          <p className="text-[10px] text-slate-600 font-bold mt-0.5">{item.feature_key}</p>
        </td>
        <td className="py-3 px-5 text-slate-400 font-bold text-xs">{item.unit_description}</td>
        <td className="py-3 px-5 text-center">
          {ev !== undefined ? (
            <input type="number" min="0" value={ev}
              onChange={e => setEditing(prev => ({ ...prev, [item.feature_key]: e.target.value }))}
              className="w-20 text-center px-2 py-1.5 bg-slate-800 border-2 border-yellow-500 rounded-lg text-white font-black focus:outline-none text-sm"
              autoFocus />
          ) : (
            <span className="font-black text-yellow-400">{item.cost_per_use} C</span>
          )}
          {msg && <p className={`text-[10px] font-bold mt-0.5 ${msg.startsWith('오류') || msg === '서버 오류' ? 'text-red-400' : 'text-green-400'}`}>{msg}</p>}
        </td>
        {showToggle && (
          <td className="py-3 px-5 text-center">
            <button onClick={() => handleToggle(item.feature_key, item.is_active)} disabled={isToggling}
              className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none disabled:opacity-50 ${item.is_active ? 'bg-emerald-500' : 'bg-slate-600'}`}>
              <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${item.is_active ? 'translate-x-4' : 'translate-x-0.5'}`} />
            </button>
          </td>
        )}
        <td className="py-3 px-5 text-center">
          {ev !== undefined ? (
            <div className="flex items-center justify-center gap-1.5">
              <button onClick={() => handleSave(item.feature_key)} disabled={isSaving}
                className="px-3 py-1 text-xs font-black bg-yellow-500 hover:bg-yellow-400 text-slate-900 rounded-lg transition-all disabled:opacity-50">
                {isSaving ? '…' : '저장'}
              </button>
              <button onClick={() => cancelEdit(item.feature_key)}
                className="px-3 py-1 text-xs font-black bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg transition-all">
                취소
              </button>
            </div>
          ) : (
            <button onClick={() => startEdit(item.feature_key, item.cost_per_use)}
              className="px-3 py-1 text-xs font-black bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg transition-all">
              수정
            </button>
          )}
        </td>
        <td className="py-3 px-5 text-right text-[10px] text-slate-500 font-bold">
          {new Date(item.updated_at).toLocaleDateString('ko-KR')}
        </td>
      </tr>
    );
  };

  const renderTable = (keys: string[], showToggle: boolean) => {
    const items = keys.map(k => pricingMap[k]).filter(Boolean);
    if (items.length === 0) return <tr><td colSpan={showToggle ? 6 : 5} className="py-4 px-5 text-xs text-slate-500 font-bold text-center">DB에 항목 없음 — SQL 마이그레이션을 실행해주세요</td></tr>;
    return <>{items.map(item => renderRow(item, showToggle))}</>;
  };

  const renderSectionCard = (section: SectionConfig) => {
    const showToggle = !section.noToggle;
    const colCount = showToggle ? 6 : 5;
    const hasItems = section.subsections
      ? section.subsections.some(sub => sub.keys.some(k => pricingMap[k]))
      : (section.keys ?? []).some(k => pricingMap[k]);

    return (
      <div key={section.key} className="bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden">
        <div className="px-6 py-3 bg-slate-800/60 flex items-center justify-between">
          <h2 className={`text-sm font-black ${section.color}`}>{section.label}</h2>
          {section.note && <span className="text-xs font-bold text-slate-400">{section.note}</span>}
        </div>
        <table className="w-full text-sm">
          <thead className="bg-slate-800/30">
            <tr>
              <th className="py-2 px-5 text-left text-xs font-black text-slate-500">기능</th>
              <th className="py-2 px-5 text-left text-xs font-black text-slate-500">단위</th>
              <th className="py-2 px-5 text-center text-xs font-black text-slate-500">단가 (C)</th>
              {showToggle && <th className="py-2 px-5 text-center text-xs font-black text-slate-500">활성</th>}
              <th className="py-2 px-5 text-center text-xs font-black text-slate-500">수정</th>
              <th className="py-2 px-5 text-right text-xs font-black text-slate-500">수정일</th>
            </tr>
          </thead>
          <tbody>
            {section.subsections ? (
              section.subsections.map((sub, si) => (
                <>
                  <tr key={`sub-${si}`} className="bg-slate-800/40 border-t border-slate-700">
                    <td colSpan={colCount} className="px-5 py-2">
                      <span className="text-[10px] font-black text-slate-300 uppercase tracking-wider">└ {sub.label}</span>
                    </td>
                  </tr>
                  {renderTable(sub.keys, showToggle)}
                </>
              ))
            ) : (
              renderTable(section.keys ?? [], showToggle)
            )}
            {!hasItems && (
              <tr><td colSpan={colCount} className="py-4 px-5 text-xs text-slate-500 font-bold text-center">
                DB에 항목 없음 — SQL 마이그레이션을 실행해주세요
              </td></tr>
            )}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-3xl font-black text-white">⭐ CON 관리</h1>
        <p className="text-sm text-slate-500 mt-1 font-bold">기능별 CON 단가 및 활성 여부를 설정합니다</p>
      </div>

      <div className="bg-slate-800/50 border border-slate-700 rounded-xl px-4 py-3">
        <p className="text-xs font-bold text-slate-400">
          💡 단가 변경은 즉시 적용됩니다. 유형 OFF 시 원장님 화면에서 숨겨집니다.
          신규 항목이 보이지 않으면 <code className="text-yellow-400">supabase-con-pricing-v2-migration.sql</code>을 실행해주세요.
        </p>
      </div>

      {loading ? (
        <div className="text-center py-16 text-slate-400 font-bold">불러오는 중...</div>
      ) : (
        <div className="space-y-4">
          {SECTIONS.map(renderSectionCard)}
        </div>
      )}

      {/* CON 패키지 안내 */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-3">
        <h3 className="text-sm font-black text-white">📦 CON 패키지 안내</h3>
        <div className="grid grid-cols-3 gap-3">
          {[
            { amount: 1000, price: '10,000원' },
            { amount: 3000, price: '30,000원' },
            { amount: 5000, price: '50,000원' },
          ].map(pkg => (
            <div key={pkg.amount} className="bg-slate-800 rounded-xl px-4 py-3 text-center">
              <p className="text-xl font-black text-yellow-400">{pkg.amount.toLocaleString()} C</p>
              <p className="text-xs font-bold text-slate-400 mt-1">{pkg.price}</p>
            </div>
          ))}
        </div>
        <p className="text-xs text-slate-500 font-bold">위 패키지 정보는 참고용입니다. 실제 충전은 학원 관리 페이지에서 직접 진행해주세요.</p>
      </div>
    </div>
  );
}
