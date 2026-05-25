'use client';

import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import {
  DndContext, closestCenter, PointerSensor, useSensor, useSensors,
} from '@dnd-kit/core';
import type { DragEndEvent } from '@dnd-kit/core';
import {
  SortableContext, verticalListSortingStrategy, useSortable, arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

// ─── 타입 ────────────────────────────────────────────────────────────────────
interface ExamChoice { number: number; text: string; }
interface ExamQuestion {
  type: string; question_text: string; modified_passage?: string | null;
  choices: ExamChoice[]; answer: number; explanation: string;
}
interface TypeConfig {
  id: string; type: string; difficulty: 'b1' | 'b2' | 'c1' | 'c2';
  count: number; enabled: boolean; isCustom: boolean;
}

const DIFF_OPTIONS = [
  { key: 'b1' as const, label: '하',   sub: 'B1', icon: '🌱', active: 'border-sky-400 bg-sky-50 text-sky-700' },
  { key: 'b2' as const, label: '중',   sub: 'B2', icon: '🌳', active: 'border-emerald-500 bg-emerald-50 text-emerald-700' },
  { key: 'c1' as const, label: '상',   sub: 'C1', icon: '🔥', active: 'border-orange-500 bg-orange-50 text-orange-700' },
  { key: 'c2' as const, label: '최상', sub: 'C2', icon: '⚡', active: 'border-rose-500 bg-rose-50 text-rose-700' },
];

const QUESTION_TYPE_OPTIONS = [
  { key: 'topic_title',      label: '주제/제목 유형',          color: 'bg-blue-100 text-blue-700 border-blue-200' },
  { key: 'grammar',          label: '어법 유형',               color: 'bg-green-100 text-green-700 border-green-200' },
  { key: 'vocab_paraphrase', label: '어휘 - 낱말 쓰임 유형',   color: 'bg-purple-100 text-purple-700 border-purple-200' },
  { key: 'vocab_blank',      label: '어휘 (a)(b) 빈칸 유형',   color: 'bg-amber-100 text-amber-700 border-amber-200' },
  { key: 'fill_blank',       label: '빈칸 추론 유형',           color: 'bg-rose-100 text-rose-700 border-rose-200' },
  { key: 'summary',          label: '요약문 완성 유형',         color: 'bg-teal-100 text-teal-700 border-teal-200' },
  { key: 'flow',             label: '흐름 유형',                color: 'bg-cyan-100 text-cyan-700 border-cyan-200' },
  { key: 'phrase_meaning',   label: '어구 의미 추론 유형',      color: 'bg-orange-100 text-orange-700 border-orange-200' },
  { key: 'sentence_order',   label: '순서 배열 유형',           color: 'bg-indigo-100 text-indigo-700 border-indigo-200' },
];

const TYPE_COLOR_MAP: Record<string, string> = {};
QUESTION_TYPE_OPTIONS.forEach(o => { TYPE_COLOR_MAP[o.key] = o.color; });
const TYPE_LABEL_MAP: Record<string, string> = {};
QUESTION_TYPE_OPTIONS.forEach(o => { TYPE_LABEL_MAP[o.key] = o.label; });

const CIRCLE_NUMS = ['①','②','③','④','⑤'];

// ─── SortableTypeCard ─────────────────────────────────────────────────────────
function SortableTypeCard({
  cfg, onUpdate, onRemove,
}: {
  cfg: TypeConfig;
  onUpdate: (id: string, patch: Partial<TypeConfig>) => void;
  onRemove: (id: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: cfg.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-3 bg-white rounded-2xl border-2 px-4 py-4 shadow-sm transition-all
        ${cfg.enabled ? 'border-indigo-100' : 'border-gray-100 opacity-60'}`}
    >
      <button
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing text-gray-300 hover:text-gray-500 flex-shrink-0 text-lg touch-none select-none"
        tabIndex={-1}
      >⠿</button>

      <input
        type="checkbox"
        checked={cfg.enabled}
        onChange={e => onUpdate(cfg.id, { enabled: e.target.checked })}
        className="w-5 h-5 accent-indigo-600 flex-shrink-0 cursor-pointer"
      />

      <div className="w-36 flex-shrink-0">
        {cfg.isCustom ? (
          <select
            value={cfg.type}
            onChange={e => onUpdate(cfg.id, { type: e.target.value })}
            className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs font-bold text-gray-700 outline-none focus:border-indigo-400 bg-white"
          >
            <option value="">유형 선택</option>
            {QUESTION_TYPE_OPTIONS.map(o => (
              <option key={o.key} value={o.key}>{o.label}</option>
            ))}
          </select>
        ) : (
          <span className={`inline-block text-xs font-black px-2.5 py-1 rounded-lg border ${TYPE_COLOR_MAP[cfg.type] ?? 'bg-gray-100 text-gray-600 border-gray-200'}`}>
            {TYPE_LABEL_MAP[cfg.type] ?? cfg.type}
          </span>
        )}
      </div>

      <div className="flex gap-1.5 flex-1">
        {DIFF_OPTIONS.map(d => (
          <button
            key={d.key}
            onClick={() => onUpdate(cfg.id, { difficulty: d.key })}
            className={`flex-1 py-2 rounded-xl font-black text-xs transition-all border-2
              ${cfg.difficulty === d.key
                ? d.active
                : 'border-gray-200 bg-white text-gray-400 hover:border-gray-300 hover:text-gray-600'}`}
          >
            <div className="text-base leading-none mb-0.5">{d.icon}</div>
            <div className="text-[9px] font-bold opacity-60 leading-none mb-0.5">{d.sub}</div>
            <div className="leading-none">{d.label}</div>
          </button>
        ))}
      </div>

      <div className="flex items-center gap-1.5 flex-shrink-0">
        <button
          onClick={() => onUpdate(cfg.id, { count: Math.max(1, cfg.count - 1) })}
          className="w-7 h-7 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-600 font-black text-sm flex items-center justify-center transition-all"
        >−</button>
        <span className="w-5 text-center text-base font-black text-indigo-700">{cfg.count}</span>
        <button
          onClick={() => onUpdate(cfg.id, { count: Math.min(3, cfg.count + 1) })}
          className="w-7 h-7 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-600 font-black text-sm flex items-center justify-center transition-all"
        >+</button>
      </div>

      {cfg.isCustom && (
        <button
          onClick={() => onRemove(cfg.id)}
          className="text-red-300 hover:text-red-500 text-base font-black flex-shrink-0 leading-none"
        >✕</button>
      )}
    </div>
  );
}

// ─── 메인 컴포넌트 ────────────────────────────────────────────────────────────
export default function MockExamQuestionsPage() {
  // 지문 선택
  const [years, setYears] = useState<number[]>([]);
  const [institutions, setInstitutions] = useState<string[]>([]);
  const [grades, setGrades] = useState<string[]>([]);
  const [examNames, setExamNames] = useState<string[]>([]);
  const [questionNumbers, setQuestionNumbers] = useState<number[]>([]);
  const [selectedYear, setSelectedYear] = useState('');
  const [selectedInstitution, setSelectedInstitution] = useState('');
  const [selectedGrade, setSelectedGrade] = useState('');
  const [selectedExamName, setSelectedExamName] = useState('');
  const [selectedNumber, setSelectedNumber] = useState('');
  const [passageText, setPassageText] = useState('');
  const [passageLoading, setPassageLoading] = useState(false);

  // 유형 설정
  const [typeConfigs, setTypeConfigs] = useState<TypeConfig[]>(() =>
    QUESTION_TYPE_OPTIONS.map(o => ({
      id: crypto.randomUUID(),
      type: o.key,
      difficulty: 'b2' as const,
      count: 1,
      enabled: true,
      isCustom: false,
    }))
  );
  const [bulkDifficulty, setBulkDifficulty] = useState<'b1' | 'b2' | 'c1' | 'c2' | ''>('');
  const [bulkCount, setBulkCount] = useState<number | ''>(1);

  // 생성
  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState('');
  const [questions, setQuestions] = useState<ExamQuestion[]>([]);
  const [conBalance, setConBalance] = useState<number | null>(null);
  const [session, setSession] = useState<{ user: { id: string }; access_token: string } | null>(null);
  const [revealedAnswers, setRevealedAnswers] = useState<Set<number>>(new Set());

  // 세션 로드
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      if (s) setSession(s as typeof session);
    });
  }, []);

  useEffect(() => {
    if (!session) return;
    fetch('/api/credits/transactions', {
      headers: { Authorization: `Bearer ${session.access_token}` },
    }).then(r => r.json()).then((j: { balance?: number }) => {
      if (j.balance !== undefined) setConBalance(j.balance);
    });
  }, [session]);

  // 캐스케이드 셀렉트
  useEffect(() => {
    supabase.from('mock_exam_passages').select('year').order('year', { ascending: false })
      .then(({ data }) => {
        const unique = [...new Set((data ?? []).map((r: { year: number }) => r.year))];
        setYears(unique);
      });
  }, []);

  useEffect(() => {
    if (!selectedYear) return;
    setSelectedInstitution(''); setSelectedGrade(''); setSelectedExamName(''); setSelectedNumber(''); setPassageText('');
    supabase.from('mock_exam_passages').select('institution').eq('year', parseInt(selectedYear))
      .then(({ data }) => {
        setInstitutions([...new Set((data ?? []).map((r: { institution: string }) => r.institution))]);
      });
  }, [selectedYear]);

  useEffect(() => {
    if (!selectedYear || !selectedInstitution) return;
    setSelectedGrade(''); setSelectedExamName(''); setSelectedNumber(''); setPassageText('');
    supabase.from('mock_exam_passages').select('grade')
      .eq('year', parseInt(selectedYear)).eq('institution', selectedInstitution)
      .then(({ data }) => {
        setGrades([...new Set((data ?? []).map((r: { grade: string }) => r.grade))]);
      });
  }, [selectedYear, selectedInstitution]);

  useEffect(() => {
    if (!selectedYear || !selectedInstitution || !selectedGrade) return;
    setSelectedExamName(''); setSelectedNumber(''); setPassageText('');
    supabase.from('mock_exam_passages').select('exam_name')
      .eq('year', parseInt(selectedYear)).eq('institution', selectedInstitution)
      .eq('grade', selectedGrade)
      .then(({ data }) => {
        setExamNames([...new Set((data ?? []).map((r: { exam_name: string }) => r.exam_name))]);
      });
  }, [selectedYear, selectedInstitution, selectedGrade]);

  useEffect(() => {
    if (!selectedYear || !selectedInstitution || !selectedGrade || !selectedExamName) return;
    setSelectedNumber(''); setPassageText('');
    supabase.from('mock_exam_passages').select('question_number')
      .eq('year', parseInt(selectedYear)).eq('institution', selectedInstitution)
      .eq('grade', selectedGrade).eq('exam_name', selectedExamName).order('question_number')
      .then(({ data }) => {
        setQuestionNumbers((data ?? []).map((r: { question_number: number }) => r.question_number));
      });
  }, [selectedYear, selectedInstitution, selectedGrade, selectedExamName]);

  useEffect(() => {
    if (!selectedNumber || !selectedYear || !selectedInstitution || !selectedGrade || !selectedExamName) return;
    setPassageLoading(true);
    supabase.from('mock_exam_passages').select('passage_text')
      .eq('year', parseInt(selectedYear)).eq('institution', selectedInstitution)
      .eq('grade', selectedGrade).eq('exam_name', selectedExamName)
      .eq('question_number', parseInt(selectedNumber))
      .single()
      .then(({ data }) => {
        setPassageText(data?.passage_text ?? '');
        setPassageLoading(false);
      });
  }, [selectedNumber, selectedYear, selectedInstitution, selectedGrade, selectedExamName]);

  // 유형 설정 핸들러
  const updateConfig = (id: string, patch: Partial<TypeConfig>) => {
    setTypeConfigs(prev => prev.map(c => c.id === id ? { ...c, ...patch } : c));
  };
  const removeConfig = (id: string) => {
    setTypeConfigs(prev => prev.filter(c => c.id !== id));
  };
  const addCustomConfig = () => {
    setTypeConfigs(prev => [...prev, {
      id: crypto.randomUUID(),
      type: '',
      difficulty: 'b2',
      count: 1,
      enabled: true,
      isCustom: true,
    }]);
  };
  const applyBulk = () => {
    setTypeConfigs(prev => prev.map(c => {
      if (!c.enabled) return c;
      return {
        ...c,
        ...(bulkDifficulty ? { difficulty: bulkDifficulty } : {}),
        ...(bulkCount !== '' ? { count: Math.max(1, Math.min(3, bulkCount)) } : {}),
      };
    }));
  };

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setTypeConfigs(prev => {
        const oldIdx = prev.findIndex(c => c.id === active.id);
        const newIdx = prev.findIndex(c => c.id === over.id);
        return arrayMove(prev, oldIdx, newIdx);
      });
    }
  };

  const validConfigs = typeConfigs.filter(c => c.enabled && c.type !== '');

  // 문제 생성
  const handleGenerate = useCallback(async () => {
    if (!passageText || validConfigs.length === 0 || !session) return;
    setGenerating(true);
    setQuestions([]);
    setRevealedAnswers(new Set());
    setProgress('문제 생성 중...');

    try {
      const typeConfigsPayload = validConfigs.map(cfg => ({
        type: cfg.type,
        difficulty: cfg.difficulty,
        count: cfg.count,
      }));

      const res = await fetch('/api/generate-exam-questions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ text: passageText, typeConfigs: typeConfigsPayload }),
      });

      const json = await res.json() as { questions?: ExamQuestion[]; error?: string };
      if (!res.ok) throw new Error(json.error || '생성 실패');
      setQuestions(json.questions ?? []);
      setProgress(`${json.questions?.length ?? 0}개 문제 생성 완료`);

      fetch('/api/credits/transactions', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      }).then(r => r.json()).then((j: { balance?: number }) => {
        if (j.balance !== undefined) setConBalance(j.balance);
      });
    } catch (e) {
      setProgress(e instanceof Error ? e.message : '생성 오류');
    } finally {
      setGenerating(false);
    }
  }, [passageText, validConfigs, session]);

  // ── 렌더 ─────────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50">
      {/* 헤더 */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-gray-900">📚 모의고사 변형 문제</h1>
          <p className="text-sm text-gray-500 mt-1">수능·평가원·교육청 기출 지문으로 변형 문제를 생성합니다.</p>
        </div>
        {conBalance !== null && (
          <div className="flex items-center gap-1.5 bg-amber-50 border border-amber-200 px-3 py-1.5 rounded-xl">
            <span className="text-xs font-black text-amber-600">CON</span>
            <span className="text-sm font-black text-amber-700">{conBalance.toLocaleString()}</span>
          </div>
        )}
      </div>

      <div className="space-y-6">
        {/* STEP 1: 지문 선택 */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-base font-black text-gray-800 mb-4">STEP 1 — 기출 지문 선택</h2>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4">
            <div>
              <label className="block text-xs font-black text-gray-400 mb-1.5">년도</label>
              <select
                value={selectedYear}
                onChange={e => setSelectedYear(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm font-bold bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300"
              >
                <option value="">선택</option>
                {years.map(y => <option key={y} value={y}>{y}년</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-black text-gray-400 mb-1.5">기관</label>
              <select
                value={selectedInstitution}
                onChange={e => setSelectedInstitution(e.target.value)}
                disabled={!selectedYear}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm font-bold bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300 disabled:opacity-50"
              >
                <option value="">선택</option>
                {institutions.map(i => <option key={i} value={i}>{i}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-black text-gray-400 mb-1.5">학년</label>
              <select
                value={selectedGrade}
                onChange={e => setSelectedGrade(e.target.value)}
                disabled={!selectedInstitution}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm font-bold bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300 disabled:opacity-50"
              >
                <option value="">선택</option>
                {grades.map(g => <option key={g} value={g}>{g}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-black text-gray-400 mb-1.5">시험명</label>
              <select
                value={selectedExamName}
                onChange={e => setSelectedExamName(e.target.value)}
                disabled={!selectedGrade}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm font-bold bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300 disabled:opacity-50"
              >
                <option value="">선택</option>
                {examNames.map(n => <option key={n} value={n}>{n}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-black text-gray-400 mb-1.5">문제 번호</label>
              <select
                value={selectedNumber}
                onChange={e => setSelectedNumber(e.target.value)}
                disabled={!selectedExamName}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm font-bold bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300 disabled:opacity-50"
              >
                <option value="">선택</option>
                {questionNumbers.map(n => <option key={n} value={n}>{n}번</option>)}
              </select>
            </div>
          </div>

          {passageLoading && (
            <p className="text-sm font-bold text-gray-400 animate-pulse">지문 불러오는 중...</p>
          )}
          {passageText && !passageLoading && (
            <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
              <p className="text-xs font-black text-slate-400 mb-2">지문 미리보기</p>
              <p className="text-sm text-slate-700 font-medium leading-relaxed"
                style={{ textAlign: 'justify', wordBreak: 'break-word' }}>
                {passageText}
              </p>
            </div>
          )}
          {!selectedYear && (
            <p className="text-sm text-gray-400 font-medium">년도를 선택하면 기관, 시험명, 문제번호를 차례로 선택할 수 있습니다.</p>
          )}
        </div>

        {/* STEP 2: 문제 유형 설정 */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-black text-gray-800">STEP 2 — 문제 유형 설정</h2>
            <button
              onClick={addCustomConfig}
              className="flex items-center gap-1 px-3 py-1.5 bg-indigo-600 text-white text-xs font-black rounded-xl hover:bg-indigo-700 transition-all"
            >
              + 유형 추가
            </button>
          </div>

          {/* 일괄 설정 바 */}
          <div className="flex items-center justify-end gap-2 mb-3 px-3 py-2.5 bg-gray-50 rounded-xl border border-gray-200">
            <span className="text-xs font-black text-gray-500 flex-shrink-0 mr-1">일괄 설정</span>
            <div className="flex gap-1">
              {DIFF_OPTIONS.map(d => (
                <button
                  key={d.key}
                  onClick={() => setBulkDifficulty(prev => prev === d.key ? '' : d.key)}
                  className={`flex flex-col items-center justify-center w-12 py-1.5 rounded-xl font-black text-[10px] transition-all border-2
                    ${bulkDifficulty === d.key
                      ? d.active
                      : 'border-gray-200 bg-white text-gray-400 hover:border-gray-300 hover:text-gray-600'}`}
                >
                  <span className="text-sm leading-none mb-0.5">{d.icon}</span>
                  <span className="text-[8px] font-bold opacity-60 leading-none mb-0.5">{d.sub}</span>
                  <span>{d.label}</span>
                </button>
              ))}
            </div>
            <div className="flex items-center gap-1 ml-1">
              {[1, 2, 3].map(n => (
                <button key={n}
                  onClick={() => setBulkCount(prev => prev === n ? '' : n)}
                  className={`w-8 h-8 rounded-lg text-xs font-black border-2 transition-all
                    ${bulkCount === n
                      ? 'bg-indigo-600 text-white border-indigo-600'
                      : 'bg-white text-gray-400 border-gray-200 hover:border-gray-300'}`}
                >{n}</button>
              ))}
            </div>
            <button
              onClick={applyBulk}
              disabled={bulkDifficulty === '' && bulkCount === ''}
              className="ml-1 px-3 py-1.5 bg-indigo-600 text-white text-xs font-black rounded-xl hover:bg-indigo-700 disabled:opacity-40 transition-all"
            >
              적용
            </button>
          </div>

          {/* 유형 카드 목록 */}
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={typeConfigs.map(c => c.id)} strategy={verticalListSortingStrategy}>
              <div className="space-y-2">
                {typeConfigs.map(cfg => (
                  <SortableTypeCard
                    key={cfg.id}
                    cfg={cfg}
                    onUpdate={updateConfig}
                    onRemove={removeConfig}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        </div>

        {/* STEP 3: 생성 */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-black text-gray-800">STEP 3 — 문제 생성</h2>
            <div className="text-sm font-bold text-gray-400">
              선택된 유형: {validConfigs.length}가지 / 총 {validConfigs.reduce((s, c) => s + c.count, 0)}문제
            </div>
          </div>

          <button
            onClick={handleGenerate}
            disabled={generating || !passageText || validConfigs.length === 0}
            className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-base rounded-2xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {generating ? '⏳ 생성 중...' : '🎯 문제 생성'}
          </button>

          {!passageText && (
            <p className="text-xs font-bold text-gray-400 mt-2 text-center">STEP 1에서 지문을 먼저 선택하세요</p>
          )}
          {passageText && validConfigs.length === 0 && (
            <p className="text-xs font-bold text-gray-400 mt-2 text-center">STEP 2에서 문제 유형을 선택하세요</p>
          )}

          {progress && (
            <p className={`text-sm font-bold mt-3 text-center ${generating ? 'text-indigo-500 animate-pulse' : 'text-gray-500'}`}>
              {progress}
            </p>
          )}
        </div>

        {/* 생성된 문제 목록 */}
        {questions.length > 0 && (
          <div className="space-y-4">
            <h2 className="text-lg font-black text-gray-900">생성된 문제 ({questions.length}개)</h2>
            {questions.map((q, qi) => {
              const typeOpt = QUESTION_TYPE_OPTIONS.find(o => o.key === q.type);
              const revealed = revealedAnswers.has(qi);
              return (
                <div key={qi} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-black px-2 py-0.5 rounded-lg border ${typeOpt?.color ?? 'bg-gray-100 text-gray-600 border-gray-200'}`}>
                        {typeOpt?.label ?? q.type}
                      </span>
                      <span className="text-sm font-black text-gray-400">문제 {qi + 1}</span>
                    </div>
                    <button
                      onClick={() => setRevealedAnswers(prev => {
                        const next = new Set(prev);
                        if (next.has(qi)) next.delete(qi); else next.add(qi);
                        return next;
                      })}
                      className="text-xs font-black px-3 py-1.5 rounded-xl border border-gray-200 text-gray-500 hover:bg-gray-50 transition-all"
                    >
                      {revealed ? '정답 숨기기' : '정답 보기'}
                    </button>
                  </div>

                  <p className="text-sm font-bold text-gray-800 mb-3 leading-relaxed">
                    {qi + 1}. {q.question_text.split('[주어진 글]')[0].trim()}
                  </p>

                  {q.modified_passage && (
                    <div className="bg-slate-50 rounded-xl p-4 mb-3 border border-slate-200">
                      <p className="text-sm text-slate-700 font-medium leading-relaxed"
                        style={{ textAlign: 'justify', wordBreak: 'break-word' }}>
                        {q.modified_passage}
                      </p>
                    </div>
                  )}

                  <div className="space-y-1.5 mb-3">
                    {q.choices.map((c, ci) => {
                      const isAnswer = c.number === q.answer;
                      return (
                        <div key={ci} className={`flex gap-2 items-start px-3 py-2 rounded-xl transition-all
                          ${revealed && isAnswer ? 'bg-green-50 border border-green-200' : 'border border-transparent'}`}>
                          <span className={`font-black text-sm flex-shrink-0 ${revealed && isAnswer ? 'text-green-700' : 'text-gray-500'}`}>
                            {CIRCLE_NUMS[ci] ?? ci + 1}
                          </span>
                          <span className={`text-sm leading-relaxed ${revealed && isAnswer ? 'font-black text-green-700' : 'font-medium text-gray-700'}`}>
                            {c.text}
                          </span>
                        </div>
                      );
                    })}
                  </div>

                  {revealed && (
                    <div className="bg-blue-50 rounded-xl p-3 border border-blue-100">
                      <p className="text-xs font-black text-blue-600 mb-1">정답: {CIRCLE_NUMS[q.answer - 1] ?? q.answer}번</p>
                      <p className="text-xs font-medium text-blue-700 leading-relaxed">{q.explanation}</p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
