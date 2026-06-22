'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import type { Session } from '@supabase/supabase-js';
import Image from 'next/image';

// ─── types ────────────────────────────────────────────────────────────────────

interface VocabChoiceResult {
  vocab_choice_passage: string;
  answer_key: string;
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

// ─── helpers ──────────────────────────────────────────────────────────────────

const DIFF_COLORS: Record<string, string> = {
  b1: 'bg-emerald-100 text-emerald-700',
  b2: 'bg-sky-100 text-sky-700',
  c1: 'bg-violet-100 text-violet-700',
  c2: 'bg-rose-100 text-rose-700',
};

const DIFF_CARDS = [
  { key: 'b1' as const, level: 'B1', label: '중등/고등 하', icon: '🌱', active: 'border-sky-400 bg-sky-50 text-sky-700' },
  { key: 'b2' as const, level: 'B2', label: '고등 중',      icon: '🌳', active: 'border-emerald-500 bg-emerald-50 text-emerald-700' },
  { key: 'c1' as const, level: 'C1', label: '고등 상',      icon: '🔥', active: 'border-orange-500 bg-orange-50 text-orange-700' },
  { key: 'c2' as const, level: 'C2', label: '고등 최상',    icon: '⚡', active: 'border-rose-500 bg-rose-50 text-rose-700' },
];

interface VocabChunk {
  type: 'text' | 'choice';
  text?: string;
  num?: number;
  a?: string;
  b?: string;
  c?: string;
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
    if (match.index > lastIndex) {
      chunks.push({ type: 'text', text: passage.slice(lastIndex, match.index) });
    }
    const num = parseInt(match[1]);
    const opts = match[2].split(/\s*\/\s*/).map(o => o.trim());
    const ans = answerMap[num] || '';
    const correctIdx = opts.findIndex(o => o.toLowerCase() === ans.toLowerCase());
    const [a, b, c] = opts;
    chunks.push({ type: 'choice', num, a, b, c, correctIdx: correctIdx >= 0 ? correctIdx : undefined });
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < passage.length) {
    chunks.push({ type: 'text', text: passage.slice(lastIndex) });
  }
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
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error('Image load failed'));
    img.src = url;
  });

  const contentH = cW * (img.naturalHeight / img.naturalWidth);
  const pdf = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });

  if (contentH <= maxH) {
    pdf.addImage(url, 'JPEG', M, M, cW, contentH);
  } else {
    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(img, 0, 0);

    const pagePixelH = Math.floor(img.naturalHeight * (maxH / contentH));
    let sliceY = 0;
    let firstPage = true;
    while (sliceY < img.naturalHeight) {
      const sliceH = Math.min(pagePixelH, img.naturalHeight - sliceY);
      const sliceCanvas = document.createElement('canvas');
      sliceCanvas.width = img.naturalWidth;
      sliceCanvas.height = sliceH;
      const sliceCtx = sliceCanvas.getContext('2d')!;
      sliceCtx.drawImage(canvas, 0, sliceY, img.naturalWidth, sliceH, 0, 0, img.naturalWidth, sliceH);
      const sliceUrl = sliceCanvas.toDataURL('image/jpeg', 0.92);
      const sliceContentH = cW * (sliceH / img.naturalWidth);
      if (!firstPage) pdf.addPage();
      pdf.addImage(sliceUrl, 'JPEG', M, M, cW, sliceContentH);
      sliceY += sliceH;
      firstPage = false;
    }
  }
  return pdf.output('blob');
}

// ─── main component ───────────────────────────────────────────────────────────

