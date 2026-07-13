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

interface SubSection { label: string; keys: string[] }
interface SectionConfig {
  key: string; label: string; color: string;
  subsections?: SubSection[]; keys?: string[];
  noToggle?: boolean; note?: string; model?: string;
}
type ModelKey = 'gpt-5.1' | 'gpt-5.4';
interface ModelPricing { inputPricePerM: number; outputPricePerM: number }
interface FeatureTokens { in: number; out: number; model: ModelKey }

// ─── 레이블 ──────────────────────────────────────────────────────────────────

const WB_TYPE_LABELS: Record<string, string> = {
  passage_analysis: '지문 구문분석', passage_translation: '지문 해석지',
  translation: '문장 해석', word_order: '단어 배열', english_writing: '영작 하기',
  vocab_choice: '어휘 고르기', vocab_fill: '어휘 채우기',
  grammar_choice: '어법 고르기', grammar_correct: '어법 고치기', grammar_correct_adv: '어법 고치기(심화)',
  combo_grammar_order: '어법 서술형 + 순서배열', combo_vocab_fill: '영작 서술형 + 어휘',
  summary_sentence: '요약문 서술형', paragraph_order: '문단 배열', sentence_insertion: '문장 삽입',
  suneung_vocab_right: '적절한 어휘', suneung_vocab_wrong: '부적절한 어휘',
  suneung_grammar_right: '맞는 어법', suneung_grammar_wrong: '틀린 어법',
  combo_vocab_grammar: '어휘+어법', combo_grammar_insert: '어법+문장삽입',
};
const getWbLabel = (k: string) => WB_TYPE_LABELS[k.replace(/^wb_(direct|mock)_/, '')] ?? k;

// ─── feature key 목록 ─────────────────────────────────────────────────────────

const WB_DIRECT_KEYS = [
  'wb_direct_passage_translation','wb_direct_passage_analysis',
  'wb_direct_translation','wb_direct_word_order','wb_direct_english_writing',
  'wb_direct_vocab_choice','wb_direct_vocab_fill',
  'wb_direct_grammar_choice','wb_direct_grammar_correct','wb_direct_grammar_correct_adv',
  'wb_direct_combo_grammar_order','wb_direct_combo_vocab_fill','wb_direct_summary_sentence',
  'wb_direct_paragraph_order','wb_direct_sentence_insertion',
  'wb_direct_suneung_vocab_right','wb_direct_suneung_vocab_wrong',
  'wb_direct_suneung_grammar_right','wb_direct_suneung_grammar_wrong',
  'wb_direct_combo_vocab_grammar','wb_direct_combo_grammar_insert',
];
const WB_MOCK_KEYS = WB_DIRECT_KEYS.map(k => k.replace('wb_direct_', 'wb_mock_'));

const AI_DIRECT_KEYS = [
  'ai_type_topic_title','ai_type_grammar','ai_type_vocab_paraphrase',
  'ai_type_vocab_blank','ai_type_fill_blank','ai_type_summary',
  'ai_type_flow','ai_type_phrase_meaning','ai_type_sentence_order','ai_type_sentence_insertion',
];
const AI_MOCK_KEYS = AI_DIRECT_KEYS.map(k => k.replace('ai_type_', 'mock_ai_type_'));

// ─── 유형별 평균 토큰 (프롬프트 분석 기반 추정) ──────────────────────────────

const T = (i: number, o: number, m: ModelKey = 'gpt-5.1'): FeatureTokens => ({ in: i, out: o, model: m });

