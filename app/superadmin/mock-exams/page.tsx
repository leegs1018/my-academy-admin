'use client';

import { useEffect, useState, useRef, useMemo } from 'react';

interface Passage {
  id: string;
  year: number;
  institution: string;
  grade: string;
  exam_name: string;
  question_number: number;
  passage_text: string;
  created_at: string;
}

interface EditForm {
  year: string;
  institution: string;
  grade: string;
  exam_name: string;
  question_number: string;
  passage_text: string;
}

const INSTITUTIONS = ['수능', '3월 교육청', '6월 평가원', '9월 평가원', '11월 교육청'];
const GRADES = ['1학년', '2학년', '3학년'];
const INPUT_MODES = ['텍스트 직접 입력', '이미지 OCR'] as const;
const PAGE_SIZES = [50, 100, 300, 500, 1000];

export default function MockExamsPage() {
  const [passages, setPassages] = useState<Passage[]>([]);
  const [loading, setLoading] = useState(true);
  const [inputMode, setInputMode] = useState<typeof INPUT_MODES[number]>('텍스트 직접 입력');

  // 추가 폼
  const [year, setYear] = useState('');
  const [institution, setInstitution] = useState('수능');
  const [grade, setGrade] = useState('1학년');
  const [questionNumber, setQuestionNumber] = useState('');
  const [passageText, setPassageText] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [ocrLoading, setOcrLoading] = useState(false);
  const [ocrDone, setOcrDone] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 필터
  const [filterYear, setFilterYear] = useState('');
  const [filterInstitution, setFilterInstitution] = useState('');
  const [filterGrade, setFilterGrade] = useState('');
  const [filterExamName, setFilterExamName] = useState('');
  const [pageSize, setPageSize] = useState(50);

  // 모달
  const [viewingPassage, setViewingPassage] = useState<Passage | null>(null);
  const [editingPassage, setEditingPassage] = useState<Passage | null>(null);
  const [editForm, setEditForm] = useState<EditForm>({ year: '', institution: '수능', grade: '1학년', exam_name: '', question_number: '', passage_text: '' });
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState('');

  const loadPassages = async () => {
    setLoading(true);
    const res = await fetch('/api/superadmin/mock-exams');
    const json = await res.json() as { passages?: Passage[] };
    setPassages(json.passages ?? []);
    setLoading(false);
  };

  useEffect(() => { loadPassages(); }, []);

  // 필터 + 페이지 크기 적용
  const filteredPassages = useMemo(() => {
    let list = passages;
    if (filterYear) list = list.filter(p => String(p.year).includes(filterYear));
    if (filterInstitution) list = list.filter(p => p.institution === filterInstitution);
    if (filterGrade) list = list.filter(p => p.grade === filterGrade);
    if (filterExamName) list = list.filter(p => p.exam_name.includes(filterExamName));
    return list.slice(0, pageSize);
  }, [passages, filterYear, filterInstitution, filterGrade, filterExamName, pageSize]);

  // 필터에서 사용할 고유 년도 목록
  const uniqueYears = useMemo(() => [...new Set(passages.map(p => p.year))].sort((a, b) => b - a), [passages]);

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
    if (!year || !grade || !questionNumber || !passageText.trim()) {
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
          grade,
          exam_name: institution,
          question_number: parseInt(questionNumber),
          passage_text: passageText.trim(),
        }),
      });
      if (!res.ok) {
        const j = await res.json() as { error?: string };
        throw new Error(j.error || '저장 실패');
      }
      setQuestionNumber(''); setPassageText('');
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

  const openEdit = (p: Passage) => {
    setEditingPassage(p);
    setEditForm({
      year: String(p.year),
      institution: p.institution,
      grade: p.grade ?? '1학년',
      exam_name: p.exam_name,
      question_number: String(p.question_number),
      passage_text: p.passage_text,
    });
    setEditError('');
  };

  const handleEditSave = async () => {
    if (!editingPassage) return;
    setEditError('');
    if (!editForm.year || !editForm.question_number || !editForm.passage_text.trim()) {
      setEditError('모든 항목을 입력해주세요.');
      return;
    }
    setEditSaving(true);
    try {
      const res = await fetch('/api/superadmin/mock-exams', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editingPassage.id,
          year: parseInt(editForm.year),
          institution: editForm.institution,
          grade: editForm.grade,
          exam_name: editForm.institution,
          question_number: parseInt(editForm.question_number),
          passage_text: editForm.passage_text.trim(),
        }),
      });
      if (!res.ok) {
        const j = await res.json() as { error?: string };
        throw new Error(j.error || '수정 실패');
      }
      setEditingPassage(null);
      await loadPassages();
    } catch (e) {
      setEditError(e instanceof Error ? e.message : '수정 오류');
    } finally {
      setEditSaving(false);
    }
  };

  const totalFiltered = useMemo(() => {
    let list = passages;
    if (filterYear) list = list.filter(p => String(p.year).includes(filterYear));
    if (filterInstitution) list = list.filter(p => p.institution === filterInstitution);
    if (filterGrade) list = list.filter(p => p.grade === filterGrade);
    if (filterExamName) list = list.filter(p => p.exam_name.includes(filterExamName));
    return list.length;
  }, [passages, filterYear, filterInstitution, filterGrade, filterExamName]);

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-black text-white mb-1">모의고사 지문 관리</h1>
        <p className="text-slate-400 font-medium text-sm">수능·평가원·교육청 기출 지문을 등록합니다.</p>
      </div>

      {/* 지문 추가 폼 */}
      <div className="bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden mb-8">
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
              <label className="block text-xs font-black text-slate-400 mb-1.5 uppercase tracking-wider">학년</label>
              <select
                value={grade}
                onChange={e => setGrade(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 text-white font-medium text-sm px-4 py-3 rounded-xl focus:outline-none focus:border-indigo-500"
              >
                {GRADES.map(g => <option key={g} value={g}>{g}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-black text-slate-400 mb-1.5 uppercase tracking-wider">시험명/기관</label>
              <select
                value={institution}
                onChange={e => setInstitution(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 text-white font-medium text-sm px-4 py-3 rounded-xl focus:outline-none focus:border-indigo-500"
              >
                {INSTITUTIONS.map(i => <option key={i} value={i}>{i}</option>)}
              </select>
            </div>
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-black text-slate-400 uppercase tracking-wider">문제 번호</label>
                <button
                  type="button"
                  onClick={() => {
                    setYear(''); setInstitution('수능'); setGrade('1학년');
                    setQuestionNumber(''); setPassageText('');
                    setImageFile(null); setImagePreview(null); setOcrDone(false);
                  }}
                  className="text-[10px] font-black text-slate-500 hover:text-rose-400 transition-colors"
                >
                  전체 초기화
                </button>
              </div>
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

      {/* 등록된 지문 */}
      <div className="bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden">
        {/* 헤더 + 필터 */}
        <div className="px-6 py-4 border-b border-slate-800">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-black text-white">
              등록된 지문
              <span className="ml-2 text-slate-400 font-medium text-sm">
                {totalFiltered !== passages.length
                  ? `${totalFiltered}건 (전체 ${passages.length}개)`
                  : `${passages.length}개`}
              </span>
            </h2>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div>
              <label className="block text-[10px] font-black text-slate-500 mb-1 uppercase tracking-wider">년도</label>
              <select
                value={filterYear}
                onChange={e => setFilterYear(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 text-white font-medium text-xs px-3 py-2 rounded-lg focus:outline-none focus:border-indigo-500"
              >
                <option value="">전체</option>
                {uniqueYears.map(y => <option key={y} value={String(y)}>{y}년</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-black text-slate-500 mb-1 uppercase tracking-wider">학년</label>
              <select
                value={filterGrade}
                onChange={e => setFilterGrade(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 text-white font-medium text-xs px-3 py-2 rounded-lg focus:outline-none focus:border-indigo-500"
              >
                <option value="">전체</option>
                {GRADES.map(g => <option key={g} value={g}>{g}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-black text-slate-500 mb-1 uppercase tracking-wider">시험명/기관</label>
              <select
                value={filterInstitution}
                onChange={e => setFilterInstitution(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 text-white font-medium text-xs px-3 py-2 rounded-lg focus:outline-none focus:border-indigo-500"
              >
                <option value="">전체</option>
                {INSTITUTIONS.map(i => <option key={i} value={i}>{i}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-black text-slate-500 mb-1 uppercase tracking-wider">목록 수</label>
              <select
                value={pageSize}
                onChange={e => setPageSize(Number(e.target.value))}
                className="w-full bg-slate-800 border border-slate-700 text-white font-medium text-xs px-3 py-2 rounded-lg focus:outline-none focus:border-indigo-500"
              >
                {PAGE_SIZES.map(n => <option key={n} value={n}>{n}건</option>)}
              </select>
            </div>
          </div>
          {(filterYear || filterInstitution || filterGrade || filterExamName) && (
            <button
              onClick={() => { setFilterYear(''); setFilterInstitution(''); setFilterGrade(''); setFilterExamName(''); }}
              className="mt-3 text-xs font-black text-slate-500 hover:text-rose-400 transition-colors"
            >
              필터 초기화
            </button>
          )}
        </div>

        <div className="overflow-x-auto">
          {loading ? (
            <p className="px-6 py-8 text-slate-400 text-sm font-medium">불러오는 중...</p>
          ) : filteredPassages.length === 0 ? (
            <p className="px-6 py-8 text-slate-400 text-sm font-medium">
              {passages.length === 0 ? '등록된 지문이 없습니다.' : '필터 조건에 맞는 지문이 없습니다.'}
            </p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-800">
                  <th className="px-4 py-3 text-left text-xs font-black text-slate-400 uppercase tracking-wider">년도</th>
                  <th className="px-4 py-3 text-left text-xs font-black text-slate-400 uppercase tracking-wider">학년</th>
                  <th className="px-4 py-3 text-left text-xs font-black text-slate-400 uppercase tracking-wider">시험명/기관</th>
                  <th className="px-4 py-3 text-left text-xs font-black text-slate-400 uppercase tracking-wider">문제번호</th>
                  <th className="px-4 py-3 text-left text-xs font-black text-slate-400 uppercase tracking-wider">지문 미리보기</th>
                  <th className="px-4 py-3 text-left text-xs font-black text-slate-400 uppercase tracking-wider">등록일</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {filteredPassages.map((p) => (
                  <tr key={p.id} className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors">
                    <td className="px-4 py-3 font-bold text-white">{p.year}</td>
                    <td className="px-4 py-3 text-slate-300 font-medium">{p.grade}</td>
                    <td className="px-4 py-3 text-slate-300 font-medium">{p.institution}</td>
                    <td className="px-4 py-3 text-slate-300 font-medium">{p.question_number}번</td>
                    <td
                      className="px-4 py-3 text-slate-400 font-medium max-w-xs truncate cursor-pointer hover:text-indigo-300 transition-colors"
                      onClick={() => setViewingPassage(p)}
                      title="클릭하여 전체 지문 보기"
                    >
                      {p.passage_text.slice(0, 60)}...
                    </td>
                    <td className="px-4 py-3 text-slate-500 font-medium">{new Date(p.created_at).toLocaleDateString('ko-KR')}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1">
                        <button
                          onClick={() => openEdit(p)}
                          className="text-xs font-black text-indigo-400 hover:text-indigo-300 transition-colors px-2 py-1 rounded-lg hover:bg-indigo-900/20"
                        >
                          수정
                        </button>
                        <button
                          onClick={() => handleDelete(p.id)}
                          className="text-xs font-black text-red-400 hover:text-red-300 transition-colors px-2 py-1 rounded-lg hover:bg-red-900/20"
                        >
                          삭제
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* 전체 지문 보기 모달 */}
      {viewingPassage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setViewingPassage(null)}>
          <div className="absolute inset-0 bg-black/70" />
          <div className="relative bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-2xl max-h-[80vh] flex flex-col shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
              <h3 className="text-base font-black text-white">{viewingPassage.year}년 {viewingPassage.grade} {viewingPassage.institution} — {viewingPassage.question_number}번</h3>
              <button onClick={() => setViewingPassage(null)} className="text-slate-400 hover:text-white transition-colors text-xl font-bold">✕</button>
            </div>
            <div className="p-6 overflow-y-auto">
              <p className="text-slate-300 text-sm font-medium leading-relaxed whitespace-pre-wrap">{viewingPassage.passage_text}</p>
            </div>
          </div>
        </div>
      )}

      {/* 지문 수정 모달 */}
      {editingPassage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setEditingPassage(null)}>
          <div className="absolute inset-0 bg-black/70" />
          <div className="relative bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
              <h3 className="text-base font-black text-white">지문 수정</h3>
              <button onClick={() => setEditingPassage(null)} className="text-slate-400 hover:text-white transition-colors text-xl font-bold">✕</button>
            </div>
            <div className="p-6 space-y-4 overflow-y-auto">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-black text-slate-400 mb-1.5 uppercase tracking-wider">년도</label>
                  <input type="number" value={editForm.year} onChange={e => setEditForm(f => ({ ...f, year: e.target.value }))}
                    min="2000" max="2099"
                    className="w-full bg-slate-800 border border-slate-700 text-white font-medium text-sm px-4 py-3 rounded-xl focus:outline-none focus:border-indigo-500" />
                </div>
                <div>
                  <label className="block text-xs font-black text-slate-400 mb-1.5 uppercase tracking-wider">학년</label>
                  <select value={editForm.grade} onChange={e => setEditForm(f => ({ ...f, grade: e.target.value }))}
                    className="w-full bg-slate-800 border border-slate-700 text-white font-medium text-sm px-4 py-3 rounded-xl focus:outline-none focus:border-indigo-500">
                    {GRADES.map(g => <option key={g} value={g}>{g}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-black text-slate-400 mb-1.5 uppercase tracking-wider">시험명/기관</label>
                  <select value={editForm.institution} onChange={e => setEditForm(f => ({ ...f, institution: e.target.value }))}
                    className="w-full bg-slate-800 border border-slate-700 text-white font-medium text-sm px-4 py-3 rounded-xl focus:outline-none focus:border-indigo-500">
                    {INSTITUTIONS.map(i => <option key={i} value={i}>{i}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-black text-slate-400 mb-1.5 uppercase tracking-wider">문제 번호</label>
                  <input type="number" value={editForm.question_number} onChange={e => setEditForm(f => ({ ...f, question_number: e.target.value }))}
                    min="1" max="50"
                    className="w-full bg-slate-800 border border-slate-700 text-white font-medium text-sm px-4 py-3 rounded-xl focus:outline-none focus:border-indigo-500" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-black text-slate-400 mb-1.5 uppercase tracking-wider">지문</label>
                <textarea value={editForm.passage_text} onChange={e => setEditForm(f => ({ ...f, passage_text: e.target.value }))}
                  rows={10}
                  className="w-full bg-slate-800 border border-slate-700 text-white font-medium text-sm px-4 py-3 rounded-xl focus:outline-none focus:border-indigo-500 resize-none leading-relaxed" />
              </div>
              {editError && <p className="text-sm font-bold text-red-400">{editError}</p>}
              <div className="flex gap-3 justify-end">
                <button onClick={() => setEditingPassage(null)}
                  className="px-6 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-black text-sm rounded-xl transition-all">
                  취소
                </button>
                <button onClick={handleEditSave} disabled={editSaving}
                  className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-black text-sm rounded-xl transition-all disabled:opacity-50">
                  {editSaving ? '저장 중...' : '저장'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
