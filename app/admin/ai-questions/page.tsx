'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { generateId } from '@/lib/uuid';
import { supabase } from '@/lib/supabase';
import ConInsufficientModal from '@/components/ConInsufficientModal';
import {
  DndContext, closestCenter, PointerSensor, useSensor, useSensors,
} from '@dnd-kit/core';
import type { DragEndEvent } from '@dnd-kit/core';
import {
  SortableContext, verticalListSortingStrategy, useSortable, arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface ExamChoice {
  number: number;
  text: string;
}

interface ExamQuestion {
  type: string;
  question_text: string;
  modified_passage?: string;
  choices: ExamChoice[];
  answer: number;
  explanation: string;
  _passageText?: string;
  _passageNumber?: number;
}

interface ExamHistoryItem {
  id: string;
  created_at: string;
  title?: string;
  passage_excerpt: string;
  passage_full: string;
  question_types: string[];
  question_pdf_path: string;
  answer_pdf_path?: string;
  difficulty?: string;
}

interface MockExamHistoryItem {
  id: string;
  created_at: string;
  year: number;
  grade: string;
  institution: string;
  question_numbers: number[];
  question_types: string[];
  difficulty: string;
  question_pdf_path: string;
  answer_pdf_path?: string;
}

type UnifiedExamHistoryItem =
  | (ExamHistoryItem & { _source: 'input' })
  | (MockExamHistoryItem & { _source: 'mock' });

interface QuestionTypeOption {
  key: string;
  label: string;
  description: string;
  color: string;
}

interface TypeConfig {
  id: string;
  type: string;
  difficulty: 'b1' | 'b2' | 'c1' | 'c2';
  count: number;    // 1~3
  enabled: boolean;
  isCustom: boolean;
}

const DIFF_OPTIONS = [
  { key: 'b1' as const, label: '하',   sub: 'B1', icon: '🌱', active: 'border-sky-400 bg-sky-50 text-sky-700' },
  { key: 'b2' as const, label: '중',   sub: 'B2', icon: '🌳', active: 'border-emerald-500 bg-emerald-50 text-emerald-700' },
  { key: 'c1' as const, label: '상',   sub: 'C1', icon: '🔥', active: 'border-orange-500 bg-orange-50 text-orange-700' },
  { key: 'c2' as const, label: '최상', sub: 'C2', icon: '⚡', active: 'border-rose-500 bg-rose-50 text-rose-700' },
];

const QUESTION_TYPE_OPTIONS: QuestionTypeOption[] = [
  { key: 'topic_title',      label: '주제/제목 유형',         description: '글의 주제나 제목 파악',             color: 'bg-blue-100 text-blue-700 border-blue-200' },
  { key: 'grammar',          label: '어법 유형',              description: '어법상 틀린 것 찾기 ①~⑤',           color: 'bg-green-100 text-green-700 border-green-200' },
  { key: 'vocab_paraphrase', label: '어휘 - 낱말 쓰임 유형',  description: '문맥상 적절하지 않은 낱말 찾기',     color: 'bg-purple-100 text-purple-700 border-purple-200' },
  { key: 'vocab_blank',      label: '어휘 (a)(b) 빈칸 유형', description: '두 빈칸에 알맞은 어휘 쌍',            color: 'bg-amber-100 text-amber-700 border-amber-200' },
  { key: 'fill_blank',       label: '빈칸 추론 유형',         description: '핵심 빈칸에 들어갈 표현',             color: 'bg-rose-100 text-rose-700 border-rose-200' },
  { key: 'summary',          label: '요약문 완성 유형',       description: '요약문의 (A)(B) 빈칸 완성',          color: 'bg-teal-100 text-teal-700 border-teal-200' },
  { key: 'flow',             label: '흐름 유형',              description: '전체 흐름과 관계 없는 문장 찾기',    color: 'bg-cyan-100 text-cyan-700 border-cyan-200' },
  { key: 'phrase_meaning',   label: '어구 의미 추론 유형',    description: '밑줄 어구의 문맥 속 의미 추론',      color: 'bg-orange-100 text-orange-700 border-orange-200' },
  { key: 'sentence_order',  label: '순서 배열 유형',         description: '글의 순서로 가장 적절한 것은?',       color: 'bg-indigo-100 text-indigo-700 border-indigo-200' },
];

const TYPE_COLOR_MAP: Record<string, string> = {};
QUESTION_TYPE_OPTIONS.forEach(o => { TYPE_COLOR_MAP[o.key] = o.color; });

const TYPE_LABEL_MAP: Record<string, string> = {};
QUESTION_TYPE_OPTIONS.forEach(o => { TYPE_LABEL_MAP[o.key] = o.label; });

const CIRCLE_NUMS = ['①', '②', '③', '④', '⑤'];

// ── SortableTypeCard ─────────────────────────────────────────
function SortableTypeCard({
  cfg,
  onUpdate,
  onRemove,
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
      {/* 드래그 핸들 */}
      <button
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing text-gray-300 hover:text-gray-500 flex-shrink-0 text-lg touch-none select-none"
        tabIndex={-1}
      >
        ⠿
      </button>

      {/* 체크박스 */}
      <input
        type="checkbox"
        checked={cfg.enabled}
        onChange={e => onUpdate(cfg.id, { enabled: e.target.checked })}
        className="w-5 h-5 accent-indigo-600 flex-shrink-0 cursor-pointer"
      />

      {/* 유형명 */}
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

      {/* 난이도 버튼 (이전 버전 스타일) */}
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

      {/* 수량 스피너 */}
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

      {/* 삭제 (추가 행만) */}
      {cfg.isCustom && (
        <button
          onClick={() => onRemove(cfg.id)}
          className="text-red-300 hover:text-red-500 text-base font-black flex-shrink-0 leading-none"
        >✕</button>
      )}
    </div>
  );
}

// 어법/낱말쓰임 지문 속 ①②③④⑤ — 검정 볼드 + 뒤따르는 단어 밑줄
// singleWordOnly=true 이면 선지에서 첫 번째 단어만 추출 (vocab_paraphrase용)
function renderPassageWithCircles(text: string, choices?: ExamChoice[], singleWordOnly?: boolean) {
  const CIRCLES = ['①','②','③','④','⑤'];
  const parts = text.split(/(①|②|③|④|⑤)/g);
  const ulStyle: React.CSSProperties = {textDecoration: 'underline', textDecorationThickness: '2px', textUnderlineOffset: '3px', fontWeight: 700, color: '#111827'};

  return parts.map((part, i) => {
    if (CIRCLES.includes(part)) {
      return <span key={i} style={{fontWeight: 900, color: '#111827'}}>{part}</span>;
    }
    if (i > 0 && CIRCLES.includes(parts[i - 1])) {
      // 우선순위 1: 선지 텍스트로 밑줄 범위 결정
      const circleIdx = CIRCLES.indexOf(parts[i - 1]);
      const rawChoice = choices?.[circleIdx]?.text ?? '';
      const fullChoiceWord = rawChoice.replace(/^[①②③④⑤]\s*/, '').trim();
      // singleWordOnly=true 이면 첫 단어만 사용 (AI가 여러 단어를 반환해도 첫 단어만)
      const choiceWord = singleWordOnly ? (fullChoiceWord.split(/\s+/)[0] ?? fullChoiceWord) : fullChoiceWord;
      if (choiceWord) {
        const escaped = choiceWord
          .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
          .replace(/\s+/g, '\\s+'); // 공백 종류 무관하게 매칭
        const cm = part.match(new RegExp(`^(\\s*)(${escaped})([\\s\\S]*)$`, 'i'));
        if (cm) return <span key={i}>{cm[1]}<span style={ulStyle}>{cm[2]}</span>{cm[3]}</span>;
      }
      // 우선순위 2: [대괄호] 형식
      const bracketM = part.match(/^(\s*)(\[[^\]]+\])([\s\S]*)$/);
      if (bracketM) return <span key={i}>{bracketM[1]}<span style={ulStyle}>{bracketM[2].slice(1, -1)}</span>{bracketM[3]}</span>;
      // 우선순위 3: 첫 단어 fallback
      const m = part.match(/^(\s*)(\S+)([\s\S]*)$/);
      if (m) return <span key={i}>{m[1]}<span style={ulStyle}>{m[2]}</span>{m[3]}</span>;
    }
    return <span key={i}>{part}</span>;
  });
}

// 어법 선지 ① 단어 형식 렌더링 (circle 볼드 + 단어 일반)
function renderGrammarChoice(text: string, isCorrect: boolean, choiceNumber?: number) {
  const m = text.match(/^([①②③④⑤])\s*(.+)$/);
  const color = isCorrect ? '#4338ca' : '#111827';
  const circle = m ? m[1] : (choiceNumber != null ? CIRCLE_NUMS[choiceNumber - 1] : '');
  const word = m ? m[2] : text;
  return (
    <span>
      <span style={{fontWeight: 900, fontSize: '15px', color}}>{circle}</span>
      {' '}
      <span style={{fontWeight: 600, fontSize: '13px', color}}>{word}</span>
    </span>
  );
}

// 어휘 Paraphrase형 [단어] → 밑줄 렌더링 (inline style로 확실히 표시)
function renderWithUnderline(text: string) {
  const parts = text.split(/(\[[^\]]+\])/g);
  return parts.map((part, i) =>
    part.startsWith('[') && part.endsWith(']')
      ? <span key={i} style={{textDecoration: 'underline', textDecorationThickness: '2.5px', textUnderlineOffset: '4px', fontWeight: 900, color: '#111827'}}>{part.slice(1, -1)}</span>
      : <span key={i}>{part}</span>
  );
}

// flow형 지문 — ①~⑤ 인라인 마킹, 줄바꿈 제거하여 단락 흐름으로 표시
function renderFlowPassage(text: string) {
  const CIRCLES = ['①','②','③','④','⑤'];
  // 줄바꿈을 공백으로 통일, ①~⑤ 앞 공백 정리
  const normalized = text.replace(/\n+/g, ' ').replace(/\s*(①|②|③|④|⑤)/g, ' $1').trim();
  const parts = normalized.split(/(①|②|③|④|⑤)/g);
  return parts.map((part, i) => {
    if (CIRCLES.includes(part)) {
      return <span key={i} style={{fontWeight: 900, color: '#7c3aed'}}>{part}</span>;
    }
    return <span key={i}>{part}</span>;
  });
}

