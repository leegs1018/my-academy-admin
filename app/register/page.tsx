import type { Metadata } from 'next';
import RegisterContent from './RegisterContent';

export const metadata: Metadata = {
  title: '회원가입',
  description: 'CON EDU 계정을 만들고 AI 영어 문제 생성 서비스를 시작하세요.',
  robots: { index: false, follow: false },
};

export default function RegisterPage() {
  return <RegisterContent />;
}
