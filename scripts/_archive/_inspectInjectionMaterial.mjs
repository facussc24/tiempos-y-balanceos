// Read-only: dump Material WEs from injection master + all propagated products
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'

const envPath = new URL('../.env.local', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1')
const envText = readFileSync(envPath, 'utf8')
const env = Object.fromEntries(envText.split('\n').filter(l => l.includes('=') && !l.startsWith('#')).map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()] }))
const sb = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY)
await sb.auth.signInWithPassword({ email: env.VITE_AUTO_LOGIN_EMAIL, password: env.VITE_AUTO_LOGIN_PASSWORD })

const MASTER_AMFE_ID = '4a5fa0d1-46ee-4d6b-b699-2cbaeb14602c'

async function loadAll() {
  const { data, error } = await sb.from('amfe_documents').select('*')
  if (error) throw error
  return data.map(d => ({ ...d, data: typeof d.data === 'string' ? JSON.parse(d.data) : d.data }))
}

function dumpMaterialWEs(doc, label) {
  const ops = doc.data.operations || []
  console.log(`\n=== ${label} (${doc.amfe_number || doc.id.slice(0,8)}) fam=${doc.family_id||doc.product_family_id||'?'} ===`)
  for (const op of ops) {
    const name = op.name || op.operationName
    const num = op.opNumber || op.operationNumber
    if (!/INY/i.test(name || '')) continue
    console.log(`  OP ${num} ${name}`)
    for (const we of (op.workElements || [])) {
      console.log(`    WE [${we.type}] "${we.name}"`)
      for (const f of (we.functions || [])) {
        const fd = f.description || f.functionDescription
        if (fd && /color|grano|masterbatch|batch/i.test(fd)) console.log(`      Func: ${fd}`)
        for (const fail of (f.failures || [])) {
          if (/color|grano|masterbatch|batch/i.test(fail.description || '')) {
            console.log(`      Fail: ${fail.description}`)
          }
          for (const c of (fail.causes || [])) {
            const txt = c.cause || c.description || ''
            if (/color|grano|masterbatch|batch/i.test(txt)) console.log(`        Cause: ${txt}`)
          }
        }
      }
    }
  }
}

const all = await loadAll()
const master = all.find(d => d.id === MASTER_AMFE_ID)
if (master) dumpMaterialWEs(master, 'MASTER INJECTION')

for (const doc of all) {
  if (doc.id === MASTER_AMFE_ID) continue
  const hasInj = (doc.data.operations || []).some(op => /INY/i.test(op.name || op.operationName || ''))
  if (!hasInj) continue
  dumpMaterialWEs(doc, 'PRODUCT')
}

console.log('\n\n=== Full-text hits ===')
for (const doc of all) {
  const txt = JSON.stringify(doc.data)
  const hits = {
    masterbatch: (txt.match(/masterbatch/gi) || []).length,
    'color de grano': (txt.match(/color de grano/gi) || []).length,
    'colorante': (txt.match(/colorante/gi) || []).length,
    pellet: (txt.match(/pellet/gi) || []).length,
    'batch': (txt.match(/\bbatch\b/gi) || []).length,
  }
  const sum = Object.values(hits).reduce((a,b)=>a+b,0)
  if (sum > 0) console.log(`  ${doc.amfe_number || doc.id.slice(0,8)} fam=${doc.family_id||doc.product_family_id||'?'}: ${JSON.stringify(hits)}`)
}
