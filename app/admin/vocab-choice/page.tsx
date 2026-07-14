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
  | 'passage_translation' | 'tf_questions' | 'title_summary' // kept in type for route compatibility
  | 'paragraph_order' | 'sentence_insertion' | 'summary_sentence' | 'passage_analysis'
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

interface TypeResult {
  type: WorkbookType;
  results: WorkbookResult[];
}

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
  { key: 'drill',    label: '지문 드릴',   types: [
    { key: 'passage_translation' as WorkbookType, label: '지문 해석지' },
    { key: 'passage_analysis' as WorkbookType,    label: '지문 구문분석' },
    { key: 'translation' as WorkbookType,         label: '문장 해석' },
    { key: 'word_order' as WorkbookType,          label: '단어 배열' },
    { key: 'english_writing' as WorkbookType,     label: '영작 하기' },
  ]},
  { key: 'vocab_grammar', label: '어휘 어법', types: [
    { key: 'vocab_choice' as WorkbookType,        label: '어휘 고르기' },
    { key: 'vocab_fill' as WorkbookType,          label: '어휘 채우기' },
    { key: 'grammar_choice' as WorkbookType,      label: '어법 고르기' },
    { key: 'grammar_correct' as WorkbookType,     label: '어법 고치기' },
    { key: 'grammar_correct_adv' as WorkbookType, label: '어법 고치기(심화)' },
  ]},
  { key: 'essay',    label: '서술형 대비', types: [
    { key: 'combo_grammar_order' as WorkbookType, label: '어법 서술형 + 순서배열' },
    { key: 'combo_vocab_fill' as WorkbookType,    label: '영작 서술형 + 어휘' },
    { key: 'summary_sentence' as WorkbookType,    label: '요약문 서술형' },
  ]},
  { key: 'hold',     label: '보류',        types: [
    { key: 'paragraph_order' as WorkbookType,     label: '문단 배열' },
    { key: 'sentence_insertion' as WorkbookType,  label: '문장 삽입' },
    { key: 'suneung_vocab_right' as WorkbookType,  label: '적절한 어휘' },
    { key: 'suneung_vocab_wrong' as WorkbookType,  label: '부적절한 어휘' },
    { key: 'suneung_grammar_right' as WorkbookType, label: '맞는 어법' },
    { key: 'suneung_grammar_wrong' as WorkbookType, label: '틀린 어법' },
    { key: 'combo_vocab_grammar' as WorkbookType,  label: '어휘+어법' },
    { key: 'combo_grammar_insert' as WorkbookType, label: '어법+문장삽입' },
  ]},
];

const TYPE_LABELS: Record<WorkbookType, string> = {
  vocab_choice: '어휘 고르기', vocab_fill: '어휘 채우기',
  grammar_choice: '어법 고르기', grammar_correct: '어법 고치기', grammar_correct_adv: '어법 고치기(심화)',
  translation: '문장 해석', word_order: '단어 배열', english_writing: '영작 하기',
  passage_translation: '지문 해석지', paragraph_order: '문단 배열', sentence_insertion: '문장 삽입', summary_sentence: '요약문 서술형', passage_analysis: '지문 구문분석',
  tf_questions: 'T/F 문제', title_summary: '제목/요약문',
  suneung_vocab_right: '적절한 어휘', suneung_vocab_wrong: '부적절한 어휘',
  suneung_grammar_right: '맞는 어법', suneung_grammar_wrong: '틀린 어법',
  combo_vocab_grammar: '어휘+어법', combo_vocab_fill: '영작 서술형 + 어휘',
  combo_grammar_order: '어법 서술형 + 순서배열', combo_grammar_insert: '어법+문장삽입',
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
  nums.forEach((n, i) => { answerMap[n] = (keyParts[i] || '').trim(); });

  const chunks: VocabChunk[] = [];
  // Allow one level of nested brackets (e.g. 19[further[s] / prevents])
  const choiceRegex = /(\d+)\[((?:[^\[\]]|\[[^\]]*\])+)\]/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = choiceRegex.exec(passage)) !== null) {
    if (match.index > lastIndex) chunks.push({ type: 'text', text: passage.slice(lastIndex, match.index) });
    const num = parseInt(match[1]);
    const opts = match[2].split(/\s*\/\s*/).map(o => o.trim()).filter(o => o !== '');
    const ans = answerMap[num] || '';
    const correctIdx = opts.findIndex(o => o.toLowerCase() === ans.toLowerCase());
    const [a, b, c] = opts;
    chunks.push({ type: 'choice', num, a, b, c, correctIdx: correctIdx >= 0 ? correctIdx : undefined });
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < passage.length) chunks.push({ type: 'text', text: passage.slice(lastIndex) });
  return chunks;
}

async function addElementToPdf(pdf: import('jspdf').jsPDF, elementId: string, isFirst: boolean): Promise<boolean> {
  const el = document.getElementById(elementId);
  if (!el) return false;
  const { toJpeg } = await import('html-to-image');
  const W = 210, M = 10, cW = W - 2 * M, maxH = 277;
  const url = await toJpeg(el, { pixelRatio: 2, quality: 0.92, backgroundColor: '#ffffff', cacheBust: true });
  const img = document.createElement('img') as HTMLImageElement;
  await new Promise<void>((resolve, reject) => { img.onload = () => resolve(); img.onerror = () => reject(new Error('img load')); img.src = url; });
  const contentH = cW * (img.naturalHeight / img.naturalWidth);
  if (!isFirst) pdf.addPage();
  if (contentH <= maxH) {
    pdf.addImage(url, 'JPEG', M, M, cW, contentH);
  } else {
    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth; canvas.height = img.naturalHeight;
    const ctx = canvas.getContext('2d')!; ctx.drawImage(img, 0, 0);
    const pagePixelH = Math.floor(img.naturalHeight * (maxH / contentH));
    let sliceY = 0; let firstSlice = true;
    while (sliceY < img.naturalHeight) {
      const sliceH = Math.min(pagePixelH, img.naturalHeight - sliceY);
      const sliceCanvas = document.createElement('canvas');
      sliceCanvas.width = img.naturalWidth; sliceCanvas.height = sliceH;
      const sliceCtx = sliceCanvas.getContext('2d')!;
      sliceCtx.drawImage(canvas, 0, sliceY, img.naturalWidth, sliceH, 0, 0, img.naturalWidth, sliceH);
      const sliceUrl = sliceCanvas.toDataURL('image/jpeg', 0.92);
      const sliceContentH = cW * (sliceH / img.naturalWidth);
      if (!firstSlice) pdf.addPage();
      pdf.addImage(sliceUrl, 'JPEG', M, M, cW, sliceContentH);
      sliceY += sliceH; firstSlice = false;
    }
  }
  return true;
}

async function capturePdfFromElement(elementId: string): Promise<Blob> {
  const { jsPDF } = await import('jspdf');
  const pdf = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });
  await addElementToPdf(pdf, elementId, true);
  return pdf.output('blob');
}

async function captureAllToPdf(elementIds: string[]): Promise<Blob> {
  const { jsPDF } = await import('jspdf');
  const pdf = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });
  let isFirst = true;
  for (const id of elementIds) {
    const added = await addElementToPdf(pdf, id, isFirst);
    if (added) isFirst = false;
  }
  return pdf.output('blob');
}

// ─── result renderers (screen) ────────────────────────────────────────────────

function splitBySentence(passage: string): string[] {
  const parts = passage.split(/\. /);
  return parts.map((p, i) => i < parts.length - 1 ? p + '.' : p).filter(s => s.trim());
}

function VocabChoiceChunks({ chunks, showAnswer }: { chunks: VocabChunk[]; showAnswer: boolean }) {
  return (
    <>
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
    </>
  );
}

function RenderVocabChoicePassage({ passage, answerKey, showAnswer }: { passage: string; answerKey: string; showAnswer: boolean }) {
  const sentences = splitBySentence(passage);
  return (
    <div className="space-y-2">
      {sentences.map((sentence, si) => (
        <p key={si} className="text-sm font-medium text-slate-800" style={{ lineHeight: 1.9, marginBottom: 4 }}>
          <VocabChoiceChunks chunks={parseVocabPassage(sentence, answerKey)} showAnswer={showAnswer} />
        </p>
      ))}
    </div>
  );
}

function buildVocabFillAnswerMap(answerKey: string): Record<number, string> {
  const map: Record<number, string> = {};
  const keyParts = answerKey.split(/\d+\.\s*/g).filter(Boolean);
  const nums = [...answerKey.matchAll(/(\d+)\./g)].map(m => parseInt(m[1]));
  nums.forEach((n, i) => { map[n] = (keyParts[i] || '').trim(); });
  return map;
}

function RenderVocabFillSentences({ sentences, answerKey, showAnswer, showKorean }: {
  sentences: Array<{en: string; ko: string}>; answerKey: string; showAnswer: boolean; showKorean: boolean;
}) {
  const answerMap = buildVocabFillAnswerMap(answerKey);
  return (
    <div className="space-y-2">
      {(sentences || []).map((s, si) => {
        const parts = s.en.split(/_\((\d+):([a-zA-Z])\)_/);
        return (
          <div key={si}>
            <p className="text-sm font-medium leading-8 text-slate-800">
              {parts.map((part, i) => {
                if (i % 3 === 0) return <span key={i}>{part}</span>;
                if (i % 3 === 2) return null;
                const num = parseInt(part);
                const letter = parts[i + 1] ?? '';
                const ans = answerMap[num] ?? '';
                return showAnswer ? (
                  <span key={i} className="inline-flex items-center gap-0.5 mx-0.5">
                    <span className="text-[10px] font-black text-slate-400">({num})</span>
                    <span className="px-1.5 py-0.5 bg-yellow-100 text-yellow-800 font-black text-xs rounded">{ans}</span>
                  </span>
                ) : (
                  <span key={i} className="inline-flex items-center mx-0.5">
                    <span className="text-[10px] font-black text-slate-400">({num})</span>
                    <span className="text-xs font-black text-slate-900">{letter}</span>
                    <span className="border-b-2 border-slate-400 inline-block w-16" />
                  </span>
                );
              })}
            </p>
            {showKorean && s.ko && (
              <p className="text-xs font-medium text-slate-500 mt-0.5 pl-2 border-l-2 border-slate-200">{s.ko}</p>
            )}
          </div>
        );
      })}
      {showAnswer && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-3 mt-3">
          <p className="text-xs font-black text-yellow-700 mb-1">정답</p>
          <p className="text-sm font-bold text-slate-700 leading-relaxed">{answerKey}</p>
        </div>
      )}
    </div>
  );
}

function RenderVocabFill({ result, showAnswer, showKorean }: {
  result: WorkbookResult; showAnswer: boolean; showKorean: boolean;
}) {
  if (result.sentences) {
    return <RenderVocabFillSentences
      sentences={result.sentences as Array<{en:string;ko:string}>}
      answerKey={result.answer_key as string || ''}
      showAnswer={showAnswer}
      showKorean={showKorean}
    />;
  }
  // Legacy format fallback
  const passage = result.passage as string || '';
  const wordBank = result.word_bank as string[] || [];
  const answerKey = result.answer_key as string || '';
  const answerMap = buildVocabFillAnswerMap(answerKey);
  const parts = passage.split(/_\((\d+)\)_/);
  return (
    <div className="space-y-4">
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-3">
        <p className="text-xs font-black text-blue-600 mb-1">보기</p>
        <p className="text-sm font-bold text-slate-700">{wordBank.join('  /  ')}</p>
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

function buildGrammarCorrectAnswerMap(answerKey: string): Record<number, string> {
  const map: Record<number, string> = {};
  const matches = [...answerKey.matchAll(/(\d+)\.\s*[^\s→]+\s*→\s*([^\s]+(?:\s+\S+)*?)(?=\s+\d+\.|$)/g)];
  matches.forEach(m => { map[parseInt(m[1])] = m[2].trim(); });
  if (Object.keys(map).length === 0) {
    // fallback: `1. word  2. word` without arrow
    const parts = answerKey.split(/\s+\d+\.\s*/).filter(Boolean);
    const nums = [...answerKey.matchAll(/(\d+)\.\s*/g)].map(m => parseInt(m[1]));
    nums.forEach((n, i) => { map[n] = (parts[i] || '').trim(); });
  }
  return map;
}

function RenderGrammarCorrect({ passage, answerKey, showAnswer }: { passage: string; answerKey: string; showAnswer: boolean }) {
  const answerMap = buildGrammarCorrectAnswerMap(answerKey);
  const regex = /(\d+)\[([^\]]+)\]/g;
  const parts: React.ReactNode[] = [];
  let last = 0, m: RegExpExecArray | null;
  while ((m = regex.exec(passage)) !== null) {
    if (m.index > last) parts.push(<span key={last}>{passage.slice(last, m.index)}</span>);
    const num = parseInt(m[1]);
    const word = m[2];
    const correct = answerMap[num] ?? '';
    parts.push(
      <span key={m.index} className={`inline-flex items-center gap-0.5 ${showAnswer ? 'bg-rose-100 rounded px-1' : ''}`}>
        <span className="text-xs font-black text-slate-400">{num}</span>
        <span className={`px-1 py-0.5 rounded text-xs font-bold ${showAnswer ? 'line-through text-rose-500' : 'bg-slate-100 text-slate-700'}`}>[{word}]</span>
        {showAnswer && correct && <span className="text-xs font-black text-emerald-600">→{correct}</span>}
      </span>
    );
    last = m.index + m[0].length;
  }
  if (last < passage.length) parts.push(<span key={last}>{passage.slice(last)}</span>);
  return (
    <div className="space-y-3">
      <p className="text-sm font-medium leading-8 text-slate-800">{parts}</p>
      {showAnswer && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-3">
          <p className="text-xs font-black text-yellow-700 mb-1">정답</p>
          <p className="text-sm font-bold text-slate-700 whitespace-pre-wrap">{answerKey}</p>
        </div>
      )}
    </div>
  );
}

function RenderGrammarCorrectAdv({ sentences, answerKey, showAnswer }: {
  sentences: Array<{num: number; text: string}>; answerKey: string; showAnswer: boolean;
}) {
  const answerMap: Record<number, string> = {};
  if (answerKey) {
    const entries = answerKey.split(/\s{2,}|\n/).filter(Boolean);
    entries.forEach(entry => {
      const m = entry.match(/^(\d+)\.\s*(.+)$/);
      if (m) answerMap[parseInt(m[1])] = m[2].trim();
    });
  }
  return (
    <div className="space-y-2">
      {(sentences || []).map((s, i) => (
        <div key={i} className="border border-slate-100 rounded-xl overflow-hidden">
          <div className="bg-slate-50 px-3 py-2.5 flex gap-2">
            <span className="text-xs font-black text-slate-400 shrink-0 w-5">{s.num}.</span>
            <span className="text-sm font-medium text-slate-800 leading-6">{s.text}</span>
          </div>
          {showAnswer && answerMap[s.num] && (
            <div className="px-3 py-2 bg-rose-50 border-t border-rose-100 flex gap-2">
              <span className="text-xs font-black text-rose-400 shrink-0 w-5"></span>
              <span className="text-xs font-black text-rose-600">{answerMap[s.num]}</span>
            </div>
          )}
          {!showAnswer && (
            <div className="px-3 py-2">
              <div className="h-5 border-b border-dashed border-slate-200"></div>
            </div>
          )}
        </div>
      ))}
      {showAnswer && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-3 mt-2">
          <p className="text-xs font-black text-yellow-700 mb-1">전체 정답</p>
          <p className="text-sm font-bold text-slate-700 whitespace-pre-wrap">{answerKey}</p>
        </div>
      )}
    </div>
  );
}

function RenderTranslation({ sentences, showAnswer }: {
  sentences: Array<{num: number; en: string; ko: string}>; showAnswer: boolean;
}) {
  return (
    <div className="space-y-4">
      {(sentences || []).map((s, i) => (
        <div key={i} className="space-y-1">
          <p className="text-sm font-semibold text-slate-800 leading-relaxed">{s.en}</p>
          <div className="border-b border-slate-300 pb-0.5 flex items-end gap-1">
            <span className="text-xs font-black text-slate-400 shrink-0">({s.num})</span>
            {showAnswer && <span className="text-sm font-bold text-amber-700 pb-0.5 flex-1">{s.ko}</span>}
          </div>
          {!showAnswer && <div className="border-b border-slate-200 h-5"></div>}
        </div>
      ))}
    </div>
  );
}

function RenderWordOrder({ sentences, showAnswer, showKorean }: {
  sentences: Array<{num: number; ko: string; scrambled: string[]; answer: string}>; showAnswer: boolean; showKorean: boolean;
}) {
  return (
    <div className="space-y-5">
      {(sentences || []).map((s, i) => (
        <div key={i} className="space-y-1.5">
          {showKorean && (
            <p className="text-sm font-bold text-rose-600 leading-relaxed">{s.ko}</p>
          )}
          <p className="text-xs font-bold text-slate-500">
            ({(s.scrambled || []).join(' / ')})
          </p>
          <div className="border-b border-slate-300 pb-0.5 flex items-end gap-1 min-h-[22px]">
            <span className="text-xs font-black text-slate-400 shrink-0">({s.num})</span>
            {showAnswer && <span className="text-sm font-bold text-amber-700 pb-0.5 flex-1">{s.answer}</span>}
          </div>
          {!showAnswer && <div className="border-b border-slate-200 h-5"></div>}
        </div>
      ))}
    </div>
  );
}