// 어휘 (a)(b) 빈칸형 지문 — (a)/(b) 배지 + 밑줄 공간 표시
function renderVocabBlankPassage(text: string) {
  const normalized = text.replace(/\(([ab])\)\s*_+/gi, '($1)');
  const parts = normalized.split(/(\(a\)|\(b\))/gi);
  return parts.map((part, i) => {
    const lower = part.toLowerCase();
    if (lower === '(a)' || lower === '(b)') {
      return (
        <span key={i} style={{display: 'inline-flex', alignItems: 'center', gap: '4px', margin: '0 3px', verticalAlign: 'middle'}}>
          <span style={{fontWeight: 900, color: '#4338ca', background: '#eef2ff', padding: '1px 7px', borderRadius: '5px', fontSize: '13px', lineHeight: '1.6'}}>{lower}</span>
          <span style={{display: 'inline-block', width: '76px', borderBottom: '2px solid #374151', marginBottom: '1px', verticalAlign: 'bottom'}}>&nbsp;</span>
        </span>
      );
    }
    return <span key={i}>{part}</span>;
  });
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

async function generateQuestionPdfBlob(questions: ExamQuestion[], title: string, originalPassage?: string): Promise<Blob | null> {
  const { toJpeg } = await import('html-to-image');
  const { jsPDF } = await import('jspdf');

  const W = 210, M = 8, GAP = 4;
  const colW = (W - 2 * M - GAP) / 2; // ~95mm per column
  const A4_H = 297;
  const BOTTOM = A4_H - M - 8; // bottom content limit
  const RENDER_W = 360; // px width — matches PDF column (~95mm at 96dpi)

  const pdf = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });

  const esc = (s: string | null | undefined) =>
    (s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br/>');

  // 지문 전용: \n을 공백으로 치환하여 자연스러운 텍스트 흐름 유지
  const escP = (s: string | null | undefined) =>
    (s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n+/g, ' ').replace(/\s+/g, ' ').trim();

  const escGrammar = (s: string | null | undefined, choices?: ExamChoice[], singleWord?: boolean) => {
    const CG = ['①','②','③','④','⑤'];
    const raw = s ?? '';
    const parts = raw.split(/(①|②|③|④|⑤)/g);
    const ul = (w: string) => `<span style="text-decoration:underline;text-decoration-thickness:2px;text-underline-offset:3px;font-weight:700;color:#111827;">${w}</span>`;
    const cc = (c: string) => `<span style="font-weight:900;color:#111827;">${c}</span>`;
    const ss = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n+/g, ' ');
    return parts.map((part, i) => {
      if (CG.includes(part)) return cc(part);
      const safe = ss(part);
      if (i > 0 && CG.includes(parts[i - 1])) {
        const ci = CG.indexOf(parts[i - 1]);
        const fullCw = ss((choices?.[ci]?.text ?? '').replace(/^[①②③④⑤]\s*/, '').trim());
        // singleWord=true 이면 첫 단어만 사용
        const cw = singleWord ? (fullCw.split(/\s+/)[0] ?? fullCw) : fullCw;
        if (cw) {
          const cwEsc = cw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+');
          const cm = safe.match(new RegExp(`^(\\s*)(${cwEsc})(\\s|[^\\w]|$)([\\s\\S]*)$`, 'i'));
          if (cm) return `${cm[1]}${ul(cm[2])}${cm[3]}${cm[4]}`;
        }
        const bm = safe.match(/^(\s*)(\[[^\]]+\])([\s\S]*)$/);
        if (bm) return `${bm[1]}${ul(bm[2].slice(1, -1))}${bm[3]}`;
        const m = safe.match(/^(\s*)(\S+)([\s\S]*)$/);
        if (m) return `${m[1]}${ul(m[2])}${m[3]}`;
      }
      return safe;
    }).join('');
  };

  const escFlow = (s: string | null | undefined) => {
    const CG = ['①','②','③','④','⑤'];
    const raw = s ?? '';
    const parts = raw.split(/(①|②|③|④|⑤)/g);
    const ss = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n+/g, ' ');
    return parts.map(part =>
      CG.includes(part)
        ? `<span style="font-weight:900;color:#7c3aed;">${part}</span>`
        : ss(part)
    ).join('');
  };

  const escWithUnderline = (s: string | null | undefined) => {
    const raw = s ?? '';
    const parts = raw.split(/(\[[^\]]+\])/g);
    const ss = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n+/g, ' ');
    return parts.map(part =>
      part.startsWith('[') && part.endsWith(']')
        ? `<span style="text-decoration:underline;text-decoration-thickness:2px;text-underline-offset:3px;font-weight:700;color:#111827;">${ss(part.slice(1, -1))}</span>`
        : ss(part)
    ).join('');
  };

  const escVocabBlank = (s: string | null | undefined) => {
    const raw = (s ?? '').replace(/\(([ab])\)\s*_+/gi, '($1)');
    const parts = raw.split(/(\(a\)|\(b\))/gi);
    const ss = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n+/g, ' ');
    return parts.map(part => {
      const lower = part.toLowerCase();
      if (lower === '(a)' || lower === '(b)') {
        return `<span style="display:inline-block;border-bottom:2.5px solid #374151;min-width:82px;text-align:center;font-weight:900;color:#4338ca;font-size:12px;margin:0 3px;vertical-align:bottom;padding-bottom:1px;">${lower}</span>`;
      }
      return ss(part);
    }).join('');
  };

  const passageBox = (content: string) =>
    `<div style="background:#f8fafc;border:1px solid #cbd5e1;border-radius:4px;padding:6px 8px;margin-bottom:7px;font-size:13px;line-height:1.65;color:#1e293b;text-align:justify;word-break:break-word;">${content}</div>`;
  const instrP = (content: string) =>
    `<p style="font-size:13px;font-weight:700;color:#1e293b;margin:0 0 5px;line-height:1.5;white-space:pre-wrap;">${content}</p>`;

  const buildHtml = (q: ExamQuestion, num: number) => {
    const typeLabel = TYPE_LABEL_MAP[q.type] || q.type;
    let html = `<div style="font-size:9px;font-weight:700;color:#64748b;background:#f1f5f9;padding:1px 6px;border-radius:3px;display:inline-block;margin-bottom:4px;">${esc(typeLabel)}</div>\n`;

    if (q.type === 'vocab_paraphrase') {
      html += instrP(`${num}. ${esc(q.question_text)}`);
      if (q.modified_passage) html += passageBox(escGrammar(q.modified_passage, q.choices, true));
    } else if (q.type === 'summary') {
      const pts = q.question_text.split('\n\n');
      const instr = pts[0]?.trim() || '';
      const sumText = pts.slice(1).join('\n\n').replace(/^\[요약문\]\s*/i, '').trim();
      html += instrP(`${num}. ${esc(instr)}`);
      if (originalPassage) html += passageBox(escP(originalPassage));
      if (sumText) {
        html += `<div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;padding:10px;margin-bottom:10px;">`;
        html += `<div style="font-size:10px;font-weight:700;color:#94a3b8;margin-bottom:4px;">[요약문]</div>`;
        html += `<div style="font-size:12px;line-height:1.8;color:#334155;">${escP(sumText)}</div></div>`;
      }
    } else if (q.type === 'topic_title' && originalPassage) {
      html += instrP(`${num}. ${esc(q.question_text)}`);
      html += passageBox(escP(originalPassage));
    } else if (q.modified_passage && q.type === 'grammar') {
      html += instrP(`${num}. ${esc(q.question_text)}`);
      html += passageBox(escGrammar(q.modified_passage.replace(/\[([^\]]+)\]/g, '$1'), q.choices));
    } else if (q.modified_passage && q.type === 'flow') {
      html += instrP(`${num}. ${esc(q.question_text)}`);
      html += passageBox(escFlow(q.modified_passage));
    } else if (q.modified_passage && q.type === 'phrase_meaning') {
      html += instrP(`${num}. ${esc(q.question_text)}`);
      html += passageBox(escWithUnderline(q.modified_passage));
    } else if (q.modified_passage && q.type === 'vocab_blank') {
      html += instrP(`${num}. ${esc(q.question_text)}`);
      html += passageBox(escVocabBlank(q.modified_passage));
    } else if (q.type === 'sentence_order') {
      const soInstruction = q.question_text.split('[주어진 글]')[0].trim();
      html += instrP(`${num}. ${esc(soInstruction)}`);
      const passage = q.modified_passage || q.question_text;
      const givenM = passage.match(/\[주어진 글\]\s*([\s\S]*?)(?=\(A\))/);
      const aM = passage.match(/\(A\)\s*([\s\S]*?)(?=\(B\))/);
      const bM = passage.match(/\(B\)\s*([\s\S]*?)(?=\(C\))/);
      const cM = passage.match(/\(C\)\s*([\s\S]*?)$/);
      if (givenM) html += `<div style="background:#f8fafc;border:1px solid #cbd5e1;border-radius:4px;padding:5px 8px;margin-bottom:5px;width:100%;box-sizing:border-box;"><div style="font-size:9px;font-weight:900;color:#94a3b8;margin-bottom:2px;">[주어진 글]</div><div style="font-size:12px;line-height:1.6;color:#1e293b;text-align:justify;word-break:break-word;">${escP(givenM[1].trim())}</div></div>`;
      for (const [lbl, m] of [['A', aM], ['B', bM], ['C', cM]] as [string, RegExpMatchArray | null][]) {
        if (m) html += `<div style="background:#ffffff;border:1px solid #e2e8f0;border-radius:4px;padding:5px 8px;margin-bottom:5px;width:100%;box-sizing:border-box;"><div style="font-size:9px;font-weight:900;color:#6366f1;margin-bottom:2px;">(${lbl})</div><div style="font-size:12px;line-height:1.6;color:#1e293b;text-align:justify;word-break:break-word;">${escP(m[1].trim())}</div></div>`;
      }
    } else if (q.modified_passage) {
      html += instrP(`${num}. ${esc(q.question_text)}`);
      html += passageBox(escP(q.modified_passage));
    } else {
      html += instrP(`${num}. ${esc(q.question_text)}`);
    }

    if (q.type !== 'flow' && q.type !== 'grammar') {
      html += `<div style="display:flex;flex-direction:column;gap:3px;">`;
      for (let j = 0; j < q.choices.length; j++) {
        const c = q.choices[j];
        if (q.type === 'vocab_paraphrase') {
          const gm = c.text.match(/^([①②③④⑤])\s*(.+)$/);
          const ch = gm ? gm[1] : (CIRCLE_NUMS[c.number - 1] ?? '');
          const wd = gm ? gm[2] : c.text;
          html += `<div style="display:flex;gap:4px;align-items:center;"><span style="font-size:12px;font-weight:900;color:#111827;">${esc(ch)}</span><span style="font-size:13px;font-weight:600;color:#1f2937;">${esc(wd)}</span></div>`;
        } else if (q.type === 'sentence_order') {
          html += `<div style="font-size:13px;color:#1e293b;line-height:1.55;">${esc(c.text)}</div>`;
        } else {
          html += `<div style="display:flex;gap:4px;align-items:flex-start;"><span style="font-weight:900;color:#475569;flex-shrink:0;min-width:14px;font-size:13px;">${CIRCLE_NUMS[j] ?? (j+1)}</span><span style="font-size:13px;color:#1e293b;line-height:1.55;">${esc(c.text)}</span></div>`;
        }
      }
      html += `</div>`;
    }
    return html;
  };

  // Layout state
  let leftY = M, rightY = M;
  let currentCol: 'left' | 'right' = 'left';
  let pageNum = 1;
  let lineTopY = M;

  const finalizePage = () => {
    pdf.setDrawColor(200, 200, 200);
    pdf.setLineWidth(0.3);
    pdf.line(M + colW + GAP / 2, lineTopY, M + colW + GAP / 2, BOTTOM + 5);
    pdf.setFontSize(9);
    pdf.setTextColor(150, 150, 150);
    pdf.text(`— ${pageNum} —`, W / 2, A4_H - 7, { align: 'center' });
  };

  const placeImage = (url: string, h_mm: number) => {
    if (currentCol === 'left') {
      if (leftY + h_mm <= BOTTOM) {
        pdf.addImage(url, 'JPEG', M, leftY, colW, h_mm);
        leftY += h_mm + 2;
        return;
      }
      currentCol = 'right';
    }
    if (currentCol === 'right') {
      if (rightY + h_mm <= BOTTOM) {
        pdf.addImage(url, 'JPEG', M + colW + GAP, rightY, colW, h_mm);
        rightY += h_mm + 2;
        return;
      }
      finalizePage();
      pdf.addPage();
      pageNum++;
      leftY = M; rightY = M; currentCol = 'left';
      lineTopY = M;
      pdf.addImage(url, 'JPEG', M, leftY, colW, h_mm);
      leftY += h_mm + 2;
    }
  };

  const renderEl = async (html: string, w: number, padding: number) => {
    const el = document.createElement('div');
    el.style.cssText = `position:fixed;top:0;left:0;width:${w}px;background:white;padding:${padding}px;box-sizing:border-box;font-family:'Malgun Gothic',Arial,Helvetica,sans-serif;z-index:-9999;`;
    el.innerHTML = html;
    document.body.appendChild(el);
    await new Promise(r => requestAnimationFrame(r));
    await new Promise(r => requestAnimationFrame(r));
    const ratio = el.scrollHeight / el.offsetWidth;
    const url = await toJpeg(el, { pixelRatio: 2, quality: 0.92, backgroundColor: '#ffffff', cacheBust: true });
    document.body.removeChild(el);
    return { url, ratio };
  };

  // Title spanning both columns
  if (title) {
    const { url: titleUrl, ratio: titleRatio } = await renderEl(
      `<div style="text-align:center;border-bottom:2px solid #334155;padding-bottom:6px;margin-bottom:2px;">
        <div style="font-size:14px;font-weight:900;color:#1e293b;letter-spacing:-0.3px;">${esc(title)}</div>
      </div>`,
      760, 8
    );
    const fullW = W - 2 * M;
    const titleMmH = fullW * titleRatio;
    pdf.addImage(titleUrl, 'JPEG', M, M, fullW, titleMmH);
    leftY = M + titleMmH + 3;
    rightY = leftY;
    lineTopY = leftY;
  }

  // Questions in 2-column layout
  for (let i = 0; i < questions.length; i++) {
    const { url, ratio } = await renderEl(buildHtml(questions[i], i + 1), RENDER_W, 6);
    placeImage(url, colW * ratio);
  }

  finalizePage();
  return pdf.output('blob');
}

async function buildAnswerPdfBlob(questions: ExamQuestion[], title: string): Promise<Blob> {
  const { toJpeg } = await import('html-to-image');
  const { jsPDF } = await import('jspdf');

  const W = 210, M = 8, GAP = 4;
  const colW = (W - 2 * M - GAP) / 2;
  const A4_H = 297;
  const BOTTOM = A4_H - M - 8;
  const RENDER_W = 400;

  const pdf = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });

  const esc = (s: string | null | undefined) =>
    (s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br/>');

  let leftY = M, rightY = M;
  let currentCol: 'left' | 'right' = 'left';
  let pageNum = 1;
  let lineTopY = M;

  const finalizePage = () => {
    pdf.setDrawColor(200, 200, 200);
    pdf.setLineWidth(0.3);
    pdf.line(M + colW + GAP / 2, lineTopY, M + colW + GAP / 2, BOTTOM + 5);
    pdf.setFontSize(9);
    pdf.setTextColor(150, 150, 150);
    pdf.text(`— ${pageNum} —`, W / 2, A4_H - 7, { align: 'center' });
  };

  const placeImage = (url: string, h_mm: number) => {
    if (currentCol === 'left') {
      if (leftY + h_mm <= BOTTOM) {
        pdf.addImage(url, 'JPEG', M, leftY, colW, h_mm);
        leftY += h_mm + 2;
        return;
      }
      currentCol = 'right';
    }
    if (currentCol === 'right') {
      if (rightY + h_mm <= BOTTOM) {
        pdf.addImage(url, 'JPEG', M + colW + GAP, rightY, colW, h_mm);
        rightY += h_mm + 2;
        return;
      }
      finalizePage();
      pdf.addPage();
      pageNum++;
      leftY = M; rightY = M; currentCol = 'left';
      lineTopY = M;
      pdf.addImage(url, 'JPEG', M, leftY, colW, h_mm);
      leftY += h_mm + 2;
    }
  };

  const renderEl = async (html: string, w: number, padding: number) => {
    const el = document.createElement('div');
    el.style.cssText = `position:fixed;top:0;left:0;width:${w}px;background:white;padding:${padding}px;box-sizing:border-box;font-family:'Malgun Gothic',Arial,Helvetica,sans-serif;z-index:-9999;`;
    el.innerHTML = html;
    document.body.appendChild(el);
    await new Promise(r => requestAnimationFrame(r));
    await new Promise(r => requestAnimationFrame(r));
    const ratio = el.scrollHeight / el.offsetWidth;
    const url = await toJpeg(el, { pixelRatio: 2, quality: 0.92, backgroundColor: '#ffffff', cacheBust: true });
    document.body.removeChild(el);
    return { url, ratio };
  };

  // Title spanning both columns
  if (title) {
    const { url: titleUrl, ratio: titleRatio } = await renderEl(
      `<div style="text-align:center;border-bottom:2px solid #334155;padding-bottom:6px;margin-bottom:2px;">
        <div style="font-size:14px;font-weight:900;color:#1e293b;letter-spacing:-0.3px;">${esc(title)} — 정답 및 해설</div>
      </div>`,
      760, 8
    );
    const fullW = W - 2 * M;
    const titleMmH = fullW * titleRatio;
    pdf.addImage(titleUrl, 'JPEG', M, M, fullW, titleMmH);
    leftY = M + titleMmH + 3;
    rightY = leftY;
    lineTopY = leftY;
  }

  // Answer blocks per question
  for (let i = 0; i < questions.length; i++) {
    const q = questions[i];
    const typeLabel = TYPE_LABEL_MAP[q.type] || q.type;
    const answerCircle = (q.type === 'grammar' || q.type === 'vocab_paraphrase' || q.type === 'flow')
      ? CIRCLE_NUMS[q.answer - 1]
      : `${q.answer}번`;

    let html = `<div style="border-left:3px solid #4338ca;padding:6px 8px;border-radius:0 4px 4px 0;background:#fafafa;">`;
    html += `<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:5px;">`;
    html += `<div style="display:flex;align-items:center;gap:6px;">`;
    html += `<span style="font-size:11px;font-weight:900;color:#1e293b;">${i + 1}번</span>`;
    html += `<span style="font-size:9px;font-weight:700;padding:1px 5px;border-radius:3px;background:#e0e7ff;color:#4338ca;">${esc(typeLabel)}</span>`;
    html += `</div>`;
    html += `<span style="font-size:11px;font-weight:900;color:#7c3aed;">정답 ${answerCircle}</span>`;
    html += `</div>`;

    if (q.type === 'summary') {
      const pts = q.question_text.split('\n\n');
      const sumText = pts.slice(1).join('\n\n').replace(/^\[요약문\]\s*/i, '').trim();
      if (sumText) {
        html += `<div style="font-size:9px;color:#475569;margin-bottom:6px;padding:5px 7px;background:#f0f4ff;border-radius:3px;line-height:1.6;border:1px solid #c7d2fe;">${esc(sumText)}</div>`;
      }
    }

    html += `<p style="font-size:9.5px;color:#374151;line-height:1.65;margin:0;">${esc(q.explanation)}</p>`;
    html += `</div>`;

    const { url, ratio } = await renderEl(html, RENDER_W, 6);
    placeImage(url, colW * ratio);
  }

  finalizePage();
  return pdf.output('blob');
}

