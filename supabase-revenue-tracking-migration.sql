-- =============================================================
-- 매출 분석 기능을 위한 실제 결제 금액(원) 추적.
-- 지금까지는 CON 거래 내역에 "몇 CON"만 남고 실제 결제 금액(원)이나
-- 무료 지급 여부가 제대로 저장되지 않았다. 이 마이그레이션 이후부터
-- 발생하는 거래는 실제 매출을 정확히 집계할 수 있고, 이전 거래는
-- amount_krw가 비어있어 매출 집계에서 자동으로 제외된다.
-- 실행: Supabase Dashboard > SQL Editor
-- =============================================================

alter table con_transactions add column if not exists is_free boolean not null default false;
alter table con_transactions add column if not exists amount_krw integer;

-- charge_con: feature_key / 무료 지급 여부 / 실제 결제 금액(원)을 받아 저장하도록 확장.
-- 기존 호출부는 새 파라미터를 안 보내도 전부 기본값으로 그대로 동작한다.
create or replace function charge_con(
  p_academy_id uuid,
  p_amount integer,
  p_description text,
  p_created_by text default 'superadmin',
  p_feature_key text default null,
  p_is_free boolean default false,
  p_amount_krw integer default null
) returns integer as $$
declare
  current_points integer;
  new_points integer;
begin
  select points into current_points from academy_config where user_id = p_academy_id for update;
  if current_points is null then
    raise exception 'ACADEMY_NOT_FOUND';
  end if;
  new_points := current_points + p_amount;
  update academy_config set points = new_points where user_id = p_academy_id;
  insert into con_transactions (academy_id, type, amount, balance_after, feature_key, description, created_by, is_free, amount_krw)
  values (p_academy_id, 'charge', p_amount, new_points, p_feature_key, p_description, p_created_by, p_is_free, p_amount_krw);
  return new_points;
end;
$$ language plpgsql security definer;

-- deduct_con: 환불 시 실제 환불 금액(원)도 함께 저장할 수 있도록 확장.
create or replace function deduct_con(
  p_academy_id uuid,
  p_amount integer,
  p_feature_key text,
  p_description text,
  p_amount_krw integer default null
) returns integer as $$
declare
  current_points integer;
  new_points integer;
begin
  select points into current_points from academy_config where user_id = p_academy_id for update;
  if current_points is null then
    raise exception 'ACADEMY_NOT_FOUND';
  end if;
  if current_points < p_amount then
    raise exception 'INSUFFICIENT_CON';
  end if;
  new_points := current_points - p_amount;
  update academy_config set points = new_points where user_id = p_academy_id;
  insert into con_transactions (academy_id, type, amount, balance_after, feature_key, description, created_by, amount_krw)
  values (p_academy_id, 'deduct', p_amount, new_points, p_feature_key, p_description, 'system', p_amount_krw);
  return new_points;
end;
$$ language plpgsql security definer;