function RenderEnglishWriting({ sentences, showAnswer }: {
  sentences: Array<{num: number; ko: string; hint_start: string; hint_end: string; answer: string}>; showAnswer: boolean;
}) {
  return (
    <div className="space-y-5">
      {(sentences || []).map((s, i) => (
        <div key={i} className="space-y-1.5">
          <p className="text-sm font-bold text-slate-800 leading-relaxed">{s.ko}</p>
          <div className="border-b border-slate-300 pb-0.5 flex items-end gap-1 min-h-[22px]">
            <span className="text-xs font-black text-slate-400 shrink-0">({s.num})</span>
            {showAnswer && <span className="text-sm font-bold text-amber-700 pb-0.5 flex-1">{s.answer}</span>}
          </div>
          {!showAnswer && <div className="border-b border-slate-200 h-5"></div>}
        </div>
      ))}
    </div>
  );
}

type VocabRow = { word: string; meaning: string; syn1: string; syn1_m: string; syn2: string; syn2_m: string; syn3: string; syn3_m: string; antonym: string; antonym_m: string };
type PassageSentence = { en: string; ko: string; key_words?: string[] };

function highlightKeyWords(text: string, keyWords: string[]): React.ReactNode {
  if (!keyWords || keyWords.length === 0) return <span>{text}</span>;
  const escaped = keyWords.map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const regex = new RegExp(`(${escaped.join('|')})`, 'gi');
  const parts = text.split(regex);
  const colors = ['text-rose-600', 'text-blue-600', 'text-emerald-600', 'text-violet-600', 'text-amber-600'];
  let colorIdx = 0;
  const usedColors: Record<string, string> = {};
  return (
    <>
      {parts.map((part, i) => {
        const matched = keyWords.find(kw => kw.toLowerCase() === part.toLowerCase());
        if (matched) {
          if (!usedColors[matched.toLowerCase()]) {
            usedColors[matched.toLowerCase()] = colors[colorIdx++ % colors.length];
          }
          return <span key={i} className={`font-black ${usedColors[matched.toLowerCase()]}`}>{part}</span>;
        }
        return <span key={i}>{part}</span>;
      })}
    </>
  );
}

