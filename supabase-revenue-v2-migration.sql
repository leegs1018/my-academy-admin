-- =============================================================
-- 매출 분석 2차 개편: 고정비(고정 매출/매입) 등록 + 환율 자동화.
-- 실행: Supabase Dashboard > SQL Editor
-- =============================================================

-- 1) 날짜별 USD/KRW 환율 캐시 — 외부 환율 API를 매번 호출하지 않도록 저장해둔다.
create table if not exists fx_rates (
  rate_date date primary key,
  usd_krw numeric not null,
  fetched_at timestamptz not null default now()
);

-- 2) 고정적으로 반복되는 매출/매입(예: 서버 유지비) 등록.
create table if not exists fixed_costs (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('revenue', 'expense')), -- 매출 / 매입
  title text not null,
  description text,
  start_date date not null,
  end_date date, -- null이면 계속 반복(마감일 없음)
  repeat_cycle text not null check (repeat_cycle in ('weekly', 'monthly')), -- 매주 / 매월
  currency text not null check (currency in ('KRW', 'USD')) default 'KRW',
  amount numeric not null, -- 원화면 원 단위, 달러면 USD 단위 원본 금액
  created_at timestamptz not null default now(),
  created_by text
);

create index if not exists idx_fixed_costs_dates on fixed_costs(start_date, end_date);

-- 3) RLS 활성화 — 두 테이블 모두 슈퍼어드민 API(서비스 롤)로만 접근하므로
--    별도 정책 없이 활성화만 해서 anon/authenticated 키의 직접 접근을 차단한다.
alter table fx_rates enable row level security;
alter table fixed_costs enable row level security;
