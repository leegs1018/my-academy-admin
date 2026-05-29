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
  _passageText?: string; _passageNumber?: number;
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
  { key: 'topic_title',      label: '주제/제목 유형',         color: 'bg-blue-100 text-blue-700 border-blue-200' },
  { key: 'grammar',          label: '어법 유형',              color: 'bg-green-100 text-green-700 border-green-200' },
  { key: 'vocab_paraphrase', label: '어휘 - 낱말 쓰임 유형', color: 'bg-purple-100 text-purple-700 border-purple-200' },
  { key: 'vocab_blank',      label: '어휘 (a)(b) 빈칸 유형', color: 'bg-amber-100 text-amber-700 border-amber-200' },
  { key: 'fill_blank',       label: '빈칸 추론 유형',         color: 'bg-rose-100 text-rose-700 border-rose-200' },
  { key: 'summary',          label: '요약문 완성 유형',       color: 'bg-teal-100 text-teal-700 border-teal-200' },
  { key: 'flow',             label: '흐름 유형',              color: 'bg-cyan-100 text-cyan-700 border-cyan-200' },
  { key: 'phrase_meaning',   label: '어구 의미 추론 유형',    color: 'bg-orange-100 text-orange-700 border-orange-200' },
  { key: 'sentence_order',   label: '순서 배열 유형',         color: 'bg-indigo-100 text-indigo-700 border-indigo-200' },
];

const TYPE_COLOR_MAP: Record<string, string> = {};
QUESTION_TYPE_OPTIONS.forEach(o => { TYPE_COLOR_MAP[o.key] = o.color; });
const TYPE_LABEL_MAP: Record<string, string> = {};
QUESTION_TYPE_OPTIONS.forEach(o => { TYPE_LABEL_MAP[o.key] = o.label; });
const CIRCLE_NUMS = ['①','②','③','④','⑤'];

// ─── 렌더 헬퍼 ───────────────────────────────────────────────────────────────
function renderPassageWithCircles(text: string, choices?: ExamChoice[], singleWordOnly?: boolean) {
  const CIRCLES = ['①','②','③','④','⑤'];
  const parts = text.split(/(①|②|③|④|⑤)/g);
  const ulStyle: React.CSSProperties = { textDecoration: 'underline', textDecorationThickness: '2px', textUnderlineOffset: '3px', fontWeight: 700, color: '#111827' };
  return parts.map((part, i) => {
    if (CIRCLES.includes(part)) return <span key={i} style={{ fontWeight: 900, color: '#111827' }}>{part}</span>;
    if (i > 0 && CIRCLES.includes(parts[i - 1])) {
      const circleIdx = CIRCLES.indexOf(parts[i - 1]);
      const rawChoice = choices?.[circleIdx]?.text ?? '';
      const fullChoiceWord = rawChoice.replace(/^[①②③④⑤]\s*/, '').trim();
      const choiceWord = singleWordOnly ? (fullChoiceWord.split(/\s+/)[0] ?? fullChoiceWord) : fullChoiceWord;
      if (choiceWord) {
        const escaped = choiceWord.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+');
        const cm = part.match(new RegExp(`^(\\s*)(${escaped})([\\s\\S]*)$`, 'i'));
        if (cm) return <span key={i}>{cm[1]}<span style={ulStyle}>{cm[2]}</span>{cm[3]}</span>;
      }
      const bracketM = part.match(/^(\s*)(\[[^\]]+\])([\s\S]*)$/);
      if (bracketM) return <span key={i}>{bracketM[1]}<span style={ulStyle}>{bracketM[2].slice(1, -1)}</span>{bracketM[3]}</span>;
      const m = part.match(/^(\s*)(\S+)([\s\S]*)$/);
      if (m) return <span key={i}>{m[1]}<span style={ulStyle}>{m[2]}</span>{m[3]}</span>;
    }
    return <span key={i}>{part}</span>;
  });
}

function renderGrammarChoice(text: string, isCorrect: boolean, choiceNumber?: number) {
  const m = text.match(/^([①②③④⑤])\s*(.+)$/);
  const color = isCorrect ? '#4338ca' : '#111827';
  const circle = m ? m[1] : (choiceNumber != null ? CIRCLE_NUMS[choiceNumber - 1] : '');
  const word = m ? m[2] : text;
  return (
    <span>
      <span style={{ fontWeight: 900, fontSize: '15px', color }}>{circle}</span>{' '}
      <span style={{ fontWeight: 600, fontSize: '13px', color }}>{word}</span>
    </span>
  );
}

function renderWithUnderline(text: string) {
  const parts = text.split(/(\[[^\]]+\])/g);
  return parts.map((part, i) =>
    part.startsWith('[') && part.endsWith(']')
      ? <span key={i} style={{ textDecoration: 'underline', textDecorationThickness: '2.5px', textUnderlineOffset: '4px', fontWeight: 900, color: '#111827' }}>{part.slice(1, -1)}</span>
      : <span key={i}>{part}</span>
  );
}

function renderFlowPassage(text: string) {
  const CIRCLES = ['①','②','③','④','⑤'];
  const normalized = text.replace(/\n+/g, ' ').replace(/\s*(①|②|③|④|⑤)/g, ' $1').trim();
  const parts = normalized.split(/(①|②|③|④|⑤)/g);
  return parts.map((part, i) =>
    CIRCLES.includes(part)
      ? <span key={i} style={{ fontWeight: 900, color: '#7c3aed' }}>{part}</span>
      : <span key={i}>{part}</span>
  );
}

