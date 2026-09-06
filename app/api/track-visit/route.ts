import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase-admin';

function parseReferrerSource(referrer: string, utmSource: string): string {
  if (utmSource) {
    const utm = utmSource.toLowerCase();
    if (utm === 'naver' || utm.includes('naver')) return '네이버';
    if (utm === 'threads' || utm.includes('threads')) return '쓰레드';
    if (utm === 'instagram' || utm.includes('instagram')) return '인스타그램';
    if (utm === 'kakao' || utm.includes('kakao')) return '카카오';
    if (utm === 'google' || utm.includes('google')) return '구글';
    if (utm === 'facebook' || utm.includes('facebook')) return '페이스북';
    if (utm === 'youtube' || utm.includes('youtube')) return '유튜브';
    if (utm === 'twitter' || utm === 'x' || utm.includes('twitter')) return 'X(트위터)';
    return utmSource;
  }
  if (!referrer) return '직접';
  try {
    const host = new URL(referrer).hostname.replace(/^www\./, '');
    if (host.includes('naver.')) return '네이버';
    if (host.includes('threads.net') || host.includes('threads.com')) return '쓰레드';
    if (host.includes('instagram.com')) return '인스타그램';
    if (host.includes('kakao.') || host.includes('kakaotalk.')) return '카카오';
    if (host.includes('google.')) return '구글';
    if (host.includes('facebook.com')) return '페이스북';
    if (host.includes('youtube.com')) return '유튜브';
    if (host.includes('twitter.com') || host === 'x.com') return 'X(트위터)';
    if (host.includes('blog.naver') || host.includes('m.blog.naver')) return '네이버 블로그';
    if (host.includes('cafe.naver')) return '네이버 카페';
    return host;
  } catch {
    return '기타';
  }
}

export async function POST(req: NextRequest) {
  try {
    const forwarded = req.headers.get('x-forwarded-for');
    const ip = forwarded ? forwarded.split(',')[0].trim() : (req.headers.get('x-real-ip') ?? 'unknown');

    const todayKST = new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);

    let referrer = '';
    let utmSource = '';
    try {
      const body = await req.json();
      referrer = body.referrer ?? '';
      utmSource = body.utmSource ?? '';
    } catch { /* body 없으면 무시 */ }

    const referrer_source = parseReferrerSource(referrer, utmSource);

    const db = createAdminClient();
    await db.from('site_visits').upsert(
      { ip_address: ip, visited_date: todayKST, referrer_source },
      { onConflict: 'ip_address,visited_date', ignoreDuplicates: true }
    );

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false });
  }
}
