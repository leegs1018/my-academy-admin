import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: '서비스 가이드',
  description: 'CON EDU AI 영어 문제 생성 서비스 이용 가이드. 지문 분석부터 실전·모의고사 변형 문제 생성까지 단계별로 안내합니다.',
};

const sections = [
  {
    number: '01',
    icon: '📝',
    title: '지문분석 툴/워크북',
    color: 'bg-teal-500',
    lightColor: 'bg-teal-50',
    textColor: 'text-teal-700',
    steps: [
      {
        step: '직접 입력 탭',
        title: '지문 직접 입력',
        desc: '분석할 영어 지문을 텍스트로 붙여넣거나 이미지 파일을 업로드하세요. OCR 기술로 자동 추출됩니다. 난이도를 선택 후 AI 분석을 실행하면 주제 파악, 구문 분석, 어휘 정리, T/F 문장, 요약 등 워크북이 자동 생성됩니다.',
      },
      {
        step: '모의고사 지문 탭',
        title: '기출 지문으로 워크북 생성',
        desc: '년도 → 학년 → 기관(수능/평가원/교육청) → 문제 번호 순서로 선택하면 해당 기출 지문이 자동으로 불러와집니다. 여러 문제 번호를 동시에 선택하여 일괄 생성할 수 있습니다.',
      },
      {
        step: 'STEP 3',
        title: '워크북 확인 및 편집',
        desc: '생성된 워크북 내용을 확인하고 어휘 목록 등 필요한 부분을 수정하세요. 편집 완료 후 저장하면 수정 내용이 PDF에 반영됩니다.',
      },
      {
        step: 'STEP 4',
        title: 'PDF 저장 및 이력 관리',
        desc: '문제지 PDF와 정답지 PDF를 각각 다운로드할 수 있습니다. 생성 이력 탭에서 직접입력/모의고사 구분 없이 이전 작업물을 언제든지 재다운로드하거나 삭제할 수 있습니다.',
      },
    ],
    note: '워크북 1회 생성 시 CON이 소모됩니다. 직접 입력과 모의고사 지문 탭 모두 동일한 CON이 사용됩니다.',
  },
  {
    number: '02',
    icon: '🎯',
    title: '실전 변형 문제',
    color: 'bg-indigo-500',
    lightColor: 'bg-indigo-50',
    textColor: 'text-indigo-700',
    steps: [
      {
        step: '직접 입력 탭',
        title: '지문 직접 입력 (단일/대량)',
        desc: '영어 지문을 텍스트 또는 이미지로 입력하세요. \'문제 생성(대량)\' 서브탭에서는 최대 10개 지문을 한 번에 처리할 수 있습니다. 유형(9가지), 난이도(B1~C2), 문제 수(1~3개)를 설정 후 생성하세요.',
      },
      {
        step: '모의고사 지문 탭',
        title: '기출 지문으로 변형 문제 생성',
        desc: '년도 → 학년 → 기관 → 문제 번호 순서로 기출 지문을 선택합니다. 여러 번호를 동시에 선택 가능하며, 선택된 모든 지문에 대해 설정한 유형의 변형 문제가 일괄 생성됩니다.',
      },
      {
        step: '품질 평가',
        title: '👍/👎 문제 품질 평가',
        desc: '생성된 각 문제 카드 하단에서 좋아요(👍) 또는 신고(👎)를 선택할 수 있습니다. 품질 낮은 문제를 신고하면 관리자가 검토 후 CON을 환불해드립니다.',
      },
      {
        step: '생성 이력 탭',
        title: 'PDF 재다운로드 및 이력 관리',
        desc: '직접 입력과 모의고사 탭에서 생성한 이력이 통합 관리됩니다. 날짜·키워드 검색, 다중 선택 일괄 다운로드/삭제가 가능합니다. 이력은 생성일로부터 30일 후 자동 삭제됩니다.',
      },
    ],
    note: '유형별 개수만큼 CON이 차감됩니다. 생성 실패 시 CON은 차감되지 않으며 자동으로 최대 5회 재시도합니다.',
  },
  {
    number: '03',
    icon: '📌',
    title: '어휘 선택 문제',
    color: 'bg-purple-500',
    lightColor: 'bg-purple-50',
    textColor: 'text-purple-700',
    steps: [
      {
        step: 'STEP 1',
        title: '지문 입력',
        desc: '어휘 선택 문제를 만들 영어 지문을 텍스트로 입력하거나 이미지를 업로드하세요. OCR로 자동 추출됩니다.',
      },
      {
        step: 'STEP 2',
        title: '어휘 개수 설정',
        desc: '빈칸으로 처리할 어휘의 개수를 설정합니다. AI가 지문에서 핵심 어휘를 자동으로 선별하여 \'단어 A / 단어 B\' 선택형 문제를 생성합니다.',
      },
      {
        step: 'STEP 3',
        title: '문제 확인 및 편집',
        desc: '생성된 어휘 선택 문제를 확인하고 단어를 수정할 수 있습니다. 편집 모드에서 각 빈칸의 정답/오답 단어를 직접 바꿀 수 있습니다.',
      },
      {
        step: 'STEP 4',
        title: 'PDF 저장',
        desc: '문제지(빈칸 형식)와 정답지(정답 하이라이트)를 각각 PDF로 저장하세요. 생성 이력에서 언제든지 재다운로드할 수 있습니다.',
      },
    ],
    note: '어휘 선택 문제 생성 시 CON이 소모됩니다. 지문의 난이도와 어휘 수준에 따라 생성 품질이 달라질 수 있습니다.',
  },
  {
    number: '04',
    icon: '💰',
    title: 'CON 안내',
    color: 'bg-amber-400',
    lightColor: 'bg-yellow-50',
    textColor: 'text-amber-700',
    steps: [
      {
        step: 'CON이란?',
        title: 'CON(크레딧) 시스템',
        desc: 'CON은 CON EDU 서비스 이용에 필요한 내부 크레딧입니다. 기능을 사용할 때마다 일정량의 CON이 차감됩니다. 현재 잔액은 상단 헤더에서 언제든지 확인할 수 있습니다.',
      },
      {
        step: '소모량',
        title: '기능별 CON 소모량',
        desc: '지문분석 워크북, 실전 변형 문제(유형별), 어휘 선택 문제 사용 시 CON이 차감됩니다. 정확한 차감량은 각 화면의 CON 안내를 확인하세요.',
      },
      {
        step: '환불',
        title: '품질 신고 시 CON 환불',
        desc: '생성된 문제의 품질이 낮은 경우 👎 신고 버튼을 눌러 신고하세요. 운영팀이 검토 후 승인하면 해당 유형의 CON이 자동으로 환불됩니다.',
      },
      {
        step: '충전',
        title: 'CON 충전 방법',
        desc: 'CON 충전 메뉴에서 카드결제 또는 무통장입금으로 직접 충전할 수 있습니다. 1,000 CON = 10,000원이며, 3,000C 이상 +5% · 5,000C 이상 +7% · 10,000C 이상 +10% 보너스 CON이 추가 적립됩니다.',
      },
    ],
    note: '1,000 CON = 10,000원이며 CON 충전 메뉴에서 카드결제로 바로 충전하실 수 있습니다. 3,000C 이상 충전 시 보너스 CON이 추가 적립되니 넉넉하게 충전하세요.',
  },
];

