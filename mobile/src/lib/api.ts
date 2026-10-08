import { getSupabaseClient } from './supabase';
import type { EventItem } from '../types';

const getCurrentUserId = async () => {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  return data.session?.user?.id ?? null;
};

const getCurrentHouseholdId = async () => {
  const supabase = getSupabaseClient();
  const userId = await getCurrentUserId();
  if (!userId) return null;

  const { data, error } = await supabase
    .from('household_members')
    .select('household_id')
    .eq('profile_id', userId)
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data?.household_id ?? null;
};

const parseDate = (value?: string | Date | null) => {
  if (!value && value !== 0) return null;
  const d = typeof value === 'string' ? new Date(value) : new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d;
};

const normalizeEventPayload = (event: Partial<EventItem>) => {
  const payload: Record<string, any> = { ...event };

  if (payload.title !== undefined && typeof payload.title === 'string') {
    payload.title = payload.title.trim();
    if (!payload.title) delete payload.title;
  }

  if (payload.location !== undefined && typeof payload.location === 'string') {
    payload.location = payload.location.trim();
    if (!payload.location) delete payload.location;
  }

  // Accept Date or ISO string and convert to canonical ISO string stored in DB
  if (payload.start !== undefined) {
    const d = parseDate(payload.start as any);
    if (d) payload.start = d.toISOString();
    else delete payload.start;
  }

  if (payload.end !== undefined) {
    const d = parseDate(payload.end as any);
    if (d) payload.end = d.toISOString();
    else delete payload.end;
  }

  if (payload.athlete !== undefined && typeof payload.athlete === 'string') {
    payload.athlete = payload.athlete.trim();
    if (!payload.athlete) delete payload.athlete;
  }

  return payload;
};

export const fetchEvents = async () => {
  const supabase = getSupabaseClient();
  const userId = await getCurrentUserId();
  if (!userId) return [];

  const householdId = await getCurrentHouseholdId();

  let query = supabase.from('events').select('*');

  if (householdId) {
    query = query.eq('household_id', householdId);
  } else {
    query = query.eq('created_by', userId);
  }

  const { data, error } = await query.order('start', { ascending: true });
  if (error) throw error;
  return (data ?? []) as EventItem[];
};

export const fetchEventById = async (id: string) => {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.from('events').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  const ev = data as EventItem | null;
  if (!ev) return null;

  // Enforce household scoping client-side as a second defense (RLS should be primary)
  const userId = await getCurrentUserId();
  const householdId = await getCurrentHouseholdId();

  if (householdId && ev.household_id === householdId) return ev;
  if (ev.created_by === userId) return ev;

  // Not visible to this user/household
  return null;
};

export const createEvent = async (event: Partial<EventItem>) => {
  const supabase = getSupabaseClient();
  const userId = await getCurrentUserId();
  if (!userId) throw new Error('You must be signed in to create an event.');

  const householdId = await getCurrentHouseholdId();
  if (!householdId) throw new Error('Create a household before adding events.');

  const normalized = normalizeEventPayload(event);
  if (!normalized.title || !normalized.start) {
    throw new Error('Title and start time are required.');
  }

  // Validate start/end ordering
  if (normalized.end) {
    const s = new Date(normalized.start);
    const e = new Date(normalized.end);
    if (s.getTime() >= e.getTime()) throw new Error('End time must be after start time.');
  }

  const payload = { ...normalized, created_by: userId, household_id: householdId };
  const { data, error } = await supabase.from('events').insert([payload]).select().single();
  if (error) throw error;
  return data as EventItem;
};

export const updateEvent = async (id: string, updates: Partial<EventItem>) => {
  const supabase = getSupabaseClient();
  const normalized = normalizeEventPayload(updates);

  if (normalized.title !== undefined && (!normalized.title || !normalized.title.trim())) {
    throw new Error('Title cannot be empty.');
  }

  if (normalized.start !== undefined && (!normalized.start || !normalized.start.trim())) {
    throw new Error('Start time cannot be empty.');
  }

  // If both start and end are present (either in updates or already in DB), ensure ordering.
  if (normalized.start || normalized.end) {
    // Fetch current event to get any missing values
    const current = await fetchEventById(id);
    const startIso = normalized.start ?? current?.start;
    const endIso = normalized.end ?? current?.end;
    if (startIso && endIso) {
      const s = new Date(startIso);
      const e = new Date(endIso);
      if (s.getTime() >= e.getTime()) throw new Error('End time must be after start time.');
    }
  }

  const { data, error } = await supabase.from('events').update(normalized).eq('id', id).select().single();
  if (error) throw error;
  return data as EventItem;
};

export const deleteEvent = async (id: string) => {
  const supabase = getSupabaseClient();
  const { error } = await supabase.from('events').delete().eq('id', id);
  if (error) throw error;
  return true;
};

// Rides helpers
export const fetchRides = async () => {
  const supabase = getSupabaseClient();
  const userId = await getCurrentUserId();
  if (!userId) return [];

  const householdId = await getCurrentHouseholdId();

  // select ride fields and join event and driver profile (adjust relation names if needed)
  let query = supabase
    .from('rides')
    .select('*, event:events(*), driver:profiles(display_name)')
    .order('inserted_at', { ascending: true });

  if (householdId) {
    query = query.eq('household_id', householdId);
  } else {
    query = query.eq('created_by', userId);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
};

export const createRide = async (ride: Partial<any>) => {
  const supabase = getSupabaseClient();
  const userId = await getCurrentUserId();
  if (!userId) throw new Error('Sign in required');

  const householdId = await getCurrentHouseholdId();
  if (!householdId) throw new Error('Create a household before adding rides.');

  const payload = { ...ride, created_by: userId, household_id: householdId, status: 'open' };
  const { data, error } = await supabase.from('rides').insert([payload]).select().single();
  if (error) throw error;
  return data;
};

export const takeRide = async (rideId: string, userId: string) => {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('rides')
    .update({ driver_profile_id: userId, status: 'assigned' })
    .eq('id', rideId)
    .select()
    .single();
  if (error) throw error;
  return data;
};

export const unassignRide = async (rideId: string) => {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('rides')
    .update({ driver_profile_id: null, status: 'open' })
    .eq('id', rideId)
    .select()
    .single();
  if (error) throw error;
  return data;
};

export const cancelRide = async (rideId: string) => {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('rides')
    .update({ status: 'cancelled' })
    .eq('id', rideId)
    .select()
    .single();
  if (error) throw error;
  return data;
};

export const updateRide = async (rideId: string, updates: Partial<any>) => {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('rides')
    .update(updates)
    .eq('id', rideId)
    .select()
    .single();
  if (error) throw error;
  return data;
};
