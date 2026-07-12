'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

type MainTab = 'pdf' | 'ai' | 'wb';
type SubTab = 'direct' | 'image' | 'mock';

interface PricingItem { feature_key: string; cost_per_use: number; }
interface Pricing { pdfDirect: number | null; pdfMock: number | null; aiType: number | null; wb: number | null; }

// ── Helper components ──────────────────────────────────────────────────────

const STEP_COLORS = ['bg-indigo-600','bg-violet-600','bg-sky-600','bg-teal-600','bg-emerald-600','bg-amber-600','bg-rose-600'];

function StepList({ steps }: { steps: { title: string; desc: string }[] }) {
  return (
    <ol className="space-y-3">
      {steps.map((s, i) => (
        <li key={i} className="flex gap-3">
          <span className={`flex-shrink-0 w-6 h-6 rounded-full ${STEP_COLORS[i % STEP_COLORS.length]} text-white text-xs font-black flex items-center justify-center mt-0.5`}>{i + 1}</span>
          <div>
            <p className="text-sm font-black text-slate-800 dark:text-slate-100">{s.title}</p>
            {s.desc && <p className="text-xs font-bold text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">{s.desc}</p>}
          </div>
        </li>
      ))}
    </ol>
  );
}

function TipBox({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-4 flex gap-2 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-xl">
      <span className="text-base flex-shrink-0">💡</span>
      <p className="text-xs font-bold text-amber-800 dark:text-amber-300 leading-relaxed">{children}</p>
    </div>
  );
}

function ConBadge({ amount, label }: { amount: number | null; label: string }) {
  return (
    <div className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-yellow-50 dark:bg-yellow-900/30 border border-yellow-200 dark:border-yellow-700 rounded-xl">
      <span className="text-sm">⭐</span>
      <span className="text-xs font-black text-yellow-700 dark:text-yellow-400">{label}</span>
      <span className="text-xs font-black text-yellow-600 dark:text-yellow-500">{amount !== null ? `${amount} C` : '· · ·'}</span>
    </div>
  );
}

// ── Watermark ─────────────────────────────────────────────────────────────

function WatermarkOverlay() {
  return (
    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, pointerEvents: 'none', userSelect: 'none', zIndex: 50, overflow: 'hidden' }}>
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} style={{ position: 'absolute', top: `${i * 16 - 15}%`, left: '-20%', width: '160%', fontSize: '14px', fontWeight: 900, color: 'rgba(0,0,0,0.055)', transform: 'rotate(-25deg)', letterSpacing: '6px', whiteSpace: 'nowrap', fontFamily: 'Arial, sans-serif' }}>
          {'콘에듀   '.repeat(7)}
        </div>
      ))}
    </div>
  );
}

function SampleCard({ label, icon, children }: { label: string; icon: string; children: React.ReactNode }) {
  return (
    <div className="relative overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-sm">
      <div className="bg-slate-800 dark:bg-slate-900 text-white px-3 py-1.5 flex items-center gap-1.5">
        <span className="text-xs">{icon}</span>
        <span className="text-[11px] font-black">{label}</span>
      </div>
      <div className="p-3 relative" style={{ minHeight: 90 }}>
        {children}
        <WatermarkOverlay />
      </div>
    </div>
  );
}

// ── 워크북 샘플 ─────────────────────────────────────────────────────────────

