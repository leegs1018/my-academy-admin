import { NextRequest, NextResponse } from 'next/server';
import { requireSuperAdmin } from '../_auth';
import { createAdminClient } from '@/lib/supabase-admin';

export async function GET(request: NextRequest) {
  const authError = await requireSuperAdmin(request);
  if (authError) return authError;

  const db = createAdminClient();

  const [inquiriesRes, academiesRes, usersRes] = await Promise.all([
    db.from('inquiries').select('*').order('created_at', { ascending: false }),
    db.from('academy_config').select('user_id, academy_name'),
    db.auth.admin.listUsers({ perPage: 1000 }),
  ]);

  const academyMap: Record<string, string> = {};
  (academiesRes.data || []).forEach((a: any) => { academyMap[a.user_id] = a.academy_name; });

  const emailMap: Record<string, string> = {};
  (usersRes.data?.users || []).forEach((u: any) => { emailMap[u.id] = u.email; });

  const inquiries = (inquiriesRes.data || []).map((i: any) => ({
    ...i,
    academy_name: academyMap[i.academy_id] || '(알 수 없음)',
    email: emailMap[i.academy_id] || '',
  }));

  return NextResponse.json({ inquiries });
}
