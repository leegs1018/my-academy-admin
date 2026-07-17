import { NextRequest, NextResponse } from 'next/server';
import { requireSuperAdmin } from '../../_auth';
import { createAdminClient } from '@/lib/supabase-admin';
import CryptoJS from 'crypto-js';
import { sendPpurioSms } from '@/lib/ppurio';

export async function POST(request: NextRequest) {
  const authError = await requireSuperAdmin(request);
  if (authError) return authError;

  const { message, recipients, provider = 'solapi' } = await request.json() as {
    message: string;
    recipients: { academy_id: string; name: string; phone: string }[];
    provider?: 'solapi' | 'ppurio';
  };

  if (!message || !recipients || recipients.length === 0) {
    return NextResponse.json({ error: '메시지와 수신자를 입력해주세요.' }, { status: 400 });
  }

  const results: { academy_id: string; name: string; phone: string; status: 'success' | 'fail'; error?: string }[] = [];

  if (provider === 'ppurio') {
    for (const recipient of recipients) {
      try {
        const r = await sendPpurioSms(recipient.phone, message);
        results.push({ ...recipient, status: r.ok ? 'success' : 'fail', error: r.error });
      } catch (e: unknown) {
        results.push({ ...recipient, status: 'fail', error: e instanceof Error ? e.message : '오류' });
      }
    }
  } else {
    const apiKey = process.env.SOLAPI_API_KEY!;
    const apiSecret = process.env.SOLAPI_API_SECRET!;
    const sender = process.env.SOLAPI_SENDER_NUMBER!;

    for (const recipient of recipients) {
      const date = new Date().toISOString();
      const salt = Math.random().toString(36).substring(2, 12);
      const signature = CryptoJS.HmacSHA256(date + salt, apiSecret).toString();
      const authHeader = `HMAC-SHA256 apiKey=${apiKey}, date=${date}, salt=${salt}, signature=${signature}`;

      try {
        const res = await fetch('https://api.solapi.com/messages/v4/send', {
          method: 'POST',
          headers: { 'Authorization': authHeader, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: {
              to: recipient.phone.replace(/-/g, ''),
              from: sender.replace(/-/g, ''),
              text: message,
              subject: 'CON EDU',
            },
          }),
        });
        const result = await res.json();
        if (result.errorCode) {
          results.push({ ...recipient, status: 'fail', error: result.errorMessage || result.errorCode });
        } else {
          results.push({ ...recipient, status: 'success' });
        }
      } catch {
        results.push({ ...recipient, status: 'fail', error: '발송 서버 오류' });
      }
    }
  }

  const successCount = results.filter(r => r.status === 'success').length;
  const failCount = results.filter(r => r.status === 'fail').length;

  const db = createAdminClient();
  await db.from('superadmin_sms_logs').insert([{
    message,
    recipients: results,
    total_count: results.length,
    success_count: successCount,
    fail_count: failCount,
  }]);

  return NextResponse.json({ total: results.length, success: successCount, fail: failCount, results });
}
