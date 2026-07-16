import { createClient } from '@supabase/supabase-js';

export interface AttendancePayload {
  type: 'attendance';
  to: string;
  academyName: string;
  studentName: string;
  date: string;
  status: '등원' | '하원';
}

export interface GradePayload {
  type: 'grade';
  to: string;
  academyName: string;
  studentName: string;
  date: string;
  content: string;
}

export type AlimtalkPayload = AttendancePayload | GradePayload;

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function getPpurioConfig() {
  const { data } = await supabaseAdmin
    .from('site_settings')
    .select('key, value')
    .in('key', [
      'PPURIO_API_KEY',
      'PPURIO_ACCOUNT',
      'KAKAO_SENDER_KEY',
      'KAKAO_TEMPLATE_ARRIVAL_ID',
      'KAKAO_TEMPLATE_DEPARTURE_ID',
      'KAKAO_TEMPLATE_GRADE_ID',
    ]);
  const map: Record<string, string> = {};
  (data ?? []).forEach(row => { if (row.value) map[row.key] = row.value; });
  return {
    apiKey:           map['PPURIO_API_KEY']              || process.env.PPURIO_API_KEY,
    account:          map['PPURIO_ACCOUNT']              || process.env.PPURIO_ACCOUNT,
    senderProfile:    map['KAKAO_SENDER_KEY']            || process.env.KAKAO_SENDER_KEY,
    arrivalTplCode:   map['KAKAO_TEMPLATE_ARRIVAL_ID']   || process.env.KAKAO_TEMPLATE_ARRIVAL_ID,
    departureTplCode: map['KAKAO_TEMPLATE_DEPARTURE_ID'] || process.env.KAKAO_TEMPLATE_DEPARTURE_ID,
    gradeTplCode:     map['KAKAO_TEMPLATE_GRADE_ID']     || process.env.KAKAO_TEMPLATE_GRADE_ID,
  };
}

const PPURIO_BASE = process.env.PPURIO_PROXY_URL ?? 'http://49.247.137.90:3000';

async function getToken(account: string, apiKey: string): Promise<string> {
  const res = await fetch(`${PPURIO_BASE}/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`${account}:${apiKey}`).toString('base64')}`,
    },
  });
  const data = await res.json() as { token?: string };
  if (!data.token) throw new Error(`토큰 발급 실패: ${JSON.stringify(data)}`);
  return data.token;
}

export async function sendAlimtalk(payload: AlimtalkPayload): Promise<{ ok: boolean; error?: string }> {
  const cfg = await getPpurioConfig();

  if (!cfg.apiKey || !cfg.account || !cfg.senderProfile) {
    return { ok: false, error: '알림톡 채널이 아직 설정되지 않았습니다. 슈퍼어드민 사이트 설정에서 설정해주세요.' };
  }

  let tplCode: string | undefined;
  if (payload.type === 'attendance') {
    tplCode = payload.status === '등원' ? cfg.arrivalTplCode : cfg.departureTplCode;
  } else {
    tplCode = cfg.gradeTplCode;
  }

  if (!tplCode) {
    const label = payload.type === 'attendance'
      ? (payload.status === '등원' ? '등원' : '하원')
      : '성적';
    return { ok: false, error: `${label} 알림톡 템플릿이 설정되지 않았습니다.` };
  }

  // attendance: var1=[*1*](학원명), var2=[*2*](날짜), name=[*이름*](학생명)
  // grade:      var1=[*1*](학원명), var2=[*2*](날짜), var3=[*3*](성적내역), name=[*이름*](학생명)
  const changeWord = payload.type === 'attendance'
    ? { var1: payload.academyName, var2: payload.date }
    : { var1: payload.academyName, var2: payload.date, var3: payload.content };

  const token = await getToken(cfg.account, cfg.apiKey);

  const res = await fetch(`${PPURIO_BASE}/kakao`, {
    method: 'POST',
    headers: {
      Authorization:  `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      account:       cfg.account,
      messageType:   'ALT',
      senderProfile: cfg.senderProfile,
      templateCode:  tplCode,
      duplicateFlag: 'N',
      isResend:      'N',
      refKey:        `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      targetCount:   1,
      targets: [
        {
          to:         payload.to.replace(/-/g, ''),
          name:       payload.studentName,
          changeWord,
        },
      ],
    }),
  });

  const result = await res.json() as { code?: string; description?: string };
  console.log('[ppurio] 응답:', JSON.stringify({ type: payload.type, httpStatus: res.status, body: result }));

  if (result.code !== '1000') {
    return { ok: false, error: result.description || `code: ${result.code}` };
  }
  return { ok: true };
}
