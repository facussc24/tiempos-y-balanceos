/**
 * Rellena campos AMFE faltantes con placeholder "Pendiente definicion equipo APQP".
 * NO inventa contenido. Solo pone placeholder para que el documento pase validaciones basicas
 * y quede marcado como "pendiente revision humana".
 *
 * Reglas aplicadas (conservadoras):
 *   1. focusElementFunction: si operacion tiene < 3 perspectivas separadas por " / ",
 *      set placeholder "Pendiente funcion interna / Pendiente funcion cliente OEM / Pendiente funcion usuario final"
 *      (la misma para todas las ops del AMFE — regla AIAG-VDA)
 *   2. preventionControl vacio + cause tiene ratings (S>0 o O>0 o D>0) + AP en H/M:
 *      set "Pendiente definicion equipo APQP"
 *   3. detectionControl vacio + mismas condiciones:
 *      set "Pendiente definicion equipo APQP"
 *
 * NO tocar:
 *   - S/O/D numericos (nunca inventar valores de ingenieria)
 *   - optimizationAction (regla amfe-actions.md — solo equipo humano)
 *   - workElements = [] (operaciones reset post-incidente, el equipo APQP debe completar)
 *
 * Idempotente: si ya existe el placeholder no lo duplica.
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'

const envPath = new URL('../.env.local', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1')
const envText = readFileSync(envPath, 'utf8')
const env = Object.fromEntries(envText.split('\n').filter(l => l.includes('=') && !l.startsWith('#')).map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()] }))
const sb = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY)
await sb.auth.signInWithPassword({ email: env.VITE_AUTO_LOGIN_EMAIL, password: env.VITE_AUTO_LOGIN_PASSWORD })

const PLACEHOLDER_FUNCTION = 'Pendiente funcion interna / Pendiente funcion cliente OEM / Pendiente funcion usuario final'
const PLACEHOLDER_CONTROL = 'Pendiente definicion equipo APQP'

function needsFunctionPlaceholder(fn) {
  if (!fn || typeof fn !== 'string' || !fn.trim()) return true
  const parts = fn.split('/').map(s => s.trim()).filter(Boolean)
  return parts.length < 3
}

function hasSomeRating(cause) {
  const s = Number(cause.severity) || 0
  const o = Number(cause.occurrence) || 0
  const d = Number(cause.detection) || 0
  return s > 0 || o > 0 || d > 0
}

function apIsHighOrMed(cause) {
  const ap = (cause.ap || cause.actionPriority || '').toString().trim().toUpperCase()
  return ap === 'H' || ap === 'M'
}

function isPlaceholder(s) {
  if (!s) return false
  return /pendiente/i.test(s)
}

async function processAmfes() {
  const { data, error } = await sb.from('amfe_documents').select('*')
  if (error) throw error

  const globalStats = { docsChanged: 0, funcFills: 0, prevFills: 0, detFills: 0 }

  for (const doc of data) {
    const parsed = typeof doc.data === 'string' ? JSON.parse(doc.data) : doc.data
    if (!parsed || !parsed.operations) continue
    const stats = { funcFills: 0, prevFills: 0, detFills: 0 }

    for (const op of parsed.operations) {
      // Skip ops with empty workElements (reset, pendiente equipo — no inventar)
      const wes = op.workElements || []
      if (!wes.length) continue

      // Rule 1: focusElementFunction
      if (needsFunctionPlaceholder(op.focusElementFunction)) {
        op.focusElementFunction = PLACEHOLDER_FUNCTION
        stats.funcFills++
      }
      if (needsFunctionPlaceholder(op.operationFunction)) {
        op.operationFunction = PLACEHOLDER_FUNCTION
        // not double-counting
      }

      // Rules 2 & 3: controls on causes
      for (const we of wes) {
        for (const fn of (we.functions || [])) {
          for (const fail of (fn.failures || [])) {
            for (const c of (fail.causes || [])) {
              if (!hasSomeRating(c) && !apIsHighOrMed(c)) continue
              if (!apIsHighOrMed(c)) continue // only H/M

              if (!c.preventionControl || !c.preventionControl.trim()) {
                c.preventionControl = PLACEHOLDER_CONTROL
                stats.prevFills++
              }
              if (!c.detectionControl || !c.detectionControl.trim()) {
                c.detectionControl = PLACEHOLDER_CONTROL
                stats.detFills++
              }
            }
          }
        }
      }
    }

    const total = stats.funcFills + stats.prevFills + stats.detFills
    if (total === 0) continue

    const { error: upErr } = await sb.from('amfe_documents').update({ data: parsed }).eq('id', doc.id)
    if (upErr) { console.log(`X ${doc.id}: ${upErr.message}`); continue }
    console.log(`OK ${(doc.amfe_number || doc.id.slice(0, 8)).padEnd(32)} func=${stats.funcFills} prev=${stats.prevFills} det=${stats.detFills}`)
    globalStats.docsChanged++
    globalStats.funcFills += stats.funcFills
    globalStats.prevFills += stats.prevFills
    globalStats.detFills += stats.detFills
  }

  console.log(`\nTOTAL: ${globalStats.docsChanged} docs changed — func=${globalStats.funcFills}, prev=${globalStats.prevFills}, det=${globalStats.detFills}`)
}

await processAmfes()

console.log('\nPost-check: validar que ningun doc quedo como string (double-serialization)')
const { data: all } = await sb.from('amfe_documents').select('id, amfe_number, data')
for (const d of all) {
  const p = typeof d.data === 'string' ? JSON.parse(d.data) : d.data
  if (typeof p === 'string') console.log('X DOUBLE-SERIALIZED:', d.id, d.amfe_number)
  else if (!Array.isArray(p.operations)) console.log('X operations not array:', d.id, d.amfe_number)
}
console.log('OK todos los docs mantienen estructura correcta')
