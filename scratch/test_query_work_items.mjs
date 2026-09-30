import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error("Missing env vars");
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function test() {
  const { data, error } = await supabase
    .from("work_items")
    .select(`
      *,
      module_assignments!inner (
        user_id,
        role,
        sprint_modules (
          modules ( name ),
          weekly_sprints ( target_date )
        )
      )
    `)
    .limit(5);
  
  if (error) console.error("Error:", error);
  console.log("Data:", JSON.stringify(data, null, 2));
}

test();
