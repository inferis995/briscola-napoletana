import { createClient } from '@supabase/supabase-js';

// Progetto "classifica-briscola". La chiave publishable è pubblica per
// design (protetta da Row Level Security): può stare nel client. Le env
// var, se presenti su Vercel, hanno la precedenza.
const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://ilmukbdwcwgitwujjvcb.supabase.co';
const SUPABASE_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_BIF82w0UqTP498CjO2SBmA_Meg2NAyR';

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false },
});

// ===== TIPI =====
export interface Player {
  id: string;
  name: string;
  created_at: string;
}
export interface Couple {
  id: string;
  player1_id: string;
  player2_id: string;
  active: boolean;
  created_at: string;
}
export interface DayWin {
  id: string;
  played_on: string; // YYYY-MM-DD
  couple_id: string;
  wins: number;
}
