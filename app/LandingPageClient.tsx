'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';

const DEMO_TABS = ['실전 변형 문제', '지문분석 워크북', '어휘 선택 문제'] as const;

function DemoScreen({ tab }: { tab: typeof DEMO_TABS[number] }) {
  if (tab === '실전 변형 문제') {
    return (
      <div className="space-y-4">
        {/* 페이지 헤더 */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-lg font-black text-slate-900">🎯 실전 변형 문제</p>
            <p className="text-xs text-slate-400 font-medium">수능/모의고사형 변형 문제를 AI로 즉시 생성합니다.</p>
          </div>
        </div>
        {/* 탭 */}
        <div className="flex gap-2 border-b-2 border-slate-100 pb-0">
          {['✏️ 직접 입력', '📖 모의고사 지문', '📋 생성 이력'].map((t, i) => (
            <div key={t} className={`px-4 py-2 font-black text-sm rounded-t-lg ${i === 0 ? 'bg-indigo-600 text-white' : 'text-slate-400'}`}>{t}</div>
          ))}
        </div>
        {/* 생성된 문제 카드 */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-xs font-black px-2.5 py-1 rounded-full border bg-blue-100 text-blue-700 border-blue-200">주제/제목 유형</span>
            <span className="text-sm font-black text-gray-800">문제 1</span>
          </div>
          <p className="text-sm font-bold text-gray-800 mb-3">다음 글의 주제로 가장 적절한 것은?</p>
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 mb-4 text-sm text-slate-700 leading-relaxed">
            Artificial intelligence has fundamentally changed the way students learn. Adaptive learning platforms analyze each student&apos;s performance in real time, identifying strengths and weaknesses to provide personalized content. Unlike traditional one-size-fits-all instruction, AI-powered systems adjust the difficulty level and pacing based on individual progress, ensuring that no student is left behind or held back.
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
          <div className="flex items-center gap-3">
            <div className="text-xs font-black text-indigo-600 border border-indigo-200 px-3 py-1.5 rounded-lg">✅ 정답/해설 보기</div>
            <span className="text-xs font-black text-gray-400">문제 품질</span>
            <div className="px-2.5 py-1 rounded-lg border border-gray-200 text-xs font-black text-gray-400">👍 좋아요</div>
            <div className="px-2.5 py-1 rounded-lg border border-gray-200 text-xs font-black text-gray-400">👎 신고</div>
          </div>
        </div>
        {/* 두 번째 카드 미리보기 */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm opacity-50">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-xs font-black px-2.5 py-1 rounded-full border bg-rose-100 text-rose-700 border-rose-200">빈칸 추론 유형</span>
            <span className="text-sm font-black text-gray-800">문제 2</span>
          </div>
          <p className="text-sm font-bold text-gray-800">다음 빈칸에 들어갈 말로 가장 적절한 것은?</p>
        </div>
        {/* 다운로드 버튼 */}
        <div className="flex gap-3">
          <div className="flex-1 py-3 rounded-xl font-black text-sm bg-indigo-600 text-white text-center">⬇️ 문제지 PDF</div>
          <div className="flex-1 py-3 rounded-xl font-black text-sm bg-slate-700 text-white text-center">⬇️ 답안지 PDF</div>
        </div>
      </div>
    );
  }

  if (tab === '지문분석 워크북') {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-lg font-black text-slate-900">📝 지문분석 툴/워크북</p>
            <p className="text-xs text-slate-400 font-medium">AI가 지문을 분석하고 워크북을 자동 생성합니다.</p>
          </div>
        </div>
        {/* 탭 */}
        <div className="flex gap-2 border-b-2 border-slate-100">
          {['✏️ 직접 입력', '📖 모의고사 지문', '📋 생성 이력'].map((t, i) => (
            <div key={t} className={`px-4 py-2 font-black text-sm rounded-t-lg ${i === 0 ? 'bg-teal-600 text-white' : 'text-slate-400'}`}>{t}</div>
          ))}
        </div>
        {/* 분석 결과 */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-teal-50 rounded-xl p-4">
            <p className="text-[10px] font-black text-teal-600 uppercase tracking-widest mb-2">주제 파악</p>
            <p className="text-sm font-bold text-slate-800">AI 기술의 발전과 사회적 영향</p>
            <p className="text-xs text-slate-500 mt-1 leading-relaxed">인공지능이 인간의 언어를 이해하고 처리하는 방식의 변화를 설명한다.</p>
          </div>
          <div className="bg-slate-50 rounded-xl p-4">
            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">핵심 어휘</p>
            <div className="flex flex-wrap gap-1">
              {['transform', 'artificial', 'dataset', 'oversight', 'capability'].map(w => (
                <span key={w} className="text-[10px] font-black bg-white border border-slate-200 px-2 py-0.5 rounded-full text-slate-700">{w}</span>
              ))}
            </div>
          </div>
          <div className="bg-blue-50 rounded-xl p-4">
            <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest mb-2">T / F 문장</p>
            <div className="space-y-1">
              <div className="flex items-start gap-1.5"><span className="text-[10px] font-black text-emerald-600 mt-0.5">T</span><p className="text-xs text-slate-700">AI systems are trained on large datasets.</p></div>
              <div className="flex items-start gap-1.5"><span className="text-[10px] font-black text-rose-500 mt-0.5">F</span><p className="text-xs text-slate-700">The technology requires no human oversight.</p></div>
            </div>
          </div>
          <div className="bg-purple-50 rounded-xl p-4">
            <p className="text-[10px] font-black text-purple-600 uppercase tracking-widest mb-2">요약</p>
            <p className="text-xs text-slate-700 leading-relaxed">AI는 언어 이해를 통해 기술 상호작용을 혁신했으나, 책임 있는 활용을 위한 감독이 필요하다.</p>
          </div>
        </div>
        <div className="flex gap-3">
          <div className="flex-1 py-3 rounded-xl font-black text-sm bg-teal-600 text-white text-center">⬇️ 워크북 PDF</div>
          <div className="flex-1 py-3 rounded-xl font-black text-sm bg-slate-700 text-white text-center">⬇️ 정답지 PDF</div>
        </div>
      </div>
    );
  }

  // 어휘 선택 문제
  return (
    <div className="space-y-4">
      <div>
        <p className="text-lg font-black text-slate-900">📌 어휘 선택 문제</p>
        <p className="text-xs text-slate-400 font-medium">핵심 어휘를 선택형 빈칸으로 자동 변환합니다.</p>
      </div>
      <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
        <p className="text-xs font-black text-purple-600 uppercase tracking-widest mb-3">생성된 어휘 선택 문제</p>
        <div className="bg-slate-50 rounded-xl p-4 text-sm text-slate-700 leading-[2.2]">
          The <span className="inline-flex items-center gap-1 mx-0.5">
            <span className="bg-purple-100 text-purple-800 font-black px-2 py-0.5 rounded text-xs border border-purple-200">development</span>
            <span className="text-slate-400 text-xs">/</span>
            <span className="bg-white text-slate-500 font-bold px-2 py-0.5 rounded text-xs border border-slate-200">destruction</span>
          </span>{' '}
          of artificial intelligence has{' '}
          <span className="inline-flex items-center gap-1 mx-0.5">
            <span className="bg-purple-100 text-purple-800 font-black px-2 py-0.5 rounded text-xs border border-purple-200">transformed</span>
            <span className="text-slate-400 text-xs">/</span>
            <span className="bg-white text-slate-500 font-bold px-2 py-0.5 rounded text-xs border border-slate-200">ignored</span>
          </span>{' '}
          the way people interact with technology, making it possible for machines to{' '}
          <span className="inline-flex items-center gap-1 mx-0.5">
            <span className="bg-purple-100 text-purple-800 font-black px-2 py-0.5 rounded text-xs border border-purple-200">understand</span>
            <span className="text-slate-400 text-xs">/</span>
            <span className="bg-white text-slate-500 font-bold px-2 py-0.5 rounded text-xs border border-slate-200">avoid</span>
          </span>{' '}
          human language.
        </div>
        <p className="text-[10px] text-slate-400 font-bold mt-2">* 굵은 보라색 = 정답 / 흰색 = 오답 선지</p>
      </div>
      <div className="flex gap-3">
        <div className="flex-1 py-3 rounded-xl font-black text-sm bg-purple-600 text-white text-center">⬇️ 문제지 PDF</div>
        <div className="flex-1 py-3 rounded-xl font-black text-sm bg-slate-700 text-white text-center">⬇️ 정답지 PDF</div>
      </div>
    </div>
  );
}

export default function LandingPageClient() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [demoTab, setDemoTab] = useState<typeof DEMO_TABS[number]>('실전 변형 문제');

  useEffect(() => {
    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setIsLoggedIn(!!session);
    };
    checkUser();
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
            지문 하나로 어법·어휘·빈칸 등 <strong className="text-slate-600">9가지 유형</strong> 변형 문제를 즉시 생성.<br />
            수능·평가원·교육청 기출 지문도 바로 선택해 사용하세요.
          </p>

          {/* 스탯 뱃지 */}
          <div className="flex flex-wrap justify-center gap-3 mb-12">
            {[
              { label: '문제 유형', value: '9가지' },
              { label: '난이도', value: 'B1 ~ C2' },
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
              title: '지문분석 툴/워크북',
              label: 'Passage Analysis',
              desc: '텍스트·이미지로 지문을 올리면 AI가 주제 파악, 핵심 어휘, T/F 문장, 구문 분석, 요약까지 워크북을 자동 생성합니다. 수능·평가원·교육청 기출 지문도 바로 선택 가능.',
              icon: '📝',
              bg: 'bg-teal-50',
              color: 'text-teal-600',
            },
            {
              title: '실전 변형 문제',
              label: 'Exam Generation',
              desc: '어법·어휘·빈칸 추론·요약·흐름·순서 배열 등 9가지 유형, 4단계 난이도(B1~C2)로 유형별 맞춤 변형 문제를 생성합니다. 대량 생성(최대 10지문)도 지원.',
              icon: '🎯',
              bg: 'bg-indigo-50',
              color: 'text-indigo-600',
            },
            {
              title: '어휘 선택 문제',
              label: 'Vocabulary Choice',
              desc: '지문에서 핵심 어휘를 자동 추출해 정답/오답 선택형 빈칸 문제를 만듭니다. 어휘 수·선지를 직접 편집 후 문제지·정답지 PDF를 즉시 출력.',
              icon: '📌',
              bg: 'bg-purple-50',
              color: 'text-purple-600',
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

          {/* 데모 탭 선택 */}
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
                {t === '지문분석 워크북' && '📝 '}
                {t === '어휘 선택 문제' && '📌 '}
                {t}
              </button>
            ))}
          </div>

          {/* 브라우저 목업 */}
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
                    🔒 conedu.ai.kr/admin/{demoTab === '실전 변형 문제' ? 'ai-questions' : demoTab === '지문분석 워크북' ? 'pdf-editor' : 'vocab-choice'}
                  </div>
                </div>

                {/* 앱 레이아웃 */}
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
                          { icon: '📝', label: '지문분석 툴/워크북', active: demoTab === '지문분석 워크북' },
                          { icon: '🎯', label: '실전 변형 문제', active: demoTab === '실전 변형 문제' },
                          { icon: '📌', label: '어휘 선택 문제', active: demoTab === '어휘 선택 문제' },
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
              AI가 만드는 수준 높은 영어 문제<br />
              <span className="text-yellow-400 italic">CON EDU</span>
            </h2>
            <p className="text-slate-400 font-medium mb-12">지금 가입하고 AI 문제 생성 서비스를 경험해보세요.</p>
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
      <footer className="max-w-7xl mx-auto px-8 py-12 border-t border-slate-100">
        <div className="flex flex-col md:flex-row justify-between items-center gap-6 text-slate-400 text-sm font-bold">
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
      </footer>
    </div>
  );
}
