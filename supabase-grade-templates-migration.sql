CREATE TABLE IF NOT EXISTS grade_message_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  academy_id UUID NOT NULL,
  title TEXT NOT NULL,
  header_template TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE grade_message_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users own grade templates"
  ON grade_message_templates FOR ALL
  USING (auth.uid() = academy_id);
