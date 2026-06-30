import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";

const envPath = path.resolve(process.cwd(), ".env");
const envContent = fs.readFileSync(envPath, "utf-8");

const env = {};
envContent.split("\n").forEach((line) => {
  const parts = line.split("=");
  if (parts.length >= 2) {
    const key = parts[0].trim();
    let val = parts.slice(1).join("=").trim();
    if (val.startsWith('"') && val.endsWith('"')) {
      val = val.substring(1, val.length - 1);
    }
    val = val.replace(/\r$/, '');
    env[key] = val;
  }
});

const supabaseUrl = env.VITE_SUPABASE_URL || env.SUPABASE_URL;
const supabaseKey = env.VITE_SUPABASE_PUBLISHABLE_KEY || env.SUPABASE_PUBLISHABLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { data: profiles, error: pErr } = await supabase.from("profiles").select("*");
  if (pErr) console.error("Profiles Error:", pErr);
  else console.log("PROFILES:", profiles.map(p => ({ user_id: p.user_id, name: p.full_name, position: p.position, dept: p.department })));

  const { data: roles, error: rErr } = await supabase.from("user_roles").select("*");
  if (rErr) console.error("Roles Error:", rErr);
  else console.log("ROLES:", roles);
}

run();
