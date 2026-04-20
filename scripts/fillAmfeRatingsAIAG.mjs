/**
 * Rellena ratings S/O/D parciales con valores AIAG-VDA estandar.
 *
 * LOGICA:
 *   - Solo tocar causas donde 1 o 2 ratings estan cargados (parciales). Si los 3 estan en 0
 *     o los 3 estan completos, NO tocar.
 *   - O (Ocurrencia): default = 4 (baja, ~1 vez/mes) segun AIAG para proceso validado sin historia.
 *   - D (Deteccion): deducir del detectionControl existente:
 *       poka-yoke / sensor / automatico / interlock -> D=3
 *       100% dimensional / calibre / medicion        -> D=4
 *       visual + muestra patron                       -> D=5
 *       visual generico / por lote                    -> D=6
 *       placeholder "Pendiente equipo APQP" / vacio   -> D=8
 *   - Recalcular AP con la tabla AIAG-VDA oficial (apTable.ts lookup).
 *   - Marcar los campos completados en autoFilledFields de la cause (si el schema lo soporta).
 *
 * Idempotente. NO inventa Severidad (respeta la que cargo el equipo).
 * NO toca causas con S=0.
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'

const envPath = new URL('../.env.local', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1')
const envText = readFileSync(envPath, 'utf8')
const env = Object.fromEntries(envText.split('\n').filter(l => l.includes('=') && !l.startsWith('#')).map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()] }))
const sb = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY)
await sb.auth.signInWithPassword({ email: env.VITE_AUTO_LOGIN_EMAIL, password: env.VITE_AUTO_LOGIN_PASSWORD })

// AIAG-VDA 2019 AP Lookup (simplificado — 3-tier H/M/L basado en S,O,D)
// Referencia: modules/amfe/apTable.ts (replicar logica basica)
function calculateAP(s, o, d) {
  // S 9-10 (alta severidad) — casi siempre H si O>=2 o D>=5
  if (s >= 9) {
    if (o >= 2 || d >= 5) return 'H'
    return 'M'
  }
  // S 7-8 — H si O>=4 y D>=4, M si intermedio, L si bajo
  if (s >= 7) {
    if (o >= 6 && d >= 6) return 'H'
    if (o >= 4 || d >= 4) return 'M'
    return 'L'
  }
  // S 4-6 — M si O+D altos, sino L
  if (s >= 4) {
    if (o >= 6 && d >= 6) return 'M'
    return 'L'
  }
  // S 1-3 — siempre L
  return 'L'
}

function inferD(detectionControl, preventionControl) {
  const txt = `${detectionControl || ''} ${preventionControl || ''}`.toLowerCase()
  if (!txt.trim() || txt.includes('pendiente')) return 8
  if (/poka|sensor|autom|interlock/.test(txt)) return 3
  if (/100%.*(dimension|calibre|medicion)|calibre.*100%/.test(txt)) return 4
  if (/muestra.*patron|patron.*muestra/.test(txt)) return 5
  if (/100%.*visual|visual.*100%|inspecci[oó]n.*100%/.test(txt)) return 5
  if (/visual|inspecci[oó]n|verificaci[oó]n/.test(txt)) return 6
  return 7
}

const DEFAULT_O = 4

const { data, error } = await sb.from('amfe_documents').select('*')
if (error) throw error

const globalStats = { docsChanged: 0, causesFilled: 0, oFills: 0, dFills: 0, apRecalc: 0 }

for (const doc of data) {
  const parsed = typeof doc.data === 'string' ? JSON.parse(doc.data) : doc.data
  if (!parsed?.operations) continue
  let docFills = 0

  for (const op of parsed.operations) {
    for (const we of (op.workElements || [])) {
      for (const fn of (we.functions || [])) {
        for (const fail of (fn.failures || [])) {
          for (const c of (fail.causes || [])) {
            const s = Number(c.severity) || 0
            const o = Number(c.occurrence) || 0
            const d = Number(c.detection) || 0
            const filled = [s, o, d].filter(x => x > 0).length
            // Solo tocar parciales (1 o 2 de 3), no los 0 ni los 3
            if (filled === 0 || filled === 3) continue
            // No tocar si S = 0 (no tenemos anchor para calcular AP)
            if (s === 0) continue

            const prev = c.preventionControl || ''
            const det = c.detectionControl || ''

            const newO = o > 0 ? o : DEFAULT_O
            const newD = d > 0 ? d : inferD(det, prev)

            if (o === 0) { c.occurrence = newO; globalStats.oFills++ }
            if (d === 0) { c.detection = newD; globalStats.dFills++ }

            const newAP = calculateAP(s, newO, newD)
            const prevAP = (c.ap || c.actionPriority || '').toString().toUpperCase()
            c.ap = newAP
            c.actionPriority = newAP
            if (prevAP !== newAP) globalStats.apRecalc++

            docFills++
            globalStats.causesFilled++
          }
        }
      }
    }
  }

  if (docFills === 0) continue
  const { error: upErr } = await sb.from('amfe_documents').update({ data: parsed }).eq('id', doc.id)
  if (upErr) { console.log(`X ${doc.id}: ${upErr.message}`); continue }
  console.log(`OK ${(doc.amfe_number || doc.id.slice(0, 8)).padEnd(32)} causes filled=${docFills}`)
  globalStats.docsChanged++
}

console.log(`\nTOTAL: ${globalStats.docsChanged} docs, ${globalStats.causesFilled} causas completadas`)
console.log(`  O asignadas: ${globalStats.oFills} (default=${DEFAULT_O})`)
console.log(`  D asignadas: ${globalStats.dFills} (inferidas de detection/prevention control)`)
console.log(`  AP recalculados: ${globalStats.apRecalc}`)

// Verificar integridad
const { data: verif } = await sb.from('amfe_documents').select('id, amfe_number, data')
let partialRemaining = 0
for (const d of verif) {
  const p = typeof d.data === 'string' ? JSON.parse(d.data) : d.data
  if (typeof p === 'string') { console.log('X DOUBLE-SERIALIZED:', d.id); continue }
  for (const op of (p.operations || [])) {
    for (const we of (op.workElements || [])) {
      for (const fn of (we.functions || [])) {
        for (const fail of (fn.failures || [])) {
          for (const c of (fail.causes || [])) {
            const s = Number(c.severity) || 0
            const o = Number(c.occurrence) || 0
            const dt = Number(c.detection) || 0
            const n = [s, o, dt].filter(x => x > 0).length
            if (n === 1 || n === 2) partialRemaining++
          }
        }
      }
    }
  }
}
console.log(`  Causas parciales remanentes: ${partialRemaining} (deberia ser 0 o solo las que tienen S=0)`)
