const url = process.env.VITE_SUPABASE_URL || "https://bbhsjjosmjtfmjveyjnf.supabase.co";
const key = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || "sb_publishable_SP_AYZvULQLkB2lMQUb3Eg_Vjhs_PxF";

async function run() {
  const res = await fetch(`${url}/rest/v1/work_items?select=*`, {
    headers: {
      "apikey": key,
      "Authorization": `Bearer ${key}`
    }
  });
  const data = await res.json();
  console.log("Work Items count:", data.length);
  if (data.length > 0) {
    console.log("First item:", data[0]);
  } else {
    console.log("No work items found!");
  }
}

run();
