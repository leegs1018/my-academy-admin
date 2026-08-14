import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase-admin';

export async function POST(req: NextRequest) {
  try {
    // IP 추출 (Vercel/프록시 환경 대응)
    const forwarded = req.headers.get('x-forwarded-for');
    const ip = forwarded ? forwarded.split(',')[0].trim() : (req.headers.get('x-real-ip') ?? 'unknown');

    // 오늘 날짜 (KST)
    const todayKST = new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);

    const db = createAdminClient();
    // 같은 IP + 같은 날이면 무시 (ON CONFLICT DO NOTHING)
    await db.from('site_visits').upsert(
      { ip_address: ip, visited_date: todayKST },
      { onConflict: 'ip_address,visited_date', ignoreDuplicates: true }
    );

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false });
  }
}
