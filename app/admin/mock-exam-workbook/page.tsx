'use client';

import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

// ── 타입 ─────────────────────────────────────────────────────────────────────
interface TFQuestion { number: number; statement: string; answer: 'T' | 'F'; explanation?: string; }
interface VocabRow {
  word: string; meaning: string;
  syn1: string; syn1_m: string; syn2: string; syn2_m: string;
  syn3: string; syn3_m: string; antonym: string; antonym_m: string;
}
interface KoreanSummary { type: '일반' | '논쟁' | '문제'; rows: { label: string; content: string }[]; }
interface GeneratedMaterials {
  paraphrased_passage?: string;
  tf_questions: TFQuestion[];
  answer_key: string;
  korean_summary: KoreanSummary;
  english_titles: string[];
  one_sentence_summaries: { english: string; korean: string }[];
  vocabulary_table: VocabRow[];
}
interface WorkbookResult { number: string; passageText: string; materials: GeneratedMaterials; }
interface HistoryItem {
  id: string; created_at: string;
  year: number; grade: string; institution: string; question_number: number;
  difficulty: string; pdf_path: string; answer_pdf_path?: string;
}

const DIFF_OPTIONS = [
  { key: 'b1' as const, level: 'B1', label: '중등/고등 하', icon: '🌱', active: 'border-sky-400 bg-sky-50 text-sky-700' },
  { key: 'b2' as const, level: 'B2', label: '고등 중',      icon: '🌳', active: 'border-emerald-500 bg-emerald-50 text-emerald-700' },
  { key: 'c1' as const, level: 'C1', label: '고등 상',      icon: '🔥', active: 'border-orange-500 bg-orange-50 text-orange-700' },
  { key: 'c2' as const, level: 'C2', label: '고등 최상',    icon: '⚡', active: 'border-rose-500 bg-rose-50 text-rose-700' },
] as const;

// ── 헬퍼 함수 ────────────────────────────────────────────────────────────────
function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click();
  document.body.removeChild(a); URL.revokeObjectURL(url);
}

async function generatePdfBlob(hideAnswerArea = false, suffix = ''): Promise<Blob | null> {
  const page1El = document.getElementById(`mw-pdf-page-1${suffix}`);
  const page2El = document.getElementById(`mw-pdf-page-2${suffix}`);
  if (!page1El || !page2El) return null;
  const noPrintEls = document.querySelectorAll(`#mw-print-area${suffix} .no-print`);
  noPrintEls.forEach(el => (el as HTMLElement).style.setProperty('display', 'none', 'important'));
  const answerAreaEls = hideAnswerArea ? document.querySelectorAll('.mw-answer-area') : null;
  answerAreaEls?.forEach(el => (el as HTMLElement).style.setProperty('display', 'none', 'important'));
  try {
    const { toJpeg } = await import('html-to-image');
    const { jsPDF } = await import('jspdf');
    const W = 210, M = 5, cW = W - 2 * M;
    const maxRatio = (297 - 2 * M) / cW; // A4 콘텐츠 최대 비율 (287/200 = 1.435)
    const opts = { pixelRatio: 2, quality: 0.9, backgroundColor: '#ffffff', cacheBust: true };
    const [url1, url2] = await Promise.all([toJpeg(page1El, opts), toJpeg(page2El, opts)]);
    const pdf = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });

    // 이미지가 A4를 초과하면 Canvas로 슬라이싱해 여러 페이지에 나눠 삽입
    const addPaged = async (url: string, newPage: boolean) => {
      const img = await new Promise<HTMLImageElement>(r => {
        const i = document.createElement('img') as HTMLImageElement; i.onload = () => r(i); i.src = url;
      });
      const iW = img.naturalWidth, iH = img.naturalHeight;
      if (iH / iW <= maxRatio) {
        if (newPage) pdf.addPage();
        pdf.addImage(url, 'JPEG', M, M, cW, cW * (iH / iW));
        return;
      }
      const sliceHpx = Math.floor(iW * maxRatio);
      let y = 0, first = true;
      while (y < iH) {
        const h = Math.min(sliceHpx, iH - y);
        const cv = document.createElement('canvas');
        cv.width = iW; cv.height = h;
        const ctx = cv.getContext('2d')!;
        ctx.fillStyle = '#fff';
        ctx.fillRect(0, 0, iW, h);
        ctx.drawImage(img, 0, -y);
        const sliceUrl = cv.toDataURL('image/jpeg', 0.92);
        if (newPage || !first) pdf.addPage();
        first = false;
        pdf.addImage(sliceUrl, 'JPEG', M, M, cW, cW * (h / iW));
        y += sliceHpx;
      }
    };

    await addPaged(url1, false);
    await addPaged(url2, true);
    return pdf.output('blob');
  } finally {
    noPrintEls.forEach(el => (el as HTMLElement).style.removeProperty('display'));
    answerAreaEls?.forEach(el => (el as HTMLElement).style.removeProperty('display'));
  }
}