function WbSample({ typeKey }: { typeKey: string }) {
  switch (typeKey) {
    case 'passage_analysis':
      return (
        <div className="text-[10px] leading-relaxed space-y-1.5">
          <div className="flex flex-wrap gap-x-3 gap-y-1 items-end">
            {[{ t:'Humans', r:'S 주어', c:'#1D4ED8', i:false },{ t:'excel', r:'V 동사', c:'#DC2626', i:false },{ t:'(at visual imagery)', r:'전치사구', c:'#475569', i:true }].map(x=>(
              <div key={x.t} className="flex flex-col items-center">
                <span style={{ color:x.c, fontWeight:700, fontStyle:x.i?'italic':'normal', borderBottom:`2px solid ${x.c}`, paddingBottom:1, fontSize:10 }}>{x.t}</span>
                <span style={{ color:x.c, fontSize:8, fontWeight:900 }}>{x.r}</span>
              </div>
            ))}
          </div>
          <div className="flex flex-wrap gap-x-3 gap-y-1 items-end">
            {[{ t:'(to create an internal model)', r:'to부정사구', c:'#C2410C', i:true }].map(x=>(
              <div key={x.t} className="flex flex-col items-center">
                <span style={{ color:x.c, fontWeight:700, fontStyle:x.i?'italic':'normal', borderBottom:`2px solid ${x.c}`, paddingBottom:1, fontSize:10 }}>{x.t}</span>
                <span style={{ color:x.c, fontSize:8, fontWeight:900 }}>{x.r}</span>
              </div>
            ))}
          </div>
        </div>
      );
    case 'passage_translation':
      return (
        <div className="text-[10px]">
          <div className="flex gap-0.5 mb-1 rounded overflow-hidden text-[9px]">
            <div className="w-3/5 bg-slate-800 text-white px-2 py-0.5 font-black">영어 지문</div>
            <div className="w-2/5 bg-slate-600 text-white px-2 py-0.5 font-black">한국어 번역</div>
          </div>
          <div className="flex gap-0.5 border border-slate-100 rounded text-[9px]">
            <div className="w-3/5 px-2 py-1 leading-relaxed">Humans excel at visual imagery, and our brains evolved this ability...</div>
            <div className="w-2/5 px-2 py-1 leading-relaxed text-slate-500">인간은 시각적 이미지 능력에서 뛰어나며, 우리의 뇌는 이 능력을...</div>
          </div>
        </div>
      );
    case 'translation':
      return (
        <div className="text-[10px] space-y-2">
          <div><p className="font-bold text-slate-700">1. Humans excel at visual imagery.</p><div className="border-b border-slate-300 mt-1 h-4" /></div>
          <div><p className="font-bold text-slate-700">2. Our brains evolved this ability.</p><div className="border-b border-slate-300 mt-1 h-4" /></div>
        </div>
      );
    case 'word_order':
      return (
        <div className="text-[10px] space-y-1.5">
          <p className="font-black text-red-600">인간은 시각적 이미지 능력에서 뛰어나다.</p>
          <p className="text-slate-500">( excel / at / Humans / imagery / visual )</p>
          <div className="flex items-end gap-1"><span className="text-slate-400 font-black text-[9px]">(1)</span><div className="flex-1 border-b border-slate-400 h-4" /></div>
        </div>
      );
    case 'english_writing':
      return (
        <div className="text-[10px] space-y-1.5">
          <p className="font-black text-slate-700">인간은 시각적 이미지 능력에서 뛰어나다.</p>
          <div className="flex items-end gap-1"><span className="text-slate-400 font-black text-[9px]">(1)</span><div className="flex-1 border-b border-slate-400 h-4" /></div>
          <p className="font-black text-slate-700">우리의 뇌는 이 능력을 발달시켰다.</p>
          <div className="flex items-end gap-1"><span className="text-slate-400 font-black text-[9px]">(2)</span><div className="flex-1 border-b border-slate-400 h-4" /></div>
        </div>
      );
    case 'vocab_choice':
      return (
        <div className="text-[10px] leading-relaxed">
          <p>Humans <span className="border border-slate-300 rounded px-0.5 text-[9px]">excel / evolve</span> at <span className="border border-slate-300 rounded px-0.5 text-[9px]">visual / vocal</span> imagery, and our brains <span className="border border-slate-300 rounded px-0.5 text-[9px]">developed / destroyed</span> this ability...</p>
          <p className="mt-1 text-[9px] text-indigo-600 font-black">정답: excel / visual / developed</p>
        </div>
      );
    case 'vocab_fill':
      return (
        <div className="text-[10px] space-y-1.5">
          <p className="leading-relaxed text-slate-700">Humans <span className="border-b border-slate-400 inline-block w-10 align-bottom">&nbsp;</span> at visual <span className="border-b border-slate-400 inline-block w-10 align-bottom">&nbsp;</span>, and our brains <span className="border-b border-slate-400 inline-block w-10 align-bottom">&nbsp;</span> this ability.</p>
          <div className="flex flex-wrap gap-1">{['excel','imagery','evolved','create','model'].map(w=><span key={w} className="px-1.5 py-0.5 bg-slate-100 rounded text-[9px] font-bold">{w}</span>)}</div>
        </div>
      );
    case 'grammar_choice':
      return (
        <div className="text-[10px] leading-relaxed space-y-1">
          <p className="font-black text-slate-700">어법상 틀린 것은?</p>
          <p className="text-[9px]">Humans ①excel at visual imagery, ②evolving this ability ③to create ④a internal mental ⑤picture.</p>
          <div className="border-b border-slate-300 h-4 w-20" />
        </div>
      );
    case 'grammar_correct':
      return (
        <div className="text-[10px] space-y-1.5">
          <p className="font-black text-slate-700">밑줄 친 부분을 바르게 고치시오.</p>
          <p className="text-[9px]">Humans <span className="underline decoration-red-400">excelling</span> at visual imagery...</p>
          <div className="flex items-end gap-1"><span className="text-slate-400 text-[9px]">→</span><div className="flex-1 border-b border-slate-400 h-4" /></div>
        </div>
      );
    case 'grammar_correct_adv':
      return (
        <div className="text-[10px] space-y-1.5">
          <p className="font-black text-slate-700">밑줄 친 부분을 어법에 맞게 고치시오.</p>
          <p className="text-[9px]">①<span className="underline decoration-red-400">Excelling</span> at imagery, ②<span className="underline decoration-red-400">our brains evolved</span>...</p>
          {['①','②'].map(n=><div key={n} className="flex items-end gap-1"><span className="text-slate-400 text-[9px] font-black">{n}</span><div className="flex-1 border-b border-slate-300 h-4" /></div>)}
        </div>
      );
    case 'combo_grammar_order':
      return (
        <div className="text-[10px] space-y-1.5">
          <p className="font-black text-slate-700">① 어법상 틀린 부분을 고치시오.</p>
          <p className="text-[9px]">Humans <span className="underline">excelling</span> at visual imagery...</p>
          <div className="flex items-end gap-1"><span className="text-slate-400 text-[9px]">→</span><div className="flex-1 border-b border-slate-300 h-4" /></div>
          <p className="font-black text-slate-700">② 다음 어구를 배열하시오.</p>
          <p className="text-slate-500 text-[9px]">( our / ability / this / evolved )</p>
          <div className="border-b border-slate-300 h-4" />
        </div>
      );
    case 'combo_vocab_fill':
      return (
        <div className="text-[10px] space-y-1.5">
          <p className="font-black text-slate-700">① 빈칸에 알맞은 어휘를 쓰시오.</p>
          <p className="text-[9px]">Humans <span className="border-b border-slate-400 inline-block w-10 align-bottom">&nbsp;</span> at visual imagery...</p>
          <p className="font-black text-slate-700">② 다음 문장을 영작하시오.</p>
          <p className="text-[9px] text-slate-500">우리의 뇌는 이 능력을 발달시켰다.</p>
          <div className="border-b border-slate-300 h-4" />
        </div>
      );
    case 'summary_sentence':
      return (
        <div className="text-[10px] space-y-1.5">
          <p className="font-black text-slate-700">다음 요약문의 빈칸을 채우시오.</p>
          <p className="text-[9px] bg-slate-50 p-1 rounded text-slate-500 italic leading-relaxed">Humans excel at visual imagery. Our brains evolved...</p>
          <p className="text-[9px]">Human brains have <span className="border-b border-slate-400 inline-block w-10 align-bottom">&nbsp;</span> the ability to <span className="border-b border-slate-400 inline-block w-10 align-bottom">&nbsp;</span> mental models.</p>
        </div>
      );
    default:
      return <p className="text-[10px] text-slate-400">예시 준비 중</p>;
  }
}

