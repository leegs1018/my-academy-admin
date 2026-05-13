'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import ConInsufficientModal from '@/components/ConInsufficientModal';

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

interface QuestionTypeOption {
  key: string;
  label: string;
  description: string;
  color: string;
}

const QUESTION_TYPE_OPTIONS: QuestionTypeOption[] = [
  { key: 'topic_title',      label: '주제/제목 유형',         description: '글의 주제나 제목 파악',             color: 'bg-blue-100 text-blue-700 border-blue-200' },
  { key: 'grammar',          label: '어법 유형',              description: '어법상 틀린 것 찾기 ①~⑤',           color: 'bg-green-100 text-green-700 border-green-200' },
  { key: 'vocab_paraphrase', label: '어휘 - 낱말 쓰임 유형',  description: '문맥상 적절하지 않은 낱말 찾기',     color: 'bg-purple-100 text-purple-700 border-purple-200' },
  { key: 'vocab_blank',      label: '어휘 (a)(b) 빈칸 유형', description: '두 빈칸에 알맞은 어휘 쌍',            color: 'bg-amber-100 text-amber-700 border-amber-200' },
  { key: 'fill_blank',       label: '빈칸 추론 유형',         description: '핵심 빈칸에 들어갈 표현',             color: 'bg-rose-100 text-rose-700 border-rose-200' },
  { key: 'summary',          label: '요약문 완성 유형',       description: '요약문의 (A)(B) 빈칸 완성',          color: 'bg-teal-100 text-teal-700 border-teal-200' },
  { key: 'flow',             label: '흐름 유형',              description: '전체 흐름과 관계 없는 문장 찾기',    color: 'bg-cyan-100 text-cyan-700 border-cyan-200' },
  { key: 'phrase_meaning',   label: '어구 의미 추론 유형',    description: '밑줄 어구의 문맥 속 의미 추론',      color: 'bg-orange-100 text-orange-700 border-orange-200' },
];

const TYPE_COLOR_MAP: Record<string, string> = {};
QUESTION_TYPE_OPTIONS.forEach(o => { TYPE_COLOR_MAP[o.key] = o.color; });

const TYPE_LABEL_MAP: Record<string, string> = {};
QUESTION_TYPE_OPTIONS.forEach(o => { TYPE_LABEL_MAP[o.key] = o.label; });

