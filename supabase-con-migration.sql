-- CON 시스템 마이그레이션
-- Supabase SQL Editor에서 실행하세요.

-- 1. con_transactions 테이블
CREATE TABLE IF NOT EXISTS con_transactions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  academy_id uuid NOT NULL,
  type text NOT NULL CHECK (type IN ('charge', 'deduct')),
  amount integer NOT NULL,
  balance_after integer NOT NULL,
  feature_key text,
  description text NOT NULL,
  created_at timestamptz DEFAULT now(),
  created_by text
);

CREATE INDEX IF NOT EXISTS idx_con_transactions_academy_id ON con_transactions(academy_id);
CREATE INDEX IF NOT EXISTS idx_con_transactions_created_at ON con_transactions(created_at DESC);

-- 2. con_pricing 테이블
CREATE TABLE IF NOT EXISTS con_pricing (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  feature_key text UNIQUE NOT NULL,
  feature_name text NOT NULL,
  cost_per_use integer NOT NULL,
  unit_description text,
  is_active boolean DEFAULT true,
  updated_at timestamptz DEFAULT now()
);

INSERT INTO con_pricing (feature_key, feature_name, cost_per_use, unit_description) VALUES
('sms', 'SMS 문자 발송', 10, '1건당'),
('ai_question', 'AI 문제 생성', 100, '1세트당')
ON CONFLICT (feature_key) DO NOTHING;

-- 3. RPC 함수: 원자적 CON 차감
CREATE OR REPLACE FUNCTION deduct_con(
  p_academy_id uuid,
  p_amount integer,
  p_feature_key text,
  p_description text
) RETURNS integer AS $$
DECLARE
  current_points integer;
  new_points integer;
BEGIN
  SELECT points INTO current_points FROM academy_config WHERE user_id = p_academy_id FOR UPDATE;
  IF current_points IS NULL THEN
    RAISE EXCEPTION 'ACADEMY_NOT_FOUND';
  END IF;
  IF current_points < p_amount THEN
    RAISE EXCEPTION 'INSUFFICIENT_CON';
  END IF;
  new_points := current_points - p_amount;
  UPDATE academy_config SET points = new_points WHERE user_id = p_academy_id;
  INSERT INTO con_transactions (academy_id, type, amount, balance_after, feature_key, description, created_by)
  VALUES (p_academy_id, 'deduct', p_amount, new_points, p_feature_key, p_description, 'system');
  RETURN new_points;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. RPC 함수: 원자적 CON 충전 (슈퍼어드민용)
CREATE OR REPLACE FUNCTION charge_con(
  p_academy_id uuid,
  p_amount integer,
  p_description text,
  p_created_by text DEFAULT 'superadmin'
) RETURNS integer AS $$
DECLARE
  current_points integer;
  new_points integer;
BEGIN
  SELECT points INTO current_points FROM academy_config WHERE user_id = p_academy_id FOR UPDATE;
  IF current_points IS NULL THEN
    RAISE EXCEPTION 'ACADEMY_NOT_FOUND';
  END IF;
  new_points := current_points + p_amount;
  UPDATE academy_config SET points = new_points WHERE user_id = p_academy_id;
  INSERT INTO con_transactions (academy_id, type, amount, balance_after, feature_key, description, created_by)
  VALUES (p_academy_id, 'charge', p_amount, new_points, NULL, p_description, p_created_by);
  RETURN new_points;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. GRANT & RLS 설정
-- service_role (서버 admin client) 전체 권한
GRANT SELECT, INSERT, UPDATE, DELETE ON public.con_transactions TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.con_pricing TO service_role;

-- authenticated 유저 권한
GRANT SELECT ON public.con_pricing TO authenticated;
GRANT SELECT ON public.con_transactions TO authenticated;

-- RLS 활성화
ALTER TABLE public.con_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.con_pricing ENABLE ROW LEVEL SECURITY;

-- con_pricing: 로그인한 유저 누구나 읽기 가능 (가격 정보는 공개)
CREATE POLICY "authenticated can read pricing"
  ON public.con_pricing FOR SELECT TO authenticated USING (true);

-- con_transactions: 본인 학원 거래 내역만 조회 가능
CREATE POLICY "academy can read own transactions"
  ON public.con_transactions FOR SELECT TO authenticated
  USING (auth.uid() = academy_id);
