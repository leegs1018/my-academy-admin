'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import Image from 'next/image';
import { supabase } from '@/lib/supabase';

interface TFQuestion {
  number: number;
  statement: string;
  answer: 'T' | 'F';
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
  passage_excerpt: string;
  passage_full: string;
  passage_type: string;
  difficulty: string;
  pdf_path: string;
}

// ── 클라이언트 사이드 PDF 생성 (Puppeteer 불필요) ──
async function generatePdfBlob(): Promise<Blob | null> {
  const page1El = document.getElementById('pdf-page-1');
  const page2El = document.getElementById('pdf-page-2');
  if (!page1El || !page2El) return null;

  // UI 전용 요소 임시 숨김
  const noPrintEls = document.querySelectorAll('#print-area .no-print');
  noPrintEls.forEach(el => (el as HTMLElement).style.setProperty('display', 'none', 'important'));

  try {
    const { toJpeg } = await import('html-to-image');
    const { jsPDF } = await import('jspdf');

    const W = 210, M = 5, cW = W - 2 * M, pageH = 297 - 2 * M;

    const p1Ratio = page1El.offsetHeight / page1El.offsetWidth;
    const p2Ratio = page2El.offsetHeight / page2El.offsetWidth;

    // 가로폭을 최대로 쓰되, 세로가 A4를 넘으면 균등 축소
    const scale1 = Math.min(1, pageH / (cW * p1Ratio));
    const scale2 = Math.min(1, pageH / (cW * p2Ratio));

    const opts = { pixelRatio: 2, quality: 0.9, backgroundColor: '#ffffff', cacheBust: true };
    const [url1, url2] = await Promise.all([
      toJpeg(page1El, opts),
      toJpeg(page2El, opts),
    ]);

    const pdf = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });
    pdf.addImage(url1, 'JPEG', M, M, cW * scale1, cW * p1Ratio * scale1);
    pdf.addPage();
    pdf.addImage(url2, 'JPEG', M, M, cW * scale2, cW * p2Ratio * scale2);

    return pdf.output('blob');
  } finally {
    noPrintEls.forEach(el => (el as HTMLElement).style.removeProperty('display'));
  }
}

function renderBold(text: string) {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith('**') && part.endsWith('**')
      ? <strong key={i} className="font-black text-indigo-700">{part.slice(2, -2)}</strong>
      : <span key={i}>{part}</span>
  );
}

