-- =============================================================
-- 고정비 등록에 "단건(반복 없음)" 옵션 추가.
-- 실행: Supabase Dashboard > SQL Editor
-- =============================================================

alter table fixed_costs drop constraint if exists fixed_costs_repeat_cycle_check;
alter table fixed_costs add constraint fixed_costs_repeat_cycle_check
  check (repeat_cycle in ('weekly', 'monthly', 'once'));
