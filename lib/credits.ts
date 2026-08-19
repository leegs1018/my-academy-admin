import { createAdminClient } from './supabase-admin';

export async function getFeaturePrice(featureKey: string): Promise<number> {
  const supabase = createAdminClient();

  // Build fallback key list: try exact key first, then known aliases
  const fallbacks: string[] = [featureKey];
  if (featureKey === 'pdf_analysis') fallbacks.push('pdf_analysis_direct');
  else if (featureKey === 'mock_workbook') fallbacks.push('pdf_analysis_direct');
  else if (featureKey === 'ai_question_per_type')
    fallbacks.push('ai_type_topic_title', 'ai_type_grammar', 'ai_type_vocab_paraphrase');
  else if (featureKey === 'mock_exam_question_per_type')
    fallbacks.push('mock_ai_type_topic_title', 'mock_ai_type_grammar', 'mock_ai_type_vocab_paraphrase');

  const { data } = await supabase
    .from('con_pricing')
    .select('feature_key, cost_per_use')
    .in('feature_key', fallbacks)
    .eq('is_active', true);

  for (const key of fallbacks) {
    const row = (data ?? []).find((r: { feature_key: string }) => r.feature_key === key);
    if (row) return (row as { cost_per_use: number }).cost_per_use;
  }
  return 0;
}

export async function deductCon(
  academyId: string,
  featureKey: string,
  units: number,
  description: string
): Promise<number> {
  const supabase = createAdminClient();
  const price = await getFeaturePrice(featureKey);
  const totalCost = price * units;

  const { data, error } = await supabase.rpc('deduct_con', {
    p_academy_id: academyId,
    p_amount: totalCost,
    p_feature_key: featureKey,
    p_description: description,
  });

  if (error) {
    if (error.message?.includes('INSUFFICIENT_CON')) {
      throw new Error('INSUFFICIENT_CON');
    }
    throw new Error(error.message);
  }

  return data as number;
}

export async function getConBalance(academyId: string): Promise<number> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from('academy_config')
    .select('points')
    .eq('user_id', academyId)
    .single();
  return data?.points ?? 0;
}
