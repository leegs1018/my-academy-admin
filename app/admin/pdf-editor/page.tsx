'use client';

import { useState, useCallback, useRef } from 'react';
import Image from 'next/image';

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

interface GeneratedMaterials {
  summaries: string[];
  tf_questions: TFQuestion[];
  answer_key: string;
  korean_summary: string;
  english_titles: string[];
  one_sentence_summaries: { english: string; korean: string }[];
  vocabulary_table: VocabRow[];
}

function renderBold(text: string) {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith('**') && part.endsWith('**')
      ? <strong key={i} className="font-black text-indigo-700">{part.slice(2, -2)}</strong>
      : <span key={i}>{part}</span>
  );
}

export default function PdfEditorPage() {
  // 입력 모드
  const [inputMode, setInputMode] = useState<'text' | 'image'>('text');

  // 텍스트 탭
  const [manualText, setManualText] = useState('');

  // 이미지 탭
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [ocrText, setOcrText] = useState('');
  const [ocrLoading, setOcrLoading] = useState(false);
  const [ocrDone, setOcrDone] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  // 공통
  const [difficulty, setDifficulty] = useState<'상' | '중' | '하'>('중');
  const [loading, setLoading] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState('');
  const [result, setResult] = useState<GeneratedMaterials | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showAnswerKey, setShowAnswerKey] = useState(false);
  const [copiedSection, setCopiedSection] = useState<string | null>(null);
  const [pdfLoading, setPdfLoading] = useState(false);
  const msgIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── 이미지 선택 ──
  const handleImageSelect = (file: File) => {
    if (!['image/jpeg', 'image/png', 'image/gif', 'image/webp'].includes(file.type)) {
      setError('JPG, PNG, GIF, WebP 형식만 지원합니다.');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setError('이미지 파일이 너무 큽니다. (최대 10MB)');
      return;
    }
    if (imagePreview) URL.revokeObjectURL(imagePreview);
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
    setOcrText('');
    setOcrDone(false);
    setError(null);
    setResult(null);
  };

  const handleDrop = useCallback((e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleImageSelect(file);
  }, []);

  // ── OCR 실행 ──
  const handleOCR = async () => {
    if (!imageFile) return;
    setOcrLoading(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append('image', imageFile);
      const res = await fetch('/api/ocr', { method: 'POST', body: fd });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'OCR 오류');
      setOcrText(json.text);
      setOcrDone(true);
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
    setLoading(true);
    setError(null);
    setResult(null);
    setShowAnswerKey(false);

    const msgs = [
      'AI가 지문을 읽고 있어요... 🤖',
      '문제를 생성하고 있어요... ✍️',
      '어휘 표를 만들고 있어요... 📚',
      '거의 완성됐어요! 잠시만요... ✨',
    ];
    let idx = 0;
    setLoadingMsg(msgs[0]);
    msgIntervalRef.current = setInterval(() => {
      idx = (idx + 1) % msgs.length;
      setLoadingMsg(msgs[idx]);
    }, 8000);

    try {
      const res = await fetch('/api/process-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: textToSend, difficulty }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || '오류가 발생했습니다.');
      setResult(json.data as GeneratedMaterials);
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

  const buildTFText = () =>
    result?.tf_questions.map(q => `${q.number}. ${q.statement}`).join('\n') ?? '';
  const buildOneSentenceText = () =>
    result?.one_sentence_summaries
      .map((s, i) => `${i + 1}. ${s.english.replace(/\*\*/g, '')}\n   (${s.korean})`).join('\n\n') ?? '';
  const buildVocabText = () =>
    result?.vocabulary_table
      .map(r => `${r.word} (${r.meaning}) | ${r.syn1} (${r.syn1_m}) | ${r.syn2} (${r.syn2_m}) | ${r.syn3} (${r.syn3_m}) | ${r.antonym} (${r.antonym_m})`).join('\n') ?? '';

  const handleDownloadPDF = async () => {
    const el = document.getElementById('print-area');
    if (!el) return;
    setPdfLoading(true);
    try {
      // 1. print-area HTML 추출 후 완전한 HTML 문서로 래핑
      const html = `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <script src="https://cdn.tailwindcss.com"></script>
  <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;700;900&display=swap" rel="stylesheet">
  <style>
    body { font-family: 'Noto Sans KR', sans-serif; background: white; padding: 24px; }
    * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  </style>
</head>
<body>${el.outerHTML}</body>
</html>`;

      // 2. HTML → UTF-8 base64 인코딩 (한글이 URL/헤더에 들어가지 않도록)
      const encoder = new TextEncoder();
      const bytes = encoder.encode(html);
      const chunks: string[] = [];
      for (let i = 0; i < bytes.length; i += 8192) {
        chunks.push(String.fromCharCode(...bytes.subarray(i, i + 8192)));
      }
      const htmlBase64 = btoa(chunks.join(''));

      // 3. base64(ASCII만 포함) → JSON body로 서버 전송
      const res = await fetch('/api/generate-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ htmlBase64 }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as { error?: string }).error || 'PDF 생성 실패');
      }

      // 3. 다운로드
      const pdfBlob = await res.blob();
      const url = URL.createObjectURL(pdfBlob);
      const today = new Date().toLocaleDateString('ko-KR').replace(/\. /g, '-').replace('.', '');
      const a = document.createElement('a');
      a.href = url;
      a.download = `영어문제_${today}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } finally {
      setPdfLoading(false);
    }
  };

  return (
    <div className="pb-32">

      {/* 로딩 오버레이 */}
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

      {/* 헤더 */}
      <div className="no-print mb-8">
        <h1 className="text-4xl font-black text-slate-900 tracking-tighter">📝 영어 문제 생성</h1>
        <p className="text-slate-500 font-bold mt-2">지문을 입력하거나 사진을 등록하면 AI가 6가지 교육 자료를 만들어드려요</p>
      </div>

      {/* 입력 섹션 */}
      <div className="no-print bg-white p-8 rounded-[2.5rem] shadow-xl border border-slate-100 mb-8">

        {/* 탭 */}
        <div className="flex gap-2 mb-6 bg-slate-100 p-1.5 rounded-2xl w-fit">
          {([['text', '✏️ 텍스트 직접 입력'], ['image', '📷 사진 등록']] as const).map(([mode, label]) => (
            <button key={mode} onClick={() => { setInputMode(mode); setError(null); }}
              className={`px-6 py-3 rounded-xl font-black text-sm transition-all
                ${inputMode === mode ? 'bg-white text-indigo-600 shadow-md' : 'text-slate-500 hover:text-slate-700'}`}>
              {label}
            </button>
          ))}
        </div>

        {/* ── 텍스트 탭 ── */}
        {inputMode === 'text' && (
          <div>
            <p className="text-sm font-bold text-slate-500 mb-3">
              영어 지문을 복사(Ctrl+C)한 뒤 아래에 붙여넣기(Ctrl+V) 해주세요
            </p>
            <textarea
              value={manualText}
              onChange={(e) => { setManualText(e.target.value); setResult(null); }}
              placeholder="여기에 영어 지문을 붙여넣어 주세요..."
              rows={12}
              className="w-full p-5 border-2 border-slate-200 rounded-2xl font-mono text-sm
                         text-slate-700 resize-y focus:outline-none focus:border-indigo-400
                         transition-colors placeholder:text-slate-300"
            />
            <p className="text-xs text-slate-400 font-bold mt-2 text-right">
              {manualText.trim().length}자
              {manualText.trim().length > 0 && manualText.trim().length < 50 && ' (최소 50자 이상)'}
            </p>
          </div>
        )}

        {/* ── 사진 탭 ── */}
        {inputMode === 'image' && (
          <div className="space-y-5">
            {/* 이미지 업로드 존 */}
            <label
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              className={`block w-full border-4 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-all
                ${isDragging ? 'border-indigo-500 bg-indigo-50'
                  : imageFile ? 'border-emerald-300 bg-emerald-50/50'
                  : 'border-indigo-200 hover:border-indigo-400 hover:bg-indigo-50/50'}`}
            >
              <div className="text-5xl mb-3">{imageFile ? '🖼️' : '📷'}</div>
              {imageFile ? (
                <>
                  <p className="font-black text-emerald-700 text-lg">{imageFile.name}</p>
                  <p className="text-xs text-slate-400 mt-1">다른 사진으로 변경하려면 클릭하세요</p>
                </>
              ) : (
                <>
                  <p className="font-black text-slate-600 text-lg">사진을 클릭하거나 드래그하여 등록</p>
                  <p className="text-sm text-slate-400 font-bold mt-2">JPG · PNG · WebP · GIF · 최대 10MB</p>
                </>
              )}
              <input type="file" accept="image/*" className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleImageSelect(f); }} />
            </label>

            {/* 이미지 미리보기 + OCR 버튼 */}
            {imageFile && imagePreview && (
              <div className="flex flex-col md:flex-row gap-5">
                {/* 미리보기 */}
                <div className="md:w-1/2 rounded-2xl overflow-hidden border-2 border-slate-100 bg-slate-50 flex items-center justify-center min-h-[200px]">
                  <Image
                    src={imagePreview}
                    alt="업로드된 이미지"
                    width={600}
                    height={400}
                    className="max-h-80 object-contain w-full"
                    unoptimized
                  />
                </div>

                {/* OCR 결과 영역 */}
                <div className="md:w-1/2 flex flex-col gap-3">
                  {!ocrDone ? (
                    <div className="flex-1 flex flex-col items-center justify-center p-8 bg-indigo-50 rounded-2xl border-2 border-dashed border-indigo-200">
                      <p className="font-black text-indigo-500 text-center mb-4">
                        사진에서 영어 텍스트를<br />AI가 자동으로 추출해드려요
                      </p>
                      <button onClick={handleOCR} disabled={ocrLoading}
                        className="bg-indigo-600 text-white px-8 py-3 rounded-2xl font-black
                                   hover:bg-indigo-700 active:scale-95 transition-all shadow-lg
                                   disabled:opacity-50">
                        🔍 텍스트 추출하기
                      </button>
                    </div>
                  ) : (
                    <div className="flex-1 flex flex-col gap-2">
                      <div className="flex items-center justify-between">
                        <p className="font-black text-emerald-600 text-sm">✅ 텍스트 추출 완료 — 수정 후 문제를 생성하세요</p>
                        <button onClick={() => { setOcrDone(false); setOcrText(''); }}
                          className="no-print text-xs font-black text-slate-400 hover:text-rose-500 transition-colors">
                          다시 추출
                        </button>
                      </div>
                      <textarea
                        value={ocrText}
                        onChange={(e) => setOcrText(e.target.value)}
                        rows={10}
                        className="flex-1 w-full p-4 border-2 border-emerald-200 rounded-2xl font-mono text-sm
                                   text-slate-700 resize-y focus:outline-none focus:border-indigo-400
                                   transition-colors bg-emerald-50/30"
                      />
                      <p className="text-xs text-slate-400 font-bold text-right">{ocrText.trim().length}자</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* 에러 */}
        {error && (
          <div className="mt-4 p-4 bg-rose-50 border border-rose-200 rounded-2xl">
            <p className="text-rose-600 font-black whitespace-pre-line">⚠️ {error}</p>
          </div>
        )}

        {/* 난이도 선택 */}
        <div className="mt-6 flex flex-wrap items-center gap-4">
          <span className="font-black text-slate-700 text-lg">난이도 선택:</span>
          {(['상', '중', '하'] as const).map((d) => (
            <button key={d} onClick={() => setDifficulty(d)}
              className={`px-8 py-3 rounded-2xl font-black text-xl transition-all
                ${difficulty === d ? 'bg-indigo-600 text-white shadow-lg scale-105'
                  : 'bg-slate-100 text-slate-500 hover:bg-indigo-50 hover:text-indigo-600'}`}>
              {d}
            </button>
          ))}
          <span className="text-sm text-slate-400 font-bold">
            {difficulty === '상' ? '수능/내신 상위권' : difficulty === '중' ? '일반 고등학교 내신' : '중학교~고등 초급'}
          </span>
        </div>

        {/* 생성 버튼 */}
        <button onClick={handleGenerate} disabled={!canGenerate}
          className="mt-6 w-full bg-indigo-600 text-white py-5 rounded-2xl font-black text-xl
                     shadow-xl hover:bg-indigo-700 active:scale-[0.98] transition-all
                     disabled:opacity-40 disabled:cursor-not-allowed">
          AI로 문제 생성하기 🚀
        </button>
      </div>

      {/* 결과 섹션 */}
      {result && (
        <div id="print-area" className="space-y-6">

          <SectionCard number="01" title="요약문 2가지" subtitle="본문에 쓰인 단어를 활용한 중간 길이 요약"
            color="bg-indigo-500" onCopy={() => copy(result.summaries.join('\n\n'), 'summaries')} copied={copiedSection === 'summaries'}>
            <div className="space-y-4">
              {result.summaries.map((s, i) => (
                <div key={i} className="p-5 bg-indigo-50 rounded-2xl border border-indigo-100">
                  <span className="inline-block bg-indigo-600 text-white text-xs font-black px-3 py-1 rounded-full mb-3">Version {i + 1}</span>
                  <p className="text-slate-700 font-bold leading-relaxed">{s}</p>
                </div>
              ))}
            </div>
          </SectionCard>

          <SectionCard number="02" title="T/F 문제 10개" subtitle="본문에 사용되지 않은 어휘 · T 5개 F 5개"
            color="bg-violet-500" onCopy={() => copy(buildTFText(), 'tf')} copied={copiedSection === 'tf'}>
            <div className="space-y-2 mb-4">
              {result.tf_questions.map((q) => (
                <div key={q.number} className="flex items-start gap-3 p-3 rounded-xl hover:bg-violet-50 transition-colors">
                  <span className="font-black text-violet-600 w-7 shrink-0">{q.number}.</span>
                  <p className="text-slate-700 font-bold leading-relaxed flex-1">{q.statement}</p>
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

          <SectionCard number="03" title="한글 요약" subtitle="시험 대비용 내용 정리"
            color="bg-emerald-500" onCopy={() => copy(result.korean_summary, 'korean')} copied={copiedSection === 'korean'}>
            <div className="p-5 bg-emerald-50 rounded-2xl border border-emerald-100">
              <p className="text-slate-700 font-bold leading-loose whitespace-pre-wrap">{result.korean_summary}</p>
            </div>
          </SectionCard>

          <SectionCard number="04" title="영어 제목 3가지" subtitle="한글 번역 포함 · 시험 대비용"
            color="bg-amber-500" onCopy={() => copy(result.english_titles.map((t, i) => `${i + 1}. ${t}`).join('\n'), 'titles')} copied={copiedSection === 'titles'}>
            <div className="space-y-3">
              {result.english_titles.map((title, i) => (
                <div key={i} className="flex items-start gap-3 p-4 bg-amber-50 rounded-2xl border border-amber-100">
                  <span className="font-black text-amber-600 w-7 shrink-0">{i + 1}.</span>
                  <p className="text-slate-700 font-bold leading-relaxed">{title}</p>
                </div>
              ))}
            </div>
          </SectionCard>

          <SectionCard number="05" title="1문장 영어 요약 3가지" subtitle="본문에 없는 단어 사용 · 핵심 어휘 볼드체"
            color="bg-rose-500" onCopy={() => copy(buildOneSentenceText(), 'one_sentence')} copied={copiedSection === 'one_sentence'}>
            <div className="space-y-4">
              {result.one_sentence_summaries.map((s, i) => (
                <div key={i} className="p-5 bg-rose-50 rounded-2xl border border-rose-100">
                  <div className="flex items-start gap-3">
                    <span className="font-black text-rose-600 w-7 shrink-0">{i + 1}.</span>
                    <div className="flex-1">
                      <p className="text-slate-700 font-bold leading-relaxed mb-2">{renderBold(s.english)}</p>
                      <p className="text-slate-500 font-bold text-sm">({s.korean})</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </SectionCard>

          <SectionCard number="06" title="관련 어휘 10개" subtitle="동의어 3개 · 반의어 1개 · 한글 뜻 포함"
            color="bg-slate-700" onCopy={() => copy(buildVocabText(), 'vocab')} copied={copiedSection === 'vocab'}>
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse min-w-[700px]">
                <thead>
                  <tr className="bg-slate-800 text-white">
                    {['표제어 (뜻)', '유의어 1 (뜻)', '유의어 2 (뜻)', '유의어 3 (뜻)', '반의어 (뜻)'].map((h, i) => (
                      <th key={i} className={`p-3 text-left font-black whitespace-nowrap
                        ${i === 0 ? 'rounded-tl-xl' : ''} ${i === 4 ? 'rounded-tr-xl' : ''}`}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {result.vocabulary_table.map((row, i) => (
                    <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                      <td className="p-3 border-b border-slate-100">
                        <span className="font-black text-indigo-700">{row.word}</span>
                        <span className="text-slate-400 ml-1">({row.meaning})</span>
                      </td>
                      {[
                        [row.syn1, row.syn1_m], [row.syn2, row.syn2_m], [row.syn3, row.syn3_m]
                      ].map(([w, m], j) => (
                        <td key={j} className="p-3 border-b border-slate-100">
                          <span className="font-bold text-slate-700">{w}</span>
                          <span className="text-slate-400 ml-1">({m})</span>
                        </td>
                      ))}
                      <td className="p-3 border-b border-slate-100">
                        <span className="font-black text-rose-600">{row.antonym}</span>
                        <span className="text-slate-400 ml-1">({row.antonym_m})</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </SectionCard>

        </div>
      )}

      {result && (
        <div className="no-print fixed bottom-8 right-8 flex gap-3 z-50">
          <button onClick={handleDownloadPDF} disabled={pdfLoading}
            className="bg-indigo-600 text-white px-6 py-4 rounded-2xl font-black text-lg shadow-2xl
                       hover:bg-indigo-700 active:scale-95 transition-all disabled:opacity-50">
            {pdfLoading ? '⏳ 생성 중...' : '⬇️ PDF 저장'}
          </button>
          <button onClick={() => window.print()}
            className="bg-slate-900 text-white px-6 py-4 rounded-2xl font-black text-lg shadow-2xl
                       hover:bg-slate-700 active:scale-95 transition-all">
            🖨️ 인쇄
          </button>
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
    <div className="bg-white rounded-[2.5rem] shadow-xl border border-slate-100 overflow-hidden">
      <div className={`${color} px-8 py-5 flex items-center justify-between`}>
        <div className="flex items-center gap-4">
          <span className="text-white/70 font-black text-3xl leading-none">{number}</span>
          <div>
            <h2 className="text-white font-black text-xl leading-tight">{title}</h2>
            <p className="text-white/80 font-bold text-xs mt-0.5">{subtitle}</p>
          </div>
        </div>
        <button onClick={onCopy}
          className="no-print bg-white/20 hover:bg-white/30 text-white font-black text-sm px-4 py-2 rounded-xl transition-all active:scale-95">
          {copied ? '✅ 복사됨' : '📋 복사'}
        </button>
      </div>
      <div className="p-8">{children}</div>
    </div>
  );
}
