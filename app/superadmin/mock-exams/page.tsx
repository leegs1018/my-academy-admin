'use client';

import { useEffect, useState, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';

interface Passage {
  id: string;
  year: number;
  institution: string;
  exam_name: string;
  question_number: number;
  passage_text: string;
  created_at: string;
}

const INSTITUTIONS = ['수능', '3월 교육청', '6월 평가원', '9월 평가원', '11월 교육청'];
const INPUT_MODES = ['텍스트 직접 입력', '이미지 OCR'] as const;

export default function MockExamsPage() {
  const [passages, setPassages] = useState<Passage[]>([]);
  const [loading, setLoading] = useState(true);
  const [inputMode, setInputMode] = useState<typeof INPUT_MODES[number]>('텍스트 직접 입력');

  const [year, setYear] = useState('');
  const [institution, setInstitution] = useState('수능');
  const [examName, setExamName] = useState('');
  const [questionNumber, setQuestionNumber] = useState('');
  const [passageText, setPassageText] = useState('');

  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [ocrLoading, setOcrLoading] = useState(false);
  const [ocrDone, setOcrDone] = useState(false);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const getClient = () => createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const loadPassages = async () => {
    setLoading(true);
    const { data } = await getClient()
      .from('mock_exam_passages')
      .select('*')
      .order('year', { ascending: false })
      .order('institution')
      .order('question_number');
    setPassages(data ?? []);
    setLoading(false);
  };

  useEffect(() => { loadPassages(); }, []);

  const handleImageFile = (file: File) => {
    setImageFile(file);
    setOcrDone(false);
    setPassageText('');
    const reader = new FileReader();
    reader.onload = (e) => setImagePreview(e.target?.result as string);
    reader.readAsDataURL(file);
  };

  const runOcr = async () => {
    if (!imageFile) return;
    setOcrLoading(true);
    try {
      const formData = new FormData();
      formData.append('image', imageFile);
      const res = await fetch('/api/ocr', { method: 'POST', body: formData });
      const json = await res.json() as { text?: string; error?: string };
      if (!res.ok) throw new Error(json.error || 'OCR 실패');
      setPassageText(json.text || '');
      setOcrDone(true);
    } catch (e) {
      alert(e instanceof Error ? e.message : 'OCR 오류');
    } finally {
      setOcrLoading(false);
    }
  };

  const handleSave = async () => {
    setError('');
    if (!year || !examName || !questionNumber || !passageText.trim()) {
      setError('모든 항목을 입력해주세요.');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/superadmin/mock-exams', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          year: parseInt(year),
          institution,
          exam_name: examName,
          question_number: parseInt(questionNumber),
          passage_text: passageText.trim(),
        }),
      });
      if (!res.ok) {
        const j = await res.json() as { error?: string };
        throw new Error(j.error || '저장 실패');
      }
      setYear(''); setExamName(''); setQuestionNumber(''); setPassageText('');
      setImageFile(null); setImagePreview(null); setOcrDone(false);
      await loadPassages();
    } catch (e) {
      setError(e instanceof Error ? e.message : '저장 오류');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('이 지문을 삭제하시겠습니까?')) return;
    await fetch(`/api/superadmin/mock-exams?id=${id}`, { method: 'DELETE' });
    await loadPassages();
  };

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-black text-white mb-1">모의고사 지문 관리</h1>
        <p className="text-slate-400 font-medium text-sm">수능·평가원·교육청 기출 지문을 등록합니다.</p>
      </div>

      {/* 지문 목록 */}
      <div className="bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden mb-8">
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
          <h2 className="text-base font-black text-white">등록된 지문 ({passages.length}개)</h2>
        </div>
        <div className="overflow-x-auto">
          {loading ? (
            <p className="px-6 py-8 text-slate-400 text-sm font-medium">불러오는 중...</p>
          ) : passages.length === 0 ? (
            <p className="px-6 py-8 text-slate-400 text-sm font-medium">등록된 지문이 없습니다.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-800">
                  <th className="px-4 py-3 text-left text-xs font-black text-slate-400 uppercase tracking-wider">년도</th>
                  <th className="px-4 py-3 text-left text-xs font-black text-slate-400 uppercase tracking-wider">기관</th>
                  <th className="px-4 py-3 text-left text-xs font-black text-slate-400 uppercase tracking-wider">시험명</th>
                  <th className="px-4 py-3 text-left text-xs font-black text-slate-400 uppercase tracking-wider">문제번호</th>
                  <th className="px-4 py-3 text-left text-xs font-black text-slate-400 uppercase tracking-wider">지문 미리보기</th>
                  <th className="px-4 py-3 text-left text-xs font-black text-slate-400 uppercase tracking-wider">등록일</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {passages.map((p) => (
                  <tr key={p.id} className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors">
                    <td className="px-4 py-3 font-bold text-white">{p.year}</td>
                    <td className="px-4 py-3 text-slate-300 font-medium">{p.institution}</td>
                    <td className="px-4 py-3 text-slate-300 font-medium">{p.exam_name}</td>
                    <td className="px-4 py-3 text-slate-300 font-medium">{p.question_number}번</td>
                    <td className="px-4 py-3 text-slate-400 font-medium max-w-xs truncate">{p.passage_text.slice(0, 60)}...</td>
                    <td className="px-4 py-3 text-slate-500 font-medium">{new Date(p.created_at).toLocaleDateString('ko-KR')}</td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => handleDelete(p.id)}
                        className="text-xs font-black text-red-400 hover:text-red-300 transition-colors px-2 py-1 rounded-lg hover:bg-red-900/20"
                      >
                        삭제
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* 지문 추가 폼 */}
      <div className="bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-800">
          <h2 className="text-base font-black text-white">지문 추가</h2>
        </div>
        <div className="p-6 space-y-5">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-black text-slate-400 mb-1.5 uppercase tracking-wider">년도</label>
              <input
                type="number"
                value={year}
                onChange={e => setYear(e.target.value)}
                placeholder="2024"
                min="2000" max="2099"
                className="w-full bg-slate-800 border border-slate-700 text-white font-medium text-sm px-4 py-3 rounded-xl focus:outline-none focus:border-indigo-500 placeholder-slate-600"
              />
            </div>
            <div>
              <label className="block text-xs font-black text-slate-400 mb-1.5 uppercase tracking-wider">기관</label>
              <select
                value={institution}
                onChange={e => setInstitution(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 text-white font-medium text-sm px-4 py-3 rounded-xl focus:outline-none focus:border-indigo-500"
              >
                {INSTITUTIONS.map(i => <option key={i} value={i}>{i}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-black text-slate-400 mb-1.5 uppercase tracking-wider">시험명</label>
              <input
                type="text"
                value={examName}
                onChange={e => setExamName(e.target.value)}
                placeholder="2024학년도 수능"
                className="w-full bg-slate-800 border border-slate-700 text-white font-medium text-sm px-4 py-3 rounded-xl focus:outline-none focus:border-indigo-500 placeholder-slate-600"
              />
            </div>
            <div>
              <label className="block text-xs font-black text-slate-400 mb-1.5 uppercase tracking-wider">문제 번호</label>
              <input
                type="number"
                value={questionNumber}
                onChange={e => setQuestionNumber(e.target.value)}
                placeholder="18"
                min="1" max="50"
                className="w-full bg-slate-800 border border-slate-700 text-white font-medium text-sm px-4 py-3 rounded-xl focus:outline-none focus:border-indigo-500 placeholder-slate-600"
              />
            </div>
          </div>

          {/* 지문 입력 탭 */}
          <div>
            <label className="block text-xs font-black text-slate-400 mb-2 uppercase tracking-wider">지문 입력 방식</label>
            <div className="flex gap-2 mb-4">
              {INPUT_MODES.map(mode => (
                <button
                  key={mode}
                  onClick={() => { setInputMode(mode); setPassageText(''); setImageFile(null); setImagePreview(null); setOcrDone(false); }}
                  className={`px-4 py-2 rounded-xl text-sm font-black transition-all ${inputMode === mode ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-white'}`}
                >
                  {mode}
                </button>
              ))}
            </div>

            {inputMode === '텍스트 직접 입력' ? (
              <textarea
                value={passageText}
                onChange={e => setPassageText(e.target.value)}
                rows={8}
                placeholder="지문 텍스트를 여기에 붙여넣으세요..."
                className="w-full bg-slate-800 border border-slate-700 text-white font-medium text-sm px-4 py-3 rounded-xl focus:outline-none focus:border-indigo-500 placeholder-slate-600 resize-none leading-relaxed"
              />
            ) : (
              <div className="space-y-3">
                <div
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={e => e.preventDefault()}
                  onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleImageFile(f); }}
                  className="border-2 border-dashed border-slate-700 rounded-xl p-8 text-center cursor-pointer hover:border-indigo-500 transition-colors"
                >
                  {imagePreview ? (
                    <img src={imagePreview} alt="미리보기" className="max-h-48 mx-auto rounded-lg object-contain" />
                  ) : (
                    <>
                      <p className="text-slate-400 font-bold mb-1">이미지를 드래그하거나 클릭해서 업로드</p>
                      <p className="text-slate-600 text-xs font-medium">JPG, PNG, WEBP 지원</p>
                    </>
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
                {ocrDone && (
                  <div className="space-y-2">
                    <p className="text-xs font-black text-green-400">✅ 텍스트 추출 완료 — 수정 후 저장하세요</p>
                    <textarea
                      value={passageText}
                      onChange={e => setPassageText(e.target.value)}
                      rows={8}
                      className="w-full bg-slate-800 border border-slate-700 text-white font-medium text-sm px-4 py-3 rounded-xl focus:outline-none focus:border-indigo-500 resize-none leading-relaxed"
                    />
                  </div>
                )}
              </div>
            )}
          </div>

          {error && <p className="text-sm font-bold text-red-400">{error}</p>}

          <button
            onClick={handleSave}
            disabled={saving}
            className="px-8 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-black text-sm rounded-xl transition-all disabled:opacity-50"
          >
            {saving ? '저장 중...' : '지문 저장'}
          </button>
        </div>
      </div>
    </div>
  );
}
