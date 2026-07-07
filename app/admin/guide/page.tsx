'use client';

import { useState } from 'react';
import Link from 'next/link';

type MainTab = 'pdf' | 'ai';
type SubTab = 'direct' | 'image' | 'mock';

const STEP_COLORS = [
  'bg-indigo-600', 'bg-violet-600', 'bg-sky-600',
  'bg-teal-600', 'bg-emerald-600', 'bg-amber-600', 'bg-rose-600',
];

function StepList({ steps }: { steps: { title: string; desc: string }[] }) {
  return (
    <ol className="space-y-3">
      {steps.map((s, i) => (
        <li key={i} className="flex gap-3">
          <span className={`flex-shrink-0 w-6 h-6 rounded-full ${STEP_COLORS[i % STEP_COLORS.length]} text-white text-xs font-black flex items-center justify-center mt-0.5`}>
            {i + 1}
          </span>
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

function ConBadge({ amount, label }: { amount: number; label: string }) {
  return (
    <div className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-yellow-50 dark:bg-yellow-900/30 border border-yellow-200 dark:border-yellow-700 rounded-xl">
      <span className="text-sm">⭐</span>
      <span className="text-xs font-black text-yellow-700 dark:text-yellow-400">{label}</span>
      <span className="text-xs font-black text-yellow-600 dark:text-yellow-500">{amount} CON</span>
    </div>
  );
}

// ── 지문분석 가이드 콘텐츠 ─────────────────────────────────────────────
const PDF_GUIDES: Record<SubTab, {
  title: string;
  steps: { title: string; desc: string }[];
  tips: string;
  con: { amount: number; label: string };
}> = {
  direct: {
    title: '텍스트 직접 입력',
    steps: [
      { title: '지문분석 메뉴 클릭', desc: '좌측 메뉴에서 AI 문제 생성 → 지문분석을 선택합니다.' },
      { title: '직접 입력 탭 확인', desc: '페이지 상단에 \'직접 입력\' 탭이 기본 선택되어 있습니다.' },
      { title: '지문 입력', desc: '영어 지문을 텍스트 입력창에 붙여넣거나 직접 타이핑합니다. 50자 이상이어야 합니다.' },
      { title: '유형·난이도 선택', desc: '변형 지문 유형(파라프레이징 등)과 난이도(B1~C2)를 선택합니다.' },
      { title: '\'AI로 문제 생성하기\' 클릭', desc: '버튼 위에 차감 예정 CON이 표시됩니다. 클릭 후 10~20초 정도 소요됩니다.' },
      { title: '결과 확인 및 편집', desc: '변형 지문, T/F, 순서배열, 빈칸 등 문제가 생성됩니다. 인라인 편집이 가능합니다.' },
      { title: 'PDF 저장', desc: '\'PDF 저장\' 버튼으로 출력용 파일을 다운로드합니다.' },
    ],
    tips: '지문이 짧을수록 빠르게 생성됩니다. 수능/모의고사 길이(200~300 단어)를 권장합니다.',
    con: { amount: 50, label: '지문 1개당' },
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
    con: { amount: 50, label: '지문 1개당' },
  },
  mock: {
    title: '모의고사 지문 선택',
    steps: [
      { title: '모의고사 탭 클릭', desc: '페이지 상단의 \'모의고사\' 탭을 선택합니다.' },
      { title: '연도·학년·시행처 선택', desc: '원하는 시험의 연도, 학년(고1~고3), 시행처(수능·학평 등)를 선택합니다.' },
      { title: '문항 번호 선택', desc: 'DB에서 지문을 불러온 후 원하는 번호를 클릭합니다. 다중 선택도 가능합니다.' },
      { title: '지문 미리보기 확인', desc: '선택한 번호의 원문 지문을 우측에서 확인할 수 있습니다.' },
      { title: '유형·난이도 선택 후 생성', desc: '다중 선택 시 지문별로 순차 생성됩니다. 지문 수×50 CON이 차감됩니다.' },
    ],
    tips: '다중 지문 선택 시 생성 시간이 지문 수에 비례합니다. 처음엔 1개씩 테스트해보세요.',
    con: { amount: 50, label: '지문 1개당' },
  },
};

// ── 실전 변형 문제 가이드 콘텐츠 ────────────────────────────────────────
const AI_GUIDES: Record<SubTab, {
  title: string;
  steps: { title: string; desc: string }[];
  tips: string;
  con: { amount: number; label: string };
}> = {
  direct: {
    title: '텍스트 직접 입력',
    steps: [
      { title: '실전 변형 문제 메뉴 클릭', desc: '좌측 메뉴에서 AI 문제 생성 → 실전 변형 문제를 선택합니다.' },
      { title: '직접 입력 탭 확인', desc: '\'직접 입력\' 탭이 기본 선택되어 있습니다.' },
      { title: '지문 입력', desc: '하나 또는 여러 개의 지문을 입력합니다. 지문 추가 버튼으로 다중 지문 처리가 가능합니다.' },
      { title: '유형 선택', desc: '9가지 유형(주제/제목, 어법, 어휘, 빈칸 등) 중 원하는 유형을 체크합니다. 슈퍼어드민이 활성화한 유형만 표시됩니다.' },
      { title: '난이도·문항 수 설정', desc: '각 유형마다 난이도(B1~C2)와 문항 수(1~3)를 개별 조정할 수 있습니다.' },
      { title: '\'AI 문제 생성하기\' 클릭', desc: '지문 수×유형별 CON 합산 금액이 차감 예정으로 표시됩니다.' },
      { title: '결과 확인 및 PDF 저장', desc: '생성된 문제를 확인하고 인라인 편집 후 PDF로 저장합니다.' },
    ],
    tips: '유형을 많이 선택할수록 CON 차감이 늘어납니다. 처음엔 2~3개 유형부터 시작하는 것을 권장합니다.',
    con: { amount: 20, label: '유형 1개당' },
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
    con: { amount: 20, label: '유형 1개당' },
  },
  mock: {
    title: '모의고사 지문 선택',
    steps: [
      { title: '모의고사 탭 클릭', desc: '페이지 상단의 \'모의고사\' 탭을 선택합니다.' },
      { title: '연도·학년·시행처 선택', desc: '원하는 시험의 연도, 학년, 시행처를 선택합니다.' },
      { title: '문항 번호 선택', desc: '원하는 번호를 클릭합니다. 여러 번호를 동시에 선택할 수 있습니다.' },
      { title: '유형 선택', desc: '9가지 유형 중 원하는 유형을 체크하고 난이도·문항 수를 설정합니다.' },
      { title: 'PDF 배치 방식 선택', desc: '지문별 / 유형별 / 무작위 중 하나를 선택합니다.' },
      { title: '\'AI 문제 생성하기\' 클릭', desc: '지문 수×유형별 CON 합산 금액이 차감됩니다. 지문별로 순차 생성됩니다.' },
    ],
    tips: 'PDF 배치를 \'유형별\'로 설정하면 같은 유형 문제끼리 모아서 출력할 수 있어 유형별 시험지 제작에 유용합니다.',
    con: { amount: 20, label: '유형 1개당' },
  },
};

const MAIN_TABS = [
  { key: 'pdf' as MainTab, label: '지문분석', icon: '📝', href: '/admin/pdf-editor', color: 'bg-teal-600' },
  { key: 'ai'  as MainTab, label: '실전 변형 문제', icon: '🎯', href: '/admin/ai-questions', color: 'bg-indigo-600' },
];

const SUB_TABS = [
  { key: 'direct' as SubTab, label: '직접 입력', icon: '⌨️' },
  { key: 'image'  as SubTab, label: '사진 등록', icon: '📷' },
  { key: 'mock'   as SubTab, label: '모의고사',  icon: '📚' },
];

export default function GuidePage() {
  const [mainTab, setMainTab] = useState<MainTab>('pdf');
  const [subTab, setSubTab] = useState<SubTab>('direct');

  const guide = mainTab === 'pdf' ? PDF_GUIDES[subTab] : AI_GUIDES[subTab];
  const activeMain = MAIN_TABS.find(t => t.key === mainTab)!;

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

      {/* 카드 */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 overflow-hidden">
        {/* 서브 탭 */}
        <div className="flex border-b border-slate-100 dark:border-slate-800">
          {SUB_TABS.map(t => (
            <button
              key={t.key}
              onClick={() => setSubTab(t.key)}
              className={`flex-1 py-3 text-xs font-black transition-all border-b-2 ${
                subTab === t.key
                  ? `border-indigo-500 text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/20`
                  : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
              }`}
            >
              <span className="mr-1">{t.icon}</span>
              {t.label}
            </button>
          ))}
        </div>

        {/* 콘텐츠 */}
        <div className="p-6 space-y-5">
          {/* 제목 + CON */}
          <div className="flex items-center justify-between flex-wrap gap-3">
            <h2 className="text-base font-black text-slate-800 dark:text-slate-100">
              {activeMain.icon} {activeMain.label} — {guide.title}
            </h2>
            <ConBadge amount={guide.con.amount} label={guide.con.label} />
          </div>

          {/* 스텝 */}
          <StepList steps={guide.steps} />

          {/* 팁 */}
          <TipBox>{guide.tips}</TipBox>
        </div>
      </div>

      {/* 바로가기 버튼 */}
      <div className="flex gap-3">
        <Link
          href={activeMain.href}
          className={`flex-1 py-3.5 rounded-2xl text-center text-sm font-black text-white transition-all ${activeMain.color} hover:opacity-90 shadow-md`}
        >
          {activeMain.icon} {activeMain.label} 바로가기
        </Link>
      </div>

      {/* CON 안내 */}
      <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700 rounded-2xl p-5 space-y-3">
        <h3 className="text-sm font-black text-yellow-800 dark:text-yellow-300">⭐ CON(크레딧) 안내</h3>
        <div className="grid grid-cols-2 gap-2">
          {[
            { icon: '📝', label: '지문분석 직접 입력', con: 50 },
            { icon: '📝', label: '지문분석 모의고사', con: 50 },
            { icon: '🎯', label: '실전변형 유형 1개', con: 20 },
            { icon: '📌', label: '워크북 유형 1개', con: 50 },
          ].map(item => (
            <div key={item.label} className="flex items-center justify-between bg-white dark:bg-slate-800 rounded-xl px-3 py-2 border border-yellow-100 dark:border-yellow-800">
              <span className="text-xs font-bold text-slate-600 dark:text-slate-300">{item.icon} {item.label}</span>
              <span className="text-xs font-black text-yellow-600 dark:text-yellow-400">{item.con}C</span>
            </div>
          ))}
        </div>
        <p className="text-xs font-bold text-yellow-700 dark:text-yellow-400">
          CON이 부족하면 슈퍼어드민에게 충전을 요청하거나, 메뉴 하단의 CON 사용 이력에서 잔액을 확인하세요.
        </p>
      </div>

      {/* 공통 FAQ */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 p-5 space-y-4">
        <h3 className="text-sm font-black text-slate-800 dark:text-slate-100">❓ 자주 묻는 질문</h3>
        {[
          {
            q: '생성 중 오류가 발생했을 때 CON이 차감되나요?',
            a: '생성에 실패한 경우 CON이 차감되지 않습니다.',
          },
          {
            q: '생성된 문제를 수정할 수 있나요?',
            a: '결과 화면에서 직접 클릭하여 인라인 편집이 가능합니다. 편집 후 PDF로 저장하세요.',
          },
          {
            q: '모의고사 DB에 원하는 지문이 없어요.',
            a: '직접 입력 또는 사진 등록으로 지문을 추가하거나, 슈퍼어드민에게 문의해 주세요.',
          },
          {
            q: 'OCR 인식이 정확하지 않아요.',
            a: '고해상도 이미지 사용, 페이지 평탄화, 텍스트를 수평으로 맞추면 인식 정확도가 높아집니다.',
          },
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