// ── AI 문제 샘플 ────────────────────────────────────────────────────────────

function AiSample({ typeKey }: { typeKey: string }) {
  switch (typeKey) {
    case 'topic_title':
      return (
        <div className="text-[10px] space-y-1.5">
          <p className="font-black text-slate-700">다음 글의 주제로 가장 적절한 것은?</p>
          <p className="text-slate-400 text-[9px] italic leading-relaxed">Humans excel at visual imagery. Our brains evolved this ability to create an internal model of the world...</p>
          <div className="space-y-0.5 text-[9px]">{['① 시각 이미지의 진화적 역할','② 정신 모델의 위험성','③ 뇌 영상 연구 동향','④ 상상력과 실제 경험의 차이','⑤ 기억력 향상을 위한 시각화'].map((o,i)=><p key={i} className={i===0?'font-black text-indigo-600':'text-slate-500'}>{o}</p>)}</div>
        </div>
      );
    case 'grammar':
      return (
        <div className="text-[10px] space-y-1.5">
          <p className="font-black text-slate-700">밑줄 친 부분 중 어법상 틀린 것은?</p>
          <p className="text-[9px] leading-relaxed">Humans ①<span className="underline">excel</span> at visual imagery, ②<span className="underline">evolving</span> this ability ③<span className="underline decoration-red-500">to created</span> ④<span className="underline">a</span> internal ⑤<span className="underline">picture</span>.</p>
          <div className="border-b border-slate-300 h-4 w-20" />
        </div>
      );
    case 'vocab_paraphrase':
      return (
        <div className="text-[10px] space-y-1.5">
          <p className="font-black text-slate-700">밑줄 친 낱말의 쓰임이 부적절한 것은?</p>
          <p className="text-[9px] leading-relaxed">Humans ①<span className="underline">excel</span> at visual ②<span className="underline">imagery</span>. Our brains ③<span className="underline">destroyed</span> this ability ④<span className="underline">to create</span> internal ⑤<span className="underline">models</span>.</p>
          <p className="text-[9px] font-black text-red-500">③ → evolved (정답)</p>
        </div>
      );
    case 'vocab_blank':
      return (
        <div className="text-[10px] space-y-1.5">
          <p className="font-black text-slate-700">빈칸 (A), (B)에 들어갈 말로 알맞은 것은?</p>
          <p className="text-[9px] leading-relaxed">Our brains (A)<span className="border-b border-slate-400 inline-block w-8 align-bottom">&nbsp;</span> this ability to create an internal (B)<span className="border-b border-slate-400 inline-block w-8 align-bottom">&nbsp;</span> of the world.</p>
          <div className="grid grid-cols-2 gap-0.5 text-[9px]"><span className="font-black text-indigo-600">① evolved – model</span><span className="text-slate-500">② created – picture</span><span className="text-slate-500">③ lost – image</span><span className="text-slate-500">④ built – scheme</span></div>
        </div>
      );
    case 'fill_blank':
      return (
        <div className="text-[10px] space-y-1.5">
          <p className="font-black text-slate-700">다음 빈칸에 들어갈 말로 가장 적절한 것은?</p>
          <p className="text-[9px] leading-relaxed">Our brains evolved the ability to <span className="border-b-2 border-slate-400 inline-block w-12 align-bottom">&nbsp;</span> an internal mental model of the world without real risks.</p>
          <div className="flex flex-wrap gap-1 text-[9px]">{['① create','② destroy','③ remember','④ share','⑤ evaluate'].map((o,i)=><span key={i} className={i===0?'font-black text-indigo-600':'text-slate-500'}>{o}</span>)}</div>
        </div>
      );
    case 'summary':
      return (
        <div className="text-[10px] space-y-1.5">
          <p className="font-black text-slate-700">다음 글의 내용을 요약할 때 (A), (B)에 올 말로 알맞은 것은?</p>
          <p className="text-[9px] bg-slate-50 p-1 rounded leading-relaxed">Human brains have (A)<span className="border-b border-slate-400 inline-block w-8 align-bottom">&nbsp;</span> the ability to (B)<span className="border-b border-slate-400 inline-block w-8 align-bottom">&nbsp;</span> internal mental representations.</p>
          <div className="grid grid-cols-2 gap-0.5 text-[9px]"><span className="font-black text-indigo-600">① evolved – simulate</span><span className="text-slate-500">② lost – create</span><span className="text-slate-500">③ enhanced – destroy</span><span className="text-slate-500">④ preserved – imagine</span></div>
        </div>
      );
    case 'flow':
      return (
        <div className="text-[10px] space-y-1">
          <p className="font-black text-slate-700">글의 흐름과 관계없는 문장은?</p>
          <div className="text-[9px] space-y-0.5">
            <p>① Humans excel at visual imagery.</p>
            <p>② Our brains evolved this ability.</p>
            <p className="line-through text-red-500 font-bold">③ Fish have excellent memory.</p>
            <p>④ Evolution kept models imperfect.</p>
            <p>⑤ This is a wise self-restraint.</p>
          </div>
        </div>
      );
    case 'phrase_meaning':
      return (
        <div className="text-[10px] space-y-1.5">
          <p className="font-black text-slate-700">밑줄 친 "without the risks"의 의미로 가장 적절한 것은?</p>
          <p className="text-[9px] italic text-slate-500 leading-relaxed">...rehearse actions <span className="underline font-bold text-slate-700">without the risks</span> or penalties of doing them in the real world...</p>
          <div className="space-y-0.5 text-[9px]">{['① 위험을 감수하며','② 실제 위험 없이','③ 안전하게 분석하여','④ 처벌을 피하며','⑤ 미래를 예측하며'].map((o,i)=><p key={i} className={i===1?'font-black text-indigo-600':'text-slate-500'}>{o}</p>)}</div>
        </div>
      );
    case 'sentence_order':
      return (
        <div className="text-[10px] space-y-1.5">
          <p className="font-black text-slate-700">글의 순서로 가장 적절한 것은?</p>
          <div className="text-[9px] space-y-1"><p><span className="font-black">(A)</span> Our brains evolved this ability to create an internal model.</p><p><span className="font-black">(B)</span> There are hints from brain-imaging studies.</p><p><span className="font-black">(C)</span> But evolution kept the models imperfect.</p></div>
          <div className="flex flex-wrap gap-1 text-[9px]">{['① (A)-(C)-(B)','② (B)-(A)-(C)','③ (B)-(C)-(A)','④ (C)-(A)-(B)','⑤ (C)-(B)-(A)'].map((o,i)=><span key={i} className={i===0?'font-black text-indigo-600':'text-slate-500'}>{o}</span>)}</div>
        </div>
      );
    default:
      return <p className="text-[10px] text-slate-400">예시 준비 중</p>;
  }
}

