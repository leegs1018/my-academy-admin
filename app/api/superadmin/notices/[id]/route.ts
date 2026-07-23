import { NextRequest, NextResponse } from 'next/server';
import { requireSuperAdmin } from '../../_auth';
import { createAdminClient } from '@/lib/supabase-admin';

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const authError = await requireSuperAdmin(request);
  if (authError) return authError;

  const { id } = await params;
  const body = await request.json() as { title?: string; content?: string; is_important?: boolean };
  const db = createAdminClient();
  const { error } = await db
    .from('system_notices')
    .update(body)
    .eq('id', id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const authError = await requireSuperAdmin(request);
  if (authError) return authError;

  const { id } = await params;
  const db = createAdminClient();
  const { error } = await db.from('system_notices').delete().eq('id', id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
