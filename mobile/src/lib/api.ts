import { getSupabaseClient } from './supabase';
import type { EventItem } from '../types';

export const fetchEvents = async () => {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.from('events').select('*').order('start', { ascending: true });
  if (error) throw error;
  return data as EventItem[];
};

export const fetchEventById = async (id: string) => {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.from('events').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return data as EventItem | null;
};

export const createEvent = async (event: Partial<EventItem>) => {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.from('events').insert([event]).select().single();
  if (error) throw error;
  return data as EventItem;
};

export const updateEvent = async (id: string, updates: Partial<EventItem>) => {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.from('events').update(updates).eq('id', id).select().single();
  if (error) throw error;
  return data as EventItem;
};

export const deleteEvent = async (id: string) => {
  const supabase = getSupabaseClient();
  const { error } = await supabase.from('events').delete().eq('id', id);
  if (error) throw error;
  return true;
};

export const fetchRides = async () => {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.from('rides').select('*').order('inserted_at', { ascending: true });
  if (error) throw error;
  return data;
};

export const assignDriver = async (rideId: string, userId: string) => {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.from('rides').update({ driver_profile_id: userId, status: 'assigned' }).eq('id', rideId).select().single();
  if (error) throw error;
  return data;
};