// ── 가이드 콘텐츠 데이터 ────────────────────────────────────────────────────

const PDF_GUIDES: Record<SubTab, { title: string; steps: { title: string; desc: string }[]; tips: string }> = {
  direct: {
    title: '텍스트 직접 입력',
    steps: [
      { title: '지문분석 메뉴 클릭', desc: '좌측 메뉴에서 AI 문제 생성 → 지문분석을 선택합니다.' },
      { title: '직접 입력 탭 확인', desc: '\'직접 입력\' 탭이 기본 선택되어 있습니다.' },
      { title: '지문 입력', desc: '영어 지문을 텍스트 입력창에 붙여넣거나 직접 타이핑합니다. 50자 이상이어야 합니다.' },
      { title: '유형·난이도 선택', desc: '변형 지문 유형(파라프레이징 등)과 난이도(B1~C2)를 선택합니다.' },
      { title: '\'AI로 분석하기\' 클릭', desc: '버튼 위에 차감 예정 CON이 표시됩니다. 클릭 후 10~20초 정도 소요됩니다.' },
      { title: '결과 확인 및 편집', desc: '변형 지문, T/F, 어휘 목록, 요약 등이 생성됩니다. 인라인 편집이 가능합니다.' },
      { title: 'PDF 저장', desc: '\'PDF 저장\' 버튼으로 출력용 파일을 다운로드합니다.' },
    ],
    tips: '지문이 짧을수록 빠르게 생성됩니다. 수능/모의고사 길이(200~300 단어)를 권장합니다.',
  },
  image: {
    title: '사진·이미지 등록 (OCR)',
    steps: [
      { title: '이미지 모드로 전환', desc: '직접 입력 탭에서 텍스트 입력창 우측 상단의 카메라 아이콘을 클릭합니다.' },
      { title: '이미지 업로드', desc: '교재·시험지 사진을 드래그앤드롭하거나 클릭해서 업로드합니다. JPG·PNG·PDF 지원.' },
      { title: 'OCR 자동 실행', desc: '이미지가 업로드되면 AI가 자동으로 텍스트를 추출합니다 (5~15초 소요).' },
      { title: '추출 텍스트 확인', desc: '추출된 텍스트를 검토하고 오인식된 부분이 있다면 수정합니다.' },
      { title: '유형·난이도 선택 후 생성', desc: '이후 과정은 직접 입력과 동일합니다.' },
    ],
    tips: '사진이 선명하고 텍스트가 수평일수록 OCR 정확도가 높아집니다. 흑백 고대비 이미지를 권장합니다.',
  },
  mock: {
    title: '모의고사 지문 선택',
    steps: [
      { title: '모의고사 탭 클릭', desc: '페이지 상단의 \'모의고사\' 탭을 선택합니다.' },
      { title: '연도·학년·시행처 선택', desc: '원하는 시험의 연도, 학년(고1~고3), 시행처(수능·학평 등)를 선택합니다.' },
      { title: '문항 번호 선택', desc: 'DB에서 지문을 불러온 후 원하는 번호를 클릭합니다. 다중 선택도 가능합니다.' },
      { title: '지문 미리보기 확인', desc: '선택한 번호의 원문 지문을 우측에서 확인할 수 있습니다.' },
      { title: '유형·난이도 선택 후 생성', desc: '다중 선택 시 지문별로 순차 생성됩니다. 버튼 위에 총 차감 예정 CON이 표시됩니다.' },
    ],
    tips: '다중 지문 선택 시 생성 시간이 지문 수에 비례합니다. 처음엔 1개씩 테스트해보세요.',
  },
};

