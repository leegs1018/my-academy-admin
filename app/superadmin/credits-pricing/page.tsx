'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

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
  model?: string;
  hasCost?: boolean; // 원가 계산기 적용 여부
}

interface SectionCostConfig {
  avgInputTokens: number;
  avgOutputTokens: number;
  inputPricePerM: number;  // USD per 1M input tokens
  outputPricePerM: number; // USD per 1M output tokens
}

const WB_TYPE_LABELS: Record<string, string> = {
  passage_analysis: '지문 구문분석', passage_translation: '지문 해석지',
  translation: '문장 해석', word_order: '단어 배열', english_writing: '영작 하기',
  vocab_choice: '어휘 고르기', vocab_fill: '어휘 채우기',
  grammar_choice: '어법 고르기', grammar_correct: '어법 고치기', grammar_correct_adv: '어법 고치기(심화)',
  combo_grammar_order: '어법 서술형 + 순서배열', combo_vocab_fill: '영작 서술형 + 어휘', summary_sentence: '요약문 서술형',
  paragraph_order: '문단 배열', sentence_insertion: '문장 삽입',
  suneung_vocab_right: '적절한 어휘', suneung_vocab_wrong: '부적절한 어휘',
  suneung_grammar_right: '맞는 어법', suneung_grammar_wrong: '틀린 어법',
  combo_vocab_grammar: '어휘+어법', combo_grammar_insert: '어법+문장삽입',
};

const getWbLabel = (featureKey: string) => {
  const typeKey = featureKey.replace(/^wb_(direct|mock)_/, '');
  return WB_TYPE_LABELS[typeKey] ?? featureKey;
};

const WB_DIRECT_KEYS = [
  // 지문 드릴
  'wb_direct_passage_translation', 'wb_direct_passage_analysis',
  'wb_direct_translation', 'wb_direct_word_order', 'wb_direct_english_writing',
  // 어휘 어법
  'wb_direct_vocab_choice', 'wb_direct_vocab_fill',
  'wb_direct_grammar_choice', 'wb_direct_grammar_correct', 'wb_direct_grammar_correct_adv',
  // 서술형 대비
  'wb_direct_combo_grammar_order', 'wb_direct_combo_vocab_fill', 'wb_direct_summary_sentence',
  // 보류
  'wb_direct_paragraph_order', 'wb_direct_sentence_insertion',
  'wb_direct_suneung_vocab_right', 'wb_direct_suneung_vocab_wrong',
  'wb_direct_suneung_grammar_right', 'wb_direct_suneung_grammar_wrong',
  'wb_direct_combo_vocab_grammar', 'wb_direct_combo_grammar_insert',
];
const WB_MOCK_KEYS = WB_DIRECT_KEYS.map(k => k.replace('wb_direct_', 'wb_mock_'));

const AI_DIRECT_KEYS = [
  'ai_type_topic_title', 'ai_type_grammar', 'ai_type_vocab_paraphrase',
  'ai_type_vocab_blank', 'ai_type_fill_blank', 'ai_type_summary',
  'ai_type_flow', 'ai_type_phrase_meaning', 'ai_type_sentence_order',
  'ai_type_sentence_insertion',
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
    key: 'sms', label: '메시지 발송 (SMS / 알림톡)', color: 'text-violet-400',
    keys: ['sms', 'lms', 'alimtalk'],
    noToggle: true,
    note: 'SMS: 90바이트 이하 · 초과 시 LMS · 알림톡: 카카오 채널 발송',
  },
  {
    key: 'pdf', label: '지문분석', color: 'text-teal-400',
    model: 'gpt-5.1',
    hasCost: true,
    subsections: [
      { label: '직접 입력', keys: ['pdf_analysis_direct'] },
      { label: '모의고사',  keys: ['pdf_analysis_mock'] },
    ],
  },
  {
    key: 'workbook', label: '워크북', color: 'text-rose-400',
    model: 'gpt-5.1',
    hasCost: true,
    subsections: [
      { label: '직접 입력', keys: WB_DIRECT_KEYS },
      { label: '모의고사',  keys: WB_MOCK_KEYS },
    ],
  },
  {
    key: 'exam_direct', label: '실전 변형 문제 (직접 입력)', color: 'text-blue-400',
    model: 'gpt-5.1 (어법: gpt-5.4)',
    hasCost: true,
    keys: AI_DIRECT_KEYS,
  },
  {
    key: 'exam_mock', label: '실전 변형 문제 (모의고사)', color: 'text-indigo-400',
    model: 'gpt-5.1 (어법: gpt-5.4)',
    hasCost: true,
    keys: AI_MOCK_KEYS,
  },
];