export default function GuidePage() {
  return (
    <div className="min-h-screen bg-white font-sans text-slate-900">
      {/* 헤더 */}
      <nav className="flex items-center justify-between px-8 py-4 bg-white border-b border-slate-100 sticky top-0 z-50">
        <Link href="/" className="flex items-center gap-3">
          <div className="w-8 h-8 bg-slate-900 rounded-xl flex items-center justify-center rotate-3">
            <span className="text-yellow-400 font-black text-sm italic">C</span>
          </div>
          <span className="text-lg font-black tracking-tighter">CON <span className="text-yellow-500">EDU</span></span>
        </Link>
        <Link href="/" className="text-sm font-bold text-slate-400 hover:text-slate-900 transition-colors">← 홈으로</Link>
      </nav>

      {/* 히어로 */}
      <div className="bg-slate-900 text-white py-20 px-8 text-center">
        <p className="text-yellow-400 font-black text-xs uppercase tracking-widest mb-4">Service Guide</p>
        <h1 className="text-4xl md:text-5xl font-black mb-4">서비스 가이드</h1>
        <p className="text-slate-400 font-medium text-lg max-w-xl mx-auto">
          CON EDU AI 문제 생성 서비스의 모든 기능을 쉽게 이해하고 활용하세요.
        </p>
      </div>

      {/* 메뉴 구성 안내 */}
      <div className="max-w-4xl mx-auto px-8 pt-10 pb-0">
        <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-5 flex flex-wrap gap-4 items-center">
          <span className="text-sm font-black text-indigo-700">📂 AI 문제 생성 메뉴 구성</span>
          {[
            { icon: '📝', label: '지문분석 툴/워크북' },
            { icon: '🎯', label: '실전 변형 문제' },
            { icon: '📌', label: '어휘 선택 문제' },
          ].map((m) => (
            <span key={m.label} className="flex items-center gap-1.5 bg-white border border-indigo-200 rounded-xl px-3 py-1.5 text-xs font-black text-slate-700">
              {m.icon} {m.label}
            </span>
          ))}
          <p className="w-full text-xs font-medium text-indigo-600">
            각 메뉴는 <strong>직접 입력</strong> · <strong>모의고사 지문</strong> · <strong>생성 이력</strong> 3개 탭으로 구성됩니다.
          </p>
        </div>
      </div>

      {/* 목차 */}
      <div className="max-w-4xl mx-auto px-8 py-8">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {sections.map((s) => (
            <a key={s.number} href={`#section-${s.number}`}
              className="flex flex-col items-center gap-2 p-4 rounded-2xl border-2 border-slate-100 hover:border-yellow-400 hover:-translate-y-1 transition-all text-center">
              <span className="text-2xl">{s.icon}</span>
              <span className="text-xs font-black text-slate-500">{s.number}</span>
              <span className="text-sm font-black text-slate-900 leading-tight">{s.title}</span>
            </a>
          ))}
        </div>
      </div>

      {/* 섹션들 */}
      <div className="max-w-4xl mx-auto px-8 pb-20 space-y-16">
        {sections.map((s) => (
          <section key={s.number} id={`section-${s.number}`} className="scroll-mt-24">
            <div className="flex items-center gap-4 mb-8">
              <div className={`w-14 h-14 ${s.color} rounded-2xl flex items-center justify-center text-2xl shadow-lg`}>
                {s.icon}
              </div>
              <div>
                <p className="text-xs font-black text-slate-400 uppercase tracking-widest">{s.number}</p>
                <h2 className="text-2xl font-black text-slate-900">{s.title}</h2>
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-4 mb-6">
              {s.steps.map((step, i) => (
                <div key={i} className={`${s.lightColor} rounded-2xl p-6`}>
                  <p className={`text-xs font-black ${s.textColor} uppercase tracking-widest mb-2`}>{step.step}</p>
                  <h3 className="text-base font-black text-slate-900 mb-2">{step.title}</h3>
                  <p className="text-sm font-medium text-slate-600 leading-relaxed">{step.desc}</p>
                </div>
              ))}
            </div>

            <div className="flex items-start gap-3 bg-slate-50 rounded-xl px-5 py-4 border border-slate-200">
              <span className="text-lg flex-shrink-0">💡</span>
              <p className="text-sm font-medium text-slate-600">{s.note}</p>
            </div>
          </section>
        ))}

        {/* 문제 유형 안내 */}
        <section>
          <h2 className="text-2xl font-black text-slate-900 mb-6">지원 문제 유형 (9가지)</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {[
              { icon: '💬', label: '주제/제목 유형', desc: '글의 주제나 제목 파악' },
              { icon: '✏️', label: '어법 유형', desc: '어법상 틀린 것 찾기 ①~⑤' },
              { icon: '📖', label: '어휘-낱말 쓰임 유형', desc: '문맥상 부적절한 낱말 찾기' },
              { icon: '🔤', label: '어휘 (a)(b) 빈칸 유형', desc: '두 빈칸에 알맞은 어휘 쌍' },
              { icon: '🔲', label: '빈칸 추론 유형', desc: '핵심 빈칸에 들어갈 표현' },
              { icon: '📋', label: '요약문 완성 유형', desc: '요약문의 (A)(B) 빈칸 완성' },
              { icon: '🌊', label: '흐름 유형', desc: '전체 흐름과 무관한 문장 찾기' },
              { icon: '🔍', label: '어구 의미 추론 유형', desc: '밑줄 어구의 문맥 속 의미 추론' },
              { icon: '🔀', label: '순서 배열 유형', desc: '글의 순서로 가장 적절한 것은?' },
            ].map((t, i) => (
              <div key={i} className="bg-slate-50 border border-slate-200 rounded-2xl p-4">
                <span className="text-xl">{t.icon}</span>
                <p className="font-black text-slate-900 text-sm mt-2">{t.label}</p>
                <p className="text-xs font-medium text-slate-500 mt-1">{t.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* FAQ */}
        <section>
          <h2 className="text-2xl font-black text-slate-900 mb-8">자주 묻는 질문 (FAQ)</h2>
          <div className="space-y-4">
            {[
              { q: '문제 생성이 실패하면 CON이 차감되나요?', a: '아니요. 생성에 실패한 유형은 CON이 차감되지 않습니다. 성공적으로 생성된 유형만 차감됩니다.' },
              { q: '모의고사 지문 탭과 직접 입력 탭의 차이는 무엇인가요?', a: '직접 입력 탭은 원하는 영어 지문을 자유롭게 입력할 수 있습니다. 모의고사 지문 탭은 수능·평가원·교육청 기출 지문을 데이터베이스에서 바로 불러와 사용합니다. 두 탭 모두 동일한 AI 생성 엔진을 사용합니다.' },
              { q: '생성된 문제의 품질이 낮으면 어떻게 하나요?', a: '각 문제 카드 하단의 👎 신고 버튼을 눌러 신고하세요. 운영팀 검토 후 품질 문제가 확인되면 해당 CON을 환불해드립니다.' },
              { q: '이미지로 지문을 올리면 얼마나 정확하게 인식되나요?', a: '선명한 이미지일수록 정확도가 높습니다. OCR 추출 후 텍스트를 직접 수정할 수 있으므로, 오류가 있는 경우 수정 후 진행하세요.' },
              { q: '생성 이력은 얼마나 보관되나요?', a: '생성 이력은 생성일로부터 30일 후 자동 삭제됩니다. 중요한 문제지는 PDF를 다운로드해 별도 보관하세요.' },
              { q: 'CON은 어디서 충전하나요?', a: 'CON 충전 메뉴에서 카드결제 또는 무통장입금으로 직접 충전하실 수 있습니다. 3,000C 이상 충전 시 최대 10% 보너스 CON이 추가 적립됩니다. 충전 및 환불 문의는 문의하기 게시판을 이용해주세요.' },
            ].map((faq, i) => (
              <div key={i} className="border border-slate-200 rounded-2xl p-6">
                <p className="font-black text-slate-900 mb-2">Q. {faq.q}</p>
                <p className="text-sm font-medium text-slate-500 leading-relaxed">A. {faq.a}</p>
              </div>
            ))}
          </div>
        </section>
      </div>

      <footer className="border-t border-slate-100 py-8 text-center text-sm text-slate-400 font-medium">
        <p>© 2026 CON EDU. All rights reserved.</p>
      </footer>
    </div>
  );
}