const AI_GUIDES: Record<SubTab, { title: string; steps: { title: string; desc: string }[]; tips: string }> = {
  direct: {
    title: '텍스트 직접 입력',
    steps: [
      { title: '실전 변형 문제 메뉴 클릭', desc: '좌측 메뉴에서 AI 문제 생성 → 실전 변형 문제를 선택합니다.' },
      { title: '지문 입력', desc: '하나 또는 여러 개의 지문을 입력합니다. 지문 추가 버튼으로 다중 지문 처리가 가능합니다.' },
      { title: '유형 선택', desc: '슈퍼어드민이 활성화한 유형만 표시됩니다. 원하는 유형을 체크합니다.' },
      { title: '난이도·문항 수 설정', desc: '각 유형마다 난이도(B1~C2)와 문항 수(1~3)를 개별 조정할 수 있습니다.' },
      { title: '\'AI 문제 생성하기\' 클릭', desc: '지문 수×유형별 CON 합산 금액이 버튼 위에 표시됩니다.' },
      { title: '결과 확인 및 PDF 저장', desc: '생성된 문제를 확인하고 인라인 편집 후 PDF로 저장합니다.' },
    ],
    tips: '유형을 많이 선택할수록 CON 차감이 늘어납니다. 처음엔 2~3개 유형부터 시작하는 것을 권장합니다.',
  },
  image: {
    title: '사진·이미지 등록 (OCR)',
    steps: [
      { title: '이미지 모드로 전환', desc: '직접 입력 탭에서 텍스트 입력창 우측 상단의 카메라 아이콘을 클릭합니다.' },
      { title: '이미지 업로드', desc: '교재·시험지 사진을 드래그앤드롭하거나 클릭해서 업로드합니다.' },
      { title: 'OCR 자동 실행', desc: 'AI가 이미지에서 텍스트를 자동 추출합니다 (5~15초 소요).' },
      { title: '추출 텍스트 확인 및 수정', desc: '오인식된 부분을 직접 수정할 수 있습니다.' },
      { title: '유형 선택 후 생성', desc: '이후 과정은 직접 입력과 동일합니다.' },
    ],
    tips: '여러 지문을 동시에 처리할 때 각 지문마다 이미지를 업로드하면 OCR이 순차 처리됩니다.',
  },
  mock: {
    title: '모의고사 지문 선택',
    steps: [
      { title: '모의고사 탭 클릭', desc: '페이지 상단의 \'모의고사\' 탭을 선택합니다.' },
      { title: '연도·학년·시행처 선택', desc: '원하는 시험의 연도, 학년, 시행처를 선택합니다.' },
      { title: '문항 번호 선택', desc: '원하는 번호를 클릭합니다. 여러 번호를 동시에 선택할 수 있습니다.' },
      { title: '유형 선택', desc: '원하는 유형을 체크하고 난이도·문항 수를 설정합니다.' },
      { title: 'PDF 배치 방식 선택', desc: '지문별 / 유형별 / 무작위 중 하나를 선택합니다.' },
      { title: '\'AI 문제 생성하기\' 클릭', desc: '지문별로 순차 생성됩니다. 총 차감 예정 CON이 버튼 위에 표시됩니다.' },
    ],
    tips: 'PDF 배치를 \'유형별\'로 설정하면 같은 유형 문제끼리 모아서 출력할 수 있어 유형별 시험지 제작에 유용합니다.',
  },
};

const WB_GUIDES: Record<SubTab, { title: string; steps: { title: string; desc: string }[]; tips: string }> = {
  direct: {
    title: '텍스트 직접 입력',
    steps: [
      { title: '워크북 메뉴 클릭', desc: '좌측 메뉴에서 워크북을 선택합니다.' },
      { title: '직접 입력 탭 확인', desc: '\'직접 입력\' 탭이 기본 선택되어 있습니다.' },
      { title: '지문 입력', desc: '영어 지문을 텍스트 입력창에 붙여넣거나 직접 타이핑합니다. 여러 지문을 동시에 입력할 수 있습니다.' },
      { title: '유형 선택', desc: '생성할 워크북 유형을 선택합니다. 슈퍼어드민이 활성화한 유형만 표시됩니다.' },
      { title: '난이도 선택', desc: '지문 수준에 맞는 난이도(B1~C2)를 선택합니다.' },
      { title: '\'워크북 생성하기\' 클릭', desc: '지문 수×유형 수만큼 CON이 차감됩니다. 생성 중 진행 상황이 실시간으로 표시됩니다.' },
      { title: 'PDF 다운로드', desc: '문제지 PDF와 정답지 PDF를 각각 다운로드합니다. 배치 방식(지문별/유형별/무작위)을 선택할 수 있습니다.' },
    ],
    tips: '유형을 여러 개 선택하면 하나의 지문으로 다양한 유형의 워크북을 한 번에 생성할 수 있습니다.',
  },
  image: {
    title: '사진·이미지 등록 (OCR)',
    steps: [
      { title: '이미지 모드로 전환', desc: '직접 입력 탭에서 텍스트 입력창 우측 상단의 카메라 아이콘을 클릭합니다.' },
      { title: '이미지 업로드', desc: '교재·시험지 사진을 드래그앤드롭하거나 클릭해서 업로드합니다. JPG·PNG·PDF 지원.' },
      { title: 'OCR 자동 실행', desc: 'AI가 이미지에서 텍스트를 자동 추출합니다 (5~15초 소요).' },
      { title: '추출 텍스트 확인', desc: '추출된 텍스트를 검토하고 오인식된 부분이 있다면 수정합니다.' },
      { title: '유형·난이도 선택 후 생성', desc: '이후 과정은 직접 입력과 동일합니다.' },
    ],
    tips: '사진이 선명하고 텍스트가 수평일수록 OCR 정확도가 높아집니다.',
  },
  mock: {
    title: '모의고사 지문 선택',
    steps: [
      { title: '모의고사 탭 클릭', desc: '페이지 상단의 \'모의고사\' 탭을 선택합니다.' },
      { title: '연도·학년·시행처 선택', desc: '원하는 시험의 연도, 학년(고1~고3), 시행처(수능·학평 등)를 선택합니다.' },
      { title: '문항 번호 선택', desc: 'DB에서 지문을 불러온 후 원하는 번호를 클릭합니다. 다중 선택도 가능합니다.' },
      { title: '유형·난이도 선택', desc: '생성할 워크북 유형과 난이도를 선택합니다.' },
      { title: '\'워크북 생성하기\' 클릭', desc: '선택한 모든 지문에 대해 워크북이 일괄 생성됩니다.' },
    ],
    tips: '기출 지문으로 워크북을 만들면 수능 대비 자료로 바로 활용할 수 있습니다.',
  },
};