// 프롬프트 분석 기반 추정값
// pdf: 시스템 프롬프트(~850) + 지문(~250) + JSON 템플릿(~400) = 입력 ~1500 / 출력: 변형지문+T/F10+요약+어휘표 = ~2200
// workbook: 헤더(~100) + 지문(~250) + 유형별 규칙(~350) = 입력 ~700 / 출력: 유형별 단일 결과 = ~800
// exam: CSAT 원칙(~500) + 지문(~250) + 유형별 규칙(~1000×2유형) = 입력 ~1800 / 출력: 문제+선택지+해설 = ~1200
const DEFAULT_SECTION_COSTS: Record<string, SectionCostConfig> = {
  pdf:        { avgInputTokens: 1500, avgOutputTokens: 2200, inputPricePerM: 2.0, outputPricePerM: 8.0 },
  workbook:   { avgInputTokens: 700,  avgOutputTokens: 800,  inputPricePerM: 2.0, outputPricePerM: 8.0 },
  exam_direct:{ avgInputTokens: 1800, avgOutputTokens: 1200, inputPricePerM: 2.0, outputPricePerM: 8.0 },
  exam_mock:  { avgInputTokens: 1800, avgOutputTokens: 1200, inputPricePerM: 2.0, outputPricePerM: 8.0 },
};

const SECTION_LABELS: Record<string, string> = {
  pdf: '지문분석', workbook: '워크북', exam_direct: '실전 변형(직접)', exam_mock: '실전 변형(모의)',
};

function calcCostKRW(cfg: SectionCostConfig, exchangeRate: number): number {
  const usd = (cfg.avgInputTokens / 1_000_000) * cfg.inputPricePerM
            + (cfg.avgOutputTokens / 1_000_000) * cfg.outputPricePerM;
  return Math.round(usd * exchangeRate * 10) / 10;
}

