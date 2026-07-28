import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);
async function main() {
  const { data } = await supabase.from('profiles').select('*').eq('full_name', 'Smriti Bam');
  const userId = data[0].user_id;
  const res = await supabase.from('leave_balances').select('*').eq('user_id', userId);
  console.log(res.data);
}
main();