const TYPE_COLORS: Record<string, string> = {
  '일반': 'bg-indigo-100 text-indigo-700',
  '논쟁': 'bg-amber-100 text-amber-700',
  '문제': 'bg-rose-100 text-rose-700',
};
const DIFF_COLORS: Record<string, string> = {
  '상': 'bg-red-100 text-red-700',
  '중': 'bg-yellow-100 text-yellow-700',
  '하': 'bg-green-100 text-green-700',
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

  const [difficulty, setDifficulty] = useState<'상' | '중' | '하'>('중');
  const [loading, setLoading] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState('');
  const [result, setResult] = useState<GeneratedMaterials | null>(null);
  const [originalPassageText, setOriginalPassageText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [showAnswerKey, setShowAnswerKey] = useState(false);
  const [copiedSection, setCopiedSection] = useState<string | null>(null);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'done' | 'error'>('idle');
  const [saveErrorMsg, setSaveErrorMsg] = useState('');
  const msgIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [logoDataUrl, setLogoDataUrl] = useState<string | null>(null);

  const [historyList, setHistoryList] = useState<PdfHistoryItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchType, setSearchType] = useState('');
  const [searchDate, setSearchDate] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkDownloading, setBulkDownloading] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [passageModal, setPassageModal] = useState<PdfHistoryItem | null>(null);

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
  const fetchHistory = useCallback(async (query = searchQuery, type = searchType, date = searchDate) => {
    setHistoryLoading(true);
    setHistoryError(null);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setHistoryError('로그인 정보를 확인할 수 없습니다.'); return; }

      let q = supabase
        .from('pdf_history')
        .select('*')
        .eq('academy_id', user.id)
        .order('created_at', { ascending: false });

      if (type) q = q.eq('passage_type', type);
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
  }, [searchQuery, searchType, searchDate]);

  useEffect(() => {
    if (activeTab === 'history') fetchHistory();
  }, [activeTab]);

  // ── 자동 저장 (클라이언트 PDF → 서버 저장) ──
  const autoSavePdf = useCallback(async (generated: GeneratedMaterials, text: string, diff: string) => {
    setSaveStatus('saving');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { setSaveStatus('error'); setSaveErrorMsg('로그인 세션 없음'); return; }

      const pdfBlob = await generatePdfBlob();
      if (!pdfBlob) { setSaveStatus('error'); setSaveErrorMsg('PDF 요소를 찾을 수 없음'); return; }

      const pdfBase64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
        reader.onerror = reject;
        reader.readAsDataURL(pdfBlob);
      });

      const res = await fetch('/api/save-pdf-history', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          pdfBase64,
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
  const downloadFromHistory = async (pdfPath: string, createdAt: string) => {
    const { data } = await supabase.storage.from('pdf-history').createSignedUrl(pdfPath, 3600);
    if (!data?.signedUrl) return;
    const date = new Date(createdAt).toLocaleDateString('ko-KR').replace(/\. /g, '-').replace('.', '');
    const a = document.createElement('a');
    a.href = data.signedUrl;
    a.download = `영어문제_${date}.pdf`;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  // ── 선택 항목 일괄 다운로드 ──
  const downloadSelected = async () => {
    setBulkDownloading(true);
    const items = historyList.filter(i => selectedIds.has(i.id) && i.pdf_path);
    for (const item of items) {
      await downloadFromHistory(item.pdf_path, item.created_at);
      await new Promise(r => setTimeout(r, 800));
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
    if (!canGenerate) return;
    setLoading(true); setError(null); setResult(null); setShowAnswerKey(false);

    const msgs = ['AI가 지문을 읽고 있어요... 🤖', '문제를 생성하고 있어요... ✍️', '어휘 표를 만들고 있어요... 📚', '거의 완성됐어요! 잠시만요... ✨'];
    let idx = 0;
    setLoadingMsg(msgs[0]);
    msgIntervalRef.current = setInterval(() => { idx = (idx + 1) % msgs.length; setLoadingMsg(msgs[idx]); }, 8000);

    try {
      const res = await fetch('/api/process-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: textToSend, difficulty }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || '오류가 발생했습니다.');
      const generated = json.data as GeneratedMaterials;
      setOriginalPassageText(textToSend);
      setResult(generated);
      setSaveStatus('idle');
      // DOM 렌더링 대기 후 자동 저장
      setTimeout(() => autoSavePdf(generated, textToSend, difficulty), 800);
    } catch (e: unknown) {
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

  // ── PDF 다운로드 (클라이언트 사이드) ──
  const handleDownloadPDF = async () => {
    setPdfLoading(true);
    try {
      const blob = await generatePdfBlob();
      if (!blob) throw new Error('PDF 요소를 찾을 수 없습니다.');
      const url = URL.createObjectURL(blob);
      const today = new Date().toLocaleDateString('ko-KR').replace(/\. /g, '-').replace('.', '');
      const a = document.createElement('a');
      a.href = url;
      a.download = `영어문제_${today}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {
      alert(`PDF 저장 실패: ${e instanceof Error ? e.message : '오류'}`);
    } finally {
      setPdfLoading(false);
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
        <h1 className="text-4xl font-black text-slate-900 tracking-tighter">📝 영어 문제 생성</h1>
        <p className="text-slate-500 font-bold mt-2">지문을 입력하거나 사진을 등록하면 AI가 5가지 교육 자료를 만들어드려요</p>
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
                  onChange={(e) => { setManualText(e.target.value); setResult(null); }}
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

            <div className="mt-6 flex flex-wrap items-center gap-4">
              <span className="font-black text-slate-700 text-lg">난이도 선택:</span>
              {(['상', '중', '하'] as const).map((d) => (
                <button key={d} onClick={() => setDifficulty(d)}
                  className={`px-8 py-3 rounded-2xl font-black text-xl transition-all
                    ${difficulty === d ? 'bg-indigo-600 text-white shadow-lg scale-105' : 'bg-slate-100 text-slate-500 hover:bg-indigo-50 hover:text-indigo-600'}`}>
                  {d}
                </button>
              ))}
              <span className="text-sm text-slate-400 font-bold">
                {difficulty === '상' ? '수능/내신 상위권' : difficulty === '중' ? '일반 고등학교 내신' : '중학교~고등 초급'}
              </span>
            </div>

            <button onClick={handleGenerate} disabled={!canGenerate}
              className="mt-6 w-full bg-indigo-600 text-white py-5 rounded-2xl font-black text-xl shadow-xl hover:bg-indigo-700 active:scale-[0.98] transition-all disabled:opacity-40 disabled:cursor-not-allowed">
              AI로 문제 생성하기 🚀
            </button>
          </div>

          {/* ── 결과 영역 ── */}
          {result && (
            <div id="print-area" className="space-y-0">

              {/* ── 1페이지: 원문 + 01 + 02 ── */}
              <div id="pdf-page-1" className="space-y-4 mb-4">

                {/* 원문 */}
                <div className="bg-white rounded-2xl shadow-lg border border-slate-100 overflow-hidden">
                  <div className="bg-slate-700 px-5 py-2.5 flex items-center gap-3">
                    <span className="text-white/70 font-black text-lg leading-none">00</span>
                    <div>
                      <h2 className="text-white font-black text-sm leading-tight">원문 지문</h2>
                      <p className="text-white/80 font-bold text-xs mt-0.5">Original Passage</p>
                    </div>
                  </div>
                  <div className="p-4">
                    <p className="text-slate-700 font-bold leading-loose whitespace-pre-wrap text-base">{originalPassageText}</p>
                  </div>
                </div>

                <SectionCard number="01" title="한글 요약" subtitle="지문 유형별 구조 · 고등 시험 대비용"
                  color="bg-indigo-500"
                  onCopy={() => copy(result.korean_summary.rows.map(r => `[${r.label}] ${r.content}`).join('\n'), 'korean')}
                  copied={copiedSection === 'korean'}>
                  <div>
                    <span className="inline-block mb-4 bg-indigo-100 text-indigo-700 text-xs font-black px-3 py-1 rounded-full">
                      {result.korean_summary.type === '일반' ? '일반 지문' : result.korean_summary.type === '논쟁' ? '논쟁 지문' : '문제 지문'}
                    </span>
                    <table className="w-full border-collapse">
                      <tbody>
                        {result.korean_summary.rows.map((row, i) => (
                          <tr key={i} className={i % 2 === 0 ? 'bg-indigo-50' : 'bg-white'}>
                            <td className="w-20 p-2 font-black text-indigo-700 text-xs border border-indigo-100 whitespace-nowrap align-top">{row.label}</td>
                            <td className="p-2 text-slate-700 font-bold text-base leading-loose border border-indigo-100">{row.content}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </SectionCard>

                <SectionCard number="02" title="T/F 문제 10개" subtitle="본문에 사용되지 않은 어휘 · T 5개 F 5개"
                  color="bg-violet-500" onCopy={() => copy(buildTFText(), 'tf')} copied={copiedSection === 'tf'}>
                  <div className="space-y-1.5 mb-3">
                    {result.tf_questions.map((q) => (
                      <div key={q.number} className="flex items-start gap-2 px-2 py-1.5 rounded-lg hover:bg-violet-50 transition-colors">
                        <span className="font-black text-violet-600 w-7 shrink-0 text-base">{q.number}.</span>
                        <p className="text-slate-700 font-bold leading-relaxed flex-1 text-base">{q.statement}</p>
                      </div>
                    ))}
                  </div>
                  <div className="border-t border-violet-100 pt-4">
                    <button onClick={() => setShowAnswerKey(!showAnswerKey)}
                      className="no-print flex items-center gap-2 text-violet-600 font-black hover:text-violet-800 transition-colors">
                      <span className={`transition-transform ${showAnswerKey ? 'rotate-90' : ''}`}>▶</span>
                      해설지 {showAnswerKey ? '닫기' : '보기'}
                    </button>
                    {showAnswerKey && (
                      <div className="mt-3 p-4 bg-violet-50 rounded-2xl border border-violet-100">
                        <div className="flex justify-between mb-2">
                          <span className="font-black text-violet-700">정답</span>
                          <button onClick={() => copy(result.answer_key, 'answer_key')}
                            className="no-print text-xs font-black text-violet-500 hover:text-violet-700">
                            {copiedSection === 'answer_key' ? '✅ 복사됨' : '📋 복사'}
                          </button>
                        </div>
                        <p className="font-black text-slate-700 tracking-wide">{result.answer_key}</p>
                      </div>
                    )}
                  </div>
                </SectionCard>
              </div>

              {/* ── 2페이지: 03 + 04 + 05 + 로고 ── */}
              <div id="pdf-page-2" className="space-y-4">

                <SectionCard number="03" title="영어 제목 3가지" subtitle="한글 번역 포함 · 시험 대비용"
                  color="bg-amber-500"
                  onCopy={() => copy(result.english_titles.map((t, i) => `${i + 1}. ${t}`).join('\n'), 'titles')}
                  copied={copiedSection === 'titles'}>
                  <div className="space-y-2">
                    {result.english_titles.map((title, i) => (
                      <div key={i} className="flex items-start gap-2 px-3 py-2 bg-amber-50 rounded-xl border border-amber-100">
                        <span className="font-black text-amber-600 w-7 shrink-0 text-base">{i + 1}.</span>
                        <p className="text-slate-700 font-bold leading-relaxed text-base">{title}</p>
                      </div>
                    ))}
                  </div>
                </SectionCard>

                <SectionCard number="04" title="1문장 영어 요약 3가지" subtitle="본문에 없는 단어 사용 · 핵심 어휘 볼드체"
                  color="bg-rose-500" onCopy={() => copy(buildOneSentenceText(), 'one_sentence')} copied={copiedSection === 'one_sentence'}>
                  <div className="space-y-2">
                    {result.one_sentence_summaries.map((s, i) => (
                      <div key={i} className="px-3 py-2 bg-rose-50 rounded-xl border border-rose-100">
                        <div className="flex items-start gap-2">
                          <span className="font-black text-rose-600 w-7 shrink-0 text-base">{i + 1}.</span>
                          <div className="flex-1">
                            <p className="text-slate-700 font-bold leading-relaxed text-base mb-1">{renderBold(s.english)}</p>
                            <p className="text-slate-500 font-bold text-sm">({s.korean})</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </SectionCard>

                <SectionCard number="05" title="관련 어휘 10개" subtitle="지문 내 어휘 추출 · 동의어 3개 · 반의어 1개 · 한글 뜻 포함 (총 40개)"
                  color="bg-slate-700" onCopy={() => copy(buildVocabText(), 'vocab')} copied={copiedSection === 'vocab'}>
                  <div className="overflow-x-auto">
                    <table id="vocab-table" className="w-full text-sm border-collapse">
                      <thead>
                        <tr className="bg-slate-800 text-white">
                          {['표제어 (뜻)', '유의어 1 (뜻)', '유의어 2 (뜻)', '유의어 3 (뜻)', '반의어 (뜻)'].map((h, i) => (
                            <th key={i} className={`px-2 py-2 text-left font-black whitespace-nowrap ${i === 0 ? 'rounded-tl-lg' : ''} ${i === 4 ? 'rounded-tr-lg' : ''}`}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {result.vocabulary_table.map((row, i) => (
                          <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                            <td className="px-2 py-2 border-b border-slate-100">
                              <span className="font-black text-indigo-700">{row.word}</span>
                              <span className="text-slate-400 text-xs ml-1">({row.meaning})</span>
                            </td>
                            {[[row.syn1, row.syn1_m], [row.syn2, row.syn2_m], [row.syn3, row.syn3_m]].map(([w, m], j) => (
                              <td key={j} className="px-2 py-2 border-b border-slate-100">
                                <span className="font-bold text-slate-700">{w}</span>
                                <span className="text-slate-400 text-xs ml-1">({m})</span>
                              </td>
                            ))}
                            <td className="px-2 py-2 border-b border-slate-100">
                              <span className="font-black text-rose-600">{row.antonym}</span>
                              <span className="text-slate-400 text-xs ml-1">({row.antonym_m})</span>
                            </td>
                          </tr>
                        ))}
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
            </div>
          )}

          {result && (
            <div className="no-print fixed bottom-8 right-8 flex flex-col items-end gap-3 z-50">
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
              <div className="flex gap-3">
                <button onClick={handleDownloadPDF} disabled={pdfLoading}
                  className="bg-indigo-600 text-white px-6 py-4 rounded-2xl font-black text-lg shadow-2xl hover:bg-indigo-700 active:scale-95 transition-all disabled:opacity-50">
                  {pdfLoading ? '⏳ 생성 중...' : '⬇️ PDF 저장'}
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* ══ 생성 이력 탭 ══ */}
      {activeTab === 'history' && (
        <div className="space-y-4">
          <div className="bg-white p-5 rounded-[2rem] shadow-lg border border-slate-100">
            <div className="flex flex-wrap gap-3 items-end">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-black text-slate-500">날짜</label>
                <input type="date" value={searchDate} onChange={(e) => setSearchDate(e.target.value)}
                  className="px-4 py-2.5 border-2 border-slate-200 rounded-xl font-bold text-sm focus:outline-none focus:border-indigo-400 transition-colors" />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-black text-slate-500">지문 유형</label>
                <select value={searchType} onChange={(e) => setSearchType(e.target.value)}
                  className="px-4 py-2.5 border-2 border-slate-200 rounded-xl font-bold text-sm focus:outline-none focus:border-indigo-400 transition-colors bg-white">
                  <option value="">전체</option>
                  <option value="일반">일반</option>
                  <option value="논쟁">논쟁</option>
                  <option value="문제">문제</option>
                </select>
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
              {(searchDate || searchType || searchQuery) && (
                <button onClick={() => { setSearchDate(''); setSearchType(''); setSearchQuery(''); fetchHistory('', '', ''); }}
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
              <div className="grid grid-cols-[40px_160px_80px_60px_1fr_52px] gap-3 px-5 py-3 bg-slate-50 border-b border-slate-100">
                <input type="checkbox" checked={selectedIds.size === historyList.length && historyList.length > 0}
                  onChange={toggleSelectAll} className="w-4 h-4 rounded accent-indigo-600 cursor-pointer mt-0.5" />
                {['날짜', '유형', '난이도', '지문 요약', 'PDF'].map((h, i) => (
                  <span key={i} className={`text-xs font-black text-slate-500 ${i === 4 ? 'text-center' : ''}`}>{h}</span>
                ))}
              </div>
              {historyList.map((item, i) => (
                <div key={item.id}
                  className={`grid grid-cols-[40px_160px_80px_60px_1fr_52px] gap-3 px-5 py-4 items-center
                    ${selectedIds.has(item.id) ? 'bg-indigo-50' : i % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}
                    border-b border-slate-100 last:border-0 hover:bg-indigo-50/60 transition-colors`}>
                  <input type="checkbox" checked={selectedIds.has(item.id)} onChange={() => toggleSelect(item.id)}
                    className="w-4 h-4 rounded accent-indigo-600 cursor-pointer" />
                  <span className="text-sm font-bold text-slate-600 whitespace-nowrap">
                    {new Date(item.created_at).toLocaleString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
                  </span>
                  <span className={`text-xs font-black px-2 py-1 rounded-full w-fit ${TYPE_COLORS[item.passage_type] ?? 'bg-slate-100 text-slate-600'}`}>
                    {item.passage_type || '-'}
                  </span>
                  <span className={`text-xs font-black px-2 py-1 rounded-full w-fit ${DIFF_COLORS[item.difficulty] ?? 'bg-slate-100 text-slate-600'}`}>
                    {item.difficulty || '-'}
                  </span>
                  <button onClick={() => setPassageModal(item)}
                    className="text-sm text-slate-600 font-bold truncate text-left hover:text-indigo-600 hover:underline transition-colors w-full">
                    {item.passage_excerpt}
                  </button>
                  {item.pdf_path ? (
                    <button onClick={() => downloadFromHistory(item.pdf_path, item.created_at)} title="PDF 다운로드"
                      className="flex items-center justify-center w-10 h-10 bg-indigo-100 hover:bg-indigo-200 text-indigo-600 rounded-xl transition-all active:scale-90 mx-auto">
                      <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5 5-5M12 4v11" />
                      </svg>
                    </button>
                  ) : (
                    <span className="text-xs text-slate-300 font-bold text-center mx-auto">저장중</span>
                  )}
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
              <div className="flex items-center gap-3">
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

function SectionCard({ number, title, subtitle, color, onCopy, copied, children }: {
  number: string; title: string; subtitle: string; color: string;
  onCopy: () => void; copied: boolean; children: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-2xl shadow-lg border border-slate-100 overflow-hidden">
      <div className={`${color} px-5 py-2.5 flex items-center justify-between`}>
        <div className="flex items-center gap-3">
          <span className="text-white/70 font-black text-lg leading-none">{number}</span>
          <div>
            <h2 className="text-white font-black text-sm leading-tight">{title}</h2>
            <p className="text-white/80 font-bold text-xs mt-0.5">{subtitle}</p>
          </div>
        </div>
        <button onClick={onCopy}
          className="no-print bg-white/20 hover:bg-white/30 text-white font-black text-xs px-3 py-1.5 rounded-xl transition-all active:scale-95">
          {copied ? '✅ 복사됨' : '📋 복사'}
        </button>
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}