function RenderPassageTranslation({ result }: { result: WorkbookResult }) {
  const sentences = result.sentences as PassageSentence[] || result.items as PassageSentence[] || [];
  const vocabTable = result.vocab_table as VocabRow[] || [];
  return (
    <div className="space-y-1">
      {sentences.map((s, i) => (
        <div key={i} className="py-1 border-b border-slate-100 last:border-0">
          <p className="text-sm font-medium text-slate-800 leading-relaxed">
            {highlightKeyWords(s.en, s.key_words || [])}
          </p>
          <p className="text-sm font-bold text-slate-800 leading-relaxed mt-0.5">{s.ko}</p>
        </div>
      ))}
      {vocabTable.length > 0 && (
        <div className="mt-6">
          <p className="text-xs font-black text-slate-500 mb-2">지문의 주요 어휘와 뜻</p>
          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="bg-slate-800 text-white">
                  {['표제어 (뜻)', '유의어 1 (뜻)', '유의어 2 (뜻)', '유의어 3 (뜻)', '반의어 (뜻)'].map((h, i) => (
                    <th key={i} className="px-2 py-1.5 text-left font-black">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {vocabTable.map((row, i) => (
                  <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                    <td className="px-2 py-1.5 border-r border-slate-100">
                      <span className="font-black text-slate-800">{row.word}</span>
                      {row.meaning && <span className="text-slate-500 ml-1">({row.meaning})</span>}
                    </td>
                    {[['syn1','syn1_m'],['syn2','syn2_m'],['syn3','syn3_m']].map(([k,m]) => (
                      <td key={k} className="px-2 py-1.5 border-r border-slate-100">
                        {(row as Record<string,string>)[k] && <>
                          <span className="font-bold text-blue-700">{(row as Record<string,string>)[k]}</span>
                          {(row as Record<string,string>)[m] && <span className="text-slate-500 ml-1">({(row as Record<string,string>)[m]})</span>}
                        </>}
                      </td>
                    ))}
                    <td className="px-2 py-1.5">
                      {row.antonym && <>
                        <span className="font-bold text-rose-600">{row.antonym}</span>
                        {row.antonym_m && <span className="text-slate-500 ml-1">({row.antonym_m})</span>}
                      </>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function RenderParagraphOrder({ data, showAnswer }: {
  data: { fixed_paragraph: string; shuffled_paragraphs: Array<{label: string; text: string}>; answer_key: string };
  showAnswer: boolean;
}) {
  return (
    <div className="space-y-3">
      <div className="border-2 border-slate-900 rounded-xl p-3 bg-white">
        <p className="text-xs font-black text-slate-900 mb-1">제시 단락 (고정)</p>
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
      <div className="border-2 border-slate-900 rounded-xl p-3 bg-white">
        <p className="text-xs font-black text-slate-900 mb-1">삽입할 문장</p>
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

function RenderSuneungVocabWrong({ result, showAnswer }: { result: WorkbookResult; showAnswer: boolean }) {
  const passage = result.passage as string ?? '';
  const answerKey = result.answer_key as string ?? '';
  const parts = passage.split(/([①②③④⑤][a-zA-Z''\-]+)/g);
  return (
    <div className="space-y-3">
      <p className="text-sm font-medium leading-8 text-slate-800">
        {parts.map((part, i) => {
          const m = part.match(/^([①②③④⑤])(.+)$/);
          if (m) return (
            <span key={i}>
              <span className="font-black text-slate-700">{m[1]}</span>
              <span className="underline font-semibold">{m[2]}</span>
            </span>
          );
          return <span key={i}>{part}</span>;
        })}
      </p>
      {showAnswer && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-3">
          <p className="text-xs font-black text-yellow-700 mb-1">정답</p>
          <p className="text-sm font-bold text-slate-700">{answerKey}</p>
        </div>
      )}
    </div>
  );
}

function RenderSuneungVocabABC({ result, showAnswer }: { result: WorkbookResult; showAnswer: boolean }) {
  const passage = result.passage as string ?? '';
  const choices = (result.choices as Array<{label: string; A: string; B: string; C: string}>) || [];
  const answerKey = result.answer_key as string ?? '';
  const parts = passage.split(/(\([ABC]\)\[[^\]]+\])/g);
  return (
    <div className="space-y-4">
      <p className="text-sm font-medium leading-8 text-slate-800">
        {parts.map((part, i) => {
          const m = part.match(/\(([ABC])\)\[([^\]]+)\]/);
          if (m) return (
            <span key={i} className="inline-flex items-baseline gap-0.5">
              <span className="font-black text-violet-600">({m[1]})</span>
              <span className="rounded px-1.5 font-bold text-sm">[{m[2]}]</span>
            </span>
          );
          return <span key={i}>{part}</span>;
        })}
      </p>
      <div className="border border-slate-200 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-100 border-b border-slate-200">
              <th className="py-2 px-3 w-8 text-left"></th>
              <th className="py-2 px-6 text-center font-black text-slate-600">(A)</th>
              <th className="py-2 px-6 text-center font-black text-slate-600">(B)</th>
              <th className="py-2 px-6 text-center font-black text-slate-600">(C)</th>
            </tr>
          </thead>
          <tbody>
            {choices.map((c, i) => {
              const correct = showAnswer && c.label === answerKey;
              return (
                <tr key={i} className={`border-t border-slate-100 ${correct ? 'bg-yellow-50' : ''}`}>
                  <td className="py-2 px-3 font-black text-slate-400">{c.label}</td>
                  <td className={`py-2 px-6 text-center font-semibold ${correct ? 'text-emerald-600 font-black' : 'text-slate-700'}`}>{c.A}</td>
                  <td className={`py-2 px-6 text-center font-semibold ${correct ? 'text-emerald-600 font-black' : 'text-slate-700'}`}>{c.B}</td>
                  <td className={`py-2 px-6 text-center font-semibold ${correct ? 'text-emerald-600 font-black' : 'text-slate-700'}`}>{c.C}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {showAnswer && <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-3"><p className="text-xs font-black text-yellow-700 mb-0.5">정답</p><p className="text-sm font-bold text-slate-700">{answerKey}</p></div>}
    </div>
  );
}

function RenderComboGrammarInsert({ result, showAnswer }: { result: WorkbookResult; showAnswer: boolean }) {
  const passage = result.passage as string ?? '';
  const insertSentence = result.insert_sentence as string ?? '';
  const insertAnswer = result.insert_answer as string ?? '';
  const grammarWrong = (result.grammar_wrong as string[]) || [];
  const grammarAnswers = (result.grammar_answers as Array<{num:string;wrong:string;correct:string}>) || [];
  const parts = passage.split(/(\([A-E]\)|[①②③④⑤] ?[a-zA-Z][a-zA-Z0-9''‘’\-]*)/g);
  const renderPassage = () => parts.map((part, i) => {
    const ins = part.match(/^\(([A-E])\)$/);
    if (ins) return (
      <span key={i} className="font-black text-violet-700 mx-0.5 text-xs align-middle">({ins[1]})</span>
    );
    const gm = part.match(/^([①②③④⑤]) ?(.+)$/);
    if (gm) {
      const wrong = grammarWrong.includes(gm[1]);
      return (
        <span key={i}>
          <span className="font-black">{gm[1]}</span>
          <span className={`font-bold underline${wrong && showAnswer ? ' text-rose-600' : ''}`}>{gm[2]}</span>
        </span>
      );
    }
    return <span key={i}>{part}</span>;
  });
  const choiceNums = ['①','②','③','④','⑤'];
  const choiceLabels = ['A','B','C','D','E'];
  return (
    <div className="text-sm leading-loose">
      <p className="mb-4">{renderPassage()}</p>
      <div className="mt-3 p-3 bg-slate-50 rounded-lg border border-slate-200">
        <p className="text-xs font-black text-slate-700 mb-2">
          1. 위 글의 밑줄 친 {grammarWrong.join(', ')}를 어법에 맞게 바꾸어 쓰시오.
        </p>
        <div className="space-y-1">
          {grammarWrong.map((num, i) => {
            const ans = grammarAnswers.find(a => a.num === num);
            return (
              <div key={i} className="flex items-center gap-2 text-sm">
                <span className="font-black w-5 shrink-0">{num}</span>
                {showAnswer && ans
                  ? <span className="font-bold text-emerald-600">{ans.correct}</span>
                  : <span className="border-b border-slate-400 inline-block min-w-[180px]">&nbsp;</span>}
              </div>
            );
          })}
        </div>
      </div>
      <div className="mt-2 p-3 bg-slate-50 rounded-lg border border-slate-200">
        <p className="text-xs font-black text-slate-700 mb-2">
          2. 위 글의 흐름상 (A)~(E) 중 주어진 문장이 들어가기에 가장 적절한 곳은 어디인가?
        </p>
        <div className="bg-white border border-slate-200 rounded p-2 mb-3 text-sm text-slate-700 italic">{insertSentence}</div>
        <div className="flex flex-wrap gap-5 text-sm">
          {choiceLabels.map((l, i) => {
            const hit = showAnswer && insertAnswer === `(${l})`;
            return <span key={i} className={hit ? 'font-black text-rose-600 underline' : ''}>{choiceNums[i]} {l}</span>;
          })}
        </div>
        {showAnswer && <p className="mt-2 text-xs font-bold text-amber-700">정답: {insertAnswer}</p>}
      </div>
    </div>
  );
}

function renderWithErrorHighlight(text: string, errors: Array<{wrong: string}>) {
  const sortedErrors = [...errors].sort((a, b) => b.wrong.length - a.wrong.length);
  const escaped = sortedErrors.map(e => e.wrong.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  if (escaped.length === 0) return <>{text}</>;
  const regex = new RegExp(`(${escaped.join('|')})`, 'g');
  const parts = text.split(regex);
  return (
    <>
      {parts.map((part, i) => {
        const isError = sortedErrors.some(e => e.wrong === part);
        return isError
          ? <span key={i} className="underline decoration-red-500 decoration-2 font-bold">{part}</span>
          : <span key={i}>{part}</span>;
      })}
    </>
  );
}

function RenderComboGrammarOrder({ result, showAnswer }: { result: WorkbookResult; showAnswer: boolean }) {
  const paragraphs = (result.paragraphs as Array<{label:string;text:string}>) || [];
  const orderAnswer = result.order_answer as string ?? '';
  const grammarErrors = (result.grammar_errors as Array<{label:string;wrong:string;correct:string}>) || [];
  return (
    <div className="text-sm leading-loose">
      <div className="space-y-3 mb-4">
        {paragraphs.map((p, i) => (
          <div key={i} className="flex gap-2 items-start">
            <span className="font-black text-amber-700 shrink-0 mt-0.5">{p.label}</span>
            <p className="text-slate-800">{renderWithErrorHighlight(p.text, grammarErrors)}</p>
          </div>
        ))}
      </div>
      <div className="mt-3 p-3 bg-slate-50 rounded-lg border border-slate-200">
        <p className="text-xs font-black text-slate-700 mb-2">1. 주어진 글 (A)에 이어질 내용을 순서에 맞게 배열하시오.</p>
        <p className="text-sm text-slate-500">정답: (A) - &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</p>
        {showAnswer && <p className="mt-1 text-xs font-bold text-amber-700">정답: {orderAnswer}</p>}
      </div>
      <div className="mt-2 p-3 bg-slate-50 rounded-lg border border-slate-200">
        <p className="text-xs font-black text-slate-700 mb-2">2. 위 글에서 어법상 어색한 부분을 각각 바르게 고치시오. (3개)</p>
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr className="bg-slate-100">
              <th className="py-1 px-2 border border-slate-300 w-8 text-center"></th>
              <th className="py-1 px-2 border border-slate-300 text-center font-black text-slate-600">어색한 부분</th>
              <th className="py-1 px-2 border border-slate-300 w-8"></th>
              <th className="py-1 px-2 border border-slate-300 text-center font-black text-slate-600">고친 부분</th>
            </tr>
          </thead>
          <tbody>
            {showAnswer ? grammarErrors.map((e, i) => (
              <tr key={i}>
                <td className="py-2 px-2 border border-slate-200 font-bold text-slate-500 text-center">{e.label}</td>
                <td className="py-2 px-2 border border-slate-200 font-bold text-rose-600 text-center">{e.wrong}</td>
                <td className="py-2 px-2 border border-slate-200 text-slate-400 text-center">→</td>
                <td className="py-2 px-2 border border-slate-200 font-bold text-emerald-600 text-center">{e.correct}</td>
              </tr>
            )) : [1,2,3].map((n, i) => (
              <tr key={i}>
                <td className="py-2 px-2 border border-slate-200 font-bold text-slate-500 text-center">({n})</td>
                <td className="py-4 px-2 border border-slate-200"></td>
                <td className="py-2 px-2 border border-slate-200 text-slate-400 text-center">→</td>
                <td className="py-4 px-2 border border-slate-200"></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function RenderComboVocabFill({ result, showAnswer }: { result: WorkbookResult; showAnswer: boolean }) {
  const passage = result.passage as string ?? '';
  const q1Choices = (result.q1_choices as Array<{label:string;word:string}>) || [];
  const q1Answer = result.q1_answer as string ?? '';
  const q2Items = (result.q2_items as Array<{blank:string;words:string[];answer:string;ko?:string}>) || [];
  const hasKo = q2Items.some(item => item.ko);
  const q2Instruction = hasKo
    ? '주어진 단어를 모두 사용하여 다음 우리말과 같은 뜻이 되도록 배열하시오.'
    : '보기의 단어를 활용하여 빈칸을 완성하시오.';
  const parts = passage.split(/(\([A-D가나]\)\[_+\])/g);
  const renderPassage = () => parts.map((part, i) => {
    const m = part.match(/^\(([A-D가나])\)(\[_+\])$/);
    if (!m) return <span key={i}>{part}</span>;
    const isLong = /[가나]/.test(m[1]);
    return (
      <span key={i}>
        <span className={`font-black ${isLong ? 'text-violet-700' : 'text-amber-700'}`}>({m[1]})</span>
        <span className={`border-b-2 border-slate-700 inline-block ${isLong ? 'min-w-[200px]' : 'min-w-[52px]'}`}>&nbsp;</span>
      </span>
    );
  });
  return (
    <div className="text-sm leading-loose">
      <p className="mb-4">{renderPassage()}</p>
      <div className="mt-3 p-3 bg-slate-50 rounded-lg border border-slate-200">
        <p className="text-xs font-black text-slate-700 mb-2">1. 문맥상 위 글의 빈칸 (A)~(D)에 들어갈 수 없는 단어 하나는?</p>
        <div className="flex flex-wrap gap-5 text-sm">
          {q1Choices.map((c, i) => {
            const hit = showAnswer && c.label === q1Answer;
            return <span key={i} className={hit ? 'font-black text-rose-600 underline' : ''}>{c.label} {c.word}</span>;
          })}
        </div>
        {showAnswer && <p className="mt-2 text-xs font-bold text-amber-700">정답: {q1Answer}</p>}
      </div>
      <div className="mt-2 p-3 bg-slate-50 rounded-lg border border-slate-200">
        <p className="text-xs font-black text-slate-700 mb-1">2. 위 글의 빈칸 (가),(나)에 들어갈 말을 &lt;조건&gt;에 맞게 쓰시오.</p>
        <div className="text-xs text-slate-600 bg-white rounded p-2 border mb-3">
          <p className="font-bold mb-0.5">&lt;조건&gt;</p>
          <p>{q2Instruction}</p>
        </div>
        {q2Items.map((item, i) => (
          <div key={i} className="mb-3 last:mb-0">
            {item.ko && (
              <p className="text-xs text-slate-600 bg-indigo-50 rounded px-2 py-1 border border-indigo-100 mb-1 italic">{item.ko}</p>
            )}
            <p className="text-xs font-black text-violet-700 mb-1">{item.blank} &lt;보기&gt;</p>
            <p className="text-xs text-slate-700 bg-white rounded p-2 border leading-relaxed">{item.words.join(' / ')}</p>
            {showAnswer && <p className="mt-1 text-xs font-bold text-amber-700">정답: {item.answer}</p>}
          </div>
        ))}
      </div>
    </div>
  );
}

function RenderComboVocabGrammar({ result, showAnswer }: { result: WorkbookResult; showAnswer: boolean }) {
  const passage = result.passage as string ?? '';
  const q1Choices = (result.q1_choices as Array<{label:string;blank:string;word:string}>) || [];
  const q1Answer = result.q1_answer as string ?? '';
  const q2Choices = (result.q2_choices as Array<{label:string;pair:string}>) || [];
  const q2Answer = result.q2_answer as string ?? '';
  const parts = passage.split(/(\([A-E]\)_{3,}|[①②③④⑤][a-zA-Z''\-]+)/g);
  const renderPassage = () => parts.map((part, i) => {
    const bm = part.match(/^\(([A-E])\)(_{3,})$/);
    if (bm) return (
      <span key={i}>
        <span className="font-black text-amber-700">({bm[1]})</span>
        <span className="border-b-2 border-slate-700 inline-block" style={{minWidth:52}}>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</span>
      </span>
    );
    const gm = part.match(/^([①②③④⑤])(.+)$/);
    if (gm) return (
      <span key={i}>
        <span className="font-black">{gm[1]}</span>
        <span className="font-bold underline">{gm[2]}</span>
      </span>
    );
    return <span key={i}>{part}</span>;
  });
  return (
    <div className="text-sm leading-loose">
      <p className="mb-4">{renderPassage()}</p>
      <div className="mt-3 p-3 bg-slate-50 rounded-lg border border-slate-200">
        <p className="text-xs font-black text-slate-700 mb-2">1. 위 글의 빈칸 (A)~(E)에 들어갈 말로 적절하지 않은 것은?</p>
        <div className="flex flex-wrap gap-5 text-sm">
          {q1Choices.map((c, i) => {
            const hit = showAnswer && c.label === q1Answer;
            return <span key={i} className={hit ? 'font-black text-rose-600 underline' : ''}>{c.label} {c.blank} {c.word}</span>;
          })}
        </div>
        {showAnswer && <p className="mt-2 text-xs font-bold text-amber-700">정답: {q1Answer}</p>}
      </div>
      <div className="mt-2 p-3 bg-slate-50 rounded-lg border border-slate-200">
        <p className="text-xs font-black text-slate-700 mb-2">2. 위 글의 ①~⑤ 중 어법상 어색한 것만 고른 것은?</p>
        <div className="flex flex-wrap gap-5 text-sm">
          {q2Choices.map((c, i) => {
            const hit = showAnswer && c.label === q2Answer;
            return <span key={i} className={hit ? 'font-black text-rose-600 underline' : ''}>{c.label} {c.pair}</span>;
          })}
        </div>
        {showAnswer && <p className="mt-2 text-xs font-bold text-amber-700">정답: {q2Answer}</p>}
      </div>
    </div>
  );
}

const ANALYSIS_ROLES: Record<string, { text: string; border: string; bg: string; label: string; paren?: boolean }> = {
  // 필수 문장 성분
  'S':     { text: 'text-blue-700',   border: 'border-blue-500',   bg: 'bg-blue-50',    label: 'S 주어' },
  'V':     { text: 'text-red-600',    border: 'border-red-500',    bg: 'bg-red-50',     label: 'V 동사' },
  'O':     { text: 'text-emerald-700',border: 'border-emerald-500',bg: 'bg-emerald-50', label: 'O 목적어' },
  'SC':    { text: 'text-violet-700', border: 'border-violet-500', bg: 'bg-violet-50',  label: 'SC 주격보어' },
  'OC':    { text: 'text-amber-700',  border: 'border-amber-500',  bg: 'bg-amber-50',   label: 'OC 목적격보어' },
  // 수식어구/절 (괄호 표시)
  '전치사구':  { text: 'text-slate-600',  border: 'border-slate-500',  bg: 'bg-slate-100',  label: '전치사구',  paren: true },
  'to부정사구':{ text: 'text-orange-700', border: 'border-orange-500', bg: 'bg-orange-50',  label: 'to부정사구', paren: true },
  '현재분사구':{ text: 'text-teal-700',   border: 'border-teal-500',   bg: 'bg-teal-50',    label: '현재분사구', paren: true },
  '과거분사구':{ text: 'text-cyan-700',   border: 'border-cyan-500',   bg: 'bg-cyan-50',    label: '과거분사구', paren: true },
  '관계절':   { text: 'text-indigo-700', border: 'border-indigo-500', bg: 'bg-indigo-50',  label: '관계절',   paren: true },
  '부사절':   { text: 'text-rose-700',   border: 'border-rose-500',   bg: 'bg-rose-50',    label: '부사절',   paren: true },
  '명사절':   { text: 'text-purple-700', border: 'border-purple-500', bg: 'bg-purple-50',  label: '명사절',   paren: true },
  // 단순 수식어
  'M':     { text: 'text-gray-500',   border: 'border-gray-300',   bg: 'bg-gray-50',    label: 'M 수식어' },
};
const PHRASE_ROLES = new Set(['전치사구','to부정사구','현재분사구','과거분사구','관계절','부사절','명사절']);
function getAnalysisStyle(role: string) {
  return ANALYSIS_ROLES[role] ?? { text: 'text-gray-500', border: 'border-gray-300', bg: 'bg-gray-50', label: role };
}

function RenderPassageAnalysis({ result }: { result: WorkbookResult }) {
  type Chunk = { text: string; role: string };
  type Sentence = { num: number; en: string; ko: string; chunks: Chunk[] };
  const sentences = (result.sentences as Sentence[]) ?? [];
  const isPhrase = (role: string) => PHRASE_ROLES.has(role);

  return (
    <div className="space-y-3">
      {/* 범례 */}
      <div className="flex flex-wrap gap-1.5 p-3 bg-slate-50 rounded-xl border border-slate-200">
        {(['S','V','O','SC','OC'] as const).map(role => {
          const s = getAnalysisStyle(role);
          return <span key={role} className={`px-2 py-0.5 rounded text-[10px] font-black border ${s.text} ${s.border} ${s.bg}`}>{s.label}</span>;
        })}
        <span className="text-[10px] text-slate-300 self-center">|</span>
        {(['전치사구','to부정사구','현재분사구','과거분사구','관계절','부사절','명사절'] as const).map(role => {
          const s = getAnalysisStyle(role);
          return <span key={role} className={`px-2 py-0.5 rounded text-[10px] font-black border ${s.text} ${s.border} ${s.bg}`}>({s.label})</span>;
        })}
        <span className="text-[10px] text-slate-300 self-center">|</span>
        <span className="text-[10px] text-slate-400 self-center">M 수식어</span>
      </div>

      {/* 헤더 */}
      <div className="flex rounded-xl overflow-hidden border border-slate-200 text-xs font-black">
        <div className="w-[70%] bg-slate-800 text-white px-4 py-2">영어 구문분석</div>
        <div className="w-[30%] bg-slate-700 text-white px-4 py-2 border-l border-slate-600">한국어 번역</div>
      </div>

      {/* 문장별 2단 레이아웃 */}
      {sentences.map(sent => (
        <div key={sent.num} className="flex border border-slate-200 rounded-xl overflow-hidden">
          {/* 왼쪽 70%: 구문분석 영어 */}
          <div className="w-[70%] p-4 bg-white border-r border-slate-100">
            <div className="flex flex-wrap gap-x-2 gap-y-3 items-end">
              {sent.chunks.map((chunk, ci) => {
                const s = getAnalysisStyle(chunk.role);
                const phrase = isPhrase(chunk.role);
                return (
                  <div key={ci} className="flex flex-col items-center">
                    <span className={`text-sm font-bold px-1.5 py-0.5 border-b-2 ${s.text} ${s.border} ${phrase ? 'italic' : ''}`}>
                      {phrase ? `(${chunk.text})` : chunk.text}
                    </span>
                    <span className={`text-[9px] font-black mt-0.5 ${s.text}`}>{s.label}</span>
                  </div>
                );
              })}
            </div>
          </div>
          {/* 오른쪽 30%: 한국어 번역 */}
          <div className="w-[30%] p-3 bg-slate-50 flex items-start gap-1.5">
            <span className="text-[10px] font-black text-slate-400 mt-0.5 shrink-0">{sent.num}.</span>
            <span className="text-xs font-bold text-slate-600 leading-relaxed">{sent.ko}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

function RenderSummarySentence({ result, showAnswer }: { result: WorkbookResult; showAnswer: boolean }) {
  const summary = (result.summary as string) ?? '';
  const instruction = (result.instruction as string) ?? '다음 글의 내용을 한 문장으로 요약할 때, 빈칸에 들어갈 알맞은 단어를 본문에서 찾아 쓰시오.';
  const answerKey = (result.answer_key as string) ?? '';
  const originalText = (result._original_text as string) ?? '';

  const answers: Record<number, string> = {};
  for (const m of answerKey.matchAll(/\((\d+)\)\s+(\S+)/g)) {
    answers[parseInt(m[1])] = m[2];
  }

  const parts = summary.split(/(\(\d+\)_+)/g);

  return (
    <div className="space-y-3">
      {/* 원문 지문 */}
      {originalText && (
        <div className="p-4 bg-white rounded-xl border border-slate-200">
          <p className="text-[10px] font-black text-slate-400 mb-2">원문 지문</p>
          <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">{originalText}</p>
        </div>
      )}
      {/* 요약문 문제 */}
      <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
        <p className="text-xs font-black text-slate-400 mb-3 italic">{instruction}</p>
        <p className="text-sm leading-10 text-slate-800 font-medium">
          {parts.map((part, i) => {
            const m = part.match(/\((\d+)\)(_+)/);
            if (m) {
              const n = parseInt(m[1]);
              return (
                <span key={i} className="inline-flex items-end mx-0.5 align-bottom">
                  {showAnswer
                    ? <span className="border-b-2 border-indigo-500 px-2 text-indigo-700 font-black text-xs leading-snug">{answers[n] ?? '?'}</span>
                    : <span className="border-b-2 border-slate-400 w-16 inline-block">&nbsp;</span>
                  }
                </span>
              );
            }
            return <span key={i}>{part}</span>;
          })}
        </p>
      </div>
      {showAnswer && (
        <div className="p-2 bg-amber-50 rounded-lg border border-amber-200">
          <p className="text-xs font-black text-amber-700">정답: {answerKey}</p>
        </div>
      )}
    </div>
  );
}

function RenderResultContent({ result, type, showAnswer, showKorean }: { result: WorkbookResult; type: WorkbookType; showAnswer: boolean; showKorean?: boolean }) {
  if (result.error) return <p className="text-rose-500 font-bold text-sm">{result.error as string}</p>;

  if (type === 'combo_vocab_grammar') return <RenderComboVocabGrammar result={result} showAnswer={showAnswer} />;
  if (type === 'combo_vocab_fill') return <RenderComboVocabFill result={result} showAnswer={showAnswer} />;
  if (type === 'combo_grammar_order') return <RenderComboGrammarOrder result={result} showAnswer={showAnswer} />;
  if (type === 'combo_grammar_insert') return <RenderComboGrammarInsert result={result} showAnswer={showAnswer} />;

  const isCombo = type.startsWith('combo_');
  if (isCombo) {
    const s1 = (result.section1 ?? {}) as WorkbookResult;
    const s2 = (result.section2 ?? {}) as WorkbookResult;
    const [t1, t2] = ['grammar_choice', 'sentence_insertion'];
    return (
      <div className="space-y-6">
        <div>
          <p className="text-xs font-black text-slate-900 mb-2">Section 1 — {TYPE_LABELS[t1 as WorkbookType]}</p>
          <RenderResultContent result={s1} type={t1 as WorkbookType} showAnswer={showAnswer} showKorean={showKorean} />
        </div>
        <div className="border-t border-slate-200 pt-4">
          <p className="text-xs font-black text-violet-600 mb-2">Section 2 — {TYPE_LABELS[t2 as WorkbookType]}</p>
          <RenderResultContent result={s2} type={t2 as WorkbookType} showAnswer={showAnswer} showKorean={showKorean} />
        </div>
      </div>
    );
  }

  switch (type) {
    case 'vocab_choice':
    case 'grammar_choice':
      return <RenderVocabChoicePassage passage={result.passage as string} answerKey={result.answer_key as string} showAnswer={showAnswer} />;
    case 'vocab_fill':
      return <RenderVocabFill result={result} showAnswer={showAnswer} showKorean={showKorean ?? false} />;
    case 'grammar_correct':
      return <RenderGrammarCorrect passage={result.passage as string} answerKey={result.answer_key as string} showAnswer={showAnswer} />;
    case 'grammar_correct_adv':
      return <RenderGrammarCorrectAdv sentences={result.sentences as Array<{num:number;text:string}>} answerKey={result.answer_key as string} showAnswer={showAnswer} />;
    case 'translation':
      return <RenderTranslation sentences={result.sentences as Array<{num:number;en:string;ko:string}>} showAnswer={showAnswer} />;
    case 'word_order':
      return <RenderWordOrder sentences={result.sentences as Array<{num:number;ko:string;scrambled:string[];answer:string}>} showAnswer={showAnswer} showKorean={showKorean ?? false} />;
    case 'english_writing':
      return <RenderEnglishWriting sentences={result.sentences as Array<{num:number;ko:string;hint_start:string;hint_end:string;answer:string}>} showAnswer={showAnswer} />;
    case 'passage_translation':
      return <RenderPassageTranslation result={result} />;
    case 'paragraph_order':
      return <RenderParagraphOrder data={result as {fixed_paragraph:string;shuffled_paragraphs:Array<{label:string;text:string}>;answer_key:string}} showAnswer={showAnswer} />;
    case 'sentence_insertion':
      return <RenderSentenceInsertion data={result as {insert_sentence:string;passage:string;answer_key:string}} showAnswer={showAnswer} />;
    case 'summary_sentence':
      return <RenderSummarySentence result={result} showAnswer={showAnswer} />;
    case 'passage_analysis':
      return <RenderPassageAnalysis result={result} />;
    case 'tf_questions': {
      const questions = (result.questions as Array<{num:number;statement:string;answer:string;explanation?:string}>) ?? [];
      return (
        <div className="space-y-3">
          {questions.map((q, i) => (
            <div key={i} className="flex gap-3 items-start pb-3 border-b border-slate-100 last:border-0">
              <span className="shrink-0 text-sm font-black text-slate-500 min-w-5">{q.num}.</span>
              <div className="flex-1">
                <p className="text-sm leading-relaxed mb-2">{q.statement}</p>
                {showAnswer ? (
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-black px-3 py-0.5 rounded ${q.answer === 'T' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>{q.answer}</span>
                    {q.explanation && <span className="text-xs text-slate-500">{q.explanation}</span>}
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <span className="text-xs px-3 py-0.5 border border-slate-200 rounded text-slate-400">T</span>
                    <span className="text-xs px-3 py-0.5 border border-slate-200 rounded text-slate-400">F</span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      );
    }
    case 'title_summary': {
      const titles = (result.titles as string[]) ?? [];
      const summaries = (result.summaries as string[]) ?? [];
      const koreanSummary = (result.korean_summary as string) ?? '';
      return (
        <div className="space-y-4">
          <div>
            <p className="text-xs font-black text-slate-500 uppercase tracking-wider mb-2">영어 제목 (3가지)</p>
            {titles.map((t, i) => <p key={i} className="text-sm font-bold italic mb-1"><span className="text-slate-400 mr-2">{i+1}.</span>{t}</p>)}
          </div>
          <div>
            <p className="text-xs font-black text-slate-500 uppercase tracking-wider mb-2">1문장 영어 요약 (3가지)</p>
            {summaries.map((s, i) => <p key={i} className="text-sm leading-relaxed mb-2"><span className="text-slate-400 mr-2">{i+1}.</span>{s}</p>)}
          </div>
          <div className="bg-slate-50 rounded-lg p-3 border border-slate-200">
            <p className="text-xs font-black text-slate-500 mb-2">한글 요약</p>
            <p className="text-sm leading-relaxed text-slate-700">{koreanSummary}</p>
          </div>
        </div>
      );
    }
    case 'suneung_vocab_right':
      return <RenderSuneungVocabABC result={result} showAnswer={showAnswer} />;
    case 'suneung_vocab_wrong':
      return <RenderSuneungVocabWrong result={result} showAnswer={showAnswer} />;
    case 'suneung_grammar_right':
      return <RenderSuneungVocabABC result={result} showAnswer={showAnswer} />;
    case 'suneung_grammar_wrong':
      return <RenderSuneungVocabWrong result={result} showAnswer={showAnswer} />;
    default:
      return <pre className="text-xs text-slate-600 whitespace-pre-wrap">{JSON.stringify(result, null, 2)}</pre>;
  }
}

// ─── PDF render divs ──────────────────────────────────────────────────────────

let _pdfAcademy = '';

const PDF_BASE: React.CSSProperties = {
  position: 'fixed', top: 0, left: 0, width: '800px',
  background: 'white', padding: '20px 48px 40px', boxSizing: 'border-box',
  fontFamily: 'Arial, Helvetica, sans-serif', zIndex: -9999, pointerEvents: 'none',
};
const PDF_H2: React.CSSProperties = { fontSize: 14, fontWeight: 900, margin: '0 0 16px', borderBottom: '2px solid #333', paddingBottom: 8 };
const PDF_P: React.CSSProperties = { fontSize: 13, lineHeight: 2, wordBreak: 'break-word' };

function PdfPageHeader({ children, mb }: { children: React.ReactNode; mb?: number }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', borderBottom: '2px solid #333', paddingBottom: 8, marginBottom: mb ?? 16 }}>
      <span style={{ fontSize: 14, fontWeight: 900 }}>{children}</span>
      {_pdfAcademy && <span style={{ fontSize: 12, color: '#6B7280', fontWeight: 700 }}>{_pdfAcademy}</span>}
    </div>
  );
}

function PdfVocabChoice({ result, isAnswer, title, id }: { result: WorkbookResult; isAnswer: boolean; title: string; id: string }) {
  const sentences = splitBySentence(result.passage as string || '');
  const choiceBase: React.CSSProperties = { borderRadius: 4, padding: '2px 6px', margin: '0 2px', fontWeight: 900, fontSize: 14 };
  const sentStyle: React.CSSProperties = { fontSize: 13, lineHeight: 1.9, wordBreak: 'break-word', margin: '0 0 10px' };
  return (
    <div id={id} style={PDF_BASE}>
      <PdfPageHeader>{title}</PdfPageHeader>
      <div>
        {sentences.map((sentence, si) => {
          const chunks = parseVocabPassage(sentence, result.answer_key as string || '');
          return (
            <p key={si} style={sentStyle}>
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
          );
        })}
      </div>
      {isAnswer && (
        <div style={{ marginTop: 16, padding: '10px 14px', background: '#f8f8f8', borderRadius: 6, fontSize: 12, lineHeight: 1.8 }}>
          <strong>정답:</strong> {result.answer_key as string}
        </div>
      )}
    </div>
  );
}

function PdfVocabFill({ result, isAnswer, title, id, showKorean }: { result: WorkbookResult; isAnswer: boolean; title: string; id: string; showKorean?: boolean }) {
  const answerKey = result.answer_key as string;

  // New sentences[] format
  if (result.sentences && Array.isArray(result.sentences)) {
    const sentences = result.sentences as Array<{ en: string; ko?: string }>;
    const answerMap = buildVocabFillAnswerMap(answerKey);
    return (
      <div id={id} style={PDF_BASE}>
          <PdfPageHeader>{title}{isAnswer ? ' (정답)' : ''}</PdfPageHeader>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {sentences.map((s, si) => {
            const rawParts = s.en.split(/_\((\d+):([a-zA-Z])\)_/);
            return (
              <div key={si} style={{ marginBottom: 4 }}>
                <p style={{ margin: 0, fontSize: 13, lineHeight: 1.9 }}>
                  {rawParts.map((part, i) => {
                    if (i % 3 === 0) return <span key={i}>{part}</span>;
                    if (i % 3 === 1) {
                      const num = parseInt(part);
                      const letter = rawParts[i + 1];
                      const ans = answerMap[num];
                      if (isAnswer) {
                        return <span key={i} style={{ background: '#FFF9C4', borderRadius: 3, padding: '0 4px', fontWeight: 900 }}>{ans}</span>;
                      }
                      return (
                        <span key={i} style={{ whiteSpace: 'nowrap', margin: '0 2px' }}>
                          <span style={{ fontWeight: 700, fontSize: 12 }}>{num}.</span>
                          <span style={{ fontSize: 12, fontWeight: 600 }}>{letter}</span>
                          <span style={{ display: 'inline-block', minWidth: 110, borderBottom: '1.5px solid #333', verticalAlign: 'bottom', marginLeft: 1 }} />
                        </span>
                      );
                    }
                    return null;
                  })}
                </p>
                {showKorean && s.ko && (
                  <p style={{ margin: '2px 0 0 0', fontSize: 11, color: '#666', fontStyle: 'italic' }}>{s.ko}</p>
                )}
              </div>
            );
          })}
        </div>
        {isAnswer && (
          <div style={{ marginTop: 14, padding: '10px 14px', background: '#f8f8f8', borderRadius: 6, fontSize: 12, lineHeight: 1.8 }}>
            <strong>정답:</strong> {answerKey}
          </div>
        )}
      </div>
    );
  }

  // Legacy format (passage + word_bank)
  const passage = result.passage as string;
  const wordBank = result.word_bank as string[];
  const answerMap: Record<number, string> = {};
  const keyParts = answerKey.split(/\d+\.\s*/g).filter(Boolean);
  const nums = [...answerKey.matchAll(/(\d+)\./g)].map(m => parseInt(m[1]));
  nums.forEach((n, i) => { answerMap[n] = (keyParts[i] || '').trim(); });
  const parts = passage.split(/_\((\d+)\)_/);
  return (
    <div id={id} style={PDF_BASE}>
      <PdfPageHeader>{title}</PdfPageHeader>
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
  const answerMap = buildGrammarCorrectAnswerMap(answerKey);
  const regex = /(\d+)\[([^\]]+)\]/g;
  const parts: React.ReactNode[] = [];
  let last = 0; let m: RegExpExecArray | null;
  while ((m = regex.exec(passage)) !== null) {
    if (m.index > last) parts.push(<span key={last}>{passage.slice(last, m.index)}</span>);
    const num = parseInt(m[1]); const word = m[2];
    const correct = answerMap[num] ?? '';
    if (isAnswer) {
      parts.push(
        <span key={m.index} style={{ background: '#FEE2E2', borderRadius: 3, padding: '1px 4px', margin: '0 1px' }}>
          <span style={{ fontWeight: 900 }}>{num}</span>
          <span style={{ textDecoration: 'line-through', color: '#EF4444', marginLeft: 1 }}>[{word}]</span>
          {correct && <span style={{ color: '#16A34A', fontWeight: 900 }}>→{correct}</span>}
        </span>
      );
    } else {
      parts.push(<span key={m.index}><span style={{ fontWeight: 900 }}>{num}</span>[<span style={{ fontWeight: 700 }}>{word}</span>]</span>);
    }
    last = m.index + m[0].length;
  }
  if (last < passage.length) parts.push(<span key={last}>{passage.slice(last)}</span>);
  return (
    <div id={id} style={PDF_BASE}>
      <PdfPageHeader>{title}</PdfPageHeader>
      <p style={PDF_P}>{parts}</p>
      {isAnswer && (
        <div style={{ marginTop: 14, padding: '10px 14px', background: '#f8f8f8', borderRadius: 6, fontSize: 12, lineHeight: 1.8 }}>
          <strong>정답:</strong> {answerKey}
        </div>
      )}
    </div>
  );
}

function PdfGrammarCorrectAdv({ result, isAnswer, title, id }: { result: WorkbookResult; isAnswer: boolean; title: string; id: string }) {
  const sentences = result.sentences as Array<{num: number; text: string}>;
  const answerKey = result.answer_key as string;
  const answerMap: Record<number, string> = {};
  if (answerKey) {
    const entries = answerKey.split(/\s{2,}|\n/).filter(Boolean);
    entries.forEach(entry => {
      const m = entry.match(/^(\d+)\.\s*(.+)$/);
      if (m) answerMap[parseInt(m[1])] = m[2].trim();
    });
  }
  return (
    <div id={id} style={PDF_BASE}>
      <PdfPageHeader>{title}{isAnswer ? ' (정답)' : ''}</PdfPageHeader>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {(sentences || []).map((s, i) => (
          <div key={i} style={{ display: 'flex', gap: 6 }}>
            <span style={{ fontSize: 12, fontWeight: 900, color: '#888', minWidth: 20 }}>{s.num}.</span>
            <div style={{ flex: 1 }}>
              <p style={{ margin: 0, fontSize: 13, lineHeight: 1.9 }}>{s.text}</p>
              {isAnswer && answerMap[s.num]
                ? <p style={{ margin: '2px 0 0', fontSize: 11, color: '#DC2626', fontWeight: 700 }}>{answerMap[s.num]}</p>
                : !isAnswer && <div style={{ height: 16, borderBottom: '1px dashed #ccc', marginTop: 4 }}></div>
              }
            </div>
          </div>
        ))}
      </div>
      {isAnswer && (
        <div style={{ marginTop: 14, padding: '10px 14px', background: '#f8f8f8', borderRadius: 6, fontSize: 12, lineHeight: 1.8 }}>
          <strong>전체 정답:</strong> {answerKey}
        </div>
      )}
    </div>
  );
}

function PdfTranslation({ result, isAnswer, title, id }: { result: WorkbookResult; isAnswer: boolean; title: string; id: string }) {
  const sentences = result.sentences as Array<{num:number;en:string;ko:string}>;
  return (
    <div id={id} style={PDF_BASE}>
      <PdfPageHeader>{title}{isAnswer ? ' (정답)' : ''}</PdfPageHeader>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {(sentences || []).map((s, i) => (
          <div key={i}>
            <p style={{ margin: '0 0 4px', fontSize: 13, fontWeight: 600, color: '#000', lineHeight: 1.9 }}>{s.en}</p>
            <div style={{ borderBottom: '1px solid #94A3B8', paddingBottom: 2, display: 'flex', alignItems: 'flex-end', gap: 6, minHeight: 20 }}>
              <span style={{ fontSize: 11, fontWeight: 900, color: '#94A3B8', whiteSpace: 'nowrap' }}>({s.num})</span>
              {isAnswer && <span style={{ fontSize: 12, fontWeight: 700, color: '#92400E' }}>{s.ko}</span>}
            </div>
            {!isAnswer && <div style={{ borderBottom: '1px solid #CBD5E1', height: 18, marginTop: 6 }}></div>}
          </div>
        ))}
      </div>
    </div>
  );
}

function PdfWordOrder({ result, isAnswer, title, id, showKorean }: { result: WorkbookResult; isAnswer: boolean; title: string; id: string; showKorean?: boolean }) {
  const sentences = result.sentences as Array<{num:number;ko:string;scrambled:string[];answer:string}>;
  return (
    <div id={id} style={PDF_BASE}>
      <PdfPageHeader>{title}{isAnswer ? ' (정답)' : ''}</PdfPageHeader>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {(sentences || []).map((s, i) => (
          <div key={i}>
            <p style={{ margin: '0 0 2px', fontSize: 12, fontWeight: 700, color: '#1e293b' }}>{s.ko}</p>
            <p style={{ margin: '0 0 4px', fontSize: 13, color: '#000' }}>
              ({(s.scrambled || []).join(' / ')})
            </p>
            <div style={{ borderBottom: '1px solid #94A3B8', paddingBottom: 2, display: 'flex', alignItems: 'flex-end', gap: 6, minHeight: 20 }}>
              <span style={{ fontSize: 11, fontWeight: 900, color: '#94A3B8', whiteSpace: 'nowrap' }}>({s.num})</span>
              {isAnswer && <span style={{ fontSize: 12, fontWeight: 700, color: '#92400E' }}>{s.answer}</span>}
            </div>
            {!isAnswer && <div style={{ borderBottom: '1px solid #CBD5E1', height: 18, marginTop: 6 }}></div>}
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
      <PdfPageHeader>{title}{isAnswer ? ' (정답)' : ''}</PdfPageHeader>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {(sentences || []).map((s, i) => (
          <div key={i}>
            <p style={{ margin: '0 0 4px', fontSize: 13, fontWeight: 600, color: '#000', lineHeight: 1.9 }}>{s.ko}</p>
            <div style={{ borderBottom: '1px solid #94A3B8', paddingBottom: 2, display: 'flex', alignItems: 'flex-end', gap: 6, minHeight: 20 }}>
              <span style={{ fontSize: 11, fontWeight: 900, color: '#94A3B8', whiteSpace: 'nowrap' }}>({s.num})</span>
              {isAnswer && <span style={{ fontSize: 12, fontWeight: 700, color: '#92400E' }}>{s.answer}</span>}
            </div>
            {!isAnswer && <div style={{ borderBottom: '1px solid #CBD5E1', height: 18, marginTop: 6 }}></div>}
          </div>
        ))}
      </div>
    </div>
  );
}

function PdfPassageTranslation({ result, id, title }: { result: WorkbookResult; id: string; title?: string }) {
  const sentences = (result.sentences || result.items) as PassageSentence[];
  const vocabTable = result.vocab_table as VocabRow[] || [];
  const keyColors: Record<string, string> = {};
  const pdfColors = ['#DC2626','#2563EB','#059669','#7C3AED','#D97706'];
  let ci = 0;
  sentences?.forEach(s => (s.key_words || []).forEach(kw => {
    if (!keyColors[kw.toLowerCase()]) keyColors[kw.toLowerCase()] = pdfColors[ci++ % pdfColors.length];
  }));

  const renderHighlighted = (text: string, keyWords: string[]) => {
    if (!keyWords || keyWords.length === 0) return text;
    const escaped = keyWords.map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    const regex = new RegExp(`(${escaped.join('|')})`, 'gi');
    const parts = text.split(regex);
    return parts.map((part, i) => {
      const isKey = !!keyColors[part.toLowerCase()];
      if (isKey) return <span key={i} style={{ color: '#000', fontWeight: 900 }}>{part}</span>;
      return <span key={i}>{part}</span>;
    });
  };

  return (
    <div id={id} style={PDF_BASE}>
      <PdfPageHeader>{title || '지문 해석지'}</PdfPageHeader>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <colgroup><col style={{ width: '67%' }} /><col style={{ width: '33%' }} /></colgroup>
        <tbody>
          {(sentences || []).map((s, i) => (
            <tr key={i} style={{ borderBottom: '1px solid #F1F5F9' }}>
              <td style={{ padding: '4px 10px 4px 0', fontSize: 12, lineHeight: 1.9, verticalAlign: 'top' }}>
                {renderHighlighted(s.en, s.key_words || [])}
              </td>
              <td style={{ padding: '4px 0 4px 8px', fontSize: 12, color: '#000', fontWeight: 700, lineHeight: 1.6, verticalAlign: 'top', borderLeft: '1px solid #E2E8F0' }}>
                {s.ko}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {vocabTable.length > 0 && (
        <div style={{ marginTop: 18 }}>
          <p style={{ margin: '0 0 6px', fontSize: 11, fontWeight: 900, color: '#374151' }}>지문의 주요 어휘와 뜻</p>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 10 }}>
            <thead>
              <tr style={{ background: '#1E293B', color: '#fff' }}>
                {['표제어 (뜻)', '유의어 1 (뜻)', '유의어 2 (뜻)', '유의어 3 (뜻)', '반의어 (뜻)'].map((h, i) => (
                  <th key={i} style={{ padding: '4px 6px', textAlign: 'left', fontWeight: 900, borderRight: '1px solid #334155' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {vocabTable.map((row, i) => (
                <tr key={i} style={{ background: i % 2 === 0 ? '#fff' : '#F8FAFC' }}>
                  <td style={{ padding: '3px 6px', borderRight: '1px solid #E2E8F0', borderBottom: '1px solid #E2E8F0' }}>
                    <span style={{ fontWeight: 900 }}>{row.word}</span>
                    {row.meaning && <span style={{ color: '#64748B', marginLeft: 3 }}>({row.meaning})</span>}
                  </td>
                  {[['syn1','syn1_m'],['syn2','syn2_m'],['syn3','syn3_m']].map(([k,m]) => (
                    <td key={k} style={{ padding: '3px 6px', borderRight: '1px solid #E2E8F0', borderBottom: '1px solid #E2E8F0' }}>
                      {(row as Record<string,string>)[k] && <>
                        <span style={{ color: '#1D4ED8', fontWeight: 700 }}>{(row as Record<string,string>)[k]}</span>
                        {(row as Record<string,string>)[m] && <span style={{ color: '#64748B', marginLeft: 3 }}>({(row as Record<string,string>)[m]})</span>}
                      </>}
                    </td>
                  ))}
                  <td style={{ padding: '3px 6px', borderBottom: '1px solid #E2E8F0' }}>
                    {row.antonym && <>
                      <span style={{ color: '#DC2626', fontWeight: 700 }}>{row.antonym}</span>
                      {row.antonym_m && <span style={{ color: '#64748B', marginLeft: 3 }}>({row.antonym_m})</span>}
                    </>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function PdfParagraphOrder({ result, isAnswer, title, id }: { result: WorkbookResult; isAnswer: boolean; title: string; id: string }) {
  const data = result as {fixed_paragraph:string;shuffled_paragraphs:Array<{label:string;text:string}>;answer_key:string};
  return (
    <div id={id} style={PDF_BASE}>
      <PdfPageHeader>{title}{isAnswer ? ' (정답)' : ''}</PdfPageHeader>
      <div style={{ background: '#fff', border: '2px solid #0F172A', borderRadius: 6, padding: '10px 14px', marginBottom: 14, fontSize: 13, lineHeight: 1.9 }}>
        <strong>제시 단락</strong><br />{data.fixed_paragraph}
      </div>
      {(data.shuffled_paragraphs || []).map((p, i) => (
        <div key={i} style={{ border: '1px solid #E5E7EB', borderRadius: 6, padding: '10px 14px', marginBottom: 10, fontSize: 13, lineHeight: 1.9 }}>
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
      <PdfPageHeader>{title}{isAnswer ? ' (정답)' : ''}</PdfPageHeader>
      <div style={{ background: '#F5F3FF', border: '2px solid #A78BFA', borderRadius: 6, padding: '10px 14px', marginBottom: 14, fontSize: 13, fontStyle: 'italic', lineHeight: 1.9 }}>
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

function PdfSuneungVocabWrong({ result, isAnswer, title, id, questionText }: { result: WorkbookResult; isAnswer: boolean; title: string; id: string; questionText?: string }) {
  const passage = result.passage as string ?? '';
  const answerKey = result.answer_key as string ?? '';
  const parts = passage.split(/([①②③④⑤][a-zA-Z''\-]+)/g);
  return (
    <div id={id} style={PDF_BASE}>
      <p style={{ margin: '0 0 8px', fontSize: 11, fontWeight: 900, color: '#374151' }}>
        {questionText ?? 'Q. 다음 글의 밑줄 친 부분 중, 문맥상 어휘의 쓰임이 적절하지 않은 것을 고르시오.'}
      </p>
      <PdfPageHeader mb={10}>{title}</PdfPageHeader>
      <p style={PDF_P}>
        {parts.map((part, i) => {
          const m = part.match(/^([①②③④⑤])(.+)$/);
          if (m) return (
            <span key={i}>
              <span style={{ fontWeight: 900 }}>{m[1]}</span>
              <span style={{ textDecoration: 'underline', fontWeight: 700 }}>{m[2]}</span>
            </span>
          );
          return <span key={i}>{part}</span>;
        })}
      </p>
      {isAnswer && (
        <div style={{ marginTop: 14, padding: '8px 14px', background: '#FEF9C3', borderRadius: 6, fontSize: 12, fontWeight: 700 }}>
          정답: {answerKey}
        </div>
      )}
    </div>
  );
}

function PdfSuneungVocabABC({ result, isAnswer, title, id, questionText }: { result: WorkbookResult; isAnswer: boolean; title: string; id: string; questionText?: string }) {
  const passage = result.passage as string ?? '';
  const choices = (result.choices as Array<{label: string; A: string; B: string; C: string}>) || [];
  const answerKey = result.answer_key as string ?? '';
  const parts = passage.split(/(\([ABC]\)\[[^\]]+\])/g);
  const renderPassage = () => parts.map((part, i) => {
    const m = part.match(/\(([ABC])\)\[([^\]]+)\]/);
    if (m) return (
      <span key={i}>
        <span style={{ fontWeight: 900, color: '#6D28D9' }}>({m[1]})</span>
        <span style={{ borderRadius: 3, padding: '1px 5px', fontWeight: 700 }}>[{m[2]}]</span>
      </span>
    );
    return <span key={i}>{part}</span>;
  });
  return (
    <div id={id} style={PDF_BASE}>
      <p style={{ margin: '0 0 8px', fontSize: 11, fontWeight: 900, color: '#374151' }}>
        {questionText ?? 'Q. (A), (B), (C)의 각 [ ] 안에서 문맥에 맞는 어휘로 가장 적절한 것을 고르시오.'}
      </p>
      <PdfPageHeader mb={10}>{title}</PdfPageHeader>
      <p style={PDF_P}>{renderPassage()}</p>
      <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 16, fontSize: 12 }}>
        <thead>
          <tr style={{ background: '#F1F5F9' }}>
            <th style={{ padding: '5px 10px', width: 32, borderRight: '1px solid #E2E8F0', borderBottom: '1px solid #CBD5E1' }}></th>
            {['(A)', '(B)', '(C)'].map((h, i) => (
              <th key={i} style={{ padding: '5px 0', textAlign: 'center', fontWeight: 900, color: '#374151', borderRight: i < 2 ? '1px solid #E2E8F0' : undefined, borderBottom: '1px solid #CBD5E1', width: '31%' }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {choices.map((c, i) => {
            const correct = isAnswer && c.label === answerKey;
            return (
              <tr key={i} style={{ background: correct ? '#FEFCE8' : (i % 2 === 0 ? '#fff' : '#F8FAFC') }}>
                <td style={{ padding: '4px 10px', fontWeight: 900, color: '#64748B', borderRight: '1px solid #E2E8F0', borderBottom: '1px solid #F1F5F9', textAlign: 'center' }}>{c.label}</td>
                {[c.A, c.B, c.C].map((val, j) => (
                  <td key={j} style={{ padding: '4px 0', textAlign: 'center', borderRight: j < 2 ? '1px solid #E2E8F0' : undefined, borderBottom: '1px solid #F1F5F9', fontWeight: correct ? 900 : 400, color: correct ? '#059669' : '#1E293B' }}>{val}</td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
      {isAnswer && (
        <div style={{ marginTop: 14, padding: '8px 14px', background: '#FEF9C3', borderRadius: 6, fontSize: 12, fontWeight: 700 }}>
          정답: {answerKey}
        </div>
      )}
    </div>
  );
}

function PdfPassageAnalysis({ result, id, title }: { result: WorkbookResult; id: string; title?: string }) {
  type Chunk = { text: string; role: string };
  type Sentence = { num: number; en: string; ko: string; chunks: Chunk[] };
  const sentences = (result.sentences as Sentence[]) ?? [];
  const ROLE_COLORS: Record<string, string> = {
    'S': '#1D4ED8', 'V': '#DC2626', 'O': '#059669', 'SC': '#7C3AED', 'OC': '#D97706',
    '전치사구': '#475569', 'to부정사구': '#C2410C', '현재분사구': '#0D9488', '과거분사구': '#0369A1',
    '관계절': '#4338CA', '부사절': '#BE123C', '명사절': '#7E22CE',
  };
  const ROLE_LABELS: Record<string, string> = {
    'S': 'S 주어', 'V': 'V 동사', 'O': 'O 목적어', 'SC': 'SC 주격보어', 'OC': 'OC 목적격보어',
    '전치사구': '전치사구', 'to부정사구': 'to부정사구', '현재분사구': '현재분사구', '과거분사구': '과거분사구',
    '관계절': '관계절', '부사절': '부사절', '명사절': '명사절',
  };
  const getColor = (role: string) => ROLE_COLORS[role] ?? '#6B7280';
  const getLabel = (role: string) => ROLE_LABELS[role] ?? 'M 수식어';
  const isPhr = (role: string) => PHRASE_ROLES.has(role);
  return (
    <div id={id} style={PDF_BASE}>
      <PdfPageHeader>{title || '지문 구문분석'}</PdfPageHeader>
      {/* 범례 */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 6px', marginBottom: 8, alignItems: 'center' }}>
        {([
          { label: 'S 주어',      color: '#1D4ED8', italic: false, paren: false },
          { label: 'V 동사',      color: '#DC2626', italic: false, paren: false },
          { label: 'O 목적어',    color: '#059669', italic: false, paren: false },
          { label: 'SC 주격보어', color: '#7C3AED', italic: false, paren: false },
          { label: 'OC 목적격보어', color: '#D97706', italic: false, paren: false },
          { label: '전치사구',    color: '#475569', italic: true,  paren: true  },
          { label: 'to부정사구',  color: '#C2410C', italic: true,  paren: true  },
          { label: '현재분사구',  color: '#0D9488', italic: true,  paren: true  },
          { label: '과거분사구',  color: '#0369A1', italic: true,  paren: true  },
          { label: '관계절',      color: '#4338CA', italic: true,  paren: true  },
          { label: '부사절',      color: '#BE123C', italic: true,  paren: true  },
          { label: '명사절',      color: '#7E22CE', italic: true,  paren: true  },
          { label: 'M 수식어',    color: '#6B7280', italic: false, paren: false },
        ] as { label: string; color: string; italic: boolean; paren: boolean }[]).map(item => (
          <span key={item.label} style={{
            display: 'inline-block',
            padding: '2px 7px',
            border: `1.5px solid ${item.color}`,
            borderRadius: 99,
            fontSize: 8.5,
            fontWeight: 700,
            color: item.color,
            fontStyle: item.italic ? 'italic' : 'normal',
            lineHeight: 1.4,
          }}>
            {item.paren ? `(${item.label})` : item.label}
          </span>
        ))}
      </div>
      {/* 헤더 */}
      <div style={{ display: 'flex', borderRadius: 6, overflow: 'hidden', border: '1px solid #CBD5E1', marginBottom: 6, fontSize: 10, fontWeight: 900 }}>
        <div style={{ width: '70%', background: '#1E293B', color: '#fff', padding: '5px 12px' }}>영어 구문분석</div>
        <div style={{ width: '30%', background: '#334155', color: '#fff', padding: '5px 12px', borderLeft: '1px solid #4B5563' }}>한국어 번역</div>
      </div>
      {sentences.map((sent, si) => (
        <div key={si} style={{ display: 'flex', border: '1px solid #E5E7EB', borderRadius: 6, marginBottom: 5, overflow: 'hidden' }}>
          {/* 왼쪽 70%: 구문분석 */}
          <div style={{ width: '70%', padding: '10px 12px', background: '#fff', borderRight: '1px solid #F1F5F9' }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px 6px', alignItems: 'flex-end' }}>
              {sent.chunks.map((chunk, ci) => {
                const color = getColor(chunk.role);
                const phrase = isPhr(chunk.role);
                return (
                  <div key={ci} style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center' }}>
                    <span style={{ fontSize: 11, fontWeight: 700, paddingBottom: 2, borderBottom: `2px solid ${color}`, color, fontStyle: phrase ? 'italic' : 'normal' }}>
                      {phrase ? `(${chunk.text})` : chunk.text}
                    </span>
                    <span style={{ fontSize: 8, fontWeight: 900, color, marginTop: 1 }}>{getLabel(chunk.role)}</span>
                  </div>
                );
              })}
            </div>
          </div>
          {/* 오른쪽 30%: 한국어 번역 */}
          <div style={{ width: '30%', padding: '8px 10px', background: '#F8FAFC', display: 'flex', alignItems: 'flex-start', gap: 4 }}>
            <span style={{ fontSize: 9, fontWeight: 900, color: '#9CA3AF', marginTop: 2, flexShrink: 0 }}>{sent.num}.</span>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#4B5563', lineHeight: 1.6 }}>{sent.ko}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

function PdfSummarySentence({ result, isAnswer, title, id }: { result: WorkbookResult; isAnswer: boolean; title: string; id: string }) {
  const summary = (result.summary as string) ?? '';
  const instruction = (result.instruction as string) ?? '다음 글의 내용을 한 문장으로 요약할 때, 빈칸에 들어갈 알맞은 단어를 본문에서 찾아 쓰시오.';
  const answerKey = (result.answer_key as string) ?? '';
  const originalText = (result._original_text as string) ?? '';
  const answers: Record<number, string> = {};
  for (const m of answerKey.matchAll(/\((\d+)\)\s+(\S+)/g)) answers[parseInt(m[1])] = m[2];
  const parts = summary.split(/(\(\d+\)_+)/g);
  return (
    <div id={id} style={PDF_BASE}>
      <PdfPageHeader>{title}{isAnswer ? ' (정답)' : ''}</PdfPageHeader>
      {originalText && !isAnswer && (
        <div style={{ marginBottom: 14, padding: '10px 14px', background: '#F8FAFC', borderRadius: 6, border: '1px solid #E2E8F0', fontSize: 12, lineHeight: 1.8 }}>
          {originalText}
        </div>
      )}
      <p style={{ margin: '0 0 10px', fontSize: 11, color: '#6B7280', fontStyle: 'italic' }}>{instruction}</p>
      <p style={{ ...PDF_P, lineHeight: 2.8 }}>
        {parts.map((part, i) => {
          const m = part.match(/\((\d+)\)_+/);
          if (m) {
            const n = parseInt(m[1]);
            return (
              <span key={i} style={{ display: 'inline-flex', alignItems: 'flex-end', margin: '0 2px', verticalAlign: 'bottom' }}>
                {isAnswer
                  ? <span style={{ borderBottom: '2px solid #4338CA', color: '#4338CA', fontWeight: 900, padding: '0 4px', fontSize: 12 }}>{answers[n] ?? '?'}</span>
                  : <span style={{ borderBottom: '2px solid #9CA3AF', display: 'inline-block', width: 128 }}>&nbsp;</span>
                }
              </span>
            );
          }
          return <span key={i}>{part}</span>;
        })}
      </p>
      {isAnswer && (
        <div style={{ marginTop: 14, padding: '8px 12px', background: '#FFF9C4', borderRadius: 6, fontSize: 12, fontWeight: 700 }}>
          정답: {answerKey}
        </div>
      )}
    </div>
  );
}

function PdfTfQuestions({ result, isAnswer, title, id }: { result: WorkbookResult; isAnswer: boolean; title: string; id: string }) {
  const questions = (result.questions as Array<{num:number;statement:string;answer:string;explanation?:string}>) ?? [];
  return (
    <div id={id} style={PDF_BASE}>
      <PdfPageHeader>{title}{isAnswer ? ' (정답)' : ''}</PdfPageHeader>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {questions.map((q, i) => (
          <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', padding: '6px 0', borderBottom: '1px solid #F1F5F9' }}>
            <span style={{ flexShrink: 0, minWidth: 24, fontSize: 12, fontWeight: 900, color: '#64748B' }}>{q.num}.</span>
            <div style={{ flex: 1 }}>
              <p style={{ margin: 0, fontSize: 12, lineHeight: 1.9 }}>{q.statement}</p>
              {isAnswer ? (
                <div style={{ marginTop: 3, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 11, fontWeight: 900, padding: '1px 8px', borderRadius: 4, background: q.answer === 'T' ? '#D1FAE5' : '#FEE2E2', color: q.answer === 'T' ? '#065F46' : '#991B1B' }}>{q.answer}</span>
                  {q.explanation && <span style={{ fontSize: 10, color: '#6B7280' }}>{q.explanation}</span>}
                </div>
              ) : (
                <div style={{ marginTop: 4, display: 'flex', gap: 8 }}>
                  <span style={{ fontSize: 11, padding: '1px 10px', border: '1px solid #CBD5E1', borderRadius: 4, color: '#94A3B8' }}>T</span>
                  <span style={{ fontSize: 11, padding: '1px 10px', border: '1px solid #CBD5E1', borderRadius: 4, color: '#94A3B8' }}>F</span>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
      {isAnswer && (
        <div style={{ marginTop: 14, padding: '10px 14px', background: '#f8f8f8', borderRadius: 6, fontSize: 12, lineHeight: 1.8 }}>
          <strong>정답:</strong> {questions.map(q => `${q.num}.${q.answer}`).join('  ')}
        </div>
      )}
    </div>
  );
}

function PdfTitleSummary({ result, isAnswer, title, id }: { result: WorkbookResult; isAnswer: boolean; title: string; id: string }) {
  const titles = (result.titles as string[]) ?? [];
  const summaries = (result.summaries as string[]) ?? [];
  const koreanSummary = (result.korean_summary as string) ?? '';
  return (
    <div id={id} style={PDF_BASE}>
      <PdfPageHeader>{title}{isAnswer ? ' (정답)' : ''}</PdfPageHeader>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div>
          <div style={{ fontSize: 10, fontWeight: 900, color: '#475569', marginBottom: 6, letterSpacing: 1, textTransform: 'uppercase' }}>영어 제목 (3가지)</div>
          {titles.map((t, i) => (
            <div key={i} style={{ display: 'flex', gap: 6, marginBottom: 5 }}>
              <span style={{ flexShrink: 0, fontSize: 11, fontWeight: 900, color: '#94A3B8', minWidth: 18 }}>{i+1}.</span>
              <span style={{ fontSize: 13, fontWeight: 700, fontStyle: 'italic' }}>{t}</span>
            </div>
          ))}
        </div>
        <div>
          <div style={{ fontSize: 10, fontWeight: 900, color: '#475569', marginBottom: 6, letterSpacing: 1, textTransform: 'uppercase' }}>1문장 영어 요약 (3가지)</div>
          {summaries.map((s, i) => (
            <div key={i} style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
              <span style={{ flexShrink: 0, fontSize: 11, fontWeight: 900, color: '#94A3B8', minWidth: 18 }}>{i+1}.</span>
              <span style={{ fontSize: 12, lineHeight: 1.9 }}>{s}</span>
            </div>
          ))}
        </div>
        <div style={{ background: '#F8FAFC', borderRadius: 6, padding: '10px 14px', border: '1px solid #E2E8F0' }}>
          <div style={{ fontSize: 10, fontWeight: 900, color: '#475569', marginBottom: 5 }}>한글 요약</div>
          <p style={{ margin: 0, fontSize: 12, lineHeight: 1.8, color: '#374151' }}>{koreanSummary}</p>
        </div>
      </div>
    </div>
  );
}

function PdfSimple({ result, isAnswer, title, id }: { result: WorkbookResult; isAnswer: boolean; title: string; id: string }) {
  return (
    <div id={id} style={PDF_BASE}>
      <PdfPageHeader>{title}{isAnswer ? ' (정답)' : ''}</PdfPageHeader>
      <p style={PDF_P}>{result.passage as string}</p>
      {isAnswer && (
        <div style={{ marginTop: 14, padding: '10px 14px', background: '#FFF9C4', borderRadius: 6, fontSize: 13, fontWeight: 700 }}>
          {result.answer_key as string}
        </div>
      )}
    </div>
  );
}

function PdfComboGrammarInsert({ result, isAnswer, title, id }: { result: WorkbookResult; isAnswer: boolean; title: string; id: string }) {
  const passage = result.passage as string ?? '';
  const insertSentence = result.insert_sentence as string ?? '';
  const insertAnswer = result.insert_answer as string ?? '';
  const grammarWrong = (result.grammar_wrong as string[]) || [];
  const grammarAnswers = (result.grammar_answers as Array<{num:string;wrong:string;correct:string}>) || [];
  const parts = passage.split(/(\([A-E]\)|[①②③④⑤] ?[a-zA-Z][a-zA-Z0-9''''\-]*)/g);
  const renderPassage = () => parts.map((part, i) => {
    const ins = part.match(/^\(([A-E])\)$/);
    if (ins) return (
      <span key={i} style={{ fontWeight: 900, color: '#6D28D9', margin: '0 2px', fontSize: 11 }}>({ins[1]})</span>
    );
    const gm = part.match(/^([①②③④⑤]) ?(.+)$/);
    if (gm) return (
      <span key={i}>
        <span style={{ fontWeight: 900 }}>{gm[1]}</span>
        <span style={{ fontWeight: 700, textDecoration: 'underline' }}>{gm[2]}</span>
      </span>
    );
    return <span key={i}>{part}</span>;
  });
  const choiceNums = ['①','②','③','④','⑤'];
  const choiceLabels = ['A','B','C','D','E'];
  return (
    <div id={id} style={PDF_BASE}>
      <p style={{ margin: '0 0 8px', fontSize: 11, fontWeight: 900, color: '#374151' }}>
        Q. 다음 글을 읽고 물음에 답하시오.
      </p>
      <PdfPageHeader mb={10}>{title}</PdfPageHeader>
      <p style={PDF_P}>{renderPassage()}</p>
      <div style={{ marginTop: 18, padding: '10px 14px', background: '#F8FAFC', borderRadius: 6, border: '1px solid #E2E8F0' }}>
        <p style={{ margin: '0 0 8px', fontSize: 11, fontWeight: 900, color: '#374151' }}>
          1. 위 글의 밑줄 친 {grammarWrong.join(', ')}를 어법에 맞게 바꾸어 쓰시오.
        </p>
        {grammarWrong.map((num, i) => {
          const ans = grammarAnswers.find(a => a.num === num);
          return (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <span style={{ fontWeight: 900, fontSize: 12, width: 20, flexShrink: 0 }}>{num}</span>
              {isAnswer && ans
                ? <span style={{ fontWeight: 700, color: '#059669', fontSize: 12 }}>{ans.correct}</span>
                : <span style={{ borderBottom: '1px solid #94A3B8', display: 'inline-block', minWidth: 180 }}>&nbsp;</span>}
            </div>
          );
        })}
      </div>
      <div style={{ marginTop: 10, padding: '10px 14px', background: '#F8FAFC', borderRadius: 6, border: '1px solid #E2E8F0' }}>
        <p style={{ margin: '0 0 8px', fontSize: 11, fontWeight: 900, color: '#374151' }}>
          2. 위 글의 흐름상 (A)~(E) 중 주어진 문장이 들어가기에 가장 적절한 곳은 어디인가?
        </p>
        <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 4, padding: '6px 10px', marginBottom: 10, fontSize: 12, fontStyle: 'italic', color: '#374151' }}>
          {insertSentence}
        </div>
        <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', fontSize: 12 }}>
          {choiceLabels.map((l, i) => {
            const hit = isAnswer && insertAnswer === `(${l})`;
            return <span key={i} style={{ fontWeight: hit ? 900 : 400, color: hit ? '#DC2626' : '#1E293B', textDecoration: hit ? 'underline' : undefined }}>{choiceNums[i]} {l}</span>;
          })}
        </div>
        {isAnswer && <div style={{ marginTop: 8, fontSize: 12, fontWeight: 700, color: '#92400E' }}>정답: {insertAnswer}</div>}
      </div>
    </div>
  );
}

function PdfComboGrammarOrder({ result, isAnswer, title, id }: { result: WorkbookResult; isAnswer: boolean; title: string; id: string }) {
  const paragraphs = (result.paragraphs as Array<{label:string;text:string}>) || [];
  const orderAnswer = result.order_answer as string ?? '';
  const grammarErrors = (result.grammar_errors as Array<{label:string;wrong:string;correct:string}>) || [];
  return (
    <div id={id} style={PDF_BASE}>
      <p style={{ margin: '0 0 8px', fontSize: 11, fontWeight: 900, color: '#374151' }}>
        Q. 다음 글을 읽고 물음에 답하시오.
      </p>
      <PdfPageHeader mb={10}>{title}</PdfPageHeader>
      {paragraphs.map((p, i) => {
        const sortedErrors = [...grammarErrors].sort((a, b) => b.wrong.length - a.wrong.length);
        const escaped = sortedErrors.map(e => e.wrong.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
        const parts = escaped.length > 0 ? p.text.split(new RegExp(`(${escaped.join('|')})`, 'g')) : [p.text];
        return (
          <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 10, alignItems: 'flex-start' }}>
            <span style={{ fontWeight: 900, color: '#B45309', flexShrink: 0, fontSize: 13 }}>{p.label}</span>
            <p style={{ ...PDF_P, margin: 0 }}>
              {parts.map((part, j) => {
                const isError = sortedErrors.some(e => e.wrong === part);
                return isError
                  ? <span key={j} style={{ textDecoration: 'underline', textDecorationColor: '#DC2626', textDecorationThickness: 2, fontWeight: 700 }}>{part}</span>
                  : <span key={j}>{part}</span>;
              })}
            </p>
          </div>
        );
      })}
      <div style={{ marginTop: 18, padding: '10px 14px', background: '#F8FAFC', borderRadius: 6, border: '1px solid #E2E8F0' }}>
        <p style={{ margin: '0 0 6px', fontSize: 11, fontWeight: 900, color: '#374151' }}>
          1. 주어진 글 (A)에 이어질 내용을 순서에 맞게 배열하시오.
        </p>
        <p style={{ fontSize: 12, color: '#64748B', margin: '0 0 4px' }}>정답: (A) -</p>
        {isAnswer && <div style={{ fontSize: 12, fontWeight: 700, color: '#92400E', marginTop: 6 }}>정답: {orderAnswer}</div>}
      </div>
      <div style={{ marginTop: 10, padding: '10px 14px', background: '#F8FAFC', borderRadius: 6, border: '1px solid #E2E8F0' }}>
        <p style={{ margin: '0 0 8px', fontSize: 11, fontWeight: 900, color: '#374151' }}>
          2. 위 글에서 어법상 어색한 부분을 각각 바르게 고치시오. (3개)
        </p>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr style={{ background: '#F1F5F9' }}>
              <th style={{ padding: '5px 8px', width: 32, border: '1px solid #CBD5E1', textAlign: 'center' }}></th>
              <th style={{ padding: '5px 8px', border: '1px solid #CBD5E1', textAlign: 'center', fontWeight: 900, color: '#374151' }}>어색한 부분</th>
              <th style={{ padding: '5px 8px', width: 24, border: '1px solid #CBD5E1', textAlign: 'center' }}></th>
              <th style={{ padding: '5px 8px', border: '1px solid #CBD5E1', textAlign: 'center', fontWeight: 900, color: '#374151' }}>고친 부분</th>
            </tr>
          </thead>
          <tbody>
            {isAnswer ? grammarErrors.map((e, i) => (
              <tr key={i} style={{ background: i % 2 === 0 ? '#fff' : '#F8FAFC' }}>
                <td style={{ padding: '6px 8px', border: '1px solid #E2E8F0', fontWeight: 700, color: '#64748B', textAlign: 'center' }}>{e.label}</td>
                <td style={{ padding: '6px 8px', border: '1px solid #E2E8F0', fontWeight: 700, color: '#DC2626', textAlign: 'center' }}>{e.wrong}</td>
                <td style={{ padding: '6px 8px', border: '1px solid #E2E8F0', color: '#94A3B8', textAlign: 'center' }}>→</td>
                <td style={{ padding: '6px 8px', border: '1px solid #E2E8F0', fontWeight: 700, color: '#059669', textAlign: 'center' }}>{e.correct}</td>
              </tr>
            )) : [1,2,3].map((n, i) => (
              <tr key={i} style={{ background: i % 2 === 0 ? '#fff' : '#F8FAFC' }}>
                <td style={{ padding: '6px 8px', border: '1px solid #E2E8F0', fontWeight: 700, color: '#64748B', textAlign: 'center' }}>({n})</td>
                <td style={{ padding: '22px 8px', border: '1px solid #E2E8F0' }}></td>
                <td style={{ padding: '6px 8px', border: '1px solid #E2E8F0', color: '#94A3B8', textAlign: 'center' }}>→</td>
                <td style={{ padding: '22px 8px', border: '1px solid #E2E8F0' }}></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function PdfComboVocabFill({ result, isAnswer, title, id }: { result: WorkbookResult; isAnswer: boolean; title: string; id: string }) {
  const passage = result.passage as string ?? '';
  const q1Choices = (result.q1_choices as Array<{label:string;word:string}>) || [];
  const q1Answer = result.q1_answer as string ?? '';
  const q2Items = (result.q2_items as Array<{blank:string;words:string[];answer:string;ko?:string}>) || [];
  const hasKo = q2Items.some(item => item.ko);
  const q2CondText = hasKo
    ? '주어진 단어를 모두 사용하여 다음 우리말과 같은 뜻이 되도록 배열하시오.'
    : '보기의 단어를 활용하여 빈칸을 완성하시오.';
  const parts = passage.split(/(\([A-D가나]\)\[_+\])/g);
  const renderPassage = () => parts.map((part, i) => {
    const m = part.match(/^\(([A-D가나])\)(\[_+\])$/);
    if (!m) return <span key={i}>{part}</span>;
    const isLong = /[가나]/.test(m[1]);
    return (
      <span key={i}>
        <span style={{ fontWeight: 900, color: isLong ? '#6D28D9' : '#B45309' }}>({m[1]})</span>
        <span style={{ borderBottom: '1.5px solid #374151', display: 'inline-block', minWidth: isLong ? 180 : 48 }}>&nbsp;</span>
      </span>
    );
  });
  return (
    <div id={id} style={PDF_BASE}>
      <p style={{ margin: '0 0 8px', fontSize: 11, fontWeight: 900, color: '#374151' }}>
        Q. 다음 글을 읽고 물음에 답하시오.
      </p>
      <PdfPageHeader mb={10}>{title}</PdfPageHeader>
      <p style={PDF_P}>{renderPassage()}</p>
      <div style={{ marginTop: 18, padding: '10px 14px', background: '#F8FAFC', borderRadius: 6, border: '1px solid #E2E8F0' }}>
        <p style={{ margin: '0 0 8px', fontSize: 11, fontWeight: 900, color: '#374151' }}>
          1. 문맥상 위 글의 빈칸 (A)~(D)에 들어갈 수 없는 단어 하나는?
        </p>
        <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', fontSize: 12 }}>
          {q1Choices.map((c, i) => {
            const hit = isAnswer && c.label === q1Answer;
            return <span key={i} style={{ fontWeight: hit ? 900 : 400, color: hit ? '#DC2626' : '#1E293B', textDecoration: hit ? 'underline' : undefined }}>{c.label} {c.word}</span>;
          })}
        </div>
        {isAnswer && <div style={{ marginTop: 8, fontSize: 12, fontWeight: 700, color: '#92400E' }}>정답: {q1Answer}</div>}
      </div>
      <div style={{ marginTop: 10, padding: '10px 14px', background: '#F8FAFC', borderRadius: 6, border: '1px solid #E2E8F0' }}>
        <p style={{ margin: '0 0 6px', fontSize: 11, fontWeight: 900, color: '#374151' }}>
          2. 위 글의 빈칸 (가),(나)에 들어갈 말을 &lt;조건&gt;에 맞게 쓰시오.
        </p>
        <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 4, padding: '6px 10px', marginBottom: 10, fontSize: 11, color: '#475569' }}>
          <p style={{ margin: '0 0 2px', fontWeight: 900 }}>&lt;조건&gt;</p>
          <p style={{ margin: 0 }}>{q2CondText}</p>
        </div>
        {q2Items.map((item, i) => (
          <div key={i} style={{ marginBottom: i < q2Items.length - 1 ? 12 : 0 }}>
            {item.ko && (
              <p style={{ margin: '0 0 4px', fontSize: 11, color: '#4338CA', background: '#EEF2FF', border: '1px solid #C7D2FE', borderRadius: 4, padding: '3px 8px', fontStyle: 'italic' }}>
                {item.ko}
              </p>
            )}
            <p style={{ margin: '0 0 4px', fontSize: 11, fontWeight: 900, color: '#6D28D9' }}>{item.blank} &lt;보기&gt;</p>
            <p style={{ margin: '0 0 4px', fontSize: 11, background: '#fff', border: '1px solid #E2E8F0', borderRadius: 4, padding: '4px 8px', lineHeight: 1.9 }}>
              {item.words.join(' / ')}
            </p>
            {isAnswer && <div style={{ fontSize: 12, fontWeight: 700, color: '#92400E' }}>정답: {item.answer}</div>}
          </div>
        ))}
      </div>
    </div>
  );
}

function PdfComboVocabGrammar({ result, isAnswer, title, id }: { result: WorkbookResult; isAnswer: boolean; title: string; id: string }) {
  const passage = result.passage as string ?? '';
  const q1Choices = (result.q1_choices as Array<{label:string;blank:string;word:string}>) || [];
  const q1Answer = result.q1_answer as string ?? '';
  const q2Choices = (result.q2_choices as Array<{label:string;pair:string}>) || [];
  const q2Answer = result.q2_answer as string ?? '';
  const parts = passage.split(/(\([A-E]\)_{3,}|[①②③④⑤][a-zA-Z''\-]+)/g);
  const renderPassage = () => parts.map((part, i) => {
    const bm = part.match(/^\(([A-E])\)(_{3,})$/);
    if (bm) return (
      <span key={i}>
        <span style={{ fontWeight: 900, color: '#B45309' }}>({bm[1]})</span>
        <span style={{ borderBottom: '1.5px solid #374151', display: 'inline-block', minWidth: 48 }}>&nbsp;&nbsp;&nbsp;</span>
      </span>
    );
    const gm = part.match(/^([①②③④⑤])(.+)$/);
    if (gm) return (
      <span key={i}>
        <span style={{ fontWeight: 900 }}>{gm[1]}</span>
        <span style={{ fontWeight: 700, textDecoration: 'underline' }}>{gm[2]}</span>
      </span>
    );
    return <span key={i}>{part}</span>;
  });
  return (
    <div id={id} style={PDF_BASE}>
      <p style={{ margin: '0 0 8px', fontSize: 11, fontWeight: 900, color: '#374151' }}>
        Q. 다음 글을 읽고 물음에 답하시오.
      </p>
      <PdfPageHeader mb={10}>{title}</PdfPageHeader>
      <p style={PDF_P}>{renderPassage()}</p>
      <div style={{ marginTop: 18, padding: '10px 14px', background: '#F8FAFC', borderRadius: 6, border: '1px solid #E2E8F0' }}>
        <p style={{ margin: '0 0 8px', fontSize: 11, fontWeight: 900, color: '#374151' }}>
          1. 위 글의 빈칸 (A)~(E)에 들어갈 말로 적절하지 않은 것은?
        </p>
        <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', fontSize: 12 }}>
          {q1Choices.map((c, i) => {
            const hit = isAnswer && c.label === q1Answer;
            return <span key={i} style={{ fontWeight: hit ? 900 : 400, color: hit ? '#DC2626' : '#1E293B', textDecoration: hit ? 'underline' : undefined }}>{c.label} {c.blank} {c.word}</span>;
          })}
        </div>
        {isAnswer && <div style={{ marginTop: 8, fontSize: 12, fontWeight: 700, color: '#92400E' }}>정답: {q1Answer}</div>}
      </div>
      <div style={{ marginTop: 10, padding: '10px 14px', background: '#F8FAFC', borderRadius: 6, border: '1px solid #E2E8F0' }}>
        <p style={{ margin: '0 0 8px', fontSize: 11, fontWeight: 900, color: '#374151' }}>
          2. 위 글의 ①~⑤ 중 어법상 어색한 것만 고른 것은?
        </p>
        <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', fontSize: 12 }}>
          {q2Choices.map((c, i) => {
            const hit = isAnswer && c.label === q2Answer;
            return <span key={i} style={{ fontWeight: hit ? 900 : 400, color: hit ? '#DC2626' : '#1E293B', textDecoration: hit ? 'underline' : undefined }}>{c.label} {c.pair}</span>;
          })}
        </div>
        {isAnswer && <div style={{ marginTop: 8, fontSize: 12, fontWeight: 700, color: '#92400E' }}>정답: {q2Answer}</div>}
      </div>
    </div>
  );
}

function PdfCombo({ result, type, isAnswer, title, id }: { result: WorkbookResult; type: WorkbookType; isAnswer: boolean; title: string; id: string }) {
  const s1 = (result.section1 ?? {}) as WorkbookResult;
  const s2 = (result.section2 ?? {}) as WorkbookResult;
  const [t1, t2] = ['grammar_choice', 'sentence_insertion'];
  return (
    <div id={id} style={PDF_BASE}>
      <PdfPageHeader>{title} — {TYPE_LABELS[type]}{isAnswer ? ' (정답)' : ''}</PdfPageHeader>
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

  const h2 = !embedded ? <PdfPageHeader>{title}{isAnswer ? ' (정답)' : ''}</PdfPageHeader> : null;

  switch (type) {
    case 'vocab_choice':
    case 'grammar_choice': {
      const cb: React.CSSProperties = { background: '#FFF9C4', borderRadius: 3, padding: '1px 4px', margin: '0 1px' };
      const sStyle: React.CSSProperties = { fontSize: 13, lineHeight: 1.9, wordBreak: 'break-word', margin: '0 0 10px' };
      const sentences2 = splitBySentence(result.passage as string || '');
      return wrap(<>{h2}
        <div>{sentences2.map((sentence, si) => {
          const chunks = parseVocabPassage(sentence, result.answer_key as string || '');
          return <p key={si} style={sStyle}>{chunks.map((c, i) => {
            if (c.type === 'text') return <span key={i}>{c.text}</span>;
            const opts = [c.a, c.b, c.c].filter((o): o is string => o !== undefined);
            if (isAnswer) return <span key={i} style={cb}>{c.num}[{opts.map((opt, j) => (
              <span key={j}>{j > 0 && ' / '}{j === c.correctIdx
                ? <span style={{ fontWeight: 900, textDecoration: 'underline' }}>{opt}</span>
                : <span style={{ color: '#999', textDecoration: 'line-through' }}>{opt}</span>}
              </span>
            ))}]</span>;
            return <span key={i} style={cb}>{c.num}[{opts.join(' / ')}]</span>;
          })}</p>;
        })}</div>
        {isAnswer && <div style={{ marginTop: 14, padding: '10px 14px', background: '#f8f8f8', borderRadius: 6, fontSize: 12, lineHeight: 1.8 }}><strong>정답:</strong> {result.answer_key as string}</div>}
      </>);
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
        <div style={{background:'#fff',border:'2px solid #0F172A',borderRadius:6,padding:'10px 14px',marginBottom:14,fontSize:13,fontStyle:'italic',lineHeight:1.7}}>{data.insert_sentence}</div>
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

function getSimpleAnswerSections(result: WorkbookResult, type: WorkbookType): { label?: string; lines: string[] }[] {
  const flat = (lines: string[]): { label?: string; lines: string[] }[] => [{ lines }];
  switch (type) {
    case 'vocab_choice': case 'grammar_choice': case 'grammar_correct':
    case 'grammar_correct_adv': case 'sentence_insertion': case 'paragraph_order':
    case 'summary_sentence': case 'suneung_vocab_wrong': case 'suneung_grammar_wrong':
    case 'suneung_vocab_right': case 'suneung_grammar_right': case 'vocab_fill':
      return flat([(result.answer_key as string || '—').trim()]);
    case 'word_order': {
      const sents = (result.sentences ?? []) as Array<{num:number;answer:string}>;
      return flat(sents.map(s => `${s.num}. ${s.answer}`));
    }
    case 'translation': {
      const sents = (result.sentences ?? []) as Array<{num:number;ko:string}>;
      return flat(sents.map(s => `${s.num}. ${s.ko}`));
    }
    case 'english_writing':
      return flat([((result.model_answer || result.answer_key || '—') as string).trim()]);
    case 'passage_translation':
      return flat(['(지문 해석지 참조)']);
    case 'passage_analysis':
      return flat(['(구문분석 참조)']);
    case 'tf_questions': {
      const qs = (result.questions as Array<{num:number;answer:string}>) || [];
      return flat([qs.map(q => `${q.num}.${q.answer}`).join('  ')]);
    }
    case 'title_summary':
      return flat(['(제목/요약문 참조)']);
    case 'combo_vocab_grammar': {
      const s1 = (result.section1 ?? {}) as WorkbookResult;
      const s2 = (result.section2 ?? {}) as WorkbookResult;
      return [
        { label: 'Section 1 (어휘)', lines: [(s1.answer_key as string || '—').trim()] },
        { label: 'Section 2 (어법)', lines: [(s2.answer_key as string || '—').trim()] },
      ];
    }
    case 'combo_vocab_fill': {
      const q2Items = (result.q2_items as Array<{answer:string}>) || [];
      return [
        { label: '문제 1 정답', lines: [(result.q1_answer as string || '—').trim()] },
        { label: '문제 2 정답', lines: q2Items.map((item, i) => `${i + 1}. ${item.answer}`) },
      ];
    }
    case 'combo_grammar_order': {
      const grammarErrors = (result.grammar_errors as Array<{wrong:string;correct:string}>) || [];
      return [
        { label: '어법 오류 수정', lines: grammarErrors.map(e => `${e.wrong} → ${e.correct}`) },
        { label: '어순 배열 정답', lines: [(result.order_answer as string || '—').trim()] },
      ];
    }
    case 'combo_grammar_insert': {
      const s1 = (result.section1 ?? {}) as WorkbookResult;
      const s2 = (result.section2 ?? {}) as WorkbookResult;
      return [
        { label: 'Section 1 (어법)', lines: [(s1.answer_key as string || '—').trim()] },
        { label: 'Section 2 (문장삽입)', lines: [(s2.answer_key as string || '—').trim()] },
      ];
    }
    default:
      return flat([(result.answer_key as string || '(정답 참조)').trim()]);
  }
}

function PdfSimpleAnswerAll({ allResults, passageIndex, title, id }: {
  allResults: TypeResult[];
  passageIndex: number;
  title: string;
  id: string;
}) {
  const items = allResults.filter(({ results }) => passageIndex < results.length && !results[passageIndex].error);
  return (
    <div id={id} style={PDF_BASE}>
      <PdfPageHeader>{title} — 심플 답지</PdfPageHeader>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {items.map(({ type, results }, i) => {
          const result = results[passageIndex];
          const sections = getSimpleAnswerSections(result, type);
          return (
            <div key={i} style={{ padding: '10px 14px', background: i % 2 === 0 ? '#F8FAFC' : '#FFFFFF', borderRadius: 8, border: '1px solid #E5E7EB' }}>
              <p style={{ fontWeight: 900, fontSize: 12, color: '#4F46E5', marginBottom: 6 }}>{TYPE_LABELS[type]}</p>
              {sections.map((sec, si) => (
                <div key={si} style={{ marginBottom: si < sections.length - 1 ? 8 : 0 }}>
                  {sec.label && <p style={{ fontSize: 11, fontWeight: 700, color: '#6B7280', marginBottom: 3 }}>{sec.label}</p>}
                  {sec.lines.map((line, li) => (
                    <p key={li} style={{ fontSize: 12, lineHeight: 1.9, color: '#374151', margin: '0 0 2px', whiteSpace: 'pre-wrap' }}>{line || '—'}</p>
                  ))}
                </div>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
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
  const [selectedTypes, setSelectedTypes] = useState<Set<WorkbookType>>(new Set(['vocab_choice']));
  const [difficulty, setDifficulty] = useState<Difficulty>('b2');
  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState('');
  const [allResults, setAllResults] = useState<TypeResult[]>([]);
  const [activeTypeTab, setActiveTypeTab] = useState(0);
  const [activeResultTab, setActiveResultTab] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);
  const [showKorean, setShowKorean] = useState(false);
  const [pricePerUse, setPricePerUse] = useState(0);
  const [wbDirectPricing, setWbDirectPricing] = useState<Record<string, number>>({});
  const [wbMockPricing, setWbMockPricing] = useState<Record<string, number>>({});
  const [pricingLoaded, setPricingLoaded] = useState(false);
  const [wbPdfLayout, setWbPdfLayout] = useState<'passage' | 'type'>('type');
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [downloadingAnswerPdf, setDownloadingAnswerPdf] = useState(false);
  const [savingHistory, setSavingHistory] = useState(false);
  const [academyName, setAcademyName] = useState('');

  // History tab
  const [historyList, setHistoryList] = useState<HistoryItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState('');
  const [searchDate, setSearchDate] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      if (s) {
        setSession(s);
        supabase.from('academy_config').select('academy_name').eq('user_id', s.user.id).single()
          .then(({ data }) => { if (data?.academy_name) setAcademyName(data.academy_name); });
      }
    });
  }, []);

  useEffect(() => {
    fetch('/api/credits/pricing', { cache: 'no-store' }).then(r => r.ok ? r.json() : null).then(data => {
      const items: { feature_key: string; cost_per_use: number }[] = data?.pricing ?? [];
      const directP: Record<string, number> = {};
      const mockP: Record<string, number> = {};
      items.forEach(p => {
        if (p.feature_key.startsWith('wb_direct_')) directP[p.feature_key.replace('wb_direct_', '')] = p.cost_per_use;
        else if (p.feature_key.startsWith('wb_mock_')) mockP[p.feature_key.replace('wb_mock_', '')] = p.cost_per_use;
        else if (p.feature_key === 'vocab_choice') setPricePerUse(p.cost_per_use);
      });
      setWbDirectPricing(directP);
      setWbMockPricing(mockP);
      setPricingLoaded(true);
    }).catch(() => { setPricingLoaded(true); });
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
    if (selectedTypes.size === 0) { setGenerateError('유형을 하나 이상 선택해주세요.'); return; }
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

    const typesArray = [...selectedTypes];
    setGenerating(true);
    setAllResults([]);
    setActiveTypeTab(0);
    setActiveResultTab(0);
    setShowAnswer(false);

    const resultSlots = new Array<TypeResult | null>(typesArray.length).fill(null);
    try {
      const settled = await Promise.allSettled(
        typesArray.map(async (type, ti) => {
          const res = await fetch('/api/generate-workbook', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ passages: passageTexts, type, tab: activeTab, difficulty, academy_id: session.user.id }),
          });
          const json = await res.json() as { success?: boolean; results?: WorkbookResult[]; error?: string; required?: number; balance?: number };
          if (!res.ok || !json.success) {
            if (json.error === 'INSUFFICIENT_CON') {
              throw new Error(`CON이 부족합니다. (필요: ${json.required}C, 보유: ${json.balance}C)`);
            }
            throw new Error(json.error || '생성 실패');
          }
          resultSlots[ti] = { type, results: json.results ?? [] };
          setAllResults(resultSlots.filter((r): r is TypeResult => r !== null));
        })
      );
      const firstFailed = settled.find(r => r.status === 'rejected');
      if (firstFailed) {
        setGenerateError((firstFailed as PromiseRejectedResult).reason?.message || '일부 유형 생성에 실패했습니다.');
      }
      // Auto-save: all types combined into one PDF per passage
      // Use the same array/indices that were passed to setAllResults to ensure DOM ID alignment
      const savedResults = resultSlots.filter((r): r is TypeResult => r !== null);
      if (savedResults.some(r => r.results.length > 0)) {
        const title = activeTab === 'input' ? inputTitle : mockTitle;
        setTimeout(() => autoSaveWorkbook(passageTexts, title, savedResults), 1500);
      }
    } catch (e) {
      setGenerateError(e instanceof Error ? e.message : '오류가 발생했습니다.');
    } finally {
      setGenerating(false);
    }
  };

  const autoSaveWorkbook = async (passageTexts: string[], title: string, savedResults: TypeResult[]) => {
    if (!session) return;
    setSavingHistory(true);
    try {
      const passageCount = passageTexts.length;
      for (let pi = 0; pi < passageCount; pi++) {
        const problemIds: string[] = [];
        const answerIds: string[] = [];
        savedResults.forEach(({ results }, ti) => {
          if (pi < results.length && !results[pi].error) {
            problemIds.push(`wb-pdf-problem-${ti}-${pi}`);
            answerIds.push(`wb-pdf-answer-${ti}-${pi}`);
          }
        });
        if (problemIds.length === 0) continue;
        const [problemBlob, answerBlob] = await Promise.all([
          captureAllToPdf(problemIds),
          captureAllToPdf(answerIds),
        ]);
        const toBase64 = (b: Blob) => new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve((reader.result as string).split(',')[1]);
          reader.onerror = reject;
          reader.readAsDataURL(b);
        });
        const [pdfBase64, answerPdfBase64] = await Promise.all([toBase64(problemBlob), toBase64(answerBlob)]);
        const passageFull = passageTexts[pi] || '';
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
            questionNumber: activeTab === 'mock' ? parseInt(selectedNumbers[pi] || '0') || null : null,
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
    const typeResult = allResults[activeTypeTab];
    if (!typeResult) return;
    const r = typeResult.results[activeResultTab];
    if (!r) return;
    const suffix = withAnswer ? 'answer' : 'problem';
    const id = `wb-pdf-${suffix}-${activeTypeTab}-${activeResultTab}`;
    if (withAnswer) setDownloadingAnswerPdf(true);
    else setDownloadingPdf(true);
    try {
      const blob = await capturePdfFromElement(id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const title = activeTab === 'input' ? inputTitle : mockTitle;
      const typeLabel = TYPE_LABELS[typeResult.type];
      const passageLabel = typeResult.results.length > 1 ? `_지문${activeResultTab + 1}` : '';
      a.download = `${title ? `${title}_${typeLabel}` : typeLabel}${passageLabel}${withAnswer ? '_정답' : '_문제'}.pdf`;
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {
      alert(e instanceof Error ? e.message : 'PDF 생성 실패');
    } finally {
      if (withAnswer) setDownloadingAnswerPdf(false);
      else setDownloadingPdf(false);
    }
  };

  const [downloadingAllPdf, setDownloadingAllPdf] = useState(false);
  const [downloadingSimplePdf, setDownloadingSimplePdf] = useState(false);

  const handleDownloadSimplePdf = async () => {
    if (!allResults.length) return;
    setDownloadingSimplePdf(true);
    try {
      const maxPassages = Math.max(...allResults.map(r => r.results.length));
      const ids = Array.from({ length: maxPassages }, (_, pi) => `wb-pdf-simple-${pi}`);
      const blob = await captureAllToPdf(ids);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const title = activeTab === 'input' ? inputTitle : mockTitle;
      a.download = `${title || '워크북'}_심플답지.pdf`;
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {
      alert(e instanceof Error ? e.message : 'PDF 생성 실패');
    } finally {
      setDownloadingSimplePdf(false);
    }
  };

  const handleDownloadAllPdf = async (withAnswer: boolean) => {
    if (!allResults.length) return;
    setDownloadingAllPdf(true);
    try {
      const suffix = withAnswer ? 'answer' : 'problem';
      const maxPassages = Math.max(...allResults.map(r => r.results.length));
      let ids: string[] = [];
      if (wbPdfLayout === 'passage') {
        for (let pi = 0; pi < maxPassages; pi++) {
          allResults.forEach(({ results }, ti) => { if (pi < results.length && !results[pi].error) ids.push(`wb-pdf-${suffix}-${ti}-${pi}`); });
        }
      } else if (wbPdfLayout === 'type') {
        allResults.forEach(({ results }, ti) => {
          results.forEach((r, pi) => { if (!r.error) ids.push(`wb-pdf-${suffix}-${ti}-${pi}`); });
        });
      }
      const blob = await captureAllToPdf(ids);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const title = activeTab === 'input' ? inputTitle : mockTitle;
      a.download = `${title || '워크북'}_전체${withAnswer ? '_정답' : '_문제'}.pdf`;
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {
      alert(e instanceof Error ? e.message : 'PDF 생성 실패');
    } finally {
      setDownloadingAllPdf(false);
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
  const typeCount = selectedTypes.size;
  const currentPricing = activeTab === 'input' ? wbDirectPricing : wbMockPricing;
  const totalCost = selectedTypes.size > 0
    ? [...selectedTypes].reduce((sum, key) => sum + (currentPricing[key] ?? pricePerUse) * Math.max(passageCount, 1), 0)
    : 0;
  const canGenerate = !generating && selectedTypes.size > 0 && (
    activeTab === 'input' ? validInputPassages.length > 0 :
    validMockPassages.length > 0 && loadingNumbers.size === 0
  );
  const currentTypeResult = allResults[activeTypeTab];
  const currentType = currentTypeResult?.type;

  // ─── render ────────────────────────────────────────────────────────────────

  const toggleType = (key: WorkbookType) => {
    setSelectedTypes(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };
  const allTypeKeys: WorkbookType[] = CATEGORIES.flatMap(c => c.types.map(t => t.key).filter(k => k in currentPricing));

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
              className={`flex-1 py-2.5 text-sm font-black rounded-xl transition-all ${activeTab === t.key ? 'bg-slate-900 text-white shadow' : 'text-slate-500 hover:bg-slate-50'}`}>
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
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-slate-300" />
              </div>

              {/* Passage cards */}
              <div className="space-y-4">
                {passages.map((card, cardIdx) => (
                  <div key={card.id} className="border border-gray-200 rounded-2xl p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black text-slate-900">지문 {cardIdx + 1}</span>
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
                          className={`px-4 py-2 rounded-lg font-black text-xs transition-all ${card.mode === mode ? 'bg-white text-slate-900 shadow-md' : 'text-slate-500 hover:text-slate-700'}`}>
                          {label}
                        </button>
                      ))}
                    </div>

                    {card.mode === 'text' && (
                      <div>
                        <textarea rows={7} placeholder="영어 지문을 붙여넣으세요..."
                          value={card.text}
                          onChange={e => updatePassage(card.id, { text: e.target.value })}
                          className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-slate-300 resize-y" />
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
                            ${card.isDragging ? 'border-indigo-500 bg-slate-50' : card.imageFile ? 'border-emerald-300 bg-emerald-50/50' : 'border-slate-200 hover:border-slate-400 hover:bg-slate-50/50'}`}>
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
                                <div className="flex-1 flex flex-col items-center justify-center p-6 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200">
                                  <p className="font-black text-slate-600 text-center mb-3 text-sm">AI가 텍스트를 자동 추출해드려요</p>
                                  <button onClick={() => handleOCR(card.id)} disabled={card.ocrLoading}
                                    className="bg-slate-900 text-white px-6 py-2.5 rounded-2xl font-black text-sm hover:bg-black transition-all disabled:opacity-50">
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
                    className="w-full py-3 border-2 border-dashed border-slate-200 rounded-2xl text-sm font-black text-slate-600 hover:border-slate-400 hover:bg-slate-50 transition-all">
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
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-slate-300" />
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
                      className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-slate-300 bg-white disabled:bg-gray-50 disabled:text-slate-300">
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
                            isSelected ? 'bg-slate-900 border-slate-900 text-white shadow-sm' : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
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
                          <p className="text-xs font-black text-slate-900">{num}번 지문</p>
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
            {/* Type selector header */}
            <div className="flex items-center justify-between">
              <label className="text-xs font-black text-slate-500">
                유형 선택 <span className="text-slate-900">({selectedTypes.size}개 선택)</span>
              </label>
              <div className="flex gap-3">
                <button onClick={() => setSelectedTypes(new Set(allTypeKeys))}
                  className="text-xs font-black text-slate-900 hover:underline">전체 선택</button>
                <button onClick={() => setSelectedTypes(new Set())}
                  className="text-xs font-black text-slate-400 hover:underline">전체 해제</button>
              </div>
            </div>

            {/* All categories with checkboxes */}
            <div className="space-y-3">
              {(!pricingLoaded ? [] : CATEGORIES.map(cat => ({
                ...cat,
                types: cat.types.filter(t => t.key in currentPricing),
              })).filter(cat => cat.types.length > 0)).map(cat => (
                <div key={cat.key}>
                  <p className="text-[11px] font-black text-slate-400 uppercase tracking-wide mb-1.5">{cat.label}</p>
                  <div className="flex flex-wrap gap-2">
                    {cat.types.map(t => {
                      const isSelected = selectedTypes.has(t.key);
                      const typePrice = currentPricing[t.key] ?? pricePerUse;
                      return (
                        <button key={t.key} onClick={() => toggleType(t.key)}
                          className={`flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl text-sm font-black border-2 transition-all ${
                            isSelected
                              ? 'bg-slate-900 border-slate-900 text-white shadow-sm'
                              : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50'
                          }`}>
                          <div className="flex items-center gap-1.5">
                            <span className={`w-3.5 h-3.5 rounded border flex items-center justify-center text-[9px] flex-shrink-0 ${
                              isSelected ? 'bg-white border-white text-slate-900' : 'border-slate-300'
                            }`}>{isSelected && '✓'}</span>
                            {t.label}
                          </div>
                          {typePrice > 0 && (
                            <span className={`text-[10px] font-black ${isSelected ? 'text-amber-300' : 'text-amber-500'}`}>{typePrice}C</span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
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
              지문 {Math.max(passageCount, 1)}개
              {typeCount > 0 && <> × 유형 <span className="text-slate-600 font-black">{typeCount}개</span> = <span className="text-yellow-500 font-black">{totalCost}C</span> 차감 예정</>}
            </p>

            <button onClick={handleGenerate} disabled={!canGenerate}
              className="w-full py-4 text-base font-black bg-slate-900 hover:bg-black text-white rounded-2xl transition-all disabled:opacity-50 shadow-lg shadow-slate-200">
              {generating
                ? `⏳ AI가 생성 중... (유형 ${allResults.length}/${typeCount} 완료)`
                : selectedTypes.size === 0
                  ? '유형을 선택해주세요'
                  : `✨ ${typeCount}개 유형 생성하기 (${totalCost}C)`}
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
        {allResults.length > 0 && activeTab !== 'history' && (
          <div className="space-y-3">
            {/* PDF 배치 */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
              <p className="text-xs font-black text-slate-500 mb-2">📐 PDF 문제 배치</p>
              <div className="flex gap-2">
                {([
                  { key: 'type',    label: '기본 배치', desc: '유형 순서대로' },
                  { key: 'passage', label: '지문별',   desc: 'A지문 → B지문' },
                ] as const).map(({ key, label, desc }) => (
                  <button key={key} type="button" onClick={() => setWbPdfLayout(key)}
                    className={`flex-1 py-2 px-3 rounded-xl border-2 text-xs font-black transition-all text-center ${
                      wbPdfLayout === key ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-slate-500 border-slate-200 hover:border-slate-400 hover:text-slate-700'
                    }`}>
                    <div>{label}</div>
                    <div className={`text-[10px] mt-0.5 font-medium ${wbPdfLayout === key ? 'text-slate-300' : 'text-slate-400'}`}>{desc}</div>
                  </button>
                ))}
              </div>
            </div>
            {/* Type tabs */}
            {allResults.length > 1 && (
              <div className="flex gap-1 bg-white rounded-2xl shadow-sm border border-gray-100 p-1.5 flex-wrap">
                {allResults.map(({ type }, ti) => (
                  <button key={ti} onClick={() => { setActiveTypeTab(ti); setActiveResultTab(0); setShowAnswer(false); }}
                    className={`flex-1 min-w-[90px] py-2 text-xs font-black rounded-xl transition-all ${activeTypeTab === ti ? 'bg-slate-900 text-white shadow' : 'text-slate-500 hover:bg-slate-50'}`}>
                    {TYPE_LABELS[type]}
                  </button>
                ))}
              </div>
            )}
            {/* Passage tabs */}
            {currentTypeResult && currentTypeResult.results.length > 1 && (
              <div className="flex gap-1 bg-white rounded-2xl shadow-sm border border-gray-100 p-1.5">
                {currentTypeResult.results.map((_, pi) => (
                  <button key={pi} onClick={() => setActiveResultTab(pi)}
                    className={`flex-1 py-2 text-sm font-black rounded-xl transition-all ${activeResultTab === pi ? 'bg-slate-900 text-white shadow' : 'text-slate-500 hover:bg-slate-50'}`}>
                    지문 {pi + 1}
                  </button>
                ))}
              </div>
            )}
            {currentTypeResult && (
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between flex-wrap gap-3">
                  <div className="flex items-center gap-3">
                    <span className="font-black text-slate-800">
                      {TYPE_LABELS[currentType]}
                      {currentTypeResult.results.length > 1 ? ` — 지문 ${activeResultTab + 1}` : ''} 생성 완료
                    </span>
                    {savingHistory && <span className="text-xs font-bold text-slate-400 animate-pulse">저장 중...</span>}
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    {(currentType === 'vocab_fill' || currentType === 'word_order') && (
                      <button onClick={() => setShowKorean(!showKorean)}
                        className={`px-4 py-2 text-xs font-black rounded-xl transition-all ${showKorean ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
                        {showKorean ? '🇰🇷 한글 포함 중' : '🇰🇷 한글 번역'}
                      </button>
                    )}
                    {currentType !== 'passage_translation' && (
                      <button onClick={() => setShowAnswer(!showAnswer)}
                        className={`px-4 py-2 text-xs font-black rounded-xl transition-all ${showAnswer ? 'bg-yellow-500 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
                        {showAnswer ? '✅ 정답 표시 중' : '정답 보기'}
                      </button>
                    )}
                    <button onClick={() => handleDownloadPdf(false)} disabled={downloadingPdf}
                      className="px-4 py-2 text-xs font-black bg-slate-700 hover:bg-slate-900 text-white rounded-xl transition-all disabled:opacity-50">
                      {downloadingPdf ? '생성 중...' : '⬇️ 문제 PDF'}
                    </button>
                    {currentType !== 'passage_translation' && (
                      <button onClick={() => handleDownloadPdf(true)} disabled={downloadingAnswerPdf}
                        className="px-4 py-2 text-xs font-black bg-slate-500 hover:bg-slate-700 text-white rounded-xl transition-all disabled:opacity-50">
                        {downloadingAnswerPdf ? '생성 중...' : '⬇️ 정답 PDF'}
                      </button>
                    )}
                    {allResults.length > 1 && (
                      <button onClick={() => handleDownloadAllPdf(false)} disabled={downloadingAllPdf}
                        className="px-4 py-2 text-xs font-black bg-slate-900 hover:bg-black text-white rounded-xl transition-all disabled:opacity-50">
                        {downloadingAllPdf ? '병합 중...' : '⬇️ 전체 문제 PDF'}
                      </button>
                    )}
                    {allResults.length > 1 && currentType !== 'passage_translation' && (
                      <button onClick={() => handleDownloadAllPdf(true)} disabled={downloadingAllPdf}
                        className="px-4 py-2 text-xs font-black border-2 border-slate-900 text-slate-900 hover:bg-slate-900 hover:text-white rounded-xl transition-all disabled:opacity-50">
                        {downloadingAllPdf ? '병합 중...' : '⬇️ 전체 정답 PDF'}
                      </button>
                    )}
                    <button onClick={handleDownloadSimplePdf} disabled={downloadingSimplePdf || !allResults.length}
                      className="px-4 py-2 text-xs font-black bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl transition-all disabled:opacity-50">
                      {downloadingSimplePdf ? '생성 중...' : '⬇️ 심플 답지 PDF'}
                    </button>
                  </div>
                </div>
                <div className="px-5 py-5">
                  {currentTypeResult.results[activeResultTab] && (
                    <RenderResultContent result={currentTypeResult.results[activeResultTab]} type={currentType} showAnswer={showAnswer} showKorean={showKorean} />
                  )}
                </div>
              </div>
            )}
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
                  className="px-3 py-2 border border-gray-200 rounded-xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-slate-300" />
              </div>
              <div className="flex flex-col gap-1 flex-1 min-w-[180px]">
                <label className="text-xs font-black text-slate-500">키워드 검색</label>
                <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && fetchHistory()}
                  placeholder="지문 내 단어를 입력하세요..."
                  className="px-3 py-2 border border-gray-200 rounded-xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-slate-300" />
              </div>
              <button onClick={() => fetchHistory()} disabled={historyLoading}
                className="px-4 py-2 bg-slate-900 text-white text-sm font-black rounded-xl hover:bg-black disabled:opacity-50">
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
              <div className="flex items-center gap-3 px-5 py-3 bg-slate-50 border border-slate-200 rounded-2xl">
                <span className="font-black text-slate-800 text-sm">{selectedIds.size}개 선택됨</span>
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
                    className="w-4 h-4 rounded accent-slate-900 cursor-pointer mt-0.5" />
                  {['날짜', '제목', '지문 요약', '난이도', '문제', '정답'].map((h, i) => <span key={i} className={i >= 4 ? 'text-center' : ''}>{h}</span>)}
                </div>
                {historyList.map((item, i) => (
                  <div key={item.id}
                    className={`grid grid-cols-[32px_140px_160px_1fr_52px_64px_64px] gap-2 px-4 py-3 items-center border-b border-slate-100 last:border-0 hover:bg-slate-50/40
                      ${selectedIds.has(item.id) ? 'bg-slate-50' : i % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}`}>
                    <input type="checkbox" checked={selectedIds.has(item.id)} onChange={() => toggleSelect(item.id)}
                      className="w-4 h-4 rounded accent-slate-900 cursor-pointer" />
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
                            className="px-2 py-1 bg-indigo-100 hover:bg-indigo-200 text-slate-800 rounded-lg text-xs font-black w-full text-center">⬇️ 문제</button>
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
        {(_pdfAcademy = academyName, null)}
        {allResults.map(({ type, results: typeResults }, ti) =>
          typeResults.map((result, pi) => {
            if (result.error) return null;
            const rawTitle = (activeTab === 'input' ? inputTitle : mockTitle) || '';
            const baseTitle = rawTitle || TYPE_LABELS[type];
            const passageLabel = typeResults.length > 1 ? ` (지문 ${pi + 1})` : '';
            const fullTitle = rawTitle
              ? `${rawTitle}_${TYPE_LABELS[type]}${passageLabel}`
              : `${TYPE_LABELS[type]}${passageLabel}`;
            const problemId = `wb-pdf-problem-${ti}-${pi}`;
            const answerId = `wb-pdf-answer-${ti}-${pi}`;
            const key = `${ti}-${pi}`;

            if (type === 'combo_vocab_grammar') {
              return (
                <React.Fragment key={key}>
                  <PdfComboVocabGrammar result={result} isAnswer={false} title={fullTitle} id={problemId} />
                  <PdfComboVocabGrammar result={result} isAnswer={true} title={fullTitle} id={answerId} />
                </React.Fragment>
              );
            }
            if (type === 'combo_vocab_fill') {
              return (
                <React.Fragment key={key}>
                  <PdfComboVocabFill result={result} isAnswer={false} title={fullTitle} id={problemId} />
                  <PdfComboVocabFill result={result} isAnswer={true} title={fullTitle} id={answerId} />
                </React.Fragment>
              );
            }
            if (type === 'combo_grammar_order') {
              return (
                <React.Fragment key={key}>
                  <PdfComboGrammarOrder result={result} isAnswer={false} title={fullTitle} id={problemId} />
                  <PdfComboGrammarOrder result={result} isAnswer={true} title={fullTitle} id={answerId} />
                </React.Fragment>
              );
            }
            if (type === 'combo_grammar_insert') {
              return (
                <React.Fragment key={key}>
                  <PdfComboGrammarInsert result={result} isAnswer={false} title={fullTitle} id={problemId} />
                  <PdfComboGrammarInsert result={result} isAnswer={true} title={fullTitle} id={answerId} />
                </React.Fragment>
              );
            }
            if (type.startsWith('combo_')) {
              return (
                <React.Fragment key={key}>
                  <PdfCombo result={result} type={type} isAnswer={false} title={fullTitle} id={problemId} />
                  <PdfCombo result={result} type={type} isAnswer={true} title={fullTitle} id={answerId} />
                </React.Fragment>
              );
            }
            switch (type) {
              case 'vocab_choice':
              case 'grammar_choice':
                return (
                  <React.Fragment key={key}>
                    <PdfVocabChoice result={result} isAnswer={false} title={fullTitle} id={problemId} />
                    <PdfVocabChoice result={result} isAnswer={true} title={fullTitle} id={answerId} />
                  </React.Fragment>
                );
              case 'vocab_fill':
                return (
                  <React.Fragment key={key}>
                    <PdfVocabFill result={result} isAnswer={false} title={fullTitle} id={problemId} showKorean={showKorean} />
                    <PdfVocabFill result={result} isAnswer={true} title={fullTitle} id={answerId} showKorean={showKorean} />
                  </React.Fragment>
                );
              case 'grammar_correct':
                return (
                  <React.Fragment key={key}>
                    <PdfGrammarCorrect result={result} isAnswer={false} title={fullTitle} id={problemId} />
                    <PdfGrammarCorrect result={result} isAnswer={true} title={fullTitle} id={answerId} />
                  </React.Fragment>
                );
              case 'grammar_correct_adv':
                return (
                  <React.Fragment key={key}>
                    <PdfGrammarCorrectAdv result={result} isAnswer={false} title={fullTitle} id={problemId} />
                    <PdfGrammarCorrectAdv result={result} isAnswer={true} title={fullTitle} id={answerId} />
                  </React.Fragment>
                );
              case 'translation':
                return (
                  <React.Fragment key={key}>
                    <PdfTranslation result={result} isAnswer={false} title={fullTitle} id={problemId} />
                    <PdfTranslation result={result} isAnswer={true} title={fullTitle} id={answerId} />
                  </React.Fragment>
                );
              case 'word_order':
                return (
                  <React.Fragment key={key}>
                    <PdfWordOrder result={result} isAnswer={false} title={fullTitle} id={problemId} showKorean={showKorean} />
                    <PdfWordOrder result={result} isAnswer={true} title={fullTitle} id={answerId} showKorean={showKorean} />
                  </React.Fragment>
                );
              case 'english_writing':
                return (
                  <React.Fragment key={key}>
                    <PdfEnglishWriting result={result} isAnswer={false} title={fullTitle} id={problemId} />
                    <PdfEnglishWriting result={result} isAnswer={true} title={fullTitle} id={answerId} />
                  </React.Fragment>
                );
              case 'suneung_vocab_wrong':
                return (
                  <React.Fragment key={key}>
                    <PdfSuneungVocabWrong result={result} isAnswer={false} title={fullTitle} id={problemId} />
                    <PdfSuneungVocabWrong result={result} isAnswer={true} title={fullTitle} id={answerId} />
                  </React.Fragment>
                );
              case 'suneung_grammar_wrong':
                return (
                  <React.Fragment key={key}>
                    <PdfSuneungVocabWrong result={result} isAnswer={false} title={fullTitle} id={problemId} questionText="Q. 다음 글의 밑줄 친 부분 중, 어법상 틀린 것을 고르시오." />
                    <PdfSuneungVocabWrong result={result} isAnswer={true} title={fullTitle} id={answerId} questionText="Q. 다음 글의 밑줄 친 부분 중, 어법상 틀린 것을 고르시오." />
                  </React.Fragment>
                );
              case 'suneung_vocab_right':
                return (
                  <React.Fragment key={key}>
                    <PdfSuneungVocabABC result={result} isAnswer={false} title={fullTitle} id={problemId} />
                    <PdfSuneungVocabABC result={result} isAnswer={true} title={fullTitle} id={answerId} />
                  </React.Fragment>
                );
              case 'suneung_grammar_right':
                return (
                  <React.Fragment key={key}>
                    <PdfSuneungVocabABC result={result} isAnswer={false} title={fullTitle} id={problemId} questionText="Q. (A), (B), (C)의 각 [ ] 안에서 어법에 맞는 표현으로 가장 적절한 것을 고르시오." />
                    <PdfSuneungVocabABC result={result} isAnswer={true} title={fullTitle} id={answerId} questionText="Q. (A), (B), (C)의 각 [ ] 안에서 어법에 맞는 표현으로 가장 적절한 것을 고르시오." />
                  </React.Fragment>
                );
              case 'passage_translation':
                return <PdfPassageTranslation key={key} result={result} id={problemId} title={fullTitle} />;
              case 'paragraph_order':
                return (
                  <React.Fragment key={key}>
                    <PdfParagraphOrder result={result} isAnswer={false} title={fullTitle} id={problemId} />
                    <PdfParagraphOrder result={result} isAnswer={true} title={fullTitle} id={answerId} />
                  </React.Fragment>
                );
              case 'sentence_insertion':
                return (
                  <React.Fragment key={key}>
                    <PdfSentenceInsertion result={result} isAnswer={false} title={fullTitle} id={problemId} />
                    <PdfSentenceInsertion result={result} isAnswer={true} title={fullTitle} id={answerId} />
                  </React.Fragment>
                );
              case 'passage_analysis':
                return <PdfPassageAnalysis key={key} result={result} id={problemId} title={fullTitle} />;
              case 'summary_sentence':
                return (
                  <React.Fragment key={key}>
                    <PdfSummarySentence result={result} isAnswer={false} title={fullTitle} id={problemId} />
                    <PdfSummarySentence result={result} isAnswer={true} title={fullTitle} id={answerId} />
                  </React.Fragment>
                );
              case 'tf_questions':
                return (
                  <React.Fragment key={key}>
                    <PdfTfQuestions result={result} isAnswer={false} title={fullTitle} id={problemId} />
                    <PdfTfQuestions result={result} isAnswer={true} title={fullTitle} id={answerId} />
                  </React.Fragment>
                );
              case 'title_summary':
                return <PdfTitleSummary key={key} result={result} isAnswer={false} title={fullTitle} id={problemId} />;
              default:
                return (
                  <React.Fragment key={key}>
                    <PdfSimple result={result} isAnswer={false} title={fullTitle} id={problemId} />
                    <PdfSimple result={result} isAnswer={true} title={fullTitle} id={answerId} />
                  </React.Fragment>
                );
            }
          })
        )}
        {allResults.length > 0 && (() => {
          const maxPassages = Math.max(...allResults.map(r => r.results.length));
          const baseTitle = (activeTab === 'input' ? inputTitle : mockTitle) || '워크북';
          return Array.from({ length: maxPassages }, (_, pi) => {
            const passageLabel = maxPassages > 1 ? ` (지문 ${pi + 1})` : '';
            return (
              <PdfSimpleAnswerAll
                key={`simple-${pi}`}
                allResults={allResults}
                passageIndex={pi}
                title={`${baseTitle}${passageLabel}`}
                id={`wb-pdf-simple-${pi}`}
              />
            );
          });
        })()}

      </div>
    </div>
  );
}