// ── 유형 메타데이터 ──────────────────────────────────────────────────────────

const AI_TYPE_INFO: Record<string, { label: string; icon: string }> = {
  topic_title:      { label: '주제/제목 유형',     icon: '💬' },
  grammar:          { label: '어법 유형',          icon: '✏️' },
  vocab_paraphrase: { label: '어휘 낱말 쓰임',     icon: '📖' },
  vocab_blank:      { label: '어휘 (a)(b) 빈칸',  icon: '🔤' },
  fill_blank:       { label: '빈칸 추론 유형',     icon: '🔲' },
  summary:          { label: '요약문 완성 유형',   icon: '📋' },
  flow:             { label: '흐름 유형',          icon: '🌊' },
  phrase_meaning:   { label: '어구 의미 추론',     icon: '🔍' },
  sentence_order:   { label: '순서 배열 유형',     icon: '🔀' },
};

const WB_TYPE_INFO: Record<string, { label: string; icon: string }> = {
  passage_analysis:    { label: '지문 구문분석',      icon: '🔬' },
  passage_translation: { label: '지문 해석지',        icon: '📄' },
  translation:         { label: '문장 해석',          icon: '🇰🇷' },
  word_order:          { label: '단어 배열',          icon: '🔀' },
  english_writing:     { label: '영작 하기',          icon: '✍️' },
  vocab_choice:        { label: '어휘 고르기',        icon: '📝' },
  vocab_fill:          { label: '어휘 채우기',        icon: '📝' },
  grammar_choice:      { label: '어법 고르기',        icon: '✏️' },
  grammar_correct:     { label: '어법 고치기',        icon: '✏️' },
  grammar_correct_adv: { label: '어법 고치기(심화)', icon: '✏️' },
  combo_grammar_order: { label: '어법 서술형',        icon: '📋' },
  combo_vocab_fill:    { label: '영작 서술형',        icon: '📋' },
  summary_sentence:    { label: '요약문 서술형',      icon: '📋' },
};

const MAIN_TABS = [
  { key: 'pdf' as MainTab, label: '지문분석',       icon: '📝', href: '/admin/pdf-editor',   color: 'bg-teal-600' },
  { key: 'ai'  as MainTab, label: '실전 변형 문제', icon: '🎯', href: '/admin/ai-questions', color: 'bg-indigo-600' },
  { key: 'wb'  as MainTab, label: '워크북',         icon: '📌', href: '/admin/vocab-choice', color: 'bg-violet-600' },
];

const SUB_TABS = [
  { key: 'direct' as SubTab, label: '직접 입력', icon: '⌨️' },
  { key: 'image'  as SubTab, label: '사진 등록', icon: '📷' },
  { key: 'mock'   as SubTab, label: '모의고사',  icon: '📚' },
];

function conAmount(pricing: Pricing, mainTab: MainTab, subTab: SubTab): number | null {
  if (mainTab === 'pdf') return subTab === 'mock' ? pricing.pdfMock : pricing.pdfDirect;
  if (mainTab === 'wb') return pricing.wb;
  return pricing.aiType;
}

// ── 지문분석 복합 샘플 ──────────────────────────────────────────────────────

