-- =============================================================
-- PayApp 카드결제 실결제 금액(원) 추적 보강.
-- 문제: PayApp 콜백이 var3(실결제 금액)을 되돌려주지 않는 경우가 있어
--       con_transactions.amount_krw가 null로 남아 매출 분석에서 누락됨.
-- 해결: 결제 요청 시점에 "예정된 결제" 정보를 저장해두고, 콜백에서
--       var3가 없으면 이 테이블에서 academy_id + CON수량으로 매칭해 금액을 복구한다.
-- 실행: Supabase Dashboard > SQL Editor
-- =============================================================

create table if not exists payapp_pending_charges (
  id uuid primary key default gen_random_uuid(),
  academy_id uuid not null,
  con_amount integer not null,
  price_won integer not null,
  consumed boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists idx_payapp_pending_lookup
  on payapp_pending_charges(academy_id, con_amount, consumed, created_at);

alter table payapp_pending_charges enable row level security;
