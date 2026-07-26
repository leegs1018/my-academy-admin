import { createAdminClient } from './supabase-admin';

export async function getFeaturePrice(featureKey: string): Promise<number> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from('con_pricing')
    .select('cost_per_use')
    .eq('feature_key', featureKey)
    .eq('is_active', true)
    .single();
  return data?.cost_per_use ?? 0;
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
