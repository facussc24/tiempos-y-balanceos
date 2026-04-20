/**
 * Fix PFDs:
 *   1. English terms in descriptions/notes -> Spanish
 *   2. companyName "Barack Mercosul" -> "BARACK MERCOSUL"
 *
 * Safe / idempotent.
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'

const envPath = new URL('../.env.local', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1')
const envText = readFileSync(envPath, 'utf8')
const env = Object.fromEntries(envText.split('\n').filter(l => l.includes('=') && !l.startsWith('#')).map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()] }))
const sb = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY)
await sb.auth.signInWithPassword({ email: env.VITE_AUTO_LOGIN_EMAIL, password: env.VITE_AUTO_LOGIN_PASSWORD })

// Translations: ONLY full tokens. Do not touch Spanish or mixed text that happens to contain english substrings (e.g. "tweeter" is a brand).
const TRANSLATIONS = [
  [/WRAPPING\s*\+\s*EDGE\s*FOLDING/gi, 'ENVOLTURA Y PLEGADO DE BORDES'],
  [/\bEDGE\s*FOLDING\b/gi, 'PLEGADO DE BORDES'],
  [/\bWRAPPING\b/gi, 'ENVOLTURA'],
  [/\btrimming\b/gi, 'recorte'],
  [/\bTRIMMING\b/g, 'RECORTE'],
]

function translate(s) {
  if (typeof s !== 'string') return s
  let out = s
  for (const [re, rep] of TRANSLATIONS) out = out.replace(re, rep)
  return out
}

function walkAndClean(obj, stats) {
  if (obj == null) return obj
  if (typeof obj === 'string') {
    const c = translate(obj)
    if (c !== obj) stats.translations++
    return c
  }
  if (Array.isArray(obj)) return obj.map(v => walkAndClean(v, stats))
  if (typeof obj === 'object') {
    const out = {}
    for (const [k, v] of Object.entries(obj)) {
      // companyName special-case: force upper
      if (k === 'companyName' && typeof v === 'string' && /barack mercosul/i.test(v) && v !== 'BARACK MERCOSUL') {
        out[k] = 'BARACK MERCOSUL'
        stats.companyUpdates++
      } else {
        out[k] = walkAndClean(v, stats)
      }
    }
    return out
  }
  return obj
}

const { data, error } = await sb.from('pfd_documents').select('*')
if (error) { console.error(error); process.exit(1) }

for (const d of data) {
  const parsed = typeof d.data === 'string' ? JSON.parse(d.data) : d.data
  if (!parsed) continue
  const stats = { translations: 0, companyUpdates: 0 }
  const cleaned = walkAndClean(parsed, stats)
  if (stats.translations === 0 && stats.companyUpdates === 0) continue
  const { error: upErr } = await sb.from('pfd_documents').update({ data: cleaned }).eq('id', d.id)
  if (upErr) { console.log('X', d.id, upErr.message); continue }
  console.log(`OK ${d.id.slice(0, 24)} translations=${stats.translations} companyUpdates=${stats.companyUpdates}`)
}

console.log('\nVerify:')
const { data: d2 } = await sb.from('pfd_documents').select('id, data')
let eng = 0, lower = 0
for (const d of d2) {
  const s = typeof d.data === 'string' ? d.data : JSON.stringify(d.data)
  eng += (s.match(/\bWRAPPING\b|\bEDGE FOLDING\b|\btrimming\b/gi) || []).length
  if (/"companyName"\s*:\s*"Barack Mercosul"/i.test(s) && !/"companyName"\s*:\s*"BARACK MERCOSUL"/.test(s)) lower++
}
console.log('  remaining english tokens:', eng)
console.log('  remaining lowercase company:', lower)
