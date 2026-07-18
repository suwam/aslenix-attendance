import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  "https://bbhsjjosmjtfmjveyjnf.supabase.co",
  "sb_publishable_SP_AYZvULQLkB2lMQUb3Eg_Vjhs_PxF",
);

async function run() {
  const { data, error } = await supabase
    .from("weekly_feedback")
    .select(
      "id, employee_id, week_start, rating, review_score, created_at, nepali_year, nepali_month",
    );

  console.log(data?.length);
  if (error) console.error(error);
}

run();