export default function AiQuestionsPage() {
  const [activeMainTab, setActiveMainTab] = useState<'input' | 'mock' | 'history'>('input');
  const [inputSubTab, setInputSubTab] = useState<'generate' | 'bulk'>('generate');
  const [inputMode, setInputMode] = useState<'text' | 'image'>('text');

  const [manualText, setManualText] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [ocrText, setOcrText] = useState('');
  const [ocrLoading, setOcrLoading] = useState(false);
  const [ocrDone, setOcrDone] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [pdfTitle, setPdfTitle] = useState('');

  // 다중 지문 (지문 1은 기존 manualText/ocrText, 추가 지문은 extraPassages)
  interface ExtraPassage { text: string; mode: 'text' | 'image'; ocrText: string; ocrDone: boolean; ocrLoading: boolean; imageFile: File | null; imagePreview: string | null; }
  const [extraPassages, setExtraPassages] = useState<ExtraPassage[]>([]);
  const [pdfLayout, setPdfLayout] = useState<'passage' | 'type' | 'random'>('passage');
  const [pdfSortedQuestions, setPdfSortedQuestions] = useState<ExamQuestion[]>([]);

  const [typeConfigs, setTypeConfigs] = useState<TypeConfig[]>(() =>
    QUESTION_TYPE_OPTIONS.map(o => ({
      id: generateId(),
      type: o.key,
      difficulty: 'b2' as const,
      count: 1,
      enabled: true,
      isCustom: false,
    }))
  );
  const [bulkDifficulty, setBulkDifficulty] = useState<'b1' | 'b2' | 'c1' | 'c2' | ''>('');
  const [bulkCount, setBulkCount] = useState<number | ''>(1);

  // ── 대량 생성 상태 ──
  const [bulkTexts, setBulkTexts] = useState<string[]>(['', '']);
  const [bulkTitles, setBulkTitles] = useState<string[]>(['', '']);
  const [bulkProgress, setBulkProgress] = useState<
    Array<{ status: 'idle' | 'loading' | 'success' | 'error'; message?: string }>
  >([{ status: 'idle' }, { status: 'idle' }]);
  const [bulkLoading, setBulkLoading] = useState(false);

  const [loading, setLoading] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState('');
  const [questions, setQuestions] = useState<ExamQuestion[] | null>(null);
  const [originalPassageText, setOriginalPassageText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [revealedAnswers, setRevealedAnswers] = useState<Set<number>>(new Set());
  const [pdfLoading, setPdfLoading] = useState<false | '문제' | '답안'>(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'done' | 'error'>('idle');
  const [saveErrorMsg, setSaveErrorMsg] = useState('');
  const msgIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── 모의고사 탭 state ──
  const [mockSession, setMockSession] = useState<{ user: { id: string }; access_token: string } | null>(null);
  const [mockYears, setMockYears] = useState<number[]>([]);
  const [mockGrades, setMockGrades] = useState<string[]>([]);
  const [mockInstitutions, setMockInstitutions] = useState<string[]>([]);
  const [mockQuestionNumbers, setMockQuestionNumbers] = useState<number[]>([]);
  const [mockSelectedYear, setMockSelectedYear] = useState('');
  const [mockSelectedGrade, setMockSelectedGrade] = useState('');
  const [mockSelectedInstitution, setMockSelectedInstitution] = useState('');
  const [mockSelectedNumbers, setMockSelectedNumbers] = useState<string[]>([]);
  const [mockPassageMap, setMockPassageMap] = useState<Record<string, string>>({});
  const [mockLoadingNumbers, setMockLoadingNumbers] = useState<Set<string>>(new Set());
  const [mockQuestions, setMockQuestions] = useState<ExamQuestion[]>([]);
  const [mockPdfTitle, setMockPdfTitle] = useState('');
  const [mockGenerating, setMockGenerating] = useState(false);
  const [mockProgress, setMockProgress] = useState('');
  const [mockRevealedAnswers, setMockRevealedAnswers] = useState<Set<number>>(new Set());
  const [mockPdfLayout, setMockPdfLayout] = useState<'passage' | 'type' | 'random'>('passage');
  const [mockPdfSortedQuestions, setMockPdfSortedQuestions] = useState<ExamQuestion[]>([]);
  const [mockPdfLoading, setMockPdfLoading] = useState<false | '문제' | '답안'>(false);
  const [mockAutoSaveStatus, setMockAutoSaveStatus] = useState<'idle' | 'saving' | 'done' | 'error'>('idle');

  const [historyList, setHistoryList] = useState<UnifiedExamHistoryItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);

  const [userId, setUserId] = useState('');
  const [aiPrice, setAiPrice] = useState<number | null>(null);
  const [conModal, setConModal] = useState<{ required: number; balance: number } | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchDate, setSearchDate] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkDownloading, setBulkDownloading] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [passageModal, setPassageModal] = useState<{ title: string; text: string } | null>(null);
  const [questionRatings, setQuestionRatings] = useState<Record<string, 'good' | 'bad' | null>>({});
  const [mockQuestionRatings, setMockQuestionRatings] = useState<Record<string, 'good' | 'bad' | null>>({});
  const [ratingHistoryId, setRatingHistoryId] = useState<string | null>(null);
  const [mockRatingHistoryId, setMockRatingHistoryId] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const textToSend = inputMode === 'text' ? manualText : ocrText;

  // 세션 + AI 단가 로드
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user?.id) setUserId(session.user.id);
      if (session) setMockSession(session as typeof mockSession);
    });
    fetch('/api/credits/pricing')
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        const ai = (data?.pricing ?? []).find((p: { feature_key: string; cost_per_use: number }) => p.feature_key === 'ai_question_per_type');
        if (ai) setAiPrice(ai.cost_per_use);
      })
      .catch(() => {});
  }, []);

  // ── 이력 조회 ──
  const fetchHistory = useCallback(async (query = searchQuery, date = searchDate) => {
    setHistoryLoading(true);
    setHistoryError(null);
    try {
      await fetch('/api/cleanup-old-history', { method: 'POST' });
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setHistoryError('로그인 정보를 확인할 수 없습니다.'); return; }

      let qInput = supabase
        .from('exam_question_history')
        .select('*')
        .eq('academy_id', user.id)
        .order('created_at', { ascending: false });
      let qMock = supabase
        .from('mock_exam_question_history')
        .select('*')
        .eq('academy_id', user.id)
        .order('created_at', { ascending: false });

      if (date) {
        qInput = qInput.gte('created_at', date).lte('created_at', date + 'T23:59:59');
        qMock = qMock.gte('created_at', date).lte('created_at', date + 'T23:59:59');
      }
      if (query) {
        qInput = qInput.ilike('passage_full', `%${query}%`);
        qMock = qMock.ilike('institution', `%${query}%`);
      }

      const [{ data: inputData, error: inputErr }, { data: mockData, error: mockErr }] = await Promise.all([qInput, qMock]);
      if (inputErr) { setHistoryError(`조회 오류: ${inputErr.message}`); return; }
      if (mockErr) { setHistoryError(`조회 오류: ${mockErr.message}`); return; }

      const combined: UnifiedExamHistoryItem[] = [
        ...(inputData ?? []).map((r: ExamHistoryItem) => ({ ...r, _source: 'input' as const })),
        ...(mockData ?? []).map((r: MockExamHistoryItem) => ({ ...r, _source: 'mock' as const })),
      ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      setHistoryList(combined);
    } catch (e) {
      setHistoryError(e instanceof Error ? e.message : '알 수 없는 오류');
    } finally {
      setHistoryLoading(false);
    }
  }, [searchQuery, searchDate]);

  useEffect(() => {
    if (activeMainTab === 'history') fetchHistory();
  }, [activeMainTab]);

  // ── 모의고사 cascade useEffects ──
  useEffect(() => {
    supabase.from('mock_exam_passages').select('year').order('year', { ascending: false })
      .then(({ data }) => { setMockYears([...new Set((data ?? []).map((r: { year: number }) => r.year))]); });
  }, []);

  useEffect(() => {
    if (!mockSelectedYear) return;
    setMockSelectedGrade(''); setMockSelectedInstitution(''); setMockSelectedNumbers([]); setMockPassageMap({}); setMockLoadingNumbers(new Set());
    supabase.from('mock_exam_passages').select('grade').eq('year', parseInt(mockSelectedYear)).order('grade', { ascending: true })
      .then(({ data }) => { setMockGrades([...new Set((data ?? []).map((r: { grade: string }) => r.grade))]); });
  }, [mockSelectedYear]);

  useEffect(() => {
    if (!mockSelectedYear || !mockSelectedGrade) return;
    setMockSelectedInstitution(''); setMockSelectedNumbers([]); setMockPassageMap({}); setMockLoadingNumbers(new Set());
    supabase.from('mock_exam_passages').select('institution').eq('year', parseInt(mockSelectedYear)).eq('grade', mockSelectedGrade).order('institution', { ascending: true })
      .then(({ data }) => {
        const unique = [...new Set((data ?? []).map((r: { institution: string }) => r.institution))];
        unique.sort((a, b) => {
          const ma = parseInt(a.match(/^(\d+)/)?.[1] ?? '99');
          const mb = parseInt(b.match(/^(\d+)/)?.[1] ?? '99');
          return ma - mb;
        });
        setMockInstitutions(unique);
      });
  }, [mockSelectedYear, mockSelectedGrade]);

  useEffect(() => {
    if (!mockSelectedYear || !mockSelectedGrade || !mockSelectedInstitution) return;
    setMockSelectedNumbers([]); setMockPassageMap({}); setMockLoadingNumbers(new Set());
    supabase.from('mock_exam_passages').select('question_number').eq('year', parseInt(mockSelectedYear)).eq('grade', mockSelectedGrade).eq('institution', mockSelectedInstitution).order('question_number')
      .then(({ data }) => { setMockQuestionNumbers((data ?? []).map((r: { question_number: number }) => r.question_number)); });
  }, [mockSelectedYear, mockSelectedGrade, mockSelectedInstitution]);

  // ── 이미지 처리 ──
  const handleImageFile = (file: File) => {
    setImageFile(file);
    const reader = new FileReader();
    reader.onloadend = () => setImagePreview(reader.result as string);
    reader.readAsDataURL(file);
    setOcrText('');
    setOcrDone(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) handleImageFile(file);
  };

  // ── OCR ──
  const runOcr = async () => {
    if (!imageFile) return;
    setOcrLoading(true);
    setOcrText('');
    setOcrDone(false);
    try {
      const formData = new FormData();
      formData.append('image', imageFile);
      const res = await fetch('/api/ocr', { method: 'POST', body: formData });
      const json = await res.json() as { text?: string; error?: string };
      if (!res.ok) throw new Error(json.error || 'OCR 실패');
      setOcrText(json.text || '');
      setOcrDone(true);
    } catch (e) {
      alert(e instanceof Error ? e.message : 'OCR 오류');
    } finally {
      setOcrLoading(false);
    }
  };

  // ── TypeConfig 핸들러 ──
  const updateConfig = (id: string, patch: Partial<TypeConfig>) => {
    setTypeConfigs(prev => prev.map(c => c.id === id ? { ...c, ...patch } : c));
  };
  const removeConfig = (id: string) => {
    setTypeConfigs(prev => prev.filter(c => c.id !== id));
  };
  const addCustomConfig = () => {
    setTypeConfigs(prev => [...prev, {
      id: generateId(),
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

  // pdfSortedQuestions 초기화 (questions 또는 pdfLayout 변경 시)
  useEffect(() => { setPdfSortedQuestions([]); }, [questions, pdfLayout]);
  useEffect(() => { setMockPdfSortedQuestions([]); }, [mockQuestions, mockPdfLayout]);

  const sortQuestionsForPdf = useCallback((qs: ExamQuestion[]): ExamQuestion[] => {
    if (pdfLayout === 'passage') return [...qs];
    if (pdfLayout === 'type') {
      const typeOrder = typeConfigs.filter(c => c.enabled && c.type).map(c => c.type);
      return [...qs].sort((a, b) => {
        const ai = typeOrder.indexOf(a.type); const bi = typeOrder.indexOf(b.type);
        const safeA = ai === -1 ? 999 : ai; const safeB = bi === -1 ? 999 : bi;
        if (safeA !== safeB) return safeA - safeB;
        return (a._passageNumber ?? 0) - (b._passageNumber ?? 0);
      });
    }
    const arr = [...qs];
    for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; }
    return arr;
  }, [pdfLayout, typeConfigs]);

  // ── 모의고사 탭 함수 ──
  const toggleMockNumber = async (num: string) => {
    if (mockSelectedNumbers.includes(num)) {
      setMockSelectedNumbers(prev => prev.filter(n => n !== num));
      setMockPassageMap(prev => { const next = { ...prev }; delete next[num]; return next; });
    } else {
      setMockSelectedNumbers(prev => [...prev, num]);
      setMockLoadingNumbers(prev => new Set([...prev, num]));
      const { data } = await supabase.from('mock_exam_passages').select('passage_text')
        .eq('year', parseInt(mockSelectedYear)).eq('grade', mockSelectedGrade).eq('institution', mockSelectedInstitution)
        .eq('question_number', parseInt(num)).single();
      setMockPassageMap(prev => ({ ...prev, [num]: data?.passage_text ?? '' }));
      setMockLoadingNumbers(prev => { const next = new Set(prev); next.delete(num); return next; });
    }
  };

  const mockSortedSelectedNumbers = [...mockSelectedNumbers].sort((a, b) => parseInt(a) - parseInt(b));
  const mockAllPassagesReady = mockSelectedNumbers.length > 0 && mockSelectedNumbers.every(n => mockPassageMap[n]) && mockLoadingNumbers.size === 0;

  const mockSortQuestionsForPdf = (qs: ExamQuestion[]): ExamQuestion[] => {
    if (mockPdfLayout === 'passage') return [...qs];
    if (mockPdfLayout === 'type') {
      const typeOrder = typeConfigs.filter(c => c.enabled && c.type).map(c => c.type);
      return [...qs].sort((a, b) => {
        const ai = typeOrder.indexOf(a.type); const bi = typeOrder.indexOf(b.type);
        const safeA = ai === -1 ? 999 : ai; const safeB = bi === -1 ? 999 : bi;
        if (safeA !== safeB) return safeA - safeB;
        return (a._passageNumber ?? 0) - (b._passageNumber ?? 0);
      });
    }
    const arr = [...qs];
    for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; }
    return arr;
  };

  const autoSaveMockExamHistory = async (qs: ExamQuestion[], sess: typeof mockSession) => {
    if (!sess || qs.length === 0 || !mockSelectedYear || !mockSelectedGrade || !mockSelectedInstitution) return;
    setMockAutoSaveStatus('saving');
    try {
      const urlRes = await fetch('/api/storage/get-upload-urls', { method: 'POST', headers: { Authorization: `Bearer ${sess.access_token}` } });
      if (!urlRes.ok) throw new Error('URL 생성 실패');
      const { question: qUrl, answer: aUrl } = await urlRes.json() as {
        question: { path: string; signedUrl: string; token: string };
        answer: { path: string; signedUrl: string; token: string } | null;
      };
      const [qBlob, aBlob] = await Promise.all([
        generateQuestionPdfBlob(qs, mockPdfTitle.trim()),
        buildAnswerPdfBlob(qs, mockPdfTitle.trim()),
      ]);
      if (!qBlob) throw new Error('PDF 생성 실패');
      await supabase.storage.from('pdf-history').uploadToSignedUrl(qUrl.path, qUrl.token, qBlob, { contentType: 'application/pdf' });
      if (aUrl && aBlob) await supabase.storage.from('pdf-history').uploadToSignedUrl(aUrl.path, aUrl.token, aBlob, { contentType: 'application/pdf' });
      const difficultyLabel = [...new Set(validConfigs.map(c => c.difficulty))].join(',');
      const res = await fetch('/api/save-mock-exam-question-history', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sess.access_token}` },
        body: JSON.stringify({
          questionPdfPath: qUrl.path,
          answerPdfPath: aUrl?.path ?? null,
          year: parseInt(mockSelectedYear),
          grade: mockSelectedGrade,
          institution: mockSelectedInstitution,
          questionNumbers: mockSortedSelectedNumbers.map(n => parseInt(n)),
          questionTypes: [...new Set(qs.map(q => q.type))],
          difficulty: difficultyLabel,
        }),
      });
      if (res.ok) {
        const saveJson = await res.json().catch(() => ({})) as { id?: string };
        setMockAutoSaveStatus('done');
        if (saveJson.id) setMockRatingHistoryId(saveJson.id);
        setMockQuestionRatings({});
      } else {
        setMockAutoSaveStatus('error');
      }
    } catch { setMockAutoSaveStatus('error'); }
  };

  const handleMockGenerate = async () => {
    if (!mockAllPassagesReady || validConfigs.length === 0 || !mockSession) return;
    setMockGenerating(true); setMockQuestions([]); setMockRevealedAnswers(new Set()); setMockAutoSaveStatus('idle');
    const allQuestions: ExamQuestion[] = [];
    for (const num of mockSortedSelectedNumbers) {
      const text = mockPassageMap[num];
      if (!text) continue;
      setMockProgress(`${num}번 지문 문제 생성 중...`);
      try {
        const res = await fetch('/api/generate-exam-questions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${mockSession.access_token}` },
          body: JSON.stringify({ text, typeConfigs: validConfigs.map(c => ({ type: c.type, difficulty: c.difficulty, count: c.count })), feature_key: 'mock_exam_question_per_type' }),
        });
        const json = await res.json() as { questions?: ExamQuestion[]; error?: string; required?: number; balance?: number };
        if (json.error === 'INSUFFICIENT_CON') { setConModal({ required: json.required ?? 0, balance: json.balance ?? 0 }); setMockGenerating(false); return; }
        if (!res.ok) throw new Error(json.error || '생성 실패');
        const tagged = (json.questions ?? []).map(q => ({ ...q, _passageText: text, _passageNumber: parseInt(num) }));
        allQuestions.push(...tagged);
      } catch (e) {
        setMockProgress(e instanceof Error ? e.message : '생성 오류');
        setMockGenerating(false);
        return;
      }
    }
    setMockQuestions(allQuestions);
    setMockProgress(`${allQuestions.length}개 문제 생성 완료`);
    setMockGenerating(false);
    setTimeout(() => autoSaveMockExamHistory(allQuestions, mockSession), 1000);
  };

  const handleMockDownloadQuestion = async () => {
    if (!mockQuestions.length) return;
    setMockPdfLoading('문제');
    try {
      const sorted = mockSortQuestionsForPdf(mockQuestions);
      setMockPdfSortedQuestions(sorted);
      const blob = await generateQuestionPdfBlob(sorted, mockPdfTitle.trim());
      if (blob) triggerDownload(blob, `${mockPdfTitle.trim() || '모의고사변형문제'}_문제.pdf`);
    } finally { setMockPdfLoading(false); }
  };

  const handleMockDownloadAnswer = async () => {
    if (!mockQuestions.length) return;
    setMockPdfLoading('답안');
    try {
      const sorted = mockPdfSortedQuestions.length ? mockPdfSortedQuestions : mockSortQuestionsForPdf(mockQuestions);
      const blob = await buildAnswerPdfBlob(sorted, mockPdfTitle.trim());
      triggerDownload(blob, `${mockPdfTitle.trim() || '모의고사변형문제'}_답안해설.pdf`);
    } finally { setMockPdfLoading(false); }
  };

  // ── 문제 평가 (👍/👎) ──
  const handleRateQuestion = async (
    idx: number,
    rating: 'good' | 'bad',
    q: ExamQuestion,
    historyId: string | null,
    ratingsState: Record<string, 'good' | 'bad' | null>,
    setRatingsState: React.Dispatch<React.SetStateAction<Record<string, 'good' | 'bad' | null>>>,
    conAmount: number,
  ) => {
    const key = String(idx);
    if (ratingsState[key]) return;
    setRatingsState(prev => ({ ...prev, [key]: rating }));
    if (rating === 'bad') {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      await fetch('/api/report-question', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({
          history_id: historyId ?? 'unknown',
          question_index: idx,
          question_type: q.type,
          question_json: q,
          passage_text: q._passageText ?? '',
          con_amount: conAmount,
          rating: 'bad',
        }),
      });
    }
  };

  // ── 자동 저장 ──
  const autoSaveExam = useCallback(async (qs: ExamQuestion[], text: string, types: string[], titleSnapshot: string, allPassages: string[], difficultyLevel: string) => {
    const originalPassage = allPassages[0] ?? text;
    setSaveStatus('saving');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { setSaveStatus('error'); setSaveErrorMsg('로그인 세션 없음'); return; }

      // 1. 서버에서 서명된 업로드 URL 발급
      const urlRes = await fetch('/api/storage/get-upload-urls', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${session.access_token}` },
      });
      let urlData: { question: { path: string; signedUrl: string; token: string }; answer: { path: string; signedUrl: string; token: string } | null } | null = null;
      try {
        const rawText = await urlRes.text();
        urlData = JSON.parse(rawText);
      } catch {
        setSaveStatus('error');
        setSaveErrorMsg(`URL 발급 응답 오류 (${urlRes.status}) — 잠시 후 재시도`);
        return;
      }
      if (!urlRes.ok || !urlData?.question) {
        setSaveStatus('error');
        setSaveErrorMsg('업로드 URL 발급 실패');
        return;
      }
      const { question: qUrl, answer: aUrl } = urlData;

      // 2. PDF 생성
      const [questionBlob, answerBlob] = await Promise.all([
        generateQuestionPdfBlob(qs, titleSnapshot.trim(), originalPassage),
        buildAnswerPdfBlob(qs, titleSnapshot.trim()),
      ]);
      if (!questionBlob) { setSaveStatus('error'); setSaveErrorMsg('PDF 생성 실패'); return; }

      // 3. 클라이언트에서 Supabase 스토리지에 직접 업로드
      const { error: uploadErr } = await supabase.storage
        .from('pdf-history')
        .uploadToSignedUrl(qUrl.path, qUrl.token, questionBlob, { contentType: 'application/pdf' });
      if (uploadErr) { setSaveStatus('error'); setSaveErrorMsg(`PDF 업로드 실패: ${uploadErr.message}`); return; }
      if (aUrl && answerBlob) {
        await supabase.storage.from('pdf-history').uploadToSignedUrl(aUrl.path, aUrl.token, answerBlob, { contentType: 'application/pdf' });
      }

      // 4. 서버에 경로만 전달해 DB 저장
      const res = await fetch('/api/save-exam-history', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
        body: JSON.stringify({
          questionPdfPath: qUrl.path,
          answerPdfPath: aUrl?.path ?? null,
          title: titleSnapshot.trim() || null,
          passageExcerpt: (allPassages[0] ?? text).slice(0, 150),
          passageFull: allPassages.length > 1 ? JSON.stringify(allPassages) : (allPassages[0] ?? text),
          questionTypes: types,
          difficulty: difficultyLevel,
        }),
      });
      let json: { success?: boolean; error?: string; id?: string } = {};
      try { json = await res.json(); } catch { /* non-JSON response */ }
      if (res.ok && json.success) {
        setSaveStatus('done');
        if (json.id) setRatingHistoryId(json.id);
        setQuestionRatings({});
      } else { setSaveStatus('error'); setSaveErrorMsg(json.error || `저장 실패 (${res.status})`); }
    } catch (e) {
      setSaveStatus('error');
      setSaveErrorMsg(e instanceof Error ? e.message : '네트워크 오류');
    }
  }, []);

  // ── 대량 생성 저장 (text 파라미터 버전) ──
  const autoSaveBulkExam = useCallback(async (passageText: string, qs: ExamQuestion[], customTitle?: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const types = [...new Set(qs.map(q => q.type))];
      const diffLevel = [...new Set(validConfigs.map(c => c.difficulty))].join(',');
      const titleSnapshot = customTitle?.trim()
        || passageText.slice(0, 30) + (passageText.length > 30 ? '...' : '');

      const [questionBlob, answerBlob] = await Promise.all([
        generateQuestionPdfBlob(qs, titleSnapshot, passageText),
        buildAnswerPdfBlob(qs, titleSnapshot),
      ]);
      if (!questionBlob) return;

      const urlRes = await fetch('/api/storage/get-upload-urls', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${session.access_token}` },
      });
      if (!urlRes.ok) return;
      const { question: qUrl, answer: aUrl } = await urlRes.json() as {
        question: { path: string; signedUrl: string; token: string };
        answer: { path: string; signedUrl: string; token: string } | null;
      };

      await supabase.storage.from('pdf-history').uploadToSignedUrl(qUrl.path, qUrl.token, questionBlob, { contentType: 'application/pdf' });
      if (aUrl && answerBlob) {
        await supabase.storage.from('pdf-history').uploadToSignedUrl(aUrl.path, aUrl.token, answerBlob, { contentType: 'application/pdf' });
      }

      await fetch('/api/save-exam-history', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          questionPdfPath: qUrl.path,
          answerPdfPath: aUrl?.path ?? null,
          title: titleSnapshot,
          passageExcerpt: passageText.slice(0, 150),
          passageFull: passageText,
          questionTypes: types,
          difficulty: diffLevel,
        }),
      });
    } catch {
      // 저장 실패해도 대량 생성 흐름은 계속
    }
  }, [validConfigs]);

  // ── 대량 생성 핸들러 ──
  const addBulkText = () => {
    if (bulkTexts.length < 10) {
      setBulkTexts(prev => [...prev, '']);
      setBulkTitles(prev => [...prev, '']);
      setBulkProgress(prev => [...prev, { status: 'idle' }]);
    }
  };
  const removeBulkText = (idx: number) => {
    if (bulkTexts.length > 1) {
      setBulkTexts(prev => prev.filter((_, i) => i !== idx));
      setBulkTitles(prev => prev.filter((_, i) => i !== idx));
      setBulkProgress(prev => prev.filter((_, i) => i !== idx));
    }
  };

  const handleBulkGenerate = async () => {
    const activeList = bulkTexts
      .map((t, i) => ({ text: t.trim(), idx: i }))
      .filter(({ text }) => text.length >= 50);
    if (activeList.length === 0 || validConfigs.length === 0) return;

    setBulkLoading(true);
    const progress: Array<{ status: 'idle' | 'loading' | 'success' | 'error'; message?: string }> =
      bulkTexts.map(() => ({ status: 'idle' }));
    setBulkProgress([...progress]);

    for (const { text, idx } of activeList) {
      progress[idx] = { status: 'loading', message: 'AI 생성 중...' };
      setBulkProgress([...progress]);

      try {
        const res = await fetch('/api/generate-exam-questions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text,
            typeConfigs: validConfigs.map(c => ({ type: c.type, difficulty: c.difficulty, count: c.count })),
            academy_id: userId || undefined,
          }),
        });
        const json = await res.json() as { questions?: ExamQuestion[]; error?: string; required?: number; balance?: number; success?: boolean };

        if (!res.ok || !json.success) {
          if (json.error === 'INSUFFICIENT_CON') {
            setConModal({ required: json.required ?? 0, balance: json.balance ?? 0 });
            progress[idx] = { status: 'error', message: 'CON 부족 — 중단됨' };
            setBulkProgress([...progress]);
            break;
          }
          progress[idx] = { status: 'error', message: json.error ?? '생성 실패' };
          setBulkProgress([...progress]);
          continue;
        }

        await autoSaveBulkExam(text, json.questions ?? [], bulkTitles[idx]);
        progress[idx] = { status: 'success', message: '저장 완료' };
        setBulkProgress([...progress]);
      } catch {
        progress[idx] = { status: 'error', message: '오류 발생' };
        setBulkProgress([...progress]);
      }
    }

    setBulkLoading(false);
  };

  // ── 문제 생성 ──
  const handleGenerate = async () => {
    // 모든 지문 수집
    const allPassageTexts = [
      textToSend.trim(),
      ...extraPassages.map(p => (p.mode === 'text' ? p.text : p.ocrText).trim()),
    ].filter(t => t.length >= 50);

    if (validConfigs.length === 0 || allPassageTexts.length === 0) return;
    setLoading(true);
    setError(null);
    setQuestions(null);
    setRevealedAnswers(new Set());
    setSaveStatus('idle');

    const msgs = ['AI가 지문을 분석하고 있어요... 🤖', '수능 스타일 문제를 생성하고 있어요... ✍️', '선지와 해설을 작성하고 있어요... 📝', '거의 완성됐어요! 잠시만요... ✨'];
    let msgIdx = 0;
    setLoadingMsg(msgs[0]);
    msgIntervalRef.current = setInterval(() => { msgIdx = (msgIdx + 1) % msgs.length; setLoadingMsg(msgs[msgIdx]); }, 8000);

    try {
      const allQuestions: ExamQuestion[] = [];
      for (let pi = 0; pi < allPassageTexts.length; pi++) {
        const passageText = allPassageTexts[pi];
        if (allPassageTexts.length > 1) setLoadingMsg(`${pi + 1}번 지문 문제 생성 중...`);
        const res = await fetch('/api/generate-exam-questions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text: passageText,
            typeConfigs: validConfigs.map(c => ({ type: c.type, difficulty: c.difficulty, count: c.count })),
            academy_id: userId || undefined,
          }),
        });
        const json = await res.json() as { questions?: ExamQuestion[]; error?: string; required?: number; balance?: number };
        if (json.error === 'INSUFFICIENT_CON') {
          setConModal({ required: json.required ?? 0, balance: json.balance ?? 0 });
          return;
        }
        if (!res.ok) throw new Error(json.error || '오류가 발생했습니다.');
        const tagged = (json.questions ?? []).map(q => ({ ...q, _passageText: passageText, _passageNumber: pi + 1 }));
        allQuestions.push(...tagged);
      }

      setOriginalPassageText(allPassageTexts[0]);
      setQuestions(allQuestions);

      const typesArr = validConfigs.map(c => c.type);
      const diffLabel = validConfigs.map(c => c.difficulty).join(',');
      const titleSnapshot = pdfTitle;
      setTimeout(() => autoSaveExam(allQuestions, allPassageTexts[0], typesArr, titleSnapshot, allPassageTexts, diffLabel), 800);
    } catch (e) {
      setError(e instanceof Error ? e.message : '오류가 발생했습니다.');
    } finally {
      if (msgIntervalRef.current) clearInterval(msgIntervalRef.current);
      setLoading(false);
    }
  };

  // ── 다운로드 ──
  const handleDownloadQuestion = async () => {
    if (!questions) return;
    setPdfLoading('문제');
    try {
      const sorted = sortQuestionsForPdf(questions);
      setPdfSortedQuestions(sorted);
      const blob = await generateQuestionPdfBlob(sorted, pdfTitle.trim(), originalPassageText);
      if (blob) triggerDownload(blob, `${pdfTitle.trim() || '수능형문제'}_문제.pdf`);
    } finally {
      setPdfLoading(false);
    }
  };

  const handleDownloadAnswer = async () => {
    if (!questions) return;
    setPdfLoading('답안');
    try {
      const sorted = pdfSortedQuestions.length ? pdfSortedQuestions : sortQuestionsForPdf(questions);
      const blob = await buildAnswerPdfBlob(sorted, pdfTitle.trim());
      triggerDownload(blob, `${pdfTitle.trim() || '수능형문제'}_답안해설.pdf`);
    } finally {
      setPdfLoading(false);
    }
  };

  // ── 이력 다운로드/삭제 ──
  const downloadFromHistory = async (pdfPath: string, filename: string) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { alert('로그인이 필요합니다.'); return; }
    const res = await fetch('/api/get-signed-url', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
      body: JSON.stringify({ path: pdfPath }),
    });
    const json = await res.json() as { signedUrl?: string; error?: string };
    if (!res.ok || !json.signedUrl) {
      alert('다운로드 링크 생성에 실패했습니다.');
      return;
    }
    const blob = await fetch(json.signedUrl).then(r => r.blob());
    triggerDownload(blob, filename);
  };

  const downloadSelected = async () => {
    setBulkDownloading(true);
    const items = historyList.filter(i => selectedIds.has(i.id));
    for (const item of items) {
      const base = item._source === 'input'
        ? (item.title || '실전변형문제')
        : `${item.year}_${item.institution}`;
      if (item.question_pdf_path) {
        await downloadFromHistory(item.question_pdf_path, `${base}_문제.pdf`);
        await new Promise(r => setTimeout(r, 600));
      }
      if (item.answer_pdf_path) {
        await downloadFromHistory(item.answer_pdf_path, `${base}_답안해설.pdf`);
        await new Promise(r => setTimeout(r, 600));
      }
    }
    setBulkDownloading(false);
  };

  const deleteSelected = async () => {
    if (selectedIds.size === 0) return;
    if (!confirm(`선택한 ${selectedIds.size}개 항목을 삭제하시겠습니까?`)) return;
    setBulkDeleting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { setBulkDeleting(false); alert('로그인이 필요합니다.'); return; }
      const inputIds = historyList.filter(i => selectedIds.has(i.id) && i._source === 'input').map(i => i.id);
      const mockIds = historyList.filter(i => selectedIds.has(i.id) && i._source === 'mock').map(i => i.id);
      const reqs = [];
      if (inputIds.length > 0) reqs.push(fetch('/api/delete-exam-history', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` }, body: JSON.stringify({ ids: inputIds }) }));
      if (mockIds.length > 0) reqs.push(fetch('/api/delete-mock-exam-question-history', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` }, body: JSON.stringify({ ids: mockIds }) }));
      await Promise.all(reqs);
      setSelectedIds(new Set());
      await fetchHistory();
    } finally {
      setBulkDeleting(false);
    }
  };

  const filteredHistory = historyList.filter(item => {
    if (!searchQuery) return true;
    if (item._source === 'input') return item.passage_full?.includes(searchQuery) || item.title?.includes(searchQuery);
    return item.institution?.includes(searchQuery);
  });

  // ── 렌더링 ──
  return (
    <div className="min-h-screen bg-gray-50">
      {/* 헤더 */}
      <div className="mb-6">
        <h1 className="text-2xl font-black text-gray-900">🎯 실전 변형 문제</h1>
        <p className="text-sm text-gray-500 mt-1">수능/모의고사형 변형 문제를 AI로 즉시 생성합니다.</p>
      </div>

      {/* 메인 탭 */}
      <div className="flex gap-2 mb-6 border-b-2 border-slate-100">
        {([
          { key: 'input', label: '✏️ 직접 입력' },
          { key: 'mock',  label: '📖 모의고사 지문' },
          { key: 'history', label: '📋 생성 이력' },
        ] as const).map(tab => (
          <button key={tab.key} onClick={() => setActiveMainTab(tab.key)}
            className={`px-6 py-3 font-black text-base rounded-t-xl transition-all
              ${activeMainTab === tab.key ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-600'}`}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── 직접 입력 탭 ── */}
      {activeMainTab === 'input' && (
        <div>
          {/* 서브 탭 */}
          <div className="flex gap-2 mb-4">
            {([
              { key: 'generate', label: '✏️ 문제 생성' },
              { key: 'bulk',    label: '📦 문제 생성(대량)' },
            ] as const).map(sub => (
              <button key={sub.key} onClick={() => setInputSubTab(sub.key)}
                className={`px-5 py-2 font-black text-sm rounded-xl transition-all border-2
                  ${inputSubTab === sub.key ? 'border-indigo-600 bg-indigo-50 text-indigo-700' : 'border-gray-200 text-gray-500 hover:border-indigo-300 hover:text-indigo-600'}`}>
                {sub.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── 단일 생성 서브탭 ── */}
      {activeMainTab === 'input' && inputSubTab === 'generate' && (
        <div className="space-y-6">

          {/* 제목 입력 */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <label className="block text-sm font-black text-gray-700 mb-2">제목 (선택)</label>
            <input
              type="text"
              value={pdfTitle}
              onChange={e => setPdfTitle(e.target.value)}
              placeholder="예) 2025 수능 34번 변형"
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm font-bold text-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-300"
            />
          </div>

          {/* 지문 입력 (다중 지문 지원) */}
          <div className="space-y-3">
            {/* 지문 1 — 기존 UI */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-base font-black text-gray-800">📄 지문 1</h2>
                <div className="flex gap-2">
                  {(['text', 'image'] as const).map(mode => (
                    <button key={mode} onClick={() => setInputMode(mode)}
                      className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${inputMode === mode ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>
                      {mode === 'text' ? '📝 직접 입력' : '📷 사진 등록'}
                    </button>
                  ))}
                </div>
              </div>
              {inputMode === 'text' ? (
                <textarea value={manualText} onChange={e => setManualText(e.target.value)}
                  placeholder="영어 지문을 여기에 입력하세요..." rows={8}
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm font-medium text-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-300 resize-none leading-relaxed" />
              ) : (
                <div className="space-y-4">
                  <div onDragOver={e => { e.preventDefault(); setIsDragging(true); }} onDragLeave={() => setIsDragging(false)} onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                    className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all ${isDragging ? 'border-indigo-400 bg-indigo-50' : 'border-gray-200 hover:border-indigo-300 hover:bg-gray-50'}`}>
                    {imagePreview ? <img src={imagePreview} alt="preview" className="max-h-48 mx-auto rounded-lg object-contain" /> : (
                      <div className="text-gray-400"><div className="text-4xl mb-2">📷</div><p className="font-bold text-sm">클릭하거나 이미지를 드래그하세요</p><p className="text-xs mt-1">JPG, PNG, GIF, WebP (최대 10MB)</p></div>
                    )}
                  </div>
                  <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleImageFile(f); }} />
                  {imageFile && !ocrDone && (
                    <button onClick={runOcr} disabled={ocrLoading} className="w-full py-3 rounded-xl font-black text-sm bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 transition-all">
                      {ocrLoading ? '🔍 텍스트 추출 중...' : '🔍 텍스트 추출 (OCR)'}
                    </button>
                  )}
                  {ocrDone && ocrText && (
                    <div className="space-y-2">
                      <p className="text-xs font-black text-green-600">✅ 텍스트 추출 완료</p>
                      <textarea value={ocrText} onChange={e => setOcrText(e.target.value)} rows={6}
                        className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm font-medium text-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-300 resize-none" />
                    </div>
                  )}
                </div>
              )}
              <p className="mt-2 text-xs text-gray-400">{textToSend.length > 0 ? `${textToSend.length}자 입력됨` : '지문을 입력하세요 (최소 50자)'}</p>
            </div>

            {/* 추가 지문 카드 */}
            {extraPassages.map((ep, i) => (
              <div key={i} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-base font-black text-gray-800">📄 지문 {i + 2}</h2>
                  <div className="flex items-center gap-2">
                    {(['text', 'image'] as const).map(mode => (
                      <button key={mode} onClick={() => setExtraPassages(prev => prev.map((p, j) => j === i ? { ...p, mode } : p))}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${ep.mode === mode ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>
                        {mode === 'text' ? '📝 직접 입력' : '📷 사진 등록'}
                      </button>
                    ))}
                    <button onClick={() => setExtraPassages(prev => prev.filter((_, j) => j !== i))}
                      className="text-xs font-black text-gray-400 hover:text-red-500 px-2 py-1 rounded-lg hover:bg-red-50 transition-all">✕ 제거</button>
                  </div>
                </div>
                {ep.mode === 'text' ? (
                  <textarea value={ep.text} onChange={e => setExtraPassages(prev => prev.map((p, j) => j === i ? { ...p, text: e.target.value } : p))}
                    placeholder="영어 지문을 여기에 입력하세요..." rows={6}
                    className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm font-medium text-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-300 resize-none leading-relaxed" />
                ) : (
                  <div className="space-y-3">
                    <div onClick={() => { const input = document.createElement('input'); input.type = 'file'; input.accept = 'image/*'; input.onchange = async (ev) => { const f = (ev.target as HTMLInputElement).files?.[0]; if (!f) return; const reader = new FileReader(); reader.onloadend = () => setExtraPassages(prev => prev.map((p, j) => j === i ? { ...p, imageFile: f, imagePreview: reader.result as string, ocrDone: false, ocrText: '' } : p)); reader.readAsDataURL(f); }; input.click(); }}
                      className="border-2 border-dashed rounded-xl p-6 text-center cursor-pointer hover:border-indigo-300 hover:bg-gray-50 transition-all">
                      {ep.imagePreview ? <img src={ep.imagePreview} alt="preview" className="max-h-40 mx-auto rounded-lg object-contain" /> : (
                        <div className="text-gray-400"><div className="text-3xl mb-1">📷</div><p className="font-bold text-sm">클릭하여 이미지 등록</p></div>
                      )}
                    </div>
                    {ep.imageFile && !ep.ocrDone && (
                      <button disabled={ep.ocrLoading} onClick={async () => {
                        if (!ep.imageFile) return;
                        setExtraPassages(prev => prev.map((p, j) => j === i ? { ...p, ocrLoading: true } : p));
                        try {
                          const fd = new FormData(); fd.append('image', ep.imageFile);
                          const r = await fetch('/api/ocr', { method: 'POST', body: fd });
                          const json = await r.json() as { text?: string };
                          setExtraPassages(prev => prev.map((p, j) => j === i ? { ...p, ocrText: json.text || '', ocrDone: true, ocrLoading: false } : p));
                        } catch { setExtraPassages(prev => prev.map((p, j) => j === i ? { ...p, ocrLoading: false } : p)); }
                      }} className="w-full py-3 rounded-xl font-black text-sm bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 transition-all">
                        {ep.ocrLoading ? '🔍 텍스트 추출 중...' : '🔍 텍스트 추출 (OCR)'}
                      </button>
                    )}
                    {ep.ocrDone && ep.ocrText && (
                      <div className="space-y-2">
                        <p className="text-xs font-black text-green-600">✅ 텍스트 추출 완료</p>
                        <textarea value={ep.ocrText} onChange={e => setExtraPassages(prev => prev.map((p, j) => j === i ? { ...p, ocrText: e.target.value } : p))} rows={5}
                          className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm font-medium text-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-300 resize-none" />
                      </div>
                    )}
                  </div>
                )}
                <p className="mt-2 text-xs text-gray-400">{(ep.mode === 'text' ? ep.text : ep.ocrText).length}자 입력됨</p>
              </div>
            ))}

            {/* 지문 추가 버튼 */}
            {extraPassages.length < 4 && (
              <button onClick={() => setExtraPassages(prev => [...prev, { text: '', mode: 'text', ocrText: '', ocrDone: false, ocrLoading: false, imageFile: null, imagePreview: null }])}
                className="w-full py-3 border-2 border-dashed border-indigo-200 rounded-2xl text-sm font-black text-indigo-500 hover:border-indigo-400 hover:bg-indigo-50 transition-all">
                + 지문 추가 ({1 + extraPassages.length}/5)
              </button>
            )}
          </div>

          {/* 문제 유형 슬라이드 */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
            {/* 헤더 */}
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-base font-black text-gray-800">📌 문제 유형 설정</h2>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    const allEnabled = typeConfigs.every(c => c.enabled);
                    setTypeConfigs(prev => prev.map(c => ({ ...c, enabled: !allEnabled })));
                  }}
                  className="px-3 py-1.5 bg-gray-100 text-gray-600 text-xs font-black rounded-xl hover:bg-gray-200 transition-all">
                  {typeConfigs.every(c => c.enabled) ? '전체 해제' : '전체 선택'}
                </button>
                <button
                  onClick={addCustomConfig}
                  className="flex items-center gap-1 px-3 py-1.5 bg-indigo-600 text-white text-xs font-black rounded-xl hover:bg-indigo-700 transition-all"
                >
                  + 유형 추가
                </button>
              </div>
            </div>

            {/* 일괄 설정 바 */}
            <div className="flex items-center justify-end gap-2 mb-3 px-3 py-2.5 bg-gray-50 rounded-xl border border-gray-200">
              <span className="text-xs font-black text-gray-500 flex-shrink-0 mr-1">일괄 설정</span>
              {/* 난이도 버튼 */}
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
                    <span className="leading-none">{d.label}</span>
                  </button>
                ))}
              </div>
              {/* 수량 스피너 */}
              <div className="flex items-center gap-1">
                <span className="text-xs text-gray-400 font-bold">수량</span>
                <button onClick={() => setBulkCount(v => v === '' ? 1 : Math.max(1, v - 1))}
                  className="w-6 h-6 rounded-lg bg-gray-200 hover:bg-gray-300 text-xs font-black flex items-center justify-center">−</button>
                <span className="w-5 text-center text-sm font-black text-indigo-700">{bulkCount}</span>
                <button onClick={() => setBulkCount(v => v === '' ? 1 : Math.min(3, v + 1))}
                  className="w-6 h-6 rounded-lg bg-gray-200 hover:bg-gray-300 text-xs font-black flex items-center justify-center">+</button>
              </div>
              {/* 적용 버튼 */}
              <button
                onClick={applyBulk}
                className="px-3 py-1.5 bg-indigo-100 text-indigo-700 text-xs font-black rounded-lg hover:bg-indigo-200 transition-all"
              >적용</button>
            </div>

            {/* 카드 목록 */}
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

          {/* PDF 배치 선택 */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
            <h2 className="text-base font-black text-gray-800 mb-3">📐 PDF 문제 배치</h2>
            <div className="flex gap-2">
              {([
                { key: 'passage', label: '지문별', desc: 'A지문 → B지문 순서' },
                { key: 'type',    label: '유형별', desc: '어법 → 어휘 → 빈칸 순서' },
                { key: 'random',  label: '무작위', desc: '지문·유형 모두 섞기' },
              ] as const).map(({ key, label, desc }) => (
                <button key={key} type="button" onClick={() => setPdfLayout(key)}
                  className={`flex-1 py-2.5 px-3 rounded-xl border-2 text-xs font-black transition-all text-center ${
                    pdfLayout === key ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-500 border-gray-200 hover:border-indigo-300 hover:text-indigo-600'
                  }`}>
                  <div>{label}</div>
                  <div className={`text-[10px] mt-0.5 font-medium ${pdfLayout === key ? 'text-indigo-200' : 'text-gray-400'}`}>{desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* CON 차감 안내 */}
          {aiPrice !== null && aiPrice > 0 && (() => {
            const passageCount = 1 + extraPassages.length;
            const typeTotal = validConfigs.reduce((s, c) => s + c.count, 0);
            const totalQ = passageCount * typeTotal;
            return (
              <div className="px-4 py-3 bg-amber-50 border border-amber-200 rounded-2xl text-sm text-amber-800 font-bold text-center space-y-1">
                <p>문제당 {aiPrice}콘 차감</p>
                <p>총 {passageCount}지문 × 총 {typeTotal}유형 = {totalQ}문제 생성 시 <span className="font-black text-amber-900">{(aiPrice * totalQ).toLocaleString()} CON</span> 차감 예정</p>
                <p className="text-xs text-amber-600 font-medium">생성되는 유형이 많을수록 시간이 더 소요됩니다.</p>
              </div>
            );
          })()}

          {/* 생성 버튼 */}
          <button
            onClick={handleGenerate}
            disabled={loading || textToSend.trim().length < 50 || validConfigs.length === 0}
            className="w-full py-4 rounded-2xl font-black text-base bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-sm"
          >
            {loading ? loadingMsg : 'AI 문제 생성하기'}
          </button>

          {/* 에러 */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm font-bold text-red-600">
              ⚠️ {error}
            </div>
          )}

          {/* 결과 */}
          {questions && questions.length > 0 && (
            <div className="space-y-6">
              {/* 저장 상태 */}
              <div className={`rounded-xl px-4 py-3 text-sm font-bold flex items-center gap-2
                ${saveStatus === 'done' ? 'bg-green-50 text-green-700' :
                  saveStatus === 'saving' ? 'bg-blue-50 text-blue-700' :
                  saveStatus === 'error' ? 'bg-red-50 text-red-600' : 'hidden'}`}>
                {saveStatus === 'done' && '✅ 이력에 자동 저장되었습니다.'}
                {saveStatus === 'saving' && '💾 저장 중...'}
                {saveStatus === 'error' && `❌ 저장 실패: ${saveErrorMsg}`}
              </div>

              {/* 문제 카드 */}
              <div id="exam-print-area" className="space-y-6">
                {questions.map((q, idx) => {
                  const typeOpt = QUESTION_TYPE_OPTIONS.find(o => o.key === q.type);
                  const isRevealed = revealedAnswers.has(idx);
                  const answerDisplay = (q.type === 'grammar' || q.type === 'vocab_paraphrase' || q.type === 'flow') ? CIRCLE_NUMS[q.answer - 1] : (q.type === 'sentence_order' ? (q.choices[q.answer - 1]?.text ?? `${q.answer}번`) : `${q.answer}번`);
                  return (
                    <div key={idx} id={`exam-q-${idx}`} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                      {/* 카드 헤더 */}
                      <div className="flex items-center gap-3 mb-4">
                        <span className={`text-xs font-black px-3 py-1 rounded-full border ${typeOpt?.color ?? 'bg-gray-100 text-gray-600 border-gray-200'}`}>
                          {typeOpt?.label ?? q.type}
                        </span>
                        <span className="text-base font-black text-gray-800">문제 {idx + 1}</span>
                      </div>

                      {/* vocab_paraphrase: 낱말 쓰임 — 지시문 → 지문(①~⑤) → 선지 */}
                      {q.type === 'vocab_paraphrase' && (
                        <>
                          <div className="text-sm font-bold text-gray-800 mb-4 leading-relaxed whitespace-pre-wrap">
                            {q.question_text}
                          </div>
                          {q.modified_passage && (
                            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 mb-4 text-sm text-slate-700 leading-relaxed whitespace-pre-wrap font-medium">
                              {renderPassageWithCircles(q.modified_passage, q.choices)}
                            </div>
                          )}
                        </>
                      )}

                      {/* summary: [질문] + [원본 지문] + [요약문박스] */}
                      {q.type === 'summary' && (() => {
                        const parts = q.question_text.split('\n\n');
                        const instruction = parts[0]?.trim() || '';
                        const summaryText = parts.slice(1).join('\n\n').replace(/^\[요약문\]\s*/i, '').trim();
                        return (
                          <>
                            <p className="text-sm font-bold text-gray-800 mb-3 whitespace-pre-wrap">{instruction}</p>
                            {originalPassageText && (
                              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 mb-4 text-sm text-slate-700 leading-relaxed whitespace-pre-wrap font-medium">
                                {originalPassageText}
                              </div>
                            )}
                            {summaryText && (
                              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 mb-4">
                                <p className="text-xs font-black text-slate-400 mb-2">[요약문]</p>
                                <p className="text-sm text-slate-700 font-medium whitespace-pre-wrap">{summaryText}</p>
                              </div>
                            )}
                          </>
                        );
                      })()}

                      {/* topic_title: [질문] + [원본 지문] */}
                      {q.type === 'topic_title' && (
                        <>
                          <div className="text-sm font-bold text-gray-800 mb-4 leading-relaxed whitespace-pre-wrap">
                            {q.question_text}
                          </div>
                          {originalPassageText && (
                            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 mb-4 text-sm text-slate-700 leading-relaxed whitespace-pre-wrap font-medium">
                              {originalPassageText}
                            </div>
                          )}
                        </>
                      )}
                      {/* grammar: [질문] + [지문 ①②③④⑤] */}
                      {q.type === 'grammar' && (
                        <>
                          <div className="text-sm font-bold text-gray-800 mb-4 leading-relaxed whitespace-pre-wrap">
                            {q.question_text}
                          </div>
                          {q.modified_passage && (
                            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 mb-4 text-sm text-slate-700 leading-relaxed whitespace-pre-wrap font-medium">
                              {renderPassageWithCircles(q.modified_passage.replace(/\[([^\]]+)\]/g, '$1'), q.choices, false)}
                            </div>
                          )}
                        </>
                      )}
                      {/* vocab_blank: [질문] / [(a)(b) 지문] — 순서 고정 */}
                      {q.type === 'vocab_blank' && (
                        <>
                          <div className="text-sm font-bold text-gray-800 mb-6 leading-relaxed">
                            {q.question_text}
                          </div>
                          {q.modified_passage && (
                            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 mb-6 text-sm text-slate-700 leading-relaxed font-medium whitespace-pre-wrap">
                              {renderVocabBlankPassage(q.modified_passage)}
                            </div>
                          )}
                        </>
                      )}
                      {/* fill_blank: [질문] + [빈칸 지문] */}
                      {q.type === 'fill_blank' && (
                        <>
                          <div className="text-sm font-bold text-gray-800 mb-4 leading-relaxed whitespace-pre-wrap">
                            {q.question_text}
                          </div>
                          {q.modified_passage && (
                            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 mb-4 text-sm text-slate-700 leading-relaxed whitespace-pre-wrap font-medium">
                              {q.modified_passage}
                            </div>
                          )}
                        </>
                      )}

                      {/* flow: [질문] + [①~⑤ 문장 지문] */}
                      {q.type === 'flow' && (
                        <>
                          <div className="text-sm font-bold text-gray-800 mb-4 leading-relaxed whitespace-pre-wrap">
                            {q.question_text}
                          </div>
                          {q.modified_passage && (
                            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 mb-4 text-sm text-slate-700 leading-relaxed font-medium">
                              {renderFlowPassage(q.modified_passage)}
                            </div>
                          )}
                        </>
                      )}

                      {/* phrase_meaning: [질문] + [밑줄 지문] */}
                      {q.type === 'phrase_meaning' && (
                        <>
                          <div className="text-sm font-bold text-gray-800 mb-4 leading-relaxed whitespace-pre-wrap">
                            {q.question_text}
                          </div>
                          {q.modified_passage && (
                            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 mb-4 text-sm text-slate-700 leading-relaxed whitespace-pre-wrap font-medium">
                              {renderWithUnderline(q.modified_passage)}
                            </div>
                          )}
                        </>
                      )}

                      {/* sentence_order: [질문] + [주어진 글 + (A)(B)(C) 단락] */}
                      {q.type === 'sentence_order' && (() => {
                        // AI가 question_text에 지문까지 넣는 경우 방어: [주어진 글] 이전 지시문만 추출
                        const instruction = q.question_text.split('[주어진 글]')[0].trim();
                        // modified_passage 우선, 없으면 question_text에서 파싱
                        const raw = q.modified_passage || q.question_text;
                        const passage = raw ?? '';
                        const givenMatch = passage.match(/\[주어진 글\]\s*([\s\S]*?)(?=\(A\))/);
                        const aMatch = passage.match(/\(A\)\s*([\s\S]*?)(?=\(B\))/);
                        const bMatch = passage.match(/\(B\)\s*([\s\S]*?)(?=\(C\))/);
                        const cMatch = passage.match(/\(C\)\s*([\s\S]*?)$/);
                        return (
                          <>
                            <div className="text-sm font-bold text-gray-800 mb-4 leading-relaxed">
                              {instruction}
                            </div>
                            {givenMatch && (
                              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 mb-3">
                                <p className="text-xs font-black text-slate-400 mb-2">[주어진 글]</p>
                                <p className="text-sm text-slate-700 font-medium leading-relaxed" style={{textAlign:'justify',wordBreak:'break-word'}}>{givenMatch[1].trim()}</p>
                              </div>
                            )}
                            {[['A', aMatch], ['B', bMatch], ['C', cMatch]].map(([label, match]) => match && (
                              <div key={label as string} className="bg-white border border-slate-200 rounded-xl p-4 mb-3">
                                <p className="text-xs font-black text-indigo-500 mb-2">({label})</p>
                                <p className="text-sm text-slate-700 font-medium leading-relaxed" style={{textAlign:'justify',wordBreak:'break-word'}}>{(match as RegExpMatchArray)[1].trim()}</p>
                              </div>
                            ))}
                          </>
                        );
                      })()}

                      {/* 문제 지시문 (아래 유형은 위에서 이미 처리) */}
                      {q.type !== 'vocab_paraphrase' && q.type !== 'summary' && q.type !== 'vocab_blank' && q.type !== 'topic_title' && q.type !== 'grammar' && q.type !== 'fill_blank' && q.type !== 'flow' && q.type !== 'phrase_meaning' && q.type !== 'sentence_order' && (
                        <div className="text-sm font-bold text-gray-800 mb-4 leading-relaxed whitespace-pre-wrap">
                          {q.question_text}
                        </div>
                      )}

                      {/* 선지 */}
                      {q.type !== 'flow' && q.type !== 'grammar' && (
                        <div className="space-y-2.5 mb-5">
                          {q.choices.map((c, ci) => {
                            const isCorrect = isRevealed && (c.number === q.answer || ci + 1 === q.answer);
                            return (
                              <div key={ci}
                                className={`flex gap-3 items-start p-3 rounded-xl transition-all
                                  ${isCorrect
                                    ? 'bg-indigo-50 border border-indigo-200'
                                    : 'bg-gray-50 border border-transparent'}`}>
                                {(q.type === 'grammar' || q.type === 'vocab_paraphrase') ? (
                                  renderGrammarChoice(c.text, isCorrect, c.number)
                                ) : q.type === 'sentence_order' ? (
                                  <span className={`text-sm leading-relaxed font-medium
                                    ${isCorrect ? 'font-black text-indigo-700' : 'text-gray-700'}`}>
                                    {c.text}
                                  </span>
                                ) : (
                                  <>
                                    <span className={`font-black flex-shrink-0 text-sm pt-0.5 min-w-[20px]
                                      ${isCorrect ? 'text-indigo-600' : 'text-gray-600'}`}>
                                      {CIRCLE_NUMS[ci]}
                                    </span>
                                    <span className={`text-sm leading-relaxed
                                      ${isCorrect ? 'font-black text-indigo-700' : 'font-medium text-gray-700'}`}>
                                      {c.text}
                                    </span>
                                  </>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {/* 정답/해설 토글 */}
                      <div className="exam-answer">
                        <button
                          onClick={() => {
                            setRevealedAnswers(prev => {
                              const next = new Set(prev);
                              if (next.has(idx)) next.delete(idx); else next.add(idx);
                              return next;
                            });
                          }}
                          className="text-xs font-black text-indigo-600 hover:text-indigo-800 transition-all border border-indigo-200 px-3 py-1.5 rounded-lg hover:bg-indigo-50"
                        >
                          {isRevealed ? '🙈 정답/해설 숨기기' : '✅ 정답/해설 보기'}
                        </button>
                        {isRevealed && (
                          <div className="mt-3 bg-indigo-50 border border-indigo-200 rounded-xl p-4 space-y-3">
                            <p className="text-sm font-black text-indigo-700">정답: {answerDisplay}</p>
                            <div className="border-t border-indigo-200 pt-3">
                              <p className="text-xs font-black text-indigo-500 mb-1">해설</p>
                              <p className="text-sm font-medium text-slate-800 leading-relaxed whitespace-pre-wrap">
                                {q.explanation || '해설 데이터가 없습니다.'}
                              </p>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* 문제 품질 평가 */}
                      {(() => {
                        const rKey = String(idx);
                        const rated = questionRatings[rKey];
                        return (
                          <div className="mt-4 pt-3 border-t border-gray-100 flex items-center gap-3">
                            <span className="text-xs font-black text-gray-400">문제 품질</span>
                            <button
                              disabled={!!rated}
                              onClick={() => handleRateQuestion(idx, 'good', q, ratingHistoryId, questionRatings, setQuestionRatings, aiPrice ?? 1)}
                              className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-black transition-all border
                                ${rated === 'good' ? 'bg-emerald-500 text-white border-emerald-500' : 'border-gray-200 text-gray-400 hover:border-emerald-400 hover:text-emerald-600 disabled:opacity-40 disabled:cursor-not-allowed'}`}
                            >
                              👍 좋아요
                            </button>
                            <button
                              disabled={!!rated}
                              onClick={() => handleRateQuestion(idx, 'bad', q, ratingHistoryId, questionRatings, setQuestionRatings, aiPrice ?? 1)}
                              className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-black transition-all border
                                ${rated === 'bad' ? 'bg-rose-500 text-white border-rose-500' : 'border-gray-200 text-gray-400 hover:border-rose-400 hover:text-rose-600 disabled:opacity-40 disabled:cursor-not-allowed'}`}
                            >
                              👎 신고
                            </button>
                            {rated === 'bad' && <span className="text-xs font-bold text-rose-500">신고가 접수되었습니다. 검토 후 CON이 환불됩니다.</span>}
                            {rated === 'good' && <span className="text-xs font-bold text-emerald-600">감사합니다!</span>}
                          </div>
                        );
                      })()}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── 대량 생성 서브탭 ── */}
      {activeMainTab === 'input' && inputSubTab === 'bulk' && (
        <div className="space-y-6">

          {/* 지문 입력 카드들 */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-black text-gray-800">📄 지문 입력 <span className="text-sm font-bold text-gray-400">(최대 10개)</span></h2>
              <button
                onClick={addBulkText}
                disabled={bulkTexts.length >= 10}
                className="flex items-center gap-1 px-3 py-1.5 bg-indigo-600 text-white text-xs font-black rounded-xl hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
              >
                + 지문 추가
              </button>
            </div>
            <div className="space-y-4">
              {bulkTexts.map((text, idx) => {
                const prog = bulkProgress[idx] ?? { status: 'idle' };
                return (
                  <div key={idx} className={`rounded-2xl border-2 p-4 transition-all
                    ${prog.status === 'success' ? 'border-green-200 bg-green-50/30' :
                      prog.status === 'error'   ? 'border-red-200 bg-red-50/30' :
                      prog.status === 'loading' ? 'border-indigo-200 bg-indigo-50/30' :
                      'border-gray-100 bg-white'}`}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-black text-gray-500">지문 {idx + 1}</span>
                      <div className="flex items-center gap-2">
                        {/* 상태 뱃지 */}
                        {prog.status === 'idle' && (
                          <span className="text-[11px] font-bold text-gray-400 px-2 py-0.5 bg-gray-100 rounded-full">대기중</span>
                        )}
                        {prog.status === 'loading' && (
                          <span className="text-[11px] font-bold text-indigo-600 px-2 py-0.5 bg-indigo-100 rounded-full animate-pulse">AI 생성 중...</span>
                        )}
                        {prog.status === 'success' && (
                          <span className="text-[11px] font-bold text-green-700 px-2 py-0.5 bg-green-100 rounded-full">✓ {prog.message}</span>
                        )}
                        {prog.status === 'error' && (
                          <span className="text-[11px] font-bold text-red-600 px-2 py-0.5 bg-red-100 rounded-full">✗ {prog.message}</span>
                        )}
                        {/* 삭제 버튼 */}
                        {bulkTexts.length > 1 && !bulkLoading && (
                          <button
                            onClick={() => removeBulkText(idx)}
                            className="text-gray-300 hover:text-red-400 text-base font-black leading-none transition-all"
                          >✕</button>
                        )}
                      </div>
                    </div>
                    <input
                      type="text"
                      value={bulkTitles[idx] ?? ''}
                      onChange={e => {
                        const next = [...bulkTitles];
                        next[idx] = e.target.value;
                        setBulkTitles(next);
                      }}
                      disabled={bulkLoading}
                      placeholder="제목 (선택) — 비워두면 지문 앞부분이 제목으로 저장됩니다"
                      className="w-full border border-gray-200 rounded-xl px-4 py-2 text-sm font-bold text-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-300 mb-2 disabled:bg-gray-50 disabled:text-gray-500"
                    />
                    <textarea
                      value={text}
                      onChange={e => {
                        const next = [...bulkTexts];
                        next[idx] = e.target.value;
                        setBulkTexts(next);
                      }}
                      disabled={bulkLoading}
                      placeholder="영어 지문을 여기에 입력하세요... (최소 50자)"
                      rows={5}
                      className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm font-medium text-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-300 resize-none leading-relaxed disabled:bg-gray-50 disabled:text-gray-500"
                    />
                    <p className="mt-1 text-[11px] text-gray-400">
                      {text.trim().length > 0
                        ? text.trim().length < 50
                          ? `${text.trim().length}자 — 50자 이상 입력하세요`
                          : `${text.trim().length}자`
                        : '지문을 입력하세요 (최소 50자)'}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 문제 유형 설정 (공유) */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-base font-black text-gray-800">📌 문제 유형 설정</h2>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    const allEnabled = typeConfigs.every(c => c.enabled);
                    setTypeConfigs(prev => prev.map(c => ({ ...c, enabled: !allEnabled })));
                  }}
                  className="px-3 py-1.5 bg-gray-100 text-gray-600 text-xs font-black rounded-xl hover:bg-gray-200 transition-all">
                  {typeConfigs.every(c => c.enabled) ? '전체 해제' : '전체 선택'}
                </button>
                <button
                  onClick={addCustomConfig}
                  className="flex items-center gap-1 px-3 py-1.5 bg-indigo-600 text-white text-xs font-black rounded-xl hover:bg-indigo-700 transition-all"
                >
                  + 유형 추가
                </button>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 mb-3 px-3 py-2.5 bg-gray-50 rounded-xl border border-gray-200">
              <span className="text-xs font-black text-gray-500 flex-shrink-0 mr-1">일괄 설정</span>
              <div className="flex gap-1">
                {DIFF_OPTIONS.map(d => (
                  <button key={d.key}
                    onClick={() => setBulkDifficulty(prev => prev === d.key ? '' : d.key)}
                    className={`flex flex-col items-center justify-center w-12 py-1.5 rounded-xl font-black text-[10px] transition-all border-2
                      ${bulkDifficulty === d.key ? d.active : 'border-gray-200 bg-white text-gray-400 hover:border-gray-300 hover:text-gray-600'}`}>
                    <span className="text-sm leading-none mb-0.5">{d.icon}</span>
                    <span className="text-[8px] font-bold opacity-60 leading-none mb-0.5">{d.sub}</span>
                    <span className="leading-none">{d.label}</span>
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-1">
                <span className="text-xs text-gray-400 font-bold">수량</span>
                <button onClick={() => setBulkCount(v => v === '' ? 1 : Math.max(1, v - 1))}
                  className="w-6 h-6 rounded-lg bg-gray-200 hover:bg-gray-300 text-xs font-black flex items-center justify-center">−</button>
                <span className="w-5 text-center text-sm font-black text-indigo-700">{bulkCount}</span>
                <button onClick={() => setBulkCount(v => v === '' ? 1 : Math.min(3, v + 1))}
                  className="w-6 h-6 rounded-lg bg-gray-200 hover:bg-gray-300 text-xs font-black flex items-center justify-center">+</button>
              </div>
              <button onClick={applyBulk}
                className="px-3 py-1.5 bg-indigo-100 text-indigo-700 text-xs font-black rounded-lg hover:bg-indigo-200 transition-all">적용</button>
            </div>
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={typeConfigs.map(c => c.id)} strategy={verticalListSortingStrategy}>
                <div className="space-y-2">
                  {typeConfigs.map(cfg => (
                    <SortableTypeCard key={cfg.id} cfg={cfg} onUpdate={updateConfig} onRemove={removeConfig} />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
            <p className="mt-2 text-[11px] text-gray-400">
              체크된 유형 {validConfigs.length}개 · 지문당 {validConfigs.reduce((s, c) => s + c.count, 0)}문제 생성 예정
            </p>
          </div>

          {/* CON 안내 */}
          {aiPrice !== null && aiPrice > 0 && (() => {
            const perPassage = validConfigs.reduce((s, c) => s + c.count, 0);
            const validBulkCount = bulkTexts.filter(t => t.trim().length >= 50).length;
            const totalQ = perPassage * validBulkCount;
            return (
              <div className="px-4 py-3 bg-yellow-50 border border-yellow-200 rounded-2xl space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm">⭐</span>
                  <span className="text-xs font-black text-yellow-700">문제당 {aiPrice} CON 차감</span>
                </div>
                {totalQ > 0 && (
                  <>
                    <p className="text-xs font-black text-yellow-800 ml-6">
                      지문당 {perPassage}문제 × {validBulkCount}개 지문 →{' '}
                      <span className="text-yellow-900">총 {(aiPrice * totalQ).toLocaleString()} CON</span> 차감 예정
                    </p>
                    <p className="text-[11px] text-yellow-600 ml-6">⏱ 지문 수에 비례해 시간이 소요됩니다 (순차 생성)</p>
                  </>
                )}
              </div>
            );
          })()}

          {/* 생성 버튼 */}
          <button
            onClick={handleBulkGenerate}
            disabled={
              bulkLoading ||
              validConfigs.length === 0 ||
              bulkTexts.filter(t => t.trim().length >= 50).length === 0
            }
            className="w-full py-4 rounded-2xl font-black text-base bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-sm"
          >
            {bulkLoading
              ? `순차 생성 중... (${bulkProgress.filter(p => p.status === 'success' || p.status === 'error').length}/${bulkTexts.filter(t => t.trim().length >= 50).length})`
              : `🤖 순차 생성 시작 (${bulkTexts.filter(t => t.trim().length >= 50).length}개 지문)`}
          </button>

          {/* 완료 후 안내 */}
          {!bulkLoading && bulkProgress.some(p => p.status === 'success') && (
            <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 text-sm font-bold text-green-700">
              ✅ 생성 완료! <button onClick={() => setActiveMainTab('history')} className="underline ml-1">생성 이력 탭</button>에서 다운로드하세요.
            </div>
          )}
        </div>
      )}

      {/* ── 모의고사 지문 탭 ── */}
      {activeMainTab === 'mock' && (
        <div className="space-y-6">
          {/* STEP 1 — 기출 지문 선택 */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <h2 className="text-base font-black text-gray-800 mb-4">STEP 1 — 기출 지문 선택</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
              {[
                { label: '년도', value: mockSelectedYear, onChange: setMockSelectedYear, disabled: false, options: mockYears.map(y => ({ value: String(y), label: `${y}년` })) },
                { label: '학년', value: mockSelectedGrade, onChange: setMockSelectedGrade, disabled: !mockSelectedYear, options: mockGrades.map(g => ({ value: g, label: g })) },
                { label: '시험명/기관', value: mockSelectedInstitution, onChange: setMockSelectedInstitution, disabled: !mockSelectedGrade, options: mockInstitutions.map(i => ({ value: i, label: i })) },
              ].map(({ label, value, onChange, disabled, options }) => (
                <div key={label}>
                  <label className="block text-xs font-black text-gray-400 mb-1.5">{label}</label>
                  <select value={value} onChange={e => onChange(e.target.value)} disabled={disabled}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm font-bold bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300 disabled:opacity-50">
                    <option value="">선택</option>
                    {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
              ))}
            </div>
            {mockSelectedInstitution && (
              <div className="mb-4">
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-black text-gray-400">문제 번호 <span className="text-gray-300 font-normal">(복수 선택 가능)</span></label>
                  {mockSelectedNumbers.length > 0 && (
                    <button onClick={() => { setMockSelectedNumbers([]); setMockPassageMap({}); }}
                      className="text-xs font-black text-gray-400 hover:text-red-400 transition-all">전체 해제</button>
                  )}
                </div>
                {mockQuestionNumbers.length === 0 ? (
                  <p className="text-sm text-gray-400">등록된 문제가 없습니다.</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {mockQuestionNumbers.map(n => {
                      const nStr = String(n);
                      const isSelected = mockSelectedNumbers.includes(nStr);
                      const isLoading = mockLoadingNumbers.has(nStr);
                      return (
                        <button key={n} onClick={() => toggleMockNumber(nStr)} disabled={isLoading}
                          className={`px-3 py-1.5 rounded-xl text-xs font-black border-2 transition-all ${
                            isSelected ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm' : 'bg-white text-gray-600 border-gray-200 hover:border-indigo-300 hover:text-indigo-600'
                          } ${isLoading ? 'opacity-50 cursor-wait' : ''}`}>
                          {isLoading ? '...' : `${n}번`}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
            {!mockSelectedYear && <p className="text-sm text-gray-400 font-medium">년도를 선택하면 학년, 시험명/기관, 문제번호를 차례로 선택할 수 있습니다.</p>}
            {mockSortedSelectedNumbers.length > 0 && (
              <div className="mt-2 space-y-3">
                {mockSortedSelectedNumbers.map(num => (
                  <div key={num} className="bg-slate-50 rounded-xl p-4 border border-slate-200">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs font-black text-slate-500">{num}번 지문 미리보기</p>
                      <button onClick={() => toggleMockNumber(num)} className="text-xs text-gray-400 hover:text-red-400 font-black transition-all">✕</button>
                    </div>
                    {mockLoadingNumbers.has(num) ? (
                      <p className="text-sm text-gray-400 animate-pulse">지문 불러오는 중...</p>
                    ) : mockPassageMap[num] ? (
                      <p className="text-sm text-slate-700 font-medium leading-relaxed select-none" style={{ textAlign: 'justify', wordBreak: 'break-word' }} onContextMenu={e => e.preventDefault()} onDragStart={e => e.preventDefault()}>{mockPassageMap[num]}</p>
                    ) : (
                      <p className="text-sm text-gray-400">지문 없음</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* STEP 2 — 문제 제목 */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <h2 className="text-base font-black text-gray-800 mb-4">STEP 2 — 문제 제목</h2>
            <input type="text" value={mockPdfTitle} onChange={e => setMockPdfTitle(e.target.value)} placeholder="예: 2024 수능 18번 변형"
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm font-bold text-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-300" />
          </div>

          {/* STEP 3 — 문제 유형 설정 */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-base font-black text-gray-800">STEP 3 — 문제 유형 설정</h2>
              <div className="flex gap-2">
                <button onClick={() => { const allEnabled = typeConfigs.every(c => c.enabled); setTypeConfigs(prev => prev.map(c => ({ ...c, enabled: !allEnabled }))); }}
                  className="px-3 py-1.5 bg-gray-100 text-gray-600 text-xs font-black rounded-xl hover:bg-gray-200 transition-all">
                  {typeConfigs.every(c => c.enabled) ? '전체 해제' : '전체 선택'}
                </button>
                <button onClick={addCustomConfig} className="flex items-center gap-1 px-3 py-1.5 bg-indigo-600 text-white text-xs font-black rounded-xl hover:bg-indigo-700 transition-all">+ 유형 추가</button>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 mb-3 px-3 py-2.5 bg-gray-50 rounded-xl border border-gray-200">
              <span className="text-xs font-black text-gray-500 flex-shrink-0 mr-1">일괄 설정</span>
              <div className="flex gap-1">
                {DIFF_OPTIONS.map(d => (
                  <button key={d.key} onClick={() => setBulkDifficulty(prev => prev === d.key ? '' : d.key)}
                    className={`flex flex-col items-center justify-center w-12 py-1.5 rounded-xl font-black text-[10px] transition-all border-2 ${bulkDifficulty === d.key ? d.active : 'border-gray-200 bg-white text-gray-400 hover:border-gray-300 hover:text-gray-600'}`}>
                    <span className="text-sm leading-none mb-0.5">{d.icon}</span>
                    <span className="text-[8px] font-bold opacity-60 leading-none mb-0.5">{d.sub}</span>
                    <span>{d.label}</span>
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-1 ml-1">
                {[1, 2, 3].map(n => (
                  <button key={n} onClick={() => setBulkCount(prev => prev === n ? '' : n)}
                    className={`w-8 h-8 rounded-lg text-xs font-black border-2 transition-all ${bulkCount === n ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-400 border-gray-200 hover:border-gray-300'}`}>{n}</button>
                ))}
              </div>
              <button onClick={applyBulk} disabled={bulkDifficulty === '' && bulkCount === ''}
                className="ml-1 px-3 py-1.5 bg-indigo-600 text-white text-xs font-black rounded-xl hover:bg-indigo-700 disabled:opacity-40 transition-all">적용</button>
            </div>
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={typeConfigs.map(c => c.id)} strategy={verticalListSortingStrategy}>
                <div className="space-y-2">
                  {typeConfigs.map(cfg => <SortableTypeCard key={cfg.id} cfg={cfg} onUpdate={updateConfig} onRemove={removeConfig} />)}
                </div>
              </SortableContext>
            </DndContext>
          </div>

          {/* STEP 4 — PDF 문제 배치 */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <h2 className="text-base font-black text-gray-800 mb-4">STEP 4 — PDF 문제 배치</h2>
            <div className="flex gap-2">
              {([
                { key: 'passage', label: '지문별', desc: 'A지문 → B지문 순서' },
                { key: 'type',    label: '유형별', desc: '어법 → 어휘 → 빈칸 순서' },
                { key: 'random',  label: '무작위', desc: '지문·유형 모두 섞기' },
              ] as const).map(({ key, label, desc }) => (
                <button key={key} type="button" onClick={() => setMockPdfLayout(key)}
                  className={`flex-1 py-2.5 px-3 rounded-xl border-2 text-xs font-black transition-all text-center ${
                    mockPdfLayout === key ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-500 border-gray-200 hover:border-indigo-300 hover:text-indigo-600'
                  }`}>
                  <div>{label}</div>
                  <div className={`text-[10px] mt-0.5 font-medium ${mockPdfLayout === key ? 'text-indigo-200' : 'text-gray-400'}`}>{desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* CON 안내 + 생성 버튼 */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            {aiPrice !== null && aiPrice > 0 && (
              <div className="mb-4 p-4 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-800 font-bold text-center space-y-1">
                <p>문제당 {aiPrice}콘 차감</p>
                <p>총 {mockSortedSelectedNumbers.length || 0}지문 × 총 {validConfigs.reduce((s, c) => s + c.count, 0)}유형 = {mockSortedSelectedNumbers.length * validConfigs.reduce((s, c) => s + c.count, 0)}문제 생성 시 <span className="font-black text-amber-900">{(mockSortedSelectedNumbers.length * validConfigs.reduce((s, c) => s + c.count, 0) * (aiPrice ?? 0)).toLocaleString()} CON</span> 차감 예정</p>
              </div>
            )}
            <button onClick={handleMockGenerate} disabled={mockGenerating || !mockAllPassagesReady || validConfigs.length === 0}
              className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-base rounded-2xl transition-all disabled:opacity-50 disabled:cursor-not-allowed">
              {mockGenerating ? '⏳ 생성 중...' : 'AI 문제 생성하기'}
            </button>
            {!mockAllPassagesReady && mockLoadingNumbers.size === 0 && <p className="text-xs font-bold text-gray-400 mt-2 text-center">STEP 1에서 지문 번호를 선택하세요</p>}
            {mockLoadingNumbers.size > 0 && <p className="text-xs font-bold text-indigo-400 mt-2 text-center animate-pulse">지문 불러오는 중...</p>}
            {mockProgress && (
              <p className={`text-sm font-bold mt-3 text-center ${mockGenerating ? 'text-indigo-500 animate-pulse' : 'text-gray-500'}`}>{mockProgress}</p>
            )}
            {mockAutoSaveStatus === 'saving' && <p className="text-xs text-center text-indigo-400 mt-2 animate-pulse">이력 저장 중...</p>}
            {mockAutoSaveStatus === 'done' && <p className="text-xs text-center text-green-600 mt-2">✅ 이력 저장 완료</p>}
          </div>

          {/* 생성된 문제 */}
          {mockQuestions.length > 0 && (
            <div className="space-y-4">
              <h2 className="text-lg font-black text-gray-900">생성된 문제 ({mockQuestions.length}개)</h2>
              {mockQuestions.map((q, idx) => {
                const typeOpt = QUESTION_TYPE_OPTIONS.find(o => o.key === q.type);
                const isRevealed = mockRevealedAnswers.has(idx);
                const prevQ = mockQuestions[idx - 1];
                const showGroupHeader = q._passageNumber !== undefined && q._passageNumber !== prevQ?._passageNumber;
                const answerDisplay = (q.type === 'grammar' || q.type === 'vocab_paraphrase' || q.type === 'flow')
                  ? CIRCLE_NUMS[q.answer - 1]
                  : (q.type === 'sentence_order' ? (q.choices[q.answer - 1]?.text ?? `${q.answer}번`) : `${q.answer}번`);
                return (
                  <div key={idx}>
                    {showGroupHeader && mockSortedSelectedNumbers.length > 1 && (
                      <div className="flex items-center gap-3 py-2 mb-2">
                        <div className="h-px flex-1 bg-indigo-100" />
                        <span className="text-xs font-black text-indigo-400 bg-indigo-50 border border-indigo-100 px-3 py-1 rounded-full">📄 {q._passageNumber}번 지문</span>
                        <div className="h-px flex-1 bg-indigo-100" />
                      </div>
                    )}
                    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                      <div className="flex items-center gap-3 mb-4">
                        <span className={`text-xs font-black px-3 py-1 rounded-full border ${typeOpt?.color ?? 'bg-gray-100 text-gray-600 border-gray-200'}`}>{typeOpt?.label ?? q.type}</span>
                        <span className="text-base font-black text-gray-800">문제 {idx + 1}</span>
                      </div>
                      {q.type === 'vocab_paraphrase' && (
                        <>
                          <div className="text-sm font-bold text-gray-800 mb-4 leading-relaxed whitespace-pre-wrap">{q.question_text}</div>
                          {q.modified_passage && <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 mb-4 text-sm text-slate-700 leading-relaxed whitespace-pre-wrap font-medium">{renderPassageWithCircles(q.modified_passage, q.choices)}</div>}
                        </>
                      )}
                      {q.type === 'summary' && (() => {
                        const parts = q.question_text.split('\n\n');
                        const instruction = parts[0]?.trim() || '';
                        const summaryText = parts.slice(1).join('\n\n').replace(/^\[요약문\]\s*/i, '').trim();
                        return (
                          <>
                            <p className="text-sm font-bold text-gray-800 mb-3 whitespace-pre-wrap">{instruction}</p>
                            {q._passageText && <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 mb-4 text-sm text-slate-700 leading-relaxed whitespace-pre-wrap font-medium">{q._passageText}</div>}
                            {summaryText && <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 mb-4"><p className="text-xs font-black text-slate-400 mb-2">[요약문]</p><p className="text-sm text-slate-700 font-medium whitespace-pre-wrap">{summaryText}</p></div>}
                          </>
                        );
                      })()}
                      {q.type === 'topic_title' && (
                        <>
                          <div className="text-sm font-bold text-gray-800 mb-4 leading-relaxed whitespace-pre-wrap">{q.question_text}</div>
                          {q._passageText && <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 mb-4 text-sm text-slate-700 leading-relaxed whitespace-pre-wrap font-medium">{q._passageText}</div>}
                        </>
                      )}
                      {q.type === 'grammar' && (
                        <>
                          <div className="text-sm font-bold text-gray-800 mb-4 leading-relaxed whitespace-pre-wrap">{q.question_text}</div>
                          {q.modified_passage && <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 mb-4 text-sm text-slate-700 leading-relaxed whitespace-pre-wrap font-medium">{renderPassageWithCircles(q.modified_passage.replace(/\[([^\]]+)\]/g, '$1'), q.choices, false)}</div>}
                        </>
                      )}
                      {q.type === 'vocab_blank' && (
                        <>
                          <div className="text-sm font-bold text-gray-800 mb-6 leading-relaxed">{q.question_text}</div>
                          {q.modified_passage && <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 mb-6 text-sm text-slate-700 leading-relaxed font-medium whitespace-pre-wrap">{renderVocabBlankPassage(q.modified_passage)}</div>}
                        </>
                      )}
                      {q.type === 'flow' && (
                        <>
                          <div className="text-sm font-bold text-gray-800 mb-4 leading-relaxed whitespace-pre-wrap">{q.question_text}</div>
                          {q.modified_passage && <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 mb-4 text-sm text-slate-700 leading-relaxed font-medium">{renderFlowPassage(q.modified_passage)}</div>}
                        </>
                      )}
                      {q.type === 'phrase_meaning' && (
                        <>
                          <div className="text-sm font-bold text-gray-800 mb-4 leading-relaxed whitespace-pre-wrap">{q.question_text}</div>
                          {q.modified_passage && <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 mb-4 text-sm text-slate-700 leading-relaxed font-medium">{renderWithUnderline(q.modified_passage)}</div>}
                        </>
                      )}
                      {q.type === 'sentence_order' && (() => {
                        const passage = q.modified_passage || q.question_text;
                        const soInstruction = q.question_text.split('[주어진 글]')[0].trim();
                        const givenM = passage.match(/\[주어진 글\]\s*([\s\S]*?)(?=\(A\))/);
                        const aM = passage.match(/\(A\)\s*([\s\S]*?)(?=\(B\))/);
                        const bM = passage.match(/\(B\)\s*([\s\S]*?)(?=\(C\))/);
                        const cM = passage.match(/\(C\)\s*([\s\S]*?)$/);
                        return (
                          <>
                            <div className="text-sm font-bold text-gray-800 mb-4 whitespace-pre-wrap">{soInstruction}</div>
                            {givenM && <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 mb-2"><p className="text-[10px] font-black text-slate-400 mb-1">[주어진 글]</p><p className="text-sm text-slate-700 leading-relaxed">{givenM[1].trim()}</p></div>}
                            {[['A', aM], ['B', bM], ['C', cM]].map(([lbl, m]) => m && <div key={String(lbl)} className="bg-white border border-slate-200 rounded-xl p-3 mb-2"><p className="text-[10px] font-black text-indigo-400 mb-1">({lbl})</p><p className="text-sm text-slate-700 leading-relaxed">{(m as RegExpMatchArray)[1].trim()}</p></div>)}
                          </>
                        );
                      })()}
                      {q.type !== 'flow' && q.type !== 'grammar' && q.choices?.length > 0 && (
                        <div className="space-y-2 mt-4">
                          {q.choices.map((c, ci) => (
                            <div key={ci} className="flex items-start gap-2">
                              <span className="font-black text-slate-500 flex-shrink-0 min-w-[18px] text-sm">{CIRCLE_NUMS[ci] ?? (ci + 1)}</span>
                              <span className="text-sm text-slate-700 leading-relaxed">{c.text}</span>
                            </div>
                          ))}
                        </div>
                      )}
                      <div className="mt-4">
                        <button onClick={() => { setMockRevealedAnswers(prev => { const next = new Set(prev); if (next.has(idx)) next.delete(idx); else next.add(idx); return next; }); }}
                          className="text-xs font-black text-indigo-600 hover:text-indigo-800 transition-all border border-indigo-200 px-3 py-1.5 rounded-lg hover:bg-indigo-50">
                          {isRevealed ? '🙈 정답/해설 숨기기' : '✅ 정답/해설 보기'}
                        </button>
                        {isRevealed && (
                          <div className="mt-3 bg-indigo-50 border border-indigo-200 rounded-xl p-4 space-y-3">
                            <p className="text-sm font-black text-indigo-700">정답: {answerDisplay}</p>
                            <div className="border-t border-indigo-200 pt-3">
                              <p className="text-xs font-black text-indigo-500 mb-1">해설</p>
                              <p className="text-sm font-medium text-slate-800 leading-relaxed whitespace-pre-wrap">{q.explanation || '해설 데이터가 없습니다.'}</p>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* 문제 품질 평가 */}
                      {(() => {
                        const rKey = String(idx);
                        const rated = mockQuestionRatings[rKey];
                        return (
                          <div className="mt-4 pt-3 border-t border-gray-100 flex items-center gap-3">
                            <span className="text-xs font-black text-gray-400">문제 품질</span>
                            <button
                              disabled={!!rated}
                              onClick={() => handleRateQuestion(idx, 'good', q, mockRatingHistoryId, mockQuestionRatings, setMockQuestionRatings, aiPrice ?? 1)}
                              className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-black transition-all border
                                ${rated === 'good' ? 'bg-emerald-500 text-white border-emerald-500' : 'border-gray-200 text-gray-400 hover:border-emerald-400 hover:text-emerald-600 disabled:opacity-40 disabled:cursor-not-allowed'}`}
                            >
                              👍 좋아요
                            </button>
                            <button
                              disabled={!!rated}
                              onClick={() => handleRateQuestion(idx, 'bad', q, mockRatingHistoryId, mockQuestionRatings, setMockQuestionRatings, aiPrice ?? 1)}
                              className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-black transition-all border
                                ${rated === 'bad' ? 'bg-rose-500 text-white border-rose-500' : 'border-gray-200 text-gray-400 hover:border-rose-400 hover:text-rose-600 disabled:opacity-40 disabled:cursor-not-allowed'}`}
                            >
                              👎 신고
                            </button>
                            {rated === 'bad' && <span className="text-xs font-bold text-rose-500">신고가 접수되었습니다. 검토 후 CON이 환불됩니다.</span>}
                            {rated === 'good' && <span className="text-xs font-bold text-emerald-600">감사합니다!</span>}
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── 생성 이력 탭 ── */}
      {activeMainTab === 'history' && (
        <div className="space-y-4">
          <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-2.5 text-xs font-bold text-amber-700">
            생성 이력은 생성일로부터 30일 후 자동 삭제됩니다.
          </div>

          {/* 필터 */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 flex flex-wrap gap-3 items-end">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-black text-slate-500">날짜</label>
              <input type="date" value={searchDate} onChange={e => setSearchDate(e.target.value)}
                className="px-3 py-2 border border-gray-200 rounded-xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-indigo-300" />
            </div>
            <div className="flex flex-col gap-1 flex-1 min-w-[180px]">
              <label className="text-xs font-black text-slate-500">키워드 검색</label>
              <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && fetchHistory(searchQuery, searchDate)}
                placeholder="지문 내 단어를 입력하세요..."
                className="px-3 py-2 border border-gray-200 rounded-xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-indigo-300" />
            </div>
            <button onClick={() => fetchHistory(searchQuery, searchDate)} disabled={historyLoading}
              className="px-4 py-2 bg-indigo-600 text-white text-sm font-black rounded-xl hover:bg-indigo-700 transition-all disabled:opacity-50">🔍 검색</button>
            {(searchDate || searchQuery) && (
              <button onClick={() => { setSearchQuery(''); setSearchDate(''); fetchHistory('', ''); }}
                className="px-4 py-2 bg-gray-100 text-gray-600 text-sm font-black rounded-xl hover:bg-gray-200 transition-all">초기화</button>
            )}
          </div>

          {selectedIds.size > 0 && (
            <div className="flex items-center gap-3 px-5 py-3 bg-indigo-50 border border-indigo-200 rounded-2xl">
              <span className="font-black text-indigo-700 text-sm">{selectedIds.size}개 선택됨</span>
              <div className="flex gap-2 ml-auto">
                <button onClick={downloadSelected} disabled={bulkDownloading}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-xl font-black text-sm hover:bg-indigo-700 disabled:opacity-50 transition-all">
                  {bulkDownloading ? '다운로드 중...' : '⬇️ PDF 다운로드'}
                </button>
                <button onClick={deleteSelected} disabled={bulkDeleting}
                  className="px-4 py-2 bg-rose-500 text-white rounded-xl font-black text-sm hover:bg-rose-600 disabled:opacity-50 transition-all">
                  {bulkDeleting ? '삭제 중...' : '삭제'}
                </button>
                <button onClick={() => setSelectedIds(new Set())} className="px-4 py-2 bg-slate-100 text-slate-500 rounded-xl font-black text-sm hover:bg-slate-200 transition-all">취소</button>
              </div>
            </div>
          )}

          {historyLoading ? (
            <div className="flex justify-center py-16"><div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" /></div>
          ) : historyError ? (
            <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl"><p className="text-rose-600 font-black">⚠️ {historyError}</p></div>
          ) : filteredHistory.length === 0 ? (
            <div className="bg-white rounded-[2rem] p-16 text-center shadow-lg border border-slate-100">
              <p className="text-5xl mb-4">📭</p>
              <p className="font-black text-slate-500 text-lg">생성된 이력이 없습니다</p>
              <p className="text-slate-400 font-bold text-sm mt-2">문제를 생성하면 자동으로 이곳에 기록돼요</p>
            </div>
          ) : (
            <div className="bg-white rounded-[2rem] shadow-lg border border-slate-100 overflow-hidden">
              <div className="grid grid-cols-[32px_130px_64px_1fr_120px_52px_64px_64px] gap-2 px-4 py-3 bg-slate-50 border-b border-slate-100 text-xs font-black text-slate-500">
                <input type="checkbox" checked={selectedIds.size === filteredHistory.length && filteredHistory.length > 0}
                  onChange={e => { if (e.target.checked) setSelectedIds(new Set(filteredHistory.map(i => i.id))); else setSelectedIds(new Set()); }}
                  className="w-4 h-4 rounded accent-indigo-600 cursor-pointer mt-0.5" />
                {['날짜', '유형', '내용', '문제 유형', '난이도', '문제', '해설'].map((h, i) => (
                  <span key={i} className={i >= 5 ? 'text-center' : ''}>{h}</span>
                ))}
              </div>
              {filteredHistory.map((item, i) => {
                const diffMap: Record<string, string> = { b1: 'bg-sky-100 text-sky-700', b2: 'bg-emerald-100 text-emerald-700', c1: 'bg-orange-100 text-orange-700', c2: 'bg-rose-100 text-rose-700' };
                const diffVal = (item.difficulty ?? '').split(',')[0];
                const qFilename = item._source === 'input' ? `${item.title || '문제'}_문제.pdf` : `${item.year}_${item.institution}_문제.pdf`;
                const aFilename = item._source === 'input' ? `${item.title || '문제'}_해설.pdf` : `${item.year}_${item.institution}_해설.pdf`;
                return (
                  <div key={item.id}
                    className={`grid grid-cols-[32px_130px_64px_1fr_120px_52px_64px_64px] gap-2 px-4 py-3 items-start border-b border-slate-100 last:border-0 hover:bg-indigo-50/40 transition-colors
                      ${selectedIds.has(item.id) ? 'bg-indigo-50' : i % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}`}>
                    <input type="checkbox" checked={selectedIds.has(item.id)}
                      onChange={e => { setSelectedIds(prev => { const n = new Set(prev); if (e.target.checked) n.add(item.id); else n.delete(item.id); return n; }); }}
                      className="w-4 h-4 rounded accent-indigo-600 cursor-pointer mt-0.5" />
                    <span className="text-xs font-bold text-slate-600 whitespace-nowrap">
                      {new Date(item.created_at).toLocaleString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
                    </span>
                    <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-full self-start mt-0.5 ${item._source === 'input' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'}`}>
                      {item._source === 'input' ? '직접입력' : '모의고사'}
                    </span>
                    {item._source === 'input' ? (
                      <div className="space-y-0.5">
                        {item.title && <p className="text-xs font-bold text-slate-700 truncate">{item.title}</p>}
                        {(() => {
                          let passages: string[];
                          try { const p = JSON.parse(item.passage_full); passages = Array.isArray(p) ? p : [item.passage_full]; } catch { passages = [item.passage_full]; }
                          return passages.map((p, pi) => (
                            <p key={pi} className="text-xs text-slate-500 line-clamp-1">
                              {passages.length > 1 && <span className="font-black text-indigo-400 mr-1">{String.fromCharCode(65 + pi)}.</span>}
                              {p.slice(0, 60)}...
                              <button onClick={() => setPassageModal({ title: passages.length > 1 ? `지문 ${String.fromCharCode(65 + pi)}` : '원문 지문', text: p })}
                                className="ml-1 text-indigo-400 hover:text-indigo-600 font-black whitespace-nowrap">[전체 보기]</button>
                            </p>
                          ));
                        })()}
                      </div>
                    ) : (
                      <div>
                        <p className="text-xs font-bold text-slate-700">{item.year}년 {item.grade} {item.institution}</p>
                        <p className="text-xs text-slate-500 mt-0.5">{(item.question_numbers ?? []).join('·')}번</p>
                      </div>
                    )}
                    <div className="flex flex-wrap gap-1">
                      {(item.question_types || []).map(type => {
                        const opt = QUESTION_TYPE_OPTIONS.find(o => o.key === type);
                        return <span key={type} className={`text-[10px] font-black px-1.5 py-0.5 rounded border ${opt?.color ?? 'bg-gray-100 text-gray-600 border-gray-200'}`}>{opt?.label ?? type}</span>;
                      })}
                    </div>
                    <span className={`text-xs font-black px-2 py-1 rounded-full text-center ${diffMap[diffVal] ?? 'bg-slate-100 text-slate-600'}`}>{diffVal || '-'}</span>
                    <div className="flex justify-center">
                      {item.question_pdf_path ? (
                        <button onClick={() => downloadFromHistory(item.question_pdf_path, qFilename)}
                          className="px-2 py-1 bg-indigo-100 hover:bg-indigo-200 text-indigo-700 rounded-lg text-xs font-black transition-all w-full text-center">⬇️ 문제</button>
                      ) : <span className="text-xs text-slate-300 text-center w-full">-</span>}
                    </div>
                    <div className="flex justify-center">
                      {item.answer_pdf_path ? (
                        <button onClick={() => downloadFromHistory(item.answer_pdf_path!, aFilename)}
                          className="px-2 py-1 bg-violet-100 hover:bg-violet-200 text-violet-700 rounded-lg text-xs font-black transition-all w-full text-center">⬇️ 해설</button>
                      ) : <span className="text-xs text-slate-300 text-center w-full">-</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* 지문 원문 모달 */}
      {passageModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setPassageModal(null)}>
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[80vh] overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h3 className="text-base font-black text-gray-900">{passageModal.title}</h3>
              <button onClick={() => setPassageModal(null)} className="text-gray-400 hover:text-gray-600 font-black text-xl">✕</button>
            </div>
            <div className="p-6 overflow-y-auto max-h-[60vh]">
              <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{passageModal.text}</p>
            </div>
          </div>
        </div>
      )}

      {/* CON 부족 모달 */}
      <ConInsufficientModal
        isOpen={!!conModal}
        onClose={() => setConModal(null)}
        required={conModal?.required ?? 0}
        balance={conModal?.balance ?? 0}
      />

      {/* 고정 다운로드 버튼 — 직접 입력 탭 */}
      {activeMainTab === 'input' && questions && questions.length > 0 && (
        <div className="no-print fixed bottom-8 right-8 flex flex-row items-end gap-3 z-50">
          <button onClick={handleDownloadQuestion} disabled={!!pdfLoading}
            className="px-7 py-4 rounded-2xl font-black text-base bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 transition-all shadow-xl">
            {pdfLoading === '문제' ? '⏳ 생성 중...' : '⬇️ 문제 다운로드'}
          </button>
          <button onClick={handleDownloadAnswer} disabled={!!pdfLoading}
            className="px-7 py-4 rounded-2xl font-black text-base bg-slate-700 text-white hover:bg-slate-800 disabled:opacity-50 transition-all shadow-xl">
            {pdfLoading === '답안' ? '⏳ 생성 중...' : '⬇️ 답안지/해설지 다운로드'}
          </button>
        </div>
      )}

      {/* 고정 다운로드 버튼 — 모의고사 탭 */}
      {activeMainTab === 'mock' && mockQuestions.length > 0 && (
        <div className="no-print fixed bottom-8 right-8 flex flex-row items-end gap-3 z-50">
          <button onClick={handleMockDownloadQuestion} disabled={!!mockPdfLoading}
            className="px-7 py-4 rounded-2xl font-black text-base bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 transition-all shadow-xl">
            {mockPdfLoading === '문제' ? '⏳ 생성 중...' : '⬇️ 문제 다운로드'}
          </button>
          <button onClick={handleMockDownloadAnswer} disabled={!!mockPdfLoading}
            className="px-7 py-4 rounded-2xl font-black text-base bg-slate-700 text-white hover:bg-slate-800 disabled:opacity-50 transition-all shadow-xl">
            {mockPdfLoading === '답안' ? '⏳ 생성 중...' : '⬇️ 답안지/해설지 다운로드'}
          </button>
        </div>
      )}
    </div>
  );
}