export default function ConPricingPage() {
  const [pricing, setPricing] = useState<PricingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [toggling, setToggling] = useState<string | null>(null);
  const [saveMsg, setSaveMsg] = useState<Record<string, string>>({});
  const [inserting, setInserting] = useState<string | null>(null);

  // 원가 계산기 상태
  const [exchangeRate, setExchangeRate] = useState(1380);
  const [sectionCosts, setSectionCosts] = useState<Record<string, SectionCostConfig>>(DEFAULT_SECTION_COSTS);
  const [costSaveStatus, setCostSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isInitialLoad = useRef(true);

  useEffect(() => {
    // pricing + cost_calc_config 동시 로드
    Promise.all([
      fetch('/api/superadmin/credits/pricing').then(r => r.json()),
      fetch('/api/superadmin/site-settings?keys=cost_calc_config').then(r => r.json()),
    ]).then(([pricingData, settingsData]) => {
      setPricing(pricingData.pricing || []);
      const raw = settingsData.settings?.cost_calc_config;
      if (raw) {
        try {
          const saved = JSON.parse(raw);
          if (typeof saved.exchangeRate === 'number') setExchangeRate(saved.exchangeRate);
          if (saved.sectionCosts) setSectionCosts({ ...DEFAULT_SECTION_COSTS, ...saved.sectionCosts });
        } catch { /* JSON 파싱 실패 시 기본값 사용 */ }
      }
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  // 원가 계산기 변경 시 1초 뒤 자동 저장
  useEffect(() => {
    if (isInitialLoad.current) { isInitialLoad.current = false; return; }
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    setCostSaveStatus('saving');
    autoSaveTimer.current = setTimeout(() => {
      const config = JSON.stringify({ exchangeRate, sectionCosts });
      fetch('/api/superadmin/site-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings: { cost_calc_config: config } }),
      }).then(() => {
        setCostSaveStatus('saved');
        setTimeout(() => setCostSaveStatus('idle'), 2000);
      }).catch(() => setCostSaveStatus('idle'));
    }, 1000);
  }, [exchangeRate, sectionCosts]);

  const pricingMap = Object.fromEntries(pricing.map(p => [p.feature_key, p]));

  const startEdit = (key: string, cur: number) =>
    setEditing(prev => ({ ...prev, [key]: String(cur) }));

  const cancelEdit = (key: string) => {
    setEditing(prev => { const n = { ...prev }; delete n[key]; return n; });
    setSaveMsg(prev => { const n = { ...prev }; delete n[key]; return n; });
  };

  const handleInsert = async (key: string) => {
    setInserting(key);
    const name = key.startsWith('wb_') ? getWbLabel(key) : key;
    try {
      const res = await fetch('/api/superadmin/credits/pricing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ feature_key: key, feature_name: name, cost_per_use: 20, unit_description: '1회당', is_active: true }),
      });
      const d = await res.json();
      if (d.success) {
        setPricing(prev => [...prev, {
          id: d.id ?? key, feature_key: key, feature_name: name,
          cost_per_use: 20, unit_description: '1회당', is_active: true,
          updated_at: new Date().toISOString(),
        }]);
      }
    } finally { setInserting(null); }
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

  const updateSectionCost = (sectionKey: string, field: keyof SectionCostConfig, value: number) => {
    setSectionCosts(prev => ({
      ...prev,
      [sectionKey]: { ...prev[sectionKey], [field]: value },
    }));
  };

  const renderRow = (item: PricingItem, showToggle: boolean, sectionKey?: string) => {
    const ev = editing[item.feature_key];
    const isSaving = saving === item.feature_key;
    const isToggling = toggling === item.feature_key;
    const msg = saveMsg[item.feature_key];
    const costCfg = sectionKey ? sectionCosts[sectionKey] : undefined;
    const costKRW = costCfg ? calcCostKRW(costCfg, exchangeRate) : null;

    return (
      <tr key={item.id} className={`border-t border-slate-800 transition-colors ${item.is_active ? 'hover:bg-slate-800/20' : 'opacity-40 hover:bg-slate-800/10'}`}>
        <td className="py-3 px-5">
          <p className="font-black text-white text-sm">
            {item.feature_key.startsWith('wb_') ? getWbLabel(item.feature_key) : item.feature_name}
          </p>
          <p className="text-[10px] text-slate-600 font-bold mt-0.5">{item.feature_key}</p>
        </td>
        <td className="py-3 px-5 text-slate-400 font-bold text-xs">{item.unit_description}</td>
        <td className="py-3 px-5 text-center">
          {costKRW !== null
            ? <span className="font-bold text-slate-400 text-xs">~{costKRW.toLocaleString()}원</span>
            : <span className="text-slate-600 text-xs">—</span>
          }
        </td>
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

  const renderMissingRow = (k: string, showToggle: boolean, colCount: number) => {
    const isIns = inserting === k;
    const name = k.startsWith('wb_') ? getWbLabel(k) : k;
    return (
      <tr key={k} className="border-t border-slate-800 opacity-50">
        <td className="py-3 px-5">
          <p className="font-black text-slate-400 text-sm">{name}</p>
          <p className="text-[10px] text-slate-600 font-bold mt-0.5">{k}</p>
        </td>
        <td className="py-3 px-5 text-slate-600 font-bold text-xs">1회당</td>
        <td className="py-3 px-5 text-center"><span className="text-slate-600 text-xs">—</span></td>
        <td className="py-3 px-5 text-center"><span className="font-black text-slate-600 text-xs">미설정</span></td>
        {showToggle && <td></td>}
        <td className="py-3 px-5 text-center">
          <button onClick={() => handleInsert(k)} disabled={isIns}
            className="px-3 py-1 text-xs font-black bg-emerald-700 hover:bg-emerald-600 text-white rounded-lg transition-all disabled:opacity-50">
            {isIns ? '…' : '추가'}
          </button>
        </td>
        <td></td>
      </tr>
    );
  };

  const renderTable = (keys: string[], showToggle: boolean, sectionKey?: string) => {
    const colCount = showToggle ? 7 : 6;
    return (
      <>
        {keys.map(k => {
          const item = pricingMap[k];
          if (item) return renderRow(item, showToggle, sectionKey);
          return renderMissingRow(k, showToggle, colCount);
        })}
      </>
    );
  };

  const renderSectionCard = (section: SectionConfig) => {
    const showToggle = !section.noToggle;
    const colCount = showToggle ? 7 : 6;
    const hasItems = section.subsections
      ? section.subsections.some(sub => sub.keys.some(k => pricingMap[k]))
      : (section.keys ?? []).some(k => pricingMap[k]);

    return (
      <div key={section.key} className="bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden">
        <div className="px-6 py-3 bg-slate-800/60 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <h2 className={`text-sm font-black ${section.color} whitespace-nowrap`}>{section.label}</h2>
            {section.model && (
              <span className="px-2 py-0.5 text-[10px] font-black bg-slate-700 text-slate-300 rounded-md border border-slate-600 whitespace-nowrap">
                🤖 {section.model}
              </span>
            )}
          </div>
          {section.note && <span className="text-xs font-bold text-slate-400 text-right">{section.note}</span>}
        </div>
        <table className="w-full text-sm">
          <thead className="bg-slate-800/30">
            <tr>
              <th className="py-2 px-5 text-left text-xs font-black text-slate-500">기능</th>
              <th className="py-2 px-5 text-left text-xs font-black text-slate-500">단위</th>
              <th className="py-2 px-5 text-center text-xs font-black text-slate-500">원가</th>
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
                  {renderTable(sub.keys, showToggle, section.hasCost ? section.key : undefined)}
                </>
              ))
            ) : (
              renderTable(section.keys ?? [], showToggle, section.hasCost ? section.key : undefined)
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

      {/* 원가 계산기 */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-sm font-black text-white">🧮 원가 계산기</h3>
            <p className="text-xs text-slate-500 font-bold mt-1">
              토큰 단가와 평균 사용량을 입력하면 위 테이블의 원가 컬럼이 자동 계산됩니다. 변경 시 자동 저장됩니다.
            </p>
          </div>
          <div className="shrink-0 text-xs font-black pt-1">
            {costSaveStatus === 'saving' && <span className="text-slate-400">저장 중...</span>}
            {costSaveStatus === 'saved'  && <span className="text-emerald-400">✓ 저장됨</span>}
          </div>
        </div>

        {/* 환율 */}
        <div className="flex items-center gap-4 p-4 bg-slate-800/50 rounded-xl border border-slate-700">
          <span className="text-xs font-black text-slate-300 whitespace-nowrap">💱 환율 (원/달러)</span>
          <input
            type="number" min="0" step="10" value={exchangeRate}
            onChange={e => setExchangeRate(Number(e.target.value))}
            className="w-28 text-center px-2 py-1.5 bg-slate-700 border border-slate-600 rounded-lg text-white font-black focus:outline-none text-sm"
          />
          <span className="text-xs text-slate-500 font-bold">KRW / 1 USD</span>
        </div>

        {/* 섹션별 토큰 설정 */}
        <div className="space-y-3">
          {SECTIONS.filter(s => s.hasCost).map(section => {
            const cfg = sectionCosts[section.key];
            if (!cfg) return null;
            const costKRW = calcCostKRW(cfg, exchangeRate);
            return (
              <div key={section.key} className="p-4 bg-slate-800/40 rounded-xl border border-slate-700 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-black ${section.color}`}>{SECTION_LABELS[section.key] ?? section.label}</span>
                    {section.model && (
                      <span className="px-1.5 py-0.5 text-[10px] font-black bg-slate-700 text-slate-400 rounded border border-slate-600">
                        {section.model}
                      </span>
                    )}
                  </div>
                  <div className="text-right">
                    <span className="text-xs font-bold text-slate-400">원가 </span>
                    <span className="text-sm font-black text-emerald-400">~{costKRW.toLocaleString()}원</span>
                    <span className="text-[10px] text-slate-500 font-bold ml-1">/ 1회</span>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {([
                    { field: 'inputPricePerM'  as const, label: '입력 토큰 단가', suffix: 'USD/1M' },
                    { field: 'outputPricePerM' as const, label: '출력 토큰 단가', suffix: 'USD/1M' },
                    { field: 'avgInputTokens'  as const, label: '평균 입력 토큰', suffix: 'tokens' },
                    { field: 'avgOutputTokens' as const, label: '평균 출력 토큰', suffix: 'tokens' },
                  ]).map(({ field, label, suffix }) => (
                    <div key={field} className="space-y-1">
                      <p className="text-[10px] font-black text-slate-500">{label}</p>
                      <div className="flex items-center gap-1">
                        <input
                          type="number" min="0" step={field.includes('Price') ? 0.1 : 100}
                          value={cfg[field]}
                          onChange={e => updateSectionCost(section.key, field, Number(e.target.value))}
                          className="w-full text-center px-2 py-1.5 bg-slate-700 border border-slate-600 rounded-lg text-white font-black focus:outline-none text-xs"
                        />
                        <span className="text-[9px] text-slate-600 font-bold whitespace-nowrap">{suffix}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        <p className="text-[10px] text-slate-600 font-bold">
          * 원가 = (평균입력토큰 / 1M × 입력단가 + 평균출력토큰 / 1M × 출력단가) × 환율
        </p>
      </div>
    </div>
  );
}
