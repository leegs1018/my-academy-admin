'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import Link from 'next/link';

interface SiteSettings {
  company_name: string;
  privacy_manager_name: string;
  privacy_manager_phone: string;
  privacy_manager_email: string;
}

const DEFAULT_SETTINGS: SiteSettings = {
  company_name: '주식회사 비에프에이아이',
  privacy_manager_name: '김정태',
  privacy_manager_phone: '050-6707-0306',
  privacy_manager_email: 'contact@bfai.ai',
};

export default function TermsPage() {
  const [settings, setSettings] = useState<SiteSettings>(DEFAULT_SETTINGS);

  useEffect(() => {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    supabase.from('site_settings').select('key, value').then(({ data }) => {
      if (data && data.length > 0) {
        const map: Record<string, string> = {};
        data.forEach((r: { key: string; value: string }) => { map[r.key] = r.value; });
        setSettings({
          company_name: map.company_name ?? DEFAULT_SETTINGS.company_name,
          privacy_manager_name: map.privacy_manager_name ?? DEFAULT_SETTINGS.privacy_manager_name,
          privacy_manager_phone: map.privacy_manager_phone ?? DEFAULT_SETTINGS.privacy_manager_phone,
          privacy_manager_email: map.privacy_manager_email ?? DEFAULT_SETTINGS.privacy_manager_email,
        });
      }
    });
  }, []);

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

      <div className="max-w-3xl mx-auto px-8 py-16">
        <h1 className="text-3xl font-black text-slate-900 mb-2">서비스 이용약관</h1>
        <p className="text-slate-400 font-medium mb-1">시행일: 2025년 10월 10일부터</p>
        <p className="text-slate-400 font-medium mb-12">최종 업데이트: 2025년 9월 15일</p>

        <div className="space-y-10 text-slate-700 leading-relaxed">

          <section>
            <h2 className="text-xl font-black text-slate-900 mb-4">소개</h2>
            <p className="font-medium">{settings.company_name}가 제공하는 CON EDU AI 문제 생성 서비스를 이용해 주셔서 감사합니다. 본 웹사이트 및 서비스를 가입·이용함으로써 귀하는 본 약관에 동의하게 됩니다. CON EDU AI 문제 생성 서비스는 사용자의 이메일을 회원가입 과정에서 수집합니다. 사용자의 요청에 기반하여 맞춤형 문제 제작 데이터를 조사하고, 인공지능 산출물로써 귀하가 요청한 난이도와 길이로 수정된 지문, 시험 문제를 제공합니다.</p>
          </section>

          <section>
            <h2 className="text-xl font-black text-slate-900 mb-4">제 1조 (목적)</h2>
            <p className="font-medium">본 약관은 {settings.company_name}(이하 "회사")가 제공하는 영어문제 제작 인공지능 서비스 CON EDU를 이용함에 있어 회사와 사용자 간의 권리·의무 및 책임 사항, 서비스 이용에 필요한 제반 사항을 규정함을 목적으로 합니다.</p>
          </section>

          <section>
            <h2 className="text-xl font-black text-slate-900 mb-4">제 2조 (용어의 정의)</h2>
            <ul className="space-y-3 font-medium">
              <li><span className="font-black text-slate-900">"서비스"</span>: 회사가 제공하는 CON EDU AI 문제 생성 서비스의 인터페이스, 요청받은 시험 지문과 문제 제작을 AI를 이용하여 데이터 생성·분석·전달하는 등 일체의 온라인 기반 데이터 서비스를 의미합니다.</li>
              <li><span className="font-black text-slate-900">"이용자"</span>: 본 약관에 따라 회사가 제공하는 서비스를 이용하는 회원 및 비회원을 말합니다.</li>
              <li><span className="font-black text-slate-900">"회원"</span>: 회사에 개인정보를 제공하고 본 약관에 동의하여 회원 등록을 완료한 자를 의미합니다.</li>
              <li><span className="font-black text-slate-900">"유료 서비스"</span>: 회사가 유료로 제공하는 각종 부가 서비스를 말합니다.</li>
              <li><span className="font-black text-slate-900">"콘텐츠"</span>: 회사가 서비스에서 제공하는 일체의 데이터, 인터페이스, 사용자가 입력한 텍스트, 데이터를 포함합니다.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-black text-slate-900 mb-4">제 3조 (약관의 게시와 개정)</h2>
            <ol className="space-y-2 font-medium list-decimal list-inside text-slate-600">
              <li>회사는 본 약관을 서비스의 모든 화면에 링크로 제공하고, 회원가입 과정에서 동의를 얻으며 게시하며, 이용자가 쉽게 확인할 수 있도록 합니다.</li>
              <li>회사는 관련 법령을 위반하지 않는 범위 내에서 이 약관을 개정할 수 있습니다.</li>
              <li>약관이 개정되는 경우, 회사는 적용일자 및 개정 사유를 명시하여 현행 약관과 함께 적용일자 7일 전부터 공지합니다.</li>
              <li>이용자가 개정 약관에 동의하지 않을 경우, 서비스 이용을 중단하고 이용 계약을 해지할 수 있습니다.</li>
              <li>변경된 약관의 적용일 이후에도 서비스를 계속 이용하는 경우, 이용자가 개정 약관에 동의한 것으로 간주합니다.</li>
            </ol>
          </section>

          <section>
            <h2 className="text-xl font-black text-slate-900 mb-4">제 4조 (서비스의 제공 및 변경)</h2>
            <ol className="space-y-2 font-medium list-decimal list-inside text-slate-600">
              <li>회사는 연중무휴, 1일 24시간 서비스를 제공함을 원칙으로 하나, 설비 점검, 유지보수 등의 사유로 일시 중단될 수 있습니다. 이 경우, 해당 사유 발생 최소 일주일 전에 이용자에게 관련 사실을 고지합니다.</li>
              <li>회사는 서비스의 내용, 이용 방법, 운영 시간 등을 변경할 수 있으며, 변경 시 최소 일주일 전에 이용자에게 사전 공지합니다.</li>
              <li>유료 서비스 변경 시 이용자에게 불리한 경우, 최소 일주일 전에 사전 고지하며, 필요한 경우 환불 또는 보상 조치를 취할 수 있습니다.</li>
            </ol>
          </section>

          <section>
            <h2 className="text-xl font-black text-slate-900 mb-4">제 5조 (회원가입 및 이용계약의 성립)</h2>
            <ol className="space-y-2 font-medium list-decimal list-inside text-slate-600">
              <li>서비스 이용계약은 이용자가 약관에 동의하고 회원가입 신청을 완료한 후, 회사가 이를 승낙함으로써 성립됩니다.</li>
              <li>회사는 다음 각 호의 경우 회원가입을 제한하거나 승낙을 거절할 수 있습니다.
                <ul className="mt-2 ml-4 space-y-1 list-disc">
                  <li>허위 정보를 기재한 경우</li>
                  <li>타인의 정보를 도용한 경우</li>
                  <li>기타 이용자의 귀책사유로 인해 서비스 이용이 부적절하다고 판단되는 경우</li>
                </ul>
              </li>
            </ol>
          </section>

          <section>
            <h2 className="text-xl font-black text-slate-900 mb-4">제 6조 (이용자의 의무)</h2>
            <p className="font-medium mb-3">이용자는 다음 각 호의 행위를 하여서는 안 됩니다.</p>
            <ul className="space-y-2 font-medium list-disc list-inside text-slate-600">
              <li>타인의 정보를 도용하거나 허위 정보를 제공하는 행위</li>
              <li>서비스를 악의적이거나 불법적인 목적에 사용하는 행위</li>
              <li>서비스 내에서 악성코드 유포, 스팸 발송, 시스템 공격을 시도하는 행위</li>
              <li>타인을 사칭하거나 회사 또는 제3자의 권리를 침해하는 행위</li>
              <li>본 약관 및 관계 법령에 위배되는 행위</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-black text-slate-900 mb-4">제 7조 (유료 서비스 및 결제)</h2>
            <ol className="space-y-2 font-medium list-decimal list-inside text-slate-600">
              <li>회사의 유료 서비스는 사전 안내된 금액으로 제공되며, 이용자는 서비스를 신청함과 동시에 요금을 결제해야 합니다.</li>
              <li>결제는 Toss Payments 등의 지정된 결제 수단을 통해 처리됩니다.</li>
              <li>결제가 실패하거나 완료되지 않을 경우, 서비스 이용이 제한될 수 있습니다.</li>
            </ol>
          </section>

          <section>
            <h2 className="text-xl font-black text-slate-900 mb-4">제 8조 (환불 및 구독 해지)</h2>
            <ol className="space-y-2 font-medium list-decimal list-inside text-slate-600">
              <li>구독제 요금제의 특성상 결제 완료 후 일반적인 환불은 불가합니다.</li>
              <li>다만, 홈페이지에 게시된 '환불 정책'에 명기된 조건에 따라 환불이 가능합니다.</li>
              <li>사용자는 언제든지 구독을 해지할 수 있으며, 구독 해지 후 남은 기간에 대한 환불은 제공되지 않습니다.</li>
              <li>환불 정책은 유료 서비스 변경에 따라 조정될 수 있으며, 변경 시 최소 일주일 전에 이용자에게 사전 고지합니다.</li>
            </ol>
          </section>

          <section>
            <h2 className="text-xl font-black text-slate-900 mb-4">제 9조 (지식재산권)</h2>
            <ol className="space-y-2 font-medium list-decimal list-inside text-slate-600">
              <li>서비스 내의 콘텐츠, 소프트웨어, 디자인, 텍스트, 로고 등 모든 지식재산권은 회사에 귀속됩니다.</li>
              <li>이용자는 회사의 사전 서면 동의 없이 이를 복제, 수정, 배포하거나 외부에 제공할 수 없습니다.</li>
              <li>이용자가 제공한 데이터는 이용자 본인의 소유이나, 서비스 제공 목적에 따라 회사가 이를 처리·활용할 수 있는 권리를 가집니다.</li>
            </ol>
          </section>

          <section>
            <h2 className="text-xl font-black text-slate-900 mb-4">제 10조 (면책 조항)</h2>
            <ol className="space-y-2 font-medium list-decimal list-inside text-slate-600">
              <li>회사는 이용자의 귀책사유로 인한 서비스 이용 장애에 대해 책임을 지지 않습니다.</li>
              <li>제공되는 인공지능 산출물 정보의 정확성 및 완전성은 보장되지 않으며, 이용자가 해당 정보를 활용함으로써 발생하는 결과에 대해 책임지지 않습니다.</li>
            </ol>
          </section>

          <section>
            <h2 className="text-xl font-black text-slate-900 mb-4">제 11조 (분쟁 해결 및 준거법)</h2>
            <ol className="space-y-2 font-medium list-decimal list-inside text-slate-600">
              <li>본 약관은 대한민국 법률에 따라 해석되고 적용됩니다.</li>
              <li>서비스 이용과 관련하여 분쟁이 발생한 경우, 회사와 이용자는 상호 협의하여 해결하는 것을 원칙으로 합니다.</li>
              <li>협의가 이루어지지 않을 경우, 분쟁은 서울중앙지방법원을 통한 중재 절차로 진행됩니다.</li>
            </ol>
          </section>

          <section>
            <h2 className="text-xl font-black text-slate-900 mb-4">제 12조 (약관의 효력 및 변경)</h2>
            <ol className="space-y-2 font-medium list-decimal list-inside text-slate-600">
              <li>본 약관은 2025년 10월 10일부터 적용됩니다.</li>
              <li>회사는 필요 시 약관을 변경할 수 있으며, 약관 변경 최소 일주일 전 전체 사용자에게 고지하고 본 페이지에 게시합니다.</li>
            </ol>
          </section>

          <section className="bg-slate-50 rounded-2xl p-6">
            <h2 className="text-xl font-black text-slate-900 mb-4">문의처</h2>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm font-medium">
                <thead>
                  <tr className="bg-white">
                    <th className="border border-slate-200 px-4 py-3 text-left font-black text-slate-900">구분</th>
                    <th className="border border-slate-200 px-4 py-3 text-left font-black text-slate-900">내용</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="border border-slate-200 px-4 py-3">담당자</td>
                    <td className="border border-slate-200 px-4 py-3">{settings.privacy_manager_name}</td>
                  </tr>
                  <tr className="bg-white">
                    <td className="border border-slate-200 px-4 py-3">이메일</td>
                    <td className="border border-slate-200 px-4 py-3">{settings.privacy_manager_email}</td>
                  </tr>
                  <tr>
                    <td className="border border-slate-200 px-4 py-3">연락처</td>
                    <td className="border border-slate-200 px-4 py-3">{settings.privacy_manager_phone}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

        </div>
      </div>

      <footer className="border-t border-slate-100 py-8 text-center text-sm text-slate-400 font-medium">
        <p>© 2026 CON EDU. All rights reserved.</p>
      </footer>
    </div>
  );
}