function PdfEditorSample() {
  return (
    <div className="grid grid-cols-1 gap-3">
      <SampleCard label="변형 지문 (파라프레이징)" icon="📝">
        <p className="text-[10px] leading-relaxed text-slate-600">People are remarkably skilled at creating mental images. Human neural structures developed this capacity to construct an internal map or representation of reality, enabling us to practice upcoming activities without experiencing actual dangers...</p>
      </SampleCard>
      <div className="grid grid-cols-2 gap-3">
        <SampleCard label="어휘 목록" icon="📚">
          <table className="w-full text-[9px]">
            <thead><tr className="bg-slate-100"><th className="px-1 py-0.5 text-left font-black">단어</th><th className="px-1 py-0.5 text-left font-black">뜻</th><th className="px-1 py-0.5 text-left font-black">유의어</th></tr></thead>
            <tbody>{[['excel','뛰어나다','surpass'],['imagery','심상','visualization'],['evolve','발달하다','develop']].map(([w,m,s])=><tr key={w} className="border-b border-slate-100"><td className="px-1 py-0.5 font-bold">{w}</td><td className="px-1 py-0.5 text-slate-500">{m}</td><td className="px-1 py-0.5 text-slate-400">{s}</td></tr>)}</tbody>
          </table>
        </SampleCard>
        <SampleCard label="T/F 문장" icon="✅">
          <div className="space-y-1.5 text-[10px]">
            {[['인간은 시각적 이미지에 능숙하다.','T'],['뇌는 이 능력을 잃어버렸다.','F'],['내적 모델은 완벽하게 설계되었다.','F']].map(([s,a])=>(
              <div key={s} className="flex items-start gap-1.5">
                <span className={`flex-shrink-0 text-[9px] font-black px-1 rounded ${a==='T'?'bg-emerald-100 text-emerald-700':'bg-red-100 text-red-600'}`}>{a}</span>
                <span className="text-slate-600 text-[9px]">{s}</span>
              </div>
            ))}
          </div>
        </SampleCard>
      </div>
      <SampleCard label="한 문장 요약" icon="📋">
        <div className="text-[10px] space-y-1">
          <p className="font-black text-slate-700 text-[9px]">영문 요약</p>
          <p className="text-slate-600 leading-relaxed">Humans excel at visual imagery because their brains evolved to create internal models of the world, though evolution ensured these models remain imperfect.</p>
          <p className="font-black text-slate-700 text-[9px] mt-1">국문 요약</p>
          <p className="text-slate-500 leading-relaxed text-[9px]">인간의 뇌는 세계의 내적 모델을 만들기 위해 진화했으며, 진화는 이 모델이 불완전하게 유지되도록 했다.</p>
        </div>
      </SampleCard>
    </div>
  );
}

// ── Main page ────────────────────────────────────────────────────────────────

