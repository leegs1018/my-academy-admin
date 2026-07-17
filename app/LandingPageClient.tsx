'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';

const DEMO_TABS = ['실전 변형 문제', '지문분석', '워크북'] as const;

function DemoScreen({ tab }: { tab: typeof DEMO_TABS[number] }) {
  if (tab === '실전 변형 문제') {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-lg font-black text-slate-900">🎯 실전 변형 문제</p>
            <p className="text-xs text-slate-400 font-medium">수능형 10가지 유형을 AI가 즉시 생성합니다.</p>
          </div>
        </div>
        <div className="flex gap-2 border-b-2 border-slate-100 pb-0">
          {['✏️ 직접 입력', '📖 모의고사 지문', '📋 생성 이력'].map((t, i) => (
            <div key={t} className={`px-4 py-2 font-black text-sm rounded-t-lg ${i === 0 ? 'bg-indigo-600 text-white' : 'text-slate-400'}`}>{t}</div>
          ))}
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-xs font-black px-2.5 py-1 rounded-full border bg-blue-100 text-blue-700 border-blue-200">주제/제목 유형</span>
            <span className="text-xs font-black px-2 py-1 rounded-full bg-lime-100 text-lime-700 border border-lime-200">A2 최하</span>
          </div>
          <p className="text-sm font-bold text-gray-800 mb-3">다음 글의 주제로 가장 적절한 것은?</p>
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 mb-4 text-sm text-slate-700 leading-relaxed">
            Artificial intelligence has fundamentally changed the way students learn. Adaptive learning platforms analyze each student&apos;s performance in real time, identifying strengths and weaknesses to provide personalized content.
          </div>
          <div className="space-y-1.5 mb-4">
            {[
              { n: '①', text: 'the ethical concerns of AI in education', correct: false },
              { n: '②', text: 'how AI personalizes learning for each student', correct: true },
              { n: '③', text: 'the history of adaptive learning platforms', correct: false },
              { n: '④', text: 'challenges faced by traditional classroom teaching', correct: false },
              { n: '⑤', text: 'the role of teachers in AI-assisted education', correct: false },
            ].map(c => (
              <div key={c.n} className={`flex items-start gap-2 px-3 py-2 rounded-lg text-xs font-medium ${c.correct ? 'bg-indigo-50 border border-indigo-200 text-indigo-800 font-black' : 'text-slate-600'}`}>
                <span className={`font-black flex-shrink-0 ${c.correct ? 'text-indigo-600' : 'text-slate-500'}`}>{c.n}</span>
                <span>{c.text}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm opacity-50">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs font-black px-2.5 py-1 rounded-full border bg-rose-100 text-rose-700 border-rose-200">문장 삽입 유형</span>
            <span className="text-xs font-black px-2 py-1 rounded-full bg-sky-100 text-sky-700 border border-sky-200">B1 하</span>
          </div>
          <p className="text-sm font-bold text-gray-800">글의 흐름으로 보아, 주어진 문장이 들어가기에 가장 적절한 곳은?</p>
        </div>
        <div className="flex gap-3">
          <div className="flex-1 py-3 rounded-xl font-black text-sm bg-indigo-600 text-white text-center">⬇️ 문제지 PDF</div>
          <div className="flex-1 py-3 rounded-xl font-black text-sm bg-slate-700 text-white text-center">⬇️ 답안지 PDF</div>
        </div>
      </div>
    );
  }

  if (tab === '지문분석') {
    return (
      <div className="space-y-3">
        <div>
          <p className="text-lg font-black text-slate-900">📝 지문분석</p>
          <p className="text-xs text-slate-400 font-medium">지문 하나로 6가지 학습 자료를 자동 생성합니다.</p>
        </div>
        <div className="flex gap-2 border-b-2 border-slate-100">
          {['✏️ 직접 입력', '📖 모의고사 지문', '📋 생성 이력'].map((t, i) => (
            <div key={t} className={`px-4 py-2 font-black text-sm rounded-t-lg ${i === 0 ? 'bg-teal-600 text-white' : 'text-slate-400'}`}>{t}</div>
          ))}
        </div>
        {/* 01 변형 지문 */}
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="bg-teal-600 px-4 py-2 flex items-center gap-2">
            <span className="font-black text-lg text-white/60">01</span>
            <span className="font-black text-sm text-white">변형 지문</span>
          </div>
          <p className="px-4 py-2.5 text-xs text-slate-600 font-bold leading-relaxed">
            Artificial intelligence has <span className="bg-yellow-100 px-0.5 rounded">drastically altered</span> the way students acquire knowledge. Adaptive platforms <span className="bg-yellow-100 px-0.5 rounded">evaluate</span> each learner&apos;s progress in real time...
          </p>
        </div>
        {/* 02 T/F */}
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="bg-violet-500 px-4 py-2 flex items-center gap-2">
            <span className="font-black text-lg text-white/60">02</span>
            <span className="font-black text-sm text-white">T/F 문제 10개</span>
          </div>
          <div className="px-4 py-2.5 space-y-1">
            {['AI systems personalize content for each student.  → T', 'Traditional teaching is superior to AI-based methods.  → F'].map((q, i) => (
              <p key={i} className="text-xs text-slate-600 font-bold">{i + 1}. {q}</p>
            ))}
            <p className="text-xs text-slate-400 font-bold">… 8개 더</p>
          </div>
        </div>
        {/* 03+06 compact */}
        <div className="grid grid-cols-2 gap-2">
          <div className="bg-indigo-50 rounded-xl p-3">
            <p className="text-[9px] font-black text-indigo-600 uppercase tracking-widest mb-1">03 한글 요약</p>
            <p className="text-xs text-slate-700 font-bold leading-relaxed">AI 기반 맞춤 학습이 학생 개개인에게 최적화된 교육을 제공한다.</p>
          </div>
          <div className="bg-slate-50 rounded-xl p-3">
            <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">06 핵심 어휘 10개</p>
            <div className="flex flex-wrap gap-1">
              {['adaptive', 'personalize', 'analyze', 'capability'].map(w => (
                <span key={w} className="text-[9px] font-black bg-white border border-slate-200 px-1.5 py-0.5 rounded-full text-slate-700">{w}</span>
              ))}
            </div>
          </div>
        </div>
        <div className="flex gap-3">
          <div className="flex-1 py-3 rounded-xl font-black text-sm bg-teal-600 text-white text-center">⬇️ 문제 PDF</div>
          <div className="flex-1 py-3 rounded-xl font-black text-sm bg-slate-700 text-white text-center">⬇️ 정답 PDF</div>
        </div>
      </div>
    );
  }

  // 워크북
  return (
    <div className="space-y-4">
      <div>
        <p className="text-lg font-black text-slate-900">📚 워크북</p>
        <p className="text-xs text-slate-400 font-medium">지문 드릴·어휘 어법·서술형까지 한 번에 생성합니다.</p>
      </div>
      <div className="flex gap-2 border-b-2 border-slate-100">
        {['✏️ 직접 입력', '📖 모의고사 지문', '📋 생성 이력'].map((t, i) => (
          <div key={t} className={`px-4 py-2 font-black text-sm rounded-t-lg ${i === 0 ? 'bg-purple-600 text-white' : 'text-slate-400'}`}>{t}</div>
        ))}
      </div>
      {/* 카테고리 */}
      <div className="grid grid-cols-3 gap-2">
        {[
          { label: '지문 드릴', color: 'bg-teal-50 border-teal-200 text-teal-700', items: ['지문 해석지', '구문 분석', '문장 해석', '단어 배열', '영작'] },
          { label: '어휘 어법', color: 'bg-purple-50 border-purple-200 text-purple-700', items: ['어휘 고르기', '어휘 채우기', '어법 고르기', '어법 고치기'] },
          { label: '서술형 대비', color: 'bg-amber-50 border-amber-200 text-amber-700', items: ['어법+순서배열', '영작+어휘', '요약문 서술형'] },
        ].map(cat => (
          <div key={cat.label} className={`rounded-xl border p-3 ${cat.color}`}>
            <p className="text-[9px] font-black uppercase tracking-wider mb-2">{cat.label}</p>
            <div className="space-y-1">
              {cat.items.map(item => (
                <div key={item} className="flex items-center gap-1.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-current opacity-50 flex-shrink-0" />
                  <p className="text-[10px] font-bold">{item}</p>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
      {/* 샘플: 어법 고르기 */}
      <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
        <p className="text-[10px] font-black text-purple-600 uppercase tracking-widest mb-2">어법 고르기 — 생성 예시</p>
        <p className="text-xs text-slate-700 font-bold leading-[2]">
          Adaptive systems (A){' '}
          <span className="inline-flex items-center gap-1">
            <span className="bg-purple-100 text-purple-800 font-black px-1.5 py-0.5 rounded text-[10px] border border-purple-200">analyze</span>
            <span className="text-slate-400 text-[10px]">/</span>
            <span className="bg-white text-slate-400 font-bold px-1.5 py-0.5 rounded text-[10px] border border-slate-200">analyzing</span>
          </span>{' '}
          each student&apos;s progress, (B){' '}
          <span className="inline-flex items-center gap-1">
            <span className="bg-purple-100 text-purple-800 font-black px-1.5 py-0.5 rounded text-[10px] border border-purple-200">making</span>
            <span className="text-slate-400 text-[10px]">/</span>
            <span className="bg-white text-slate-400 font-bold px-1.5 py-0.5 rounded text-[10px] border border-slate-200">made</span>
          </span>{' '}
          learning more personalized.
        </p>
      </div>
      <div className="flex gap-3">
        <div className="flex-1 py-3 rounded-xl font-black text-sm bg-purple-600 text-white text-center">⬇️ 워크북 PDF</div>
        <div className="flex-1 py-3 rounded-xl font-black text-sm bg-slate-700 text-white text-center">⬇️ 정답지 PDF</div>
      </div>
    </div>
  );
}

interface SiteInfo {
  business_name?: string;
  business_number?: string;
  ceo_name?: string;
  company_address?: string;
  customer_service_phone?: string;
  privacy_manager_name?: string;
  privacy_manager_phone?: string;
  privacy_manager_email?: string;
}

export default function LandingPageClient() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [demoTab, setDemoTab] = useState<typeof DEMO_TABS[number]>('실전 변형 문제');
  const [siteInfo, setSiteInfo] = useState<SiteInfo>({});

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setIsLoggedIn(!!session));
  }, []);

  useEffect(() => {
    const keys = ['business_name','business_number','ceo_name','company_address','customer_service_phone','privacy_manager_name','privacy_manager_phone','privacy_manager_email'];
    supabase.from('site_settings').select('key, value').in('key', keys).then(({ data }) => {
      if (data) {
        const map: SiteInfo = {};
        data.forEach((r: { key: string; value: string }) => { (map as Record<string, string>)[r.key] = r.value; });
        setSiteInfo(map);
      }
    });
  }, []);

  return (
    <div className="min-h-screen bg-white font-sans text-slate-900">
      {/* GNB */}
      <nav className="flex items-center justify-between px-8 py-5 bg-white border-b border-slate-100 sticky top-0 z-50">
        <Link href="/" className="flex items-center gap-3">
          <div className="w-10 h-10 bg-slate-900 rounded-2xl flex items-center justify-center rotate-3 shadow-lg shadow-slate-200">
            <span className="text-yellow-400 font-black text-xl italic">C</span>
          </div>
          <div className="flex flex-col -space-y-1">
            <span className="text-2xl font-black tracking-tighter text-slate-900">
              CON <span className="text-yellow-500">EDU</span>
            </span>
            <span className="text-[10px] font-bold text-slate-400 tracking-[0.2em]">AI QUESTION GENERATOR</span>
          </div>
        </Link>

        <div className="flex items-center gap-3">
          <Link href="/kiosk" className="px-5 py-2.5 text-sm font-bold border-2 border-slate-200 text-slate-500 rounded-full hover:border-slate-400 hover:text-slate-700 transition-all">
            출결 키오스크
          </Link>
          {isLoggedIn ? (
            <Link href="/admin/ai-questions" className="px-6 py-2.5 text-sm font-bold bg-slate-900 text-white rounded-full hover:shadow-xl hover:-translate-y-0.5 transition-all">
              서비스 시작하기 🚀
            </Link>
          ) : (
            <>
              <Link href="/register" className="px-5 py-2.5 text-sm font-bold border-2 border-slate-900 text-slate-900 rounded-full hover:bg-slate-900 hover:text-white transition-all">
                솔루션 가입하기
              </Link>
              <Link href="/login" className="px-5 py-2.5 text-sm font-bold bg-slate-900 text-white rounded-full hover:shadow-xl hover:-translate-y-0.5 transition-all">
                로그인
              </Link>
            </>
          )}
        </div>
      </nav>

      {/* 히어로 */}
      <section className="relative pt-24 pb-32 overflow-hidden">
        <div className="max-w-7xl mx-auto px-8 flex flex-col items-center text-center">
          <div className="inline-block px-4 py-1.5 mb-10 rounded-full bg-slate-50 border border-slate-200 text-slate-500 text-xs font-black uppercase tracking-widest">
            AI 문제 자동 생성 솔루션
          </div>

          <h1 className="text-6xl md:text-8xl font-black text-slate-900 leading-[1.4] md:leading-[1.3] tracking-tight mb-10">
            학원 운영,<br />
            <div className="mt-4 relative inline-block">
              <span className="relative z-10 bg-slate-900 text-white px-6 py-3 rounded-[2.5rem]">압도적</span>
              <span className="absolute -bottom-2 -right-2 w-full h-full bg-yellow-400 rounded-[2.5rem] z-0"></span>
            </div>
            <span className="ml-2">으로 쉽게.</span>
          </h1>

          <p className="text-xl text-slate-400 font-medium leading-relaxed max-w-2xl mb-6">
            지문 하나로 어법·어휘·빈칸 등 <strong className="text-slate-600">10가지 유형</strong> 변형 문제를 즉시 생성.<br />
            워크북·지문분석까지, 영어 수업에 필요한 모든 자료를 AI로 해결하세요.
          </p>

          {/* 스탯 뱃지 */}
          <div className="flex flex-wrap justify-center gap-3 mb-12">
            {[
              { label: '변형 문제 유형', value: '10가지' },
              { label: '난이도', value: 'A2 ~ C2' },
              { label: '기출 지문', value: '수능·평가원·교육청' },
              { label: '이력 보관', value: '30일' },
            ].map((s) => (
              <div key={s.label} className="flex items-center gap-2 bg-white border border-slate-200 rounded-full px-4 py-2 shadow-sm">
                <span className="text-sm font-black text-slate-900">{s.value}</span>
                <span className="text-xs font-bold text-slate-400">{s.label}</span>
              </div>
            ))}
          </div>

          <div className="flex flex-col sm:flex-row gap-6">
            <Link
              href={isLoggedIn ? '/admin/ai-questions' : '/login'}
              className="px-12 py-5 bg-slate-900 text-white font-black rounded-full text-lg shadow-2xl shadow-slate-300 hover:bg-slate-800 transition-all hover:-translate-y-1"
            >
              지금 시작하기
            </Link>
            <Link
              href="/guide"
              className="px-12 py-5 bg-white text-slate-900 font-black rounded-full text-lg border-2 border-slate-900 hover:bg-slate-50 transition-all"
            >
              서비스 가이드
            </Link>
          </div>
        </div>
        <div className="absolute top-1/2 left-0 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-yellow-50 rounded-full blur-[120px] opacity-60 z-[-1]"></div>
      </section>

      {/* AI 서비스 3카드 */}
      <section className="max-w-7xl mx-auto px-8 py-20">
        <div className="text-center mb-14">
          <p className="text-yellow-600 font-black text-xs uppercase tracking-widest mb-3">AI Question Service</p>
          <h2 className="text-4xl font-black text-slate-900">3가지 AI 문제 생성 서비스</h2>
          <p className="text-slate-400 font-medium mt-4">모든 메뉴에서 직접 입력·모의고사 지문·생성 이력을 탭으로 바로 전환하세요</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {[
            {
              title: '지문분석',
              label: 'Passage Analysis',
              desc: '지문을 올리면 AI가 변형 지문, T/F 문제 10개, 한글 요약, 영어 제목 3가지, 1문장 영어 요약, 핵심 어휘 동반의어표까지 6가지 자료를 한 번에 생성합니다. 최대 10개 지문 동시 처리.',
              icon: '📝',
              bg: 'bg-teal-50',
              color: 'text-teal-600',
            },
            {
              title: '워크북',
              label: 'Workbook',
              desc: '지문 드릴(해석지·구문 분석·문장 해석·단어 배열·영작), 어휘 어법(어휘 고르기·채우기·어법 고치기), 서술형 대비 등 다양한 유형의 워크북을 즉시 생성합니다. 최대 10개 지문을 한 번에.',
              icon: '📚',
              bg: 'bg-purple-50',
              color: 'text-purple-600',
            },
            {
              title: '실전 변형 문제',
              label: 'Exam Generation',
              desc: '주제·제목·어법·어휘·빈칸 추론·요약·흐름·어구 의미·순서 배열·문장 삽입 10가지 수능형 유형을, A2(최하)~C2(최상) 5단계 난이도로 자유롭게 조합해 즉시 생성합니다.',
              icon: '🎯',
              bg: 'bg-indigo-50',
              color: 'text-indigo-600',
            },
          ].map((item, i) => (
            <div
              key={i}
              className="group relative p-10 bg-white border-2 border-slate-200 rounded-[3rem]
                         transition-all duration-500 hover:-translate-y-4
                         hover:shadow-[0_20px_40px_rgba(0,0,0,0.08)] hover:border-yellow-400 cursor-default"
            >
              <div className={`w-20 h-20 ${item.bg} rounded-[2rem] flex items-center justify-center text-4xl mb-8 group-hover:scale-110 group-hover:rotate-6 transition-transform duration-500`}>
                {item.icon}
              </div>
              <p className={`${item.color} font-black text-xs uppercase mb-2 tracking-widest`}>{item.label}</p>
              <h4 className="text-2xl font-black mb-4">{item.title}</h4>
              <p className="text-slate-500 font-medium leading-relaxed text-sm">{item.desc}</p>
              <div className="absolute top-8 right-8 text-slate-200 group-hover:text-yellow-400 transition-colors text-2xl font-bold">↗</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── AI 예시 화면 ── */}
      <section className="bg-slate-50 py-24">
        <div className="max-w-7xl mx-auto px-8">
          <div className="text-center mb-14">
            <p className="text-yellow-600 font-black text-xs uppercase tracking-widest mb-3">Live Preview</p>
            <h2 className="text-4xl font-black text-slate-900">실제 사용 화면</h2>
            <p className="text-slate-400 font-medium mt-4">아래 탭을 눌러 각 서비스의 화면을 미리 확인하세요</p>
          </div>

          <div className="flex justify-center gap-3 mb-8">
            {DEMO_TABS.map(t => (
              <button
                key={t}
                onClick={() => setDemoTab(t)}
                className={`px-6 py-3 rounded-2xl font-black text-sm transition-all border-2
                  ${demoTab === t
                    ? 'bg-slate-900 text-white border-slate-900 shadow-lg'
                    : 'bg-white text-slate-500 border-slate-200 hover:border-slate-400'}`}
              >
                {t === '실전 변형 문제' && '🎯 '}
                {t === '지문분석' && '📝 '}
                {t === '워크북' && '📚 '}
                {t}
              </button>
            ))}
          </div>

          <div className="max-w-4xl mx-auto">
            <div className="bg-slate-200 rounded-3xl p-3 shadow-2xl shadow-slate-300">
              <div className="bg-white rounded-2xl overflow-hidden">
                {/* 브라우저 상단 바 */}
                <div className="bg-slate-100 px-4 py-3 flex items-center gap-3 border-b border-slate-200">
                  <div className="flex gap-1.5">
                    <div className="w-3 h-3 rounded-full bg-red-400"></div>
                    <div className="w-3 h-3 rounded-full bg-yellow-400"></div>
                    <div className="w-3 h-3 rounded-full bg-green-400"></div>
                  </div>
                  <div className="flex-1 bg-white rounded-lg px-3 py-1.5 text-xs text-slate-400 border border-slate-200 font-medium">
                    🔒 conedu.ai.kr/admin/{demoTab === '실전 변형 문제' ? 'ai-questions' : demoTab === '지문분석' ? 'pdf-editor' : 'vocab-choice'}
                  </div>
                </div>

                <div className="flex" style={{ minHeight: 520 }}>
                  {/* 사이드바 */}
                  <div className="w-48 bg-white border-r border-slate-100 py-4 px-3 flex-shrink-0">
                    <div className="flex items-center gap-2 px-3 mb-6">
                      <div className="w-7 h-7 bg-slate-900 rounded-lg flex items-center justify-center">
                        <span className="text-yellow-400 font-black text-xs italic">C</span>
                      </div>
                      <span className="font-black text-sm text-slate-900">CON <span className="text-yellow-500">EDU</span></span>
                    </div>
                    <div className="space-y-0.5">
                      <div className="px-3 py-1.5">
                        <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">AI 문제 생성</div>
                        {[
                          { icon: '📝', label: '지문분석', active: demoTab === '지문분석' },
                          { icon: '📚', label: '워크북', active: demoTab === '워크북' },
                          { icon: '🎯', label: '실전 변형 문제', active: demoTab === '실전 변형 문제' },
                        ].map(m => (
                          <div key={m.label} className={`flex items-center gap-2 px-2 py-2 rounded-lg text-[11px] font-bold ${m.active ? 'bg-slate-900 text-white' : 'text-slate-500'}`}>
                            <span>{m.icon}</span><span className="truncate">{m.label}</span>
                          </div>
                        ))}
                      </div>
                      {[
                        { icon: '📢', label: '공지사항' },
                        { icon: '💬', label: '문의하기' },
                      ].map(m => (
                        <div key={m.label} className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-bold text-slate-500">
                          <span>{m.icon}</span><span>{m.label}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* 메인 콘텐츠 */}
                  <div className="flex-1 bg-gray-50 p-5 overflow-hidden">
                    <DemoScreen tab={demoTab} />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 품질 보증 섹션 */}
      <section className="max-w-7xl mx-auto px-8 py-20">
        <div className="text-center mb-14">
          <p className="text-yellow-600 font-black text-xs uppercase tracking-widest mb-3">Quality & Trust</p>
          <h2 className="text-4xl font-black text-slate-900">문제 품질도 책임집니다</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            {
              icon: '👍',
              title: '품질 평가 시스템',
              desc: '생성된 문제마다 👍/👎 평가 버튼을 제공합니다. 학원 선생님들의 피드백으로 AI 품질이 지속적으로 개선됩니다.',
              color: 'bg-emerald-50 border-emerald-100',
            },
            {
              icon: '🔄',
              title: 'CON 환불 보장',
              desc: '품질이 낮은 문제를 신고하면 운영팀이 검토 후 해당 CON을 자동 환불합니다. 신뢰할 수 있는 서비스를 약속합니다.',
              color: 'bg-amber-50 border-amber-100',
            },
            {
              icon: '📈',
              title: '지속적 품질 향상',
              desc: '수집된 피드백 데이터는 AI 학습에 활용되어 더 좋은 문제를 생성할 수 있도록 서비스가 발전합니다.',
              color: 'bg-blue-50 border-blue-100',
            },
          ].map((item, i) => (
            <div key={i} className={`${item.color} border-2 rounded-3xl p-8`}>
              <div className="text-4xl mb-4">{item.icon}</div>
              <h3 className="text-lg font-black text-slate-900 mb-3">{item.title}</h3>
              <p className="text-sm font-medium text-slate-600 leading-relaxed">{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* 하단 CTA */}
      <section className="mx-8 mb-20">
        <div className="max-w-7xl mx-auto bg-slate-900 rounded-[4rem] px-8 py-24 text-center relative overflow-hidden shadow-2xl shadow-slate-400">
          <div className="relative z-10">
            <h2 className="text-4xl md:text-5xl font-black text-white mb-6 leading-tight">
              AI가 만드는 수준 높은 영어 수업 자료<br />
              <span className="text-yellow-400 italic">CON EDU</span>
            </h2>
            <p className="text-slate-400 font-medium mb-12">지금 가입하고 지문분석·워크북·실전 변형 문제를 경험해보세요.</p>
            <Link
              href={isLoggedIn ? '/admin/ai-questions' : '/register'}
              className="px-12 py-5 bg-yellow-400 text-slate-900 font-black rounded-full hover:bg-yellow-300 transition-all inline-block text-lg shadow-xl shadow-yellow-400/20"
            >
              {isLoggedIn ? '서비스 바로가기' : '지금 무료로 시작하기'}
            </Link>
          </div>
          <div className="absolute -bottom-10 -right-10 text-white opacity-[0.03] text-[250px] font-black pointer-events-none">CE</div>
        </div>
      </section>

      {/* 푸터 */}
      <footer className="border-t border-slate-100">
        <div className="max-w-7xl mx-auto px-8 py-12">
          <div className="flex flex-col md:flex-row justify-between items-center gap-6 text-slate-400 text-sm font-bold mb-8">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 bg-slate-900 rounded flex items-center justify-center">
                <span className="text-yellow-400 text-[10px] font-black">C</span>
              </div>
              <span>CON EDU</span>
            </div>
            <div className="flex gap-8">
              <Link href="/terms" className="hover:text-slate-900 transition-colors">이용약관</Link>
              <Link href="/privacy" className="text-slate-900 underline decoration-2 underline-offset-4">개인정보처리방침</Link>
              <Link href="/support" className="hover:text-slate-900 transition-colors">고객센터</Link>
              <Link href="/guide" className="hover:text-slate-900 transition-colors">서비스 가이드</Link>
            </div>
            <p>© 2026 CON EDU. All rights reserved.</p>
          </div>
          <div className="border-t border-slate-100 pt-6 text-xs text-slate-400 font-medium space-y-1.5">
            <div className="flex flex-wrap gap-x-6 gap-y-1">
              {siteInfo.business_name    && <span>사업자명: {siteInfo.business_name}</span>}
              {siteInfo.business_number  && <span>사업자 등록번호: {siteInfo.business_number}</span>}
              {siteInfo.ceo_name         && <span>대표자: {siteInfo.ceo_name}</span>}
              {siteInfo.customer_service_phone && <span>고객센터: {siteInfo.customer_service_phone}</span>}
            </div>
            <div className="flex flex-wrap gap-x-6 gap-y-1">
              {siteInfo.company_address  && <span>주소: {siteInfo.company_address}</span>}
            </div>
            <div className="flex flex-wrap gap-x-6 gap-y-1">
              {siteInfo.privacy_manager_name  && <span>개인정보 보호책임자: {siteInfo.privacy_manager_name}</span>}
              {siteInfo.privacy_manager_phone && <span>연락처: {siteInfo.privacy_manager_phone}</span>}
              {siteInfo.privacy_manager_email && <span>이메일: {siteInfo.privacy_manager_email}</span>}
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
