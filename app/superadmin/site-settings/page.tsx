'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';

const FIELDS = [
  { key: 'company_name',           label: '법인명' },
  { key: 'company_address',        label: '사업장 소재지' },
  { key: 'privacy_manager_name',   label: '개인정보 보호 책임자' },
  { key: 'privacy_manager_phone',  label: '책임자 연락처' },
  { key: 'privacy_manager_email',  label: '책임자 이메일' },
];

export default function SiteSettingsPage() {
  const [values, setValues] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const load = async () => {
      const client = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      );
      const { data } = await client.from('site_settings').select('key, value');
      if (data) {
        const map: Record<string, string> = {};
        data.forEach((r: { key: string; value: string }) => { map[r.key] = r.value; });
        setValues(map);
      }
    };
    load();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    try {
      const res = await fetch('/api/superadmin/site-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings: values }),
      });
      if (res.ok) setSaved(true);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-2xl">
      <div className="mb-8">
        <h1 className="text-2xl font-black text-white mb-1">사이트 설정</h1>
        <p className="text-slate-400 font-medium text-sm">개인정보처리방침에 표시될 책임자 정보를 관리합니다.</p>
      </div>

      <div className="bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-800">
          <h2 className="text-base font-black text-white">개인정보 보호책임자 / 문의처</h2>
        </div>
        <div className="p-6 space-y-5">
          {FIELDS.map(f => (
            <div key={f.key}>
              <label className="block text-xs font-black text-slate-400 mb-1.5 uppercase tracking-wider">{f.label}</label>
              <input
                type="text"
                value={values[f.key] ?? ''}
                onChange={e => setValues(prev => ({ ...prev, [f.key]: e.target.value }))}
                className="w-full bg-slate-800 border border-slate-700 text-white font-medium text-sm px-4 py-3 rounded-xl focus:outline-none focus:border-indigo-500 placeholder-slate-600"
              />
            </div>
          ))}
        </div>
        <div className="px-6 py-4 border-t border-slate-800 flex items-center gap-4">
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-black text-sm rounded-xl transition-all disabled:opacity-50"
          >
            {saving ? '저장 중...' : '저장'}
          </button>
          {saved && <p className="text-sm font-bold text-green-400">✅ 저장되었습니다</p>}
        </div>
      </div>
    </div>
  );
}
