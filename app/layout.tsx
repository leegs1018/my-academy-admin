import type { Metadata } from 'next';
import './globals.css';
import { createClient } from '@supabase/supabase-js';

const BASE_URL = 'https://conedu.ai.kr';

export async function generateMetadata(): Promise<Metadata> {
  let logoUrl: string | null = null;
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    const { data } = await supabase
      .from('site_settings')
      .select('value')
      .eq('key', 'site_logo_url')
      .single();
    logoUrl = data?.value || null;
  } catch {}

  const title = '콘에듀 | AI 영어 문제 생성, 학원 관리 솔루션';
  const description =
    '콘에듀(CON EDU) — 영어 학원을 위한 AI 올인원 솔루션. 지문분석·워크북·수능 영어 변형문제를 AI로 즉시 생성하고, 학생 출결관리·카카오 알림톡·키오스크까지 한 플랫폼에서 해결하세요.';
  const keywords = [
    '콘에듀', 'conedu', 'CON EDU',
    '영어 변형문제', '영어 문제 생성', '영어 문제 자동 생성',
    '수능 영어 변형문제', '영어 워크북', '영어 지문분석',
    'AI 영어 학원', '영어 학원 관리', '학원 관리 프로그램',
    '학원 출결 관리', '학원 알림톡', '카카오 알림톡 학원',
    '학원 키오스크', '출결 키오스크',
    '영어 모의고사 변형', '수능 영어 문제 생성',
    '영어 학원 솔루션', '학원 관리 솔루션',
  ];

  return {
    metadataBase: new URL(BASE_URL),
    title: {
      default: title,
      template: '%s | 콘에듀',
    },
    description,
    keywords,
    authors: [{ name: '콘에듀', url: BASE_URL }],
    creator: '콘에듀 CON EDU',
    publisher: '콘에듀',
    robots: {
      index: true,
      follow: true,
      googleBot: { index: true, follow: true },
    },
    alternates: {
      canonical: BASE_URL,
    },
    ...(logoUrl && {
      icons: { icon: logoUrl, apple: logoUrl },
    }),
    openGraph: {
      type: 'website',
      locale: 'ko_KR',
      url: BASE_URL,
      siteName: '콘에듀 CON EDU',
      title,
      description,
      ...(logoUrl && { images: [{ url: logoUrl, width: 1200, height: 630, alt: '콘에듀 AI 영어 학원 솔루션' }] }),
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
    },
    other: {
      'naver-site-verification': '327e345b04210ee776b92c4dedf512ffa1afb00b',
    },
  };
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <head>
        {/* JSON-LD 구조화 데이터 — 구글·네이버 리치결과 */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'SoftwareApplication',
              name: '콘에듀 (CON EDU)',
              url: BASE_URL,
              applicationCategory: 'EducationalApplication',
              operatingSystem: 'Web',
              description: 'AI 영어 변형문제 생성 및 학원 관리 올인원 솔루션',
              offers: { '@type': 'Offer', price: '0', priceCurrency: 'KRW' },
              provider: {
                '@type': 'Organization',
                name: '콘에듀',
                url: BASE_URL,
              },
              featureList: [
                'AI 영어 변형문제 자동 생성',
                '수능 영어 지문분석',
                '영어 워크북 생성',
                '학원 학생 관리',
                '출결 키오스크',
                '카카오 알림톡 출결 알림',
              ],
            }),
          }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
