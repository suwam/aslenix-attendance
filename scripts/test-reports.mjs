import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://bbhsjjosmjtfmjveyjnf.supabase.co";
const SUPABASE_SERVICE_KEY = "sb_secret_H3s1hhz8p1TCPWDoVn5wxA_iS4IHFo4";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function run() {
  const { data, error } = await supabase.from("weekly_standup_reports").select("*");
  console.log("Error:", error);
  console.log("Count:", data?.length);
  console.log("Sample:", data?.[0]);
}

run();
