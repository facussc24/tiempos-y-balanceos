/**
 * Reemplaza placeholders de focusElementFunction/operationFunction con contenido REAL
 * segun el producto (AIAG-VDA 2019: 3 perspectivas — Barack / OEM / Usuario Final).
 *
 * La funcion es la MISMA para todas las operaciones del mismo AMFE (regla amfe.md).
 *
 * Solo reemplaza strings que arrancan con "Pendiente funcion". No toca contenido real.
 * Idempotente.
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'

const envPath = new URL('../.env.local', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1')
const envText = readFileSync(envPath, 'utf8')
const env = Object.fromEntries(envText.split('\n').filter(l => l.includes('=') && !l.startsWith('#')).map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()] }))
const sb = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY)
await sb.auth.signInWithPassword({ email: env.VITE_AUTO_LOGIN_EMAIL, password: env.VITE_AUTO_LOGIN_PASSWORD })

// Funciones por AMFE (3 perspectivas segun AIAG-VDA 2019)
const FUNCTIONS = {
  // Apoyacabezas Delantero - Patagonia VW
  'AMFE-HF-PAT':
    'Interno (Barack): Proveer apoyacabezas conforme con soporte estructural de varilla, espuma PU y funda textil/vinilo, cumpliendo integridad de costura, ensamble y bordes. / Cliente (VWA): Montar sin interferencia en respaldo VW Polaris con fit & finish conforme y fuerza de insercion de varillas dentro de especificacion. / Usuario final: Confort cervical, proteccion contra whiplash en impacto trasero, estetica del habitaculo y durabilidad al uso prolongado.',
  // Apoyacabezas Trasero Central - Patagonia VW
  'AMFE-HRC-PAT':
    'Interno (Barack): Proveer apoyacabezas trasero central conforme con soporte de varilla, espuma PU y funda textil, costuras y bordes sin defectos. / Cliente (VWA): Ensamble en respaldo trasero VW sin interferencia de varilla ni defecto estetico visible. / Usuario final: Confort cervical del pasajero central trasero, proteccion en impacto y estetica integrada al habitaculo.',
  // Apoyacabezas Trasero Lateral - Patagonia VW
  'AMFE-HRO-PAT':
    'Interno (Barack): Proveer apoyacabezas trasero lateral conforme con soporte de varilla, espuma PU y funda textil, bordes y costuras sin defectos esteticos ni funcionales. / Cliente (VWA): Ensamble en respaldo trasero lateral VW con fit & finish y fuerza de insercion de varillas dentro de especificacion. / Usuario final: Confort cervical del pasajero trasero lateral, proteccion ante impacto trasero y estetica del habitaculo.',
  // Telas Planas PWA (Toyota Hilux)
  'AMFE-1':
    'Interno (Barack): Proveer funda textil plana conforme para asiento Hilux, con cortes, costuras, troquelados, refuerzos, aplix y clips dentro de especificacion. / Cliente (PWA): Ensamble en linea de vestimenta Toyota Hilux sin retrabajos ni rotura de hilos, cumplimiento dimensional y de materiales. / Usuario final: Confort tactil y visual del asiento, durabilidad al uso prolongado, cumplimiento de normas de flamabilidad y resistencia UV del cliente Toyota.',
}

const PLACEHOLDER_RE = /^Pendiente funcion/i

const { data } = await sb.from('amfe_documents').select('*')
let totalDocs = 0, totalOps = 0

for (const doc of data) {
  const fn = FUNCTIONS[doc.amfe_number]
  if (!fn) continue
  const parsed = typeof doc.data === 'string' ? JSON.parse(doc.data) : doc.data
  if (!parsed?.operations) continue
  let changed = 0
  for (const op of parsed.operations) {
    if (PLACEHOLDER_RE.test(op.focusElementFunction || '')) {
      op.focusElementFunction = fn
      changed++
    }
    if (PLACEHOLDER_RE.test(op.operationFunction || '')) {
      op.operationFunction = fn
    }
  }
  if (!changed) continue
  const { error } = await sb.from('amfe_documents').update({ data: parsed }).eq('id', doc.id)
  if (error) { console.log('X', doc.amfe_number, error.message); continue }
  console.log(`OK ${doc.amfe_number.padEnd(32)} ops replaced=${changed}`)
  totalDocs++
  totalOps += changed
}
console.log(`\nTotal: ${totalDocs} AMFEs, ${totalOps} operaciones con funciones reales.`)

// Verify no placeholders remain (in target AMFEs)
console.log('\n=== Verificacion ===')
const { data: verif } = await sb.from('amfe_documents').select('amfe_number, data')
for (const d of verif) {
  if (!FUNCTIONS[d.amfe_number]) continue
  const p = typeof d.data === 'string' ? JSON.parse(d.data) : d.data
  const remain = (p.operations || []).filter(op => PLACEHOLDER_RE.test(op.focusElementFunction || '')).length
  console.log(`  ${d.amfe_number}: ${remain} placeholders remaining (expected 0)`)
}
