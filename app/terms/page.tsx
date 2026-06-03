import type { Metadata } from 'next';
import TermsContent from './TermsContent';

export const metadata: Metadata = {
  title: '이용약관',
  description: 'CON EDU 서비스 이용약관. 서비스 이용 조건, 회원 권리·의무, 유료 서비스 정책을 안내합니다.',
};

export default function TermsPage() {
  return <TermsContent />;
}
