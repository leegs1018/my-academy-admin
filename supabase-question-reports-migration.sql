-- 문제 품질 신고 시스템 마이그레이션
-- Supabase SQL Editor에서 실행하세요.

CREATE TABLE IF NOT EXISTS question_reports (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  academy_id uuid NOT NULL,
  user_email text NOT NULL,
  academy_name text NOT NULL,
  history_id text NOT NULL,
  question_index integer NOT NULL DEFAULT 0,
  question_type text NOT NULL,
  question_json jsonb NOT NULL,
  passage_text text,
  con_amount integer NOT NULL DEFAULT 1,
  rating text NOT NULL CHECK (rating IN ('good', 'bad')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_question_reports_academy_id ON question_reports(academy_id);
CREATE INDEX IF NOT EXISTS idx_question_reports_status ON question_reports(status);
CREATE INDEX IF NOT EXISTS idx_question_reports_created_at ON question_reports(created_at DESC);

-- RLS 비활성화 (서버 사이드 admin client 사용)
ALTER TABLE question_reports DISABLE ROW LEVEL SECURITY;
