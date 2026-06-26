import { NextRequest, NextResponse } from 'next/server';
import { requireSuperAdmin } from '../../_auth';
import { createAdminClient } from '@/lib/supabase-admin';
import { createServerClient, type CookieOptions } from '@supabase/ssr';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const authError = await requireSuperAdmin(request);
  if (authError) return authError;

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) { return request.cookies.get(name)?.value; },
        set(_name: string, _value: string, _options: CookieOptions) {},
        remove(_name: string, _options: CookieOptions) {},
      },
    }
  );
  const { data: { user } } = await supabase.auth.getUser();

  const { action } = await request.json() as { action: 'approve' | 'reject' };
  if (!action || !['approve', 'reject'].includes(action)) {
    return NextResponse.json({ error: '잘못된 action입니다.' }, { status: 400 });
  }

  const db = createAdminClient();

  // 신고 조회
  const { data: report, error: fetchErr } = await db
    .from('question_reports')
    .select('*')
    .eq('id', id)
    .single();

  if (fetchErr || !report) {
    return NextResponse.json({ error: '신고를 찾을 수 없습니다.' }, { status: 404 });
  }
  if (report.status !== 'pending') {
    return NextResponse.json({ error: '이미 처리된 신고입니다.' }, { status: 400 });
  }

  // 상태 업데이트
  const { error: updateErr } = await db
    .from('question_reports')
    .update({ status: action === 'approve' ? 'approved' : 'rejected' })
    .eq('id', id);

  if (updateErr) {
    return NextResponse.json({ error: updateErr.message }, { status: 500 });
  }

  // 승인 시 CON 환불
  if (action === 'approve') {
    const { data: conData, error: conError } = await db.rpc('charge_con', {
      p_academy_id: report.academy_id,
      p_amount: report.con_amount,
      p_description: `문제 품질 신고 환불 (${report.question_type} 유형)`,
      p_created_by: user?.email ?? 'superadmin',
    });

    if (conError) {
      return NextResponse.json({ error: `CON 환불 실패: ${conError.message}` }, { status: 500 });
    }

    return NextResponse.json({ success: true, action: 'approved', new_balance: conData });
  }

  return NextResponse.json({ success: true, action: 'rejected' });
}
