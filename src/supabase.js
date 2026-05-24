import { createClient } from "@supabase/supabase-js";

export const supabase = createClient(
  "YOUR_SUPABASE_URL",
  "YOUR_ANON_KEY"
);