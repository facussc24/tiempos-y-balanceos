/**
 * Unifica formato de los 11 AMFE headers PRESERVANDO identificadores unicos por doc.
 *
 * UNIFICA (aplica a todos):
 *   - organization: "BARACK MERCOSUL"
 *   - location: "PLANTA HURLINGHAM"
 *   - revision: si viene "01"/"02"/"0" -> "A" (formato letra AIAG)
 *   - coreTeam: array con 3 roles estandar Barack (si existe pero como string, reemplazar)
 *   - client: "VWA" o "PWA" segun el amfe_number
 *   - approvedBy: "Carlos Baptista (Ingenieria)" si no esta definido
 *   - plantApproval: "Gonzalo Cal" si no esta definido
 *   - reviewedBy: "Facundo Santoro (Calidad)" si no esta definido (distinto de approvedBy)
 *   - elaboratedBy: "Facundo Santoro (Calidad)" si no esta definido
 *
 * PRESERVA (NO toca):
 *   - amfeNumber / amfe_number (codigo unico)
 *   - subject
 *   - startDate / revDate
 *   - partNumber
 *   - applicableParts
 *   - modelYear (si existe)
 *   - scope (si existe)
 *
 * ALIAS CONSOLIDACION:
 *   companyName -> organization
 *   preparedBy -> elaboratedBy
 *   revision/rev/revisionLevel -> rev (preserva el valor, usa 'rev' como key canonica)
 *   revisionDate -> revDate
 *   team -> coreTeam
 *
 * Idempotente.
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'

const envPath = new URL('../.env.local', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1')
const envText = readFileSync(envPath, 'utf8')
const env = Object.fromEntries(envText.split('\n').filter(l => l.includes('=') && !l.startsWith('#')).map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()] }))
const sb = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY)
await sb.auth.signInWithPassword({ email: env.VITE_AUTO_LOGIN_EMAIL, password: env.VITE_AUTO_LOGIN_PASSWORD })

const CANON = {
  organization: 'BARACK MERCOSUL',
  location: 'PLANTA HURLINGHAM',
  coreTeam: [
    'Carlos Baptista (Ingenieria)',
    'Manuel Meszaros (Calidad)',
    'Marianna Vera (Produccion)',
  ],
  approvedBy: 'Carlos Baptista (Ingenieria)',
  plantApproval: 'Gonzalo Cal',
  reviewedBy: 'Facundo Santoro (Calidad)',
  elaboratedBy: 'Facundo Santoro (Calidad)',
}

function inferClient(amfeNumber) {
  if (!amfeNumber) return null
  if (/VWA|PAT|IPPADS|HF|HRC|HRO|INS|ARM|TR/.test(amfeNumber)) return 'VWA'
  if (/PWA|AMFE-[12]\b|HILUX/.test(amfeNumber)) return 'PWA'
  return null
}

function normalizeRev(v) {
  if (!v) return 'A'
  const s = String(v).trim()
  if (/^[A-Z]$/.test(s)) return s
  if (/^0*1$/.test(s)) return 'A'
  if (/^0*2$/.test(s)) return 'B'
  if (/^0*3$/.test(s)) return 'C'
  if (/^0+$/.test(s)) return 'A'
  return s.toUpperCase()
}

function unifyHeader(h, amfeNumber) {
  const out = { ...h }
  const stats = []

  // Alias consolidation: preserve canonical key, delete alias
  if (out.companyName && !out.organization) { out.organization = out.companyName; stats.push('companyName->organization') }
  delete out.companyName
  if (out.preparedBy && !out.elaboratedBy) { out.elaboratedBy = out.preparedBy; stats.push('preparedBy->elaboratedBy') }
  delete out.preparedBy
  if (out.revisionDate && !out.revDate) { out.revDate = out.revisionDate; stats.push('revisionDate->revDate') }
  delete out.revisionDate
  if (out.revisionLevel && !out.rev) { out.rev = out.revisionLevel }
  delete out.revisionLevel
  if (out.revision && !out.rev) { out.rev = out.revision }
  delete out.revision
  if (out.team && !out.coreTeam) { out.coreTeam = out.team; stats.push('team->coreTeam') }
  delete out.team

  // Enforce canonical values
  if (out.organization !== CANON.organization) { out.organization = CANON.organization; stats.push('organization') }
  if (out.location !== CANON.location) { out.location = CANON.location; stats.push('location') }

  // Rev normalization
  const newRev = normalizeRev(out.rev)
  if (out.rev !== newRev) { out.rev = newRev; stats.push(`rev->${newRev}`) }

  // Core team -> array 3 roles
  const needsCoreTeamFix =
    !Array.isArray(out.coreTeam) ||
    out.coreTeam.length !== 3 ||
    !out.coreTeam.every(t => typeof t === 'string' && t.includes('('))
  if (needsCoreTeamFix) {
    out.coreTeam = [...CANON.coreTeam]
    stats.push('coreTeam')
  }

  // Client
  if (!out.client || out.client.trim() === '') {
    const inferred = inferClient(amfeNumber)
    if (inferred) { out.client = inferred; stats.push(`client=${inferred}`) }
  } else {
    // Normalize variants
    if (/VOLKSWAGEN|095/i.test(out.client)) { out.client = 'VWA'; stats.push('client->VWA') }
  }

  // Approvers / reviewers — solo si estan vacios
  if (!out.approvedBy || !out.approvedBy.trim()) { out.approvedBy = CANON.approvedBy; stats.push('approvedBy') }
  if (!out.plantApproval || !out.plantApproval.trim()) { out.plantApproval = CANON.plantApproval; stats.push('plantApproval') }
  if (!out.reviewedBy || !out.reviewedBy.trim()) { out.reviewedBy = CANON.reviewedBy; stats.push('reviewedBy') }
  if (!out.elaboratedBy || !out.elaboratedBy.trim()) { out.elaboratedBy = CANON.elaboratedBy; stats.push('elaboratedBy') }

  // Guarantee approvedBy != reviewedBy
  if (out.approvedBy === out.reviewedBy) {
    out.reviewedBy = CANON.reviewedBy
    if (out.approvedBy === out.reviewedBy) out.approvedBy = CANON.approvedBy
    stats.push('approver<>reviewer')
  }

  return { header: out, stats }
}

const { data, error } = await sb.from('amfe_documents').select('*')
if (error) throw error

let totalDocs = 0
for (const doc of data) {
  const parsed = typeof doc.data === 'string' ? JSON.parse(doc.data) : doc.data
  if (!parsed?.header) { console.log(`- skip ${doc.id} (no header)`); continue }
  const amfeNum = doc.amfe_number || parsed.header.amfeNumber || parsed.header.amfe_number || ''
  const { header, stats } = unifyHeader(parsed.header, amfeNum)
  if (stats.length === 0) continue
  parsed.header = header
  const { error: upErr } = await sb.from('amfe_documents').update({ data: parsed }).eq('id', doc.id)
  if (upErr) { console.log(`X ${doc.id}: ${upErr.message}`); continue }
  console.log(`OK ${(doc.amfe_number || doc.id.slice(0, 8)).padEnd(32)} changes=[${stats.join(', ')}]`)
  totalDocs++
}
console.log(`\nTotal docs unificados: ${totalDocs}`)

// Verify
console.log('\n=== Verificacion ===')
const { data: verif } = await sb.from('amfe_documents').select('id, amfe_number, data')
for (const d of verif) {
  const p = typeof d.data === 'string' ? JSON.parse(d.data) : d.data
  const h = p.header || {}
  const issues = []
  if (h.organization !== 'BARACK MERCOSUL') issues.push(`org="${h.organization}"`)
  if (h.location !== 'PLANTA HURLINGHAM') issues.push(`loc="${h.location}"`)
  if (!Array.isArray(h.coreTeam) || h.coreTeam.length !== 3) issues.push('coreTeam')
  if (!h.approvedBy || h.approvedBy === h.reviewedBy) issues.push('approver')
  if (issues.length) console.log(`X ${d.amfe_number}: ${issues.join('; ')}`)
}
