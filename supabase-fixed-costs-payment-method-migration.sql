-- =============================================================
-- 고정비/단건 거래 등록에 결제수단 필드 추가.
-- 실행: Supabase Dashboard > SQL Editor
-- =============================================================

alter table fixed_costs add column if not exists payment_method text;
