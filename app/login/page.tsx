import type { Metadata } from 'next';
import LoginContent from './LoginContent';

export const metadata: Metadata = {
  title: '로그인',
  description: 'CON EDU에 로그인하여 AI 영어 문제 생성 서비스를 이용하세요.',
  robots: { index: false, follow: false },
};

export default function LoginPage() {
  return <LoginContent />;
}