export default function VocabChoicePage() {
  const [activeTab, setActiveTab] = useState<'input' | 'mock' | 'history'>('input');
  const [session, setSession] = useState<Session | null>(null);

  // Input tab
  const [inputText, setInputText] = useState('');
  const [inputTitle, setInputTitle] = useState('');
  const [inputDifficulty, setInputDifficulty] = useState<'b1' | 'b2' | 'c1' | 'c2'>('b2');

  // Mock tab
  const [mockTitle, setMockTitle] = useState('');
  const [mockDifficulty, setMockDifficulty] = useState<'b1' | 'b2' | 'c1' | 'c2'>('b2');
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

  // Shared generation state
  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState('');
  const [result, setResult] = useState<VocabChoiceResult | null>(null);
  const [mockResults, setMockResults] = useState<Array<VocabChoiceResult & { num: string }>>([]);
  const [activeMockTab, setActiveMockTab] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);
  const [vocabChoicePrice, setVocabChoicePrice] = useState(20);

  // PDF state
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

  const savedRef = useRef(false);

  // Input mode (text vs image/OCR)
  const [inputMode, setInputMode] = useState<'text' | 'image'>('text');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [ocrText, setOcrText] = useState('');
  const [ocrLoading, setOcrLoading] = useState(false);
  const [ocrDone, setOcrDone] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session: s } }) => { if (s) setSession(s as typeof session); });
  }, []);


  useEffect(() => {
    fetch('/api/credits/pricing').then(r => r.ok ? r.json() : null).then(data => {
      const item = (data?.pricing ?? []).find((p: { feature_key: string; cost_per_use: number }) => p.feature_key === 'vocab_choice');
      if (item) setVocabChoicePrice(item.cost_per_use);
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
    supabase.from('mock_exam_passages').select('grade').eq('year', parseInt(selectedYear)).order('grade', { ascending: true })
      .then(({ data }) => { setGrades([...new Set((data ?? []).map((r: { grade: string }) => r.grade))]); });
  }, [selectedYear]);

  useEffect(() => {
    if (!selectedYear || !selectedGrade) return;
    setSelectedInstitution(''); setSelectedNumbers([]); setPassageMap({});
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

  const fetchHistory = useCallback(async (date = searchDate, query = searchQuery) => {
    if (!session) return;
    setHistoryLoading(true);
    setHistoryError('');
    try {
      let q = supabase
        .from('vocab_choice_history')
        .select('*')
        .eq('academy_id', session.user.id)
        .order('created_at', { ascending: false });
      if (date) {
        q = q.gte('created_at', date).lt('created_at', new Date(new Date(date).getTime() + 86400000).toISOString());
      }
      if (query) {
        q = q.ilike('passage_full', `%${query}%`);
      }
      const { data, error } = await q.limit(100);
      if (error) { setHistoryError(error.message); return; }
      setHistoryList((data || []) as HistoryItem[]);
    } catch (e) {
      setHistoryError(e instanceof Error ? e.message : '오류');
    } finally {
      setHistoryLoading(false);
    }
  }, [session, searchDate, searchQuery]);

  useEffect(() => {
    if (activeTab === 'history' && session) fetchHistory();
  }, [activeTab, session, fetchHistory]);

  const handleImageSelect = (file: File) => {
    if (!['image/jpeg', 'image/png', 'image/gif', 'image/webp'].includes(file.type)) {
      setGenerateError('JPG, PNG, GIF, WebP 형식만 지원합니다.'); return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setGenerateError('이미지 파일이 너무 큽니다. (최대 10MB)'); return;
    }
    if (imagePreview) URL.revokeObjectURL(imagePreview);
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
    setOcrText(''); setOcrDone(false); setGenerateError('');
  };

  const handleDrop = useCallback((e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleImageSelect(file);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [imagePreview]);

  const handleOCR = async () => {
    if (!imageFile) return;
    setOcrLoading(true); setGenerateError('');
    try {
      const fd = new FormData();
      fd.append('image', imageFile);
      const res = await fetch('/api/ocr', { method: 'POST', body: fd });
      const json = await res.json() as { text?: string; error?: string };
      if (!res.ok) throw new Error(json.error || 'OCR 오류');
      setOcrText(json.text ?? ''); setOcrDone(true);
    } catch (e: unknown) {
      setGenerateError(e instanceof Error ? e.message : 'OCR 오류가 발생했습니다.');
    } finally {
      setOcrLoading(false);
    }
  };

  const handleGenerate = async () => {
    if (!session) { setGenerateError('로그인이 필요합니다.'); return; }
    setGenerateError('');

    if (activeTab === 'input') {
      const text = inputMode === 'text' ? inputText : ocrText;
      if (!text.trim()) { setGenerateError('지문을 입력해주세요.'); return; }
      setGenerating(true); setResult(null); setShowAnswer(false); savedRef.current = false;
      try {
        const res = await fetch('/api/generate-vocab-choice', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text, difficulty: inputDifficulty, academy_id: session.user.id }),
        });
        const json = await res.json() as { success?: boolean; data?: VocabChoiceResult; error?: string };
        if (!res.ok || !json.success) throw new Error(json.error || '생성 실패');
        setResult(json.data!);
        setTimeout(() => autoSave(text, inputTitle, inputDifficulty), 1500);
      } catch (e) {
        setGenerateError(e instanceof Error ? e.message : '오류가 발생했습니다.');
      } finally {
        setGenerating(false);
      }
    } else {
      const sortedNums = [...selectedNumbers].sort((a, b) => parseInt(a) - parseInt(b));
      if (sortedNums.length === 0) { setGenerateError('문제번호를 선택해주세요.'); return; }
      setGenerating(true); setMockResults([]); setActiveMockTab(0); setShowAnswer(false);
      const newResults: Array<VocabChoiceResult & { num: string }> = [];
      try {
        for (const num of sortedNums) {
          const text = passageMap[num];
          const res = await fetch('/api/generate-vocab-choice', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text, difficulty: mockDifficulty, academy_id: session.user.id }),
          });
          const json = await res.json() as { success?: boolean; data?: VocabChoiceResult; error?: string };
          if (!res.ok || !json.success) throw new Error(`${num}번: ${json.error || '생성 실패'}`);
          newResults.push({ ...json.data!, num });
          setMockResults([...newResults]);
        }
        const capturedNums = [...sortedNums];
        setTimeout(() => {
          newResults.forEach((_, idx) => autoSaveMock(idx, newResults, capturedNums));
        }, 1500);
      } catch (e) {
        setGenerateError(e instanceof Error ? e.message : '오류가 발생했습니다.');
      } finally {
        setGenerating(false);
      }
    }
  };

  const autoSave = async (passageFull: string, title: string, difficulty: string) => {
    if (savedRef.current || !session) return;
    savedRef.current = true;
    setSavingHistory(true);
    try {
      const [problemBlob, answerBlob] = await Promise.all([
        capturePdfFromElement('vocab-pdf-problem'),
        capturePdfFromElement('vocab-pdf-answer'),
      ]);
      const toBase64 = (b: Blob) => new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve((reader.result as string).split(',')[1]);
        reader.onerror = reject;
        reader.readAsDataURL(b);
      });
      const [pdfBase64, answerPdfBase64] = await Promise.all([toBase64(problemBlob), toBase64(answerBlob)]);
      await fetch('/api/save-vocab-choice-history', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({
          pdfBase64, answerPdfBase64,
          title: title || null,
          passageExcerpt: passageFull.slice(0, 100),
          passageFull,
          sourceType: 'input',
          year: null, grade: null, institution: null, questionNumber: null,
          difficulty,
        }),
      });
    } catch (e) {
      console.error('[vocab-choice] auto-save failed:', e);
    } finally {
      setSavingHistory(false);
    }
  };

  const autoSaveMock = async (
    idx: number,
    resultsArr: Array<VocabChoiceResult & { num: string }>,
    nums: string[],
  ) => {
    if (!session) return;
    const r = resultsArr[idx];
    if (!r) return;
    setSavingHistory(true);
    try {
      const [problemBlob, answerBlob] = await Promise.all([
        capturePdfFromElement(`vocab-pdf-problem-mock-${idx}`),
        capturePdfFromElement(`vocab-pdf-answer-mock-${idx}`),
      ]);
      const toBase64 = (b: Blob) => new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve((reader.result as string).split(',')[1]);
        reader.onerror = reject;
        reader.readAsDataURL(b);
      });
      const [pdfBase64, answerPdfBase64] = await Promise.all([toBase64(problemBlob), toBase64(answerBlob)]);
      const passage = passageMap[nums[idx]] ?? '';
      await fetch('/api/save-vocab-choice-history', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({
          pdfBase64, answerPdfBase64,
          title: mockTitle || null,
          passageExcerpt: passage.slice(0, 100),
          passageFull: passage,
          sourceType: 'mock',
          year: selectedYear ? parseInt(selectedYear) : null,
          grade: selectedGrade || null,
          institution: selectedInstitution || null,
          questionNumber: parseInt(r.num),
          difficulty: mockDifficulty,
        }),
      });
    } catch (e) {
      console.error(`[vocab-choice] autoSaveMock[${idx}] failed:`, e);
    } finally {
      setSavingHistory(false);
    }
  };

  const handleDownloadPdf = async (withAnswer: boolean) => {
    const isInput = activeTab === 'input';
    const activeResult = isInput ? result : mockResults[activeMockTab];
    if (!activeResult) return;
    const title = isInput ? inputTitle : mockTitle;
    if (withAnswer) setDownloadingAnswerPdf(true);
    else setDownloadingPdf(true);
    try {
      const elementId = isInput
        ? (withAnswer ? 'vocab-pdf-answer' : 'vocab-pdf-problem')
        : (withAnswer ? `vocab-pdf-answer-mock-${activeMockTab}` : `vocab-pdf-problem-mock-${activeMockTab}`);
      const blob = await capturePdfFromElement(elementId);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const numSuffix = isInput ? '' : `_${mockResults[activeMockTab]?.num}번`;
      a.download = `${title || '어휘선택문제'}${numSuffix}${withAnswer ? '_정답' : '_문제'}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {
      alert(e instanceof Error ? e.message : 'PDF 생성 실패');
    } finally {
      if (withAnswer) setDownloadingAnswerPdf(false);
      else setDownloadingPdf(false);
    }
  };

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
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
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
      setSelectedIds(new Set());
      fetchHistory();
    } finally {
      setBulkDeleting(false);
    }
  };

  const toggleSelect = (id: string) => setSelectedIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const toggleSelectAll = () => setSelectedIds(prev => prev.size === historyList.length ? new Set() : new Set(historyList.map(h => h.id)));

  // ─── render helpers ────────────────────────────────────────────────────────

  const renderVocabPassage = (passage: string, answerKey: string) => {
    const chunks = parseVocabPassage(passage, answerKey);
    return chunks.map((c, i) => {
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
    });
  };

  const inputEffectiveText = inputMode === 'text' ? inputText : ocrText;
  const allPassagesReady = selectedNumbers.length > 0 && selectedNumbers.every(n => passageMap[n]) && loadingNumbers.size === 0;
  const canGenerate = (activeTab === 'input' ? inputEffectiveText.trim().length >= 50 : allPassagesReady) && !generating;
  const sortedSelectedNumbers = [...selectedNumbers].sort((a, b) => parseInt(a) - parseInt(b));

  // ─── render ────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gray-50 pb-16">
      <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-black text-slate-800">📌 어휘 선택 문제</h1>
            <p className="text-sm text-slate-500 mt-1">영어 지문으로 어휘 선택 문제를 자동 생성합니다</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-white rounded-2xl shadow-sm border border-gray-100 p-1.5">
          {([
            { key: 'input', label: '✏️ 직접 입력' },
            { key: 'mock', label: '📚 모의고사 지문' },
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
                <input
                  type="text"
                  placeholder="예: 2024 수능 18번"
                  value={inputTitle}
                  onChange={e => setInputTitle(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-indigo-300"
                />
              </div>
              {/* 입력 모드 토글 */}
              <div className="flex gap-2 bg-slate-100 p-1.5 rounded-2xl w-fit">
                {([['text', '✏️ 텍스트 직접 입력'], ['image', '📷 사진 등록']] as const).map(([mode, label]) => (
                  <button key={mode} onClick={() => setInputMode(mode)}
                    className={`px-5 py-2.5 rounded-xl font-black text-sm transition-all
                      ${inputMode === mode ? 'bg-white text-indigo-600 shadow-md' : 'text-slate-500 hover:text-slate-700'}`}>
                    {label}
                  </button>
                ))}
              </div>

              {/* 텍스트 직접 입력 */}
              {inputMode === 'text' && (
                <div>
                  <p className="text-xs font-bold text-slate-400 mb-2">영어 지문을 복사(Ctrl+C)한 뒤 아래에 붙여넣기(Ctrl+V) 해주세요</p>
                  <textarea
                    rows={10}
                    placeholder="영어 지문을 붙여넣으세요..."
                    value={inputText}
                    onChange={e => setInputText(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-indigo-300 resize-y"
                  />
                  <p className="text-xs text-slate-400 font-bold text-right mt-1">{inputText.trim().length}자</p>
                </div>
              )}

              {/* 사진 등록 / OCR */}
              {inputMode === 'image' && (
                <div className="space-y-4">
                  <label
                    onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
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
                      onChange={e => { const f = e.target.files?.[0]; if (f) handleImageSelect(f); }} />
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
                              {ocrLoading ? '⏳ 추출 중...' : '🔍 텍스트 추출하기'}
                            </button>
                          </div>
                        ) : (
                          <div className="flex-1 flex flex-col gap-2">
                            <div className="flex items-center justify-between">
                              <p className="font-black text-emerald-600 text-sm">✅ 텍스트 추출 완료 — 수정 후 문제를 생성하세요</p>
                              <button onClick={() => { setOcrDone(false); setOcrText(''); }}
                                className="text-xs font-black text-slate-400 hover:text-rose-500 transition-colors">다시 추출</button>
                            </div>
                            <textarea value={ocrText} onChange={e => setOcrText(e.target.value)} rows={10}
                              className="flex-1 w-full p-4 border-2 border-emerald-200 rounded-2xl font-mono text-sm text-slate-700 resize-y focus:outline-none focus:border-indigo-400 transition-colors bg-emerald-50/30" />
                            <p className="text-xs text-slate-400 font-bold text-right">{ocrText.trim().length}자</p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
              <div>
                <label className="block text-xs font-black text-slate-500 mb-2">난이도</label>
                <div className="flex gap-2">
                  {DIFF_CARDS.map(d => (
                    <button key={d.key} onClick={() => setInputDifficulty(d.key)}
                      className={`flex-1 py-4 rounded-xl font-black border-2 text-center transition-all ${inputDifficulty === d.key ? d.active : 'border-gray-200 bg-white text-slate-500 hover:bg-gray-50'}`}>
                      <div className="text-2xl mb-1">{d.icon}</div>
                      <div className="text-xs font-bold opacity-70 mb-0.5">{d.level}</div>
                      <div className="text-sm">{d.label}</div>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <button
              onClick={handleGenerate}
              disabled={!canGenerate}
              className="w-full py-4 text-base font-black bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl transition-all disabled:opacity-50 shadow-lg shadow-indigo-200"
            >
              {generating ? '⏳ AI가 문제를 생성하고 있습니다...' : `✨ AI로 문제 생성하기 (${vocabChoicePrice}C)`}
            </button>
          </div>
        )}

        {/* ── 모의고사 지문 탭 ── */}
        {activeTab === 'mock' && (
          <div className="space-y-4">
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 space-y-4">
              <div>
                <label className="block text-xs font-black text-slate-500 mb-1.5">제목 (선택)</label>
                <input
                  type="text"
                  placeholder="예: 2024년 고1 3월 18번"
                  value={mockTitle}
                  onChange={e => setMockTitle(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-indigo-300"
                />
              </div>

              {/* Cascade selectors (년도/학년/시험명) */}
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: '년도', value: selectedYear, onChange: setSelectedYear, disabled: false, options: years.map(y => ({ value: String(y), label: `${y}년` })) },
                  { label: '학년', value: selectedGrade, onChange: setSelectedGrade, disabled: !selectedYear, options: grades.map(g => ({ value: g, label: g })) },
                  { label: '시험명/기관', value: selectedInstitution, onChange: setSelectedInstitution, disabled: !selectedGrade, options: institutions.map(i => ({ value: i, label: i })) },
                ].map(({ label, value, onChange, disabled, options }) => (
                  <div key={label}>
                    <label className="block text-xs font-black text-slate-500 mb-1">{label}</label>
                    <select
                      value={value}
                      onChange={e => onChange(e.target.value)}
                      disabled={disabled}
                      className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white disabled:bg-gray-50 disabled:text-slate-300"
                    >
                      <option value="">선택</option>
                      {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  </div>
                ))}
              </div>

              {/* 문제번호 다중 선택 토글 버튼 */}
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
                            isSelected
                              ? 'bg-indigo-600 border-indigo-600 text-white shadow-sm'
                              : 'bg-white border-slate-200 text-slate-600 hover:border-indigo-300 hover:text-indigo-600'
                          } ${isLoading ? 'opacity-50 cursor-wait' : ''}`}>
                          {isLoading ? '...' : `${n}번`}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* 선택된 지문 미리보기 */}
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
                          onContextMenu={e => e.preventDefault()}
                          onDragStart={e => e.preventDefault()}>
                          {passageMap[num]}
                        </p>
                      </div>
                    )
                  ))}
                </div>
              )}

              <div>
                <label className="block text-xs font-black text-slate-500 mb-2">난이도</label>
                <div className="flex gap-2">
                  {DIFF_CARDS.map(d => (
                    <button key={d.key} onClick={() => setMockDifficulty(d.key)}
                      className={`flex-1 py-4 rounded-xl font-black border-2 text-center transition-all ${mockDifficulty === d.key ? d.active : 'border-gray-200 bg-white text-slate-500 hover:bg-gray-50'}`}>
                      <div className="text-2xl mb-1">{d.icon}</div>
                      <div className="text-xs font-bold opacity-70 mb-0.5">{d.level}</div>
                      <div className="text-sm">{d.label}</div>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {selectedNumbers.length > 0 && (
              <p className="text-center text-sm font-bold text-slate-400">
                지문 1개당 <span className="text-yellow-500 font-black">{vocabChoicePrice} C</span> 사용
                {selectedNumbers.length > 1 && (
                  <span className="text-slate-500"> × {selectedNumbers.length}개 = <span className="text-yellow-500 font-black">{vocabChoicePrice * selectedNumbers.length} C</span></span>
                )}
              </p>
            )}
            <button
              onClick={handleGenerate}
              disabled={!canGenerate}
              className="w-full py-4 text-base font-black bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl transition-all disabled:opacity-50 shadow-lg shadow-indigo-200"
            >
              {generating
                ? `⏳ AI가 문제를 생성하고 있습니다... (${mockResults.length}/${selectedNumbers.length})`
                : selectedNumbers.length > 1
                  ? `✨ AI로 문제 ${selectedNumbers.length}개 생성하기 (${vocabChoicePrice * selectedNumbers.length}C)`
                  : `✨ AI로 문제 생성하기 (${vocabChoicePrice}C)`}
            </button>
          </div>
        )}

        {/* Error message */}
        {generateError && (
          <div className="bg-rose-50 border border-rose-200 rounded-2xl px-5 py-4">
            <p className="text-rose-600 font-black text-sm">⚠️ {generateError}</p>
          </div>
        )}

        {/* ── Result (입력 탭) ── */}
        {result && activeTab === 'input' && (() => {
          const activeResult = result;
          return (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-3">
                  <span className="font-black text-slate-800">생성 완료</span>
                  {savingHistory && <span className="text-xs font-bold text-slate-400 animate-pulse">저장 중...</span>}
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => setShowAnswer(!showAnswer)}
                    className={`px-4 py-2 text-xs font-black rounded-xl transition-all ${showAnswer ? 'bg-yellow-500 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
                    {showAnswer ? '✅ 정답 표시 중' : '정답 보기'}
                  </button>
                  <button onClick={() => handleDownloadPdf(false)} disabled={downloadingPdf}
                    className="px-4 py-2 text-xs font-black bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl transition-all disabled:opacity-50">
                    {downloadingPdf ? '생성 중...' : '⬇️ 문제 PDF'}
                  </button>
                  <button onClick={() => handleDownloadPdf(true)} disabled={downloadingAnswerPdf}
                    className="px-4 py-2 text-xs font-black bg-violet-600 hover:bg-violet-700 text-white rounded-xl transition-all disabled:opacity-50">
                    {downloadingAnswerPdf ? '생성 중...' : '⬇️ 정답 PDF'}
                  </button>
                </div>
              </div>
              <div className="px-5 py-5">
                <p className="text-sm font-bold leading-8 text-slate-800">
                  {renderVocabPassage(activeResult.vocab_choice_passage, activeResult.answer_key)}
                </p>
              </div>
              {showAnswer && (
                <div className="px-5 pb-5">
                  <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
                    <p className="text-xs font-black text-yellow-700 mb-1">정답</p>
                    <p className="text-sm font-bold text-slate-700 leading-relaxed">{activeResult.answer_key}</p>
                  </div>
                </div>
              )}
            </div>
          );
        })()}

        {/* ── Result (모의고사 탭 - 다중) ── */}
        {mockResults.length > 0 && activeTab === 'mock' && (() => {
          const activeResult = mockResults[activeMockTab];
          return (
            <div className="space-y-3">
              {/* 탭 (결과 2개 이상일 때) */}
              {mockResults.length > 1 && (
                <div className="flex gap-1 bg-white rounded-2xl shadow-sm border border-gray-100 p-1.5">
                  {mockResults.map((r, idx) => (
                    <button key={idx} onClick={() => setActiveMockTab(idx)}
                      className={`flex-1 py-2 text-sm font-black rounded-xl transition-all ${activeMockTab === idx ? 'bg-indigo-600 text-white shadow' : 'text-slate-500 hover:bg-slate-50'}`}>
                      {r.num}번
                    </button>
                  ))}
                </div>
              )}
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between flex-wrap gap-3">
                  <div className="flex items-center gap-3">
                    <span className="font-black text-slate-800">
                      {mockResults.length > 1 ? `${activeResult.num}번 문제 생성 완료` : '생성 완료'}
                    </span>
                    {savingHistory && <span className="text-xs font-bold text-slate-400 animate-pulse">저장 중...</span>}
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => setShowAnswer(!showAnswer)}
                      className={`px-4 py-2 text-xs font-black rounded-xl transition-all ${showAnswer ? 'bg-yellow-500 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
                      {showAnswer ? '✅ 정답 표시 중' : '정답 보기'}
                    </button>
                    <button onClick={() => handleDownloadPdf(false)} disabled={downloadingPdf}
                      className="px-4 py-2 text-xs font-black bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl transition-all disabled:opacity-50">
                      {downloadingPdf ? '생성 중...' : '⬇️ 문제 PDF'}
                    </button>
                    <button onClick={() => handleDownloadPdf(true)} disabled={downloadingAnswerPdf}
                      className="px-4 py-2 text-xs font-black bg-violet-600 hover:bg-violet-700 text-white rounded-xl transition-all disabled:opacity-50">
                      {downloadingAnswerPdf ? '생성 중...' : '⬇️ 정답 PDF'}
                    </button>
                  </div>
                </div>
                <div className="px-5 py-5">
                  <p className="text-sm font-bold leading-8 text-slate-800">
                    {renderVocabPassage(activeResult.vocab_choice_passage, activeResult.answer_key)}
                  </p>
                </div>
                {showAnswer && (
                  <div className="px-5 pb-5">
                    <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
                      <p className="text-xs font-black text-yellow-700 mb-1">정답</p>
                      <p className="text-sm font-bold text-slate-700 leading-relaxed">{activeResult.answer_key}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })()}

        {/* ── PDF 렌더 영역 (position:fixed, z-index:-9999, html-to-image 캡처용) ── */}
        {(() => {
          const pdfStyle: React.CSSProperties = {
            position: 'fixed', top: 0, left: 0, width: '800px',
            background: 'white', padding: '40px 48px', boxSizing: 'border-box',
            fontFamily: 'Arial, Helvetica, sans-serif', zIndex: -9999, pointerEvents: 'none',
          };
          const h2Style: React.CSSProperties = { fontSize: 14, fontWeight: 900, margin: '0 0 16px', borderBottom: '2px solid #333', paddingBottom: 8 };
          const pStyle: React.CSSProperties = { fontSize: 13, lineHeight: 2, wordBreak: 'break-word' };
          const choiceBase: React.CSSProperties = { background: '#FFF9C4', borderRadius: 3, padding: '1px 4px' };

          const renderPdfChunks = (r: VocabChoiceResult, problemId: string, answerId: string, titleStr: string) => {
            const chunks = parseVocabPassage(r.vocab_choice_passage, r.answer_key);
            return (
              <>
                <div id={problemId} style={pdfStyle}>
                  <h2 style={h2Style}>{titleStr}</h2>
                  <p style={pStyle}>
                    {chunks.map((c, i) => {
                      if (c.type === 'text') return <span key={i}>{c.text}</span>;
                      const opts = [c.a, c.b, c.c].filter((o): o is string => o !== undefined);
                      return <span key={i} style={choiceBase}>{c.num}[{opts.join(' / ')}]</span>;
                    })}
                  </p>
                </div>
                <div id={answerId} style={pdfStyle}>
                  <h2 style={h2Style}>{titleStr}</h2>
                  <p style={pStyle}>
                    {chunks.map((c, i) => {
                      if (c.type === 'text') return <span key={i}>{c.text}</span>;
                      const opts = [c.a, c.b, c.c].filter((o): o is string => o !== undefined);
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
                    })}
                  </p>
                  <div style={{ marginTop: 20, padding: '12px 16px', background: '#f8f8f8', borderRadius: 6, fontSize: 12, lineHeight: 1.8 }}>
                    <strong>정답:</strong> {r.answer_key}
                  </div>
                </div>
              </>
            );
          };

          return (
            <>
              {/* 입력 탭 PDF */}
              {result && renderPdfChunks(result, 'vocab-pdf-problem', 'vocab-pdf-answer', inputTitle || '어휘 선택 문제')}
              {/* 모의고사 탭 PDF (전체 결과) */}
              {mockResults.map((r, idx) =>
                renderPdfChunks(r, `vocab-pdf-problem-mock-${idx}`, `vocab-pdf-answer-mock-${idx}`, `${mockTitle || '어휘 선택 문제'} (${r.num}번)`)
              )}
            </>
          );
        })()}

        {/* ── 생성 이력 탭 ── */}
        {activeTab === 'history' && (
          <div className="space-y-4">
            <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-2.5 text-xs font-bold text-amber-700">
              생성 이력은 생성일로부터 30일 후 자동 삭제됩니다.
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
                className="px-4 py-2 bg-indigo-600 text-white text-sm font-black rounded-xl hover:bg-indigo-700 transition-all disabled:opacity-50">
                🔍 검색
              </button>
              {(searchDate || searchQuery) && (
                <button onClick={() => { setSearchDate(''); setSearchQuery(''); fetchHistory('', ''); }}
                  className="px-4 py-2 bg-gray-100 text-gray-600 text-sm font-black rounded-xl hover:bg-gray-200 transition-all">
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
                    className="px-4 py-2 bg-rose-500 text-white rounded-xl font-black text-sm hover:bg-rose-600 disabled:opacity-50 transition-all">
                    {bulkDeleting ? '삭제 중...' : '삭제'}
                  </button>
                  <button onClick={() => setSelectedIds(new Set())} className="px-4 py-2 bg-slate-100 text-slate-500 rounded-xl font-black text-sm hover:bg-slate-200 transition-all">취소</button>
                </div>
              </div>
            )}

            {historyLoading ? (
              <div className="flex justify-center py-16"><div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" /></div>
            ) : historyList.length === 0 ? (
              <div className="bg-white rounded-[2rem] p-16 text-center shadow-lg border border-slate-100">
                <p className="text-5xl mb-4">📭</p>
                <p className="font-black text-slate-500 text-lg">생성된 이력이 없습니다</p>
                <p className="text-slate-400 font-bold text-sm mt-2">문제를 생성하면 자동으로 이곳에 기록돼요</p>
              </div>
            ) : (
              <div className="bg-white rounded-[2rem] shadow-lg border border-slate-100 overflow-hidden">
                <div className="grid grid-cols-[32px_140px_160px_1fr_52px_64px_64px] gap-2 px-4 py-3 bg-slate-50 border-b border-slate-100 text-xs font-black text-slate-500">
                  <input type="checkbox"
                    checked={selectedIds.size === historyList.length && historyList.length > 0}
                    onChange={toggleSelectAll}
                    className="w-4 h-4 rounded accent-indigo-600 cursor-pointer mt-0.5" />
                  {['날짜', '제목', '지문 요약', '난이도', '문제', '정답'].map((h, i) => (
                    <span key={i} className={i >= 4 ? 'text-center' : ''}>{h}</span>
                  ))}
                </div>
                {historyList.map((item, i) => (
                  <div key={item.id}
                    className={`grid grid-cols-[32px_140px_160px_1fr_52px_64px_64px] gap-2 px-4 py-3 items-center border-b border-slate-100 last:border-0 hover:bg-indigo-50/40 transition-colors
                      ${selectedIds.has(item.id) ? 'bg-indigo-50' : i % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}`}>
                    <input type="checkbox" checked={selectedIds.has(item.id)} onChange={() => toggleSelect(item.id)}
                      className="w-4 h-4 rounded accent-indigo-600 cursor-pointer" />
                    <span className="text-xs font-bold text-slate-600 whitespace-nowrap">
                      {new Date(item.created_at).toLocaleString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
                    </span>
                    <span className="text-sm font-bold text-slate-700 truncate" title={item.title || ''}>
                      {item.title || <span className="text-slate-300">-</span>}
                    </span>
                    <span className="text-xs text-slate-500 font-bold truncate">{item.passage_excerpt}</span>
                    <span className={`text-xs font-black px-2 py-1 rounded-full text-center ${DIFF_COLORS[item.difficulty] ?? 'bg-slate-100 text-slate-600'}`}>
                      {item.difficulty?.toUpperCase() || '-'}
                    </span>
                    <div className="flex justify-center">
                      {item.pdf_path ? (
                        <button onClick={() => downloadFromHistory(item.pdf_path!, `${item.title || '어휘선택문제'}_문제.pdf`)}
                          className="px-2 py-1 bg-indigo-100 hover:bg-indigo-200 text-indigo-700 rounded-lg text-xs font-black transition-all w-full text-center">
                          ⬇️ 문제
                        </button>
                      ) : <span className="text-xs text-slate-300 font-bold text-center w-full">저장중</span>}
                    </div>
                    <div className="flex justify-center">
                      {item.answer_pdf_path ? (
                        <button onClick={() => downloadFromHistory(item.answer_pdf_path!, `${item.title || '어휘선택문제'}_정답.pdf`)}
                          className="px-2 py-1 bg-violet-100 hover:bg-violet-200 text-violet-700 rounded-lg text-xs font-black transition-all w-full text-center">
                          ⬇️ 정답
                        </button>
                      ) : <span className="text-xs text-slate-300 font-bold text-center w-full">-</span>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
