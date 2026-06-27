import type { Metadata } from 'next';
import LandingPageClient from './LandingPageClient';

export const metadata: Metadata = {
  title: { absolute: 'CON EDU | AI 영어 문제 자동 생성 솔루션' },
  description: '영어 학원 원장님을 위한 AI 문제 자동 생성 솔루션. 지문분석 워크북, 실전 변형 문제(9가지 유형), 어휘 선택 문제를 한 번에 생성하세요.',
  openGraph: {
    title: 'CON EDU | AI 영어 문제 자동 생성 솔루션',
    description: '영어 학원 원장님을 위한 AI 문제 자동 생성 솔루션. 지문분석 워크북, 실전 변형 문제(9가지 유형), 어휘 선택 문제를 한 번에 생성하세요.',
    url: 'https://conedu.ai.kr',
    type: 'website',
  },
};

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'CON EDU',
  url: 'https://conedu.ai.kr',
  description: '영어 학원 원장님을 위한 AI 문제 자동 생성 솔루션. 지문분석 워크북, 실전 변형 문제(9가지 유형), 어휘 선택 문제를 한 번에 생성하세요.',
  applicationCategory: 'EducationApplication',
  operatingSystem: 'Web',
  offers: {
    '@type': 'Offer',
    price: '0',
    priceCurrency: 'KRW',
    description: '무료로 시작 가능',
  },
  provider: {
    '@type': 'Organization',
    name: '주식회사 비에프에이아이',
    url: 'https://conedu.ai.kr',
  },
};

export default function LandingPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <LandingPageClient />
    </>
  );
}