// 워크북 base (wb_direct_* 접두사 없는 순수 타입명)
const WB_TOKENS: Record<string, FeatureTokens> = {
  passage_translation:   T(700,  600),   // 지문 해석지: 지문+프롬프트 / 문장별 한글 번역
  passage_analysis:      T(700,  2000),  // 구문분석: 출력이 가장 큼 (전체 문장 파싱 JSON)
  translation:           T(700,  400),   // 문장 해석: 문장별 번역 리스트
  word_order:            T(700,  500),   // 단어 배열: 문장별 scrambled 리스트
  english_writing:       T(700,  300),   // 영작: 힌트+정답 간결
  vocab_choice:          T(700,  1500),  // 어휘고르기: 지문 전체 + [A/B] 선택지
  vocab_fill:            T(700,  1200),  // 어휘채우기: 지문 전체 + 빈칸 번호
  grammar_choice:        T(700,  1000),  // 어법고르기: 지문 전체 + (A)(B) 선택지
  grammar_correct:       T(700,  800),   // 어법고치기: 지문 전체 + 오류 태깅
  grammar_correct_adv:   T(700,  1000),  // 어법고치기(심화): 더 많은 오류 포함
  combo_grammar_order:   T(800,  1500),  // 어법+순서배열: 두 섹션 합산
  combo_vocab_fill:      T(800,  1500),  // 영작+어휘: 두 섹션 합산
  summary_sentence:      T(700,  500),   // 요약문 서술형: 빈칸 요약문
  paragraph_order:       T(700,  600),   // 문단 배열: shuffled 단락 리스트
  sentence_insertion:    T(700,  600),   // 문장 삽입: 지문 + 삽입 문장
  suneung_vocab_right:   T(700,  800),   // 수능 어휘(맞는): 지문 + 선택지
  suneung_vocab_wrong:   T(700,  800),   // 수능 어휘(틀린): 지문 + 선택지
  suneung_grammar_right: T(700,  800),   // 수능 어법(맞는): 지문 + 선택지
  suneung_grammar_wrong: T(700,  800),   // 수능 어법(틀린): 지문 + 선택지
  combo_vocab_grammar:   T(800,  1500),  // 어휘+어법: 두 섹션 합산
  combo_grammar_insert:  T(800,  1500),  // 어법+문장삽입: 두 섹션 합산
};

const FEATURE_TOKENS: Record<string, FeatureTokens> = {
  // 지문분석: 시스템 프롬프트+지문 / 변형지문+T/F 10개+요약+어휘표 6가지
  pdf_analysis_direct: T(1500, 2200),
  pdf_analysis_mock:   T(1600, 2200), // 모의고사 지문이 약간 더 긺

  // 워크북 직접 입력 (지문 길이 평균)
  ...Object.fromEntries(Object.entries(WB_TOKENS).map(([k, v]) => [`wb_direct_${k}`, v])),
  // 워크북 모의고사 (지문 100토큰 더 긺)
  ...Object.fromEntries(Object.entries(WB_TOKENS).map(([k, v]) => [`wb_mock_${k}`, { ...v, in: v.in + 100 }])),

  // 실전 변형 직접 입력
  ai_type_topic_title:        T(1500,  700),         // 주제/제목: 선택지 5개 + 해설
  ai_type_grammar:            T(1800, 1200, 'gpt-5.4'), // 어법: 복잡한 CSAT 규칙 + 지문 변형
  ai_type_vocab_paraphrase:   T(1500,  800),         // 어휘 낱말 쓰임: 선택지 + 해설
  ai_type_vocab_blank:        T(1500,  700),         // 어휘 (a)(b) 빈칸: 2빈칸 선택지
  ai_type_fill_blank:         T(1600,  800),         // 빈칸 추론: 지문 변형 + 선택지
  ai_type_summary:            T(1600,  800),         // 요약문 완성: 요약 + 선택지
  ai_type_flow:               T(1600,  900),         // 흐름: 지문 변형 + 선택지
  ai_type_phrase_meaning:     T(1500,  700),         // 어구 의미 추론: 선택지
  ai_type_sentence_order:     T(1600,  900),         // 순서 배열: 단락 분리 + 선택지
  ai_type_sentence_insertion: T(1600,  900),         // 문장 삽입: 지문 변형 + 선택지

  // 실전 변형 모의고사 (모의고사 지문 약간 더 긺)
  mock_ai_type_topic_title:        T(1600,  700),
  mock_ai_type_grammar:            T(1900, 1200, 'gpt-5.4'),
  mock_ai_type_vocab_paraphrase:   T(1600,  800),
  mock_ai_type_vocab_blank:        T(1600,  700),
  mock_ai_type_fill_blank:         T(1700,  800),
  mock_ai_type_summary:            T(1700,  800),
  mock_ai_type_flow:               T(1700,  900),
  mock_ai_type_phrase_meaning:     T(1600,  700),
  mock_ai_type_sentence_order:     T(1700,  900),
  mock_ai_type_sentence_insertion: T(1700,  900),
};

