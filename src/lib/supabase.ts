import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;

/** Null when the env vars are missing; the app shows a setup message instead of crashing. */
export const supabase = url && key ? createClient(url, key) : null;

export const PHOTO_BUCKET = "visit-photos";
