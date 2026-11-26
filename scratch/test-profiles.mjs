import { createClient } from "@supabase/supabase-js";
import fs from "fs";

const env = fs.readFileSync(".env", "utf8");
let url = "";
let key = "";
for (const line of env.split("\n")) {
  if (line.startsWith("VITE_SUPABASE_URL=")) url = line.split("=")[1].trim().replace(/^["']|["']$/g, "");
  if (line.startsWith("VITE_SUPABASE_PUBLISHABLE_KEY=")) key = line.split("=")[1].trim().replace(/^["']|["']$/g, "");
}
const supabase = createClient(url, key);

async function run() {
  const { data, error } = await supabase.from("profiles").select("user_id,full_name,email,approval_status,is_suspended,department,user_roles(role)").order("full_name");
  console.log("profilesResult:", { count: data?.length, error, sample: data?.[0] });

  const { data: simpleProfs, error: simpleErr } = await supabase.from("profiles").select("user_id,full_name,email,approval_status,is_suspended,department").order("full_name");
  console.log("simpleProfs:", { count: simpleProfs?.length, simpleErr, sample: simpleProfs?.[0] });
}
run();
