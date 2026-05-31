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

async function generatePdfBlob(hideAnswerArea = false): Promise<Blob | null> {
  const page1El = document.getElementById('mw-pdf-page-1');
  const page2El = document.getElementById('mw-pdf-page-2');
  if (!page1El || !page2El) return null;
  const noPrintEls = document.querySelectorAll('#mw-print-area .no-print');
  noPrintEls.forEach(el => (el as HTMLElement).style.setProperty('display', 'none', 'important'));
  const answerAreaEls = hideAnswerArea ? document.querySelectorAll('.mw-answer-area') : null;
  answerAreaEls?.forEach(el => (el as HTMLElement).style.setProperty('display', 'none', 'important'));
  try {
    const { toJpeg } = await import('html-to-image');
    const { jsPDF } = await import('jspdf');
    const W = 210, M = 5, cW = W - 2 * M;
    const p1Ratio = page1El.offsetHeight / page1El.offsetWidth;
    const p2Ratio = page2El.offsetHeight / page2El.offsetWidth;
    const opts = { pixelRatio: 2, quality: 0.9, backgroundColor: '#ffffff', cacheBust: true };
    const [url1, url2] = await Promise.all([toJpeg(page1El, opts), toJpeg(page2El, opts)]);
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
  // 탭
  const [activeTab, setActiveTab] = useState<'generate' | 'history'>('generate');

  // 캐스케이드 셀렉트
  const [years, setYears] = useState<number[]>([]);
  const [grades, setGrades] = useState<string[]>([]);
  const [institutions, setInstitutions] = useState<string[]>([]);
  const [questionNumbers, setQuestionNumbers] = useState<number[]>([]);
  const [selectedYear, setSelectedYear] = useState('');
  const [selectedGrade, setSelectedGrade] = useState('');
  const [selectedInstitution, setSelectedInstitution] = useState('');
  const [selectedNumber, setSelectedNumber] = useState('');
  const [passageText, setPassageText] = useState('');
  const [passageLoading, setPassageLoading] = useState(false);

  // 난이도 + 생성
  const [difficulty, setDifficulty] = useState<'b1' | 'b2' | 'c1' | 'c2'>('b2');
  const [loading, setLoading] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState('');
  const [result, setResult] = useState<GeneratedMaterials | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showAnswerKey, setShowAnswerKey] = useState(false);
  const [copiedSection, setCopiedSection] = useState<string | null>(null);
  const [pdfTitle, setPdfTitle] = useState('');
  const [pdfLoading, setPdfLoading] = useState<false | '문제' | '답안'>(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'done' | 'error'>('idle');
  const [saveErrorMsg, setSaveErrorMsg] = useState('');
  const [pdfAnalysisPrice, setPdfAnalysisPrice] = useState<number | null>(null);
  const [printTheme, setPrintTheme] = useState<'color' | 'mono'>('mono');
  const [editMode, setEditMode] = useState(false);
  const [editedResult, setEditedResult] = useState<GeneratedMaterials | null>(null);
  const [editSaveStatus, setEditSaveStatus] = useState<'idle' | 'saving' | 'done' | 'error'>('idle');

  // 이력
  const [historyList, setHistoryList] = useState<HistoryItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [session, setSession] = useState<{ access_token: string; user: { id: string } } | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session: s } }) => { if (s) setSession(s as typeof session); });
  }, []);

  useEffect(() => {
    fetch('/api/credits/pricing')
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        const item = (data?.pricing ?? []).find((p: { feature_key: string; cost_per_use: number }) => p.feature_key === 'pdf_analysis');
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
    setSelectedGrade(''); setSelectedInstitution(''); setSelectedNumber(''); setPassageText('');
    supabase.from('mock_exam_passages').select('grade').eq('year', parseInt(selectedYear)).order('grade', { ascending: true })
      .then(({ data }) => { setGrades([...new Set((data ?? []).map((r: { grade: string }) => r.grade))]); });
  }, [selectedYear]);

  useEffect(() => {
    if (!selectedYear || !selectedGrade) return;
    setSelectedInstitution(''); setSelectedNumber(''); setPassageText('');
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
    setSelectedNumber(''); setPassageText('');
    supabase.from('mock_exam_passages').select('question_number')
      .eq('year', parseInt(selectedYear)).eq('grade', selectedGrade).eq('institution', selectedInstitution)
      .order('question_number')
      .then(({ data }) => { setQuestionNumbers((data ?? []).map((r: { question_number: number }) => r.question_number)); });
  }, [selectedYear, selectedGrade, selectedInstitution]);

  useEffect(() => {
    if (!selectedNumber || !selectedYear || !selectedGrade || !selectedInstitution) { setPassageText(''); return; }
    setPassageLoading(true);
    supabase.from('mock_exam_passages').select('passage_text')
      .eq('year', parseInt(selectedYear)).eq('grade', selectedGrade).eq('institution', selectedInstitution)
      .eq('question_number', parseInt(selectedNumber)).single()
      .then(({ data }) => {
        const text = (data?.passage_text ?? '').replace(/\n+/g, ' ').replace(/\s+/g, ' ').trim();
        setPassageText(text);
        setPassageLoading(false);
      });
  }, [selectedNumber, selectedYear, selectedGrade, selectedInstitution]);

  // 이력 조회
  const fetchHistory = useCallback(async () => {
    if (!session) return;
    setHistoryLoading(true); setHistoryError(null);
    try {
      await fetch('/api/cleanup-old-history', { method: 'POST' });
      const { data, error: fetchErr } = await supabase
        .from('mock_workbook_history').select('*').eq('academy_id', session.user.id)
        .order('created_at', { ascending: false });
      if (fetchErr) { setHistoryError(`조회 오류: ${fetchErr.message}`); return; }
      setHistoryList(data ?? []);
    } catch (e) {
      setHistoryError(e instanceof Error ? e.message : '알 수 없는 오류');
    } finally { setHistoryLoading(false); }
  }, [session]);

  useEffect(() => { if (activeTab === 'history' && session) fetchHistory(); }, [activeTab, session]);

  // 자동 저장
  const autoSave = useCallback(async (generated: GeneratedMaterials, diff: string, year: number, grade: string, institution: string, questionNumber: number) => {
    if (!session) return;
    setSaveStatus('saving');
    try {
      const [pdfBlob, answerBlob] = await Promise.all([generatePdfBlob(true), buildAnswerPdfBlob(generated, pdfTitle.trim())]);
      if (!pdfBlob) { setSaveStatus('error'); setSaveErrorMsg('PDF 요소를 찾을 수 없음'); return; }
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
        body: JSON.stringify({ pdfBase64, answerPdfBase64, year, grade, institution, questionNumber, difficulty: diff }),
      });
      const json = await res.json() as { success?: boolean; error?: string };
      setSaveStatus(res.ok && json.success ? 'done' : 'error');
      if (!res.ok) setSaveErrorMsg(json.error || '저장 실패');
    } catch (e) { setSaveStatus('error'); setSaveErrorMsg(e instanceof Error ? e.message : '오류'); }
  }, [session, pdfTitle]);

  // 생성
  const handleGenerate = async () => {
    if (!passageText.trim() || loading || !session) return;
    setLoading(true); setError(null); setResult(null); setShowAnswerKey(false); setSaveStatus('idle');
    setEditMode(false); setEditedResult(null); setEditSaveStatus('idle');
    const msgs = ['AI가 지문을 읽고 있어요... 🤖', '문제를 생성하고 있어요... ✍️', '어휘 표를 만들고 있어요... 📚', '거의 완성됐어요! 잠시만요... ✨'];
    let idx = 0; setLoadingMsg(msgs[0]);
    const interval = setInterval(() => { idx = (idx + 1) % msgs.length; setLoadingMsg(msgs[idx]); }, 8000);
    try {
      const res = await fetch('/api/process-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: passageText, difficulty, academy_id: session.user.id }),
      });
      const rawText = await res.text();
      const json = JSON.parse(rawText) as { data?: GeneratedMaterials; error?: string };
      if (!res.ok) throw new Error(json.error || '오류가 발생했습니다.');
      const generated = json.data as GeneratedMaterials;
      setResult(generated);
      setTimeout(() => autoSave(generated, difficulty, parseInt(selectedYear), selectedGrade, selectedInstitution, parseInt(selectedNumber)), 800);
    } catch (e) { setError(e instanceof Error ? e.message : '오류가 발생했습니다.'); }
    finally { clearInterval(interval); setLoading(false); }
  };

  const copy = async (text: string, id: string) => {
    try { await navigator.clipboard.writeText(text); } catch { /* ignore */ }
    setCopiedSection(id); setTimeout(() => setCopiedSection(null), 2000);
  };

  const handleDownloadProblem = async () => {
    setPdfLoading('문제');
    const wasEditing = editMode;
    try {
      if (wasEditing) { setEditMode(false); await new Promise(r => requestAnimationFrame(r)); await new Promise(r => requestAnimationFrame(r)); }
      const blob = await generatePdfBlob(true);
      if (wasEditing) setEditMode(true);
      if (!blob) throw new Error('PDF 요소를 찾을 수 없습니다.');
      triggerDownload(blob, `${pdfTitle.trim() || '모의고사워크북'}_문제.pdf`);
    } catch (e) { if (wasEditing) setEditMode(true); alert(`PDF 저장 실패: ${e instanceof Error ? e.message : '오류'}`); }
    finally { setPdfLoading(false); }
  };

  const handleDownloadAnswer = async () => {
    const d = editedResult ?? result;
    if (!d) return;
    setPdfLoading('답안');
    try {
      const blob = await buildAnswerPdfBlob(d, pdfTitle.trim());
      triggerDownload(blob, `${pdfTitle.trim() || '모의고사워크북'}_답안해설.pdf`);
    } catch (e) { alert(`PDF 저장 실패: ${e instanceof Error ? e.message : '오류'}`); }
    finally { setPdfLoading(false); }
  };

  const handleEditSave = async () => {
    if (!editedResult || !session) return;
    setEditSaveStatus('saving');
    const wasEditing = editMode;
    try {
      if (wasEditing) { setEditMode(false); await new Promise(r => requestAnimationFrame(r)); await new Promise(r => requestAnimationFrame(r)); }
      const [pdfBlob, answerBlob] = await Promise.all([generatePdfBlob(true), buildAnswerPdfBlob(editedResult, pdfTitle.trim())]);
      if (wasEditing) setEditMode(true);
      if (!pdfBlob) { setEditSaveStatus('error'); return; }
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
          questionNumber: parseInt(selectedNumber), difficulty,
        }),
      });
      const json = await res.json() as { success?: boolean };
      setEditSaveStatus(res.ok && json.success ? 'done' : 'error');
    } catch { if (wasEditing) setEditMode(true); setEditSaveStatus('error'); }
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

  const canGenerate = !!passageText.trim() && !loading && !!session;

  return (
    <div className="pb-32">
      {loading && (
        <div className="no-print fixed inset-0 bg-indigo-900/60 backdrop-blur-md z-[200] flex items-center justify-center">
          <div className="bg-white rounded-[2.5rem] p-12 text-center shadow-2xl max-w-sm mx-4">
            <div className="w-16 h-16 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-6" />
            <p className="font-black text-indigo-600 text-xl animate-pulse">{loadingMsg}</p>
            <p className="text-slate-400 font-bold text-sm mt-3">30~60초 정도 소요될 수 있어요</p>
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
                placeholder="예: 2024 수능 18번 워크북"
                className="w-full px-5 py-3 border-2 border-slate-200 rounded-2xl font-bold text-slate-700 focus:outline-none focus:border-indigo-400 transition-colors placeholder:text-slate-300" />
            </div>

            {/* STEP 1 — 기출 지문 선택 */}
            <div className="mb-6">
              <p className="text-base font-black text-slate-700 mb-3">STEP 1 — 기출 지문 선택</p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
                {[
                  { label: '년도', value: selectedYear, onChange: setSelectedYear, disabled: false, options: years.map(y => ({ value: String(y), label: `${y}년` })) },
                  { label: '학년', value: selectedGrade, onChange: setSelectedGrade, disabled: !selectedYear, options: grades.map(g => ({ value: g, label: g })) },
                  { label: '시험명/기관', value: selectedInstitution, onChange: setSelectedInstitution, disabled: !selectedGrade, options: institutions.map(i => ({ value: i, label: i })) },
                  { label: '문제번호', value: selectedNumber, onChange: setSelectedNumber, disabled: !selectedInstitution, options: questionNumbers.map(n => ({ value: String(n), label: `${n}번` })) },
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
              {passageLoading && <p className="text-sm text-indigo-400 font-bold animate-pulse">지문 불러오는 중...</p>}
              {passageText && !passageLoading && (
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-sm text-slate-700 font-medium leading-relaxed select-none" style={{ textAlign: 'justify', wordBreak: 'break-word' }}
                  onContextMenu={e => e.preventDefault()} onDragStart={e => e.preventDefault()}>
                  {passageText}
                </div>
              )}
            </div>

            {/* STEP 2 — 난이도 */}
            <div className="mb-6">
              <p className="text-base font-black text-slate-700 mb-3">STEP 2 — 난이도 선택</p>
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
                분석 1회당 <span className="text-yellow-500 font-black">{pdfAnalysisPrice} CON</span> 사용
              </p>
            )}

            {error && (
              <div className="mb-4 p-4 bg-rose-50 border border-rose-200 rounded-2xl">
                <p className="text-rose-600 font-black">⚠️ {error}</p>
              </div>
            )}

            <button onClick={handleGenerate} disabled={!canGenerate}
              className="w-full bg-indigo-600 text-white py-5 rounded-2xl font-black text-xl shadow-xl hover:bg-indigo-700 active:scale-[0.98] transition-all disabled:opacity-40 disabled:cursor-not-allowed">
              AI로 문제 생성하기 🚀
            </button>
          </div>

          {/* ── 결과 영역 ── */}
          {result && (() => {
            const d = editedResult ?? result;
            return (
            <>
              <div id="mw-print-area" className="space-y-0">
                {/* 1페이지: 원문 + 변형지문 + T/F 문제 */}
                <div id="mw-pdf-page-1" className="space-y-3 mb-4">
                  {pdfTitle.trim() && (
                    <div className="mb-3 pb-2 border-b-2 border-slate-200">
                      <h1 className="text-2xl font-black text-slate-900">{pdfTitle.trim()}</h1>
                    </div>
                  )}

                  <div className="bg-white rounded-2xl border border-slate-100 shadow-lg overflow-hidden">
                    <div className="bg-slate-700 px-5 py-2.5 flex items-center gap-3">
                      <span className="font-black text-2xl leading-none text-white/70">00</span>
                      <h2 className="font-black text-lg leading-tight text-white">원문 지문</h2>
                    </div>
                    <div className="p-4">
                      <p className="text-slate-700 font-bold leading-relaxed text-xl" style={{ textAlign: 'justify', wordBreak: 'break-word' }}>{passageText}</p>
                    </div>
                  </div>

                  <SectionCard number="01" title="변형 지문" color="bg-teal-600" theme={printTheme}
                    onCopy={() => copy(d.paraphrased_passage ?? '', 'paraphrase')} copied={copiedSection === 'paraphrase'}>
                    {editMode ? (
                      <textarea className="w-full p-3 border-2 border-teal-200 rounded-xl font-bold text-slate-700 text-base leading-relaxed resize-y focus:outline-none focus:border-teal-400 min-h-[120px]"
                        value={editedResult?.paraphrased_passage ?? ''}
                        onChange={e => setEditedResult(prev => prev ? { ...prev, paraphrased_passage: e.target.value } : prev)} />
                    ) : (
                      <p className="text-slate-700 font-bold leading-relaxed whitespace-pre-wrap text-xl">{d.paraphrased_passage}</p>
                    )}
                  </SectionCard>

                  <SectionCard number="02" title="T/F 문제 10개" color="bg-violet-500" theme={printTheme}
                    onCopy={() => copy(result.tf_questions.map(q => `${q.number}. ${q.statement}`).join('\n'), 'tf')} copied={copiedSection === 'tf'}>
                    <div className="space-y-1 mb-2">
                      {d.tf_questions.map((q, qi) => (
                        <div key={q.number} className={`flex items-start gap-2 px-2 py-1 rounded-lg ${printTheme === 'color' ? 'hover:bg-violet-50' : ''}`}>
                          <span className={`font-black w-7 shrink-0 text-lg ${printTheme === 'color' ? 'text-violet-600' : 'text-slate-600'}`}>{q.number}.</span>
                          {editMode ? (
                            <textarea className="flex-1 border border-slate-200 rounded p-1 font-bold text-slate-700 text-base resize-none focus:outline-none focus:border-slate-400 min-h-[36px]"
                              value={q.statement}
                              onChange={e => setEditedResult(prev => {
                                if (!prev) return prev;
                                const tf = [...prev.tf_questions];
                                tf[qi] = { ...tf[qi], statement: e.target.value };
                                return { ...prev, tf_questions: tf };
                              })} />
                          ) : (
                            <p className="text-slate-700 font-bold leading-relaxed flex-1 text-2xl">{q.statement}</p>
                          )}
                        </div>
                      ))}
                    </div>
                    <div className={`mw-answer-area border-t pt-3 ${printTheme === 'color' ? 'border-violet-100' : 'border-slate-200'}`}>
                      <button onClick={() => setShowAnswerKey(!showAnswerKey)}
                        className={`no-print flex items-center gap-2 font-black text-sm ${printTheme === 'color' ? 'text-violet-600 hover:text-violet-800' : 'text-slate-600 hover:text-slate-800'}`}>
                        <span className={`transition-transform ${showAnswerKey ? 'rotate-90' : ''}`}>▶</span>
                        해설지 {showAnswerKey ? '닫기' : '보기'}
                      </button>
                      {showAnswerKey && (
                        <div className="mt-3">
                          <div className={`p-3 rounded-2xl border ${printTheme === 'color' ? 'bg-violet-50 border-violet-100' : 'bg-white border-slate-200'}`}>
                            <p className={`font-black text-sm mb-1 ${printTheme === 'color' ? 'text-violet-700' : 'text-slate-700'}`}>정답</p>
                            <p className="font-black text-slate-700 tracking-wide text-sm">{d.answer_key}</p>
                          </div>
                        </div>
                      )}
                    </div>
                  </SectionCard>
                </div>

                {/* 2페이지: 한글요약 + 영어제목 + 1문장요약 + 어휘 */}
                <div id="mw-pdf-page-2" className="space-y-3">
                  <SectionCard number="03" title="한글 요약" color="bg-indigo-500" theme={printTheme}
                    onCopy={() => copy(d.korean_summary.rows.map(r => `[${r.label}] ${r.content}`).join('\n'), 'korean')} copied={copiedSection === 'korean'}>
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
                                  <textarea className="w-full border border-indigo-200 rounded p-1 font-bold text-slate-700 text-base resize-none focus:outline-none focus:border-indigo-400 min-h-[40px]"
                                    value={row.content}
                                    onChange={e => setEditedResult(prev => {
                                      if (!prev) return prev;
                                      const rows = [...prev.korean_summary.rows];
                                      rows[i] = { ...rows[i], content: e.target.value };
                                      return { ...prev, korean_summary: { ...prev.korean_summary, rows } };
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
                    onCopy={() => copy(d.english_titles.map((t, i) => `${i + 1}. ${t}`).join('\n'), 'titles')} copied={copiedSection === 'titles'}>
                    <div className="space-y-2">
                      {d.english_titles.map((title, i) => {
                        const { english, korean } = parseTitleKorean(title);
                        return (
                          <div key={i} className={`flex items-start gap-2 px-3 py-2.5 rounded-xl border ${printTheme === 'color' ? 'bg-amber-50 border-amber-100' : 'bg-white border-slate-200'}`}>
                            <span className={`font-black w-8 shrink-0 text-lg ${printTheme === 'color' ? 'text-amber-600' : 'text-slate-600'}`}>{i + 1}.</span>
                            {editMode ? (
                              <input className="flex-1 border border-amber-200 rounded p-1 font-bold text-slate-700 text-base focus:outline-none focus:border-amber-400"
                                value={title}
                                onChange={e => setEditedResult(prev => {
                                  if (!prev) return prev;
                                  const titles = [...prev.english_titles];
                                  titles[i] = e.target.value;
                                  return { ...prev, english_titles: titles };
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
                    onCopy={() => copy(d.one_sentence_summaries.map((s, i) => `${i + 1}. ${s.english.replace(/\*\*/g, '')}\n   (${cleanKorean(s.korean)})`).join('\n\n'), 'one_sentence')} copied={copiedSection === 'one_sentence'}>
                    <div className="space-y-2">
                      {d.one_sentence_summaries.map((s, i) => (
                        <div key={i} className={`px-3 py-2.5 rounded-xl border ${printTheme === 'color' ? 'bg-rose-50 border-rose-100' : 'bg-white border-slate-200'}`}>
                          <div className="flex items-start gap-2">
                            <span className={`font-black w-8 shrink-0 text-lg ${printTheme === 'color' ? 'text-rose-600' : 'text-slate-600'}`}>{i + 1}.</span>
                            {editMode ? (
                              <div className="flex-1 flex flex-col gap-1">
                                <input className="w-full border border-rose-200 rounded p-1 font-bold text-slate-700 text-base focus:outline-none focus:border-rose-400"
                                  value={s.english}
                                  onChange={e => setEditedResult(prev => {
                                    if (!prev) return prev;
                                    const sums = [...prev.one_sentence_summaries];
                                    sums[i] = { ...sums[i], english: e.target.value };
                                    return { ...prev, one_sentence_summaries: sums };
                                  })} />
                                <input className="w-full border border-rose-200 rounded p-1 font-bold text-slate-500 text-sm focus:outline-none focus:border-rose-400"
                                  value={s.korean}
                                  onChange={e => setEditedResult(prev => {
                                    if (!prev) return prev;
                                    const sums = [...prev.one_sentence_summaries];
                                    sums[i] = { ...sums[i], korean: e.target.value };
                                    return { ...prev, one_sentence_summaries: sums };
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
                    onCopy={() => copy(result.vocabulary_table.map(r => `${r.word} (${r.meaning}) | ${r.syn1} (${r.syn1_m}) | ${r.syn2} (${r.syn2_m}) | ${r.syn3} (${r.syn3_m}) | ${r.antonym} (${r.antonym_m})`).join('\n'), 'vocab')} copied={copiedSection === 'vocab'}>
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
                            {([['syn1', 'syn1_m'], ['syn2', 'syn2_m'], ['syn3', 'syn3_m']] as const).map(([wk, mk], j) => (
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
                  </SectionCard>
                </div>
              </div>
            </>
            );
          })()}

          {/* 다운로드 버튼 + 저장 상태 */}
          {result && (
            <div className="no-print fixed bottom-8 right-8 flex flex-col items-end gap-3 z-50">
              {/* 테마 토글 */}
              <div className="flex items-center gap-1 bg-white border border-slate-200 shadow-lg px-3 py-2 rounded-2xl">
                <span className="text-slate-400 text-xs font-bold mr-1">테마</span>
                <button onClick={() => setPrintTheme('color')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-black transition-all ${printTheme === 'color' ? 'bg-teal-500 text-white' : 'text-slate-400 hover:text-slate-600'}`}>
                  컬러
                </button>
                <button onClick={() => setPrintTheme('mono')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-black transition-all ${printTheme === 'mono' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-slate-600'}`}>
                  흑백
                </button>
              </div>
              {saveStatus === 'saving' && (
                <div className="flex items-center gap-2 bg-white border border-slate-200 shadow-lg px-4 py-2.5 rounded-2xl text-sm font-bold text-slate-500">
                  <div className="w-4 h-4 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />이력 자동 저장 중...
                </div>
              )}
              {saveStatus === 'done' && (
                <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 shadow-lg px-4 py-2.5 rounded-2xl text-sm font-bold text-emerald-600">✅ 이력에 저장됨</div>
              )}
              {saveStatus === 'error' && (
                <div className="flex items-center gap-2 bg-rose-50 border border-rose-200 shadow-lg px-4 py-2.5 rounded-2xl text-sm font-bold text-rose-600 max-w-xs">⚠️ 이력 저장 실패: {saveErrorMsg}</div>
              )}
              {editMode && editSaveStatus !== 'idle' && (
                <div className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-sm font-bold shadow-lg border
                  ${editSaveStatus === 'saving' ? 'bg-white border-slate-200 text-slate-500' : editSaveStatus === 'done' ? 'bg-emerald-50 border-emerald-200 text-emerald-600' : 'bg-rose-50 border-rose-200 text-rose-600'}`}>
                  {editSaveStatus === 'saving' ? <><div className="w-4 h-4 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />편집본 저장 중...</> : editSaveStatus === 'done' ? '✅ 편집본 저장됨' : '⚠️ 편집본 저장 실패'}
                </div>
              )}
              <div className="flex gap-3 flex-wrap justify-end">
                <button
                  onClick={() => {
                    if (!editMode) {
                      if (!editedResult) setEditedResult(JSON.parse(JSON.stringify(result)));
                      setEditSaveStatus('idle');
                    }
                    setEditMode(prev => !prev);
                  }}
                  className={`px-5 py-3 rounded-2xl font-black text-sm shadow-lg transition-all active:scale-95 ${editMode ? 'bg-amber-500 text-white hover:bg-amber-600' : 'bg-slate-600 text-white hover:bg-slate-700'}`}>
                  {editMode ? '✏️ 편집 종료' : '✏️ 편집'}
                </button>
                {editMode && (
                  <button onClick={handleEditSave} disabled={editSaveStatus === 'saving'}
                    className="px-5 py-3 bg-green-600 hover:bg-green-700 text-white font-black text-sm rounded-2xl shadow-lg transition-all active:scale-95 disabled:opacity-50">
                    {editSaveStatus === 'saving' ? '⏳ 저장 중...' : '📥 편집본 저장'}
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
          )}
        </>
      )}

      {/* ══ 생성 이력 탭 ══ */}
      {activeTab === 'history' && (
        <div className="space-y-4">
          <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-2.5 text-xs font-bold text-amber-700">
            생성 이력은 생성일로부터 30일 후 자동 삭제됩니다.
          </div>

          {historyError && (
            <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl"><p className="text-rose-600 font-black">⚠️ {historyError}</p></div>
          )}

          {selectedIds.size > 0 && (
            <div className="flex items-center gap-3 px-5 py-3 bg-indigo-50 border border-indigo-200 rounded-2xl">
              <span className="font-black text-indigo-700 text-sm">{selectedIds.size}개 선택됨</span>
              <div className="flex gap-2 ml-auto">
                <button onClick={deleteSelected} disabled={bulkDeleting}
                  className="flex items-center gap-2 px-4 py-2 bg-rose-500 text-white rounded-xl font-black text-sm hover:bg-rose-600 active:scale-95 transition-all disabled:opacity-50">
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
              <div className="grid grid-cols-[40px_150px_80px_80px_1fr_56px_80px] gap-3 px-5 py-3 bg-slate-50 border-b border-slate-100 text-xs font-black text-slate-500">
                <input type="checkbox" checked={selectedIds.size === historyList.length && historyList.length > 0}
                  onChange={() => setSelectedIds(selectedIds.size === historyList.length ? new Set() : new Set(historyList.map(i => i.id)))}
                  className="w-4 h-4 rounded accent-indigo-600 cursor-pointer mt-0.5" />
                {['날짜', '년도', '학년', '시험명/기관', '난이도', 'PDF'].map((h, i) => <span key={i}>{h}</span>)}
              </div>
              {historyList.map((item, i) => (
                <div key={item.id}
                  className={`grid grid-cols-[40px_150px_80px_80px_1fr_56px_80px] gap-3 px-5 py-4 items-center border-b border-slate-100 last:border-0 transition-colors
                    ${selectedIds.has(item.id) ? 'bg-indigo-50' : i % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}`}>
                  <input type="checkbox" checked={selectedIds.has(item.id)}
                    onChange={() => setSelectedIds(prev => { const n = new Set(prev); if (n.has(item.id)) n.delete(item.id); else n.add(item.id); return n; })}
                    className="w-4 h-4 rounded accent-indigo-600 cursor-pointer" />
                  <span className="text-xs font-bold text-slate-600 whitespace-nowrap">
                    {new Date(item.created_at).toLocaleString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
                  </span>
                  <span className="text-sm font-bold text-slate-700">{item.year}년</span>
                  <span className="text-sm font-bold text-slate-700">{item.grade}</span>
                  <span className="text-sm text-slate-600 font-medium truncate">{item.institution} {item.question_number}번</span>
                  <span className="text-xs font-black px-2 py-1 rounded-full bg-slate-100 text-slate-600 w-fit">{item.difficulty || '-'}</span>
                  <div className="flex flex-col gap-1">
                    {item.pdf_path && (
                      <button onClick={() => downloadFromHistory(item.pdf_path, `${item.year}_${item.institution}_${item.question_number}번_문제.pdf`)}
                        className="px-2 py-1 bg-indigo-100 hover:bg-indigo-200 text-indigo-700 rounded-lg text-xs font-black transition-all w-full text-center">문제</button>
                    )}
                    {item.answer_pdf_path && (
                      <button onClick={() => downloadFromHistory(item.answer_pdf_path!, `${item.year}_${item.institution}_${item.question_number}번_해설.pdf`)}
                        className="px-2 py-1 bg-violet-100 hover:bg-violet-200 text-violet-700 rounded-lg text-xs font-black transition-all w-full text-center">해설</button>
                    )}
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
