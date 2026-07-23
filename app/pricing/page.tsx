import type { Metadata } from 'next';
import Link from 'next/link';
import { createAdminClient } from '@/lib/supabase-admin';

export const metadata: Metadata = {
  title: 'CON 가격 안내 | CON EDU',
  description: 'CON EDU의 AI 문제 생성 서비스 요금 안내. 가입 즉시 300C 지급, 사용한 만큼만 차감.',
};

// feature_key → 표시 이름 매핑
const FEATURE_NAMES: Record<string, string> = {
  pdf_analysis_direct:       '지문분석 (직접 입력)',
  wb_direct_vocab_choice:    '워크북 생성 (직접 입력)',
  ai_type_topic_title:       '주제/제목 유형',
  ai_type_grammar:           '어법 유형',
  ai_type_vocab_paraphrase:  '어휘 (낱말 쓰임) 유형',
  ai_type_vocab_blank:       '어휘 (a)(b) 빈칸 유형',
  ai_type_fill_blank:        '빈칸 추론 유형',
  ai_type_summary:           '요약문 완성 유형',
  ai_type_flow:              '흐름 유형',
  ai_type_phrase_meaning:    '어구 의미 추론 유형',
  ai_type_sentence_order:    '순서 배열 유형',
  sms:                       'SMS (단문, 90자 이내)',
  lms:                       'LMS (장문, 90자 초과)',
  signup_bonus:              '신규 가입 기본 CON',
  signup_bonus_referral:     '추천인 코드 입력 시 추가 CON',
};

// feature_key → 설명
const FEATURE_DESC: Record<string, string> = {
  pdf_analysis_direct:     '변형 지문·T/F·요약·어휘표 6종 자동 생성',
  wb_direct_vocab_choice:  '어법·어휘·서술형·드릴 등 최대 10종 동시 생성',
  sms:                     '출결·성적 알림 자동 발송 가능',
};

// 기본값 (DB에 해당 key가 없을 때)
const FALLBACK: Record<string, number> = {
  pdf_analysis_direct: 10,
  wb_direct_vocab_choice: 10,
  ai_type_topic_title: 20,
  ai_type_grammar: 20,
  ai_type_vocab_paraphrase: 20,
  ai_type_vocab_blank: 20,
  ai_type_fill_blank: 20,
  ai_type_summary: 20,
  ai_type_flow: 20,
  ai_type_phrase_meaning: 20,
  ai_type_sentence_order: 20,
  sms: 3,
  lms: 15,
  signup_bonus: 300,
  signup_bonus_referral: 400,
};

async function getPricing(): Promise<Record<string, number>> {
  try {
    const db = createAdminClient();
    const { data } = await db
      .from('con_pricing')
      .select('feature_key, cost_per_use')
      .eq('is_active', true);
    const map: Record<string, number> = { ...FALLBACK };
    (data ?? []).forEach((row: { feature_key: string; cost_per_use: number }) => {
      map[row.feature_key] = row.cost_per_use;
    });
    return map;
  } catch {
    return { ...FALLBACK };
  }
}

function price(map: Record<string, number>, key: string) {
  return map[key] ?? FALLBACK[key] ?? '?';
}

export const dynamic = 'force-dynamic';