// ─── 섹션 설정 ────────────────────────────────────────────────────────────────

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
    subsections: [
      { label: '직접 입력', keys: ['pdf_analysis_direct'] },
      { label: '모의고사',  keys: ['pdf_analysis_mock'] },
    ],
  },
  {
    key: 'workbook', label: '워크북', color: 'text-rose-400',
    model: 'gpt-5.1',
    subsections: [
      { label: '직접 입력', keys: WB_DIRECT_KEYS },
      { label: '모의고사',  keys: WB_MOCK_KEYS },
    ],
  },
  {
    key: 'exam_direct', label: '실전 변형 문제 (직접 입력)', color: 'text-blue-400',
    model: 'gpt-5.1 (어법: gpt-5.4)',
    keys: AI_DIRECT_KEYS,
  },
  {
    key: 'exam_mock', label: '실전 변형 문제 (모의고사)', color: 'text-indigo-400',
    model: 'gpt-5.1 (어법: gpt-5.4)',
    keys: AI_MOCK_KEYS,
  },
];

// ─── 기본 모델 단가 ───────────────────────────────────────────────────────────

const DEFAULT_MODEL_PRICING: Record<ModelKey, ModelPricing> = {
  'gpt-5.1': { inputPricePerM: 2.0, outputPricePerM: 8.0 },
  'gpt-5.4': { inputPricePerM: 4.0, outputPricePerM: 16.0 },
};
const MODEL_KEYS: ModelKey[] = ['gpt-5.1', 'gpt-5.4'];

// ─── 컴포넌트 ─────────────────────────────────────────────────────────────────

