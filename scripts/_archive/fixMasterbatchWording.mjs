/**
 * Reemplaza "masterbatch" (ingles) por "concentrado" (espanol) en TODOS los AMFEs
 * que tienen operacion de inyeccion. Tambien limpia CP y PFD.
 *
 * Reemplazos:
 *   "Colorante masterbatch" -> "Colorante concentrado"
 *   "masterbatch"           -> "concentrado"   (case-insensitive pero preservando case inicial)
 *
 * Safe: operacion idempotente. Despues de correr 1 vez, las siguientes no cambian nada.
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'

const envPath = new URL('../.env.local', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1')
const envText = readFileSync(envPath, 'utf8')
const env = Object.fromEntries(envText.split('\n').filter(l => l.includes('=') && !l.startsWith('#')).map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()] }))
const sb = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY)
await sb.auth.signInWithPassword({ email: env.VITE_AUTO_LOGIN_EMAIL, password: env.VITE_AUTO_LOGIN_PASSWORD })

function cleanText(s) {
  if (typeof s !== 'string') return s
  // Case-preserving replace: Masterbatch -> Concentrado, masterbatch -> concentrado, MASTERBATCH -> CONCENTRADO
  return s
    .replace(/Masterbatch/g, 'Concentrado')
    .replace(/MASTERBATCH/g, 'CONCENTRADO')
    .replace(/masterbatch/g, 'concentrado')
}

function walkAndClean(obj, stats) {
  if (obj == null) return obj
  if (typeof obj === 'string') {
    const cleaned = cleanText(obj)
    if (cleaned !== obj) stats.replacements++
    return cleaned
  }
  if (Array.isArray(obj)) return obj.map(v => walkAndClean(v, stats))
  if (typeof obj === 'object') {
    const out = {}
    for (const [k, v] of Object.entries(obj)) out[k] = walkAndClean(v, stats)
    return out
  }
  return obj
}

async function processTable(table) {
  const { data, error } = await sb.from(table).select('*')
  if (error) { console.log(`X ${table}: ${error.message}`); return }
  let docsChanged = 0
  let totalReplacements = 0
  for (const doc of data) {
    const parsed = typeof doc.data === 'string' ? JSON.parse(doc.data) : doc.data
    if (!parsed) continue
    const stats = { replacements: 0 }
    const cleaned = walkAndClean(parsed, stats)
    if (stats.replacements === 0) continue
    // Sanity check: must be object not string
    if (typeof cleaned !== 'object' || Array.isArray(cleaned)) {
      console.log(`X ${table} ${doc.id} cleaned is not object, skip`)
      continue
    }
    const { error: upErr } = await sb.from(table).update({ data: cleaned }).eq('id', doc.id)
    if (upErr) { console.log(`X update ${table} ${doc.id}: ${upErr.message}`); continue }
    docsChanged++
    totalReplacements += stats.replacements
    console.log(`  OK ${table} ${doc.id.slice(0, 8)} (${doc.amfe_number || doc.cp_number || doc.ho_number || doc.pfd_number || '?'}) replacements=${stats.replacements}`)
  }
  console.log(`Total ${table}: ${docsChanged} docs updated, ${totalReplacements} replacements`)
}

console.log('=== AMFE ===')
await processTable('amfe_documents')
console.log('\n=== CP ===')
await processTable('cp_documents')
console.log('\n=== HO ===')
await processTable('ho_documents')
console.log('\n=== PFD ===')
await processTable('pfd_documents')

console.log('\n=== Verification ===')
for (const t of ['amfe_documents', 'cp_documents', 'ho_documents', 'pfd_documents']) {
  const { data } = await sb.from(t).select('id, data')
  let hits = 0
  for (const d of data) {
    const s = typeof d.data === 'string' ? d.data : JSON.stringify(d.data)
    hits += (s.match(/masterbatch/gi) || []).length
  }
  console.log(`  ${t}: ${hits} remaining "masterbatch" hits`)
}
