import { getSupabaseClient } from './supabase';

export const getProfile = async (userId: string) => {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle();
  if (error && error.code !== 'PGRST116') throw error;
  return data;
};

export const upsertProfile = async (profile: { id: string; display_name?: string; email?: string; avatar_url?: string }) => {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.from('profiles').upsert(profile).select().single();
  if (error) throw error;
  return data;
};

export const createHouseholdWithMember = async (name: string, profileId: string) => {
  const supabase = getSupabaseClient();
  // Create household
  const { data: household, error: hErr } = await supabase.from('households').insert({ name, created_by: profileId }).select().single();
  if (hErr) throw hErr;
  // Add membership
  const { data: member, error: mErr } = await supabase.from('household_members').insert({ household_id: household.id, profile_id: profileId, role: 'owner' }).select().single();
  if (mErr) throw mErr;
  return { household, member };
};

export const joinHouseholdById = async (householdId: string, profileId: string) => {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.from('household_members').upsert({ household_id: householdId, profile_id: profileId, role: 'member' }).select().single();
  if (error) throw error;
  return data;
};
