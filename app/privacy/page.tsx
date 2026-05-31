'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import Link from 'next/link';

interface SiteSettings {
  company_name: string;
  company_address: string;
  privacy_manager_name: string;
  privacy_manager_phone: string;
  privacy_manager_email: string;
}

const DEFAULT_SETTINGS: SiteSettings = {
  company_name: '주식회사 비에프에이아이',
  company_address: '서울특별시 송파구 올림픽로 240, 스파크플러스 잠실점 230호(잠실동, 롯데월드웰빙센터)',
  privacy_manager_name: '김정태',
  privacy_manager_phone: '050-6707-0306',
  privacy_manager_email: 'contact@bfai.ai',
};

export default function PrivacyPage() {
  const [settings, setSettings] = useState<SiteSettings | null>(null);

  useEffect(() => {
    const load = async () => {
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      );
      const { data } = await supabase.from('site_settings').select('key, value');
      const map: Record<string, string> = {};
      if (data) data.forEach((r: { key: string; value: string }) => { map[r.key] = r.value; });
      setSettings({
        company_name: map.company_name ?? DEFAULT_SETTINGS.company_name,
        company_address: map.company_address ?? DEFAULT_SETTINGS.company_address,
        privacy_manager_name: map.privacy_manager_name ?? DEFAULT_SETTINGS.privacy_manager_name,
        privacy_manager_phone: map.privacy_manager_phone ?? DEFAULT_SETTINGS.privacy_manager_phone,
        privacy_manager_email: map.privacy_manager_email ?? DEFAULT_SETTINGS.privacy_manager_email,
      });
    };
    load();
  }, []);

  if (!settings) return null;

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
        <h1 className="text-3xl font-black text-slate-900 mb-2">개인정보처리방침</h1>
        <p className="text-slate-400 font-medium mb-12">최종 업데이트: 2025년 10월 10일</p>

        <div className="space-y-10 text-slate-700 leading-relaxed">

          <section>
            <h2 className="text-xl font-black text-slate-900 mb-4">개인정보 수집 및 이용 목적</h2>
            <p className="font-medium">{settings.company_name}(이하 "회사")는 다음의 목적을 위하여 개인정보를 처리합니다. 처리하고 있는 개인정보는 다음의 목적 이외의 용도로는 이용되지 않으며, 이용 목적이 변경되는 경우에는 개인정보보호법 제18조에 따라 별도의 동의를 받는 등 필요한 조치를 이행할 예정입니다.</p>
            <ul className="mt-4 space-y-2 font-medium list-disc list-inside text-slate-600">
              <li>회원 가입 및 관리</li>
              <li>서비스 제공 및 AI 문제 생성 기능 운영</li>
              <li>서비스 개선 및 신규 서비스 개발</li>
              <li>법령상 의무 이행</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-black text-slate-900 mb-4">수집하는 개인정보 항목</h2>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm font-medium">
                <thead>
                  <tr className="bg-slate-50">
                    <th className="border border-slate-200 px-4 py-3 text-left font-black text-slate-900">구분</th>
                    <th className="border border-slate-200 px-4 py-3 text-left font-black text-slate-900">수집 항목</th>
                    <th className="border border-slate-200 px-4 py-3 text-left font-black text-slate-900">수집 방법</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="border border-slate-200 px-4 py-3">필수</td>
                    <td className="border border-slate-200 px-4 py-3">이메일 주소, 학원명, 연락처</td>
                    <td className="border border-slate-200 px-4 py-3">회원가입 시 직접 입력</td>
                  </tr>
                  <tr className="bg-slate-50">
                    <td className="border border-slate-200 px-4 py-3">자동 수집</td>
                    <td className="border border-slate-200 px-4 py-3">서비스 이용 기록, 접속 로그</td>
                    <td className="border border-slate-200 px-4 py-3">서비스 이용 과정에서 자동 생성</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          <section>
            <h2 className="text-xl font-black text-slate-900 mb-4">개인정보 보유 및 이용 기간</h2>
            <p className="font-medium">회사는 법령에 따른 개인정보 보유·이용기간 또는 정보주체로부터 개인정보를 수집 시에 동의받은 개인정보 보유·이용기간 내에서 개인정보를 처리·보유합니다.</p>
            <ul className="mt-4 space-y-2 font-medium list-disc list-inside text-slate-600">
              <li>회원 탈퇴 시까지 (단, 관련 법령에 의거 보존이 필요한 경우 별도 보관)</li>
              <li>전자상거래 기록: 5년 (전자상거래 등에서의 소비자보호에 관한 법률)</li>
              <li>접속 로그: 3개월 (통신비밀보호법)</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-black text-slate-900 mb-4">개인정보 파기</h2>
            <p className="font-medium mb-3">목적이 달성되거나 보유 기간이 종료된 개인정보는 즉시 파기됩니다. 법령에 따라 보존이 필요한 경우 별도로 분리하여 안전하게 저장합니다.</p>
            <p className="font-black text-slate-900 mb-2">파기 방법</p>
            <ul className="space-y-1 font-medium list-disc list-inside text-slate-600">
              <li>전자파일: 복구 불가능한 기술적 방법으로 삭제</li>
              <li>종이문서: 분쇄 또는 소각</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-black text-slate-900 mb-4">개인정보의 제3자 제공</h2>
            <p className="font-medium mb-4">회사는 원칙적으로 개인정보를 외부에 제공하지 않습니다. 단, 다음의 경우 예외로 정보를 제공할 수 있습니다.</p>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm font-medium">
                <thead>
                  <tr className="bg-slate-50">
                    <th className="border border-slate-200 px-4 py-3 text-left font-black text-slate-900">제공받는 자</th>
                    <th className="border border-slate-200 px-4 py-3 text-left font-black text-slate-900">수집 항목</th>
                    <th className="border border-slate-200 px-4 py-3 text-left font-black text-slate-900">제공 근거</th>
                    <th className="border border-slate-200 px-4 py-3 text-left font-black text-slate-900">제공 목적</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="border border-slate-200 px-4 py-3">수사기관</td>
                    <td className="border border-slate-200 px-4 py-3">요청된 정보 일체</td>
                    <td className="border border-slate-200 px-4 py-3">「형사소송법」 등 관련 법령</td>
                    <td className="border border-slate-200 px-4 py-3">법적 절차에 따른 수사 목적</td>
                  </tr>
                  <tr className="bg-slate-50">
                    <td className="border border-slate-200 px-4 py-3">분석·통계 파트너사</td>
                    <td className="border border-slate-200 px-4 py-3">비식별화된 이용 데이터</td>
                    <td className="border border-slate-200 px-4 py-3">통계 및 분석</td>
                    <td className="border border-slate-200 px-4 py-3">서비스 개선 및 연구</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          <section>
            <h2 className="text-xl font-black text-slate-900 mb-4">이용자 및 법정대리인의 권리</h2>
            <p className="font-medium mb-3">이용자는 언제든지 다음과 같은 권리를 행사할 수 있습니다.</p>
            <ul className="space-y-2 font-medium list-disc list-inside text-slate-600">
              <li>개인정보 조회, 수정, 삭제 요청</li>
              <li>개인정보 이용 또는 처리의 제한 요청</li>
              <li>회원 탈퇴 및 수집·이용 동의 및 철회</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-black text-slate-900 mb-4">개인정보 보호를 위한 안전성 확보 조치</h2>
            <p className="font-medium mb-3">회사는 다음과 같은 방식으로 사용자 정보를 보호합니다.</p>
            <ul className="space-y-2 font-medium list-disc list-inside text-slate-600">
              <li>암호화: 저장 및 전송 중인 정보 암호화</li>
              <li>접근 통제: 인가된 인원만이 정보 접근 가능</li>
              <li>보안 점검: 정기적인 시스템 보안 검토 및 개선</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-black text-slate-900 mb-4">개인정보 보호책임자</h2>
            <p className="font-medium mb-4">이용자는 개인정보 관련 문의 및 요청을 아래 책임자에게 전달할 수 있습니다.</p>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm font-medium">
                <thead>
                  <tr className="bg-slate-50">
                    <th className="border border-slate-200 px-4 py-3 text-left font-black text-slate-900">구분</th>
                    <th className="border border-slate-200 px-4 py-3 text-left font-black text-slate-900">내용</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="border border-slate-200 px-4 py-3">법인명</td>
                    <td className="border border-slate-200 px-4 py-3">{settings.company_name}</td>
                  </tr>
                  <tr className="bg-slate-50">
                    <td className="border border-slate-200 px-4 py-3">사업장 소재지</td>
                    <td className="border border-slate-200 px-4 py-3">{settings.company_address}</td>
                  </tr>
                  <tr>
                    <td className="border border-slate-200 px-4 py-3">개인정보 보호 책임자</td>
                    <td className="border border-slate-200 px-4 py-3">{settings.privacy_manager_name}</td>
                  </tr>
                  <tr className="bg-slate-50">
                    <td className="border border-slate-200 px-4 py-3">책임자 연락처</td>
                    <td className="border border-slate-200 px-4 py-3">{settings.privacy_manager_phone}</td>
                  </tr>
                  <tr>
                    <td className="border border-slate-200 px-4 py-3">책임자 이메일</td>
                    <td className="border border-slate-200 px-4 py-3">{settings.privacy_manager_email}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          <section>
            <h2 className="text-xl font-black text-slate-900 mb-4">고지 의무 및 방침 변경</h2>
            <p className="font-medium">이 개인정보 처리 방침은 관련 법령 및 서비스 정책 변경에 따라 사전 공지 후 개정될 수 있으며, 개정 시 시행일자와 함께 본 페이지를 통해 공지합니다.</p>
          </section>

          <section>
            <h2 className="text-xl font-black text-slate-900 mb-4">문의처</h2>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm font-medium">
                <thead>
                  <tr className="bg-slate-50">
                    <th className="border border-slate-200 px-4 py-3 text-left font-black text-slate-900">구분</th>
                    <th className="border border-slate-200 px-4 py-3 text-left font-black text-slate-900">내용</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="border border-slate-200 px-4 py-3">담당자</td>
                    <td className="border border-slate-200 px-4 py-3">{settings.privacy_manager_name}</td>
                  </tr>
                  <tr className="bg-slate-50">
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