async function buildAnswerPdfBlob(res: GeneratedMaterials, title: string): Promise<Blob> {
  const { toJpeg } = await import('html-to-image');
  const { jsPDF } = await import('jspdf');
  const el = document.createElement('div');
  el.style.cssText = 'position:fixed;top:0;left:0;width:800px;background:white;padding:40px;box-sizing:border-box;font-family:Arial,Helvetica,sans-serif;z-index:-9999;';
  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  let html = '';
  if (title) html += `<h1 style="font-size:22px;font-weight:900;color:#1e293b;margin:0 0 24px;">${esc(title)}</h1>`;
  html += `<div style="margin-bottom:24px;"><h2 style="font-size:16px;font-weight:900;color:#7c3aed;margin:0 0 8px;">T/F 정답</h2>`;
  html += `<p style="font-size:15px;font-weight:700;color:#334155;letter-spacing:0.05em;margin:0;">${esc(res.answer_key)}</p></div>`;
  if (res.tf_questions.some(q => q.explanation)) {
    html += `<div><h2 style="font-size:16px;font-weight:900;color:#7c3aed;margin:0 0 12px;">해설</h2><div style="display:flex;flex-direction:column;gap:10px;">`;
    for (const q of res.tf_questions) {
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
function cleanKorean(s: string) { return s.replace(/^\(\(|\)\)$/g, '').replace(/\*\*/g, '*').trim(); }
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

function SectionCard({ number, title, color, onCopy, copied, children, theme = 'mono' }: {
  number: string; title: string; color: string;
  onCopy: () => void; copied: boolean; children: React.ReactNode; theme?: 'color' | 'mono';
}) {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-lg overflow-hidden">
      <div className={`${theme === 'color' ? color : 'bg-slate-700'} px-5 py-2.5 flex items-center justify-between`}>
        <div className="flex items-center gap-3">
          <span className="font-black text-2xl leading-none text-white/70">{number}</span>
          <h2 className="font-black text-lg leading-tight text-white">{title}</h2>
        </div>
        <button onClick={onCopy} className="no-print font-black text-xs px-3 py-1.5 rounded-xl bg-white/20 hover:bg-white/30 text-white transition-all active:scale-95">
          {copied ? '✅ 복사됨' : '📋 복사'}
        </button>
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

// ── 메인 컴포넌트 ─────────────────────────────────────────────────────────────
export default function MockExamWorkbookPage() {
  const [activeTab, setActiveTab] = useState<'generate' | 'history'>('generate');

  // 캐스케이드 셀렉트
  const [years, setYears] = useState<number[]>([]);
  const [grades, setGrades] = useState<string[]>([]);
  const [institutions, setInstitutions] = useState<string[]>([]);
  const [questionNumbers, setQuestionNumbers] = useState<number[]>([]);
  const [selectedYear, setSelectedYear] = useState('');
  const [selectedGrade, setSelectedGrade] = useState('');
  const [selectedInstitution, setSelectedInstitution] = useState('');

  // 다중 지문 선택
  const [selectedNumbers, setSelectedNumbers] = useState<string[]>([]);
  const [passageMap, setPassageMap] = useState<Record<string, string>>({});
  const [loadingNumbers, setLoadingNumbers] = useState<Set<string>>(new Set());

  // 난이도 + 생성
  const [difficulty, setDifficulty] = useState<'b1' | 'b2' | 'c1' | 'c2'>('b2');
  const [loading, setLoading] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState('');
  const [error, setError] = useState<string | null>(null);

  // 결과 (다중 워크북)
  const [results, setResults] = useState<WorkbookResult[]>([]);
  const [activeResultTab, setActiveResultTab] = useState(0);

  // 뷰 상태 (탭별)
  const [showAnswerKeyMap, setShowAnswerKeyMap] = useState<Record<number, boolean>>({});
  const [copiedSection, setCopiedSection] = useState<string | null>(null);
  const [editModeIdx, setEditModeIdx] = useState<number | null>(null);
  const [editedResults, setEditedResults] = useState<Record<number, GeneratedMaterials>>({});
  const [editSaveStatusMap, setEditSaveStatusMap] = useState<Record<number, 'idle' | 'saving' | 'done' | 'error'>>({});

  // PDF
  const [pdfTitle, setPdfTitle] = useState('');
  const [pdfLoading, setPdfLoading] = useState<false | '문제' | '답안'>(false);
  const [printTheme, setPrintTheme] = useState<'color' | 'mono'>('mono');

  // 저장
  const [saveStatusMap, setSaveStatusMap] = useState<Record<number, 'idle' | 'saving' | 'done' | 'error'>>({});
  const [savedSet, setSavedSet] = useState<Set<number>>(new Set());

  // 이력
  const [historyList, setHistoryList] = useState<HistoryItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [searchDate, setSearchDate] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [session, setSession] = useState<{ access_token: string; user: { id: string } } | null>(null);
  const [pdfAnalysisPrice, setPdfAnalysisPrice] = useState<number | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session: s } }) => { if (s) setSession(s as typeof session); });
  }, []);

  useEffect(() => {
    fetch('/api/credits/pricing')
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        const item = (data?.pricing ?? []).find((p: { feature_key: string; cost_per_use: number }) => p.feature_key === 'mock_workbook') ?? (data?.pricing ?? []).find((p: { feature_key: string; cost_per_use: number }) => p.feature_key === 'pdf_analysis');
        if (item) setPdfAnalysisPrice(item.cost_per_use);
      }).catch(() => {});
  }, []);

  // 캐스케이드 fetch
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
    supabase.from('mock_exam_passages').select('institution').eq('year', parseInt(selectedYear)).eq('grade', selectedGrade)
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
    supabase.from('mock_exam_passages').select('question_number')
      .eq('year', parseInt(selectedYear)).eq('grade', selectedGrade).eq('institution', selectedInstitution)
      .order('question_number')
      .then(({ data }) => { setQuestionNumbers((data ?? []).map((r: { question_number: number }) => r.question_number)); });
  }, [selectedYear, selectedGrade, selectedInstitution]);

  // 탭 전환 시 자동 저장
  useEffect(() => {
    if (!results[activeResultTab] || savedSet.has(activeResultTab) || !session) return;
    const timer = setTimeout(() => {
      autoSave(activeResultTab);
    }, 800);
    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeResultTab, results]);

  // 다중 지문 토글
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
      const text = (data?.passage_text ?? '').replace(/\n+/g, ' ').replace(/\s+/g, ' ').trim();
      setPassageMap(prev => ({ ...prev, [num]: text }));
      setLoadingNumbers(prev => { const next = new Set(prev); next.delete(num); return next; });
    }
  };

  // 이력 조회
  const fetchHistory = useCallback(async (date = searchDate, query = searchQuery) => {
    if (!session) return;
    setHistoryLoading(true); setHistoryError(null);
    try {
      await fetch('/api/cleanup-old-history', { method: 'POST' });
      let q = supabase.from('mock_workbook_history').select('*').eq('academy_id', session.user.id).order('created_at', { ascending: false });
      if (date) q = q.gte('created_at', date).lte('created_at', date + 'T23:59:59');
      if (query) q = q.ilike('institution', `%${query}%`);
      const { data, error: fetchErr } = await q;
      if (fetchErr) { setHistoryError(`조회 오류: ${fetchErr.message}`); return; }
      setHistoryList(data ?? []);
    } catch (e) {
      setHistoryError(e instanceof Error ? e.message : '알 수 없는 오류');
    } finally { setHistoryLoading(false); }
  }, [session, searchDate, searchQuery]);

  useEffect(() => { if (activeTab === 'history' && session) fetchHistory(); }, [activeTab, session]);

  // 자동 저장 (탭별)
  const autoSave = useCallback(async (idx: number) => {
    if (!session || savedSet.has(idx)) return;
    const r = results[idx];
    if (!r) return;
    setSaveStatusMap(prev => ({ ...prev, [idx]: 'saving' }));
    setSavedSet(prev => new Set([...prev, idx]));
    try {
      const suffix = `-${idx}`;
      const [pdfBlob, answerBlob] = await Promise.all([
        generatePdfBlob(true, suffix),
        buildAnswerPdfBlob(r.materials, pdfTitle.trim()),
      ]);
      if (!pdfBlob) { setSaveStatusMap(prev => ({ ...prev, [idx]: 'error' })); return; }
      const toBase64 = (blob: Blob) => new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
      const [pdfBase64, answerPdfBase64] = await Promise.all([toBase64(pdfBlob), toBase64(answerBlob)]);
      const res = await fetch('/api/save-mock-workbook-history', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({
          pdfBase64, answerPdfBase64,
          year: parseInt(selectedYear), grade: selectedGrade, institution: selectedInstitution,
          questionNumber: parseInt(r.number), difficulty,
        }),
      });
      const json = await res.json() as { success?: boolean; error?: string };
      setSaveStatusMap(prev => ({ ...prev, [idx]: res.ok && json.success ? 'done' : 'error' }));
    } catch { setSaveStatusMap(prev => ({ ...prev, [idx]: 'error' })); }
  }, [session, results, savedSet, pdfTitle, selectedYear, selectedGrade, selectedInstitution, difficulty]);

  // 생성
  const handleGenerate = async () => {
    const sortedNums = [...selectedNumbers].sort((a, b) => parseInt(a) - parseInt(b));
    if (sortedNums.length === 0 || loading || !session) return;
    setLoading(true); setError(null); setResults([]); setActiveResultTab(0);
    setSaveStatusMap({}); setSavedSet(new Set()); setEditModeIdx(null); setEditedResults({});

    try {
      for (let i = 0; i < sortedNums.length; i++) {
        const num = sortedNums[i];
        const text = passageMap[num];
        if (!text) continue;
        setLoadingMsg(`${num}번 지문 워크북 생성 중... (${i + 1}/${sortedNums.length})`);
        const res = await fetch('/api/process-pdf', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text, difficulty, academy_id: session.user.id, feature_key: 'mock_workbook' }),
        });
        const rawText = await res.text();
        const json = JSON.parse(rawText) as { data?: GeneratedMaterials; error?: string };
        if (!res.ok) throw new Error(json.error || `${num}번 생성 오류`);
        setResults(prev => [...prev, { number: num, passageText: text, materials: json.data as GeneratedMaterials }]);
        setActiveResultTab(i);
      }
    } catch (e) { setError(e instanceof Error ? e.message : '오류가 발생했습니다.'); }
    finally { setLoading(false); }
  };

  const copy = async (text: string, id: string) => {
    try { await navigator.clipboard.writeText(text); } catch { /* ignore */ }
    setCopiedSection(id); setTimeout(() => setCopiedSection(null), 2000);
  };

  const handleDownloadProblem = async () => {
    setPdfLoading('문제');
    const isEditing = editModeIdx === activeResultTab;
    try {
      if (isEditing) { setEditModeIdx(null); await new Promise(r => requestAnimationFrame(r)); await new Promise(r => requestAnimationFrame(r)); }
      const blob = await generatePdfBlob(true, `-${activeResultTab}`);
      if (isEditing) setEditModeIdx(activeResultTab);
      if (!blob) throw new Error('PDF 요소를 찾을 수 없습니다.');
      const r = results[activeResultTab];
      triggerDownload(blob, `${pdfTitle.trim() || `${r?.number}번_워크북`}_문제.pdf`);
    } catch (e) {
      if (isEditing) setEditModeIdx(activeResultTab);
      alert(`PDF 저장 실패: ${e instanceof Error ? e.message : '오류'}`);
    }
    finally { setPdfLoading(false); }
  };

  const handleDownloadAnswer = async () => {
    const r = results[activeResultTab];
    if (!r) return;
    const d = editedResults[activeResultTab] ?? r.materials;
    setPdfLoading('답안');
    try {
      const blob = await buildAnswerPdfBlob(d, pdfTitle.trim() || `${r.number}번 워크북`);
      triggerDownload(blob, `${pdfTitle.trim() || `${r.number}번_워크북`}_답안해설.pdf`);
    } catch (e) { alert(`PDF 저장 실패: ${e instanceof Error ? e.message : '오류'}`); }
    finally { setPdfLoading(false); }
  };

  const handleEditSave = async (idx: number) => {
    const edited = editedResults[idx];
    const r = results[idx];
    if (!edited || !r || !session) return;
    setEditSaveStatusMap(prev => ({ ...prev, [idx]: 'saving' }));
    const isEditing = editModeIdx === idx;
    try {
      if (isEditing) { setEditModeIdx(null); await new Promise(r => requestAnimationFrame(r)); await new Promise(r => requestAnimationFrame(r)); }
      const [pdfBlob, answerBlob] = await Promise.all([generatePdfBlob(true, `-${idx}`), buildAnswerPdfBlob(edited, pdfTitle.trim())]);
      if (isEditing) setEditModeIdx(idx);
      if (!pdfBlob) { setEditSaveStatusMap(prev => ({ ...prev, [idx]: 'error' })); return; }
      const toBase64 = (blob: Blob) => new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
      const [pdfBase64, answerPdfBase64] = await Promise.all([toBase64(pdfBlob), toBase64(answerBlob)]);
      const res = await fetch('/api/save-mock-workbook-history', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({
          pdfBase64, answerPdfBase64,
          year: parseInt(selectedYear), grade: selectedGrade, institution: selectedInstitution,
          questionNumber: parseInt(r.number), difficulty,
        }),
      });
      const json = await res.json() as { success?: boolean };
      setEditSaveStatusMap(prev => ({ ...prev, [idx]: res.ok && json.success ? 'done' : 'error' }));
    } catch { if (isEditing) setEditModeIdx(idx); setEditSaveStatusMap(prev => ({ ...prev, [idx]: 'error' })); }
  };

  const downloadFromHistory = async (path: string, filename: string) => {
    const { data: { session: sess } } = await supabase.auth.getSession();
    if (!sess) { alert('로그인이 필요합니다.'); return; }
    const res = await fetch('/api/get-signed-url', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sess.access_token}` },
      body: JSON.stringify({ path }),
    });
    const json = await res.json() as { signedUrl?: string; error?: string };
    if (!res.ok || !json.signedUrl) { alert('다운로드 링크 생성에 실패했습니다.'); return; }
    const blob = await fetch(json.signedUrl).then(r => r.blob());
    triggerDownload(blob, filename);
  };

  const deleteSelected = async () => {
    if (!session || selectedIds.size === 0) return;
    setBulkDeleting(true);
    try {
      await fetch('/api/delete-mock-workbook-history', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ ids: [...selectedIds] }),
      });
      setSelectedIds(new Set()); fetchHistory();
    } finally { setBulkDeleting(false); }
  };

  const sortedSelectedNumbers = [...selectedNumbers].sort((a, b) => parseInt(a) - parseInt(b));
  const allPassagesReady = selectedNumbers.length > 0 && selectedNumbers.every(n => passageMap[n]) && loadingNumbers.size === 0;
  const canGenerate = allPassagesReady && !loading && !!session;

  const activeResult = results[activeResultTab];
  const activeD = (editModeIdx === activeResultTab ? editedResults[activeResultTab] : null) ?? activeResult?.materials;

  return (
    <div className="pb-32">
      {loading && (
        <div className="no-print fixed inset-0 bg-indigo-900/60 backdrop-blur-md z-[200] flex items-center justify-center">
          <div className="bg-white rounded-[2.5rem] p-12 text-center shadow-2xl max-w-sm mx-4">
            <div className="w-16 h-16 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-6" />
            <p className="font-black text-indigo-600 text-xl animate-pulse">{loadingMsg}</p>
            <p className="text-slate-400 font-bold text-sm mt-3">지문당 30~60초 소요됩니다</p>
          </div>
        </div>
      )}

      <div className="no-print mb-6">
        <h1 className="text-4xl font-black text-slate-900 tracking-tighter">📖 모의고사 툴/워크북</h1>
        <p className="text-slate-500 font-bold mt-2">기출 지문을 선택하면 AI가 워크북 자료를 자동으로 만들어드려요</p>
      </div>

      <div className="no-print flex gap-2 mb-6 border-b-2 border-slate-100">
        {(['generate', 'history'] as const).map((tab) => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className={`px-6 py-3 font-black text-base rounded-t-xl transition-all ${activeTab === tab ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-600'}`}>
            {tab === 'generate' ? '✏️ 문제 생성' : '📋 생성 이력'}
          </button>
        ))}
      </div>

      {/* ══ 생성 탭 ══ */}
      {activeTab === 'generate' && (
        <>
          <div className="no-print bg-white p-8 rounded-[2.5rem] shadow-xl border border-slate-100 mb-8">
            <div className="mb-6">
              <label className="text-sm font-black text-slate-600 mb-2 block">제목 (PDF 파일명)</label>
              <input type="text" value={pdfTitle} onChange={e => setPdfTitle(e.target.value)}
                placeholder="예: 2024 수능 워크북"
                className="w-full px-5 py-3 border-2 border-slate-200 rounded-2xl font-bold text-slate-700 focus:outline-none focus:border-indigo-400 transition-colors placeholder:text-slate-300" />
            </div>

            {/* STEP 1 — 기출 지문 선택 */}
            <div className="mb-6">
              <p className="text-base font-black text-slate-700 mb-3">STEP 1 — 기출 지문 선택</p>
              <div className="grid grid-cols-3 gap-3 mb-4">
                {[
                  { label: '년도', value: selectedYear, onChange: setSelectedYear, disabled: false, options: years.map(y => ({ value: String(y), label: `${y}년` })) },
                  { label: '학년', value: selectedGrade, onChange: setSelectedGrade, disabled: !selectedYear, options: grades.map(g => ({ value: g, label: g })) },
                  { label: '시험명/기관', value: selectedInstitution, onChange: setSelectedInstitution, disabled: !selectedGrade, options: institutions.map(i => ({ value: i, label: i })) },
                ].map(({ label, value, onChange, disabled, options }) => (
                  <div key={label}>
                    <label className="block text-xs font-black text-slate-400 mb-1.5">{label}</label>
                    <select value={value} onChange={e => onChange(e.target.value)} disabled={disabled}
                      className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm font-bold bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300 disabled:opacity-50">
                      <option value="">선택</option>
                      {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  </div>
                ))}
              </div>

              {/* 문제번호 다중 선택 */}
              {questionNumbers.length > 0 && (
                <div>
                  <label className="block text-xs font-black text-slate-400 mb-2">문제번호 (여러 개 선택 가능)</label>
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
                <div className="mt-4 space-y-2">
                  {sortedSelectedNumbers.map(num => (
                    passageMap[num] && (
                      <div key={num} className="bg-slate-50 border border-slate-200 rounded-xl p-3">
                        <p className="text-xs font-black text-indigo-600 mb-1">{num}번 지문</p>
                        <p className="text-sm text-slate-600 font-medium leading-relaxed line-clamp-2 select-none"
                          style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}
                          onContextMenu={e => e.preventDefault()}
                          onDragStart={e => e.preventDefault()}>
                          {passageMap[num]}
                        </p>
                      </div>
                    )
                  ))}
                </div>
              )}
            </div>

            {/* STEP 2 — 난이도 */}
            <div className="mb-6">
              <p className="text-base font-black text-slate-700 mb-3">STEP 2 — 난이도 선택 (전체 적용)</p>
              <div className="flex gap-2">
                {DIFF_OPTIONS.map(d => (
                  <button key={d.key} onClick={() => setDifficulty(d.key)}
                    className={`flex-1 py-4 rounded-xl font-black transition-all border-2 ${difficulty === d.key ? d.active : 'border-gray-200 bg-white text-gray-400 hover:border-gray-300 hover:text-gray-600'}`}>
                    <div className="text-2xl mb-1">{d.icon}</div>
                    <div className="text-xs font-bold opacity-70 mb-0.5">{d.level}</div>
                    <div className="text-sm">{d.label}</div>
                  </button>
                ))}
              </div>
            </div>

            {pdfAnalysisPrice !== null && pdfAnalysisPrice > 0 && (
              <p className="text-center text-sm font-bold text-slate-400 mb-3">
                지문 1개당 <span className="text-yellow-500 font-black">{pdfAnalysisPrice} CON</span> 사용
                {selectedNumbers.length > 1 && <span className="text-slate-500"> × {selectedNumbers.length}개 = <span className="text-yellow-500 font-black">{pdfAnalysisPrice * selectedNumbers.length} CON</span></span>}
              </p>
            )}

            {error && (
              <div className="mb-4 p-4 bg-rose-50 border border-rose-200 rounded-2xl">
                <p className="text-rose-600 font-black">⚠️ {error}</p>
              </div>
            )}

            <button onClick={handleGenerate} disabled={!canGenerate}
              className="w-full bg-indigo-600 text-white py-5 rounded-2xl font-black text-xl shadow-xl hover:bg-indigo-700 active:scale-[0.98] transition-all disabled:opacity-40 disabled:cursor-not-allowed">
              {selectedNumbers.length > 1
                ? `AI로 워크북 ${selectedNumbers.length}개 생성하기 🚀`
                : 'AI로 워크북 생성하기 🚀'}
            </button>
          </div>

          {/* ── 결과 영역 ── */}
          {results.length > 0 && (
            <>
              {/* 결과 탭 */}
              {results.length > 1 && (
                <div className="no-print flex gap-2 mb-4 flex-wrap">
                  {results.map((r, i) => (
                    <button key={i} onClick={() => setActiveResultTab(i)}
                      className={`px-4 py-2 rounded-xl font-black text-sm transition-all border-2 ${
                        activeResultTab === i
                          ? 'bg-indigo-600 border-indigo-600 text-white'
                          : 'bg-white border-slate-200 text-slate-600 hover:border-indigo-300'
                      }`}>
                      {r.number}번
                      {saveStatusMap[i] === 'done' && <span className="ml-1 text-xs">✅</span>}
                      {saveStatusMap[i] === 'saving' && <span className="ml-1 text-xs animate-pulse">💾</span>}
                    </button>
                  ))}
                </div>
              )}

              {activeResult && activeD && (
                <div id={`mw-print-area-${activeResultTab}`} className="space-y-0">
                  {/* 1페이지 */}
                  <div id={`mw-pdf-page-1-${activeResultTab}`} className="space-y-3 mb-4">
                    {pdfTitle.trim() && (
                      <div className="mb-3 pb-2 border-b-2 border-slate-200">
                        <h1 className="text-2xl font-black text-slate-900">{pdfTitle.trim()} — {activeResult.number}번</h1>
                      </div>
                    )}

                    <div className="bg-white rounded-2xl border border-slate-100 shadow-lg overflow-hidden">
                      <div className="bg-slate-700 px-5 py-2.5 flex items-center gap-3">
                        <span className="font-black text-2xl leading-none text-white/70">00</span>
                        <h2 className="font-black text-lg leading-tight text-white">원문 지문</h2>
                      </div>
                      <div className="p-4">
                        <p className="text-slate-700 font-bold leading-relaxed text-xl select-none" style={{ textAlign: 'justify', wordBreak: 'break-word' }}
                          onContextMenu={e => e.preventDefault()} onDragStart={e => e.preventDefault()}>{activeResult.passageText}</p>
                      </div>
                    </div>

                    <SectionCard number="01" title="변형 지문" color="bg-teal-600" theme={printTheme}
                      onCopy={() => copy(activeD.paraphrased_passage ?? '', 'paraphrase')} copied={copiedSection === 'paraphrase'}>
                      {editModeIdx === activeResultTab ? (
                        <textarea className="w-full p-3 border-2 border-teal-200 rounded-xl font-bold text-slate-700 text-base leading-relaxed resize-y focus:outline-none focus:border-teal-400 min-h-[120px]"
                          value={editedResults[activeResultTab]?.paraphrased_passage ?? ''}
                          onChange={e => setEditedResults(prev => ({ ...prev, [activeResultTab]: { ...prev[activeResultTab], paraphrased_passage: e.target.value } }))} />
                      ) : (
                        <p className="text-slate-700 font-bold leading-relaxed whitespace-pre-wrap text-xl">{activeD.paraphrased_passage}</p>
                      )}
                    </SectionCard>

                    <SectionCard number="02" title="T/F 문제 10개" color="bg-violet-500" theme={printTheme}
                      onCopy={() => copy(activeD.tf_questions.map(q => `${q.number}. ${q.statement}`).join('\n'), 'tf')} copied={copiedSection === 'tf'}>
                      <div className="space-y-0.5 mb-2">
                        {activeD.tf_questions.map((q, qi) => (
                          <div key={q.number} className={`flex items-start gap-2 px-2 py-0.5 rounded-lg ${printTheme === 'color' ? 'hover:bg-violet-50' : ''}`}>
                            <span className={`font-black w-7 shrink-0 text-lg ${printTheme === 'color' ? 'text-violet-600' : 'text-slate-600'}`}>{q.number}.</span>
                            {editModeIdx === activeResultTab ? (
                              <textarea className="flex-1 border border-slate-200 rounded p-1 font-bold text-slate-700 text-base resize-none focus:outline-none focus:border-slate-400 min-h-[36px]"
                                value={q.statement}
                                onChange={e => setEditedResults(prev => {
                                  const cur = prev[activeResultTab] ?? activeResult.materials;
                                  const tf = [...cur.tf_questions];
                                  tf[qi] = { ...tf[qi], statement: e.target.value };
                                  return { ...prev, [activeResultTab]: { ...cur, tf_questions: tf } };
                                })} />
                            ) : (
                              <p className="text-slate-700 font-bold leading-snug flex-1 text-2xl">{q.statement}</p>
                            )}
                          </div>
                        ))}
                      </div>
                      <div className={`mw-answer-area border-t pt-3 ${printTheme === 'color' ? 'border-violet-100' : 'border-slate-200'}`}>
                        <button onClick={() => setShowAnswerKeyMap(prev => ({ ...prev, [activeResultTab]: !prev[activeResultTab] }))}
                          className={`no-print flex items-center gap-2 font-black text-sm ${printTheme === 'color' ? 'text-violet-600 hover:text-violet-800' : 'text-slate-600 hover:text-slate-800'}`}>
                          <span className={`transition-transform ${showAnswerKeyMap[activeResultTab] ? 'rotate-90' : ''}`}>▶</span>
                          해설지 {showAnswerKeyMap[activeResultTab] ? '닫기' : '보기'}
                        </button>
                        {showAnswerKeyMap[activeResultTab] && (
                          <div className="mt-3">
                            <div className={`p-3 rounded-2xl border ${printTheme === 'color' ? 'bg-violet-50 border-violet-100' : 'bg-white border-slate-200'}`}>
                              <p className={`font-black text-sm mb-1 ${printTheme === 'color' ? 'text-violet-700' : 'text-slate-700'}`}>정답</p>
                              <p className="font-black text-slate-700 tracking-wide text-sm">{activeD.answer_key}</p>
                            </div>
                          </div>
                        )}
                      </div>
                    </SectionCard>
                  </div>

                  {/* 2페이지 */}
                  <div id={`mw-pdf-page-2-${activeResultTab}`} className="space-y-3">
                    <SectionCard number="03" title="한글 요약" color="bg-indigo-500" theme={printTheme}
                      onCopy={() => copy(activeD.korean_summary.rows.map(r => `[${r.label}] ${r.content}`).join('\n'), 'korean')} copied={copiedSection === 'korean'}>
                      <div>
                        <span className={`inline-block mb-3 text-base font-black px-3 py-1 rounded-full ${printTheme === 'color' ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-700'}`}>
                          {activeD.korean_summary.type === '일반' ? '일반 지문' : activeD.korean_summary.type === '논쟁' ? '논쟁 지문' : '문제 지문'}
                        </span>
                        <table className="w-full border-collapse">
                          <tbody>
                            {activeD.korean_summary.rows.map((row, i) => (
                              <tr key={i} className={printTheme === 'color' && i % 2 === 0 ? 'bg-indigo-50' : 'bg-white'}>
                                <td className={`w-28 p-2.5 font-black text-base border whitespace-nowrap align-top ${printTheme === 'color' ? 'text-indigo-700 border-indigo-100' : 'text-slate-700 border-slate-200'}`}>{row.label}</td>
                                <td className={`p-2.5 border ${printTheme === 'color' ? 'border-indigo-100' : 'border-slate-200'}`}>
                                  {editModeIdx === activeResultTab ? (
                                    <textarea className="w-full border border-indigo-200 rounded p-1 font-bold text-slate-700 text-base resize-none focus:outline-none focus:border-indigo-400 min-h-[40px]"
                                      value={row.content}
                                      onChange={e => setEditedResults(prev => {
                                        const cur = prev[activeResultTab] ?? activeResult.materials;
                                        const rows = [...cur.korean_summary.rows];
                                        rows[i] = { ...rows[i], content: e.target.value };
                                        return { ...prev, [activeResultTab]: { ...cur, korean_summary: { ...cur.korean_summary, rows } } };
                                      })} />
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

                    <SectionCard number="04" title="영어 제목 3가지" color="bg-amber-500" theme={printTheme}
                      onCopy={() => copy(activeD.english_titles.map((t, i) => `${i + 1}. ${t}`).join('\n'), 'titles')} copied={copiedSection === 'titles'}>
                      <div className="space-y-2">
                        {activeD.english_titles.map((title, i) => {
                          const { english, korean } = parseTitleKorean(title);
                          return (
                            <div key={i} className={`flex items-start gap-2 px-3 py-2.5 rounded-xl border ${printTheme === 'color' ? 'bg-amber-50 border-amber-100' : 'bg-white border-slate-200'}`}>
                              <span className={`font-black w-8 shrink-0 text-lg ${printTheme === 'color' ? 'text-amber-600' : 'text-slate-600'}`}>{i + 1}.</span>
                              {editModeIdx === activeResultTab ? (
                                <input className="flex-1 border border-amber-200 rounded p-1 font-bold text-slate-700 text-base focus:outline-none focus:border-amber-400"
                                  value={title}
                                  onChange={e => setEditedResults(prev => {
                                    const cur = prev[activeResultTab] ?? activeResult.materials;
                                    const titles = [...cur.english_titles];
                                    titles[i] = e.target.value;
                                    return { ...prev, [activeResultTab]: { ...cur, english_titles: titles } };
                                  })} />
                              ) : (
                                <div className="flex-1">
                                  <p className="text-slate-700 font-bold leading-relaxed text-lg">{english}</p>
                                  {korean && <p className="text-slate-500 font-bold text-base mt-1">({korean})</p>}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </SectionCard>

                    <SectionCard number="05" title="1문장 영어 요약 3가지" color="bg-rose-500" theme={printTheme}
                      onCopy={() => copy(activeD.one_sentence_summaries.map((s, i) => `${i + 1}. ${s.english.replace(/\*\*/g, '')}\n   (${cleanKorean(s.korean)})`).join('\n\n'), 'one_sentence')} copied={copiedSection === 'one_sentence'}>
                      <div className="space-y-2">
                        {activeD.one_sentence_summaries.map((s, i) => (
                          <div key={i} className={`px-3 py-2.5 rounded-xl border ${printTheme === 'color' ? 'bg-rose-50 border-rose-100' : 'bg-white border-slate-200'}`}>
                            <div className="flex items-start gap-2">
                              <span className={`font-black w-8 shrink-0 text-lg ${printTheme === 'color' ? 'text-rose-600' : 'text-slate-600'}`}>{i + 1}.</span>
                              {editModeIdx === activeResultTab ? (
                                <div className="flex-1 flex flex-col gap-1">
                                  <input className="w-full border border-rose-200 rounded p-1 font-bold text-slate-700 text-base focus:outline-none focus:border-rose-400"
                                    value={s.english}
                                    onChange={e => setEditedResults(prev => {
                                      const cur = prev[activeResultTab] ?? activeResult.materials;
                                      const sums = [...cur.one_sentence_summaries];
                                      sums[i] = { ...sums[i], english: e.target.value };
                                      return { ...prev, [activeResultTab]: { ...cur, one_sentence_summaries: sums } };
                                    })} />
                                  <input className="w-full border border-rose-200 rounded p-1 font-bold text-slate-500 text-sm focus:outline-none focus:border-rose-400"
                                    value={s.korean}
                                    onChange={e => setEditedResults(prev => {
                                      const cur = prev[activeResultTab] ?? activeResult.materials;
                                      const sums = [...cur.one_sentence_summaries];
                                      sums[i] = { ...sums[i], korean: e.target.value };
                                      return { ...prev, [activeResultTab]: { ...cur, one_sentence_summaries: sums } };
                                    })} />
                                </div>
                              ) : (
                                <div className="flex-1">
                                  <p className="text-slate-700 font-bold leading-relaxed text-lg mb-1">{renderBold(s.english)}</p>
                                  <p className="text-slate-500 font-bold text-base">{renderSingleBold('(' + cleanKorean(s.korean) + ')')}</p>
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </SectionCard>

                    <SectionCard number="06" title="관련 어휘 10개" color="bg-slate-700" theme={printTheme}
                      onCopy={() => copy(activeD.vocabulary_table.map(r => `${r.word} (${r.meaning}) | ${r.syn1} (${r.syn1_m}) | ${r.syn2} (${r.syn2_m}) | ${r.syn3} (${r.syn3_m}) | ${r.antonym} (${r.antonym_m})`).join('\n'), 'vocab')} copied={copiedSection === 'vocab'}>
                      <table className="w-full text-lg border-collapse table-fixed">
                        <colgroup>
                          <col style={{ width: '22%' }} /><col style={{ width: '19%' }} /><col style={{ width: '19%' }} /><col style={{ width: '19%' }} /><col style={{ width: '21%' }} />
                        </colgroup>
                        <thead>
                          <tr className="bg-slate-800 text-white">
                            {['표제어 (뜻)', '유의어 1 (뜻)', '유의어 2 (뜻)', '유의어 3 (뜻)', '반의어 (뜻)'].map((h, i) => (
                              <th key={i} className={`px-2 py-2 text-left font-black ${i === 0 ? 'rounded-tl-lg' : ''} ${i === 4 ? 'rounded-tr-lg' : ''}`}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {activeD.vocabulary_table.map((row, i) => {
                            const updateVocab = (patch: Partial<VocabRow>) => setEditedResults(prev => {
                              const cur = prev[activeResultTab] ?? activeResult.materials;
                              const vocab = [...cur.vocabulary_table];
                              vocab[i] = { ...vocab[i], ...patch };
                              return { ...prev, [activeResultTab]: { ...cur, vocabulary_table: vocab } };
                            });
                            return (
                              <tr key={i} className={printTheme === 'color' && i % 2 !== 0 ? 'bg-slate-50' : 'bg-white'}>
                                <td className="px-2 py-2 border-b border-slate-100">
                                  {editModeIdx === activeResultTab ? (
                                    <div className="flex flex-col gap-0.5">
                                      <input className="w-full border border-indigo-200 rounded px-1 py-0.5 font-black text-indigo-700 text-sm focus:outline-none focus:border-indigo-400" value={row.word} onChange={e => updateVocab({ word: e.target.value })} />
                                      <input className="w-full border border-slate-200 rounded px-1 py-0.5 text-slate-500 text-xs focus:outline-none focus:border-slate-400" value={row.meaning} onChange={e => updateVocab({ meaning: e.target.value })} />
                                    </div>
                                  ) : (
                                    <><span className="font-black text-indigo-700">{row.word}</span><span className="text-slate-900 text-base ml-1">({row.meaning})</span></>
                                  )}
                                </td>
                                {([['syn1', 'syn1_m'], ['syn2', 'syn2_m'], ['syn3', 'syn3_m']] as const).map(([wk, mk], j) => (
                                  <td key={j} className="px-2 py-2 border-b border-slate-100">
                                    {editModeIdx === activeResultTab ? (
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
                                  {editModeIdx === activeResultTab ? (
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
                    </SectionCard>
                  </div>
                </div>
              )}

              {/* 다운로드 버튼 */}
              <div className="no-print fixed bottom-8 right-8 flex flex-col items-end gap-3 z-50">
                <div className="flex items-center gap-1 bg-white border border-slate-200 shadow-lg px-3 py-2 rounded-2xl">
                  <span className="text-slate-400 text-xs font-bold mr-1">테마</span>
                  <button onClick={() => setPrintTheme('color')}
                    className={`px-2.5 py-1 rounded-lg text-xs font-black transition-all ${printTheme === 'color' ? 'bg-teal-500 text-white' : 'text-slate-400 hover:text-slate-600'}`}>컬러</button>
                  <button onClick={() => setPrintTheme('mono')}
                    className={`px-2.5 py-1 rounded-lg text-xs font-black transition-all ${printTheme === 'mono' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-slate-600'}`}>흑백</button>
                </div>
                {saveStatusMap[activeResultTab] === 'saving' && (
                  <div className="flex items-center gap-2 bg-white border border-slate-200 shadow-lg px-4 py-2.5 rounded-2xl text-sm font-bold text-slate-500">
                    <div className="w-4 h-4 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />이력 저장 중...
                  </div>
                )}
                {saveStatusMap[activeResultTab] === 'done' && (
                  <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 shadow-lg px-4 py-2.5 rounded-2xl text-sm font-bold text-emerald-600">✅ 이력에 저장됨</div>
                )}
                {editSaveStatusMap[activeResultTab] && editSaveStatusMap[activeResultTab] !== 'idle' && (
                  <div className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-sm font-bold shadow-lg border
                    ${editSaveStatusMap[activeResultTab] === 'saving' ? 'bg-white border-slate-200 text-slate-500' : editSaveStatusMap[activeResultTab] === 'done' ? 'bg-emerald-50 border-emerald-200 text-emerald-600' : 'bg-rose-50 border-rose-200 text-rose-600'}`}>
                    {editSaveStatusMap[activeResultTab] === 'saving' ? <><div className="w-4 h-4 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />편집본 저장 중...</> : editSaveStatusMap[activeResultTab] === 'done' ? '✅ 편집본 저장됨' : '⚠️ 편집본 저장 실패'}
                  </div>
                )}
                <div className="flex gap-3 flex-wrap justify-end">
                  <button
                    onClick={() => {
                      if (editModeIdx !== activeResultTab) {
                        if (!editedResults[activeResultTab]) setEditedResults(prev => ({ ...prev, [activeResultTab]: JSON.parse(JSON.stringify(activeResult.materials)) }));
                        setEditSaveStatusMap(prev => ({ ...prev, [activeResultTab]: 'idle' }));
                        setEditModeIdx(activeResultTab);
                      } else {
                        setEditModeIdx(null);
                      }
                    }}
                    className={`px-5 py-3 rounded-2xl font-black text-sm shadow-lg transition-all active:scale-95 ${editModeIdx === activeResultTab ? 'bg-amber-500 text-white hover:bg-amber-600' : 'bg-slate-600 text-white hover:bg-slate-700'}`}>
                    {editModeIdx === activeResultTab ? '✏️ 편집 종료' : '✏️ 편집'}
                  </button>
                  {editModeIdx === activeResultTab && (
                    <button onClick={() => handleEditSave(activeResultTab)} disabled={editSaveStatusMap[activeResultTab] === 'saving'}
                      className="px-5 py-3 bg-green-600 hover:bg-green-700 text-white font-black text-sm rounded-2xl shadow-lg transition-all active:scale-95 disabled:opacity-50">
                      {editSaveStatusMap[activeResultTab] === 'saving' ? '⏳ 저장 중...' : '📥 편집본 저장'}
                    </button>
                  )}
                  <button onClick={handleDownloadProblem} disabled={!!pdfLoading}
                    className="bg-indigo-600 text-white px-6 py-4 rounded-2xl font-black text-lg shadow-2xl hover:bg-indigo-700 active:scale-95 transition-all disabled:opacity-50">
                    {pdfLoading === '문제' ? '⏳ 생성 중...' : '⬇️ 문제 PDF'}
                  </button>
                  <button onClick={handleDownloadAnswer} disabled={!!pdfLoading}
                    className="bg-violet-600 text-white px-6 py-4 rounded-2xl font-black text-lg shadow-2xl hover:bg-violet-700 active:scale-95 transition-all disabled:opacity-50">
                    {pdfLoading === '답안' ? '⏳ 생성 중...' : '⬇️ 답안·해설 PDF'}
                  </button>
                </div>
              </div>
            </>
          )}
        </>
      )}

      {/* ══ 생성 이력 탭 ══ */}
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
                placeholder="시험명/기관 검색..."
                className="px-3 py-2 border border-gray-200 rounded-xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-indigo-300" />
            </div>
            <button onClick={() => fetchHistory()} disabled={historyLoading}
              className="px-4 py-2 bg-indigo-600 text-white text-sm font-black rounded-xl hover:bg-indigo-700 transition-all disabled:opacity-50">🔍 검색</button>
            {(searchDate || searchQuery) && (
              <button onClick={() => { setSearchDate(''); setSearchQuery(''); fetchHistory('', ''); }}
                className="px-4 py-2 bg-gray-100 text-gray-600 text-sm font-black rounded-xl hover:bg-gray-200 transition-all">초기화</button>
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
              <div className="grid grid-cols-[32px_140px_60px_60px_1fr_52px_64px_64px] gap-2 px-4 py-3 bg-slate-50 border-b border-slate-100 text-xs font-black text-slate-500">
                <input type="checkbox" checked={selectedIds.size === historyList.length && historyList.length > 0}
                  onChange={() => setSelectedIds(selectedIds.size === historyList.length ? new Set() : new Set(historyList.map(i => i.id)))}
                  className="w-4 h-4 rounded accent-indigo-600 cursor-pointer mt-0.5" />
                {['날짜', '년도', '학년', '시험명/기관', '난이도', '문제', '해설'].map((h, i) => (
                  <span key={i} className={i >= 5 ? 'text-center' : ''}>{h}</span>
                ))}
              </div>
              {historyList.map((item, i) => (
                <div key={item.id}
                  className={`grid grid-cols-[32px_140px_60px_60px_1fr_52px_64px_64px] gap-2 px-4 py-3 items-center border-b border-slate-100 last:border-0 hover:bg-indigo-50/40 transition-colors
                    ${selectedIds.has(item.id) ? 'bg-indigo-50' : i % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}`}>
                  <input type="checkbox" checked={selectedIds.has(item.id)}
                    onChange={() => setSelectedIds(prev => { const n = new Set(prev); if (n.has(item.id)) n.delete(item.id); else n.add(item.id); return n; })}
                    className="w-4 h-4 rounded accent-indigo-600 cursor-pointer" />
                  <span className="text-xs font-bold text-slate-600 whitespace-nowrap">
                    {new Date(item.created_at).toLocaleString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
                  </span>
                  <span className="text-xs font-bold text-slate-700">{item.year}년</span>
                  <span className="text-xs font-bold text-slate-700">{item.grade}</span>
                  <span className="text-xs text-slate-600 font-medium truncate">{item.institution} {item.question_number}번</span>
                  {(() => {
                    const diffMap: Record<string, string> = { b1: 'bg-sky-100 text-sky-700', b2: 'bg-emerald-100 text-emerald-700', c1: 'bg-orange-100 text-orange-700', c2: 'bg-rose-100 text-rose-700' };
                    return <span className={`text-xs font-black px-2 py-1 rounded-full text-center ${diffMap[item.difficulty ?? ''] ?? 'bg-slate-100 text-slate-600'}`}>{item.difficulty || '-'}</span>;
                  })()}
                  <div className="flex justify-center">
                    {item.pdf_path ? (
                      <button onClick={() => downloadFromHistory(item.pdf_path, `${item.year}_${item.institution}_${item.question_number}번_문제.pdf`)}
                        className="px-2 py-1 bg-indigo-100 hover:bg-indigo-200 text-indigo-700 rounded-lg text-xs font-black transition-all w-full text-center">⬇️ 문제</button>
                    ) : <span className="text-xs text-slate-300 text-center w-full">-</span>}
                  </div>
                  <div className="flex justify-center">
                    {item.answer_pdf_path ? (
                      <button onClick={() => downloadFromHistory(item.answer_pdf_path!, `${item.year}_${item.institution}_${item.question_number}번_해설.pdf`)}
                        className="px-2 py-1 bg-violet-100 hover:bg-violet-200 text-violet-700 rounded-lg text-xs font-black transition-all w-full text-center">⬇️ 해설</button>
                    ) : <span className="text-xs text-slate-300 text-center w-full">-</span>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
