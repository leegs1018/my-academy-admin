import { NextRequest, NextResponse } from 'next/server';
import { createHmac } from 'crypto';
import { supabase } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('Authorization');
  const token = authHeader?.replace('Bearer ', '');
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const secret = process.env.CHANNEL_TALK_SECRET;
  if (!secret) return NextResponse.json({ error: 'Server config missing' }, { status: 500 });

  const memberHash = createHmac('sha256', secret).update(user.id).digest('hex');
  return NextResponse.json({ memberHash });
}
