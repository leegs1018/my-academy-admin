import type { Metadata } from 'next';
import './globals.css';
import ClientLayout from './ClientLayout';
import { createClient } from '@supabase/supabase-js';

export async function generateMetadata(): Promise<Metadata> {
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
    const logoUrl = data?.value || null;

    return {
      metadataBase: new URL('https://conedu.ai.kr'),
      title: {
        default: 'CON EDU | AI 영어 문제 자동 생성 솔루션',
        template: '%s | CON EDU',
      },
      description: '영어 학원 원장님을 위한 AI 문제 자동 생성 솔루션. 지문 분석, 실전·모의고사 변형 문제를 한 번에 생성하세요.',
      keywords: ['영어 문제 생성', 'AI 문제 출제', '학원 관리', '영어 학원', '변형 문제', '수능 영어', '영어 워크북', '모의고사 변형'],
      authors: [{ name: 'CON EDU', url: 'https://conedu.ai.kr' }],
      creator: 'CON EDU',
      ...(logoUrl && {
        icons: { icon: logoUrl, apple: logoUrl },
      }),
      openGraph: {
        type: 'website',
        locale: 'ko_KR',
        url: 'https://conedu.ai.kr',
        siteName: 'CON EDU',
        title: 'CON EDU | AI 영어 문제 자동 생성 솔루션',
        description: '영어 학원 원장님을 위한 AI 문제 자동 생성 솔루션. 지문 분석, 실전·모의고사 변형 문제를 한 번에 생성하세요.',
        ...(logoUrl && { images: [{ url: logoUrl }] }),
      },
      twitter: {
        card: 'summary_large_image',
        title: 'CON EDU | AI 영어 문제 자동 생성 솔루션',
        description: '영어 학원 원장님을 위한 AI 문제 자동 생성 솔루션.',
      },
      other: {
        'naver-site-verification': '327e345b04210ee776b92c4dedf512ffa1afb00b',
      },
    };
  } catch {
    return {
      title: 'CON EDU | AI 영어 문제 자동 생성 솔루션',
    };
  }
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>
        <ClientLayout>{children}</ClientLayout>
      </body>
    </html>
  );
}
