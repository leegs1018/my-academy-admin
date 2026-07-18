import { NextRequest, NextResponse } from 'next/server';
import { requireSuperAdmin } from '../_auth';
import { createAdminClient } from '@/lib/supabase-admin';

export async function GET(request: NextRequest) {
  const authError = await requireSuperAdmin(request);
  if (authError) return authError;

  const db = createAdminClient();
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const [inquiriesRes, academiesRes, reportsRes] = await Promise.all([
    db.from('inquiries').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
    db.from('academy_config').select('*', { count: 'exact', head: true }).gte('created_at', sevenDaysAgo),
    db.from('question_reports').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
  ]);

  return NextResponse.json({
    inquiries: inquiriesRes.count ?? 0,
    newAcademies: academiesRes.count ?? 0,
    reports: reportsRes.count ?? 0,
  });
}