export default async function PricingPage() {
  const pricing = await getPricing();

  const signupBonus = (pricing['signup_bonus'] ?? 300) + (pricing['signup_bonus_referral'] ?? 400);

  const GROUPS = [
    {
      category: '지문분석',
      icon: '📝',
      color: 'bg-teal-50 border-teal-200',
      iconBg: 'bg-teal-100',
      textColor: 'text-teal-700',
      items: [{ key: 'pdf_analysis_direct' }],
    },
    {
      category: '워크북',
      icon: '📚',
      color: 'bg-purple-50 border-purple-200',
      iconBg: 'bg-purple-100',
      textColor: 'text-purple-700',
      items: [{ key: 'wb_direct_vocab_choice' }],
    },
    {
      category: '실전 변형 문제',
      icon: '🎯',
      color: 'bg-indigo-50 border-indigo-200',
      iconBg: 'bg-indigo-100',
      textColor: 'text-indigo-700',
      items: [
        { key: 'ai_type_topic_title' },
        { key: 'ai_type_grammar' },
        { key: 'ai_type_vocab_paraphrase' },
        { key: 'ai_type_vocab_blank' },
        { key: 'ai_type_fill_blank' },
        { key: 'ai_type_summary' },
        { key: 'ai_type_flow' },
        { key: 'ai_type_phrase_meaning' },
        { key: 'ai_type_sentence_order' },
      ],
    },
    {
      category: '문자 발송',
      icon: '📱',
      color: 'bg-sky-50 border-sky-200',
      iconBg: 'bg-sky-100',
      textColor: 'text-sky-700',
      items: [{ key: 'sms' }, { key: 'lms' }],
    },
  ];

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
          <Link href="/notices" className="px-5 py-2.5 text-sm font-bold text-slate-500 hover:text-slate-900 transition-colors">
            공지사항
          </Link>
          <Link href="/pricing" className="px-5 py-2.5 text-sm font-bold text-slate-900 border-b-2 border-slate-900">
            가격 안내
          </Link>
          <Link href="/register" className="px-5 py-2.5 text-sm font-bold border-2 border-slate-900 text-slate-900 rounded-full hover:bg-slate-900 hover:text-white transition-all">
            솔루션 가입하기
          </Link>
          <Link href="/login" className="px-5 py-2.5 text-sm font-bold bg-slate-900 text-white rounded-full hover:shadow-xl hover:-translate-y-0.5 transition-all">
            로그인
          </Link>
        </div>
      </nav>

      {/* 히어로 */}
      <section className="pt-20 pb-16 text-center px-8">
        <div className="inline-block px-4 py-1.5 mb-8 rounded-full bg-yellow-50 border border-yellow-200 text-yellow-700 text-xs font-black uppercase tracking-widest">
          투명한 요금제
        </div>
        <h1 className="text-5xl md:text-6xl font-black tracking-tight mb-6">
          사용한 만큼만 <br />
          <span className="text-yellow-500">CON</span>으로 결제
        </h1>
        <p className="text-xl text-slate-400 font-medium max-w-2xl mx-auto mb-4">
          CON(콘)은 CON EDU의 서비스 이용 크레딧입니다.<br />
          가입 즉시 <strong className="text-slate-700">{pricing['signup_bonus'] ?? 300}C</strong>를 무료로 드립니다.
        </p>
        <p className="text-sm text-slate-400 font-bold">추천인 코드 입력 시 총 {signupBonus}C 지급</p>
      </section>

      {/* CON 설명 카드 */}
      <section className="max-w-5xl mx-auto px-8 pb-16">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            {
              icon: '🎁',
              title: `가입 즉시 ${pricing['signup_bonus'] ?? 300}C 무료 지급`,
              desc: '회원가입만 해도 자동으로 지급됩니다. 결제 없이 바로 서비스를 경험해보세요.',
              color: 'bg-yellow-50 border-yellow-200',
            },
            {
              icon: '💰',
              title: '사용한 만큼만 차감',
              desc: `월정액이 없습니다. 실전 변형 문제 1유형 생성에 ${price(pricing, 'ai_type_topic_title')}C, 지문분석 1회에 ${price(pricing, 'pdf_analysis_direct')}C만 차감됩니다.`,
              color: 'bg-slate-50 border-slate-200',
            },
            {
              icon: '🔄',
              title: 'CON 환불 보장',
              desc: '생성된 문제 품질이 낮다고 판단되면 신고 후 운영팀 검토를 통해 CON을 환불받을 수 있습니다.',
              color: 'bg-emerald-50 border-emerald-200',
            },
          ].map((item, i) => (
            <div key={i} className={`${item.color} border-2 rounded-3xl p-8`}>
              <div className="text-4xl mb-4">{item.icon}</div>
              <h3 className="text-lg font-black text-slate-900 mb-2">{item.title}</h3>
              <p className="text-sm text-slate-600 font-medium leading-relaxed">{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* 가격표 */}
      <section className="bg-slate-50 py-20">
        <div className="max-w-4xl mx-auto px-8">
          <div className="text-center mb-14">
            <p className="text-yellow-600 font-black text-xs uppercase tracking-widest mb-3">Pricing Table</p>
            <h2 className="text-4xl font-black text-slate-900">서비스별 CON 단가</h2>
            <p className="text-slate-400 font-medium mt-3">1C = 약 10원 (CON 충전 단가 기준)</p>
          </div>

          <div className="space-y-6">
            {GROUPS.map(group => (
              <div key={group.category} className={`${group.color} border-2 rounded-3xl overflow-hidden`}>
                <div className={`${group.iconBg} px-6 py-4 flex items-center gap-3`}>
                  <span className="text-2xl">{group.icon}</span>
                  <span className={`text-base font-black ${group.textColor}`}>{group.category}</span>
                </div>
                <div className="bg-white divide-y divide-slate-100">
                  {group.items.map((item) => (
                    <div key={item.key} className="flex items-center justify-between px-6 py-4">
                      <div>
                        <p className="text-sm font-black text-slate-900">{FEATURE_NAMES[item.key] ?? item.key}</p>
                        {FEATURE_DESC[item.key] && (
                          <p className="text-xs text-slate-400 font-medium mt-0.5">{FEATURE_DESC[item.key]}</p>
                        )}
                      </div>
                      <div className="text-right flex-shrink-0 ml-4">
                        <span className="text-lg font-black text-slate-900">{price(pricing, item.key)}C</span>
                        <p className="text-[10px] text-slate-400 font-bold">≈ {Number(price(pricing, item.key)) * 10}원</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-4xl mx-auto px-8 py-20">
        <div className="bg-slate-900 rounded-[3rem] p-12 text-center relative overflow-hidden">
          <div className="relative z-10">
            <p className="text-yellow-400 font-black text-xs uppercase tracking-widest mb-4">CON Charge</p>
            <h2 className="text-3xl font-black text-white mb-4">CON 충전 방법</h2>
            <p className="text-slate-400 font-medium mb-8 max-w-xl mx-auto">
              충전 단가 및 패키지는 서비스 내 <strong className="text-white">CON 충전</strong> 메뉴에서 확인하세요.<br />
              가입 후 원장님 계정에서 바로 충전 가능합니다.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                href="/register"
                className="px-10 py-4 bg-yellow-400 text-slate-900 font-black rounded-full hover:bg-yellow-300 transition-all shadow-xl shadow-yellow-400/20 text-base"
              >
                무료로 시작하기 ({pricing['signup_bonus'] ?? 300}C 지급)
              </Link>
              <Link
                href="/login"
                className="px-10 py-4 bg-slate-800 text-white font-black rounded-full hover:bg-slate-700 transition-all text-base border border-slate-700"
              >
                이미 계정이 있어요
              </Link>
            </div>
          </div>
          <div className="absolute -bottom-8 -right-8 text-white opacity-[0.04] text-[200px] font-black pointer-events-none">C</div>
        </div>
      </section>

      {/* 푸터 */}
      <footer className="border-t border-slate-100 py-8">
        <div className="max-w-7xl mx-auto px-8 flex flex-col md:flex-row justify-between items-center gap-4 text-slate-400 text-sm font-bold">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-6 h-6 bg-slate-900 rounded flex items-center justify-center">
              <span className="text-yellow-400 text-[10px] font-black">C</span>
            </div>
            <span>CON EDU</span>
          </Link>
          <div className="flex gap-6">
            <Link href="/" className="hover:text-slate-900 transition-colors">홈</Link>
            <Link href="/notices" className="hover:text-slate-900 transition-colors">공지사항</Link>
            <Link href="/terms" className="hover:text-slate-900 transition-colors">이용약관</Link>
            <Link href="/privacy" className="hover:text-slate-900 transition-colors">개인정보처리방침</Link>
          </div>
          <p>© 2026 CON EDU</p>
        </div>
      </footer>
    </div>
  );
}