export default function GuidePage() {
  const [mainTab, setMainTab] = useState<MainTab>('pdf');
  const [subTab, setSubTab] = useState<SubTab>('direct');
  const [pricing, setPricing] = useState<Pricing>({ pdfDirect: null, pdfMock: null, aiType: null, wb: null });
  const [activeAiTypes, setActiveAiTypes] = useState<string[]>([]);
  const [activeWbTypes, setActiveWbTypes] = useState<string[]>([]);

  useEffect(() => {
    fetch('/api/credits/pricing')
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        const items: PricingItem[] = data?.pricing ?? [];
        const p: Partial<Pricing> = {};
        const aiTypes: string[] = [];
        const wbTypes: string[] = [];

        items.forEach(item => {
          if (item.feature_key === 'pdf_analysis_direct') p.pdfDirect = item.cost_per_use;
          else if (item.feature_key === 'pdf_analysis_mock') p.pdfMock = item.cost_per_use;
          else if (item.feature_key === 'pdf_analysis' && p.pdfDirect === undefined) p.pdfDirect = item.cost_per_use;
          else if (item.feature_key.startsWith('ai_type_')) {
            if (p.aiType === undefined) p.aiType = item.cost_per_use;
            aiTypes.push(item.feature_key.replace('ai_type_', ''));
          } else if (item.feature_key.startsWith('wb_direct_')) {
            if (p.wb === undefined) p.wb = item.cost_per_use;
            wbTypes.push(item.feature_key.replace('wb_direct_', ''));
          }
        });

        setPricing(prev => ({ ...prev, ...p }));
        // preserve order from AI_TYPE_INFO
        setActiveAiTypes(Object.keys(AI_TYPE_INFO).filter(k => aiTypes.includes(k)));
        // preserve order from WB_TYPE_INFO
        setActiveWbTypes(Object.keys(WB_TYPE_INFO).filter(k => wbTypes.includes(k)));
      })
      .catch(() => {});
  }, []);

  const guide = mainTab === 'pdf' ? PDF_GUIDES[subTab] : mainTab === 'ai' ? AI_GUIDES[subTab] : WB_GUIDES[subTab];
  const activeMain = MAIN_TABS.find(t => t.key === mainTab)!;
  const conLabel = mainTab === 'pdf' ? '지문 1개당' : mainTab === 'wb' ? '유형 1개당' : '유형 1개당';

  const conTable = [
    { icon: '📝', label: '지문분석 직접 입력', amount: pricing.pdfDirect },
    { icon: '📝', label: '지문분석 모의고사',  amount: pricing.pdfMock },
    { icon: '🎯', label: '실전변형 유형 1개',  amount: pricing.aiType },
    { icon: '📌', label: '워크북 유형 1개',    amount: pricing.wb },
  ];

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-10">
      {/* 헤더 */}
      <div>
        <h1 className="text-2xl font-black text-slate-900 dark:text-white">📖 이용 가이드</h1>
        <p className="text-sm font-bold text-slate-500 dark:text-slate-400 mt-1">AI 문제 생성 기능 사용 방법을 안내합니다</p>
      </div>

      {/* 메인 탭 */}
      <div className="flex gap-2">
        {MAIN_TABS.map(t => (
          <button
            key={t.key}
            onClick={() => { setMainTab(t.key); setSubTab('direct'); }}
            className={`flex-1 flex items-center justify-center gap-2 py-3.5 rounded-2xl font-black text-sm transition-all border-2 ${
              mainTab === t.key
                ? `${t.color} text-white border-transparent shadow-lg`
                : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-slate-300'
            }`}
          >
            <span className="text-base">{t.icon}</span>
            {t.label}
          </button>
        ))}
      </div>

      {/* 이용 방법 카드 */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 overflow-hidden">
        {/* 서브 탭 */}
        <div className="flex border-b border-slate-100 dark:border-slate-800">
          {SUB_TABS.map(t => (
            <button
              key={t.key}
              onClick={() => setSubTab(t.key)}
              className={`flex-1 py-3 text-xs font-black transition-all border-b-2 ${
                subTab === t.key
                  ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/20'
                  : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
              }`}
            >
              <span className="mr-1">{t.icon}</span>{t.label}
            </button>
          ))}
        </div>

        {/* 콘텐츠 */}
        <div className="p-6 space-y-5">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <h2 className="text-base font-black text-slate-800 dark:text-slate-100">
              {activeMain.icon} {activeMain.label} — {guide.title}
            </h2>
            <ConBadge amount={conAmount(pricing, mainTab, subTab)} label={conLabel} />
          </div>
          <StepList steps={guide.steps} />
          <TipBox>{guide.tips}</TipBox>
        </div>
      </div>

      {/* 결과물 예시 */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-black text-slate-800 dark:text-slate-100">🖼 결과물 예시</h3>
          <span className="text-[11px] font-bold text-slate-400 dark:text-slate-500">활성화된 유형만 표시됩니다</span>
        </div>

        {mainTab === 'pdf' && <PdfEditorSample />}

        {mainTab === 'ai' && (
          activeAiTypes.length > 0 ? (
            <div className="grid grid-cols-2 gap-3">
              {activeAiTypes.map(key => {
                const info = AI_TYPE_INFO[key];
                if (!info) return null;
                return (
                  <SampleCard key={key} label={info.label} icon={info.icon}>
                    <AiSample typeKey={key} />
                  </SampleCard>
                );
              })}
            </div>
          ) : (
            <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-6 text-center text-sm font-bold text-slate-400">활성화된 유형이 없습니다.</div>
          )
        )}

        {mainTab === 'wb' && (
          activeWbTypes.length > 0 ? (
            <div className="grid grid-cols-2 gap-3">
              {activeWbTypes.map(key => {
                const info = WB_TYPE_INFO[key];
                if (!info) return null;
                return (
                  <SampleCard key={key} label={info.label} icon={info.icon}>
                    <WbSample typeKey={key} />
                  </SampleCard>
                );
              })}
            </div>
          ) : (
            <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-6 text-center text-sm font-bold text-slate-400">활성화된 유형이 없습니다. 슈퍼어드민에게 워크북 유형 활성화를 요청하세요.</div>
          )
        )}
      </div>

      {/* 바로가기 버튼 */}
      <Link
        href={activeMain.href}
        className={`block py-3.5 rounded-2xl text-center text-sm font-black text-white transition-all ${activeMain.color} hover:opacity-90 shadow-md`}
      >
        {activeMain.icon} {activeMain.label} 바로가기
      </Link>

      {/* CON 안내 */}
      <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700 rounded-2xl p-5 space-y-3">
        <h3 className="text-sm font-black text-yellow-800 dark:text-yellow-300">⭐ CON(크레딧) 안내</h3>
        <div className="grid grid-cols-2 gap-2">
          {conTable.map(item => (
            <div key={item.label} className="flex items-center justify-between bg-white dark:bg-slate-800 rounded-xl px-3 py-2 border border-yellow-100 dark:border-yellow-800">
              <span className="text-xs font-bold text-slate-600 dark:text-slate-300">{item.icon} {item.label}</span>
              <span className="text-xs font-black text-yellow-600 dark:text-yellow-400">{item.amount !== null ? `${item.amount} C` : '· · ·'}</span>
            </div>
          ))}
        </div>
        <p className="text-xs font-bold text-yellow-700 dark:text-yellow-400">
          CON이 부족하면 슈퍼어드민에게 충전을 요청하거나, 메뉴 하단의 CON 사용 이력에서 잔액을 확인하세요.
        </p>
      </div>

      {/* FAQ */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 p-5 space-y-4">
        <h3 className="text-sm font-black text-slate-800 dark:text-slate-100">❓ 자주 묻는 질문</h3>
        {[
          { q: '생성 중 오류가 발생했을 때 CON이 차감되나요?', a: '생성에 실패한 경우 CON이 차감되지 않습니다.' },
          { q: '생성된 문제를 수정할 수 있나요?', a: '결과 화면에서 직접 클릭하여 인라인 편집이 가능합니다. 편집 후 PDF로 저장하세요.' },
          { q: '워크북 PDF를 여러 유형이 섞인 형태로 출력할 수 있나요?', a: '워크북 PDF 다운로드 시 지문별 / 유형별 / 무작위 배치 방식을 선택할 수 있습니다.' },
          { q: '모의고사 DB에 원하는 지문이 없어요.', a: '직접 입력 또는 사진 등록으로 지문을 추가하거나, 슈퍼어드민에게 문의해 주세요.' },
          { q: 'OCR 인식이 정확하지 않아요.', a: '고해상도 이미지 사용, 텍스트를 수평으로 맞추면 인식 정확도가 높아집니다.' },
          { q: '워크북에서 유형이 보이지 않아요.', a: '슈퍼어드민이 해당 유형을 비활성화 상태로 설정한 경우 목록에 표시되지 않습니다. 활성화 요청을 하세요.' },
        ].map((faq, i) => (
          <div key={i} className="space-y-1">
            <p className="text-xs font-black text-indigo-600 dark:text-indigo-400">Q. {faq.q}</p>
            <p className="text-xs font-bold text-slate-600 dark:text-slate-400 pl-3">A. {faq.a}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
