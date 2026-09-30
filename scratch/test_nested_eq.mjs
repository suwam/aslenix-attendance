import { createClient } from '@supabase/supabase-js'

const url = process.env.VITE_SUPABASE_URL || "https://bbhsjjosmjtfmjveyjnf.supabase.co";
const key = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || "sb_publishable_SP_AYZvULQLkB2lMQUb3Eg_Vjhs_PxF";

const supabase = createClient(url, key);

async function test() {
  const { data, error } = await supabase
    .from("work_items")
    .select(`
      *,
      module_assignments!inner (
        id,
        user_id
      )
    `)
    .eq("module_assignments.user_id", "some-uuid");
    
  console.log("Error:", error);
  console.log("Data count:", data?.length);
}

test();
