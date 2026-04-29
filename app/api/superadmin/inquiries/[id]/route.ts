import { NextRequest, NextResponse } from 'next/server';
import { requireSuperAdmin } from '../../_auth';
import { createAdminClient } from '@/lib/supabase-admin';

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const authError = await requireSuperAdmin(request);
  if (authError) return authError;

  const { id } = await params;
  const { answer } = await request.json();
  if (!answer?.trim()) {
    return NextResponse.json({ error: '답변 내용을 입력해주세요.' }, { status: 400 });
  }

  const db = createAdminClient();
  const { error } = await db
    .from('inquiries')
    .update({ answer, status: 'answered', answered_at: new Date().toISOString() })
    .eq('id', id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
