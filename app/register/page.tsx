import type { Metadata } from 'next';
import RegisterContent from './RegisterContent';

export const metadata: Metadata = {
  title: '무료 회원가입 | 콘에듀',
  description: '콘에듀 무료 계정을 만들고 AI 영어 변형문제 생성, 학원 출결관리, 카카오 알림톡을 지금 바로 시작하세요.',
  robots: { index: true, follow: true },
};

export default function RegisterPage() {
  return <RegisterContent />;
}
