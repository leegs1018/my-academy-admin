'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import Image from 'next/image';
import { supabase } from '@/lib/supabase';

interface TFQuestion {
  number: number;
  statement: string;
  answer: 'T' | 'F';
  explanation?: string;
}

interface VocabRow {
  word: string; meaning: string;
  syn1: string; syn1_m: string;
  syn2: string; syn2_m: string;
  syn3: string; syn3_m: string;
  antonym: string; antonym_m: string;
}

interface KoreanSummary {
  type: '일반' | '논쟁' | '문제';
  rows: { label: string; content: string }[];
}

interface GeneratedMaterials {
  paraphrased_passage?: string;
  tf_questions: TFQuestion[];
  answer_key: string;
  korean_summary: KoreanSummary;
  english_titles: string[];
  one_sentence_summaries: { english: string; korean: string }[];
  vocabulary_table: VocabRow[];
}

interface PdfHistoryItem {
  id: string;
  created_at: string;
  title?: string;
  passage_excerpt: string;
  passage_full: string;
  passage_type: string;
  difficulty: string;
  pdf_path: string;
  answer_pdf_path?: string;
}


// ── 클라이언트 사이드 PDF 생성 (Puppeteer 불필요) ──
async function generatePdfBlob(hideAnswerArea = false): Promise<Blob | null> {
  const page1El = document.getElementById('pdf-page-1');
  const page2El = document.getElementById('pdf-page-2');
  if (!page1El || !page2El) return null;

  const noPrintEls = document.querySelectorAll('#print-area .no-print');
  noPrintEls.forEach(el => (el as HTMLElement).style.setProperty('display', 'none', 'important'));
  const answerAreaEls = hideAnswerArea ? document.querySelectorAll('.pdf-answer-area') : null;
  answerAreaEls?.forEach(el => (el as HTMLElement).style.setProperty('display', 'none', 'important'));

  try {
    const { toJpeg } = await import('html-to-image');
    const { jsPDF } = await import('jspdf');

    const W = 210, M = 5, cW = W - 2 * M;

    const p1Ratio = page1El.offsetHeight / page1El.offsetWidth;
    const p2Ratio = page2El.offsetHeight / page2El.offsetWidth;

    const opts = { pixelRatio: 2, quality: 0.9, backgroundColor: '#ffffff', cacheBust: true };
    const [url1, url2] = await Promise.all([
      toJpeg(page1El, opts),
      toJpeg(page2El, opts),
    ]);

    const pdf = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });
    pdf.addImage(url1, 'JPEG', M, M, cW, cW * p1Ratio);
    pdf.addPage();
    pdf.addImage(url2, 'JPEG', M, M, cW, cW * p2Ratio);

    return pdf.output('blob');
  } finally {
    noPrintEls.forEach(el => (el as HTMLElement).style.removeProperty('display'));
    answerAreaEls?.forEach(el => (el as HTMLElement).style.removeProperty('display'));
  }
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

async function buildAnswerPdfBlob(result: GeneratedMaterials, title: string): Promise<Blob> {
  const { toJpeg } = await import('html-to-image');
  const { jsPDF } = await import('jspdf');

  const el = document.createElement('div');
  el.style.cssText = 'position:fixed;top:0;left:0;width:800px;background:white;padding:40px;box-sizing:border-box;font-family:Arial,Helvetica,sans-serif;z-index:-9999;';

  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  let html = '';
  if (title) html += `<h1 style="font-size:22px;font-weight:900;color:#1e293b;margin:0 0 24px;">${esc(title)}</h1>`;
  html += `<div style="margin-bottom:24px;"><h2 style="font-size:16px;font-weight:900;color:#7c3aed;margin:0 0 8px;">T/F 정답</h2>`;
  html += `<p style="font-size:15px;font-weight:700;color:#334155;letter-spacing:0.05em;margin:0;">${esc(result.answer_key)}</p></div>`;
  if (result.tf_questions.some(q => q.explanation)) {
    html += `<div><h2 style="font-size:16px;font-weight:900;color:#7c3aed;margin:0 0 12px;">해설</h2><div style="display:flex;flex-direction:column;gap:10px;">`;
    for (const q of result.tf_questions) {
      if (!q.explanation) continue;
      html += `<div style="display:flex;gap:12px;"><span style="font-weight:900;color:#7c3aed;min-width:52px;flex-shrink:0;font-size:14px;">${q.number}. ${q.answer}</span><p style="font-weight:700;color:#475569;line-height:1.6;font-size:14px;flex:1;margin:0;">${esc(q.explanation)}</p></div>`;
    }
    html += `</div></div>`;
  }
  el.innerHTML = html;
  document.body.appendChild(el);

  await new Promise(r => requestAnimationFrame(r));
  await new Promise(r => requestAnimationFrame(r));

  try {
    const W = 210, M = 5, cW = W - 2 * M;
    const ratio = el.offsetHeight / el.offsetWidth;
    const url = await toJpeg(el, { pixelRatio: 2, quality: 0.9, backgroundColor: '#ffffff', cacheBust: true });
    const pdf = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });
    pdf.addImage(url, 'JPEG', M, M, cW, cW * ratio);
    return pdf.output('blob');
  } finally {
    if (document.body.contains(el)) document.body.removeChild(el);
  }
}

function renderBold(text: string) {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith('**') && part.endsWith('**')
      ? <strong key={i} className="font-black text-indigo-700">{part.slice(2, -2)}</strong>
      : <span key={i}>{part}</span>
  );
}

function cleanKorean(s: string) {
  return s.replace(/^\(\(|\)\)$/g, '').replace(/\*\*/g, '*').trim();
}

function parseTitleKorean(title: string): { english: string; korean: string } {
  const match = title.match(/^(.*?)\s*\(([^)]+)\)\s*$/);
  if (match) return { english: match[1].trim(), korean: match[2].trim() };
  return { english: title, korean: '' };
}

function renderSingleBold(text: string) {
  return text.split(/(\*[^*]+\*)/g).map((part, i) =>
    part.startsWith('*') && part.endsWith('*') && part.length > 2
      ? <em key={i} className="not-italic font-black text-rose-600">{part.slice(1, -1)}</em>
      : <span key={i}>{part}</span>
  );
}

const TYPE_COLORS: Record<string, string> = {
  '일반': 'bg-indigo-100 text-indigo-700',
  '논쟁': 'bg-amber-100 text-amber-700',
  '문제': 'bg-rose-100 text-rose-700',
};
const DIFF_COLORS: Record<string, string> = {
  'b1': 'bg-sky-100 text-sky-700',
  'b2': 'bg-emerald-100 text-emerald-700',
  'c1': 'bg-orange-100 text-orange-700',
  'c2': 'bg-rose-100 text-rose-700',
  '하': 'bg-green-100 text-green-700',
  '중': 'bg-yellow-100 text-yellow-700',
  '상': 'bg-red-100 text-red-700',
};

