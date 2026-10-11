import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase-admin';

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('Authorization');
    const token = authHeader?.replace('Bearer ', '');
    if (!token) return NextResponse.json({ ok: false }, { status: 401 });

    const admin = createAdminClient();
    const { data: { user } } = await admin.auth.getUser(token);
    if (!user) return NextResponse.json({ ok: false }, { status: 401 });

    const { eventName, metadata, referrerSource } = await request.json() as {
      eventName?: string; metadata?: Record<string, unknown>; referrerSource?: string;
    };
    if (!eventName || typeof eventName !== 'string') {
      return NextResponse.json({ ok: false }, { status: 400 });
    }

    const { error } = await admin.from('events_log').insert({
      user_id: user.id,
      event_name: eventName,
      metadata: metadata ?? null,
      referrer_source: referrerSource ?? null,
    });
    if (error) console.warn('[events_log] 기록 실패:', error.message);

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
