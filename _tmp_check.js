const { createClient } = require("@supabase/supabase-js");
const fs = require("fs");
const envText = fs.readFileSync(".env.local", "utf8");
const env = Object.fromEntries(envText.split("\n").filter(l => l.includes("=") && !l.startsWith("#")).map(l => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }));
const sb = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);
(async () => {
  await sb.auth.signInWithPassword({ email: env.VITE_AUTO_LOGIN_EMAIL, password: env.VITE_AUTO_LOGIN_PASSWORD });
  const { data: allPfds } = await sb.from("pfd_documents").select("id, part_name, customer_name, data").neq("id", "pfd-ippads-trim-asm-upr-wrapping");
  for (const pfd of allPfds || []) {
    let d = pfd.data;
    if (typeof d === "string") try { d = JSON.parse(d); } catch {}
    if (d && d.header) {
      const emb = (d.steps || []).find(s => (s.description || "").includes("EMBALAJE"));
      console.log(pfd.id, JSON.stringify({ approvedBy: d.header.approvedBy, preparedBy: d.header.preparedBy, embalaje: emb ? emb.description : "N/A" }));
    }
  }
})();
