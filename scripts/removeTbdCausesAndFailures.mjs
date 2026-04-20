/**
 * Elimina causas y fallas que son literalmente "TBD" o "Pendiente definicion con equipo APQP"
 * en el texto de la falla/causa (NO en los controles — los placeholders de controles ya fueron
 * reemplazados por AIAG reales).
 *
 * Las "causas TBD" son basura que dejaron como recordatorio de pending review — mejor eliminarlas
 * para que el equipo APQP vea AMFE limpio y agregue las que faltan explicitamente.
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'

const envPath = new URL('../.env.local', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1')
const envText = readFileSync(envPath, 'utf8')
const env = Object.fromEntries(envText.split('\n').filter(l => l.includes('=') && !l.startsWith('#')).map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()] }))
const sb = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY)
await sb.auth.signInWithPassword({ email: env.VITE_AUTO_LOGIN_EMAIL, password: env.VITE_AUTO_LOGIN_PASSWORD })

const isTbdText = s => {
  if (!s) return true
  const t = s.trim()
  return /^TBD$/i.test(t) || /^TBD\b/i.test(t) || /pendiente\s+definicion\s+con\s+equipo/i.test(t)
}

const { data } = await sb.from('amfe_documents').select('*')
const stats = { docsChanged: 0, failRemoved: 0, causeRemoved: 0 }

for (const doc of data) {
  const p = typeof doc.data === 'string' ? JSON.parse(doc.data) : doc.data
  if (!p?.operations) continue
  let docChange = 0

  for (const op of (p.operations || [])) {
    for (const we of (op.workElements || [])) {
      for (const fn of (we.functions || [])) {
        // Remove TBD failures
        const origF = fn.failures || []
        fn.failures = origF.filter(fail => {
          if (isTbdText(fail.description)) { stats.failRemoved++; docChange++; return false }
          // Remove TBD causes inside
          const origC = fail.causes || []
          fail.causes = origC.filter(c => {
            const txt = c.cause || c.description || ''
            if (isTbdText(txt)) { stats.causeRemoved++; docChange++; return false }
            return true
          })
          return true
        })
      }
    }
  }

  if (!docChange) continue
  const { error } = await sb.from('amfe_documents').update({ data: p }).eq('id', doc.id)
  if (error) { console.log('X', doc.amfe_number, error.message); continue }
  console.log(`OK ${doc.amfe_number.padEnd(32)} fails=${stats.failRemoved} causes=${stats.causeRemoved}`)
  stats.docsChanged++
}

console.log(`\nTotal: ${stats.docsChanged} docs, ${stats.failRemoved} fallas TBD eliminadas, ${stats.causeRemoved} causas TBD eliminadas`)
