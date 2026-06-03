import type { Metadata } from 'next';
import PrivacyContent from './PrivacyContent';

export const metadata: Metadata = {
  title: '개인정보처리방침',
  description: 'CON EDU 개인정보처리방침. 수집 항목, 이용 목적, 보유 기간 및 정보주체의 권리를 안내합니다.',
};

export default function PrivacyPage() {
  return <PrivacyContent />;
}
