'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import type { Session } from '@supabase/supabase-js';
import Image from 'next/image';

// ─── types ────────────────────────────────────────────────────────────────────

type WorkbookType =
  | 'vocab_choice' | 'vocab_fill'
  | 'grammar_choice' | 'grammar_correct' | 'grammar_correct_adv'
  | 'translation' | 'word_order' | 'english_writing'
  | 'passage_translation' | 'paragraph_order' | 'sentence_insertion'
  | 'suneung_vocab_right' | 'suneung_vocab_wrong'
  | 'suneung_grammar_right' | 'suneung_grammar_wrong'
  | 'combo_vocab_grammar' | 'combo_vocab_fill'
  | 'combo_grammar_order' | 'combo_grammar_insert';

type Difficulty = 'b1' | 'b2' | 'c1' | 'c2';

interface PassageCard {
  id: string;
  text: string;
  mode: 'text' | 'image';
  imageFile: File | null;
  imagePreview: string | null;
  ocrText: string;
  ocrDone: boolean;
  ocrLoading: boolean;
  isDragging: boolean;
}

type WorkbookResult = Record<string, unknown> & {
  _original_text?: string;
  error?: string;
};

interface HistoryItem {
  id: string;
  title: string | null;
  passage_excerpt: string;
  passage_full: string;
  source_type: string;
  year: number | null;
  grade: string | null;
  institution: string | null;
  question_number: number | null;
  difficulty: string;
  pdf_path: string | null;
  answer_pdf_path: string | null;
  created_at: string;
}

// ─── constants ────────────────────────────────────────────────────────────────

const CATEGORIES = [
  { key: 'vocab',    label: '어휘 연습',   types: [
    { key: 'vocab_choice' as WorkbookType, label: '어휘 선택' },
    { key: 'vocab_fill' as WorkbookType,   label: '어휘 완성' },
  ]},
  { key: 'grammar',  label: '어법 연습',   types: [
    { key: 'grammar_choice' as WorkbookType,     label: '어법 선택' },
    { key: 'grammar_correct' as WorkbookType,    label: '어법 수정' },
    { key: 'grammar_correct_adv' as WorkbookType, label: '어법 수정(상)' },
  ]},
  { key: 'sentence', label: '문장 연습',   types: [
    { key: 'translation' as WorkbookType,     label: '해석하기' },
    { key: 'word_order' as WorkbookType,      label: '낱말 배열' },
    { key: 'english_writing' as WorkbookType, label: '영작하기' },
  ]},
  { key: 'passage',  label: '지문 연습',   types: [
    { key: 'passage_translation' as WorkbookType, label: '본문 해석지' },
    { key: 'paragraph_order' as WorkbookType,     label: '문단 배열' },
    { key: 'sentence_insertion' as WorkbookType,  label: '문장 삽입' },
  ]},
  { key: 'suneung',  label: '변형 문제',   types: [
    { key: 'suneung_vocab_right' as WorkbookType,    label: '적절한 어휘' },
    { key: 'suneung_vocab_wrong' as WorkbookType,    label: '부적절한 어휘' },
    { key: 'suneung_grammar_right' as WorkbookType,  label: '맞는 어법' },
    { key: 'suneung_grammar_wrong' as WorkbookType,  label: '틀린 어법' },
  ]},
  { key: 'combo',    label: '1지문 2유형', types: [
    { key: 'combo_vocab_grammar' as WorkbookType,   label: '어휘+어법' },
    { key: 'combo_vocab_fill' as WorkbookType,      label: '어휘+문장완성' },
    { key: 'combo_grammar_order' as WorkbookType,   label: '어법+문장배열' },
    { key: 'combo_grammar_insert' as WorkbookType,  label: '어법+문장삽입' },
  ]},
];

const TYPE_LABELS: Record<WorkbookType, string> = {
  vocab_choice: '어휘 선택', vocab_fill: '어휘 완성',
  grammar_choice: '어법 선택', grammar_correct: '어법 수정', grammar_correct_adv: '어법 수정(상)',
  translation: '해석하기', word_order: '낱말 배열', english_writing: '영작하기',
  passage_translation: '본문 해석지', paragraph_order: '문단 배열', sentence_insertion: '문장 삽입',
  suneung_vocab_right: '적절한 어휘', suneung_vocab_wrong: '부적절한 어휘',
  suneung_grammar_right: '맞는 어법', suneung_grammar_wrong: '틀린 어법',
  combo_vocab_grammar: '어휘+어법', combo_vocab_fill: '어휘+문장완성',
  combo_grammar_order: '어법+문장배열', combo_grammar_insert: '어법+문장삽입',
};

const DIFF_CARDS = [
  { key: 'b1' as Difficulty, level: 'B1', label: '중등/고등 하', icon: '🌱', active: 'border-sky-400 bg-sky-50 text-sky-700' },
  { key: 'b2' as Difficulty, level: 'B2', label: '고등 중',      icon: '🌳', active: 'border-emerald-500 bg-emerald-50 text-emerald-700' },
  { key: 'c1' as Difficulty, level: 'C1', label: '고등 상',      icon: '🔥', active: 'border-orange-500 bg-orange-50 text-orange-700' },
  { key: 'c2' as Difficulty, level: 'C2', label: '고등 최상',    icon: '⚡', active: 'border-rose-500 bg-rose-50 text-rose-700' },
];

const DIFF_COLORS: Record<string, string> = {
  b1: 'bg-emerald-100 text-emerald-700',
  b2: 'bg-sky-100 text-sky-700',
  c1: 'bg-violet-100 text-violet-700',
  c2: 'bg-rose-100 text-rose-700',
};

// ─── helpers ──────────────────────────────────────────────────────────────────

function newPassageCard(): PassageCard {
  return {
    id: Math.random().toString(36).slice(2),
    text: '', mode: 'text',
    imageFile: null, imagePreview: null,
    ocrText: '', ocrDone: false, ocrLoading: false, isDragging: false,
  };
}

function effectiveText(card: PassageCard): string {
  return card.mode === 'text' ? card.text : card.ocrText;
}

interface VocabChunk {
  type: 'text' | 'choice';
  text?: string;
  num?: number;
  a?: string; b?: string; c?: string;
  correctIdx?: number;
}

function parseVocabPassage(passage: string, answerKey: string): VocabChunk[] {
  const answerMap: Record<number, string> = {};
  const keyParts = answerKey.split(/\d+\.\s*/g).filter(Boolean);
  const nums = [...answerKey.matchAll(/(\d+)\./g)].map(m => parseInt(m[1]));
  nums.forEach((n, i) => { answerMap[n] = (keyParts[i] || '').trim().split(/\s+/)[0]; });

  const chunks: VocabChunk[] = [];
  const choiceRegex = /(\d+)\[([^\]]+)\]/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = choiceRegex.exec(passage)) !== null) {
    if (match.index > lastIndex) chunks.push({ type: 'text', text: passage.slice(lastIndex, match.index) });
    const num = parseInt(match[1]);
    const opts = match[2].split(/\s*\/\s*/).map(o => o.trim());
    const ans = answerMap[num] || '';
    const correctIdx = opts.findIndex(o => o.toLowerCase() === ans.toLowerCase());
    const [a, b, c] = opts;
    chunks.push({ type: 'choice', num, a, b, c, correctIdx: correctIdx >= 0 ? correctIdx : undefined });
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < passage.length) chunks.push({ type: 'text', text: passage.slice(lastIndex) });
  return chunks;
}

async function capturePdfFromElement(elementId: string): Promise<Blob> {
  const el = document.getElementById(elementId);
  if (!el) throw new Error(`PDF 요소를 찾을 수 없습니다 (${elementId})`);
  const { toJpeg } = await import('html-to-image');
  const { jsPDF } = await import('jspdf');
  const W = 210, M = 10, cW = W - 2 * M, maxH = 277;
  const url = await toJpeg(el, { pixelRatio: 2, quality: 0.92, backgroundColor: '#ffffff', cacheBust: true });
  const img = document.createElement('img') as HTMLImageElement;
  await new Promise<void>((resolve, reject) => { img.onload = () => resolve(); img.onerror = () => reject(new Error('img load')); img.src = url; });
  const contentH = cW * (img.naturalHeight / img.naturalWidth);
  const pdf = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });
  if (contentH <= maxH) {
    pdf.addImage(url, 'JPEG', M, M, cW, contentH);
  } else {
    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth; canvas.height = img.naturalHeight;
    const ctx = canvas.getContext('2d')!; ctx.drawImage(img, 0, 0);
    const pagePixelH = Math.floor(img.naturalHeight * (maxH / contentH));
    let sliceY = 0; let firstPage = true;
    while (sliceY < img.naturalHeight) {
      const sliceH = Math.min(pagePixelH, img.naturalHeight - sliceY);
      const sliceCanvas = document.createElement('canvas');
      sliceCanvas.width = img.naturalWidth; sliceCanvas.height = sliceH;
      const sliceCtx = sliceCanvas.getContext('2d')!;
      sliceCtx.drawImage(canvas, 0, sliceY, img.naturalWidth, sliceH, 0, 0, img.naturalWidth, sliceH);
      const sliceUrl = sliceCanvas.toDataURL('image/jpeg', 0.92);
      const sliceContentH = cW * (sliceH / img.naturalWidth);
      if (!firstPage) pdf.addPage();
      pdf.addImage(sliceUrl, 'JPEG', M, M, cW, sliceContentH);
      sliceY += sliceH; firstPage = false;
    }
  }
  return pdf.output('blob');
}

// ─── result renderers (screen) ────────────────────────────────────────────────

function RenderVocabChoicePassage({ passage, answerKey, showAnswer }: { passage: string; answerKey: string; showAnswer: boolean }) {
  const chunks = parseVocabPassage(passage, answerKey);
  return (
    <p className="text-sm font-medium leading-8 text-slate-800">
      {chunks.map((c, i) => {
        if (c.type === 'text') return <span key={i}>{c.text}</span>;
        const opts = [c.a, c.b, c.c].filter((o): o is string => o !== undefined);
        return (
          <span key={i} className="inline-flex items-baseline gap-0.5">
            <span className="text-xs font-black text-slate-400 mr-0.5">{c.num}</span>
            {opts.map((opt, j) => (
              <span key={j} className="inline-flex items-baseline gap-0.5">
                {j > 0 && <span className="text-slate-400 text-xs">/</span>}
                <span className={`px-1 py-0.5 rounded text-xs font-bold ${
                  showAnswer
                    ? j === c.correctIdx ? 'bg-yellow-100 text-yellow-800 font-black' : 'bg-red-50 text-red-400 line-through'
                    : 'bg-slate-100 text-slate-700'
                }`}>{opt}</span>
              </span>
            ))}
          </span>
        );
      })}
    </p>
  );
}

