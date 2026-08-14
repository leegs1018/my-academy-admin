'use client';

import { useEffect, useState, useRef } from 'react';

interface SampleFile {
  id: string;
  title: string;
  category: string;
  file_url: string;
  file_name: string;
  file_size: number;
  download_count: number;
  created_at: string;
}

const CATEGORIES = ['실전변형문제', '지문분석', '워크북', '기타'];

function fmtSize(bytes: number) {
  if (!bytes) return '-';
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${Math.round(bytes / 1024)} KB`;
}
function fmtDate(iso: string) {
  const d = new Date(iso);
  return `${d.getFullYear()}.${String(d.getMonth()+1).padStart(2,'0')}.${String(d.getDate()).padStart(2,'0')}`;
}

export default function SuperAdminSamplesPage() {
  const [files, setFiles]       = useState<SampleFile[]>([]);
  const [loading, setLoading]   = useState(true);
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting]   = useState<string | null>(null);
  const [title, setTitle]       = useState('');
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [file, setFile]         = useState<File | null>(null);
  const [msg, setMsg]           = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = () => {
    setLoading(true);
    fetch('/api/samples')
      .then(r => r.json())
      .then(d => { setFiles(d.files ?? []); setLoading(false); })
      .catch(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file || !title.trim()) { setMsg({ type: 'err', text: '제목과 파일을 모두 입력해주세요.' }); return; }
    setUploading(true);
    setMsg(null);
    const fd = new FormData();
    fd.append('file', file);
    fd.append('title', title.trim());
    fd.append('category', category);
    const res = await fetch('/api/superadmin/samples', { method: 'POST', body: fd });
    const data = await res.json();
    setUploading(false);
    if (!res.ok) { setMsg({ type: 'err', text: data.error ?? '업로드 실패' }); return; }
    setMsg({ type: 'ok', text: '업로드 완료!' });
    setTitle(''); setFile(null); setCategory(CATEGORIES[0]);
    if (fileRef.current) fileRef.current.value = '';
    load();
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`"${name}" 파일을 삭제할까요?`)) return;
    setDeleting(id);
    const res = await fetch('/api/superadmin/samples', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });
    setDeleting(null);
    if (!res.ok) { setMsg({ type: 'err', text: '삭제 실패' }); return; }
    setMsg({ type: 'ok', text: '삭제되었습니다.' });
    load();
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-black text-white">📂 문제 예시 관리</h1>
        <p className="text-sm text-slate-500 mt-1 font-bold">메인 페이지 문제 예시 게시판에 표시할 파일을 업로드·관리합니다.</p>
      </div>

      {/* 업로드 폼 */}
      <div className="bg-slate-900 rounded-2xl p-6 border border-slate-800">
        <h2 className="text-base font-black text-white mb-5">파일 업로드</h2>
        <form onSubmit={handleUpload} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-black text-slate-400 mb-1.5">제목 *</label>
              <input
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="예) 수능 2025년 영어 실전변형문제 세트A"
                className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 text-white text-sm font-bold rounded-xl focus:outline-none focus:border-indigo-500 placeholder-slate-600"
              />
            </div>
            <div>
              <label className="block text-xs font-black text-slate-400 mb-1.5">카테고리</label>
              <select
                value={category}
                onChange={e => setCategory(e.target.value)}
                className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 text-white text-sm font-bold rounded-xl focus:outline-none focus:border-indigo-500"
              >
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-black text-slate-400 mb-1.5">파일 선택 *</label>
            <div
              onClick={() => fileRef.current?.click()}
              className="flex items-center gap-3 px-4 py-3 bg-slate-800 border-2 border-dashed border-slate-700 rounded-xl cursor-pointer hover:border-indigo-500 transition-all"
            >
              <span className="text-2xl">📎</span>
              <div>
                <p className="text-sm font-black text-white">{file ? file.name : '파일을 선택하세요'}</p>
                {file && <p className="text-xs text-slate-500 font-bold mt-0.5">{fmtSize(file.size)}</p>}
                {!file && <p className="text-xs text-slate-600 font-bold mt-0.5">PDF, DOCX, XLSX, ZIP 등</p>}
              </div>
            </div>
            <input ref={fileRef} type="file" className="hidden" onChange={e => setFile(e.target.files?.[0] ?? null)} />
          </div>

          {msg && (
            <div className={`px-4 py-2.5 rounded-xl text-sm font-black ${msg.type === 'ok' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30' : 'bg-red-500/10 text-red-400 border border-red-500/30'}`}>
              {msg.text}
            </div>
          )}

          <button
            type="submit"
            disabled={uploading}
            className="w-full py-3 bg-indigo-600 text-white font-black rounded-xl hover:bg-indigo-500 transition-all disabled:opacity-50"
          >
            {uploading ? '업로드 중...' : '업로드'}
          </button>
        </form>
      </div>

      {/* 파일 목록 */}
      <div className="bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
          <h2 className="text-base font-black text-white">등록된 파일 ({files.length}개)</h2>
          <button onClick={load} className="text-xs font-black text-slate-500 hover:text-slate-300 transition-colors">새로고침</button>
        </div>

        {loading ? (
          <p className="text-center text-slate-600 font-bold py-12">불러오는 중...</p>
        ) : files.length === 0 ? (
          <p className="text-center text-slate-600 font-bold py-12">등록된 파일이 없습니다.</p>
        ) : (
          <div className="divide-y divide-slate-800">
            {files.map(f => (
              <div key={f.id} className="flex items-center gap-4 px-6 py-4 hover:bg-slate-800/30 transition-all">
                <div className="w-10 h-10 bg-slate-800 rounded-xl flex items-center justify-center flex-shrink-0 text-xl">📄</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="px-2 py-0.5 text-[10px] font-black bg-indigo-500/15 text-indigo-400 border border-indigo-500/30 rounded-full">{f.category}</span>
                    <p className="text-sm font-black text-white truncate">{f.title}</p>
                  </div>
                  <div className="flex items-center gap-3 text-[11px] font-bold text-slate-500 mt-0.5">
                    <span>{f.file_name}</span>
                    <span>{fmtSize(f.file_size)}</span>
                    <span>⬇ {f.download_count}회</span>
                    <span>{fmtDate(f.created_at)}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <a href={f.file_url} target="_blank" rel="noreferrer"
                    className="px-3 py-1.5 text-xs font-black text-slate-400 hover:text-white border border-slate-700 rounded-lg hover:border-slate-500 transition-all">
                    미리보기
                  </a>
                  <button
                    onClick={() => handleDelete(f.id, f.title)}
                    disabled={deleting === f.id}
                    className="px-3 py-1.5 text-xs font-black text-red-500 hover:text-red-300 border border-red-900/40 hover:border-red-500/50 rounded-lg transition-all disabled:opacity-40"
                  >
                    {deleting === f.id ? '삭제중...' : '삭제'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
