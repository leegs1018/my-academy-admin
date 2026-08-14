'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

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

const CATEGORY_COLORS: Record<string, string> = {
  '실전변형문제': 'bg-indigo-100 text-indigo-700 border-indigo-200',
  '지문분석':     'bg-teal-100 text-teal-700 border-teal-200',
  '워크북':       'bg-purple-100 text-purple-700 border-purple-200',
  '기타':         'bg-slate-100 text-slate-600 border-slate-200',
};

function fmtSize(bytes: number) {
  if (!bytes) return '';
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${Math.round(bytes / 1024)} KB`;
}
function fmtDate(iso: string) {
  const d = new Date(iso);
  return `${d.getFullYear()}.${String(d.getMonth()+1).padStart(2,'0')}.${String(d.getDate()).padStart(2,'0')}`;
}

export default function SamplesPage() {
  const [files, setFiles]         = useState<SampleFile[]>([]);
  const [loading, setLoading]     = useState(true);
  const [filter, setFilter]       = useState('전체');
  const [downloading, setDownloading] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/samples')
      .then(r => r.json())
      .then(d => { setFiles(d.files ?? []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const categories = ['전체', ...Array.from(new Set(files.map(f => f.category)))];
  const filtered = filter === '전체' ? files : files.filter(f => f.category === filter);

  const handleDownload = async (file: SampleFile) => {
    setDownloading(file.id);
    await fetch('/api/samples/download', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: file.id }),
    }).catch(() => {});
    const a = document.createElement('a');
    a.href = file.file_url;
    a.download = file.file_name;
    a.target = '_blank';
    a.click();
    setDownloading(null);
  };

  return (
    <div className="min-h-screen bg-white font-sans">
      {/* GNB */}
      <nav className="flex items-center justify-between px-8 py-4 bg-white border-b border-slate-100 sticky top-0 z-50">
        <Link href="/" className="flex items-center gap-3">
          <div className="w-9 h-9 bg-slate-900 rounded-2xl flex items-center justify-center rotate-3">
            <span className="text-yellow-400 font-black text-lg italic">C</span>
          </div>
          <span className="text-xl font-black tracking-tighter text-slate-900">
            CON <span className="text-yellow-500">EDU</span>
          </span>
        </Link>
        <div className="flex items-center gap-3">
          <Link href="/" className="text-sm font-bold text-slate-500 hover:text-slate-900 transition-all">홈으로</Link>
          <Link href="/register" className="px-6 py-2.5 text-sm font-black bg-slate-900 text-white rounded-full hover:shadow-lg transition-all">
            무료 시작하기 →
          </Link>
        </div>
      </nav>

      {/* 헤더 */}
      <section className="bg-gradient-to-b from-slate-50 to-white pt-16 pb-12 text-center px-8">
        <div className="inline-block px-4 py-1.5 mb-6 rounded-full bg-indigo-50 border border-indigo-200 text-indigo-600 text-xs font-black uppercase tracking-widest">
          Sample Questions
        </div>
        <h1 className="text-5xl font-black text-slate-900 mb-4">문제 예시</h1>
        <p className="text-lg text-slate-500 font-medium max-w-xl mx-auto">
          CON EDU AI가 생성한 실제 문제 파일을 다운로드해 확인해보세요.<br />
          지문분석, 실전변형문제, 워크북 예시를 무료로 제공합니다.
        </p>
      </section>

      {/* 필터 */}
      <div className="max-w-4xl mx-auto px-8 mb-8">
        <div className="flex gap-2 flex-wrap">
          {categories.map(c => (
            <button key={c} onClick={() => setFilter(c)}
              className={`px-4 py-2 text-sm font-black rounded-full border transition-all ${
                filter === c
                  ? 'bg-slate-900 text-white border-slate-900'
                  : 'bg-white text-slate-500 border-slate-200 hover:border-slate-400 hover:text-slate-900'
              }`}>
              {c}
            </button>
          ))}
        </div>
      </div>

      {/* 파일 목록 */}
      <main className="max-w-4xl mx-auto px-8 pb-24">
        {loading ? (
          <div className="text-center py-20 text-slate-400 font-bold">불러오는 중...</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-5xl mb-4">📂</p>
            <p className="text-slate-500 font-bold">아직 등록된 문제 예시가 없습니다.</p>
            <p className="text-slate-400 text-sm font-medium mt-2">곧 업로드될 예정입니다!</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map(file => (
              <div key={file.id}
                className="flex items-center gap-5 p-5 bg-white border-2 border-slate-100 rounded-2xl hover:border-slate-200 hover:shadow-md transition-all group">
                {/* 파일 아이콘 */}
                <div className="w-12 h-12 bg-red-50 border border-red-100 rounded-xl flex items-center justify-center flex-shrink-0">
                  <span className="text-2xl">📄</span>
                </div>

                {/* 정보 */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className={`px-2.5 py-0.5 text-[10px] font-black rounded-full border ${CATEGORY_COLORS[file.category] ?? CATEGORY_COLORS['기타']}`}>
                      {file.category}
                    </span>
                    <p className="text-base font-black text-slate-900 truncate">{file.title}</p>
                  </div>
                  <div className="flex items-center gap-3 text-xs font-bold text-slate-400">
                    <span>{fmtDate(file.created_at)}</span>
                    {file.file_size > 0 && <span>{fmtSize(file.file_size)}</span>}
                    <span>⬇ {file.download_count ?? 0}회</span>
                  </div>
                </div>

                {/* 다운로드 버튼 */}
                <button
                  onClick={() => handleDownload(file)}
                  disabled={downloading === file.id}
                  className="flex items-center gap-2 px-5 py-2.5 bg-slate-900 text-white text-sm font-black rounded-xl hover:bg-slate-700 transition-all disabled:opacity-50 flex-shrink-0"
                >
                  {downloading === file.id ? (
                    <span className="animate-pulse">처리중...</span>
                  ) : (
                    <><span>⬇</span><span className="hidden sm:inline">다운로드</span></>
                  )}
                </button>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* CTA */}
      <section className="bg-slate-900 py-16 text-center px-8">
        <p className="text-3xl font-black text-white mb-3">직접 만들어보고 싶으신가요?</p>
        <p className="text-slate-400 font-medium mb-8">무료로 가입하고 AI로 나만의 문제를 생성해보세요.</p>
        <Link href="/register"
          className="px-12 py-4 bg-yellow-400 text-slate-900 font-black rounded-full text-base hover:bg-yellow-300 transition-all hover:-translate-y-0.5 shadow-xl shadow-yellow-400/30">
          무료로 시작하기 →
        </Link>
      </section>
    </div>
  );
}