function RenderVocabFill({ passage, wordBank, answerKey, showAnswer }: {
  passage: string; wordBank: string[]; answerKey: string; showAnswer: boolean;
}) {
  const answerMap: Record<number, string> = {};
  const keyParts = answerKey.split(/\d+\.\s*/g).filter(Boolean);
  const nums = [...answerKey.matchAll(/(\d+)\./g)].map(m => parseInt(m[1]));
  nums.forEach((n, i) => { answerMap[n] = (keyParts[i] || '').trim().split(/\s+/)[0]; });

  const parts = passage.split(/_\((\d+)\)_/);
  return (
    <div className="space-y-4">
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-3">
        <p className="text-xs font-black text-blue-600 mb-1">보기</p>
        <p className="text-sm font-bold text-slate-700">{(wordBank || []).join('  /  ')}</p>
      </div>
      <p className="text-sm font-medium leading-8 text-slate-800">
        {parts.map((part, i) => {
          if (i % 2 === 0) return <span key={i}>{part}</span>;
          const num = parseInt(part);
          const ans = answerMap[num];
          return (
            <span key={i} className={`inline-flex items-center gap-0.5 px-2 py-0.5 rounded text-xs font-bold min-w-[48px] justify-center
              ${showAnswer ? 'bg-yellow-100 text-yellow-800' : 'bg-slate-100 text-slate-400'}`}>
              {showAnswer ? ans : `(${num})`}
            </span>
          );
        })}
      </p>
      {showAnswer && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-3">
          <p className="text-xs font-black text-yellow-700 mb-1">정답</p>
          <p className="text-sm font-bold text-slate-700 leading-relaxed">{answerKey}</p>
        </div>
      )}
    </div>
  );
}

function RenderGrammarCorrect({ passage, answerKey, showAnswer }: { passage: string; answerKey: string; showAnswer: boolean }) {
  const circleNums = ['①', '②', '③', '④', '⑤', '⑥', '⑦', '⑧', '⑨', '⑩', '⑪', '⑫'];
  const regex = /([①②③④⑤⑥⑦⑧⑨⑩⑪⑫])\[([^\]]+)\]/g;
  const parts: React.ReactNode[] = [];
  let last = 0, m: RegExpExecArray | null;
  while ((m = regex.exec(passage)) !== null) {
    if (m.index > last) parts.push(<span key={last}>{passage.slice(last, m.index)}</span>);
    const circle = m[1];
    const word = m[2];
    const idx = circleNums.indexOf(circle);
    const ansLine = answerKey.split('\n').find(l => l.startsWith(circle));
    const correct = ansLine?.split('→')[1]?.trim() ?? '';
    parts.push(
      <span key={m.index} className={`inline-flex items-center gap-0.5 ${showAnswer ? 'bg-rose-100 rounded px-1' : ''}`}>
        <span className="text-xs font-black text-slate-500">{circle}</span>
        <span className={`px-1 py-0.5 rounded text-xs font-bold ${showAnswer ? 'line-through text-rose-500' : 'bg-slate-100 text-slate-700'}`}>{word}</span>
        {showAnswer && correct && <span className="text-xs font-black text-emerald-600">→{correct}</span>}
      </span>
    );
    last = m.index + m[0].length;
    void idx;
  }
  if (last < passage.length) parts.push(<span key={last}>{passage.slice(last)}</span>);
  return (
    <div className="space-y-3">
      <p className="text-sm font-medium leading-8 text-slate-800">{parts}</p>
      {showAnswer && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-3">
          <p className="text-xs font-black text-yellow-700 mb-1">정답</p>
          <pre className="text-sm font-bold text-slate-700 whitespace-pre-wrap">{answerKey}</pre>
        </div>
      )}
    </div>
  );
}