function renderVocabBlankPassage(text: string) {
  const normalized = text.replace(/\(([ab])\)\s*_+/gi, '($1)');
  const parts = normalized.split(/(\(a\)|\(b\))/gi);
  return parts.map((part, i) => {
    const lower = part.toLowerCase();
    if (lower === '(a)' || lower === '(b)') {
      return (
        <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', margin: '0 3px', verticalAlign: 'middle' }}>
          <span style={{ fontWeight: 900, color: '#4338ca', background: '#eef2ff', padding: '1px 7px', borderRadius: '5px', fontSize: '13px', lineHeight: '1.6' }}>{lower}</span>
          <span style={{ display: 'inline-block', width: '76px', borderBottom: '2px solid #374151', marginBottom: '1px', verticalAlign: 'bottom' }}>&nbsp;</span>
        </span>
      );
    }
    return <span key={i}>{part}</span>;
  });
}

// ─── PDF 헬퍼 ────────────────────────────────────────────────────────────────
function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click();
  document.body.removeChild(a); URL.revokeObjectURL(url);
}

async function generateQuestionPdfBlob(questions: ExamQuestion[], title: string, originalPassage?: string): Promise<Blob | null> {
  const { toJpeg } = await import('html-to-image');
  const { jsPDF } = await import('jspdf');
  const W = 210, M = 8, GAP = 4;
  const colW = (W - 2 * M - GAP) / 2;
  const A4_H = 297, BOTTOM = A4_H - M - 8, RENDER_W = 360;
  const pdf = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });

  const esc = (s: string | null | undefined) => (s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br/>');
  const escP = (s: string | null | undefined) => (s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n+/g, ' ').replace(/\s+/g, ' ').trim();

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
    return parts.map(part => CG.includes(part) ? `<span style="font-weight:900;color:#7c3aed;">${part}</span>` : ss(part)).join('');
  };

  const escWithUnderline = (s: string | null | undefined) => {
    const raw = s ?? '';
    const parts = raw.split(/(\[[^\]]+\])/g);
    const ss = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n+/g, ' ');
    return parts.map(part => part.startsWith('[') && part.endsWith(']') ? `<span style="text-decoration:underline;text-decoration-thickness:2px;text-underline-offset:3px;font-weight:700;color:#111827;">${ss(part.slice(1, -1))}</span>` : ss(part)).join('');
  };

  const escVocabBlank = (s: string | null | undefined) => {
    const raw = (s ?? '').replace(/\(([ab])\)\s*_+/gi, '($1)');
    const parts = raw.split(/(\(a\)|\(b\))/gi);
    const ss = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n+/g, ' ');
    return parts.map(part => {
      const lower = part.toLowerCase();
      if (lower === '(a)' || lower === '(b)') return `<span style="display:inline-block;border-bottom:2.5px solid #374151;min-width:82px;text-align:center;font-weight:900;color:#4338ca;font-size:12px;margin:0 3px;vertical-align:bottom;padding-bottom:1px;">${lower}</span>`;
      return ss(part);
    }).join('');
  };

  const passageBox = (content: string) => `<div style="background:#f8fafc;border:1px solid #cbd5e1;border-radius:4px;padding:6px 8px;margin-bottom:7px;font-size:13px;line-height:1.65;color:#1e293b;text-align:justify;word-break:break-word;">${content}</div>`;
  const instrP = (content: string) => `<p style="font-size:13px;font-weight:700;color:#1e293b;margin:0 0 5px;line-height:1.5;white-space:pre-wrap;">${content}</p>`;

  const buildHtml = (q: ExamQuestion, num: number) => {
    const typeLabel = TYPE_LABEL_MAP[q.type] || q.type;
    const qPassage = q._passageText ?? originalPassage;
    let html = `<div style="font-size:9px;font-weight:700;color:#64748b;background:#f1f5f9;padding:1px 6px;border-radius:3px;display:inline-block;margin-bottom:4px;">${esc(typeLabel)}</div>\n`;

    if (q.type === 'vocab_paraphrase') {
      html += instrP(`${num}. ${esc(q.question_text)}`);
      if (q.modified_passage) html += passageBox(escGrammar(q.modified_passage, q.choices, true));
    } else if (q.type === 'summary') {
      const pts = q.question_text.split('\n\n');
      const instr = pts[0]?.trim() || '';
      const sumText = pts.slice(1).join('\n\n').replace(/^\[요약문\]\s*/i, '').trim();
      html += instrP(`${num}. ${esc(instr)}`);
      if (qPassage) html += passageBox(escP(qPassage));
      if (sumText) {
        html += `<div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;padding:10px;margin-bottom:10px;">`;
        html += `<div style="font-size:10px;font-weight:700;color:#94a3b8;margin-bottom:4px;">[요약문]</div>`;
        html += `<div style="font-size:12px;line-height:1.8;color:#334155;">${escP(sumText)}</div></div>`;
      }
    } else if (q.type === 'topic_title' && qPassage) {
      html += instrP(`${num}. ${esc(q.question_text)}`);
      html += passageBox(escP(qPassage));
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
      if (givenM) html += `<div style="background:#f8fafc;border:1px solid #cbd5e1;border-radius:4px;padding:5px 8px;margin-bottom:5px;"><div style="font-size:9px;font-weight:900;color:#94a3b8;margin-bottom:2px;">[주어진 글]</div><div style="font-size:12px;line-height:1.6;color:#1e293b;text-align:justify;word-break:break-word;">${esc(givenM[1].trim())}</div></div>`;
      for (const [lbl, m] of [['A', aM], ['B', bM], ['C', cM]] as [string, RegExpMatchArray | null][]) {
        if (m) html += `<div style="background:#ffffff;border:1px solid #e2e8f0;border-radius:4px;padding:5px 8px;margin-bottom:5px;"><div style="font-size:9px;font-weight:900;color:#6366f1;margin-bottom:2px;">(${lbl})</div><div style="font-size:12px;line-height:1.6;color:#1e293b;text-align:justify;word-break:break-word;">${esc(m[1].trim())}</div></div>`;
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

  let leftY = M, rightY = M, currentCol: 'left' | 'right' = 'left', pageNum = 1, lineTopY = M;

  const finalizePage = () => {
    pdf.setDrawColor(200, 200, 200); pdf.setLineWidth(0.3);
    pdf.line(M + colW + GAP / 2, lineTopY, M + colW + GAP / 2, BOTTOM + 5);
    pdf.setFontSize(9); pdf.setTextColor(150, 150, 150);
    pdf.text(`— ${pageNum} —`, W / 2, A4_H - 7, { align: 'center' });
  };

  const placeImage = (url: string, h_mm: number) => {
    if (currentCol === 'left') {
      if (leftY + h_mm <= BOTTOM) { pdf.addImage(url, 'JPEG', M, leftY, colW, h_mm); leftY += h_mm + 2; return; }
      currentCol = 'right';
    }
    if (currentCol === 'right') {
      if (rightY + h_mm <= BOTTOM) { pdf.addImage(url, 'JPEG', M + colW + GAP, rightY, colW, h_mm); rightY += h_mm + 2; return; }
      finalizePage(); pdf.addPage(); pageNum++; leftY = M; rightY = M; currentCol = 'left'; lineTopY = M;
      pdf.addImage(url, 'JPEG', M, leftY, colW, h_mm); leftY += h_mm + 2;
    }
  };

  const renderEl = async (html: string, w: number, padding: number) => {
    const el = document.createElement('div');
    el.style.cssText = `position:fixed;top:0;left:0;width:${w}px;background:white;padding:${padding}px;box-sizing:border-box;font-family:'Malgun Gothic',Arial,Helvetica,sans-serif;z-index:-9999;`;
    el.innerHTML = html;
    document.body.appendChild(el);
    await new Promise(r => requestAnimationFrame(r)); await new Promise(r => requestAnimationFrame(r));
    const ratio = el.scrollHeight / el.offsetWidth;
    const url = await toJpeg(el, { pixelRatio: 2, quality: 0.92, backgroundColor: '#ffffff', cacheBust: true });
    document.body.removeChild(el);
    return { url, ratio };
  };

  if (title) {
    const { url: titleUrl, ratio: titleRatio } = await renderEl(
      `<div style="text-align:center;border-bottom:2px solid #334155;padding-bottom:6px;margin-bottom:2px;"><div style="font-size:14px;font-weight:900;color:#1e293b;letter-spacing:-0.3px;">${esc(title)}</div></div>`,
      760, 8
    );
    const fullW = W - 2 * M; const titleMmH = fullW * titleRatio;
    pdf.addImage(titleUrl, 'JPEG', M, M, fullW, titleMmH);
    leftY = M + titleMmH + 3; rightY = leftY; lineTopY = leftY;
  }

  for (let i = 0; i < questions.length; i++) {
    const { url, ratio } = await renderEl(buildHtml(questions[i], i + 1), RENDER_W, 6);
    placeImage(url, colW * ratio);
  }
  finalizePage(); return pdf.output('blob');
}

async function buildAnswerPdfBlob(questions: ExamQuestion[], title: string): Promise<Blob> {
  const { toJpeg } = await import('html-to-image');
  const { jsPDF } = await import('jspdf');
  const W = 210, M = 8, GAP = 4;
  const colW = (W - 2 * M - GAP) / 2;
  const A4_H = 297, BOTTOM = A4_H - M - 8, RENDER_W = 400;
  const pdf = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });
  const esc = (s: string | null | undefined) => (s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br/>');

  let leftY = M, rightY = M, currentCol: 'left' | 'right' = 'left', pageNum = 1, lineTopY = M;

  const finalizePage = () => {
    pdf.setDrawColor(200, 200, 200); pdf.setLineWidth(0.3);
    pdf.line(M + colW + GAP / 2, lineTopY, M + colW + GAP / 2, BOTTOM + 5);
    pdf.setFontSize(9); pdf.setTextColor(150, 150, 150);
    pdf.text(`— ${pageNum} —`, W / 2, A4_H - 7, { align: 'center' });
  };

  const placeImage = (url: string, h_mm: number) => {
    if (currentCol === 'left') {
      if (leftY + h_mm <= BOTTOM) { pdf.addImage(url, 'JPEG', M, leftY, colW, h_mm); leftY += h_mm + 2; return; }
      currentCol = 'right';
    }
    if (currentCol === 'right') {
      if (rightY + h_mm <= BOTTOM) { pdf.addImage(url, 'JPEG', M + colW + GAP, rightY, colW, h_mm); rightY += h_mm + 2; return; }
      finalizePage(); pdf.addPage(); pageNum++; leftY = M; rightY = M; currentCol = 'left'; lineTopY = M;
      pdf.addImage(url, 'JPEG', M, leftY, colW, h_mm); leftY += h_mm + 2;
    }
  };

  const renderEl = async (html: string, w: number, padding: number) => {
    const el = document.createElement('div');
    el.style.cssText = `position:fixed;top:0;left:0;width:${w}px;background:white;padding:${padding}px;box-sizing:border-box;font-family:'Malgun Gothic',Arial,Helvetica,sans-serif;z-index:-9999;`;
    el.innerHTML = html;
    document.body.appendChild(el);
    await new Promise(r => requestAnimationFrame(r)); await new Promise(r => requestAnimationFrame(r));
    const ratio = el.scrollHeight / el.offsetWidth;
    const url = await toJpeg(el, { pixelRatio: 2, quality: 0.92, backgroundColor: '#ffffff', cacheBust: true });
    document.body.removeChild(el);
    return { url, ratio };
  };

  if (title) {
    const { url: titleUrl, ratio: titleRatio } = await renderEl(
      `<div style="text-align:center;border-bottom:2px solid #334155;padding-bottom:6px;margin-bottom:2px;"><div style="font-size:14px;font-weight:900;color:#1e293b;letter-spacing:-0.3px;">${esc(title)} — 정답 및 해설</div></div>`,
      760, 8
    );
    const fullW = W - 2 * M; const titleMmH = fullW * titleRatio;
    pdf.addImage(titleUrl, 'JPEG', M, M, fullW, titleMmH);
    leftY = M + titleMmH + 3; rightY = leftY; lineTopY = leftY;
  }

  for (let i = 0; i < questions.length; i++) {
    const q = questions[i];
    const typeLabel = TYPE_LABEL_MAP[q.type] || q.type;
    const answerCircle = (q.type === 'grammar' || q.type === 'vocab_paraphrase' || q.type === 'flow')
      ? CIRCLE_NUMS[q.answer - 1] : `${q.answer}번`;
    let html = `<div style="border-left:3px solid #4338ca;padding:6px 8px;border-radius:0 4px 4px 0;background:#fafafa;">`;
    html += `<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:5px;">`;
    html += `<div style="display:flex;align-items:center;gap:6px;"><span style="font-size:11px;font-weight:900;color:#1e293b;">${i + 1}번</span>`;
    html += `<span style="font-size:9px;font-weight:700;padding:1px 5px;border-radius:3px;background:#e0e7ff;color:#4338ca;">${esc(typeLabel)}</span></div>`;
    html += `<span style="font-size:11px;font-weight:900;color:#7c3aed;">정답 ${answerCircle}</span></div>`;
    if (q.type === 'summary') {
      const pts = q.question_text.split('\n\n');
      const sumText = pts.slice(1).join('\n\n').replace(/^\[요약문\]\s*/i, '').trim();
      if (sumText) html += `<div style="font-size:9px;color:#475569;margin-bottom:6px;padding:5px 7px;background:#f0f4ff;border-radius:3px;line-height:1.6;border:1px solid #c7d2fe;">${esc(sumText)}</div>`;
    }
    html += `<p style="font-size:9.5px;color:#374151;line-height:1.65;margin:0;">${esc(q.explanation)}</p></div>`;
    const { url, ratio } = await renderEl(html, RENDER_W, 6);
    placeImage(url, colW * ratio);
  }
  finalizePage(); return pdf.output('blob');
}

// ─── SortableTypeCard ─────────────────────────────────────────────────────────
function SortableTypeCard({ cfg, onUpdate, onRemove }: { cfg: TypeConfig; onUpdate: (id: string, patch: Partial<TypeConfig>) => void; onRemove: (id: string) => void; }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: cfg.id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 };
  return (
    <div ref={setNodeRef} style={style}
      className={`flex items-center gap-3 bg-white rounded-2xl border-2 px-4 py-4 shadow-sm transition-all ${cfg.enabled ? 'border-indigo-100' : 'border-gray-100 opacity-60'}`}>
      <button {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing text-gray-300 hover:text-gray-500 flex-shrink-0 text-lg touch-none select-none" tabIndex={-1}>⠿</button>
      <input type="checkbox" checked={cfg.enabled} onChange={e => onUpdate(cfg.id, { enabled: e.target.checked })} className="w-5 h-5 accent-indigo-600 flex-shrink-0 cursor-pointer" />
      <div className="w-36 flex-shrink-0">
        {cfg.isCustom ? (
          <select value={cfg.type} onChange={e => onUpdate(cfg.id, { type: e.target.value })} className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs font-bold text-gray-700 outline-none focus:border-indigo-400 bg-white">
            <option value="">유형 선택</option>
            {QUESTION_TYPE_OPTIONS.map(o => <option key={o.key} value={o.key}>{o.label}</option>)}
          </select>
        ) : (
          <span className={`inline-block text-xs font-black px-2.5 py-1 rounded-lg border ${TYPE_COLOR_MAP[cfg.type] ?? 'bg-gray-100 text-gray-600 border-gray-200'}`}>
            {TYPE_LABEL_MAP[cfg.type] ?? cfg.type}
          </span>
        )}
      </div>
      <div className="flex gap-1.5 flex-1">
        {DIFF_OPTIONS.map(d => (
          <button key={d.key} onClick={() => onUpdate(cfg.id, { difficulty: d.key })}
            className={`flex-1 py-2 rounded-xl font-black text-xs transition-all border-2 ${cfg.difficulty === d.key ? d.active : 'border-gray-200 bg-white text-gray-400 hover:border-gray-300 hover:text-gray-600'}`}>
            <div className="text-base leading-none mb-0.5">{d.icon}</div>
            <div className="text-[9px] font-bold opacity-60 leading-none mb-0.5">{d.sub}</div>
            <div className="leading-none">{d.label}</div>
          </button>
        ))}
      </div>
      <div className="flex items-center gap-1.5 flex-shrink-0">
        <button onClick={() => onUpdate(cfg.id, { count: Math.max(1, cfg.count - 1) })} className="w-7 h-7 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-600 font-black text-sm flex items-center justify-center transition-all">−</button>
        <span className="w-5 text-center text-base font-black text-indigo-700">{cfg.count}</span>
        <button onClick={() => onUpdate(cfg.id, { count: Math.min(3, cfg.count + 1) })} className="w-7 h-7 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-600 font-black text-sm flex items-center justify-center transition-all">+</button>
      </div>
      {cfg.isCustom && <button onClick={() => onRemove(cfg.id)} className="text-red-300 hover:text-red-500 text-base font-black flex-shrink-0 leading-none">✕</button>}
    </div>
  );
}

// ─── 메인 컴포넌트 ────────────────────────────────────────────────────────────
export default function MockExamQuestionsPage() {
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

  const [typeConfigs, setTypeConfigs] = useState<TypeConfig[]>(() =>
    QUESTION_TYPE_OPTIONS.map(o => ({ id: crypto.randomUUID(), type: o.key, difficulty: 'b2' as const, count: 1, enabled: true, isCustom: false }))
  );
  const [bulkDifficulty, setBulkDifficulty] = useState<'b1' | 'b2' | 'c1' | 'c2' | ''>('');
  const [bulkCount, setBulkCount] = useState<number | ''>(1);

  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState('');
  const [questions, setQuestions] = useState<ExamQuestion[]>([]);
  const [conBalance, setConBalance] = useState<number | null>(null);
  const [session, setSession] = useState<{ user: { id: string }; access_token: string } | null>(null);
  const [revealedAnswers, setRevealedAnswers] = useState<Set<number>>(new Set());
  const [pdfTitle, setPdfTitle] = useState('');
  const [pdfLoading, setPdfLoading] = useState<false | '문제' | '답안'>(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session: s } }) => { if (s) setSession(s as typeof session); });
  }, []);

  useEffect(() => {
    if (!session) return;
    fetch('/api/credits/transactions', { headers: { Authorization: `Bearer ${session.access_token}` } })
      .then(r => r.json()).then((j: { balance?: number }) => { if (j.balance !== undefined) setConBalance(j.balance); });
  }, [session]);

  // 캐스케이드 셀렉트
  useEffect(() => {
    supabase.from('mock_exam_passages').select('year').order('year', { ascending: false })
      .then(({ data }) => { setYears([...new Set((data ?? []).map((r: { year: number }) => r.year))]); });
  }, []);

  useEffect(() => {
    if (!selectedYear) return;
    setSelectedGrade(''); setSelectedInstitution(''); setSelectedNumbers([]); setPassageMap({}); setLoadingNumbers(new Set());
    supabase.from('mock_exam_passages').select('grade').eq('year', parseInt(selectedYear)).order('grade', { ascending: true })
      .then(({ data }) => { setGrades([...new Set((data ?? []).map((r: { grade: string }) => r.grade))]); });
  }, [selectedYear]);

  useEffect(() => {
    if (!selectedYear || !selectedGrade) return;
    setSelectedInstitution(''); setSelectedNumbers([]); setPassageMap({}); setLoadingNumbers(new Set());
    supabase.from('mock_exam_passages').select('institution').eq('year', parseInt(selectedYear)).eq('grade', selectedGrade).order('institution', { ascending: true })
      .then(({ data }) => {
        const unique = [...new Set((data ?? []).map((r: { institution: string }) => r.institution))];
        unique.sort((a, b) => {
          const ma = parseInt(a.match(/^(\d+)/)?.[1] ?? '99');
          const mb = parseInt(b.match(/^(\d+)/)?.[1] ?? '99');
          return ma - mb;
        });
        setInstitutions(unique);
      });
  }, [selectedYear, selectedGrade]);

  useEffect(() => {
    if (!selectedYear || !selectedGrade || !selectedInstitution) return;
    setSelectedNumbers([]); setPassageMap({}); setLoadingNumbers(new Set());
    supabase.from('mock_exam_passages').select('question_number').eq('year', parseInt(selectedYear)).eq('grade', selectedGrade).eq('institution', selectedInstitution).order('question_number')
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

  const updateConfig = (id: string, patch: Partial<TypeConfig>) => { setTypeConfigs(prev => prev.map(c => c.id === id ? { ...c, ...patch } : c)); };
  const removeConfig = (id: string) => { setTypeConfigs(prev => prev.filter(c => c.id !== id)); };
  const addCustomConfig = () => { setTypeConfigs(prev => [...prev, { id: crypto.randomUUID(), type: '', difficulty: 'b2', count: 1, enabled: true, isCustom: true }]); };
  const applyBulk = () => {
    setTypeConfigs(prev => prev.map(c => {
      if (!c.enabled) return c;
      return { ...c, ...(bulkDifficulty ? { difficulty: bulkDifficulty } : {}), ...(bulkCount !== '' ? { count: Math.max(1, Math.min(3, bulkCount)) } : {}) };
    }));
  };

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setTypeConfigs(prev => { const oi = prev.findIndex(c => c.id === active.id); const ni = prev.findIndex(c => c.id === over.id); return arrayMove(prev, oi, ni); });
    }
  };

  const validConfigs = typeConfigs.filter(c => c.enabled && c.type !== '');
  const sortedSelectedNumbers = [...selectedNumbers].sort((a, b) => parseInt(a) - parseInt(b));
  const allPassagesReady = selectedNumbers.length > 0 && selectedNumbers.every(n => passageMap[n]) && loadingNumbers.size === 0;

  const handleGenerate = useCallback(async () => {
    if (!allPassagesReady || validConfigs.length === 0 || !session) return;
    setGenerating(true); setQuestions([]); setRevealedAnswers(new Set());
    const allQuestions: ExamQuestion[] = [];
    for (const num of sortedSelectedNumbers) {
      const text = passageMap[num];
      if (!text) continue;
      setProgress(`${num}번 지문 문제 생성 중...`);
      try {
        const res = await fetch('/api/generate-exam-questions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
          body: JSON.stringify({ text, typeConfigs: validConfigs.map(c => ({ type: c.type, difficulty: c.difficulty, count: c.count })) }),
        });
        const json = await res.json() as { questions?: ExamQuestion[]; error?: string };
        if (!res.ok) throw new Error(json.error || '생성 실패');
        const tagged = (json.questions ?? []).map(q => ({ ...q, _passageText: text, _passageNumber: parseInt(num) }));
        allQuestions.push(...tagged);
      } catch (e) {
        setProgress(e instanceof Error ? e.message : '생성 오류');
        setGenerating(false);
        return;
      }
    }
    setQuestions(allQuestions);
    setProgress(`${allQuestions.length}개 문제 생성 완료`);
    fetch('/api/credits/transactions', { headers: { Authorization: `Bearer ${session.access_token}` } })
      .then(r => r.json()).then((j: { balance?: number }) => { if (j.balance !== undefined) setConBalance(j.balance); });
    setGenerating(false);
  }, [allPassagesReady, sortedSelectedNumbers, passageMap, validConfigs, session]);

  const handleDownloadQuestion = async () => {
    if (!questions.length) return;
    setPdfLoading('문제');
    try {
      const blob = await generateQuestionPdfBlob(questions, pdfTitle.trim());
      if (blob) triggerDownload(blob, `${pdfTitle.trim() || '모의고사변형문제'}_문제.pdf`);
    } finally { setPdfLoading(false); }
  };

  const handleDownloadAnswer = async () => {
    if (!questions.length) return;
    setPdfLoading('답안');
    try {
      const blob = await buildAnswerPdfBlob(questions, pdfTitle.trim());
      triggerDownload(blob, `${pdfTitle.trim() || '모의고사변형문제'}_답안해설.pdf`);
    } finally { setPdfLoading(false); }
  };

  return (
    <div className="min-h-screen bg-gray-50">
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
        {/* STEP 1 */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-base font-black text-gray-800 mb-4">STEP 1 — 기출 지문 선택</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
            {[
              { label: '년도', value: selectedYear, onChange: setSelectedYear, disabled: false, options: years.map(y => ({ value: String(y), label: `${y}년` })) },
              { label: '학년', value: selectedGrade, onChange: setSelectedGrade, disabled: !selectedYear, options: grades.map(g => ({ value: g, label: g })) },
              { label: '시험명/기관', value: selectedInstitution, onChange: setSelectedInstitution, disabled: !selectedGrade, options: institutions.map(i => ({ value: i, label: i })) },
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

          {/* 문제 번호 다중 선택 */}
          {selectedInstitution && (
            <div className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-black text-gray-400">문제 번호 <span className="text-gray-300 font-normal">(복수 선택 가능)</span></label>
                {selectedNumbers.length > 0 && (
                  <button onClick={() => { setSelectedNumbers([]); setPassageMap({}); }}
                    className="text-xs font-black text-gray-400 hover:text-red-400 transition-all">전체 해제</button>
                )}
              </div>
              {questionNumbers.length === 0 ? (
                <p className="text-sm text-gray-400">등록된 문제가 없습니다.</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {questionNumbers.map(n => {
                    const nStr = String(n);
                    const isSelected = selectedNumbers.includes(nStr);
                    const isLoading = loadingNumbers.has(nStr);
                    return (
                      <button key={n} onClick={() => toggleNumber(nStr)} disabled={isLoading}
                        className={`px-3 py-1.5 rounded-xl text-xs font-black border-2 transition-all ${
                          isSelected
                            ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                            : 'bg-white text-gray-600 border-gray-200 hover:border-indigo-300 hover:text-indigo-600'
                        } ${isLoading ? 'opacity-50 cursor-wait' : ''}`}>
                        {isLoading ? '...' : `${n}번`}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}
          {!selectedYear && <p className="text-sm text-gray-400 font-medium">년도를 선택하면 학년, 시험명/기관, 문제번호를 차례로 선택할 수 있습니다.</p>}

          {/* 선택된 지문 미리보기 */}
          {sortedSelectedNumbers.length > 0 && (
            <div className="mt-2 space-y-3">
              {sortedSelectedNumbers.map(num => (
                <div key={num} className="bg-slate-50 rounded-xl p-4 border border-slate-200">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-black text-slate-500">{num}번 지문 미리보기</p>
                    <button onClick={() => toggleNumber(num)} className="text-xs text-gray-400 hover:text-red-400 font-black transition-all">✕</button>
                  </div>
                  {loadingNumbers.has(num) ? (
                    <p className="text-sm text-gray-400 animate-pulse">지문 불러오는 중...</p>
                  ) : passageMap[num] ? (
                    <p className="text-sm text-slate-700 font-medium leading-relaxed" style={{ textAlign: 'justify', wordBreak: 'break-word' }}>{passageMap[num]}</p>
                  ) : (
                    <p className="text-sm text-gray-400">지문 없음</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* STEP 2 */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-black text-gray-800">STEP 2 — 문제 유형 설정</h2>
            <button onClick={addCustomConfig} className="flex items-center gap-1 px-3 py-1.5 bg-indigo-600 text-white text-xs font-black rounded-xl hover:bg-indigo-700 transition-all">+ 유형 추가</button>
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

        {/* STEP 3 */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-black text-gray-800">STEP 3 — 문제 생성</h2>
            <div className="text-sm font-bold text-gray-400">선택된 유형: {validConfigs.length}가지 / 총 {validConfigs.reduce((s, c) => s + c.count, 0)}문제</div>
          </div>
          <div className="mb-4">
            <label className="block text-xs font-black text-gray-400 mb-1.5">PDF 제목 (선택)</label>
            <input type="text" value={pdfTitle} onChange={e => setPdfTitle(e.target.value)} placeholder="예: 2024 수능 18번 변형"
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm font-bold text-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-300" />
          </div>
          <button onClick={handleGenerate} disabled={generating || !allPassagesReady || validConfigs.length === 0}
            className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-base rounded-2xl transition-all disabled:opacity-50 disabled:cursor-not-allowed">
            {generating ? '⏳ 생성 중...' : `🎯 문제 생성${sortedSelectedNumbers.length > 1 ? ` (${sortedSelectedNumbers.length}개 지문)` : ''}`}
          </button>
          {!allPassagesReady && loadingNumbers.size === 0 && <p className="text-xs font-bold text-gray-400 mt-2 text-center">STEP 1에서 지문 번호를 선택하세요</p>}
          {loadingNumbers.size > 0 && <p className="text-xs font-bold text-indigo-400 mt-2 text-center animate-pulse">지문 불러오는 중...</p>}
          {allPassagesReady && validConfigs.length === 0 && <p className="text-xs font-bold text-gray-400 mt-2 text-center">STEP 2에서 문제 유형을 선택하세요</p>}
          {progress && (
            <p className={`text-sm font-bold mt-3 text-center ${generating ? 'text-indigo-500 animate-pulse' : 'text-gray-500'}`}>{progress}</p>
          )}
        </div>

        {/* 생성된 문제 */}
        {questions.length > 0 && (
          <div className="space-y-4">
            <h2 className="text-lg font-black text-gray-900">생성된 문제 ({questions.length}개)</h2>
            {questions.map((q, idx) => {
              const typeOpt = QUESTION_TYPE_OPTIONS.find(o => o.key === q.type);
              const isRevealed = revealedAnswers.has(idx);
              const prevQ = questions[idx - 1];
              const showGroupHeader = q._passageNumber !== undefined && q._passageNumber !== prevQ?._passageNumber;
              const answerDisplay = (q.type === 'grammar' || q.type === 'vocab_paraphrase' || q.type === 'flow')
                ? CIRCLE_NUMS[q.answer - 1]
                : (q.type === 'sentence_order' ? (q.choices[q.answer - 1]?.text ?? `${q.answer}번`) : `${q.answer}번`);
              return (
                <div key={idx}>
                {showGroupHeader && sortedSelectedNumbers.length > 1 && (
                  <div className="flex items-center gap-3 py-2 mb-2">
                    <div className="h-px flex-1 bg-indigo-100" />
                    <span className="text-xs font-black text-indigo-400 bg-indigo-50 border border-indigo-100 px-3 py-1 rounded-full">
                      📄 {q._passageNumber}번 지문
                    </span>
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
                      {q.modified_passage && (
                        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 mb-4 text-sm text-slate-700 leading-relaxed whitespace-pre-wrap font-medium">
                          {renderPassageWithCircles(q.modified_passage, q.choices)}
                        </div>
                      )}
                    </>
                  )}

                  {q.type === 'summary' && (() => {
                    const parts = q.question_text.split('\n\n');
                    const instruction = parts[0]?.trim() || '';
                    const summaryText = parts.slice(1).join('\n\n').replace(/^\[요약문\]\s*/i, '').trim();
                    return (
                      <>
                        <p className="text-sm font-bold text-gray-800 mb-3 whitespace-pre-wrap">{instruction}</p>
                        {q._passageText && (
                          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 mb-4 text-sm text-slate-700 leading-relaxed whitespace-pre-wrap font-medium">{q._passageText}</div>
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

                  {q.type === 'topic_title' && (
                    <>
                      <div className="text-sm font-bold text-gray-800 mb-4 leading-relaxed whitespace-pre-wrap">{q.question_text}</div>
                      {q._passageText && <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 mb-4 text-sm text-slate-700 leading-relaxed whitespace-pre-wrap font-medium">{q._passageText}</div>}
                    </>
                  )}

                  {q.type === 'grammar' && (
                    <>
                      <div className="text-sm font-bold text-gray-800 mb-4 leading-relaxed whitespace-pre-wrap">{q.question_text}</div>
                      {q.modified_passage && (
                        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 mb-4 text-sm text-slate-700 leading-relaxed whitespace-pre-wrap font-medium">
                          {renderPassageWithCircles(q.modified_passage.replace(/\[([^\]]+)\]/g, '$1'), q.choices, false)}
                        </div>
                      )}
                    </>
                  )}

                  {q.type === 'vocab_blank' && (
                    <>
                      <div className="text-sm font-bold text-gray-800 mb-6 leading-relaxed">{q.question_text}</div>
                      {q.modified_passage && (
                        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 mb-6 text-sm text-slate-700 leading-relaxed font-medium whitespace-pre-wrap">
                          {renderVocabBlankPassage(q.modified_passage)}
                        </div>
                      )}
                    </>
                  )}

                  {q.type === 'fill_blank' && (
                    <>
                      <div className="text-sm font-bold text-gray-800 mb-4 leading-relaxed whitespace-pre-wrap">{q.question_text}</div>
                      {q.modified_passage && <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 mb-4 text-sm text-slate-700 leading-relaxed whitespace-pre-wrap font-medium">{q.modified_passage}</div>}
                    </>
                  )}

                  {q.type === 'flow' && (
                    <>
                      <div className="text-sm font-bold text-gray-800 mb-4 leading-relaxed whitespace-pre-wrap">{q.question_text}</div>
                      {q.modified_passage && (
                        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 mb-4 text-sm text-slate-700 leading-relaxed font-medium">
                          {renderFlowPassage(q.modified_passage)}
                        </div>
                      )}
                    </>
                  )}

                  {q.type === 'phrase_meaning' && (
                    <>
                      <div className="text-sm font-bold text-gray-800 mb-4 leading-relaxed whitespace-pre-wrap">{q.question_text}</div>
                      {q.modified_passage && (
                        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 mb-4 text-sm text-slate-700 leading-relaxed whitespace-pre-wrap font-medium">
                          {renderWithUnderline(q.modified_passage)}
                        </div>
                      )}
                    </>
                  )}

                  {q.type === 'sentence_order' && (() => {
                    const instruction = q.question_text.split('[주어진 글]')[0].trim();
                    const raw = q.modified_passage || q.question_text;
                    const givenMatch = raw.match(/\[주어진 글\]\s*([\s\S]*?)(?=\(A\))/);
                    const aMatch = raw.match(/\(A\)\s*([\s\S]*?)(?=\(B\))/);
                    const bMatch = raw.match(/\(B\)\s*([\s\S]*?)(?=\(C\))/);
                    const cMatch = raw.match(/\(C\)\s*([\s\S]*?)$/);
                    return (
                      <>
                        <div className="text-sm font-bold text-gray-800 mb-4 leading-relaxed">{instruction}</div>
                        {givenMatch && (
                          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 mb-3">
                            <p className="text-xs font-black text-slate-400 mb-2">[주어진 글]</p>
                            <p className="text-sm text-slate-700 font-medium leading-relaxed" style={{ textAlign: 'justify', wordBreak: 'break-word' }}>{givenMatch[1].trim()}</p>
                          </div>
                        )}
                        {([['A', aMatch], ['B', bMatch], ['C', cMatch]] as [string, RegExpMatchArray | null][]).map(([label, match]) => match && (
                          <div key={label} className="bg-white border border-slate-200 rounded-xl p-4 mb-3">
                            <p className="text-xs font-black text-indigo-500 mb-2">({label})</p>
                            <p className="text-sm text-slate-700 font-medium leading-relaxed" style={{ textAlign: 'justify', wordBreak: 'break-word' }}>{match[1].trim()}</p>
                          </div>
                        ))}
                      </>
                    );
                  })()}

                  {q.type !== 'vocab_paraphrase' && q.type !== 'summary' && q.type !== 'vocab_blank' && q.type !== 'topic_title' && q.type !== 'grammar' && q.type !== 'fill_blank' && q.type !== 'flow' && q.type !== 'phrase_meaning' && q.type !== 'sentence_order' && (
                    <div className="text-sm font-bold text-gray-800 mb-4 leading-relaxed whitespace-pre-wrap">{q.question_text}</div>
                  )}

                  {q.type !== 'flow' && q.type !== 'grammar' && (
                    <div className="space-y-2.5 mb-5">
                      {q.choices.map((c, ci) => {
                        const isCorrect = isRevealed && (c.number === q.answer || ci + 1 === q.answer);
                        return (
                          <div key={ci} className={`flex gap-3 items-start p-3 rounded-xl transition-all ${isCorrect ? 'bg-indigo-50 border border-indigo-200' : 'bg-gray-50 border border-transparent'}`}>
                            {q.type === 'sentence_order' ? (
                              <span className={`text-sm leading-relaxed font-medium ${isCorrect ? 'font-black text-indigo-700' : 'text-gray-700'}`}>{c.text}</span>
                            ) : (
                              <>
                                <span className={`font-black flex-shrink-0 text-sm pt-0.5 min-w-[20px] ${isCorrect ? 'text-indigo-600' : 'text-gray-600'}`}>{CIRCLE_NUMS[ci]}</span>
                                <span className={`text-sm leading-relaxed ${isCorrect ? 'font-black text-indigo-700' : 'font-medium text-gray-700'}`}>{c.text}</span>
                              </>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  <div>
                    <button
                      onClick={() => { setRevealedAnswers(prev => { const next = new Set(prev); if (next.has(idx)) next.delete(idx); else next.add(idx); return next; }); }}
                      className="text-xs font-black text-indigo-600 hover:text-indigo-800 transition-all border border-indigo-200 px-3 py-1.5 rounded-lg hover:bg-indigo-50"
                    >
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
                </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 다운로드 버튼 */}
      {questions.length > 0 && (
        <div className="fixed bottom-8 right-8 flex flex-row items-end gap-3 z-50">
          <button onClick={handleDownloadQuestion} disabled={!!pdfLoading}
            className="px-5 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-sm rounded-2xl shadow-lg disabled:opacity-50 transition-all">
            {pdfLoading === '문제' ? '⏳ 생성 중...' : '⬇️ 문제 다운로드'}
          </button>
          <button onClick={handleDownloadAnswer} disabled={!!pdfLoading}
            className="px-5 py-3 bg-slate-700 hover:bg-slate-800 text-white font-black text-sm rounded-2xl shadow-lg disabled:opacity-50 transition-all">
            {pdfLoading === '답안' ? '⏳ 생성 중...' : '⬇️ 답안해설 다운로드'}
          </button>
        </div>
      )}
    </div>
  );
}