export default function PdfEditorPage() {
  const [activeTab, setActiveTab] = useState<'generate' | 'history'>('generate');
  const [inputMode, setInputMode] = useState<'text' | 'image'>('text');

  const [manualText, setManualText] = useState('');

  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [ocrText, setOcrText] = useState('');
  const [ocrLoading, setOcrLoading] = useState(false);
  const [ocrDone, setOcrDone] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const [difficulty, setDifficulty] = useState<'b1' | 'b2' | 'c1' | 'c2'>('b2');
  const [loading, setLoading] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState('');
  const [result, setResult] = useState<GeneratedMaterials | null>(null);
  const [originalPassageText, setOriginalPassageText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [showAnswerKey, setShowAnswerKey] = useState(false);
  const [copiedSection, setCopiedSection] = useState<string | null>(null);
  const [pdfTitle, setPdfTitle] = useState('');
  const [pdfLoading, setPdfLoading] = useState<false | '문제' | '답안'>(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'done' | 'error'>('idle');
  const [saveErrorMsg, setSaveErrorMsg] = useState('');
  const msgIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const [editMode, setEditMode] = useState(false);
  const [editedResult, setEditedResult] = useState<GeneratedMaterials | null>(null);
  const [editSaveStatus, setEditSaveStatus] = useState<'idle' | 'saving' | 'done' | 'error'>('idle');

  const [logoDataUrl, setLogoDataUrl] = useState<string | null>(null);

  const [historyList, setHistoryList] = useState<PdfHistoryItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchDate, setSearchDate] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkDownloading, setBulkDownloading] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [passageModal, setPassageModal] = useState<PdfHistoryItem | null>(null);
  const [pdfAnalysisPrice, setPdfAnalysisPrice] = useState<number | null>(null);
  const [printTheme, setPrintTheme] = useState<'color' | 'mono'>('mono');

  // ── 지문분석 CON 단가 로드 ──
  useEffect(() => {
    fetch('/api/credits/pricing')
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        const item = (data?.pricing ?? []).find((p: { feature_key: string; cost_per_use: number }) => p.feature_key === 'pdf_analysis');
        if (item) setPdfAnalysisPrice(item.cost_per_use);
      })
      .catch(() => {});
  }, []);

  // ── 로고 로드 ──
  useEffect(() => {
    const loadLogo = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        const { data } = await supabase
          .from('academy_config')
          .select('logo_url')
          .eq('user_id', user.id)
          .single();
        if (!data?.logo_url) return;
        const { data: signed } = await supabase.storage
          .from('academy-logos')
          .createSignedUrl(data.logo_url, 3600);
        if (!signed?.signedUrl) return;
        const res = await fetch(signed.signedUrl);
        const blob = await res.blob();
        const reader = new FileReader();
        reader.onloadend = () => setLogoDataUrl(reader.result as string);
        reader.readAsDataURL(blob);
      } catch { /* non-critical */ }
    };
    loadLogo();
  }, []);

  // ── 이력 조회 ──
  const fetchHistory = useCallback(async (query = searchQuery, date = searchDate) => {
    setHistoryLoading(true);
    setHistoryError(null);
    try {
      await fetch('/api/cleanup-old-history', { method: 'POST' });
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setHistoryError('로그인 정보를 확인할 수 없습니다.'); return; }

      let q = supabase
        .from('pdf_history')
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

  // ── 자동 저장 (클라이언트 PDF → 서버 저장) ──
  const autoSavePdf = useCallback(async (generated: GeneratedMaterials, text: string, diff: string, titleSnapshot: string) => {
    setSaveStatus('saving');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { setSaveStatus('error'); setSaveErrorMsg('로그인 세션 없음'); return; }

      const [pdfBlob, answerBlob] = await Promise.all([
        generatePdfBlob(true),
        buildAnswerPdfBlob(generated, pdfTitle.trim()),
      ]);
      if (!pdfBlob) { setSaveStatus('error'); setSaveErrorMsg('PDF 요소를 찾을 수 없음'); return; }

      const toBase64 = (blob: Blob) => new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });

      const [pdfBase64, answerPdfBase64] = await Promise.all([
        toBase64(pdfBlob),
        toBase64(answerBlob),
      ]);

      const res = await fetch('/api/save-pdf-history', {
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
          passageType: generated.korean_summary.type,
          difficulty: diff,
        }),
      });
      const json = await res.json() as { success?: boolean; error?: string };
      if (res.ok && json.success) {
        setSaveStatus('done');
      } else {
        setSaveStatus('error');
        setSaveErrorMsg(json.error || '알 수 없는 오류');
      }
    } catch (e) {
      setSaveStatus('error');
      setSaveErrorMsg(e instanceof Error ? e.message : '네트워크 오류');
    }
  }, []);

  // ── 이력에서 단건 다운로드 ──
  const downloadFromHistory = async (pdfPath: string, filename: string) => {
    const { data } = await supabase.storage.from('pdf-history').createSignedUrl(pdfPath, 3600);
    if (!data?.signedUrl) return;
    const a = document.createElement('a');
    a.href = data.signedUrl;
    a.download = filename;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  // ── 선택 항목 일괄 다운로드 ──
  const downloadSelected = async () => {
    setBulkDownloading(true);
    const items = historyList.filter(i => selectedIds.has(i.id));
    for (const item of items) {
      const base = item.title || '영어문제';
      if (item.pdf_path) {
        await downloadFromHistory(item.pdf_path, `${base}_문제.pdf`);
        await new Promise(r => setTimeout(r, 600));
      }
      if (item.answer_pdf_path) {
        await downloadFromHistory(item.answer_pdf_path, `${base}_답안해설.pdf`);
        await new Promise(r => setTimeout(r, 600));
      }
    }
    setBulkDownloading(false);
  };

  // ── 선택 항목 삭제 ──
  const deleteSelected = async () => {
    if (selectedIds.size === 0) return;
    setBulkDeleting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { setBulkDeleting(false); alert('로그인이 필요합니다.'); return; }
      const res = await fetch('/api/delete-pdf-history', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ ids: [...selectedIds] }),
      });
      const json = await res.json() as { success?: boolean; error?: string };
      if (!res.ok || !json.success) {
        alert(`삭제 실패: ${json.error || '알 수 없는 오류'}`);
        return;
      }
      const deleted = new Set(selectedIds);
      setHistoryList(prev => prev.filter(i => !deleted.has(i.id)));
      setSelectedIds(new Set());
    } catch (e) {
      alert(`삭제 중 오류: ${e instanceof Error ? e.message : '알 수 없는 오류'}`);
    } finally {
      setBulkDeleting(false);
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === historyList.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(historyList.map(i => i.id)));
  };

  // ── 이미지 선택 ──
  const handleImageSelect = (file: File) => {
    if (!['image/jpeg', 'image/png', 'image/gif', 'image/webp'].includes(file.type)) {
      setError('JPG, PNG, GIF, WebP 형식만 지원합니다.'); return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setError('이미지 파일이 너무 큽니다. (최대 10MB)'); return;
    }
    if (imagePreview) URL.revokeObjectURL(imagePreview);
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
    setOcrText(''); setOcrDone(false); setError(null); setResult(null);
  };

  const handleDrop = useCallback((e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleImageSelect(file);
  }, []);

  // ── OCR ──
  const handleOCR = async () => {
    if (!imageFile) return;
    setOcrLoading(true); setError(null);
    try {
      const fd = new FormData();
      fd.append('image', imageFile);
      const res = await fetch('/api/ocr', { method: 'POST', body: fd });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'OCR 오류');
      setOcrText(json.text); setOcrDone(true);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'OCR 오류가 발생했습니다.');
    } finally {
      setOcrLoading(false);
    }
  };

  // ── 문제 생성 ──
  const textToSend = inputMode === 'text' ? manualText.trim() : ocrText.trim();
  const canGenerate = textToSend.length >= 50 && !loading;

  const handleGenerate = async () => {
    const currentText = (inputMode === 'text' ? manualText : ocrText).trim();
    if (currentText.length < 50 || loading) return;

    abortControllerRef.current?.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setLoading(true); setError(null); setResult(null); setShowAnswerKey(false);

    const msgs = ['AI가 지문을 읽고 있어요... 🤖', '문제를 생성하고 있어요... ✍️', '어휘 표를 만들고 있어요... 📚', '거의 완성됐어요! 잠시만요... ✨'];
    let idx = 0;
    setLoadingMsg(msgs[0]);
    msgIntervalRef.current = setInterval(() => { idx = (idx + 1) % msgs.length; setLoadingMsg(msgs[idx]); }, 8000);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      const res = await fetch('/api/process-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: currentText, difficulty, academy_id: user?.id }),
        signal: controller.signal,
      });
      const rawText = await res.text();
      let json: { data?: GeneratedMaterials; error?: string };
      try {
        json = JSON.parse(rawText);
      } catch {
        throw new Error('AI 응답을 처리할 수 없습니다. 다시 시도해주세요.');
      }
      if (!res.ok) throw new Error(json.error || '오류가 발생했습니다.');
      const generated = json.data as GeneratedMaterials;
      setOriginalPassageText(currentText);
      setResult(generated);
      setSaveStatus('idle');
      // DOM 렌더링 대기 후 자동 저장
      setTimeout(() => autoSavePdf(generated, currentText, difficulty, pdfTitle), 800);
    } catch (e: unknown) {
      if (e instanceof Error && e.name === 'AbortError') return;
      setError(e instanceof Error ? e.message : '오류가 발생했습니다.');
    } finally {
      if (msgIntervalRef.current) clearInterval(msgIntervalRef.current);
      setLoading(false);
    }
  };

  // ── 클립보드 ──
  const copy = async (text: string, id: string) => {
    try { await navigator.clipboard.writeText(text); } catch { /* ignore */ }
    setCopiedSection(id);
    setTimeout(() => setCopiedSection(null), 2000);
  };

  const buildTFText = () => result?.tf_questions.map(q => `${q.number}. ${q.statement}`).join('\n') ?? '';
  const buildOneSentenceText = () =>
    result?.one_sentence_summaries.map((s, i) => `${i + 1}. ${s.english.replace(/\*\*/g, '')}\n   (${s.korean})`).join('\n\n') ?? '';
  const buildVocabText = () =>
    result?.vocabulary_table.map(r => `${r.word} (${r.meaning}) | ${r.syn1} (${r.syn1_m}) | ${r.syn2} (${r.syn2_m}) | ${r.syn3} (${r.syn3_m}) | ${r.antonym} (${r.antonym_m})`).join('\n') ?? '';

  const baseName = pdfTitle.trim() || '영어문제';

  // ── 문제 PDF 다운로드 ──
  const handleDownloadProblemPDF = async () => {
    setPdfLoading('문제');
    const wasEditing = editMode;
    try {
      if (wasEditing) {
        setEditMode(false);
        await new Promise(r => requestAnimationFrame(r));
        await new Promise(r => requestAnimationFrame(r));
      }
      const blob = await generatePdfBlob(true);
      if (!blob) throw new Error('PDF 요소를 찾을 수 없습니다.');
      triggerDownload(blob, `${baseName}_문제.pdf`);
    } catch (e) {
      alert(`PDF 저장 실패: ${e instanceof Error ? e.message : '오류'}`);
    } finally {
      if (wasEditing) setEditMode(true);
      setPdfLoading(false);
    }
  };

  // ── 답안·해설 PDF 다운로드 ──
  const handleDownloadAnswerPDF = async () => {
    if (!result) return;
    setPdfLoading('답안');
    try {
      const blob = await buildAnswerPdfBlob(result, pdfTitle.trim());
      triggerDownload(blob, `${baseName}_답안해설.pdf`);
    } catch (e) {
      alert(`PDF 저장 실패: ${e instanceof Error ? e.message : '오류'}`);
    } finally {
      setPdfLoading(false);
    }
  };

  // ── 편집본 PDF 저장 ──
  const handleEditSave = async () => {
    if (!editedResult) return;
    setEditSaveStatus('saving');
    const wasEditing = editMode;
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { setEditSaveStatus('error'); return; }
      if (wasEditing) {
        setEditMode(false);
        await new Promise(r => requestAnimationFrame(r));
        await new Promise(r => requestAnimationFrame(r));
      }
      const [pdfBlob, answerBlob] = await Promise.all([
        generatePdfBlob(true),
        buildAnswerPdfBlob(editedResult, pdfTitle.trim()),
      ]);
      if (wasEditing) setEditMode(true);
      if (!pdfBlob) { setEditSaveStatus('error'); return; }
      const toBase64 = (blob: Blob) => new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
      const [pdfBase64, answerPdfBase64] = await Promise.all([toBase64(pdfBlob), toBase64(answerBlob)]);
      const res = await fetch('/api/save-pdf-history', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
        body: JSON.stringify({
          pdfBase64, answerPdfBase64,
          title: (pdfTitle.trim() ? '[편집본] ' + pdfTitle.trim() : '[편집본]'),
          passageExcerpt: originalPassageText.slice(0, 150),
          passageFull: originalPassageText,
          passageType: editedResult.korean_summary.type,
          difficulty,
        }),
      });
      const json = await res.json() as { success?: boolean };
      setEditSaveStatus(res.ok && json.success ? 'done' : 'error');
    } catch {
      if (wasEditing) setEditMode(true);
      setEditSaveStatus('error');
    }
  };

  return (
    <div className="pb-32">

      {(loading || ocrLoading) && (
        <div className="no-print fixed inset-0 bg-indigo-900/60 backdrop-blur-md z-[200] flex items-center justify-center">
          <div className="bg-white rounded-[2.5rem] p-12 text-center shadow-2xl max-w-sm mx-4">
            <div className="w-16 h-16 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-6" />
            <p className="font-black text-indigo-600 text-xl animate-pulse">
              {ocrLoading ? '이미지에서 텍스트를 추출하고 있어요... 🔍' : loadingMsg}
            </p>
            {loading && <p className="text-slate-400 font-bold text-sm mt-3">30~60초 정도 소요될 수 있어요</p>}
          </div>
        </div>
      )}

      <div className="no-print mb-6">
        <h1 className="text-4xl font-black text-slate-900 tracking-tighter">📝 지문분석 툴/워크북</h1>
        <p className="text-slate-500 font-bold mt-2">지문을 입력하거나 사진을 등록하면 AI가 6가지 교육 자료를 만들어드려요</p>
      </div>

      <div className="no-print flex gap-2 mb-6 border-b-2 border-slate-100">
        {(['generate', 'history'] as const).map((tab) => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className={`px-6 py-3 font-black text-base rounded-t-xl transition-all
              ${activeTab === tab ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-600'}`}>
            {tab === 'generate' ? '✏️ 문제 생성' : '📋 생성 이력'}
          </button>
        ))}
      </div>

      {/* ══ 문제 생성 탭 ══ */}
      {activeTab === 'generate' && (
        <>
          <div className="no-print bg-white p-8 rounded-[2.5rem] shadow-xl border border-slate-100 mb-8">
            <div className="mb-6">
              <label className="text-sm font-black text-slate-600 mb-2 block">제목 (PDF 파일명)</label>
              <input
                type="text"
                value={pdfTitle}
                onChange={(e) => setPdfTitle(e.target.value)}
                placeholder="예: 수능 2025 6월 모의고사"
                className="w-full px-5 py-3 border-2 border-slate-200 rounded-2xl font-bold text-slate-700 focus:outline-none focus:border-indigo-400 transition-colors placeholder:text-slate-300"
              />
            </div>
            <div className="flex gap-2 mb-6 bg-slate-100 p-1.5 rounded-2xl w-fit">
              {([['text', '✏️ 텍스트 직접 입력'], ['image', '📷 사진 등록']] as const).map(([mode, label]) => (
                <button key={mode} onClick={() => { setInputMode(mode); setError(null); }}
                  className={`px-6 py-3 rounded-xl font-black text-sm transition-all
                    ${inputMode === mode ? 'bg-white text-indigo-600 shadow-md' : 'text-slate-500 hover:text-slate-700'}`}>
                  {label}
                </button>
              ))}
            </div>

            {inputMode === 'text' && (
              <div>
                <p className="text-sm font-bold text-slate-500 mb-3">영어 지문을 복사(Ctrl+C)한 뒤 아래에 붙여넣기(Ctrl+V) 해주세요</p>
                <textarea
                  value={manualText}
                  onChange={(e) => { setManualText(e.target.value); setResult(null); abortControllerRef.current?.abort(); }}
                  placeholder="여기에 영어 지문을 붙여넣어 주세요..."
                  rows={12}
                  className="w-full p-5 border-2 border-slate-200 rounded-2xl font-mono text-sm text-slate-700 resize-y focus:outline-none focus:border-indigo-400 transition-colors placeholder:text-slate-300"
                />
                <p className="text-xs text-slate-400 font-bold mt-2 text-right">
                  {manualText.trim().length}자{manualText.trim().length > 0 && manualText.trim().length < 50 && ' (최소 50자 이상)'}
                </p>
              </div>
            )}

            {inputMode === 'image' && (
              <div className="space-y-5">
                <label
                  onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={handleDrop}
                  className={`block w-full border-4 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-all
                    ${isDragging ? 'border-indigo-500 bg-indigo-50' : imageFile ? 'border-emerald-300 bg-emerald-50/50' : 'border-indigo-200 hover:border-indigo-400 hover:bg-indigo-50/50'}`}
                >
                  <div className="text-5xl mb-3">{imageFile ? '🖼️' : '📷'}</div>
                  {imageFile ? (
                    <><p className="font-black text-emerald-700 text-lg">{imageFile.name}</p><p className="text-xs text-slate-400 mt-1">다른 사진으로 변경하려면 클릭하세요</p></>
                  ) : (
                    <><p className="font-black text-slate-600 text-lg">사진을 클릭하거나 드래그하여 등록</p><p className="text-sm text-slate-400 font-bold mt-2">JPG · PNG · WebP · GIF · 최대 10MB</p></>
                  )}
                  <input type="file" accept="image/*" className="hidden"
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) handleImageSelect(f); }} />
                </label>

                {imageFile && imagePreview && (
                  <div className="flex flex-col md:flex-row gap-5">
                    <div className="md:w-1/2 rounded-2xl overflow-hidden border-2 border-slate-100 bg-slate-50 flex items-center justify-center min-h-[200px]">
                      <Image src={imagePreview} alt="업로드된 이미지" width={600} height={400} className="max-h-80 object-contain w-full" unoptimized />
                    </div>
                    <div className="md:w-1/2 flex flex-col gap-3">
                      {!ocrDone ? (
                        <div className="flex-1 flex flex-col items-center justify-center p-8 bg-indigo-50 rounded-2xl border-2 border-dashed border-indigo-200">
                          <p className="font-black text-indigo-500 text-center mb-4">사진에서 영어 텍스트를<br />AI가 자동으로 추출해드려요</p>
                          <button onClick={handleOCR} disabled={ocrLoading}
                            className="bg-indigo-600 text-white px-8 py-3 rounded-2xl font-black hover:bg-indigo-700 active:scale-95 transition-all shadow-lg disabled:opacity-50">
                            🔍 텍스트 추출하기
                          </button>
                        </div>
                      ) : (
                        <div className="flex-1 flex flex-col gap-2">
                          <div className="flex items-center justify-between">
                            <p className="font-black text-emerald-600 text-sm">✅ 텍스트 추출 완료 — 수정 후 문제를 생성하세요</p>
                            <button onClick={() => { setOcrDone(false); setOcrText(''); }}
                              className="no-print text-xs font-black text-slate-400 hover:text-rose-500 transition-colors">다시 추출</button>
                          </div>
                          <textarea value={ocrText} onChange={(e) => setOcrText(e.target.value)} rows={10}
                            className="flex-1 w-full p-4 border-2 border-emerald-200 rounded-2xl font-mono text-sm text-slate-700 resize-y focus:outline-none focus:border-indigo-400 transition-colors bg-emerald-50/30" />
                          <p className="text-xs text-slate-400 font-bold text-right">{ocrText.trim().length}자</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {error && (
              <div className="mt-4 p-4 bg-rose-50 border border-rose-200 rounded-2xl">
                <p className="text-rose-600 font-black whitespace-pre-line">⚠️ {error}</p>
              </div>
            )}

            <div className="mt-6">
              <span className="font-black text-slate-700 text-lg block mb-3">난이도 선택:</span>
              <div className="flex gap-2">
                {([
                  { key: 'b1', level: 'B1', label: '중등/고등 하', icon: '🌱', active: 'border-sky-400 bg-sky-50 text-sky-700' },
                  { key: 'b2', level: 'B2', label: '고등 중',      icon: '🌳', active: 'border-emerald-500 bg-emerald-50 text-emerald-700' },
                  { key: 'c1', level: 'C1', label: '고등 상',      icon: '🔥', active: 'border-orange-500 bg-orange-50 text-orange-700' },
                  { key: 'c2', level: 'C2', label: '고등 최상',    icon: '⚡', active: 'border-rose-500 bg-rose-50 text-rose-700' },
                ] as const).map(d => (
                  <button key={d.key} onClick={() => setDifficulty(d.key)}
                    className={`flex-1 py-4 rounded-xl font-black transition-all border-2
                      ${difficulty === d.key ? d.active : 'border-gray-200 bg-white text-gray-400 hover:border-gray-300 hover:text-gray-600'}`}>
                    <div className="text-2xl mb-1">{d.icon}</div>
                    <div className="text-xs font-bold opacity-70 mb-0.5">{d.level}</div>
                    <div className="text-sm">{d.label}</div>
                  </button>
                ))}
              </div>
            </div>

            {pdfAnalysisPrice !== null && pdfAnalysisPrice > 0 && (
              <p className="mt-4 text-center text-sm font-bold text-slate-400">
                분석 1회당 <span className="text-yellow-500 font-black">{pdfAnalysisPrice} CON</span> 사용
              </p>
            )}
            <button onClick={handleGenerate} disabled={!canGenerate}
              className="mt-3 w-full bg-indigo-600 text-white py-5 rounded-2xl font-black text-xl shadow-xl hover:bg-indigo-700 active:scale-[0.98] transition-all disabled:opacity-40 disabled:cursor-not-allowed">
              AI로 문제 생성하기 🚀
            </button>
          </div>

          {/* ── 결과 영역 ── */}
          {result && (
            <>
            <div id="print-area" className="space-y-0">
              {(() => {
                const d = editedResult ?? result;
                return (
                  <>
              {/* ── 1페이지: 00 원문 + 01 변형지문 + 02 T/F 문제 ── */}
              <div id="pdf-page-1" className="space-y-3 mb-4">

                {/* 제목 */}
                {pdfTitle.trim() && (
                  <div className="mb-3 pb-2 border-b-2 border-slate-200">
                    <h1 className="text-2xl font-black text-slate-900">{pdfTitle.trim()}</h1>
                  </div>
                )}

                {/* 00 원문 */}
                <div className="bg-white rounded-2xl border border-slate-100 shadow-lg overflow-hidden">
                  <div className="bg-slate-700 px-5 py-2.5 flex items-center gap-3">
                    <span className="font-black text-2xl leading-none text-white/70">00</span>
                    <div>
                      <h2 className="font-black text-lg leading-tight text-white">원문 지문</h2>
                    </div>
                  </div>
                  <div className="p-4">
                    <p className="text-slate-700 font-bold leading-relaxed whitespace-pre-wrap text-xl">{originalPassageText}</p>
                  </div>
                </div>

                {/* 01 변형 지문 */}
                <SectionCard number="01" title="변형 지문"
                  color="bg-teal-600" theme={printTheme}
                  onCopy={() => copy(d.paraphrased_passage ?? '', 'paraphrase')}
                  copied={copiedSection === 'paraphrase'}>
                  {editMode ? (
                    <textarea
                      className="w-full p-3 border-2 border-teal-200 rounded-xl font-bold text-slate-700 text-base leading-relaxed resize-y focus:outline-none focus:border-teal-400 min-h-[120px]"
                      value={editedResult?.paraphrased_passage ?? ''}
                      onChange={(e) => setEditedResult(prev => prev ? { ...prev, paraphrased_passage: e.target.value } : prev)}
                    />
                  ) : (
                    <p className="text-slate-700 font-bold leading-relaxed whitespace-pre-wrap text-xl">{d.paraphrased_passage}</p>
                  )}
                </SectionCard>

                {/* 02 T/F 문제 */}
                <SectionCard number="02" title="T/F 문제 10개"
                  color="bg-violet-500" theme={printTheme} onCopy={() => copy(d.tf_questions.map(q => `${q.number}. ${q.statement}`).join('\n'), 'tf')} copied={copiedSection === 'tf'}>
                  <div className="space-y-1 mb-2">
                    {d.tf_questions.map((q) => (
                      <div key={q.number} className={`flex items-start gap-2 px-2 py-1 rounded-lg transition-colors ${printTheme === 'color' ? 'hover:bg-violet-50' : ''}`}>
                        <span className={`font-black w-7 shrink-0 text-lg ${printTheme === 'color' ? 'text-violet-600' : 'text-slate-600'}`}>{q.number}.</span>
                        {editMode ? (
                          <textarea
                            className="flex-1 border border-slate-200 rounded p-1 font-bold text-slate-700 text-xl resize-none focus:outline-none focus:border-slate-400 min-h-[36px]"
                            value={q.statement}
                            onChange={(e) => setEditedResult(prev => {
                              if (!prev) return prev;
                              const tf = [...prev.tf_questions];
                              tf[q.number - 1] = { ...tf[q.number - 1], statement: e.target.value };
                              return { ...prev, tf_questions: tf };
                            })}
                          />
                        ) : (
                          <p className="text-slate-700 font-bold leading-relaxed flex-1 text-2xl">{q.statement}</p>
                        )}
                      </div>
                    ))}
                  </div>
                  <div className={`pdf-answer-area border-t pt-3 ${printTheme === 'color' ? 'border-violet-100' : 'border-slate-200'}`}>
                    <button onClick={() => setShowAnswerKey(!showAnswerKey)}
                      className={`no-print flex items-center gap-2 font-black hover:transition-colors text-sm ${printTheme === 'color' ? 'text-violet-600 hover:text-violet-800' : 'text-slate-600 hover:text-slate-800'}`}>
                      <span className={`transition-transform ${showAnswerKey ? 'rotate-90' : ''}`}>▶</span>
                      해설지 {showAnswerKey ? '닫기' : '보기'}
                    </button>
                    {showAnswerKey && (
                      <div className="mt-3 space-y-3">
                        <div className={`p-3 rounded-2xl border ${printTheme === 'color' ? 'bg-violet-50 border-violet-100' : 'bg-white border-slate-200'}`}>
                          <div className="flex justify-between mb-2">
                            <span className={`font-black text-sm ${printTheme === 'color' ? 'text-violet-700' : 'text-slate-700'}`}>정답</span>
                            <button onClick={() => copy(d.answer_key, 'answer_key')}
                              className={`no-print text-xs font-black ${printTheme === 'color' ? 'text-violet-500 hover:text-violet-700' : 'text-slate-500 hover:text-slate-700'}`}>
                              {copiedSection === 'answer_key' ? '✅ 복사됨' : '📋 복사'}
                            </button>
                          </div>
                          <p className="font-black text-slate-700 tracking-wide text-sm">{d.answer_key}</p>
                        </div>
                        {d.tf_questions.some(q => q.explanation) && (
                          <div className={`p-3 rounded-2xl border ${printTheme === 'color' ? 'bg-violet-50 border-violet-100' : 'bg-white border-slate-200'}`}>
                            <span className={`font-black block mb-2 text-sm ${printTheme === 'color' ? 'text-violet-700' : 'text-slate-700'}`}>해설</span>
                            <div className="space-y-2">
                              {d.tf_questions.map(q => q.explanation && (
                                <div key={q.number} className="flex gap-2 text-sm">
                                  <span className={`font-black shrink-0 w-12 ${printTheme === 'color' ? 'text-violet-600' : 'text-slate-600'}`}>{q.number}. {q.answer}</span>
                                  <p className="text-slate-600 font-bold leading-relaxed flex-1 min-w-0">{q.explanation}</p>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </SectionCard>

              </div>

              {/* ── 2페이지: 03 한글요약 + 04 영어제목 + 05 1문장요약 + 06 어휘 + 로고 ── */}
              <div id="pdf-page-2" className="space-y-3">

                {/* 03 한글 요약 */}
                <SectionCard number="03" title="한글 요약"
                  color="bg-indigo-500" theme={printTheme}
                  onCopy={() => copy(d.korean_summary.rows.map(r => `[${r.label}] ${r.content}`).join('\n'), 'korean')}
                  copied={copiedSection === 'korean'}>
                  <div>
                    <span className={`inline-block mb-3 text-base font-black px-3 py-1 rounded-full ${printTheme === 'color' ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-700'}`}>
                      {d.korean_summary.type === '일반' ? '일반 지문' : d.korean_summary.type === '논쟁' ? '논쟁 지문' : '문제 지문'}
                    </span>
                    <table className="w-full border-collapse">
                      <tbody>
                        {d.korean_summary.rows.map((row, i) => (
                          <tr key={i} className={printTheme === 'color' && i % 2 === 0 ? 'bg-indigo-50' : 'bg-white'}>
                            <td className={`w-28 p-2.5 font-black text-base border whitespace-nowrap align-top ${printTheme === 'color' ? 'text-indigo-700 border-indigo-100' : 'text-slate-700 border-slate-200'}`}>{row.label}</td>
                            <td className={`p-2.5 border ${printTheme === 'color' ? 'border-indigo-100' : 'border-slate-200'}`}>
                              {editMode ? (
                                <textarea
                                  className="w-full border border-indigo-200 rounded p-1 font-bold text-slate-700 text-base resize-none focus:outline-none focus:border-indigo-400 min-h-[40px]"
                                  value={row.content}
                                  onChange={(e) => setEditedResult(prev => {
                                    if (!prev) return prev;
                                    const rows = [...prev.korean_summary.rows];
                                    rows[i] = { ...rows[i], content: e.target.value };
                                    return { ...prev, korean_summary: { ...prev.korean_summary, rows } };
                                  })}
                                />
                              ) : (
                                <span className="text-slate-700 font-bold text-lg leading-relaxed">{row.content}</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </SectionCard>

                {/* 04 영어 제목 */}
                <SectionCard number="04" title="영어 제목 3가지"
                  color="bg-amber-500" theme={printTheme}
                  onCopy={() => copy(d.english_titles.map((t, i) => `${i + 1}. ${t}`).join('\n'), 'titles')}
                  copied={copiedSection === 'titles'}>
                  <div className="space-y-2">
                    {d.english_titles.map((title, i) => (
                      <div key={i} className={`flex items-start gap-2 px-3 py-2.5 rounded-xl border ${printTheme === 'color' ? 'bg-amber-50 border-amber-100' : 'bg-white border-slate-200'}`}>
                        <span className={`font-black w-8 shrink-0 text-lg ${printTheme === 'color' ? 'text-amber-600' : 'text-slate-600'}`}>{i + 1}.</span>
                        {editMode ? (
                          <input
                            className="flex-1 border border-amber-200 rounded p-1 font-bold text-slate-700 text-base focus:outline-none focus:border-amber-400"
                            value={title}
                            onChange={(e) => setEditedResult(prev => {
                              if (!prev) return prev;
                              const titles = [...prev.english_titles];
                              titles[i] = e.target.value;
                              return { ...prev, english_titles: titles };
                            })}
                          />
                        ) : (() => {
                          const { english, korean } = parseTitleKorean(title);
                          return (
                            <div className="flex-1">
                              <p className="text-slate-700 font-bold leading-relaxed text-lg">{english}</p>
                              {korean && <p className="text-slate-500 font-bold text-base mt-1">({korean})</p>}
                            </div>
                          );
                        })()}
                      </div>
                    ))}
                  </div>
                </SectionCard>

                {/* 05 1문장 영어 요약 */}
                <SectionCard number="05" title="1문장 영어 요약 3가지"
                  color="bg-rose-500" theme={printTheme} onCopy={() => copy(d.one_sentence_summaries.map((s, i) => `${i + 1}. ${s.english.replace(/\*\*/g, '')}\n   (${cleanKorean(s.korean)})`).join('\n\n'), 'one_sentence')} copied={copiedSection === 'one_sentence'}>
                  <div className="space-y-2">
                    {d.one_sentence_summaries.map((s, i) => (
                      <div key={i} className={`px-3 py-2.5 rounded-xl border ${printTheme === 'color' ? 'bg-rose-50 border-rose-100' : 'bg-white border-slate-200'}`}>
                        <div className="flex items-start gap-2">
                          <span className={`font-black w-8 shrink-0 text-lg ${printTheme === 'color' ? 'text-rose-600' : 'text-slate-600'}`}>{i + 1}.</span>
                          <div className="flex-1">
                            {editMode ? (
                              <>
                                <input
                                  className="w-full border border-rose-200 rounded p-1 font-bold text-slate-700 text-base focus:outline-none focus:border-rose-400 mb-1"
                                  value={s.english}
                                  onChange={(e) => setEditedResult(prev => {
                                    if (!prev) return prev;
                                    const sums = [...prev.one_sentence_summaries];
                                    sums[i] = { ...sums[i], english: e.target.value };
                                    return { ...prev, one_sentence_summaries: sums };
                                  })}
                                />
                                <input
                                  className="w-full border border-rose-200 rounded p-1 font-bold text-slate-500 text-sm focus:outline-none focus:border-rose-400"
                                  value={s.korean}
                                  onChange={(e) => setEditedResult(prev => {
                                    if (!prev) return prev;
                                    const sums = [...prev.one_sentence_summaries];
                                    sums[i] = { ...sums[i], korean: e.target.value };
                                    return { ...prev, one_sentence_summaries: sums };
                                  })}
                                />
                              </>
                            ) : (
                              <>
                                <p className="text-slate-700 font-bold leading-relaxed text-lg mb-1">{renderBold(s.english)}</p>
                                <p className="text-slate-500 font-bold text-base">{renderSingleBold('(' + cleanKorean(s.korean) + ')')}</p>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </SectionCard>

                {/* 06 관련 어휘 */}
                <SectionCard number="06" title="관련 어휘 10개"
                  color="bg-slate-700" theme={printTheme} onCopy={() => copy(d.vocabulary_table.map(r => `${r.word} (${r.meaning}) | ${r.syn1} (${r.syn1_m}) | ${r.syn2} (${r.syn2_m}) | ${r.syn3} (${r.syn3_m}) | ${r.antonym} (${r.antonym_m})`).join('\n'), 'vocab')} copied={copiedSection === 'vocab'}>
                  <div>
                    <table id="vocab-table" className="w-full text-lg border-collapse table-fixed">
                      <colgroup>
                        <col style={{width:'22%'}} />
                        <col style={{width:'19%'}} />
                        <col style={{width:'19%'}} />
                        <col style={{width:'19%'}} />
                        <col style={{width:'21%'}} />
                      </colgroup>
                      <thead>
                        <tr className="bg-slate-800 text-white">
                          {['표제어 (뜻)', '유의어 1 (뜻)', '유의어 2 (뜻)', '유의어 3 (뜻)', '반의어 (뜻)'].map((h, i) => (
                            <th key={i} className={`px-2 py-2 text-left font-black ${i === 0 ? 'rounded-tl-lg' : ''} ${i === 4 ? 'rounded-tr-lg' : ''}`}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {d.vocabulary_table.map((row, i) => {
                          const updateVocab = (patch: Partial<VocabRow>) => setEditedResult(prev => {
                            if (!prev) return prev;
                            const vocab = [...prev.vocabulary_table];
                            vocab[i] = { ...vocab[i], ...patch };
                            return { ...prev, vocabulary_table: vocab };
                          });
                          return (
                          <tr key={i} className={printTheme === 'color' && i % 2 !== 0 ? 'bg-slate-50' : 'bg-white'}>
                            <td className="px-2 py-2 border-b border-slate-100">
                              {editMode ? (
                                <div className="flex flex-col gap-0.5">
                                  <input className="w-full border border-indigo-200 rounded px-1 py-0.5 font-black text-indigo-700 text-sm focus:outline-none focus:border-indigo-400" value={row.word} onChange={e => updateVocab({ word: e.target.value })} />
                                  <input className="w-full border border-slate-200 rounded px-1 py-0.5 text-slate-500 text-xs focus:outline-none focus:border-slate-400" value={row.meaning} onChange={e => updateVocab({ meaning: e.target.value })} />
                                </div>
                              ) : (
                                <><span className="font-black text-indigo-700">{row.word}</span><span className="text-slate-900 text-base ml-1">({row.meaning})</span></>
                              )}
                            </td>
                            {([['syn1','syn1_m'], ['syn2','syn2_m'], ['syn3','syn3_m']] as const).map(([wk, mk], j) => (
                              <td key={j} className="px-2 py-2 border-b border-slate-100">
                                {editMode ? (
                                  <div className="flex flex-col gap-0.5">
                                    <input className="w-full border border-slate-200 rounded px-1 py-0.5 font-bold text-slate-700 text-sm focus:outline-none focus:border-slate-400" value={row[wk]} onChange={e => updateVocab({ [wk]: e.target.value })} />
                                    <input className="w-full border border-slate-200 rounded px-1 py-0.5 text-slate-500 text-xs focus:outline-none focus:border-slate-400" value={row[mk]} onChange={e => updateVocab({ [mk]: e.target.value })} />
                                  </div>
                                ) : (
                                  <><span className="font-bold text-slate-700">{row[wk]}</span><span className="text-slate-900 text-base ml-1">({row[mk]})</span></>
                                )}
                              </td>
                            ))}
                            <td className="px-2 py-2 border-b border-slate-100">
                              {editMode ? (
                                <div className="flex flex-col gap-0.5">
                                  <input className="w-full border border-rose-200 rounded px-1 py-0.5 font-black text-rose-600 text-sm focus:outline-none focus:border-rose-400" value={row.antonym} onChange={e => updateVocab({ antonym: e.target.value })} />
                                  <input className="w-full border border-slate-200 rounded px-1 py-0.5 text-slate-500 text-xs focus:outline-none focus:border-slate-400" value={row.antonym_m} onChange={e => updateVocab({ antonym_m: e.target.value })} />
                                </div>
                              ) : (
                                <><span className="font-black text-rose-600">{row.antonym}</span><span className="text-slate-900 text-base ml-1">({row.antonym_m})</span></>
                              )}
                            </td>
                          </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </SectionCard>

                {/* 학원 로고 */}
                {logoDataUrl && (
                  <div className="flex justify-end pt-2 pb-1">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={logoDataUrl} alt="학원 로고" style={{ maxHeight: '60px', maxWidth: '180px', objectFit: 'contain' }} />
                  </div>
                )}
              </div>
                  </>
                );
              })()}
            </div>
            </>
          )}

          {result && (
            <div className="no-print fixed bottom-8 right-8 flex flex-col items-end gap-3 z-50">
              {/* 테마 토글 */}
              <div className="flex items-center gap-1 bg-white border border-slate-200 shadow-lg px-3 py-2 rounded-2xl">
                <span className="text-slate-400 text-xs font-bold mr-1">테마</span>
                <button
                  onClick={() => setPrintTheme('color')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-black transition-all ${printTheme === 'color' ? 'bg-teal-500 text-white' : 'text-slate-400 hover:text-slate-600'}`}>
                  컬러
                </button>
                <button
                  onClick={() => setPrintTheme('mono')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-black transition-all ${printTheme === 'mono' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-slate-600'}`}>
                  흑백
                </button>
              </div>
              {saveStatus === 'saving' && (
                <div className="flex items-center gap-2 bg-white border border-slate-200 shadow-lg px-4 py-2.5 rounded-2xl text-sm font-bold text-slate-500">
                  <div className="w-4 h-4 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
                  이력 자동 저장 중...
                </div>
              )}
              {saveStatus === 'done' && (
                <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 shadow-lg px-4 py-2.5 rounded-2xl text-sm font-bold text-emerald-600">
                  ✅ 이력에 저장됨
                </div>
              )}
              {saveStatus === 'error' && (
                <div className="flex items-center gap-2 bg-rose-50 border border-rose-200 shadow-lg px-4 py-2.5 rounded-2xl text-sm font-bold text-rose-600 max-w-xs">
                  ⚠️ 이력 저장 실패: {saveErrorMsg}
                </div>
              )}
              {editMode && editSaveStatus !== 'idle' && (
                <div className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-sm font-bold shadow-lg border
                  ${editSaveStatus === 'saving' ? 'bg-white border-slate-200 text-slate-500' : editSaveStatus === 'done' ? 'bg-emerald-50 border-emerald-200 text-emerald-600' : 'bg-rose-50 border-rose-200 text-rose-600'}`}>
                  {editSaveStatus === 'saving' ? <><div className="w-4 h-4 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />편집본 저장 중...</> : editSaveStatus === 'done' ? '✅ 편집본 저장됨' : '⚠️ 편집본 저장 실패'}
                </div>
              )}
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    if (!editMode) {
                      if (!editedResult) setEditedResult(JSON.parse(JSON.stringify(result)));
                      setEditSaveStatus('idle');
                      setEditMode(true);
                    } else {
                      setEditMode(false);
                    }
                  }}
                  className={`px-6 py-4 rounded-2xl font-black text-lg shadow-2xl transition-all active:scale-95
                    ${editMode ? 'bg-amber-500 text-white hover:bg-amber-600' : 'bg-slate-600 text-white hover:bg-slate-700'}`}>
                  {editMode ? '✏️ 편집 종료' : '✏️ 편집'}
                </button>
                {editMode && (
                  <button onClick={handleEditSave} disabled={editSaveStatus === 'saving'}
                    className="bg-emerald-600 text-white px-6 py-4 rounded-2xl font-black text-lg shadow-2xl hover:bg-emerald-700 active:scale-95 transition-all disabled:opacity-50">
                    {editSaveStatus === 'saving' ? '⏳ 저장 중...' : '📥 편집본 저장'}
                  </button>
                )}
                <button onClick={handleDownloadProblemPDF} disabled={pdfLoading !== false}
                  className="bg-indigo-600 text-white px-6 py-4 rounded-2xl font-black text-lg shadow-2xl hover:bg-indigo-700 active:scale-95 transition-all disabled:opacity-50">
                  {pdfLoading === '문제' ? '⏳ 생성 중...' : '⬇️ 문제 PDF'}
                </button>
                <button onClick={handleDownloadAnswerPDF} disabled={pdfLoading !== false}
                  className="bg-violet-600 text-white px-6 py-4 rounded-2xl font-black text-lg shadow-2xl hover:bg-violet-700 active:scale-95 transition-all disabled:opacity-50">
                  {pdfLoading === '답안' ? '⏳ 생성 중...' : '⬇️ 답안·해설 PDF'}
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* ══ 생성 이력 탭 ══ */}
      {activeTab === 'history' && (
        <div className="space-y-4">
          <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-2.5 text-xs font-bold text-amber-700">
            생성 이력은 생성일로부터 3일 후 자동 삭제됩니다.
          </div>
          <div className="bg-white p-5 rounded-[2rem] shadow-lg border border-slate-100">
            <div className="flex flex-wrap gap-3 items-end">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-black text-slate-500">날짜</label>
                <input type="date" value={searchDate} onChange={(e) => setSearchDate(e.target.value)}
                  className="px-4 py-2.5 border-2 border-slate-200 rounded-xl font-bold text-sm focus:outline-none focus:border-indigo-400 transition-colors" />
              </div>
              <div className="flex flex-col gap-1 flex-1 min-w-[180px]">
                <label className="text-xs font-black text-slate-500">지문 내 단어 검색</label>
                <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && fetchHistory()}
                  placeholder="단어를 입력하세요..."
                  className="px-4 py-2.5 border-2 border-slate-200 rounded-xl font-bold text-sm focus:outline-none focus:border-indigo-400 transition-colors" />
              </div>
              <button onClick={() => fetchHistory()} disabled={historyLoading}
                className="px-6 py-2.5 bg-indigo-600 text-white rounded-xl font-black text-sm hover:bg-indigo-700 active:scale-95 transition-all disabled:opacity-50">
                🔍 검색
              </button>
              {(searchDate || searchQuery) && (
                <button onClick={() => { setSearchDate(''); setSearchQuery(''); fetchHistory('', ''); }}
                  className="px-4 py-2.5 bg-slate-100 text-slate-500 rounded-xl font-black text-sm hover:bg-slate-200 transition-all">
                  초기화
                </button>
              )}
            </div>
          </div>

          {historyError && (
            <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl">
              <p className="text-rose-600 font-black">⚠️ {historyError}</p>
            </div>
          )}

          {selectedIds.size > 0 && (
            <div className="flex items-center gap-3 px-5 py-3 bg-indigo-50 border border-indigo-200 rounded-2xl">
              <span className="font-black text-indigo-700 text-sm">{selectedIds.size}개 선택됨</span>
              <div className="flex gap-2 ml-auto">
                <button onClick={downloadSelected} disabled={bulkDownloading}
                  className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl font-black text-sm hover:bg-indigo-700 active:scale-95 transition-all disabled:opacity-50">
                  {bulkDownloading ? '다운로드 중...' : 'PDF 다운로드'}
                </button>
                <button onClick={deleteSelected} disabled={bulkDeleting}
                  className="flex items-center gap-2 px-4 py-2 bg-rose-500 text-white rounded-xl font-black text-sm hover:bg-rose-600 active:scale-95 transition-all disabled:opacity-50">
                  {bulkDeleting ? '삭제 중...' : '삭제'}
                </button>
                <button onClick={() => setSelectedIds(new Set())}
                  className="px-4 py-2 bg-slate-100 text-slate-500 rounded-xl font-black text-sm hover:bg-slate-200 transition-all">취소</button>
              </div>
            </div>
          )}

          {historyLoading ? (
            <div className="flex justify-center py-16">
              <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : historyList.length === 0 ? (
            <div className="bg-white rounded-[2rem] p-16 text-center shadow-lg border border-slate-100">
              <p className="text-5xl mb-4">📭</p>
              <p className="font-black text-slate-500 text-lg">생성된 이력이 없습니다</p>
              <p className="text-slate-400 font-bold text-sm mt-2">문제를 생성하면 자동으로 이곳에 기록돼요</p>
            </div>
          ) : (
            <div className="bg-white rounded-[2rem] shadow-lg border border-slate-100 overflow-hidden">
              <div className="grid grid-cols-[40px_150px_56px_220px_1fr_80px] gap-3 px-5 py-3 bg-slate-50 border-b border-slate-100">
                <input type="checkbox" checked={selectedIds.size === historyList.length && historyList.length > 0}
                  onChange={toggleSelectAll} className="w-4 h-4 rounded accent-indigo-600 cursor-pointer mt-0.5" />
                {['날짜', '난이도', '제목', '지문 요약', 'PDF'].map((h, i) => (
                  <span key={i} className={`text-xs font-black text-slate-500 ${i === 4 ? 'text-center' : ''}`}>{h}</span>
                ))}
              </div>
              {historyList.map((item, i) => (
                <div key={item.id}
                  className={`grid grid-cols-[40px_150px_56px_220px_1fr_80px] gap-3 px-5 py-4 items-center
                    ${selectedIds.has(item.id) ? 'bg-indigo-50' : i % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}
                    border-b border-slate-100 last:border-0 hover:bg-indigo-50/60 transition-colors`}>
                  <input type="checkbox" checked={selectedIds.has(item.id)} onChange={() => toggleSelect(item.id)}
                    className="w-4 h-4 rounded accent-indigo-600 cursor-pointer" />
                  <span className="text-sm font-bold text-slate-600 whitespace-nowrap">
                    {new Date(item.created_at).toLocaleString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
                  </span>
                  <span className={`text-xs font-black px-2 py-1 rounded-full w-fit ${DIFF_COLORS[item.difficulty] ?? 'bg-slate-100 text-slate-600'}`}>
                    {item.difficulty || '-'}
                  </span>
                  <span className="text-sm font-bold text-slate-700 truncate" title={item.title || ''}>
                    {item.title || <span className="text-slate-300">-</span>}
                  </span>
                  <button onClick={() => setPassageModal(item)}
                    className="text-sm text-slate-600 font-bold truncate text-left hover:text-indigo-600 hover:underline transition-colors w-full">
                    {item.passage_excerpt}
                  </button>
                  <div className="flex flex-col gap-1 items-center">
                    {item.pdf_path ? (
                      <button onClick={() => downloadFromHistory(item.pdf_path, `${item.title || '영어문제'}_문제.pdf`)} title="문제지 다운로드"
                        className="flex items-center gap-1 px-2 py-1 bg-indigo-100 hover:bg-indigo-200 text-indigo-700 rounded-lg text-xs font-black transition-all active:scale-90 w-full justify-center">
                        문제
                      </button>
                    ) : (
                      <span className="text-xs text-slate-300 font-bold">저장중</span>
                    )}
                    {item.answer_pdf_path && (
                      <button onClick={() => downloadFromHistory(item.answer_pdf_path!, `${item.title || '영어문제'}_답안해설.pdf`)} title="답안·해설 다운로드"
                        className="flex items-center gap-1 px-2 py-1 bg-violet-100 hover:bg-violet-200 text-violet-700 rounded-lg text-xs font-black transition-all active:scale-90 w-full justify-center">
                        해설
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── 지문 전체 보기 모달 ── */}
      {passageModal && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
          onClick={() => setPassageModal(null)}>
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <div className="flex flex-wrap items-center gap-2">
                {passageModal.title && (
                  <span className="font-black text-slate-800 text-sm mr-1">{passageModal.title}</span>
                )}
                <span className={`text-xs font-black px-2 py-1 rounded-full ${TYPE_COLORS[passageModal.passage_type] ?? 'bg-slate-100 text-slate-600'}`}>
                  {passageModal.passage_type || '-'}
                </span>
                <span className={`text-xs font-black px-2 py-1 rounded-full ${DIFF_COLORS[passageModal.difficulty] ?? 'bg-slate-100 text-slate-600'}`}>
                  난이도 {passageModal.difficulty || '-'}
                </span>
                <span className="text-xs text-slate-400 font-bold">
                  {new Date(passageModal.created_at).toLocaleString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
              <button onClick={() => setPassageModal(null)}
                className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors font-black text-lg">
                ✕
              </button>
            </div>
            <div className="overflow-y-auto p-6">
              <p className="text-slate-700 font-bold leading-relaxed whitespace-pre-wrap text-sm">{passageModal.passage_full}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function SectionCard({ number, title, subtitle, color, onCopy, copied, children, theme = 'mono' }: {
  number: string; title: string; subtitle?: string; color: string;
  onCopy: () => void; copied: boolean; children: React.ReactNode; theme?: 'color' | 'mono';
}) {
  const isColor = theme === 'color';
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-lg overflow-hidden">
      <div className={`${isColor ? color : 'bg-slate-700'} px-5 py-2.5 flex items-center justify-between`}>
        <div className="flex items-center gap-3">
          <span className="font-black text-2xl leading-none text-white/70">{number}</span>
          <div>
            <h2 className="font-black text-lg leading-tight text-white">{title}</h2>
            {subtitle && <p className="font-bold text-sm mt-0.5 text-white/80">{subtitle}</p>}
          </div>
        </div>
        <button onClick={onCopy}
          className="no-print font-black text-xs px-3 py-1.5 rounded-xl transition-all active:scale-95 bg-white/20 hover:bg-white/30 text-white">
          {copied ? '✅ 복사됨' : '📋 복사'}
        </button>
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}