function RenderTranslation({ sentences, showAnswer }: {
  sentences: Array<{num: number; en: string; ko: string}>; showAnswer: boolean;
}) {
  return (
    <div className="space-y-2">
      {(sentences || []).map((s, i) => (
        <div key={i} className="border border-slate-100 rounded-xl overflow-hidden">
          <div className="bg-slate-50 px-3 py-2">
            <span className="text-xs font-black text-slate-400 mr-2">{s.num}</span>
            <span className="text-sm font-medium text-slate-800">{s.en}</span>
          </div>
          {showAnswer && (
            <div className="px-3 py-2 bg-yellow-50">
              <span className="text-sm font-bold text-yellow-800">{s.ko}</span>
            </div>
          )}
          {!showAnswer && (
            <div className="px-3 py-2">
              <div className="h-5 border-b border-slate-200"></div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function RenderWordOrder({ sentences, showAnswer }: {
  sentences: Array<{num: number; ko: string; scrambled: string[]; answer: string}>; showAnswer: boolean;
}) {
  return (
    <div className="space-y-3">
      {(sentences || []).map((s, i) => (
        <div key={i} className="border border-slate-100 rounded-xl p-3 space-y-2">
          <div className="flex items-start gap-2">
            <span className="text-xs font-black text-slate-400 mt-0.5">{s.num}</span>
            <span className="text-sm font-bold text-slate-600">{s.ko}</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {(s.scrambled || []).map((w, j) => (
              <span key={j} className="px-2 py-1 bg-indigo-50 border border-indigo-200 rounded-lg text-xs font-bold text-indigo-700">{w}</span>
            ))}
          </div>
          {showAnswer && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg px-3 py-1.5">
              <p className="text-xs font-black text-yellow-600 mb-0.5">정답</p>
              <p className="text-sm font-bold text-slate-700">{s.answer}</p>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function RenderEnglishWriting({ sentences, showAnswer }: {
  sentences: Array<{num: number; ko: string; hint_start: string; hint_end: string; answer: string}>; showAnswer: boolean;
}) {
  return (
    <div className="space-y-3">
      {(sentences || []).map((s, i) => (
        <div key={i} className="border border-slate-100 rounded-xl p-3 space-y-1.5">
          <div className="flex items-start gap-2">
            <span className="text-xs font-black text-slate-400 mt-0.5">{s.num}</span>
            <span className="text-sm font-bold text-slate-700">{s.ko}</span>
          </div>
          <div className="flex items-center gap-2 text-xs font-bold text-slate-400">
            <span className="text-indigo-600">{s.hint_start}</span>
            <span className="flex-1 border-b border-dashed border-slate-300"></span>
            <span className="text-indigo-600">{s.hint_end}</span>
          </div>
          {showAnswer && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg px-3 py-1.5">
              <p className="text-sm font-bold text-slate-700">{s.answer}</p>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function RenderPassageTranslation({ items }: {
  items: Array<{en: string; ko: string; vocab: string[]}>
}) {
  return (
    <div className="space-y-3">
      {(items || []).map((item, i) => (
        <div key={i} className="border border-slate-100 rounded-xl overflow-hidden">
          <div className="bg-slate-50 px-3 py-2">
            <p className="text-sm font-medium text-slate-800">{item.en}</p>
          </div>
          <div className="px-3 py-2 bg-emerald-50">
            <p className="text-sm font-bold text-emerald-800">{item.ko}</p>
          </div>
          {item.vocab && item.vocab.length > 0 && (
            <div className="px-3 py-2 flex flex-wrap gap-1.5">
              {item.vocab.map((v, j) => (
                <span key={j} className="text-xs font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">{v}</span>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function RenderParagraphOrder({ data, showAnswer }: {
  data: { fixed_paragraph: string; shuffled_paragraphs: Array<{label: string; text: string}>; answer_key: string };
  showAnswer: boolean;
}) {
  return (
    <div className="space-y-3">
      <div className="border-2 border-indigo-300 rounded-xl p-3 bg-indigo-50">
        <p className="text-xs font-black text-indigo-600 mb-1">제시 단락 (고정)</p>
        <p className="text-sm font-medium text-slate-800">{data.fixed_paragraph}</p>
      </div>
      {(data.shuffled_paragraphs || []).map((p, i) => (
        <div key={i} className="border border-slate-200 rounded-xl p-3">
          <p className="text-xs font-black text-slate-500 mb-1">({p.label})</p>
          <p className="text-sm font-medium text-slate-800">{p.text}</p>
        </div>
      ))}
      {showAnswer && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-3">
          <p className="text-xs font-black text-yellow-700 mb-1">정답</p>
          <p className="text-sm font-bold text-slate-700">{data.answer_key}</p>
        </div>
      )}
    </div>
  );
}

function RenderSentenceInsertion({ data, showAnswer }: {
  data: { insert_sentence: string; passage: string; answer_key: string };
  showAnswer: boolean;
}) {
  return (
    <div className="space-y-3">
      <div className="border-2 border-violet-300 rounded-xl p-3 bg-violet-50">
        <p className="text-xs font-black text-violet-600 mb-1">삽입할 문장</p>
        <p className="text-sm font-bold text-slate-800 italic">{data.insert_sentence}</p>
      </div>
      <p className="text-sm font-medium leading-8 text-slate-800">{data.passage}</p>
      {showAnswer && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-3">
          <p className="text-xs font-black text-yellow-700 mb-1">정답</p>
          <p className="text-sm font-bold text-slate-700">{data.answer_key}</p>
        </div>
      )}
    </div>
  );
}

function RenderSuneungPassage({ passage, answerKey, showAnswer }: { passage: string; answerKey: string; showAnswer: boolean }) {
  return (
    <div className="space-y-3">
      <p className="text-sm font-medium leading-8 text-slate-800">{passage}</p>
      {showAnswer && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-3">
          <p className="text-xs font-black text-yellow-700 mb-1">정답</p>
          <p className="text-sm font-bold text-slate-700">{answerKey}</p>
        </div>
      )}
    </div>
  );
}

function RenderResultContent({ result, type, showAnswer }: { result: WorkbookResult; type: WorkbookType; showAnswer: boolean }) {
  if (result.error) return <p className="text-rose-500 font-bold text-sm">{result.error as string}</p>;

  const isCombo = type.startsWith('combo_');
  if (isCombo) {
    const s1 = (result.section1 ?? {}) as WorkbookResult;
    const s2 = (result.section2 ?? {}) as WorkbookResult;
    const [t1, t2] = type === 'combo_vocab_grammar' ? ['vocab_choice', 'grammar_choice']
      : type === 'combo_vocab_fill'    ? ['vocab_choice', 'vocab_fill']
      : type === 'combo_grammar_order' ? ['grammar_correct', 'word_order']
      :                                  ['grammar_choice', 'sentence_insertion'];
    return (
      <div className="space-y-6">
        <div>
          <p className="text-xs font-black text-indigo-600 mb-2">Section 1 — {TYPE_LABELS[t1 as WorkbookType]}</p>
          <RenderResultContent result={s1} type={t1 as WorkbookType} showAnswer={showAnswer} />
        </div>
        <div className="border-t border-slate-200 pt-4">
          <p className="text-xs font-black text-violet-600 mb-2">Section 2 — {TYPE_LABELS[t2 as WorkbookType]}</p>
          <RenderResultContent result={s2} type={t2 as WorkbookType} showAnswer={showAnswer} />
        </div>
      </div>
    );
  }

  switch (type) {
    case 'vocab_choice':
    case 'grammar_choice':
      return <RenderVocabChoicePassage passage={result.passage as string} answerKey={result.answer_key as string} showAnswer={showAnswer} />;
    case 'vocab_fill':
      return <RenderVocabFill passage={result.passage as string} wordBank={result.word_bank as string[]} answerKey={result.answer_key as string} showAnswer={showAnswer} />;
    case 'grammar_correct':
    case 'grammar_correct_adv':
      return <RenderGrammarCorrect passage={result.passage as string} answerKey={result.answer_key as string} showAnswer={showAnswer} />;
    case 'translation':
      return <RenderTranslation sentences={result.sentences as Array<{num:number;en:string;ko:string}>} showAnswer={showAnswer} />;
    case 'word_order':
      return <RenderWordOrder sentences={result.sentences as Array<{num:number;ko:string;scrambled:string[];answer:string}>} showAnswer={showAnswer} />;
    case 'english_writing':
      return <RenderEnglishWriting sentences={result.sentences as Array<{num:number;ko:string;hint_start:string;hint_end:string;answer:string}>} showAnswer={showAnswer} />;
    case 'passage_translation':
      return <RenderPassageTranslation items={result.items as Array<{en:string;ko:string;vocab:string[]}>} />;
    case 'paragraph_order':
      return <RenderParagraphOrder data={result as {fixed_paragraph:string;shuffled_paragraphs:Array<{label:string;text:string}>;answer_key:string}} showAnswer={showAnswer} />;
    case 'sentence_insertion':
      return <RenderSentenceInsertion data={result as {insert_sentence:string;passage:string;answer_key:string}} showAnswer={showAnswer} />;
    case 'suneung_vocab_right':
    case 'suneung_vocab_wrong':
    case 'suneung_grammar_right':
    case 'suneung_grammar_wrong':
      return <RenderSuneungPassage passage={result.passage as string} answerKey={result.answer_key as string} showAnswer={showAnswer} />;
    default:
      return <pre className="text-xs text-slate-600 whitespace-pre-wrap">{JSON.stringify(result, null, 2)}</pre>;
  }
}

// ─── PDF render divs ──────────────────────────────────────────────────────────

const PDF_BASE: React.CSSProperties = {
  position: 'fixed', top: 0, left: 0, width: '800px',
  background: 'white', padding: '40px 48px', boxSizing: 'border-box',
  fontFamily: 'Arial, Helvetica, sans-serif', zIndex: -9999, pointerEvents: 'none',
};
const PDF_H2: React.CSSProperties = { fontSize: 14, fontWeight: 900, margin: '0 0 16px', borderBottom: '2px solid #333', paddingBottom: 8 };
const PDF_P: React.CSSProperties = { fontSize: 13, lineHeight: 2, wordBreak: 'break-word' };

function PdfVocabChoice({ result, isAnswer, title, id }: { result: WorkbookResult; isAnswer: boolean; title: string; id: string }) {
  const chunks = parseVocabPassage(result.passage as string, result.answer_key as string);
  const choiceBase: React.CSSProperties = { background: '#FFF9C4', borderRadius: 3, padding: '1px 4px', margin: '0 1px' };
  return (
    <div id={id} style={PDF_BASE}>
      <h2 style={PDF_H2}>{title}</h2>
      <p style={PDF_P}>
        {chunks.map((c, i) => {
          if (c.type === 'text') return <span key={i}>{c.text}</span>;
          const opts = [c.a, c.b, c.c].filter((o): o is string => o !== undefined);
          if (isAnswer) {
            return (
              <span key={i} style={choiceBase}>
                {c.num}[{opts.map((opt, j) => (
                  <span key={j}>
                    {j > 0 && ' / '}
                    {j === c.correctIdx
                      ? <span style={{ fontWeight: 900, textDecoration: 'underline' }}>{opt}</span>
                      : <span style={{ color: '#999', textDecoration: 'line-through' }}>{opt}</span>
                    }
                  </span>
                ))}]
              </span>
            );
          }
          return <span key={i} style={choiceBase}>{c.num}[{opts.join(' / ')}]</span>;
        })}
      </p>
      {isAnswer && (
        <div style={{ marginTop: 16, padding: '10px 14px', background: '#f8f8f8', borderRadius: 6, fontSize: 12, lineHeight: 1.8 }}>
          <strong>정답:</strong> {result.answer_key as string}
        </div>
      )}
    </div>
  );
}

function PdfVocabFill({ result, isAnswer, title, id }: { result: WorkbookResult; isAnswer: boolean; title: string; id: string }) {
  const passage = result.passage as string;
  const wordBank = result.word_bank as string[];
  const answerKey = result.answer_key as string;
  const answerMap: Record<number, string> = {};
  const keyParts = answerKey.split(/\d+\.\s*/g).filter(Boolean);
  const nums = [...answerKey.matchAll(/(\d+)\./g)].map(m => parseInt(m[1]));
  nums.forEach((n, i) => { answerMap[n] = (keyParts[i] || '').trim().split(/\s+/)[0]; });
  const parts = passage.split(/_\((\d+)\)_/);
  return (
    <div id={id} style={PDF_BASE}>
      <h2 style={PDF_H2}>{title}</h2>
      <div style={{ background: '#EEF2FF', borderRadius: 6, padding: '8px 12px', marginBottom: 14, fontSize: 12, lineHeight: 1.8 }}>
        <strong>보기:</strong> {(wordBank || []).join('  /  ')}
      </div>
      <p style={PDF_P}>
        {parts.map((part, i) => {
          if (i % 2 === 0) return <span key={i}>{part}</span>;
          const num = parseInt(part);
          const ans = answerMap[num];
          if (isAnswer) return <span key={i} style={{ background: '#FFF9C4', borderRadius: 3, padding: '0 4px', fontWeight: 900 }}>{ans}</span>;
          return <span key={i} style={{ display: 'inline-block', minWidth: 60, borderBottom: '1.5px solid #333', textAlign: 'center', fontSize: 11, color: '#999' }}>({num})</span>;
        })}
      </p>
      {isAnswer && (
        <div style={{ marginTop: 14, padding: '10px 14px', background: '#f8f8f8', borderRadius: 6, fontSize: 12, lineHeight: 1.8 }}>
          <strong>정답:</strong> {answerKey}
        </div>
      )}
    </div>
  );
}

function PdfGrammarCorrect({ result, isAnswer, title, id }: { result: WorkbookResult; isAnswer: boolean; title: string; id: string }) {
  const passage = result.passage as string;
  const answerKey = result.answer_key as string;
  const regex = /([①②③④⑤⑥⑦⑧⑨⑩⑪⑫])\[([^\]]+)\]/g;
  const parts: React.ReactNode[] = [];
  let last = 0; let m: RegExpExecArray | null;
  while ((m = regex.exec(passage)) !== null) {
    if (m.index > last) parts.push(<span key={last}>{passage.slice(last, m.index)}</span>);
    const circle = m[1]; const word = m[2];
    const ansLine = answerKey.split('\n').find(l => l.startsWith(circle));
    const correct = ansLine?.split('→')[1]?.trim() ?? '';
    if (isAnswer) {
      parts.push(
        <span key={m.index} style={{ background: '#FEE2E2', borderRadius: 3, padding: '0 3px' }}>
          {circle}<span style={{ textDecoration: 'line-through', color: '#EF4444' }}>{word}</span>
          {correct && <span style={{ color: '#16A34A', fontWeight: 900 }}>→{correct}</span>}
        </span>
      );
    } else {
      parts.push(<span key={m.index} style={{ background: '#FFF9C4', borderRadius: 3, padding: '0 3px' }}>{circle}[{word}]</span>);
    }
    last = m.index + m[0].length;
  }
  if (last < passage.length) parts.push(<span key={last}>{passage.slice(last)}</span>);
  return (
    <div id={id} style={PDF_BASE}>
      <h2 style={PDF_H2}>{title}</h2>
      <p style={PDF_P}>{parts}</p>
      {isAnswer && (
        <div style={{ marginTop: 14, padding: '10px 14px', background: '#f8f8f8', borderRadius: 6, fontSize: 12, lineHeight: 1.8 }}>
          <strong>정답:</strong><br /><pre style={{ margin: 0, fontFamily: 'inherit' }}>{answerKey}</pre>
        </div>
      )}
    </div>
  );
}

function PdfTranslation({ result, isAnswer, title, id }: { result: WorkbookResult; isAnswer: boolean; title: string; id: string }) {
  const sentences = result.sentences as Array<{num:number;en:string;ko:string}>;
  return (
    <div id={id} style={PDF_BASE}>
      <h2 style={PDF_H2}>{title}{isAnswer ? ' (정답)' : ''}</h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {(sentences || []).map((s, i) => (
          <div key={i} style={{ borderLeft: '3px solid #6366F1', paddingLeft: 10 }}>
            <p style={{ margin: 0, fontSize: 13, lineHeight: 1.7 }}><strong>{s.num}.</strong> {s.en}</p>
            {isAnswer
              ? <p style={{ margin: '4px 0 0', fontSize: 13, color: '#92400E', fontWeight: 700 }}>{s.ko}</p>
              : <div style={{ height: 20, borderBottom: '1px dashed #ccc', marginTop: 4 }}></div>
            }
          </div>
        ))}
      </div>
    </div>
  );
}

function PdfWordOrder({ result, isAnswer, title, id }: { result: WorkbookResult; isAnswer: boolean; title: string; id: string }) {
  const sentences = result.sentences as Array<{num:number;ko:string;scrambled:string[];answer:string}>;
  return (
    <div id={id} style={PDF_BASE}>
      <h2 style={PDF_H2}>{title}{isAnswer ? ' (정답)' : ''}</h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {(sentences || []).map((s, i) => (
          <div key={i}>
            <p style={{ margin: '0 0 4px', fontSize: 12, fontWeight: 700, color: '#374151' }}>{s.num}. {s.ko}</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 4 }}>
              {(s.scrambled || []).map((w, j) => (
                <span key={j} style={{ background: '#EEF2FF', border: '1px solid #A5B4FC', borderRadius: 4, padding: '2px 8px', fontSize: 12, fontWeight: 700 }}>{w}</span>
              ))}
            </div>
            {isAnswer && <p style={{ margin: '2px 0 0 0', fontSize: 12, fontWeight: 900, color: '#92400E' }}>→ {s.answer}</p>}
            {!isAnswer && <div style={{ height: 16, borderBottom: '1px dashed #ccc' }}></div>}
          </div>
        ))}
      </div>
    </div>
  );
}

function PdfEnglishWriting({ result, isAnswer, title, id }: { result: WorkbookResult; isAnswer: boolean; title: string; id: string }) {
  const sentences = result.sentences as Array<{num:number;ko:string;hint_start:string;hint_end:string;answer:string}>;
  return (
    <div id={id} style={PDF_BASE}>
      <h2 style={PDF_H2}>{title}{isAnswer ? ' (정답)' : ''}</h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {(sentences || []).map((s, i) => (
          <div key={i}>
            <p style={{ margin: '0 0 4px', fontSize: 12, fontWeight: 700 }}>{s.num}. {s.ko}</p>
            <p style={{ margin: '0 0 2px', fontSize: 11, color: '#6366F1', fontWeight: 700 }}>
              {s.hint_start} __________ {s.hint_end}
            </p>
            {isAnswer && <p style={{ margin: '2px 0 0', fontSize: 12, fontWeight: 900, color: '#92400E' }}>{s.answer}</p>}
          </div>
        ))}
      </div>
    </div>
  );
}

function PdfPassageTranslation({ result, id }: { result: WorkbookResult; id: string }) {
  const items = result.items as Array<{en:string;ko:string;vocab:string[]}>;
  return (
    <div id={id} style={PDF_BASE}>
      <h2 style={PDF_H2}>본문 해석지</h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {(items || []).map((item, i) => (
          <div key={i} style={{ borderLeft: '3px solid #10B981', paddingLeft: 10 }}>
            <p style={{ margin: 0, fontSize: 13, lineHeight: 1.6 }}>{item.en}</p>
            <p style={{ margin: '3px 0 0', fontSize: 13, color: '#065F46', fontWeight: 700 }}>{item.ko}</p>
            {item.vocab && item.vocab.length > 0 && (
              <p style={{ margin: '3px 0 0', fontSize: 11, color: '#6B7280' }}>{item.vocab.join('  |  ')}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function PdfParagraphOrder({ result, isAnswer, title, id }: { result: WorkbookResult; isAnswer: boolean; title: string; id: string }) {
  const data = result as {fixed_paragraph:string;shuffled_paragraphs:Array<{label:string;text:string}>;answer_key:string};
  return (
    <div id={id} style={PDF_BASE}>
      <h2 style={PDF_H2}>{title}{isAnswer ? ' (정답)' : ''}</h2>
      <div style={{ background: '#EEF2FF', borderRadius: 6, padding: '10px 14px', marginBottom: 14, fontSize: 13, lineHeight: 1.7 }}>
        <strong>제시 단락</strong><br />{data.fixed_paragraph}
      </div>
      {(data.shuffled_paragraphs || []).map((p, i) => (
        <div key={i} style={{ border: '1px solid #E5E7EB', borderRadius: 6, padding: '10px 14px', marginBottom: 10, fontSize: 13, lineHeight: 1.7 }}>
          <strong>({p.label})</strong> {p.text}
        </div>
      ))}
      {isAnswer && (
        <div style={{ background: '#FFF9C4', borderRadius: 6, padding: '10px 14px', marginTop: 10, fontSize: 13, fontWeight: 700 }}>
          {data.answer_key}
        </div>
      )}
    </div>
  );
}

function PdfSentenceInsertion({ result, isAnswer, title, id }: { result: WorkbookResult; isAnswer: boolean; title: string; id: string }) {
  const data = result as {insert_sentence:string;passage:string;answer_key:string};
  return (
    <div id={id} style={PDF_BASE}>
      <h2 style={PDF_H2}>{title}{isAnswer ? ' (정답)' : ''}</h2>
      <div style={{ background: '#F5F3FF', border: '2px solid #A78BFA', borderRadius: 6, padding: '10px 14px', marginBottom: 14, fontSize: 13, fontStyle: 'italic', lineHeight: 1.7 }}>
        {data.insert_sentence}
      </div>
      <p style={PDF_P}>{data.passage}</p>
      {isAnswer && (
        <div style={{ background: '#FFF9C4', borderRadius: 6, padding: '10px 14px', marginTop: 10, fontSize: 13, fontWeight: 700 }}>
          {data.answer_key}
        </div>
      )}
    </div>
  );
}

function PdfSimple({ result, isAnswer, title, id }: { result: WorkbookResult; isAnswer: boolean; title: string; id: string }) {
  return (
    <div id={id} style={PDF_BASE}>
      <h2 style={PDF_H2}>{title}{isAnswer ? ' (정답)' : ''}</h2>
      <p style={PDF_P}>{result.passage as string}</p>
      {isAnswer && (
        <div style={{ marginTop: 14, padding: '10px 14px', background: '#FFF9C4', borderRadius: 6, fontSize: 13, fontWeight: 700 }}>
          {result.answer_key as string}
        </div>
      )}
    </div>
  );
}

function PdfCombo({ result, type, isAnswer, title, id }: { result: WorkbookResult; type: WorkbookType; isAnswer: boolean; title: string; id: string }) {
  const s1 = (result.section1 ?? {}) as WorkbookResult;
  const s2 = (result.section2 ?? {}) as WorkbookResult;
  const [t1, t2] = type === 'combo_vocab_grammar' ? ['vocab_choice', 'grammar_choice']
    : type === 'combo_vocab_fill'    ? ['vocab_choice', 'vocab_fill']
    : type === 'combo_grammar_order' ? ['grammar_correct', 'word_order']
    :                                  ['grammar_choice', 'sentence_insertion'];
  return (
    <div id={id} style={PDF_BASE}>
      <h2 style={PDF_H2}>{title} — {TYPE_LABELS[type]}{isAnswer ? ' (정답)' : ''}</h2>
      <div style={{ marginBottom: 20 }}>
        <p style={{ fontWeight: 900, fontSize: 12, color: '#4F46E5', marginBottom: 8 }}>Section 1 — {TYPE_LABELS[t1 as WorkbookType]}</p>
        <PdfResultContent result={s1} type={t1 as WorkbookType} isAnswer={isAnswer} title="" id="" embedded />
      </div>
      <div style={{ borderTop: '2px solid #E5E7EB', paddingTop: 16 }}>
        <p style={{ fontWeight: 900, fontSize: 12, color: '#7C3AED', marginBottom: 8 }}>Section 2 — {TYPE_LABELS[t2 as WorkbookType]}</p>
        <PdfResultContent result={s2} type={t2 as WorkbookType} isAnswer={isAnswer} title="" id="" embedded />
      </div>
    </div>
  );
}

function PdfResultContent({ result, type, isAnswer, title, id, embedded }: {
  result: WorkbookResult; type: WorkbookType; isAnswer: boolean; title: string; id: string; embedded?: boolean;
}) {
  const style = embedded ? {} : PDF_BASE;
  const wrap = (content: React.ReactNode) =>
    embedded ? <div style={style}>{content}</div> : <div id={id} style={style}>{content}</div>;

  const h2 = !embedded ? <h2 style={PDF_H2}>{title}{isAnswer ? ' (정답)' : ''}</h2> : null;

  switch (type) {
    case 'vocab_choice':
    case 'grammar_choice': {
      const chunks = parseVocabPassage(result.passage as string || '', result.answer_key as string || '');
      const cb: React.CSSProperties = { background: '#FFF9C4', borderRadius: 3, padding: '1px 4px', margin: '0 1px' };
      return wrap(<>{h2}<p style={PDF_P}>{chunks.map((c, i) => {
        if (c.type === 'text') return <span key={i}>{c.text}</span>;
        const opts = [c.a, c.b, c.c].filter((o): o is string => o !== undefined);
        if (isAnswer) return <span key={i} style={cb}>{c.num}[{opts.map((opt, j) => (
          <span key={j}>{j > 0 && ' / '}{j === c.correctIdx
            ? <span style={{ fontWeight: 900, textDecoration: 'underline' }}>{opt}</span>
            : <span style={{ color: '#999', textDecoration: 'line-through' }}>{opt}</span>}
          </span>
        ))}]</span>;
        return <span key={i} style={cb}>{c.num}[{opts.join(' / ')}]</span>;
      })}</p>{isAnswer && <div style={{ marginTop: 14, padding: '10px 14px', background: '#f8f8f8', borderRadius: 6, fontSize: 12, lineHeight: 1.8 }}><strong>정답:</strong> {result.answer_key as string}</div>}</>);
    }
    case 'word_order': {
      const sentences = (result.sentences ?? []) as Array<{num:number;ko:string;scrambled:string[];answer:string}>;
      return wrap(<>{h2}<div style={{ display:'flex',flexDirection:'column',gap:10 }}>{sentences.map((s,i)=>(
        <div key={i}><p style={{margin:'0 0 4px',fontSize:12,fontWeight:700}}>{s.num}. {s.ko}</p>
        <div style={{display:'flex',flexWrap:'wrap',gap:4,marginBottom:4}}>{(s.scrambled||[]).map((w,j)=>(
          <span key={j} style={{background:'#EEF2FF',border:'1px solid #A5B4FC',borderRadius:4,padding:'2px 8px',fontSize:12,fontWeight:700}}>{w}</span>
        ))}</div>
        {isAnswer&&<p style={{margin:'2px 0 0',fontSize:12,fontWeight:900,color:'#92400E'}}>→ {s.answer}</p>}
        </div>
      ))}</div></>);
    }
    case 'sentence_insertion': {
      const data = result as {insert_sentence:string;passage:string;answer_key:string};
      return wrap(<>{h2}
        <div style={{background:'#F5F3FF',border:'2px solid #A78BFA',borderRadius:6,padding:'10px 14px',marginBottom:14,fontSize:13,fontStyle:'italic',lineHeight:1.7}}>{data.insert_sentence}</div>
        <p style={PDF_P}>{data.passage}</p>
        {isAnswer&&<div style={{background:'#FFF9C4',borderRadius:6,padding:'10px 14px',marginTop:10,fontSize:13,fontWeight:700}}>{data.answer_key}</div>}
      </>);
    }
    case 'grammar_correct':
    case 'grammar_correct_adv': {
      const passage = result.passage as string || '';
      const answerKey = result.answer_key as string || '';
      const regex2 = /([①②③④⑤⑥⑦⑧⑨⑩⑪⑫])\[([^\]]+)\]/g;
      const parts2: React.ReactNode[] = [];
      let last2 = 0; let m2: RegExpExecArray | null;
      while ((m2 = regex2.exec(passage)) !== null) {
        if (m2.index > last2) parts2.push(<span key={last2}>{passage.slice(last2, m2.index)}</span>);
        const circle = m2[1]; const word = m2[2];
        const ansLine = answerKey.split('\n').find(l => l.startsWith(circle));
        const correct = ansLine?.split('→')[1]?.trim() ?? '';
        if (isAnswer) parts2.push(<span key={m2.index} style={{background:'#FEE2E2',borderRadius:3,padding:'0 3px'}}>{circle}<span style={{textDecoration:'line-through',color:'#EF4444'}}>{word}</span>{correct&&<span style={{color:'#16A34A',fontWeight:900}}>→{correct}</span>}</span>);
        else parts2.push(<span key={m2.index} style={{background:'#FFF9C4',borderRadius:3,padding:'0 3px'}}>{circle}[{word}]</span>);
        last2 = m2.index + m2[0].length;
      }
      if (last2 < passage.length) parts2.push(<span key={last2}>{passage.slice(last2)}</span>);
      return wrap(<>{h2}<p style={PDF_P}>{parts2}</p>{isAnswer&&<div style={{marginTop:14,padding:'10px 14px',background:'#f8f8f8',borderRadius:6,fontSize:12,lineHeight:1.8}}><strong>정답:</strong><br/><pre style={{margin:0,fontFamily:'inherit'}}>{answerKey}</pre></div>}</>);
    }
    default:
      return wrap(<>{h2}<p style={PDF_P}>{result.passage as string}</p>{isAnswer&&<div style={{marginTop:14,padding:'10px 14px',background:'#FFF9C4',borderRadius:6,fontSize:13,fontWeight:700}}>{result.answer_key as string}</div>}</>);
  }
}

// ─── main component ───────────────────────────────────────────────────────────

export default function WorkbookPage() {
  const [activeTab, setActiveTab] = useState<'input' | 'mock' | 'history'>('input');
  const [session, setSession] = useState<Session | null>(null);

  // Input tab: multi-passage
  const [passages, setPassages] = useState<PassageCard[]>([newPassageCard()]);
  const [inputTitle, setInputTitle] = useState('');

  // Mock tab
  const [mockTitle, setMockTitle] = useState('');
  const [years, setYears] = useState<number[]>([]);
  const [grades, setGrades] = useState<string[]>([]);
  const [institutions, setInstitutions] = useState<string[]>([]);
  const [questionNumbers, setQuestionNumbers] = useState<number[]>([]);
  const [selectedYear, setSelectedYear] = useState('');
  const [selectedGrade, setSelectedGrade] = useState('');
  const [selectedInstitution, setSelectedInstitution] = useState('');
  const [selectedNumbers, setSelectedNumbers] = useState<string[]>([]);
  const [passageMap, setPassageMap] = useState<Record<string, string>>({});
  const [loadingNumbers, setLoadingNumbers] = useState<Set<string>>(new Set());

  // Shared: type, difficulty, generation
  const [selectedCategory, setSelectedCategory] = useState('vocab');
  const [workbookType, setWorkbookType] = useState<WorkbookType>('vocab_choice');
  const [difficulty, setDifficulty] = useState<Difficulty>('b2');
  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState('');
  const [results, setResults] = useState<WorkbookResult[]>([]);
  const [activeResultTab, setActiveResultTab] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);
  const [pricePerUse, setPricePerUse] = useState(20);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [downloadingAnswerPdf, setDownloadingAnswerPdf] = useState(false);
  const [savingHistory, setSavingHistory] = useState(false);

  // History tab
  const [historyList, setHistoryList] = useState<HistoryItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState('');
  const [searchDate, setSearchDate] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session: s } }) => { if (s) setSession(s); });
  }, []);

  useEffect(() => {
    fetch('/api/credits/pricing').then(r => r.ok ? r.json() : null).then(data => {
      const item = (data?.pricing ?? []).find((p: { feature_key: string; cost_per_use: number }) => p.feature_key === 'vocab_choice');
      if (item) setPricePerUse(item.cost_per_use);
    }).catch(() => {});
  }, []);

  // Mock cascade selectors
  useEffect(() => {
    supabase.from('mock_exam_passages').select('year').order('year', { ascending: false })
      .then(({ data }) => { setYears([...new Set((data ?? []).map((r: { year: number }) => r.year))]); });
  }, []);
  useEffect(() => {
    if (!selectedYear) return;
    setSelectedGrade(''); setSelectedInstitution(''); setSelectedNumbers([]); setPassageMap({});
    supabase.from('mock_exam_passages').select('grade').eq('year', parseInt(selectedYear))
      .then(({ data }) => { setGrades([...new Set((data ?? []).map((r: { grade: string }) => r.grade))]); });
  }, [selectedYear]);
  useEffect(() => {
    if (!selectedYear || !selectedGrade) return;
    setSelectedInstitution(''); setSelectedNumbers([]); setPassageMap({});
    supabase.from('mock_exam_passages').select('institution').eq('year', parseInt(selectedYear)).eq('grade', selectedGrade)
      .then(({ data }) => {
        const unique = [...new Set((data ?? []).map((r: { institution: string }) => r.institution))];
        unique.sort((a, b) => (parseInt(a.match(/^(\d+)/)?.[1] ?? '99')) - (parseInt(b.match(/^(\d+)/)?.[1] ?? '99')));
        setInstitutions(unique);
      });
  }, [selectedYear, selectedGrade]);
  useEffect(() => {
    if (!selectedYear || !selectedGrade || !selectedInstitution) return;
    setSelectedNumbers([]); setPassageMap({});
    supabase.from('mock_exam_passages').select('question_number')
      .eq('year', parseInt(selectedYear)).eq('grade', selectedGrade).eq('institution', selectedInstitution)
      .order('question_number')
      .then(({ data }) => { setQuestionNumbers((data ?? []).map((r: { question_number: number }) => r.question_number)); });
  }, [selectedYear, selectedGrade, selectedInstitution]);

  const toggleNumber = async (num: string) => {
    if (selectedNumbers.includes(num)) {
      setSelectedNumbers(prev => prev.filter(n => n !== num));
      setPassageMap(prev => { const next = { ...prev }; delete next[num]; return next; });
    } else {
      setSelectedNumbers(prev => [...prev, num]);
      setLoadingNumbers(prev => new Set([...prev, num]));
      const { data } = await supabase.from('mock_exam_passages').select('passage_text')
        .eq('year', parseInt(selectedYear)).eq('grade', selectedGrade).eq('institution', selectedInstitution)
        .eq('question_number', parseInt(num)).single();
      setPassageMap(prev => ({ ...prev, [num]: data?.passage_text ?? '' }));
      setLoadingNumbers(prev => { const next = new Set(prev); next.delete(num); return next; });
    }
  };

  // Passage card handlers
  const updatePassage = (id: string, updates: Partial<PassageCard>) => {
    setPassages(prev => prev.map(p => p.id === id ? { ...p, ...updates } : p));
  };
  const addPassage = () => {
    if (passages.length >= 10) return;
    setPassages(prev => [...prev, newPassageCard()]);
  };
  const removePassage = (id: string) => {
    if (passages.length <= 1) return;
    setPassages(prev => prev.filter(p => p.id !== id));
  };

  const handleImageSelect = (id: string, file: File) => {
    if (!['image/jpeg', 'image/png', 'image/gif', 'image/webp'].includes(file.type)) {
      setGenerateError('JPG, PNG, GIF, WebP 형식만 지원합니다.'); return;
    }
    if (file.size > 10 * 1024 * 1024) { setGenerateError('이미지 파일이 너무 큽니다. (최대 10MB)'); return; }
    const card = passages.find(p => p.id === id);
    if (card?.imagePreview) URL.revokeObjectURL(card.imagePreview);
    updatePassage(id, { imageFile: file, imagePreview: URL.createObjectURL(file), ocrText: '', ocrDone: false });
  };

  const handleOCR = async (id: string) => {
    const card = passages.find(p => p.id === id);
    if (!card?.imageFile) return;
    updatePassage(id, { ocrLoading: true });
    setGenerateError('');
    try {
      const fd = new FormData();
      fd.append('image', card.imageFile);
      const res = await fetch('/api/ocr', { method: 'POST', body: fd });
      const json = await res.json() as { text?: string; error?: string };
      if (!res.ok) throw new Error(json.error || 'OCR 오류');
      updatePassage(id, { ocrText: json.text ?? '', ocrDone: true, ocrLoading: false });
    } catch (e) {
      setGenerateError(e instanceof Error ? e.message : 'OCR 오류');
      updatePassage(id, { ocrLoading: false });
    }
  };

  const handleGenerate = async () => {
    if (!session) { setGenerateError('로그인이 필요합니다.'); return; }
    setGenerateError('');

    let passageTexts: string[] = [];
    if (activeTab === 'input') {
      passageTexts = passages.map(p => effectiveText(p).trim()).filter(t => t.length >= 50);
      if (passageTexts.length === 0) { setGenerateError('지문을 입력해주세요. (최소 50자)'); return; }
    } else {
      const sortedNums = [...selectedNumbers].sort((a, b) => parseInt(a) - parseInt(b));
      if (sortedNums.length === 0) { setGenerateError('문제번호를 선택해주세요.'); return; }
      passageTexts = sortedNums.map(n => passageMap[n]).filter(Boolean);
      if (passageTexts.length === 0) { setGenerateError('지문을 불러오는 중입니다.'); return; }
    }

    setGenerating(true);
    setResults([]);
    setActiveResultTab(0);
    setShowAnswer(false);

    try {
      const res = await fetch('/api/generate-workbook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          passages: passageTexts,
          type: workbookType,
          difficulty,
          academy_id: session.user.id,
        }),
      });
      const json = await res.json() as { success?: boolean; results?: WorkbookResult[]; error?: string; required?: number; balance?: number };
      if (!res.ok || !json.success) {
        if (json.error === 'INSUFFICIENT_CON') {
          throw new Error(`CON이 부족합니다. (필요: ${json.required}C, 보유: ${json.balance}C)`);
        }
        throw new Error(json.error || '생성 실패');
      }
      setResults(json.results ?? []);
      // Auto-save for vocab_choice type (backward compat)
      if (workbookType === 'vocab_choice' && json.results && json.results.length > 0) {
        const title = activeTab === 'input' ? inputTitle : mockTitle;
        setTimeout(() => autoSaveVocabChoice(json.results!, passageTexts, title), 1500);
      }
    } catch (e) {
      setGenerateError(e instanceof Error ? e.message : '오류가 발생했습니다.');
    } finally {
      setGenerating(false);
    }
  };

  const autoSaveVocabChoice = async (res: WorkbookResult[], passageTexts: string[], title: string) => {
    if (!session) return;
    setSavingHistory(true);
    try {
      for (let i = 0; i < res.length; i++) {
        const r = res[i];
        if (r.error || !r.passage) continue;
        const [problemBlob, answerBlob] = await Promise.all([
          capturePdfFromElement(`wb-pdf-problem-${i}`),
          capturePdfFromElement(`wb-pdf-answer-${i}`),
        ]);
        const toBase64 = (b: Blob) => new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve((reader.result as string).split(',')[1]);
          reader.onerror = reject;
          reader.readAsDataURL(b);
        });
        const [pdfBase64, answerPdfBase64] = await Promise.all([toBase64(problemBlob), toBase64(answerBlob)]);
        const passageFull = passageTexts[i] || '';
        await fetch('/api/save-vocab-choice-history', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
          body: JSON.stringify({
            pdfBase64, answerPdfBase64,
            title: title || null,
            passageExcerpt: passageFull.slice(0, 100),
            passageFull,
            sourceType: activeTab === 'input' ? 'input' : 'mock',
            year: activeTab === 'mock' && selectedYear ? parseInt(selectedYear) : null,
            grade: activeTab === 'mock' ? selectedGrade || null : null,
            institution: activeTab === 'mock' ? selectedInstitution || null : null,
            questionNumber: activeTab === 'mock' ? parseInt(selectedNumbers[i] || '0') || null : null,
            difficulty,
          }),
        });
      }
    } catch (e) {
      console.error('[workbook] auto-save failed:', e);
    } finally {
      setSavingHistory(false);
    }
  };

  const handleDownloadPdf = async (withAnswer: boolean) => {
    const r = results[activeResultTab];
    if (!r) return;
    const suffix = withAnswer ? 'answer' : 'problem';
    const id = `wb-pdf-${suffix}-${activeResultTab}`;
    if (withAnswer) setDownloadingAnswerPdf(true);
    else setDownloadingPdf(true);
    try {
      const blob = await capturePdfFromElement(id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const title = activeTab === 'input' ? inputTitle : mockTitle;
      const passageLabel = results.length > 1 ? `_지문${activeResultTab + 1}` : '';
      a.download = `${title || TYPE_LABELS[workbookType]}${passageLabel}${withAnswer ? '_정답' : '_문제'}.pdf`;
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {
      alert(e instanceof Error ? e.message : 'PDF 생성 실패');
    } finally {
      if (withAnswer) setDownloadingAnswerPdf(false);
      else setDownloadingPdf(false);
    }
  };

  // History
  const fetchHistory = useCallback(async (date = searchDate, query = searchQuery) => {
    if (!session) return;
    setHistoryLoading(true); setHistoryError('');
    try {
      let q = supabase.from('vocab_choice_history').select('*')
        .eq('academy_id', session.user.id).order('created_at', { ascending: false });
      if (date) q = q.gte('created_at', date).lt('created_at', new Date(new Date(date).getTime() + 86400000).toISOString());
      if (query) q = q.ilike('passage_full', `%${query}%`);
      const { data, error } = await q.limit(100);
      if (error) { setHistoryError(error.message); return; }
      setHistoryList((data || []) as HistoryItem[]);
    } catch (e) {
      setHistoryError(e instanceof Error ? e.message : '오류');
    } finally {
      setHistoryLoading(false);
    }
  }, [session, searchDate, searchQuery]);

  useEffect(() => { if (activeTab === 'history' && session) fetchHistory(); }, [activeTab, session, fetchHistory]);

  const downloadFromHistory = async (pdfPath: string, filename: string) => {
    if (!session) return;
    const res = await fetch('/api/get-signed-url', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ path: pdfPath, bucket: 'pdf-history' }),
    });
    const data = await res.json() as { signedUrl?: string };
    if (!data.signedUrl) { alert('다운로드 링크 생성 실패'); return; }
    const blob = await fetch(data.signedUrl).then(r => r.blob());
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url; link.download = filename;
    document.body.appendChild(link); link.click(); document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const deleteSelected = async () => {
    if (!session || selectedIds.size === 0) return;
    if (!confirm(`${selectedIds.size}개 항목을 삭제하시겠습니까?`)) return;
    setBulkDeleting(true);
    try {
      await fetch('/api/delete-vocab-choice-history', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ ids: [...selectedIds] }),
      });
      setSelectedIds(new Set()); fetchHistory();
    } finally { setBulkDeleting(false); }
  };

  const toggleSelect = (id: string) => setSelectedIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const toggleSelectAll = () => setSelectedIds(prev => prev.size === historyList.length ? new Set() : new Set(historyList.map(h => h.id)));

  // Derived
  const sortedSelectedNumbers = [...selectedNumbers].sort((a, b) => parseInt(a) - parseInt(b));
  const validInputPassages = passages.filter(p => effectiveText(p).trim().length >= 50);
  const validMockPassages = sortedSelectedNumbers.filter(n => passageMap[n]);
  const passageCount = activeTab === 'input' ? validInputPassages.length : validMockPassages.length;
  const totalCost = pricePerUse * Math.max(passageCount, 1);
  const canGenerate = !generating && (
    activeTab === 'input' ? validInputPassages.length > 0 :
    validMockPassages.length > 0 && loadingNumbers.size === 0
  );

  // ─── render ────────────────────────────────────────────────────────────────

  const currentCategory = CATEGORIES.find(c => c.key === selectedCategory) ?? CATEGORIES[0];

  return (
    <div className="min-h-screen bg-gray-50 pb-16">
      <div className="max-w-5xl mx-auto px-4 py-6 space-y-5">

        {/* Header */}
        <div>
          <h1 className="text-3xl font-black text-slate-800">📌 워크북</h1>
          <p className="text-sm text-slate-500 mt-1">영어 지문으로 다양한 유형의 워크북 문제를 AI가 자동 생성합니다</p>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-white rounded-2xl shadow-sm border border-gray-100 p-1.5">
          {([
            { key: 'input',   label: '✏️ 직접 입력' },
            { key: 'mock',    label: '📚 모의고사 지문' },
            { key: 'history', label: '📋 생성 이력' },
          ] as const).map(t => (
            <button key={t.key} onClick={() => setActiveTab(t.key)}
              className={`flex-1 py-2.5 text-sm font-black rounded-xl transition-all ${activeTab === t.key ? 'bg-indigo-600 text-white shadow' : 'text-slate-500 hover:bg-slate-50'}`}>
              {t.label}
            </button>
          ))}
        </div>

        {/* ── 직접 입력 탭 ── */}
        {activeTab === 'input' && (
          <div className="space-y-4">
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 space-y-4">
              <div>
                <label className="block text-xs font-black text-slate-500 mb-1.5">제목 (선택)</label>
                <input type="text" placeholder="예: 2024 수능 18번" value={inputTitle}
                  onChange={e => setInputTitle(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-indigo-300" />
              </div>

              {/* Passage cards */}
              <div className="space-y-4">
                {passages.map((card, cardIdx) => (
                  <div key={card.id} className="border border-gray-200 rounded-2xl p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black text-indigo-600">지문 {cardIdx + 1}</span>
                      {passages.length > 1 && (
                        <button onClick={() => removePassage(card.id)}
                          className="text-xs font-black text-slate-400 hover:text-rose-500 transition-colors px-2 py-1 hover:bg-rose-50 rounded-lg">
                          × 삭제
                        </button>
                      )}
                    </div>

                    {/* Mode toggle */}
                    <div className="flex gap-2 bg-slate-100 p-1 rounded-xl w-fit">
                      {([['text', '✏️ 텍스트'], ['image', '📷 사진']] as const).map(([mode, label]) => (
                        <button key={mode} onClick={() => updatePassage(card.id, { mode })}
                          className={`px-4 py-2 rounded-lg font-black text-xs transition-all ${card.mode === mode ? 'bg-white text-indigo-600 shadow-md' : 'text-slate-500 hover:text-slate-700'}`}>
                          {label}
                        </button>
                      ))}
                    </div>

                    {card.mode === 'text' && (
                      <div>
                        <textarea rows={7} placeholder="영어 지문을 붙여넣으세요..."
                          value={card.text}
                          onChange={e => updatePassage(card.id, { text: e.target.value })}
                          className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-indigo-300 resize-y" />
                        <p className="text-xs text-slate-400 font-bold text-right mt-1">{card.text.trim().length}자</p>
                      </div>
                    )}

                    {card.mode === 'image' && (
                      <div className="space-y-3">
                        <label
                          onDragOver={e => { e.preventDefault(); updatePassage(card.id, { isDragging: true }); }}
                          onDragLeave={() => updatePassage(card.id, { isDragging: false })}
                          onDrop={e => { e.preventDefault(); updatePassage(card.id, { isDragging: false }); const f = e.dataTransfer.files[0]; if (f) handleImageSelect(card.id, f); }}
                          className={`block w-full border-4 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all
                            ${card.isDragging ? 'border-indigo-500 bg-indigo-50' : card.imageFile ? 'border-emerald-300 bg-emerald-50/50' : 'border-indigo-200 hover:border-indigo-400 hover:bg-indigo-50/50'}`}>
                          <div className="text-4xl mb-2">{card.imageFile ? '🖼️' : '📷'}</div>
                          {card.imageFile
                            ? <><p className="font-black text-emerald-700">{card.imageFile.name}</p><p className="text-xs text-slate-400 mt-1">다른 사진으로 변경하려면 클릭</p></>
                            : <><p className="font-black text-slate-600">사진 클릭 또는 드래그</p><p className="text-xs text-slate-400 mt-1">JPG · PNG · WebP · 최대 10MB</p></>
                          }
                          <input type="file" accept="image/*" className="hidden"
                            onChange={e => { const f = e.target.files?.[0]; if (f) handleImageSelect(card.id, f); }} />
                        </label>

                        {card.imageFile && card.imagePreview && (
                          <div className="flex flex-col md:flex-row gap-4">
                            <div className="md:w-1/2 rounded-2xl overflow-hidden border-2 border-slate-100 bg-slate-50 flex items-center justify-center min-h-[160px]">
                              <Image src={card.imagePreview} alt="업로드 이미지" width={500} height={300} className="max-h-64 object-contain w-full" unoptimized />
                            </div>
                            <div className="md:w-1/2 flex flex-col gap-2">
                              {!card.ocrDone ? (
                                <div className="flex-1 flex flex-col items-center justify-center p-6 bg-indigo-50 rounded-2xl border-2 border-dashed border-indigo-200">
                                  <p className="font-black text-indigo-500 text-center mb-3 text-sm">AI가 텍스트를 자동 추출해드려요</p>
                                  <button onClick={() => handleOCR(card.id)} disabled={card.ocrLoading}
                                    className="bg-indigo-600 text-white px-6 py-2.5 rounded-2xl font-black text-sm hover:bg-indigo-700 transition-all disabled:opacity-50">
                                    {card.ocrLoading ? '⏳ 추출 중...' : '🔍 텍스트 추출'}
                                  </button>
                                </div>
                              ) : (
                                <div className="flex flex-col gap-2">
                                  <div className="flex items-center justify-between">
                                    <p className="font-black text-emerald-600 text-xs">✅ 추출 완료 — 수정 후 생성하세요</p>
                                    <button onClick={() => updatePassage(card.id, { ocrDone: false, ocrText: '' })}
                                      className="text-xs font-black text-slate-400 hover:text-rose-500">다시 추출</button>
                                  </div>
                                  <textarea value={card.ocrText} onChange={e => updatePassage(card.id, { ocrText: e.target.value })} rows={8}
                                    className="w-full p-3 border-2 border-emerald-200 rounded-2xl font-mono text-sm text-slate-700 resize-y focus:outline-none focus:border-indigo-400 bg-emerald-50/30" />
                                  <p className="text-xs text-slate-400 font-bold text-right">{card.ocrText.trim().length}자</p>
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}

                {passages.length < 10 && (
                  <button onClick={addPassage}
                    className="w-full py-3 border-2 border-dashed border-indigo-200 rounded-2xl text-sm font-black text-indigo-500 hover:border-indigo-400 hover:bg-indigo-50 transition-all">
                    + 지문 추가 ({passages.length}/10)
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── 모의고사 지문 탭 ── */}
        {activeTab === 'mock' && (
          <div className="space-y-4">
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 space-y-4">
              <div>
                <label className="block text-xs font-black text-slate-500 mb-1.5">제목 (선택)</label>
                <input type="text" placeholder="예: 2024년 고1 3월 18번" value={mockTitle}
                  onChange={e => setMockTitle(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-indigo-300" />
              </div>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: '년도', value: selectedYear, onChange: setSelectedYear, disabled: false, options: years.map(y => ({ value: String(y), label: `${y}년` })) },
                  { label: '학년', value: selectedGrade, onChange: setSelectedGrade, disabled: !selectedYear, options: grades.map(g => ({ value: g, label: g })) },
                  { label: '시험명/기관', value: selectedInstitution, onChange: setSelectedInstitution, disabled: !selectedGrade, options: institutions.map(i => ({ value: i, label: i })) },
                ].map(({ label, value, onChange, disabled, options }) => (
                  <div key={label}>
                    <label className="block text-xs font-black text-slate-500 mb-1">{label}</label>
                    <select value={value} onChange={e => onChange(e.target.value)} disabled={disabled}
                      className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white disabled:bg-gray-50 disabled:text-slate-300">
                      <option value="">선택</option>
                      {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  </div>
                ))}
              </div>
              {questionNumbers.length > 0 && (
                <div>
                  <label className="block text-xs font-black text-slate-500 mb-2">문제번호 (여러 개 선택 가능)</label>
                  <div className="flex flex-wrap gap-2">
                    {questionNumbers.map(n => {
                      const num = String(n);
                      const isSelected = selectedNumbers.includes(num);
                      const isLoading = loadingNumbers.has(num);
                      return (
                        <button key={n} onClick={() => toggleNumber(num)} disabled={isLoading}
                          className={`px-3 py-1.5 rounded-xl text-sm font-black border-2 transition-all ${
                            isSelected ? 'bg-indigo-600 border-indigo-600 text-white shadow-sm' : 'bg-white border-slate-200 text-slate-600 hover:border-indigo-300'
                          } ${isLoading ? 'opacity-50 cursor-wait' : ''}`}>
                          {isLoading ? '...' : `${n}번`}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
              {sortedSelectedNumbers.length > 0 && (
                <div className="space-y-2">
                  {sortedSelectedNumbers.map(num => (
                    passageMap[num] && (
                      <div key={num} className="bg-slate-50 border border-slate-200 rounded-xl p-3">
                        <div className="flex items-center justify-between mb-1">
                          <p className="text-xs font-black text-indigo-600">{num}번 지문</p>
                          <p className="text-xs text-slate-400 font-bold">{passageMap[num].trim().length}자</p>
                        </div>
                        <p className="text-sm text-slate-600 font-medium leading-relaxed select-none"
                          style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' } as React.CSSProperties}
                          onContextMenu={e => e.preventDefault()} onDragStart={e => e.preventDefault()}>
                          {passageMap[num]}
                        </p>
                      </div>
                    )
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── 유형 선택 (입력/모의고사 탭 공통) ── */}
        {activeTab !== 'history' && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 space-y-4">
            <label className="block text-xs font-black text-slate-500">유형 선택</label>

            {/* Category buttons */}
            <div className="flex flex-wrap gap-2">
              {CATEGORIES.map(cat => (
                <button key={cat.key}
                  onClick={() => {
                    setSelectedCategory(cat.key);
                    setWorkbookType(cat.types[0].key);
                  }}
                  className={`px-4 py-2 rounded-xl text-sm font-black border-2 transition-all ${
                    selectedCategory === cat.key ? 'bg-indigo-600 border-indigo-600 text-white shadow-sm' : 'bg-white border-slate-200 text-slate-600 hover:border-indigo-300'
                  }`}>
                  {cat.label}
                </button>
              ))}
            </div>

            {/* Sub-type buttons */}
            <div className="flex flex-wrap gap-2">
              {currentCategory.types.map(t => (
                <button key={t.key}
                  onClick={() => setWorkbookType(t.key)}
                  className={`px-4 py-2 rounded-xl text-sm font-black border-2 transition-all ${
                    workbookType === t.key ? 'bg-slate-900 border-slate-900 text-white shadow-sm' : 'bg-white border-slate-200 text-slate-600 hover:border-slate-400'
                  }`}>
                  {t.label}
                </button>
              ))}
            </div>

            {/* Difficulty */}
            <div>
              <label className="block text-xs font-black text-slate-500 mb-2">난이도</label>
              <div className="flex gap-2">
                {DIFF_CARDS.map(d => (
                  <button key={d.key} onClick={() => setDifficulty(d.key)}
                    className={`flex-1 py-3 rounded-xl font-black border-2 text-center transition-all ${difficulty === d.key ? d.active : 'border-gray-200 bg-white text-slate-500 hover:bg-gray-50'}`}>
                    <div className="text-xl mb-0.5">{d.icon}</div>
                    <div className="text-xs font-bold opacity-70">{d.level}</div>
                    <div className="text-xs">{d.label}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Cost info */}
            <p className="text-center text-sm font-bold text-slate-400">
              지문 {passageCount > 0 ? passageCount : 1}개 × <span className="text-yellow-500 font-black">{pricePerUse}C</span>
              {passageCount > 1 && <span className="text-slate-500"> = <span className="text-yellow-500 font-black">{totalCost}C</span></span>}
            </p>

            <button onClick={handleGenerate} disabled={!canGenerate}
              className="w-full py-4 text-base font-black bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl transition-all disabled:opacity-50 shadow-lg shadow-indigo-200">
              {generating
                ? `⏳ AI가 생성 중... (${results.length}/${passageCount})`
                : `✨ ${TYPE_LABELS[workbookType]} 생성하기 (${totalCost}C)`}
            </button>
          </div>
        )}

        {/* Error */}
        {generateError && (
          <div className="bg-rose-50 border border-rose-200 rounded-2xl px-5 py-4">
            <p className="text-rose-600 font-black text-sm">⚠️ {generateError}</p>
          </div>
        )}

        {/* ── Results ── */}
        {results.length > 0 && activeTab !== 'history' && (
          <div className="space-y-3">
            {results.length > 1 && (
              <div className="flex gap-1 bg-white rounded-2xl shadow-sm border border-gray-100 p-1.5">
                {results.map((_, idx) => (
                  <button key={idx} onClick={() => setActiveResultTab(idx)}
                    className={`flex-1 py-2 text-sm font-black rounded-xl transition-all ${activeResultTab === idx ? 'bg-slate-900 text-white shadow' : 'text-slate-500 hover:bg-slate-50'}`}>
                    지문 {idx + 1}
                  </button>
                ))}
              </div>
            )}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-3">
                  <span className="font-black text-slate-800">
                    {TYPE_LABELS[workbookType]}
                    {results.length > 1 ? ` — 지문 ${activeResultTab + 1}` : ''} 생성 완료
                  </span>
                  {savingHistory && <span className="text-xs font-bold text-slate-400 animate-pulse">저장 중...</span>}
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  {workbookType !== 'passage_translation' && (
                    <button onClick={() => setShowAnswer(!showAnswer)}
                      className={`px-4 py-2 text-xs font-black rounded-xl transition-all ${showAnswer ? 'bg-yellow-500 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
                      {showAnswer ? '✅ 정답 표시 중' : '정답 보기'}
                    </button>
                  )}
                  <button onClick={() => handleDownloadPdf(false)} disabled={downloadingPdf}
                    className="px-4 py-2 text-xs font-black bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl transition-all disabled:opacity-50">
                    {downloadingPdf ? '생성 중...' : '⬇️ 문제 PDF'}
                  </button>
                  {workbookType !== 'passage_translation' && (
                    <button onClick={() => handleDownloadPdf(true)} disabled={downloadingAnswerPdf}
                      className="px-4 py-2 text-xs font-black bg-violet-600 hover:bg-violet-700 text-white rounded-xl transition-all disabled:opacity-50">
                      {downloadingAnswerPdf ? '생성 중...' : '⬇️ 정답 PDF'}
                    </button>
                  )}
                </div>
              </div>
              <div className="px-5 py-5">
                <RenderResultContent result={results[activeResultTab]} type={workbookType} showAnswer={showAnswer} />
              </div>
            </div>
          </div>
        )}

        {/* ── 생성 이력 탭 ── */}
        {activeTab === 'history' && (
          <div className="space-y-4">
            <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-2.5 text-xs font-bold text-amber-700">
              생성 이력은 생성일로부터 30일 후 자동 삭제됩니다. (어휘 선택 유형 이력 표시)
            </div>
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 flex flex-wrap gap-3 items-end">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-black text-slate-500">날짜</label>
                <input type="date" value={searchDate} onChange={e => setSearchDate(e.target.value)}
                  className="px-3 py-2 border border-gray-200 rounded-xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-indigo-300" />
              </div>
              <div className="flex flex-col gap-1 flex-1 min-w-[180px]">
                <label className="text-xs font-black text-slate-500">키워드 검색</label>
                <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && fetchHistory()}
                  placeholder="지문 내 단어를 입력하세요..."
                  className="px-3 py-2 border border-gray-200 rounded-xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-indigo-300" />
              </div>
              <button onClick={() => fetchHistory()} disabled={historyLoading}
                className="px-4 py-2 bg-indigo-600 text-white text-sm font-black rounded-xl hover:bg-indigo-700 disabled:opacity-50">
                🔍 검색
              </button>
              {(searchDate || searchQuery) && (
                <button onClick={() => { setSearchDate(''); setSearchQuery(''); fetchHistory('', ''); }}
                  className="px-4 py-2 bg-gray-100 text-gray-600 text-sm font-black rounded-xl hover:bg-gray-200">
                  초기화
                </button>
              )}
            </div>
            {historyError && <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl"><p className="text-rose-600 font-black">⚠️ {historyError}</p></div>}
            {selectedIds.size > 0 && (
              <div className="flex items-center gap-3 px-5 py-3 bg-indigo-50 border border-indigo-200 rounded-2xl">
                <span className="font-black text-indigo-700 text-sm">{selectedIds.size}개 선택됨</span>
                <div className="flex gap-2 ml-auto">
                  <button onClick={deleteSelected} disabled={bulkDeleting}
                    className="px-4 py-2 bg-rose-500 text-white rounded-xl font-black text-sm hover:bg-rose-600 disabled:opacity-50">
                    {bulkDeleting ? '삭제 중...' : '삭제'}
                  </button>
                  <button onClick={() => setSelectedIds(new Set())} className="px-4 py-2 bg-slate-100 text-slate-500 rounded-xl font-black text-sm">취소</button>
                </div>
              </div>
            )}
            {historyLoading ? (
              <div className="flex justify-center py-16"><div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" /></div>
            ) : historyList.length === 0 ? (
              <div className="bg-white rounded-[2rem] p-16 text-center shadow-lg border border-slate-100">
                <p className="text-5xl mb-4">📭</p>
                <p className="font-black text-slate-500 text-lg">생성된 이력이 없습니다</p>
              </div>
            ) : (
              <div className="bg-white rounded-[2rem] shadow-lg border border-slate-100 overflow-hidden">
                <div className="grid grid-cols-[32px_140px_160px_1fr_52px_64px_64px] gap-2 px-4 py-3 bg-slate-50 border-b border-slate-100 text-xs font-black text-slate-500">
                  <input type="checkbox" checked={selectedIds.size === historyList.length && historyList.length > 0} onChange={toggleSelectAll}
                    className="w-4 h-4 rounded accent-indigo-600 cursor-pointer mt-0.5" />
                  {['날짜', '제목', '지문 요약', '난이도', '문제', '정답'].map((h, i) => <span key={i} className={i >= 4 ? 'text-center' : ''}>{h}</span>)}
                </div>
                {historyList.map((item, i) => (
                  <div key={item.id}
                    className={`grid grid-cols-[32px_140px_160px_1fr_52px_64px_64px] gap-2 px-4 py-3 items-center border-b border-slate-100 last:border-0 hover:bg-indigo-50/40
                      ${selectedIds.has(item.id) ? 'bg-indigo-50' : i % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}`}>
                    <input type="checkbox" checked={selectedIds.has(item.id)} onChange={() => toggleSelect(item.id)}
                      className="w-4 h-4 rounded accent-indigo-600 cursor-pointer" />
                    <span className="text-xs font-bold text-slate-600 whitespace-nowrap">
                      {new Date(item.created_at).toLocaleString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
                    </span>
                    <span className="text-sm font-bold text-slate-700 truncate">{item.title || <span className="text-slate-300">-</span>}</span>
                    <span className="text-xs text-slate-500 font-bold truncate">{item.passage_excerpt}</span>
                    <span className={`text-xs font-black px-2 py-1 rounded-full text-center ${DIFF_COLORS[item.difficulty] ?? 'bg-slate-100 text-slate-600'}`}>
                      {item.difficulty?.toUpperCase() || '-'}
                    </span>
                    <div className="flex justify-center">
                      {item.pdf_path
                        ? <button onClick={() => downloadFromHistory(item.pdf_path!, `${item.title || '워크북'}_문제.pdf`)}
                            className="px-2 py-1 bg-indigo-100 hover:bg-indigo-200 text-indigo-700 rounded-lg text-xs font-black w-full text-center">⬇️ 문제</button>
                        : <span className="text-xs text-slate-300 font-bold text-center w-full">저장중</span>}
                    </div>
                    <div className="flex justify-center">
                      {item.answer_pdf_path
                        ? <button onClick={() => downloadFromHistory(item.answer_pdf_path!, `${item.title || '워크북'}_정답.pdf`)}
                            className="px-2 py-1 bg-violet-100 hover:bg-violet-200 text-violet-700 rounded-lg text-xs font-black w-full text-center">⬇️ 정답</button>
                        : <span className="text-xs text-slate-300 font-bold text-center w-full">-</span>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── PDF 렌더 영역 (hidden, html-to-image 캡처용) ── */}
        {results.map((result, idx) => {
          const title = (activeTab === 'input' ? inputTitle : mockTitle) || TYPE_LABELS[workbookType];
          const passageLabel = results.length > 1 ? ` (지문 ${idx + 1})` : '';
          const fullTitle = `${title}${passageLabel}`;

          if (result.error) return null;

          if (workbookType.startsWith('combo_')) {
            return (
              <PdfCombo key={idx} result={result} type={workbookType} isAnswer={false} title={fullTitle} id={`wb-pdf-problem-${idx}`} />
            );
          }

          switch (workbookType) {
            case 'vocab_choice':
            case 'grammar_choice':
              return (
                <React.Fragment key={idx}>
                  <PdfVocabChoice result={result} isAnswer={false} title={fullTitle} id={`wb-pdf-problem-${idx}`} />
                  <PdfVocabChoice result={result} isAnswer={true} title={fullTitle} id={`wb-pdf-answer-${idx}`} />
                </React.Fragment>
              );
            case 'vocab_fill':
              return (
                <React.Fragment key={idx}>
                  <PdfVocabFill result={result} isAnswer={false} title={fullTitle} id={`wb-pdf-problem-${idx}`} />
                  <PdfVocabFill result={result} isAnswer={true} title={fullTitle} id={`wb-pdf-answer-${idx}`} />
                </React.Fragment>
              );
            case 'grammar_correct':
            case 'grammar_correct_adv':
              return (
                <React.Fragment key={idx}>
                  <PdfGrammarCorrect result={result} isAnswer={false} title={fullTitle} id={`wb-pdf-problem-${idx}`} />
                  <PdfGrammarCorrect result={result} isAnswer={true} title={fullTitle} id={`wb-pdf-answer-${idx}`} />
                </React.Fragment>
              );
            case 'translation':
              return (
                <React.Fragment key={idx}>
                  <PdfTranslation result={result} isAnswer={false} title={fullTitle} id={`wb-pdf-problem-${idx}`} />
                  <PdfTranslation result={result} isAnswer={true} title={fullTitle} id={`wb-pdf-answer-${idx}`} />
                </React.Fragment>
              );
            case 'word_order':
              return (
                <React.Fragment key={idx}>
                  <PdfWordOrder result={result} isAnswer={false} title={fullTitle} id={`wb-pdf-problem-${idx}`} />
                  <PdfWordOrder result={result} isAnswer={true} title={fullTitle} id={`wb-pdf-answer-${idx}`} />
                </React.Fragment>
              );
            case 'english_writing':
              return (
                <React.Fragment key={idx}>
                  <PdfEnglishWriting result={result} isAnswer={false} title={fullTitle} id={`wb-pdf-problem-${idx}`} />
                  <PdfEnglishWriting result={result} isAnswer={true} title={fullTitle} id={`wb-pdf-answer-${idx}`} />
                </React.Fragment>
              );
            case 'passage_translation':
              return <PdfPassageTranslation key={idx} result={result} id={`wb-pdf-problem-${idx}`} />;
            case 'paragraph_order':
              return (
                <React.Fragment key={idx}>
                  <PdfParagraphOrder result={result} isAnswer={false} title={fullTitle} id={`wb-pdf-problem-${idx}`} />
                  <PdfParagraphOrder result={result} isAnswer={true} title={fullTitle} id={`wb-pdf-answer-${idx}`} />
                </React.Fragment>
              );
            case 'sentence_insertion':
              return (
                <React.Fragment key={idx}>
                  <PdfSentenceInsertion result={result} isAnswer={false} title={fullTitle} id={`wb-pdf-problem-${idx}`} />
                  <PdfSentenceInsertion result={result} isAnswer={true} title={fullTitle} id={`wb-pdf-answer-${idx}`} />
                </React.Fragment>
              );
            default:
              return (
                <React.Fragment key={idx}>
                  <PdfSimple result={result} isAnswer={false} title={fullTitle} id={`wb-pdf-problem-${idx}`} />
                  <PdfSimple result={result} isAnswer={true} title={fullTitle} id={`wb-pdf-answer-${idx}`} />
                </React.Fragment>
              );
          }
        })}
        {/* combo answer PDFs */}
        {results.map((result, idx) => {
          if (!workbookType.startsWith('combo_') || result.error) return null;
          const title = (activeTab === 'input' ? inputTitle : mockTitle) || TYPE_LABELS[workbookType];
          const passageLabel = results.length > 1 ? ` (지문 ${idx + 1})` : '';
          return <PdfCombo key={`ans-${idx}`} result={result} type={workbookType} isAnswer={true} title={`${title}${passageLabel}`} id={`wb-pdf-answer-${idx}`} />;
        })}

      </div>
    </div>
  );
}
