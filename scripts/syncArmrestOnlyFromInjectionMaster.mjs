/**
 * syncArmrestOnlyFromInjectionMaster.mjs
 *
 * Version acotada de syncArmrestHeadrestFromInjectionMaster.mjs.
 * SOLO procesa Armrest Door Panel OP 60 (INYECCION DE PIEZAS PLASTICAS).
 * NO toca Headrests (que usan INYECCION PU, no termoplastico — ver incidente 2026-04-20).
 *
 * La logica de merge es la misma que el script original, pero con TARGETS reducido
 * a Armrest unicamente.
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { randomUUID } from 'crypto'

const envPath = new URL('../.env.local', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1')
const envText = readFileSync(envPath, 'utf8')
const env = Object.fromEntries(envText.split('\n').filter(l => l.includes('=') && !l.startsWith('#')).map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()] }))
const sb = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY)
await sb.auth.signInWithPassword({ email: env.VITE_AUTO_LOGIN_EMAIL, password: env.VITE_AUTO_LOGIN_PASSWORD })

const MASTER_DOC_ID = '4a5fa0d1-46ee-4d6b-b699-2cbaeb14602c'
const ARMREST_DOC_ID = '5268704d-30ae-48f3-ad05-8402a6ded7fe'

// AP Lookup (simplificada AIAG-VDA 2019)
function calculateAP(s, o, d) {
  if (!s || !o || !d) return 'L'
  if (s >= 9) {
    if (o >= 2 || d >= 5) return 'H'
    return 'M'
  }
  if (s >= 7) {
    if (o >= 6 && d >= 6) return 'H'
    if (o >= 4 || d >= 4) return 'M'
    return 'L'
  }
  if (s >= 4) {
    if (o >= 6 && d >= 6) return 'M'
    return 'L'
  }
  return 'L'
}

const norm = s => (s || '').toString().toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()

async function loadDoc(id) {
  const { data, error } = await sb.from('amfe_documents').select('*').eq('id', id).single()
  if (error) throw error
  return { ...data, parsed: typeof data.data === 'string' ? JSON.parse(data.data) : data.data }
}

function findInjOp(doc) {
  for (const op of doc.parsed.operations || []) {
    const n = norm(op.name || op.operationName || '')
    if (/iny/i.test(n) && !/\bpu\b|poliuret/i.test(n) && /plast|piez/i.test(n)) return op
  }
  return null
}

function mergeOp(productOp, masterOp) {
  // Preserve product op identity
  const result = { ...productOp }
  result.workElements = result.workElements || []

  let fused = 0, preserved = 0, added = 0

  // Index product WEs by normalized type+name
  const productWEsByKey = new Map()
  for (const we of result.workElements) {
    const key = `${we.type}|${norm(we.name)}`
    productWEsByKey.set(key, we)
  }

  for (const mWE of (masterOp.workElements || [])) {
    const mKey = `${mWE.type}|${norm(mWE.name)}`
    // Try exact match first
    let pWE = productWEsByKey.get(mKey)
    // Try partial match on key tokens
    if (!pWE) {
      const mTokens = norm(mWE.name).split(' ').filter(t => t.length > 3)
      for (const [k, v] of productWEsByKey) {
        if (v.type !== mWE.type) continue
        if (mTokens.some(t => k.includes(t))) { pWE = v; break }
      }
    }
    if (pWE) {
      // Fuse failures
      const failByDesc = new Map()
      for (const f of (pWE.functions?.[0]?.failures || [])) {
        failByDesc.set(norm(f.description || ''), f)
      }
      for (const mF of (mWE.functions?.[0]?.failures || [])) {
        const key = norm(mF.description || '')
        const existing = failByDesc.get(key)
        if (existing) {
          // Copy effects from master
          if (mF.effectLocal) existing.effectLocal = mF.effectLocal
          if (mF.effectNextLevel) existing.effectNextLevel = mF.effectNextLevel
          if (mF.effectEndUser) existing.effectEndUser = mF.effectEndUser
          // Append missing causes
          const existingCauseKeys = new Set((existing.causes || []).map(c => norm(c.cause || c.description || '')))
          for (const mC of (mF.causes || [])) {
            const ck = norm(mC.cause || mC.description || '')
            if (!existingCauseKeys.has(ck)) {
              const newC = { ...mC, id: randomUUID() }
              const s = Number(newC.severity) || 0, o = Number(newC.occurrence) || 0, d = Number(newC.detection) || 0
              newC.ap = calculateAP(s, o, d)
              newC.actionPriority = newC.ap
              existing.causes = existing.causes || []
              existing.causes.push(newC)
            }
          }
        } else {
          // Add failure
          const newF = JSON.parse(JSON.stringify(mF))
          newF.id = randomUUID()
          ;(newF.causes || []).forEach(c => { c.id = randomUUID() })
          ;(pWE.functions || (pWE.functions = [{ description: pWE.name, functionDescription: pWE.name, failures: [] }]))[0].failures = (pWE.functions[0].failures || []).concat([newF])
        }
      }
      fused++
    } else {
      // Add missing WE
      const cloned = JSON.parse(JSON.stringify(mWE))
      cloned.id = randomUUID()
      for (const fn of (cloned.functions || [])) {
        for (const fail of (fn.failures || [])) {
          fail.id = randomUUID()
          for (const c of (fail.causes || [])) c.id = randomUUID()
        }
      }
      result.workElements.push(cloned)
      added++
    }
  }
  // count preserved (WEs in product not matching any master)
  const masterKeys = new Set((masterOp.workElements || []).map(we => `${we.type}|${norm(we.name)}`))
  for (const we of productOp.workElements || []) {
    const k = `${we.type}|${norm(we.name)}`
    if (!masterKeys.has(k)) {
      let matched = false
      const tokens = norm(we.name).split(' ').filter(t => t.length > 3)
      for (const mk of masterKeys) if (mk.startsWith(we.type + '|') && tokens.some(t => mk.includes(t))) { matched = true; break }
      if (!matched) preserved++
    }
  }
  return { op: result, fused, preserved, added }
}

const master = await loadDoc(MASTER_DOC_ID)
const masterOp = (master.parsed.operations || []).find(op => norm(op.name || op.operationName).includes('inyeccion') && !norm(op.name || op.operationName).includes('control'))
if (!masterOp) { console.error('X No master INYECCION op found'); process.exit(1) }
console.log(`Master op: ${masterOp.name || masterOp.operationName} (OP ${masterOp.opNumber || masterOp.operationNumber})`)

const armrest = await loadDoc(ARMREST_DOC_ID)
const prodOp = findInjOp(armrest)
if (!prodOp) { console.error('X No Armrest inj op found'); process.exit(1) }

const beforeWEs = prodOp.workElements?.length || 0
const beforeFails = (prodOp.workElements || []).reduce((a, we) => a + ((we.functions || []).reduce((b, fn) => b + (fn.failures?.length || 0), 0)), 0)
const beforeCauses = (prodOp.workElements || []).reduce((a, we) => a + ((we.functions || []).reduce((b, fn) => b + (fn.failures || []).reduce((c, f) => c + (f.causes?.length || 0), 0), 0)), 0)

const merged = mergeOp(prodOp, masterOp)

// Replace op in armrest
const opIdx = armrest.parsed.operations.findIndex(o => o.id === prodOp.id)
armrest.parsed.operations[opIdx] = merged.op

const afterWEs = merged.op.workElements.length
const afterFails = merged.op.workElements.reduce((a, we) => a + ((we.functions || []).reduce((b, fn) => b + (fn.failures?.length || 0), 0)), 0)
const afterCauses = merged.op.workElements.reduce((a, we) => a + ((we.functions || []).reduce((b, fn) => b + (fn.failures || []).reduce((c, f) => c + (f.causes?.length || 0), 0), 0)), 0)

const { error: upErr } = await sb.from('amfe_documents').update({ data: armrest.parsed }).eq('id', ARMREST_DOC_ID)
if (upErr) { console.error('X update:', upErr.message); process.exit(1) }

// Verify
const { data: v } = await sb.from('amfe_documents').select('data').eq('id', ARMREST_DOC_ID).single()
const vp = typeof v.data === 'string' ? JSON.parse(v.data) : v.data
if (typeof vp !== 'object' || !Array.isArray(vp.operations)) { console.error('X verify failed'); process.exit(1) }

console.log(`\nArmrest Door Panel:`)
console.log(`  Op: "${merged.op.name || merged.op.operationName}" (OP ${merged.op.opNumber || merged.op.operationNumber})`)
console.log(`  WEs: ${beforeWEs} -> ${afterWEs}`)
console.log(`  Failures: ${beforeFails} -> ${afterFails}`)
console.log(`  Causes: ${beforeCauses} -> ${afterCauses}`)
console.log(`  Fusionadas: ${merged.fused} | Preservadas: ${merged.preserved} | Agregadas: ${merged.added}`)
console.log(`  Verify: OK`)
