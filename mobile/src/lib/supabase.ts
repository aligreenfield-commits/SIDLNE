import { createClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';

export const getSupabaseClient = () =>
  createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: true,
      storage: {
        getItem: async (key: string) => {
          const value = await SecureStore.getItemAsync(key);
          return value ?? null;
        },
        setItem: async (key: string, value: string) => {
          await SecureStore.setItemAsync(key, value);
        },
        removeItem: async (key: string) => {
          await SecureStore.deleteItemAsync(key);
        },
      },
    },
  });
