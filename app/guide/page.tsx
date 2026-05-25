import Link from 'next/link';

const sections = [
  {
    number: '01',
    icon: '📝',
    title: '지문 분석 & 워크북',
    color: 'bg-teal-500',
    lightColor: 'bg-teal-50',
    textColor: 'text-teal-700',
    steps: [
      { step: 'STEP 1', title: '지문 입력', desc: '분석할 영어 지문을 텍스트로 직접 붙여넣거나, 지문이 담긴 이미지 파일을 업로드하세요. OCR 기술로 자동 추출됩니다.' },
      { step: 'STEP 2', title: 'AI 분석 실행', desc: '지문 분석 버튼을 누르면 AI가 지문을 분석합니다. 주제 파악, 구문 분석, 어휘 정리, T/F 문장, 요약 등 다양한 섹션이 자동 생성됩니다.' },
      { step: 'STEP 3', title: '워크북 확인 및 편집', desc: '생성된 워크북 내용을 확인하고 필요한 부분을 수정하세요. 각 섹션을 개별적으로 복사할 수도 있습니다.' },
      { step: 'STEP 4', title: 'PDF 저장 및 인쇄', desc: '워크북 PDF 다운로드 버튼으로 인쇄용 PDF를 저장하세요. 컬러/흑백 테마를 선택할 수 있습니다.' },
    ],
    note: '워크북 1회 생성 시 CON이 소모됩니다. CON 잔액은 상단 헤더에서 확인 가능합니다.',
  },
  {
    number: '02',
    icon: '🎯',
    title: '실전 변형 문제',
    color: 'bg-indigo-500',
    lightColor: 'bg-indigo-50',
    textColor: 'text-indigo-700',
    steps: [
      { step: 'STEP 1', title: '지문 입력', desc: '변형 문제를 만들 영어 지문을 입력합니다. 텍스트 붙여넣기 또는 이미지 업로드 모두 지원합니다.' },
      { step: 'STEP 2', title: '유형 및 난이도 설정', desc: '어법, 어휘(낱말/빈칸), 빈칸 추론, 요약문, 흐름, 어구 의미, 순서 배열 등 9가지 유형 중 원하는 유형을 선택하고 난이도(B1~C2)와 문제 수(1~3개)를 설정합니다.' },
      { step: 'STEP 3', title: '문제 생성', desc: '생성 버튼을 누르면 AI가 각 유형별로 문제를 생성합니다. 유형당 수십 초 소요되며, 실패한 문제는 자동으로 최대 5회 재시도합니다.' },
      { step: 'STEP 4', title: 'PDF 출력', desc: '생성된 문제를 확인한 후 문제지 PDF와 해설지 PDF를 각각 다운로드할 수 있습니다.' },
    ],
    note: '문제는 유형별 개수만큼 CON이 차감됩니다. 생성 실패 시 CON은 차감되지 않습니다.',
  },
  {
    number: '03',
    icon: '📚',
    title: '모의고사 변형 문제',
    color: 'bg-amber-500',
    lightColor: 'bg-amber-50',
    textColor: 'text-amber-700',
    steps: [
      { step: 'STEP 1', title: '지문 선택', desc: '년도 → 기관(수능/평가원/교육청) → 시험명 → 문제 번호 순서로 선택하면 해당 기출 지문이 자동으로 불러와집니다.' },
      { step: 'STEP 2', title: '지문 확인', desc: '불러온 지문을 확인합니다. 지문 내용이 맞는지 확인 후 다음 단계로 진행하세요.' },
      { step: 'STEP 3', title: '유형·난이도 설정', desc: '실전 변형 문제와 동일하게 문제 유형, 난이도, 개수를 설정합니다.' },
      { step: 'STEP 4', title: '문제 생성 및 출력', desc: 'AI가 선택한 기출 지문으로 변형 문제를 생성합니다. 문제지·해설지 PDF를 다운로드하세요.' },
    ],
    note: '수능·평가원·각 교육청 모의고사 지문이 지속적으로 업데이트됩니다.',
  },
  {
    number: '04',
    icon: '💰',
    title: 'CON 안내',
    color: 'bg-amber-400',
    lightColor: 'bg-yellow-50',
    textColor: 'text-amber-700',
    steps: [
      { step: 'CON이란?', title: 'CON(크레딧) 시스템', desc: 'CON은 CON EDU 서비스 이용에 필요한 내부 크레딧입니다. 기능을 사용할 때마다 일정량의 CON이 차감됩니다.' },
      { step: '소모량', title: '기능별 CON 소모량', desc: '지문분석 워크북: 1회당 일정 CON 차감 / 실전·모의고사 변형 문제: 유형별로 CON 차감 (슈퍼어드민 설정값 기준)' },
      { step: '충전', title: 'CON 충전 방법', desc: 'CON 충전은 관리자(콘에듀 운영팀)에게 문의하시거나 공지된 충전 방법을 따라 진행하세요.' },
      { step: '잔액 확인', title: '잔액 확인 위치', desc: '상단 헤더의 CON 표시에서 현재 잔액을 언제든지 확인할 수 있습니다.' },
    ],
    note: 'CON이 부족한 경우 문제 생성이 차단되며 충전 안내 팝업이 표시됩니다.',
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

      {/* 목차 */}
      <div className="max-w-4xl mx-auto px-8 py-10">
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

        {/* FAQ */}
        <section>
          <h2 className="text-2xl font-black text-slate-900 mb-8">자주 묻는 질문 (FAQ)</h2>
          <div className="space-y-4">
            {[
              { q: '문제 생성이 실패하면 CON이 차감되나요?', a: '아니요. 생성에 실패한 유형은 CON이 차감되지 않습니다. 성공적으로 생성된 유형만 차감됩니다.' },
              { q: '이미지로 지문을 올리면 얼마나 정확하게 인식되나요?', a: '선명한 이미지일수록 정확도가 높습니다. OCR 추출 후 텍스트를 직접 수정할 수 있으므로, 오류가 있는 경우 수정 후 진행하세요.' },
              { q: '생성된 문제를 수정할 수 있나요?', a: '현재는 생성된 문제의 직접 수정 기능은 제공되지 않습니다. 원하는 결과가 나올 때까지 재생성하시거나 PDF 편집 프로그램을 활용하세요.' },
              { q: '모의고사 변형 문제에 없는 지문은 어떻게 하나요?', a: '지문이 등록되지 않은 경우 실전 변형 문제 메뉴에서 직접 지문을 입력하여 사용하세요. 지문 추가 요청은 고객센터로 문의해주세요.' },
              { q: 'CON은 어디서 충전하나요?', a: '고객센터(contact@bfai.ai)로 문의하시면 충전 안내를 받을 수 있습니다.' },
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
