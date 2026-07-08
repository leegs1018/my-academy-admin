'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { flushSync } from 'react-dom';
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

interface MockWorkbookHistoryItem {
  id: string; created_at: string;
  year: number; grade: string; institution: string; question_number: number;
  difficulty: string; pdf_path: string; answer_pdf_path?: string;
}

type UnifiedHistoryItem =
  | (PdfHistoryItem & { _source: 'input' })
  | (MockWorkbookHistoryItem & { _source: 'mock' });

interface WorkbookResult { number: string; passageText: string; materials: GeneratedMaterials; }


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
    const maxRatio = (297 - 2 * M) / cW; // A4 콘텐츠 최대 비율 (287/200 = 1.435)

    const opts = { pixelRatio: 2, quality: 0.9, backgroundColor: '#ffffff', cacheBust: true };
    const [url1, url2] = await Promise.all([
      toJpeg(page1El, opts),
      toJpeg(page2El, opts),
    ]);

    const pdf = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });

    // 이미지가 A4를 초과하면 Canvas로 슬라이싱해 여러 페이지에 나눠 삽입
    const addPaged = async (url: string, newPage: boolean) => {
      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const i = document.createElement('img') as HTMLImageElement;
        i.onload = () => resolve(i);
        i.onerror = () => reject(new Error('Image load failed in addPaged'));
        i.src = url;
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

async function generateMockPdfBlob(hideAnswerArea = false, suffix = ''): Promise<Blob | null> {
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
    const maxRatio = (297 - 2 * M) / cW;
    const opts = { pixelRatio: 2, quality: 0.9, backgroundColor: '#ffffff', cacheBust: true };
    const [url1, url2] = await Promise.all([toJpeg(page1El, opts), toJpeg(page2El, opts)]);
    const pdf = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });
    const addPaged = async (url: string, newPage: boolean) => {
      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const i = document.createElement('img') as HTMLImageElement;
        i.onload = () => resolve(i); i.onerror = () => reject(new Error('img load fail')); i.src = url;
      });
      const iW = img.naturalWidth, iH = img.naturalHeight;
      if (iH / iW <= maxRatio) {
        if (newPage) pdf.addPage();
        pdf.addImage(url, 'JPEG', M, M, cW, cW * (iH / iW)); return;
      }
      const sliceHpx = Math.floor(iW * maxRatio);
      let y = 0, first = true;
      while (y < iH) {
        const h = Math.min(sliceHpx, iH - y);
        const cv = document.createElement('canvas'); cv.width = iW; cv.height = h;
        const ctx = cv.getContext('2d')!;
        ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, iW, h); ctx.drawImage(img, 0, -y);
        if (newPage || !first) pdf.addPage(); first = false;
        pdf.addImage(cv.toDataURL('image/jpeg', 0.92), 'JPEG', M, M, cW, cW * (h / iW));
        y += sliceHpx;
      }
    };
    await addPaged(url1, false); await addPaged(url2, true);
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
  el.style.cssText = 'position:fixed;top:0;left:0;z-index:-9999;width:800px;background:white;padding:40px;box-sizing:border-box;font-family:Arial,Helvetica,sans-serif;';

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
  const [activeMainTab, setActiveMainTab] = useState<'input' | 'mock' | 'history'>('input');
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

  // ── Mock 탭 state ──
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
  const [mockDifficulty, setMockDifficulty] = useState<'b1' | 'b2' | 'c1' | 'c2'>('b2');
  const [mockLoading, setMockLoading] = useState(false);
  const [mockLoadingMsg, setMockLoadingMsg] = useState('');
  const [mockError, setMockError] = useState<string | null>(null);
  const [mockResults, setMockResults] = useState<WorkbookResult[]>([]);
  const [activeMockResultTab, setActiveMockResultTab] = useState(0);
  const [mockShowAnswerKeyMap, setMockShowAnswerKeyMap] = useState<Record<number, boolean>>({});
  const [mockCopiedSection, setMockCopiedSection] = useState<string | null>(null);
  const [mockEditModeIdx, setMockEditModeIdx] = useState<number | null>(null);
  const [mockEditedResults, setMockEditedResults] = useState<Record<number, GeneratedMaterials>>({});
  const [mockEditSaveStatusMap, setMockEditSaveStatusMap] = useState<Record<number, 'idle' | 'saving' | 'done' | 'error'>>({});
  const [mockPdfTitle, setMockPdfTitle] = useState('');
  const [mockPdfLoading, setMockPdfLoading] = useState<false | '문제' | '답안'>(false);
  const [mockPrintTheme, setMockPrintTheme] = useState<'color' | 'mono'>('mono');
  const [mockSaveStatusMap, setMockSaveStatusMap] = useState<Record<number, 'idle' | 'saving' | 'done' | 'error'>>({});
  const [mockSavedSet, setMockSavedSet] = useState<Set<number>>(new Set());
  const [mockWorkbookPrice, setMockWorkbookPrice] = useState<number | null>(null);
  const [session, setSession] = useState<{ access_token: string; user: { id: string } } | null>(null);

  const [historyList, setHistoryList] = useState<UnifiedHistoryItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchDate, setSearchDate] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkDownloading, setBulkDownloading] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [passageModal, setPassageModal] = useState<{ title: string; text: string } | null>(null);
  const [pdfAnalysisPrice, setPdfAnalysisPrice] = useState<number | null>(null);
  const [printTheme, setPrintTheme] = useState<'color' | 'mono'>('mono');

  // ── 세션 로드 ──
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      if (s) setSession(s as typeof session);
    });
  }, []);

  // ── CON 단가 로드 ──
  useEffect(() => {
    fetch('/api/credits/pricing')
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        const pricing = data?.pricing ?? [];
        const directItem = pricing.find((p: { feature_key: string; cost_per_use: number }) => p.feature_key === 'pdf_analysis_direct')
          ?? pricing.find((p: { feature_key: string; cost_per_use: number }) => p.feature_key === 'pdf_analysis');
        if (directItem) setPdfAnalysisPrice(directItem.cost_per_use);
        const mockItem = pricing.find((p: { feature_key: string; cost_per_use: number }) => p.feature_key === 'pdf_analysis_mock')
          ?? pricing.find((p: { feature_key: string; cost_per_use: number }) => p.feature_key === 'pdf_analysis');
        if (mockItem) setMockWorkbookPrice(mockItem.cost_per_use);
      })
      .catch(() => {});
  }, []);

  // ── Mock 캐스케이드 fetch ──
  useEffect(() => {
    supabase.from('mock_exam_passages').select('year').order('year', { ascending: false })
      .then(({ data }) => setMockYears([...new Set((data ?? []).map((r: { year: number }) => r.year))]));
  }, []);

  useEffect(() => {
    if (!mockSelectedYear) return;
    setMockSelectedGrade(''); setMockSelectedInstitution(''); setMockSelectedNumbers([]); setMockPassageMap({}); setMockLoadingNumbers(new Set());
    supabase.from('mock_exam_passages').select('grade').eq('year', parseInt(mockSelectedYear)).order('grade', { ascending: true })
      .then(({ data }) => setMockGrades([...new Set((data ?? []).map((r: { grade: string }) => r.grade))]));
  }, [mockSelectedYear]);

  useEffect(() => {
    if (!mockSelectedYear || !mockSelectedGrade) return;
    setMockSelectedInstitution(''); setMockSelectedNumbers([]); setMockPassageMap({}); setMockLoadingNumbers(new Set());
    supabase.from('mock_exam_passages').select('institution').eq('year', parseInt(mockSelectedYear)).eq('grade', mockSelectedGrade)
      .then(({ data }) => {
        const unique = [...new Set((data ?? []).map((r: { institution: string }) => r.institution))];
        unique.sort((a, b) => (parseInt(a.match(/^(\d+)/)?.[1] ?? '99') - parseInt(b.match(/^(\d+)/)?.[1] ?? '99')));
        setMockInstitutions(unique);
      });
  }, [mockSelectedYear, mockSelectedGrade]);

  useEffect(() => {
    if (!mockSelectedYear || !mockSelectedGrade || !mockSelectedInstitution) return;
    setMockSelectedNumbers([]); setMockPassageMap({}); setMockLoadingNumbers(new Set());
    supabase.from('mock_exam_passages').select('question_number')
      .eq('year', parseInt(mockSelectedYear)).eq('grade', mockSelectedGrade).eq('institution', mockSelectedInstitution)
      .order('question_number')
      .then(({ data }) => setMockQuestionNumbers((data ?? []).map((r: { question_number: number }) => r.question_number)));
  }, [mockSelectedYear, mockSelectedGrade, mockSelectedInstitution]);

  // ── Mock 탭 자동저장 트리거 ──
  useEffect(() => {
    if (!mockResults[activeMockResultTab] || mockSavedSet.has(activeMockResultTab) || !session) return;
    const timer = setTimeout(() => autoSaveMock(activeMockResultTab), 800);
    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeMockResultTab, mockResults]);

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

  // ── 이력 조회 (직접입력 + 모의고사 통합) ──
  const fetchHistory = useCallback(async (query = searchQuery, date = searchDate) => {
    setHistoryLoading(true);
    setHistoryError(null);
    try {
      await fetch('/api/cleanup-old-history', { method: 'POST' });
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setHistoryError('로그인 정보를 확인할 수 없습니다.'); return; }

      let qInput = supabase.from('pdf_history').select('*').eq('academy_id', user.id).order('created_at', { ascending: false });
      let qMock = supabase.from('mock_workbook_history').select('*').eq('academy_id', user.id).order('created_at', { ascending: false });
      if (date) {
        qInput = qInput.gte('created_at', date).lte('created_at', date + 'T23:59:59');
        qMock = qMock.gte('created_at', date).lte('created_at', date + 'T23:59:59');
      }
      if (query) {
        qInput = qInput.ilike('passage_full', `%${query}%`);
        qMock = qMock.ilike('institution', `%${query}%`);
      }
      const [{ data: inputData, error: e1 }, { data: mockData, error: e2 }] = await Promise.all([qInput, qMock]);
      if (e1) { setHistoryError(`조회 오류: ${e1.message}`); return; }
      if (e2) { setHistoryError(`조회 오류: ${e2.message}`); return; }
      const combined: UnifiedHistoryItem[] = [
        ...(inputData ?? []).map((r: PdfHistoryItem) => ({ ...r, _source: 'input' as const })),
        ...(mockData ?? []).map((r: MockWorkbookHistoryItem) => ({ ...r, _source: 'mock' as const })),
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
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { alert('로그인이 필요합니다.'); return; }
    const res = await fetch('/api/get-signed-url', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ path: pdfPath }),
    });
    const json = await res.json() as { signedUrl?: string; error?: string };
    if (!res.ok || !json.signedUrl) { alert('다운로드 링크 생성에 실패했습니다.'); return; }
    const blob = await fetch(json.signedUrl).then(r => r.blob());
    triggerDownload(blob, filename);
  };

  // ── 선택 항목 일괄 다운로드 ──
  const downloadSelected = async () => {
    setBulkDownloading(true);
    const items = historyList.filter(i => selectedIds.has(i.id));
    for (const item of items) {
      const base = item._source === 'input' ? (item.title || '영어문제') : `${item.year}_${item.institution}_${item.question_number}번`;
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

  // ── 선택 항목 삭제 (소스별 분기) ──
  const deleteSelected = async () => {
    if (selectedIds.size === 0) return;
    setBulkDeleting(true);
    try {
      const { data: { session: sess } } = await supabase.auth.getSession();
      if (!sess) { setBulkDeleting(false); alert('로그인이 필요합니다.'); return; }
      const inputIds = historyList.filter(i => selectedIds.has(i.id) && i._source === 'input').map(i => i.id);
      const mockIds = historyList.filter(i => selectedIds.has(i.id) && i._source === 'mock').map(i => i.id);
      const calls: Promise<Response>[] = [];
      if (inputIds.length) calls.push(fetch('/api/delete-pdf-history', {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sess.access_token}` },
        body: JSON.stringify({ ids: inputIds }),
      }));
      if (mockIds.length) calls.push(fetch('/api/delete-mock-workbook-history', {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sess.access_token}` },
        body: JSON.stringify({ ids: mockIds }),
      }));
      await Promise.all(calls);
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

  // ── Mock 탭 함수 ──
  const toggleMockNumber = async (num: string) => {
    if (mockSelectedNumbers.includes(num)) {
      setMockSelectedNumbers(prev => prev.filter(n => n !== num));
      setMockPassageMap(prev => { const next = { ...prev }; delete next[num]; return next; });
    } else {
      setMockSelectedNumbers(prev => [...prev, num]);
      setMockLoadingNumbers(prev => new Set([...prev, num]));
      const { data } = await supabase.from('mock_exam_passages').select('passage_text')
        .eq('year', parseInt(mockSelectedYear)).eq('grade', mockSelectedGrade)
        .eq('institution', mockSelectedInstitution).eq('question_number', parseInt(num)).single();
      const text = (data?.passage_text ?? '').replace(/\n+/g, ' ').replace(/\s+/g, ' ').trim();
      setMockPassageMap(prev => ({ ...prev, [num]: text }));
      setMockLoadingNumbers(prev => { const next = new Set(prev); next.delete(num); return next; });
    }
  };

  const autoSaveMock = useCallback(async (idx: number) => {
    if (!session || mockSavedSet.has(idx)) return;
    const r = mockResults[idx];
    if (!r) return;
    setMockSaveStatusMap(prev => ({ ...prev, [idx]: 'saving' }));
    setMockSavedSet(prev => new Set([...prev, idx]));
    try {
      const suffix = `-${idx}`;
      const [pdfBlob, answerBlob] = await Promise.all([
        generateMockPdfBlob(true, suffix),
        buildAnswerPdfBlob(mockEditedResults[idx] ?? r.materials, mockPdfTitle.trim()),
      ]);
      if (!pdfBlob) { setMockSaveStatusMap(prev => ({ ...prev, [idx]: 'error' })); return; }
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
          year: parseInt(mockSelectedYear), grade: mockSelectedGrade, institution: mockSelectedInstitution,
          questionNumber: parseInt(r.number), difficulty: mockDifficulty,
        }),
      });
      const json = await res.json() as { success?: boolean; error?: string };
      setMockSaveStatusMap(prev => ({ ...prev, [idx]: res.ok && json.success ? 'done' : 'error' }));
    } catch { setMockSaveStatusMap(prev => ({ ...prev, [idx]: 'error' })); }
  }, [session, mockResults, mockSavedSet, mockPdfTitle, mockSelectedYear, mockSelectedGrade, mockSelectedInstitution, mockDifficulty, mockEditedResults]);

  const handleMockGenerate = async () => {
    const sortedNums = [...mockSelectedNumbers].sort((a, b) => parseInt(a) - parseInt(b));
    if (sortedNums.length === 0 || mockLoading || !session) return;
    setMockLoading(true); setMockError(null); setMockResults([]); setActiveMockResultTab(0);
    setMockSaveStatusMap({}); setMockSavedSet(new Set()); setMockEditModeIdx(null); setMockEditedResults({});
    const validNums = sortedNums.filter(n => mockPassageMap[n]);
    type MockResult = { number: string; passageText: string; materials: GeneratedMaterials };
    const resultSlots = new Array<MockResult | null>(validNums.length).fill(null);
    let completedCount = 0;
    setMockLoadingMsg(`0/${validNums.length}개 지문 생성 중...`);
    try {
      const settled = await Promise.allSettled(
        validNums.map(async (num, i) => {
          const text = mockPassageMap[num];
          const res = await fetch('/api/process-pdf', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text, difficulty: mockDifficulty, academy_id: session.user.id, feature_key: 'mock_workbook' }),
          });
          const json = JSON.parse(await res.text()) as { data?: GeneratedMaterials; error?: string };
          if (!res.ok) throw new Error(json.error || `${num}번 생성 오류`);
          resultSlots[i] = { number: num, passageText: text, materials: json.data as GeneratedMaterials };
          completedCount++;
          setMockLoadingMsg(`${completedCount}/${validNums.length}개 지문 생성 완료...`);
          setMockResults(resultSlots.filter((r): r is MockResult => r !== null));
        })
      );
      const firstFailed = settled.find(r => r.status === 'rejected');
      if (firstFailed) {
        setMockError((firstFailed as PromiseRejectedResult).reason?.message || '일부 지문 생성에 실패했습니다.');
      }
    } catch (e) { setMockError(e instanceof Error ? e.message : '오류가 발생했습니다.'); }
    finally { setMockLoading(false); }
  };

  const handleMockDownloadProblem = async () => {
    setMockPdfLoading('문제');
    const isEditing = mockEditModeIdx === activeMockResultTab;
    try {
      if (isEditing) { setMockEditModeIdx(null); await new Promise(r => requestAnimationFrame(r)); await new Promise(r => requestAnimationFrame(r)); }
      const blob = await generateMockPdfBlob(true, `-${activeMockResultTab}`);
      if (isEditing) setMockEditModeIdx(activeMockResultTab);
      if (!blob) throw new Error('PDF 요소를 찾을 수 없습니다.');
      const r = mockResults[activeMockResultTab];
      triggerDownload(blob, `${mockPdfTitle.trim() || `${r?.number}번_워크북`}_문제.pdf`);
    } catch (e) {
      if (isEditing) setMockEditModeIdx(activeMockResultTab);
      alert(`PDF 저장 실패: ${e instanceof Error ? e.message : '오류'}`);
    } finally { setMockPdfLoading(false); }
  };

  const handleMockDownloadAnswer = async () => {
    const r = mockResults[activeMockResultTab];
    if (!r) return;
    const d = mockEditedResults[activeMockResultTab] ?? r.materials;
    setMockPdfLoading('답안');
    try {
      const blob = await buildAnswerPdfBlob(d, mockPdfTitle.trim() || `${r.number}번 워크북`);
      triggerDownload(blob, `${mockPdfTitle.trim() || `${r.number}번_워크북`}_답안해설.pdf`);
    } catch (e) { alert(`PDF 저장 실패: ${e instanceof Error ? e.message : '오류'}`); }
    finally { setMockPdfLoading(false); }
  };

  const handleMockEditSave = async (idx: number) => {
    const edited = mockEditedResults[idx];
    const r = mockResults[idx];
    if (!edited || !r || !session) return;
    setMockEditSaveStatusMap(prev => ({ ...prev, [idx]: 'saving' }));
    const isEditing = mockEditModeIdx === idx;
    try {
      if (isEditing) { setMockEditModeIdx(null); await new Promise(r => requestAnimationFrame(r)); await new Promise(r => requestAnimationFrame(r)); }
      const [pdfBlob, answerBlob] = await Promise.all([generateMockPdfBlob(true, `-${idx}`), buildAnswerPdfBlob(edited, mockPdfTitle.trim())]);
      if (isEditing) setMockEditModeIdx(idx);
      if (!pdfBlob) { setMockEditSaveStatusMap(prev => ({ ...prev, [idx]: 'error' })); return; }
      const toBase64 = (blob: Blob) => new Promise<string>((resolve, reject) => {
        const reader = new FileReader(); reader.onloadend = () => resolve((reader.result as string).split(',')[1]); reader.onerror = reject; reader.readAsDataURL(blob);
      });
      const [pdfBase64, answerPdfBase64] = await Promise.all([toBase64(pdfBlob), toBase64(answerBlob)]);
      const res = await fetch('/api/save-mock-workbook-history', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ pdfBase64, answerPdfBase64, year: parseInt(mockSelectedYear), grade: mockSelectedGrade, institution: mockSelectedInstitution, questionNumber: parseInt(r.number), difficulty: mockDifficulty }),
      });
      const json = await res.json() as { success?: boolean };
      setMockEditSaveStatusMap(prev => ({ ...prev, [idx]: res.ok && json.success ? 'done' : 'error' }));
    } catch { if (isEditing) setMockEditModeIdx(idx); setMockEditSaveStatusMap(prev => ({ ...prev, [idx]: 'error' })); }
  };

  const mockCopy = async (text: string, id: string) => {
    try { await navigator.clipboard.writeText(text); } catch { /* ignore */ }
    setMockCopiedSection(id); setTimeout(() => setMockCopiedSection(null), 2000);
  };

  const mockSortedSelectedNumbers = [...mockSelectedNumbers].sort((a, b) => parseInt(a) - parseInt(b));
  const mockAllPassagesReady = mockSelectedNumbers.length > 0 && mockSelectedNumbers.every(n => mockPassageMap[n]) && mockLoadingNumbers.size === 0;
  const canMockGenerate = mockAllPassagesReady && !mockLoading && !!session;

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
        flushSync(() => setEditMode(false));
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
    } catch (e) {
      console.error('[handleEditSave]', e);
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
        {([['input', '✏️ 직접 입력'], ['mock', '📖 모의고사 지문'], ['history', '📋 생성 이력']] as const).map(([tab, label]) => (
          <button key={tab} onClick={() => setActiveMainTab(tab)}
            className={`px-6 py-3 font-black text-base rounded-t-xl transition-all
              ${activeMainTab === tab ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-600'}`}>
            {label}
          </button>
        ))}
      </div>

      {/* ══ 직접 입력 탭 ══ */}
      {activeMainTab === 'input' && (
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
              <p className="mt-4 mb-1 text-center text-sm font-black text-amber-600">
                <span className="text-yellow-500">{pdfAnalysisPrice} CON</span> 차감 예정
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
                  <div className="space-y-0.5 mb-2">
                    {d.tf_questions.map((q) => (
                      <div key={q.number} className={`flex items-start gap-2 px-2 py-0.5 rounded-lg transition-colors ${printTheme === 'color' ? 'hover:bg-violet-50' : ''}`}>
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
                          <p className="text-slate-700 font-bold leading-snug flex-1 text-2xl">{q.statement}</p>
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

      {/* ══ 모의고사 지문 탭 ══ */}
      {activeMainTab === 'mock' && (
        <>
          {mockLoading && (
            <div className="no-print fixed inset-0 bg-indigo-900/60 backdrop-blur-md z-[200] flex items-center justify-center">
              <div className="bg-white rounded-[2.5rem] p-12 text-center shadow-2xl max-w-sm mx-4">
                <div className="w-16 h-16 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-6" />
                <p className="font-black text-indigo-600 text-xl animate-pulse">{mockLoadingMsg}</p>
                <p className="text-slate-400 font-bold text-sm mt-3">지문당 30~60초 소요됩니다</p>
              </div>
            </div>
          )}
          <div className="no-print bg-white p-8 rounded-[2.5rem] shadow-xl border border-slate-100 mb-8">
            <div className="mb-6">
              <label className="text-sm font-black text-slate-600 mb-2 block">제목 (PDF 파일명)</label>
              <input type="text" value={mockPdfTitle} onChange={e => setMockPdfTitle(e.target.value)}
                placeholder="예: 2024 수능 워크북"
                className="w-full px-5 py-3 border-2 border-slate-200 rounded-2xl font-bold text-slate-700 focus:outline-none focus:border-indigo-400 transition-colors placeholder:text-slate-300" />
            </div>
            <div className="mb-6">
              <p className="text-base font-black text-slate-700 mb-3">STEP 1 — 기출 지문 선택</p>
              <div className="grid grid-cols-3 gap-3 mb-4">
                {[
                  { label: '년도', value: mockSelectedYear, onChange: setMockSelectedYear, disabled: false, options: mockYears.map(y => ({ value: String(y), label: `${y}년` })) },
                  { label: '학년', value: mockSelectedGrade, onChange: setMockSelectedGrade, disabled: !mockSelectedYear, options: mockGrades.map(g => ({ value: g, label: g })) },
                  { label: '시험명/기관', value: mockSelectedInstitution, onChange: setMockSelectedInstitution, disabled: !mockSelectedGrade, options: mockInstitutions.map(inst => ({ value: inst, label: inst })) },
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
              {mockQuestionNumbers.length > 0 && (
                <div>
                  <label className="block text-xs font-black text-slate-400 mb-2">문제번호 (여러 개 선택 가능)</label>
                  <div className="flex flex-wrap gap-2">
                    {mockQuestionNumbers.map(n => {
                      const num = String(n);
                      const isSelected = mockSelectedNumbers.includes(num);
                      const isLoading = mockLoadingNumbers.has(num);
                      return (
                        <button key={n} onClick={() => toggleMockNumber(num)} disabled={isLoading}
                          className={`px-3 py-1.5 rounded-xl text-sm font-black border-2 transition-all ${
                            isSelected ? 'bg-indigo-600 border-indigo-600 text-white shadow-sm' : 'bg-white border-slate-200 text-slate-600 hover:border-indigo-300 hover:text-indigo-600'
                          } ${isLoading ? 'opacity-50 cursor-wait' : ''}`}>
                          {isLoading ? '...' : `${n}번`}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
              {mockSortedSelectedNumbers.length > 0 && (
                <div className="mt-4 space-y-2">
                  {mockSortedSelectedNumbers.map(num => mockPassageMap[num] && (
                    <div key={num} className="bg-slate-50 border border-slate-200 rounded-xl p-3">
                      <p className="text-xs font-black text-indigo-600 mb-1">{num}번 지문</p>
                      <p className="text-sm text-slate-600 font-medium leading-relaxed line-clamp-2 select-none"
                        style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}
                        onContextMenu={e => e.preventDefault()} onDragStart={e => e.preventDefault()}>
                        {mockPassageMap[num]}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="mb-6">
              <p className="text-base font-black text-slate-700 mb-3">STEP 2 — 난이도 선택 (전체 적용)</p>
              <div className="flex gap-2">
                {([
                  { key: 'b1', level: 'B1', label: '중등/고등 하', icon: '🌱', active: 'border-sky-400 bg-sky-50 text-sky-700' },
                  { key: 'b2', level: 'B2', label: '고등 중',      icon: '🌳', active: 'border-emerald-500 bg-emerald-50 text-emerald-700' },
                  { key: 'c1', level: 'C1', label: '고등 상',      icon: '🔥', active: 'border-orange-500 bg-orange-50 text-orange-700' },
                  { key: 'c2', level: 'C2', label: '고등 최상',    icon: '⚡', active: 'border-rose-500 bg-rose-50 text-rose-700' },
                ] as const).map(d => (
                  <button key={d.key} onClick={() => setMockDifficulty(d.key)}
                    className={`flex-1 py-4 rounded-xl font-black transition-all border-2 ${mockDifficulty === d.key ? d.active : 'border-gray-200 bg-white text-gray-400 hover:border-gray-300 hover:text-gray-600'}`}>
                    <div className="text-2xl mb-1">{d.icon}</div>
                    <div className="text-xs font-bold opacity-70 mb-0.5">{d.level}</div>
                    <div className="text-sm">{d.label}</div>
                  </button>
                ))}
              </div>
            </div>
            {mockWorkbookPrice !== null && mockWorkbookPrice > 0 && (
              <p className="text-center text-sm font-black text-amber-600 mb-3">
                {mockSelectedNumbers.length > 1
                  ? <><span className="text-yellow-500">{mockWorkbookPrice} CON</span> × {mockSelectedNumbers.length}지문 = 총 <span className="text-yellow-500">{mockWorkbookPrice * mockSelectedNumbers.length} CON</span> 차감 예정</>
                  : <><span className="text-yellow-500">{mockWorkbookPrice} CON</span> 차감 예정</>
                }
              </p>
            )}
            {mockError && <div className="mb-4 p-4 bg-rose-50 border border-rose-200 rounded-2xl"><p className="text-rose-600 font-black">⚠️ {mockError}</p></div>}
            <button onClick={handleMockGenerate} disabled={!canMockGenerate}
              className="w-full bg-indigo-600 text-white py-5 rounded-2xl font-black text-xl shadow-xl hover:bg-indigo-700 active:scale-[0.98] transition-all disabled:opacity-40 disabled:cursor-not-allowed">
              {mockSelectedNumbers.length > 1 ? `AI로 워크북 ${mockSelectedNumbers.length}개 생성하기 🚀` : 'AI로 워크북 생성하기 🚀'}
            </button>
          </div>

          {mockResults.length > 0 && (() => {
            const activeResult = mockResults[activeMockResultTab];
            const activeD = mockEditedResults[activeMockResultTab] ?? activeResult?.materials;
            return (
              <>
                {mockResults.length > 1 && (
                  <div className="no-print flex gap-2 mb-4 flex-wrap">
                    {mockResults.map((r, i) => (
                      <button key={i} onClick={() => setActiveMockResultTab(i)}
                        className={`px-4 py-2 rounded-xl font-black text-sm transition-all border-2 ${
                          activeMockResultTab === i ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-white border-slate-200 text-slate-600 hover:border-indigo-300'
                        }`}>
                        {r.number}번
                        {mockSaveStatusMap[i] === 'done' && <span className="ml-1 text-xs">✅</span>}
                        {mockSaveStatusMap[i] === 'saving' && <span className="ml-1 text-xs animate-pulse">💾</span>}
                      </button>
                    ))}
                  </div>
                )}
                {activeResult && activeD && (
                  <div id={`mw-print-area-${activeMockResultTab}`} className="space-y-0">
                    <div id={`mw-pdf-page-1-${activeMockResultTab}`} className="space-y-3 mb-4">
                      {mockPdfTitle.trim() && (
                        <div className="mb-3 pb-2 border-b-2 border-slate-200">
                          <h1 className="text-2xl font-black text-slate-900">{mockPdfTitle.trim()} — {activeResult.number}번</h1>
                        </div>
                      )}
                      <div className="bg-white rounded-2xl border border-slate-100 shadow-lg overflow-hidden">
                        <div className="bg-slate-700 px-5 py-2.5 flex items-center gap-3">
                          <span className="font-black text-2xl leading-none text-white/70">00</span>
                          <h2 className="font-black text-lg leading-tight text-white">원문 지문</h2>
                        </div>
                        <div className="p-4">
                          <p className="text-slate-700 font-bold leading-relaxed text-xl select-none" style={{ wordBreak: 'break-word' }}
                            onContextMenu={e => e.preventDefault()} onDragStart={e => e.preventDefault()}>{activeResult.passageText}</p>
                        </div>
                      </div>
                      <SectionCard number="01" title="변형 지문" color="bg-teal-600" theme={mockPrintTheme}
                        onCopy={() => mockCopy(activeD.paraphrased_passage ?? '', 'paraphrase')} copied={mockCopiedSection === 'paraphrase'}>
                        {mockEditModeIdx === activeMockResultTab ? (
                          <textarea className="w-full p-3 border-2 border-teal-200 rounded-xl font-bold text-slate-700 text-base leading-relaxed resize-y focus:outline-none focus:border-teal-400 min-h-[120px]"
                            value={mockEditedResults[activeMockResultTab]?.paraphrased_passage ?? ''}
                            onChange={e => setMockEditedResults(prev => ({ ...prev, [activeMockResultTab]: { ...prev[activeMockResultTab], paraphrased_passage: e.target.value } }))} />
                        ) : (
                          <p className="text-slate-700 font-bold leading-relaxed whitespace-pre-wrap text-xl">{activeD.paraphrased_passage}</p>
                        )}
                      </SectionCard>
                      <SectionCard number="02" title="T/F 문제 10개" color="bg-violet-500" theme={mockPrintTheme}
                        onCopy={() => mockCopy(activeD.tf_questions.map(q => `${q.number}. ${q.statement}`).join('\n'), 'tf')} copied={mockCopiedSection === 'tf'}>
                        <div className="space-y-0.5 mb-2">
                          {activeD.tf_questions.map((q, qi) => (
                            <div key={q.number} className={`flex items-start gap-2 px-2 py-0.5 rounded-lg ${mockPrintTheme === 'color' ? 'hover:bg-violet-50' : ''}`}>
                              <span className={`font-black w-7 shrink-0 text-lg ${mockPrintTheme === 'color' ? 'text-violet-600' : 'text-slate-600'}`}>{q.number}.</span>
                              {mockEditModeIdx === activeMockResultTab ? (
                                <textarea className="flex-1 border border-slate-200 rounded p-1 font-bold text-slate-700 text-base resize-none focus:outline-none focus:border-slate-400 min-h-[36px]"
                                  value={q.statement}
                                  onChange={e => setMockEditedResults(prev => {
                                    const cur = prev[activeMockResultTab] ?? activeResult.materials;
                                    const tf = [...cur.tf_questions]; tf[qi] = { ...tf[qi], statement: e.target.value };
                                    return { ...prev, [activeMockResultTab]: { ...cur, tf_questions: tf } };
                                  })} />
                              ) : (
                                <p className="text-slate-700 font-bold leading-snug flex-1 text-2xl">{q.statement}</p>
                              )}
                            </div>
                          ))}
                        </div>
                        <div className={`mw-answer-area border-t pt-3 ${mockPrintTheme === 'color' ? 'border-violet-100' : 'border-slate-200'}`}>
                          <button onClick={() => setMockShowAnswerKeyMap(prev => ({ ...prev, [activeMockResultTab]: !prev[activeMockResultTab] }))}
                            className={`no-print flex items-center gap-2 font-black text-sm ${mockPrintTheme === 'color' ? 'text-violet-600' : 'text-slate-600'}`}>
                            <span className={`transition-transform ${mockShowAnswerKeyMap[activeMockResultTab] ? 'rotate-90' : ''}`}>▶</span>
                            해설지 {mockShowAnswerKeyMap[activeMockResultTab] ? '닫기' : '보기'}
                          </button>
                          {mockShowAnswerKeyMap[activeMockResultTab] && (
                            <div className="mt-3">
                              <div className={`p-3 rounded-2xl border ${mockPrintTheme === 'color' ? 'bg-violet-50 border-violet-100' : 'bg-white border-slate-200'}`}>
                                <p className={`font-black text-sm mb-1 ${mockPrintTheme === 'color' ? 'text-violet-700' : 'text-slate-700'}`}>정답</p>
                                <p className="font-black text-slate-700 tracking-wide text-sm">{activeD.answer_key}</p>
                              </div>
                            </div>
                          )}
                        </div>
                      </SectionCard>
                    </div>
                    <div id={`mw-pdf-page-2-${activeMockResultTab}`} className="space-y-3">
                      <SectionCard number="03" title="한글 요약" color="bg-indigo-500" theme={mockPrintTheme}
                        onCopy={() => mockCopy(activeD.korean_summary.rows.map(r => `[${r.label}] ${r.content}`).join('\n'), 'korean')} copied={mockCopiedSection === 'korean'}>
                        <div>
                          <span className={`inline-block mb-3 text-base font-black px-3 py-1 rounded-full ${mockPrintTheme === 'color' ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-700'}`}>
                            {activeD.korean_summary.type === '일반' ? '일반 지문' : activeD.korean_summary.type === '논쟁' ? '논쟁 지문' : '문제 지문'}
                          </span>
                          <table className="w-full border-collapse">
                            <tbody>
                              {activeD.korean_summary.rows.map((row, i) => (
                                <tr key={i} className={mockPrintTheme === 'color' && i % 2 === 0 ? 'bg-indigo-50' : 'bg-white'}>
                                  <td className={`w-28 p-2.5 font-black text-base border whitespace-nowrap align-top ${mockPrintTheme === 'color' ? 'text-indigo-700 border-indigo-100' : 'text-slate-700 border-slate-200'}`}>{row.label}</td>
                                  <td className={`p-2.5 border ${mockPrintTheme === 'color' ? 'border-indigo-100' : 'border-slate-200'}`}>
                                    {mockEditModeIdx === activeMockResultTab ? (
                                      <textarea className="w-full border border-indigo-200 rounded p-1 font-bold text-slate-700 text-base resize-none focus:outline-none focus:border-indigo-400 min-h-[40px]"
                                        value={row.content}
                                        onChange={e => setMockEditedResults(prev => {
                                          const cur = prev[activeMockResultTab] ?? activeResult.materials;
                                          const rows = [...cur.korean_summary.rows]; rows[i] = { ...rows[i], content: e.target.value };
                                          return { ...prev, [activeMockResultTab]: { ...cur, korean_summary: { ...cur.korean_summary, rows } } };
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
                      <SectionCard number="04" title="영어 제목 3가지" color="bg-amber-500" theme={mockPrintTheme}
                        onCopy={() => mockCopy(activeD.english_titles.map((t, i) => `${i + 1}. ${t}`).join('\n'), 'titles')} copied={mockCopiedSection === 'titles'}>
                        <div className="space-y-2">
                          {activeD.english_titles.map((title, i) => {
                            const { english, korean } = parseTitleKorean(title);
                            return (
                              <div key={i} className={`flex items-start gap-2 px-3 py-2.5 rounded-xl border ${mockPrintTheme === 'color' ? 'bg-amber-50 border-amber-100' : 'bg-white border-slate-200'}`}>
                                <span className={`font-black w-8 shrink-0 text-lg ${mockPrintTheme === 'color' ? 'text-amber-600' : 'text-slate-600'}`}>{i + 1}.</span>
                                {mockEditModeIdx === activeMockResultTab ? (
                                  <input className="flex-1 border border-amber-200 rounded p-1 font-bold text-slate-700 text-base focus:outline-none focus:border-amber-400"
                                    value={title}
                                    onChange={e => setMockEditedResults(prev => {
                                      const cur = prev[activeMockResultTab] ?? activeResult.materials;
                                      const titles = [...cur.english_titles]; titles[i] = e.target.value;
                                      return { ...prev, [activeMockResultTab]: { ...cur, english_titles: titles } };
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
                      <SectionCard number="05" title="1문장 영어 요약 3가지" color="bg-rose-500" theme={mockPrintTheme}
                        onCopy={() => mockCopy(activeD.one_sentence_summaries.map((s, i) => `${i + 1}. ${s.english.replace(/\*\*/g, '')}\n   (${cleanKorean(s.korean)})`).join('\n\n'), 'one_sentence')} copied={mockCopiedSection === 'one_sentence'}>
                        <div className="space-y-2">
                          {activeD.one_sentence_summaries.map((s, i) => (
                            <div key={i} className={`px-3 py-2.5 rounded-xl border ${mockPrintTheme === 'color' ? 'bg-rose-50 border-rose-100' : 'bg-white border-slate-200'}`}>
                              <div className="flex items-start gap-2">
                                <span className={`font-black w-8 shrink-0 text-lg ${mockPrintTheme === 'color' ? 'text-rose-600' : 'text-slate-600'}`}>{i + 1}.</span>
                                {mockEditModeIdx === activeMockResultTab ? (
                                  <div className="flex-1 flex flex-col gap-1">
                                    <input className="w-full border border-rose-200 rounded p-1 font-bold text-slate-700 text-base focus:outline-none focus:border-rose-400"
                                      value={s.english}
                                      onChange={e => setMockEditedResults(prev => {
                                        const cur = prev[activeMockResultTab] ?? activeResult.materials;
                                        const sums = [...cur.one_sentence_summaries]; sums[i] = { ...sums[i], english: e.target.value };
                                        return { ...prev, [activeMockResultTab]: { ...cur, one_sentence_summaries: sums } };
                                      })} />
                                    <input className="w-full border border-rose-200 rounded p-1 font-bold text-slate-500 text-sm focus:outline-none focus:border-rose-400"
                                      value={s.korean}
                                      onChange={e => setMockEditedResults(prev => {
                                        const cur = prev[activeMockResultTab] ?? activeResult.materials;
                                        const sums = [...cur.one_sentence_summaries]; sums[i] = { ...sums[i], korean: e.target.value };
                                        return { ...prev, [activeMockResultTab]: { ...cur, one_sentence_summaries: sums } };
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
                      <SectionCard number="06" title="관련 어휘 10개" color="bg-slate-700" theme={mockPrintTheme}
                        onCopy={() => mockCopy(activeD.vocabulary_table.map(r => `${r.word} (${r.meaning}) | ${r.syn1} (${r.syn1_m}) | ${r.syn2} (${r.syn2_m}) | ${r.syn3} (${r.syn3_m}) | ${r.antonym} (${r.antonym_m})`).join('\n'), 'vocab')} copied={mockCopiedSection === 'vocab'}>
                        <table className="w-full text-lg border-collapse table-fixed">
                          <colgroup><col style={{ width: '22%' }} /><col style={{ width: '19%' }} /><col style={{ width: '19%' }} /><col style={{ width: '19%' }} /><col style={{ width: '21%' }} /></colgroup>
                          <thead>
                            <tr className="bg-slate-800 text-white">
                              {['표제어 (뜻)', '유의어 1 (뜻)', '유의어 2 (뜻)', '유의어 3 (뜻)', '반의어 (뜻)'].map((h, i) => (
                                <th key={i} className={`px-2 py-2 text-left font-black ${i === 0 ? 'rounded-tl-lg' : ''} ${i === 4 ? 'rounded-tr-lg' : ''}`}>{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {activeD.vocabulary_table.map((row, i) => {
                              const updateVocab = (patch: Partial<VocabRow>) => setMockEditedResults(prev => {
                                const cur = prev[activeMockResultTab] ?? activeResult.materials;
                                const vocab = [...cur.vocabulary_table]; vocab[i] = { ...vocab[i], ...patch };
                                return { ...prev, [activeMockResultTab]: { ...cur, vocabulary_table: vocab } };
                              });
                              return (
                                <tr key={i} className={mockPrintTheme === 'color' && i % 2 !== 0 ? 'bg-slate-50' : 'bg-white'}>
                                  <td className="px-2 py-2 border-b border-slate-100">
                                    {mockEditModeIdx === activeMockResultTab ? (
                                      <div className="flex flex-col gap-0.5">
                                        <input className="w-full border border-indigo-200 rounded px-1 py-0.5 font-black text-indigo-700 text-sm focus:outline-none focus:border-indigo-400" value={row.word} onChange={e => updateVocab({ word: e.target.value })} />
                                        <input className="w-full border border-slate-200 rounded px-1 py-0.5 text-slate-500 text-xs focus:outline-none focus:border-slate-400" value={row.meaning} onChange={e => updateVocab({ meaning: e.target.value })} />
                                      </div>
                                    ) : (<><span className="font-black text-indigo-700">{row.word}</span><span className="text-slate-900 text-base ml-1">({row.meaning})</span></>)}
                                  </td>
                                  {([['syn1', 'syn1_m'], ['syn2', 'syn2_m'], ['syn3', 'syn3_m']] as const).map(([wk, mk], j) => (
                                    <td key={j} className="px-2 py-2 border-b border-slate-100">
                                      {mockEditModeIdx === activeMockResultTab ? (
                                        <div className="flex flex-col gap-0.5">
                                          <input className="w-full border border-slate-200 rounded px-1 py-0.5 font-bold text-slate-700 text-sm focus:outline-none focus:border-slate-400" value={row[wk]} onChange={e => updateVocab({ [wk]: e.target.value })} />
                                          <input className="w-full border border-slate-200 rounded px-1 py-0.5 text-slate-500 text-xs focus:outline-none focus:border-slate-400" value={row[mk]} onChange={e => updateVocab({ [mk]: e.target.value })} />
                                        </div>
                                      ) : (<><span className="font-bold text-slate-700">{row[wk]}</span><span className="text-slate-900 text-base ml-1">({row[mk]})</span></>)}
                                    </td>
                                  ))}
                                  <td className="px-2 py-2 border-b border-slate-100">
                                    {mockEditModeIdx === activeMockResultTab ? (
                                      <div className="flex flex-col gap-0.5">
                                        <input className="w-full border border-rose-200 rounded px-1 py-0.5 font-black text-rose-600 text-sm focus:outline-none focus:border-rose-400" value={row.antonym} onChange={e => updateVocab({ antonym: e.target.value })} />
                                        <input className="w-full border border-slate-200 rounded px-1 py-0.5 text-slate-500 text-xs focus:outline-none focus:border-slate-400" value={row.antonym_m} onChange={e => updateVocab({ antonym_m: e.target.value })} />
                                      </div>
                                    ) : (<><span className="font-black text-rose-600">{row.antonym}</span><span className="text-slate-900 text-base ml-1">({row.antonym_m})</span></>)}
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
                <div className="no-print fixed bottom-8 right-8 flex flex-col items-end gap-3 z-50">
                  <div className="flex items-center gap-1 bg-white border border-slate-200 shadow-lg px-3 py-2 rounded-2xl">
                    <span className="text-slate-400 text-xs font-bold mr-1">테마</span>
                    <button onClick={() => setMockPrintTheme('color')} className={`px-2.5 py-1 rounded-lg text-xs font-black transition-all ${mockPrintTheme === 'color' ? 'bg-teal-500 text-white' : 'text-slate-400 hover:text-slate-600'}`}>컬러</button>
                    <button onClick={() => setMockPrintTheme('mono')} className={`px-2.5 py-1 rounded-lg text-xs font-black transition-all ${mockPrintTheme === 'mono' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-slate-600'}`}>흑백</button>
                  </div>
                  {mockSaveStatusMap[activeMockResultTab] === 'saving' && (
                    <div className="flex items-center gap-2 bg-white border border-slate-200 shadow-lg px-4 py-2.5 rounded-2xl text-sm font-bold text-slate-500">
                      <div className="w-4 h-4 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />이력 저장 중...
                    </div>
                  )}
                  {mockSaveStatusMap[activeMockResultTab] === 'done' && (
                    <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 shadow-lg px-4 py-2.5 rounded-2xl text-sm font-bold text-emerald-600">✅ 이력에 저장됨</div>
                  )}
                  {mockEditSaveStatusMap[activeMockResultTab] && mockEditSaveStatusMap[activeMockResultTab] !== 'idle' && (
                    <div className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-sm font-bold shadow-lg border
                      ${mockEditSaveStatusMap[activeMockResultTab] === 'saving' ? 'bg-white border-slate-200 text-slate-500' : mockEditSaveStatusMap[activeMockResultTab] === 'done' ? 'bg-emerald-50 border-emerald-200 text-emerald-600' : 'bg-rose-50 border-rose-200 text-rose-600'}`}>
                      {mockEditSaveStatusMap[activeMockResultTab] === 'saving' ? <><div className="w-4 h-4 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />편집본 저장 중...</> : mockEditSaveStatusMap[activeMockResultTab] === 'done' ? '✅ 편집본 저장됨' : '⚠️ 편집본 저장 실패'}
                    </div>
                  )}
                  <div className="flex gap-3 flex-wrap justify-end">
                    <button
                      onClick={() => {
                        if (mockEditModeIdx !== activeMockResultTab) {
                          if (!mockEditedResults[activeMockResultTab]) setMockEditedResults(prev => ({ ...prev, [activeMockResultTab]: JSON.parse(JSON.stringify(activeResult.materials)) }));
                          setMockEditSaveStatusMap(prev => ({ ...prev, [activeMockResultTab]: 'idle' }));
                          setMockEditModeIdx(activeMockResultTab);
                        } else { setMockEditModeIdx(null); }
                      }}
                      className={`px-5 py-3 rounded-2xl font-black text-sm shadow-lg transition-all active:scale-95 ${mockEditModeIdx === activeMockResultTab ? 'bg-amber-500 text-white hover:bg-amber-600' : 'bg-slate-600 text-white hover:bg-slate-700'}`}>
                      {mockEditModeIdx === activeMockResultTab ? '✏️ 편집 종료' : '✏️ 편집'}
                    </button>
                    {mockEditModeIdx === activeMockResultTab && (
                      <button onClick={() => handleMockEditSave(activeMockResultTab)} disabled={mockEditSaveStatusMap[activeMockResultTab] === 'saving'}
                        className="px-5 py-3 bg-green-600 hover:bg-green-700 text-white font-black text-sm rounded-2xl shadow-lg transition-all active:scale-95 disabled:opacity-50">
                        {mockEditSaveStatusMap[activeMockResultTab] === 'saving' ? '⏳ 저장 중...' : '📥 편집본 저장'}
                      </button>
                    )}
                    <button onClick={handleMockDownloadProblem} disabled={!!mockPdfLoading}
                      className="bg-indigo-600 text-white px-6 py-4 rounded-2xl font-black text-lg shadow-2xl hover:bg-indigo-700 active:scale-95 transition-all disabled:opacity-50">
                      {mockPdfLoading === '문제' ? '⏳ 생성 중...' : '⬇️ 문제 PDF'}
                    </button>
                    <button onClick={handleMockDownloadAnswer} disabled={!!mockPdfLoading}
                      className="bg-violet-600 text-white px-6 py-4 rounded-2xl font-black text-lg shadow-2xl hover:bg-violet-700 active:scale-95 transition-all disabled:opacity-50">
                      {mockPdfLoading === '답안' ? '⏳ 생성 중...' : '⬇️ 답안·해설 PDF'}
                    </button>
                  </div>
                </div>
              </>
            );
          })()}
        </>
      )}

      {/* ══ 생성 이력 탭 ══ */}
      {activeMainTab === 'history' && (
        <div className="space-y-4">
          <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-2.5 text-xs font-bold text-amber-700">
            생성 이력은 생성일로부터 30일 후 자동 삭제됩니다. (직접 입력 + 모의고사 통합 이력)
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
                placeholder="지문 단어 또는 시험명 검색..."
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
          ) : historyList.length === 0 ? (
            <div className="bg-white rounded-[2rem] p-16 text-center shadow-lg border border-slate-100">
              <p className="text-5xl mb-4">📭</p>
              <p className="font-black text-slate-500 text-lg">생성된 이력이 없습니다</p>
              <p className="text-slate-400 font-bold text-sm mt-2">문제를 생성하면 자동으로 이곳에 기록돼요</p>
            </div>
          ) : (
            <div className="bg-white rounded-[2rem] shadow-lg border border-slate-100 overflow-hidden">
              <div className="grid grid-cols-[32px_130px_72px_1fr_52px_60px_60px] gap-2 px-4 py-3 bg-slate-50 border-b border-slate-100 text-xs font-black text-slate-500">
                <input type="checkbox" checked={selectedIds.size === historyList.length && historyList.length > 0}
                  onChange={toggleSelectAll} className="w-4 h-4 rounded accent-indigo-600 cursor-pointer mt-0.5" />
                {['날짜', '유형', '내용', '난이도', '문제', '해설'].map((h, i) => (
                  <span key={i} className={i >= 4 ? 'text-center' : ''}>{h}</span>
                ))}
              </div>
              {historyList.map((item, i) => (
                <div key={item.id}
                  className={`grid grid-cols-[32px_130px_72px_1fr_52px_60px_60px] gap-2 px-4 py-3 items-center border-b border-slate-100 last:border-0 hover:bg-indigo-50/40 transition-colors
                    ${selectedIds.has(item.id) ? 'bg-indigo-50' : i % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}`}>
                  <input type="checkbox" checked={selectedIds.has(item.id)} onChange={() => toggleSelect(item.id)}
                    className="w-4 h-4 rounded accent-indigo-600 cursor-pointer" />
                  <span className="text-xs font-bold text-slate-600 whitespace-nowrap">
                    {new Date(item.created_at).toLocaleString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
                  </span>
                  <span className={`text-xs font-black px-2 py-1 rounded-full text-center ${item._source === 'input' ? 'bg-indigo-100 text-indigo-700' : 'bg-teal-100 text-teal-700'}`}>
                    {item._source === 'input' ? '직접입력' : '모의고사'}
                  </span>
                  {item._source === 'input' ? (
                    <button onClick={() => setPassageModal({ title: '원문 지문', text: item.passage_full })}
                      className="text-xs text-slate-600 font-bold truncate text-left hover:text-indigo-600 hover:underline transition-colors w-full">
                      {item.title ? <span className="font-black">{item.title} — </span> : null}
                      {item.passage_excerpt}
                      <span className="ml-1 text-indigo-400 font-black whitespace-nowrap">[전체]</span>
                    </button>
                  ) : (
                    <span className="text-xs font-bold text-slate-700 truncate">
                      {item.year}년 {item.institution} {item.question_number}번
                    </span>
                  )}
                  <span className={`text-xs font-black px-2 py-1 rounded-full text-center ${DIFF_COLORS[item.difficulty] ?? 'bg-slate-100 text-slate-600'}`}>
                    {item.difficulty || '-'}
                  </span>
                  <div className="flex justify-center">
                    {item.pdf_path ? (
                      <button onClick={() => {
                        const name = item._source === 'input' ? (item.title || '영어문제') : `${item.year}_${item.institution}_${item.question_number}번`;
                        downloadFromHistory(item.pdf_path, `${name}_문제.pdf`);
                      }} className="px-2 py-1 bg-indigo-100 hover:bg-indigo-200 text-indigo-700 rounded-lg text-xs font-black transition-all w-full text-center">⬇️ 문제</button>
                    ) : <span className="text-xs text-slate-300 font-bold text-center w-full">저장중</span>}
                  </div>
                  <div className="flex justify-center">
                    {item.answer_pdf_path ? (
                      <button onClick={() => {
                        const name = item._source === 'input' ? (item.title || '영어문제') : `${item.year}_${item.institution}_${item.question_number}번`;
                        downloadFromHistory(item.answer_pdf_path!, `${name}_해설.pdf`);
                      }} className="px-2 py-1 bg-violet-100 hover:bg-violet-200 text-violet-700 rounded-lg text-xs font-black transition-all w-full text-center">⬇️ 해설</button>
                    ) : <span className="text-xs text-slate-300 font-bold text-center w-full">-</span>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── 지문 전체 보기 모달 ── */}
      {passageModal && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={() => setPassageModal(null)}>
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h3 className="text-base font-black text-slate-900">{passageModal.title}</h3>
              <button onClick={() => setPassageModal(null)} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors font-black text-lg">✕</button>
            </div>
            <div className="overflow-y-auto p-6">
              <p className="text-slate-700 font-bold leading-relaxed whitespace-pre-wrap text-sm">{passageModal.text}</p>
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