const CIRCLE_NUMS = ['①', '②', '③', '④', '⑤'];

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
  const RENDER_W = 400; // px width per question element

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

  const passageBox = (content: string) =>
    `<div style="background:#f8fafc;border:1px solid #cbd5e1;border-radius:4px;padding:6px 8px;margin-bottom:7px;font-size:13px;line-height:1.65;color:#1e293b;">${content}</div>`;
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
  const [activeTab, setActiveTab] = useState<'generate' | 'history'>('generate');
  const [inputMode, setInputMode] = useState<'text' | 'image'>('text');

  const [manualText, setManualText] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [ocrText, setOcrText] = useState('');
  const [ocrLoading, setOcrLoading] = useState(false);
  const [ocrDone, setOcrDone] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [pdfTitle, setPdfTitle] = useState('');

  const [selectedTypes, setSelectedTypes] = useState<Set<string>>(new Set(['topic_title']));
  const [difficulty, setDifficulty] = useState<'b1' | 'b2' | 'c1' | 'c2'>('b2');

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

  const [historyList, setHistoryList] = useState<ExamHistoryItem[]>([]);
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
  const [passageModal, setPassageModal] = useState<ExamHistoryItem | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const textToSend = inputMode === 'text' ? manualText : ocrText;

  // 세션 + AI 단가 로드
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user?.id) setUserId(session.user.id);
    });
    fetch('/api/credits/pricing')
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        const ai = data?.pricing?.find((p: { feature_key: string; cost_per_use: number }) => p.feature_key === 'ai_question');
        if (ai) setAiPrice(ai.cost_per_use);
      })
      .catch(() => {});
  }, []);

  // ── 이력 조회 ──
  const fetchHistory = useCallback(async (query = searchQuery, date = searchDate) => {
    setHistoryLoading(true);
    setHistoryError(null);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setHistoryError('로그인 정보를 확인할 수 없습니다.'); return; }

      let q = supabase
        .from('exam_question_history')
        .select('*')
        .eq('academy_id', user.id)
        .order('created_at', { ascending: false });

      if (date) q = q.gte('created_at', date).lte('created_at', date + 'T23:59:59');
      if (query) q = q.ilike('passage_full', `%${query}%`);

      const { data, error: fetchErr } = await q;
      if (fetchErr) { setHistoryError(`조회 오류: ${fetchErr.message}`); return; }
      setHistoryList(data ?? []);
    } catch (e) {
      setHistoryError(e instanceof Error ? e.message : '알 수 없는 오류');
    } finally {
      setHistoryLoading(false);
    }
  }, [searchQuery, searchDate]);

  useEffect(() => {
    if (activeTab === 'history') fetchHistory();
  }, [activeTab]);

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

  // ── 유형 선택 토글 ──
  const toggleType = (key: string) => {
    setSelectedTypes(prev => {
      const next = new Set(prev);
      if (next.has(key)) {
        if (next.size > 1) next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  // ── 자동 저장 ──
  const autoSaveExam = useCallback(async (qs: ExamQuestion[], text: string, types: string[], titleSnapshot: string, originalPassage: string, difficultyLevel: string) => {
    setSaveStatus('saving');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { setSaveStatus('error'); setSaveErrorMsg('로그인 세션 없음'); return; }

      const [questionBlob, answerBlob] = await Promise.all([
        generateQuestionPdfBlob(qs, titleSnapshot.trim(), originalPassage),
        buildAnswerPdfBlob(qs, titleSnapshot.trim()),
      ]);
      if (!questionBlob) { setSaveStatus('error'); setSaveErrorMsg('PDF 생성 실패'); return; }

      const toBase64 = (blob: Blob) => new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });

      const [pdfBase64, answerPdfBase64] = await Promise.all([
        toBase64(questionBlob),
        toBase64(answerBlob),
      ]);

      const res = await fetch('/api/save-exam-history', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          pdfBase64,
          answerPdfBase64,
          title: titleSnapshot.trim() || null,
          passageExcerpt: text.slice(0, 150),
          passageFull: text,
          questionTypes: types,
          difficulty: difficultyLevel,
        }),
      });
      const json = await res.json() as { success?: boolean; error?: string };
      if (res.ok && json.success) setSaveStatus('done');
      else { setSaveStatus('error'); setSaveErrorMsg(json.error || '알 수 없는 오류'); }
    } catch (e) {
      setSaveStatus('error');
      setSaveErrorMsg(e instanceof Error ? e.message : '네트워크 오류');
    }
  }, []);

  // ── 문제 생성 ──
  const handleGenerate = async () => {
    if (selectedTypes.size === 0 || textToSend.trim().length < 50) return;
    setLoading(true);
    setError(null);
    setQuestions(null);
    setRevealedAnswers(new Set());
    setSaveStatus('idle');

    const msgs = [
      'AI가 지문을 분석하고 있어요... 🤖',
      '수능 스타일 문제를 생성하고 있어요... ✍️',
      '선지와 해설을 작성하고 있어요... 📝',
      '거의 완성됐어요! 잠시만요... ✨',
    ];
    let idx = 0;
    setLoadingMsg(msgs[0]);
    msgIntervalRef.current = setInterval(() => {
      idx = (idx + 1) % msgs.length;
      setLoadingMsg(msgs[idx]);
    }, 8000);

    try {
      const res = await fetch('/api/generate-exam-questions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: textToSend.trim(), questionTypes: [...selectedTypes], difficulty, academy_id: userId || undefined }),
      });
      const json = await res.json() as { questions?: ExamQuestion[]; error?: string; required?: number; balance?: number };
      if (json.error === 'INSUFFICIENT_CON') {
        setConModal({ required: json.required ?? 0, balance: json.balance ?? 0 });
        return;
      }
      if (!res.ok) throw new Error(json.error || '오류가 발생했습니다.');
      setOriginalPassageText(textToSend.trim());
      setQuestions(json.questions ?? []);

      const typesArr = [...selectedTypes];
      const titleSnapshot = pdfTitle;
      const passageSnapshot = textToSend.trim();
      setTimeout(() => autoSaveExam(json.questions ?? [], passageSnapshot, typesArr, titleSnapshot, passageSnapshot, difficulty), 800);
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
      const blob = await generateQuestionPdfBlob(questions, pdfTitle.trim(), originalPassageText);
      if (blob) triggerDownload(blob, `${pdfTitle.trim() || '수능형문제'}_문제.pdf`);
    } finally {
      setPdfLoading(false);
    }
  };

  const handleDownloadAnswer = async () => {
    if (!questions) return;
    setPdfLoading('답안');
    try {
      const blob = await buildAnswerPdfBlob(questions, pdfTitle.trim());
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
      const base = item.title || '실전변형문제';
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
      const res = await fetch('/api/delete-exam-history', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
        body: JSON.stringify({ ids: [...selectedIds] }),
      });
      const json = await res.json() as { success?: boolean; error?: string };
      if (res.ok && json.success) {
        setSelectedIds(new Set());
        await fetchHistory();
      } else {
        alert(json.error || '삭제 실패');
      }
    } finally {
      setBulkDeleting(false);
    }
  };

  const filteredHistory = historyList.filter(item => {
    if (searchQuery && !item.passage_full?.includes(searchQuery) && !item.title?.includes(searchQuery)) return false;
    return true;
  });

  // ── 렌더링 ──
  return (
    <div className="min-h-screen bg-gray-50">
      {/* 헤더 */}
      <div className="mb-6">
        <h1 className="text-2xl font-black text-gray-900">🎯 실전 변형 문제</h1>
        <p className="text-sm text-gray-500 mt-1">수능/모의고사형 변형 문제를 AI로 즉시 생성합니다.</p>
      </div>

      {/* 탭 */}
      <div className="flex gap-2 mb-6 border-b-2 border-slate-100">
        {(['generate', 'history'] as const).map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className={`px-6 py-3 font-black text-base rounded-t-xl transition-all
              ${activeTab === tab ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-600'}`}>
            {tab === 'generate' ? '✏️ 문제 생성' : '📋 생성 이력'}
          </button>
        ))}
      </div>

      {/* ── 문제 생성 탭 ── */}
      {activeTab === 'generate' && (
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

          {/* 지문 입력 */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-black text-gray-800">📄 지문 입력</h2>
              <div className="flex gap-2">
                {(['text', 'image'] as const).map(mode => (
                  <button key={mode} onClick={() => setInputMode(mode)}
                    className={`px-4 py-2 rounded-xl text-sm font-bold transition-all
                      ${inputMode === mode ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>
                    {mode === 'text' ? '📝 직접 입력' : '📷 사진 등록'}
                  </button>
                ))}
              </div>
            </div>

            {inputMode === 'text' ? (
              <textarea
                value={manualText}
                onChange={e => setManualText(e.target.value)}
                placeholder="영어 지문을 여기에 입력하세요..."
                rows={8}
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm font-medium text-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-300 resize-none leading-relaxed"
              />
            ) : (
              <div className="space-y-4">
                <div
                  onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all
                    ${isDragging ? 'border-indigo-400 bg-indigo-50' : 'border-gray-200 hover:border-indigo-300 hover:bg-gray-50'}`}
                >
                  {imagePreview ? (
                    <img src={imagePreview} alt="preview" className="max-h-48 mx-auto rounded-lg object-contain" />
                  ) : (
                    <div className="text-gray-400">
                      <div className="text-4xl mb-2">📷</div>
                      <p className="font-bold text-sm">클릭하거나 이미지를 드래그하세요</p>
                      <p className="text-xs mt-1">JPG, PNG, GIF, WebP (최대 10MB)</p>
                    </div>
                  )}
                </div>
                <input ref={fileInputRef} type="file" accept="image/*" className="hidden"
                  onChange={e => { const f = e.target.files?.[0]; if (f) handleImageFile(f); }} />

                {imageFile && !ocrDone && (
                  <button onClick={runOcr} disabled={ocrLoading}
                    className="w-full py-3 rounded-xl font-black text-sm bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 transition-all">
                    {ocrLoading ? '🔍 텍스트 추출 중...' : '🔍 텍스트 추출 (OCR)'}
                  </button>
                )}

                {ocrDone && ocrText && (
                  <div className="space-y-2">
                    <p className="text-xs font-black text-green-600">✅ 텍스트 추출 완료</p>
                    <textarea
                      value={ocrText}
                      onChange={e => setOcrText(e.target.value)}
                      rows={6}
                      className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm font-medium text-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-300 resize-none"
                    />
                  </div>
                )}
              </div>
            )}

            <p className="mt-2 text-xs text-gray-400">
              {textToSend.length > 0 ? `${textToSend.length}자 입력됨` : '지문을 입력하세요 (최소 50자)'}
            </p>
          </div>

          {/* 난이도 선택 */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <h2 className="text-base font-black text-gray-800 mb-4">📊 난이도 설정</h2>
            <div className="flex gap-2">
              {([
                { key: 'b1', label: '중등/고등 하', sub: 'B1', icon: '🌱', active: 'border-sky-400 bg-sky-50 text-sky-700' },
                { key: 'b2', label: '고등 중',      sub: 'B2', icon: '🌳', active: 'border-emerald-500 bg-emerald-50 text-emerald-700' },
                { key: 'c1', label: '고등 상',      sub: 'C1', icon: '🔥', active: 'border-orange-500 bg-orange-50 text-orange-700' },
                { key: 'c2', label: '고등 최상',    sub: 'C2', icon: '⚡', active: 'border-rose-500 bg-rose-50 text-rose-700' },
              ] as const).map(d => (
                <button key={d.key} onClick={() => setDifficulty(d.key)}
                  className={`flex-1 py-4 rounded-xl font-black transition-all border-2
                    ${difficulty === d.key
                      ? d.active
                      : 'border-gray-200 bg-white text-gray-400 hover:border-gray-300 hover:text-gray-600'}`}>
                  <div className="text-2xl mb-1">{d.icon}</div>
                  <div className="text-xs font-bold opacity-60 mb-0.5">{d.sub}</div>
                  <div className="text-sm">{d.label}</div>
                </button>
              ))}
            </div>
          </div>

          {/* 문제 유형 선택 */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <h2 className="text-base font-black text-gray-800 mb-4">📌 문제 유형 선택 <span className="text-xs font-bold text-gray-400 ml-1">(복수 선택 가능)</span></h2>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {QUESTION_TYPE_OPTIONS.map(opt => {
                const isSelected = selectedTypes.has(opt.key);
                return (
                  <button key={opt.key} onClick={() => toggleType(opt.key)}
                    className={`flex flex-col items-start p-4 rounded-xl border-2 transition-all text-left
                      ${isSelected ? 'border-indigo-500 bg-indigo-50' : 'border-gray-200 bg-white hover:border-indigo-300 hover:bg-gray-50'}`}>
                    <div className="flex items-center gap-2 mb-1">
                      <div className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0
                        ${isSelected ? 'border-indigo-500 bg-indigo-500' : 'border-gray-300'}`}>
                        {isSelected && <span className="text-white text-[10px] font-black">✓</span>}
                      </div>
                      <span className="text-sm font-black text-gray-800">{opt.label}</span>
                    </div>
                    <p className="text-xs text-gray-500 ml-6">{opt.description}</p>
                  </button>
                );
              })}
            </div>
            <p className="mt-3 text-xs text-gray-400">선택된 유형: {selectedTypes.size}개 ({[...selectedTypes].map(k => TYPE_LABEL_MAP[k]).join(', ')})</p>
          </div>

          {/* CON 차감 안내 */}
          {aiPrice !== null && aiPrice > 0 && (
            <div className="flex items-center gap-2 px-4 py-2.5 bg-yellow-50 border border-yellow-200 rounded-2xl">
              <span className="text-sm">⭐</span>
              <span className="text-xs font-black text-yellow-700">1세트 생성 시 {aiPrice} CON 차감됩니다</span>
            </div>
          )}

          {/* 생성 버튼 */}
          <button
            onClick={handleGenerate}
            disabled={loading || textToSend.trim().length < 50 || selectedTypes.size === 0}
            className="w-full py-4 rounded-2xl font-black text-base bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-sm"
          >
            {loading ? loadingMsg : '🤖 AI 문제 생성하기'}
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
                  const answerDisplay = (q.type === 'grammar' || q.type === 'vocab_paraphrase' || q.type === 'flow') ? CIRCLE_NUMS[q.answer - 1] : `${q.answer}번`;
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

                      {/* 문제 지시문 (아래 유형은 위에서 이미 처리) */}
                      {q.type !== 'vocab_paraphrase' && q.type !== 'summary' && q.type !== 'vocab_blank' && q.type !== 'topic_title' && q.type !== 'grammar' && q.type !== 'fill_blank' && q.type !== 'flow' && q.type !== 'phrase_meaning' && (
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
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── 생성 이력 탭 ── */}
      {activeTab === 'history' && (
        <div className="space-y-4">
          {/* 검색 필터 */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 flex flex-wrap gap-3">
            <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && fetchHistory(searchQuery, searchDate)}
              placeholder="키워드 검색..." className="border border-gray-200 rounded-xl px-3 py-2 text-sm font-bold text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-300 flex-1 min-w-32" />
            <input type="date" value={searchDate} onChange={e => setSearchDate(e.target.value)}
              className="border border-gray-200 rounded-xl px-3 py-2 text-sm font-bold text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-300" />
            <button onClick={() => fetchHistory(searchQuery, searchDate)}
              className="px-4 py-2 bg-indigo-600 text-white text-sm font-black rounded-xl hover:bg-indigo-700 transition-all">
              🔍 검색
            </button>
            <button onClick={() => { setSearchQuery(''); setSearchDate(''); fetchHistory('', ''); }}
              className="px-4 py-2 bg-gray-100 text-gray-600 text-sm font-black rounded-xl hover:bg-gray-200 transition-all">
              초기화
            </button>
          </div>

          {/* 일괄 작업 버튼 */}
          {selectedIds.size > 0 && (
            <div className="flex gap-3 items-center bg-indigo-50 border border-indigo-200 rounded-xl px-4 py-3">
              <span className="text-sm font-black text-indigo-700">{selectedIds.size}개 선택됨</span>
              <button onClick={downloadSelected} disabled={bulkDownloading}
                className="px-4 py-2 bg-indigo-600 text-white text-sm font-black rounded-xl hover:bg-indigo-700 disabled:opacity-50 transition-all">
                {bulkDownloading ? '⏳ 다운로드 중...' : '⬇️ 일괄 다운로드'}
              </button>
              <button onClick={deleteSelected} disabled={bulkDeleting}
                className="px-4 py-2 bg-red-500 text-white text-sm font-black rounded-xl hover:bg-red-600 disabled:opacity-50 transition-all">
                {bulkDeleting ? '⏳ 삭제 중...' : '🗑️ 일괄 삭제'}
              </button>
              <button onClick={() => setSelectedIds(new Set())}
                className="px-3 py-2 bg-gray-100 text-gray-600 text-sm font-black rounded-xl hover:bg-gray-200 transition-all ml-auto">
                선택 해제
              </button>
            </div>
          )}

          {/* 이력 목록 */}
          {historyLoading ? (
            <div className="text-center py-12 text-gray-400 font-bold">불러오는 중...</div>
          ) : historyError ? (
            <div className="text-center py-12 text-red-500 font-bold">{historyError}</div>
          ) : filteredHistory.length === 0 ? (
            <div className="text-center py-16 text-gray-400">
              <div className="text-5xl mb-3">📭</div>
              <p className="font-black text-lg">생성 이력이 없습니다.</p>
              <p className="text-sm mt-1">문제를 생성하면 자동으로 저장됩니다.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {/* 전체 선택 */}
              <div className="flex items-center gap-2 px-2">
                <input type="checkbox"
                  checked={selectedIds.size === filteredHistory.length && filteredHistory.length > 0}
                  onChange={e => {
                    if (e.target.checked) setSelectedIds(new Set(filteredHistory.map(i => i.id)));
                    else setSelectedIds(new Set());
                  }}
                  className="w-4 h-4 rounded accent-indigo-600" />
                <span className="text-sm font-bold text-gray-500">전체 선택 ({filteredHistory.length}개)</span>
              </div>

              {filteredHistory.map(item => {
                const date = new Date(item.created_at).toLocaleString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
                return (
                  <div key={item.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                    <div className="flex items-start gap-3">
                      <input type="checkbox" checked={selectedIds.has(item.id)}
                        onChange={e => {
                          setSelectedIds(prev => {
                            const next = new Set(prev);
                            if (e.target.checked) next.add(item.id); else next.delete(item.id);
                            return next;
                          });
                        }}
                        className="w-4 h-4 mt-1 rounded accent-indigo-600 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        {/* 날짜 + 제목 + 난이도 */}
                        <div className="flex items-center gap-2 flex-wrap mb-2">
                          <span className="text-xs font-bold text-gray-400">{date}</span>
                          {item.difficulty && (() => {
                            const diffMap: Record<string, { label: string; cls: string }> = {
                              b1: { label: '중등',    cls: 'bg-sky-50 text-sky-700 border-sky-300' },
                              b2: { label: '고등 중', cls: 'bg-emerald-50 text-emerald-700 border-emerald-300' },
                              c1: { label: '고등 중상', cls: 'bg-orange-50 text-orange-700 border-orange-300' },
                              c2: { label: '고등 최상', cls: 'bg-rose-50 text-rose-700 border-rose-300' },
                            };
                            const d = diffMap[item.difficulty] ?? { label: item.difficulty, cls: 'bg-gray-50 text-gray-600 border-gray-200' };
                            return <span className={`text-xs font-black px-2 py-0.5 rounded-full border ${d.cls}`}>{d.label}</span>;
                          })()}
                          {item.title && <span className="text-sm font-black text-gray-800">{item.title}</span>}
                        </div>
                        {/* 유형 태그 */}
                        <div className="flex flex-wrap gap-1.5 mb-2">
                          {(item.question_types || []).map(type => {
                            const opt = QUESTION_TYPE_OPTIONS.find(o => o.key === type);
                            return (
                              <span key={type} className={`text-xs font-bold px-2 py-0.5 rounded-full border ${opt?.color ?? 'bg-gray-100 text-gray-600 border-gray-200'}`}>
                                {opt?.label ?? type}
                              </span>
                            );
                          })}
                        </div>
                        {/* 지문 요약 */}
                        <p className="text-xs text-gray-500 line-clamp-2 mb-3">
                          {item.passage_excerpt}
                          <button onClick={() => setPassageModal(item)}
                            className="ml-1 text-indigo-500 hover:text-indigo-700 font-bold">
                            [전체 보기]
                          </button>
                        </p>
                        {/* 다운로드 버튼 */}
                        <div className="flex gap-2">
                          {item.question_pdf_path && (
                            <button onClick={() => downloadFromHistory(item.question_pdf_path, `${item.title || '문제'}_문제.pdf`)}
                              className="text-xs font-black text-indigo-600 border border-indigo-200 px-3 py-1.5 rounded-lg hover:bg-indigo-50 transition-all">
                              ⬇️ 문제
                            </button>
                          )}
                          {item.answer_pdf_path && (
                            <button onClick={() => downloadFromHistory(item.answer_pdf_path!, `${item.title || '문제'}_답안해설.pdf`)}
                              className="text-xs font-black text-slate-600 border border-slate-200 px-3 py-1.5 rounded-lg hover:bg-slate-50 transition-all">
                              ⬇️ 답안/해설
                            </button>
                          )}
                        </div>
                      </div>
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
              <h3 className="text-base font-black text-gray-900">원문 지문</h3>
              <button onClick={() => setPassageModal(null)} className="text-gray-400 hover:text-gray-600 font-black text-xl">✕</button>
            </div>
            <div className="p-6 overflow-y-auto max-h-[60vh]">
              <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{passageModal.passage_full}</p>
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

      {/* 고정 다운로드 버튼 */}
      {questions && questions.length > 0 && (
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
    </div>
  );
}