export default function ConPricingPage() {
  const [pricing, setPricing] = useState<PricingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [toggling, setToggling] = useState<string | null>(null);
  const [saveMsg, setSaveMsg] = useState<Record<string, string>>({});
  const [inserting, setInserting] = useState<string | null>(null);

  const [exchangeRate, setExchangeRate] = useState(1380);
  const [modelPricing, setModelPricing] = useState<Record<ModelKey, ModelPricing>>(DEFAULT_MODEL_PRICING);
  const [costSaveStatus, setCostSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isInitialLoad = useRef(true);

  useEffect(() => {
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
          if (saved.modelPricing) setModelPricing({ ...DEFAULT_MODEL_PRICING, ...saved.modelPricing });
        } catch { /* 파싱 실패 시 기본값 사용 */ }
      }
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (isInitialLoad.current) { isInitialLoad.current = false; return; }
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    setCostSaveStatus('saving');
    autoSaveTimer.current = setTimeout(() => {
      fetch('/api/superadmin/site-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings: { cost_calc_config: JSON.stringify({ exchangeRate, modelPricing }) } }),
      }).then(() => {
        setCostSaveStatus('saved');
        setTimeout(() => setCostSaveStatus('idle'), 2000);
      }).catch(() => setCostSaveStatus('idle'));
    }, 1000);
  }, [exchangeRate, modelPricing]);

  const pricingMap = Object.fromEntries(pricing.map(p => [p.feature_key, p]));

  const calcCost = (featureKey: string): number | null => {
    const tokens = FEATURE_TOKENS[featureKey];
    if (!tokens) return null;
    const mp = modelPricing[tokens.model];
    if (!mp) return null;
    const usd = (tokens.in / 1_000_000) * mp.inputPricePerM
              + (tokens.out / 1_000_000) * mp.outputPricePerM;
    return Math.round(usd * exchangeRate * 10) / 10;
  };

  const startEdit  = (key: string, cur: number) => setEditing(prev => ({ ...prev, [key]: String(cur) }));
  const cancelEdit = (key: string) => {
    setEditing(prev => { const n = { ...prev }; delete n[key]; return n; });
    setSaveMsg(prev => { const n = { ...prev }; delete n[key]; return n; });
  };

  const handleInsert = async (key: string) => {
    setInserting(key);
    const name = key.startsWith('wb_') ? getWbLabel(key) : key;
    try {
      const res = await fetch('/api/superadmin/credits/pricing', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
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
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
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
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
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
    const tokens = FEATURE_TOKENS[item.feature_key];
    const costKRW = calcCost(item.feature_key);

    return (
      <tr key={item.id} className={`border-t border-slate-800 transition-colors ${item.is_active ? 'hover:bg-slate-800/20' : 'opacity-40 hover:bg-slate-800/10'}`}>
        <td className="py-3 px-4">
          <p className="font-black text-white text-sm">
            {item.feature_key.startsWith('wb_') ? getWbLabel(item.feature_key) : item.feature_name}
          </p>
          <p className="text-[10px] text-slate-600 font-bold mt-0.5">{item.feature_key}</p>
        </td>
        <td className="py-3 px-4 text-slate-400 font-bold text-xs whitespace-nowrap">{item.unit_description}</td>
        <td className="py-3 px-4 text-center">
          {tokens
            ? <span className="text-[11px] font-bold text-slate-500 tabular-nums whitespace-nowrap">
                {tokens.in.toLocaleString()} / {tokens.out.toLocaleString()}
                {tokens.model === 'gpt-5.4' && <span className="ml-1 text-[9px] text-amber-500 font-black">5.4</span>}
              </span>
            : <span className="text-slate-700 text-xs">—</span>
          }
        </td>
        <td className="py-3 px-4 text-center">
          {costKRW !== null
            ? <span className="font-bold text-slate-300 text-xs whitespace-nowrap">~{costKRW.toLocaleString()}원</span>
            : <span className="text-slate-700 text-xs">—</span>
          }
        </td>
        <td className="py-3 px-4 text-center">
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
          <td className="py-3 px-4 text-center">
            <button onClick={() => handleToggle(item.feature_key, item.is_active)} disabled={isToggling}
              className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none disabled:opacity-50 ${item.is_active ? 'bg-emerald-500' : 'bg-slate-600'}`}>
              <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${item.is_active ? 'translate-x-4' : 'translate-x-0.5'}`} />
            </button>
          </td>
        )}
        <td className="py-3 px-4 text-center">
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
        <td className="py-3 px-4 text-right text-[10px] text-slate-500 font-bold whitespace-nowrap">
          {new Date(item.updated_at).toLocaleDateString('ko-KR')}
        </td>
      </tr>
    );
  };

  const renderMissingRow = (k: string, showToggle: boolean) => {
    const isIns = inserting === k;
    const name = k.startsWith('wb_') ? getWbLabel(k) : k;
    const colSpanExtra = showToggle ? 1 : 0;
    return (
      <tr key={k} className="border-t border-slate-800 opacity-40">
        <td className="py-3 px-4">
          <p className="font-black text-slate-400 text-sm">{name}</p>
          <p className="text-[10px] text-slate-600 font-bold mt-0.5">{k}</p>
        </td>
        <td className="py-3 px-4 text-slate-600 font-bold text-xs">1회당</td>
        <td className="py-3 px-4 text-center text-slate-700 text-xs">—</td>
        <td className="py-3 px-4 text-center text-slate-700 text-xs">—</td>
        <td className="py-3 px-4 text-center"><span className="font-black text-slate-600 text-xs">미설정</span></td>
        {showToggle && <td />}
        <td className="py-3 px-4 text-center">
          <button onClick={() => handleInsert(k)} disabled={isIns}
            className="px-3 py-1 text-xs font-black bg-emerald-700 hover:bg-emerald-600 text-white rounded-lg transition-all disabled:opacity-50">
            {isIns ? '…' : '추가'}
          </button>
        </td>
        <td />
      </tr>
    );
  };

  const renderTable = (keys: string[], showToggle: boolean) => (
    <>
      {keys.map(k => {
        const item = pricingMap[k];
        return item ? renderRow(item, showToggle) : renderMissingRow(k, showToggle);
      })}
    </>
  );

  const renderSectionCard = (section: SectionConfig) => {
    const showToggle = !section.noToggle;
    const colCount = showToggle ? 8 : 7;
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
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[720px]">
            <thead className="bg-slate-800/30">
              <tr>
                <th className="py-2 px-4 text-left text-xs font-black text-slate-500">기능</th>
                <th className="py-2 px-4 text-left text-xs font-black text-slate-500">단위</th>
                <th className="py-2 px-4 text-center text-xs font-black text-slate-500">입력↑ / 출력↓ 토큰</th>
                <th className="py-2 px-4 text-center text-xs font-black text-slate-500">원가</th>
                <th className="py-2 px-4 text-center text-xs font-black text-slate-500">단가 (C)</th>
                {showToggle && <th className="py-2 px-4 text-center text-xs font-black text-slate-500">활성</th>}
                <th className="py-2 px-4 text-center text-xs font-black text-slate-500">수정</th>
                <th className="py-2 px-4 text-right text-xs font-black text-slate-500">수정일</th>
              </tr>
            </thead>
            <tbody>
              {section.subsections ? (
                section.subsections.map((sub, si) => (
                  <>
                    <tr key={`sub-${si}`} className="bg-slate-800/40 border-t border-slate-700">
                      <td colSpan={colCount} className="px-4 py-2">
                        <span className="text-[10px] font-black text-slate-300 uppercase tracking-wider">└ {sub.label}</span>
                      </td>
                    </tr>
                    {renderTable(sub.keys, showToggle)}
                  </>
                ))
              ) : renderTable(section.keys ?? [], showToggle)}
              {!hasItems && (
                <tr><td colSpan={colCount} className="py-4 px-4 text-xs text-slate-500 font-bold text-center">
                  DB에 항목 없음 — SQL 마이그레이션을 실행해주세요
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
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
        <div className="space-y-4">{SECTIONS.map(renderSectionCard)}</div>
      )}

      {/* CON 패키지 안내 */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-3">
        <h3 className="text-sm font-black text-white">📦 CON 패키지 안내</h3>
        <div className="grid grid-cols-3 gap-3">
          {[{ amount: 1000, price: '10,000원' }, { amount: 3000, price: '30,000원' }, { amount: 5000, price: '50,000원' }].map(pkg => (
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
              모델별 토큰 단가를 입력하면 각 기능의 원가가 자동 계산됩니다. 변경 시 자동 저장.
            </p>
          </div>
          <div className="shrink-0 text-xs font-black pt-1">
            {costSaveStatus === 'saving' && <span className="text-slate-400">저장 중...</span>}
            {costSaveStatus === 'saved'  && <span className="text-emerald-400">✓ 저장됨</span>}
          </div>
        </div>

        {/* 환율 */}
        <div className="flex items-center gap-3 p-4 bg-slate-800/50 rounded-xl border border-slate-700">
          <span className="text-xs font-black text-slate-300 whitespace-nowrap">💱 환율</span>
          <input type="number" min="0" step="10" value={exchangeRate}
            onChange={e => setExchangeRate(Number(e.target.value))}
            className="w-28 text-center px-2 py-1.5 bg-slate-700 border border-slate-600 rounded-lg text-white font-black focus:outline-none text-sm" />
          <span className="text-xs text-slate-500 font-bold">원 / 1 USD</span>
        </div>

        {/* 모델별 토큰 단가 */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {MODEL_KEYS.map(model => (
            <div key={model} className="p-4 bg-slate-800/40 rounded-xl border border-slate-700 space-y-3">
              <p className="text-xs font-black text-white">🤖 {model}</p>
              <div className="grid grid-cols-2 gap-3">
                {([
                  { field: 'inputPricePerM'  as const, label: '입력 토큰 단가', hint: 'USD / 1M tokens' },
                  { field: 'outputPricePerM' as const, label: '출력 토큰 단가', hint: 'USD / 1M tokens' },
                ] as const).map(({ field, label, hint }) => (
                  <div key={field} className="space-y-1">
                    <p className="text-[10px] font-black text-slate-500">{label}</p>
                    <input type="number" min="0" step="0.1"
                      value={modelPricing[model]?.[field] ?? 0}
                      onChange={e => setModelPricing(prev => ({
                        ...prev,
                        [model]: { ...prev[model], [field]: Number(e.target.value) },
                      }))}
                      className="w-full text-center px-2 py-1.5 bg-slate-700 border border-slate-600 rounded-lg text-white font-black focus:outline-none text-sm" />
                    <p className="text-[9px] text-slate-600 font-bold">{hint}</p>
                  </div>
                ))}
              </div>
              <div className="flex gap-4 pt-1 border-t border-slate-700">
                <div className="text-[10px] text-slate-500 font-bold">예시 원가:</div>
                <div className="text-[10px] font-black text-emerald-400">
                  1,000 입력 + 1,000 출력 →{' '}
                  {Math.round(((1000/1_000_000) * (modelPricing[model]?.inputPricePerM ?? 0)
                    + (1000/1_000_000) * (modelPricing[model]?.outputPricePerM ?? 0)) * exchangeRate * 100) / 100}원
                </div>
              </div>
            </div>
          ))}
        </div>

        <p className="text-[10px] text-slate-600 font-bold">
          * 원가 = (평균입력토큰 / 1M × 입력단가 + 평균출력토큰 / 1M × 출력단가) × 환율 · 토큰 수는 실제 프롬프트 분석 기반 추정치
        </p>
      </div>
    </div>
  );
}
