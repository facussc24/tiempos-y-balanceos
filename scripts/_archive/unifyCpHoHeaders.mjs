/**
 * Unifica headers de cp_documents (10) y ho_documents (8) con el mismo canon que AMFE:
 *   organization = "BARACK MERCOSUL"
 *   location = "PLANTA HURLINGHAM"
 *   rev = letra
 *   coreTeam = array con 3 roles (sin acentos)
 *   approvedBy, plantApproval, reviewedBy, elaboratedBy canonicos
 *
 * PRESERVA:
 *   - controlPlanNumber / cpNumber / formNumber / hoNumber (codigo unico por doc)
 *   - partNumber, partName, partDescription
 *   - startDate, revDate, fechas
 *   - customerApproval, supplierCode si existen
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'

const envPath = new URL('../.env.local', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1')
const envText = readFileSync(envPath, 'utf8')
const env = Object.fromEntries(envText.split('\n').filter(l => l.includes('=') && !l.startsWith('#')).map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()] }))
const sb = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY)
await sb.auth.signInWithPassword({ email: env.VITE_AUTO_LOGIN_EMAIL, password: env.VITE_AUTO_LOGIN_PASSWORD })

const CANON_CP = {
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

const CANON_HO = {
  organization: 'BARACK MERCOSUL',
  location: 'PLANTA HURLINGHAM',
  coreTeam: [
    'Carlos Baptista (Ingenieria)',
    'Manuel Meszaros (Calidad)',
    'Marianna Vera (Produccion)',
  ],
  elaboratedBy: 'Facundo Santoro (Calidad)',
  realizedBy: 'Facundo Santoro (Calidad)',
  approvedBy: 'Carlos Baptista (Ingenieria)',
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

function stripAccents(s) {
  if (typeof s !== 'string') return s
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

function unifyCoreTeam(current, canon) {
  if (!Array.isArray(current) || current.length !== 3) return [...canon]
  // Strip accents
  const stripped = current.map(t => typeof t === 'string' ? stripAccents(t) : t)
  if (JSON.stringify(stripped) === JSON.stringify(current)) return current
  return stripped
}

function unifyCpHeader(h) {
  const out = { ...h }
  const changes = []

  // Aliases
  if (out.companyName && !out.organization) { out.organization = out.companyName; changes.push('companyName->organization') }
  delete out.companyName
  if (out.preparedBy && !out.elaboratedBy) { out.elaboratedBy = out.preparedBy; changes.push('preparedBy->elaboratedBy') }
  delete out.preparedBy
  if (out.revisionDate && !out.revDate) { out.revDate = out.revisionDate; changes.push('revisionDate->revDate') }
  delete out.revisionDate
  if (out.revisionLevel && !out.rev) { out.rev = out.revisionLevel }
  delete out.revisionLevel
  if (out.revision && !out.rev) { out.rev = out.revision }
  delete out.revision
  if (out.team && !out.coreTeam) { out.coreTeam = out.team; changes.push('team->coreTeam') }
  delete out.team

  // Canonical values
  if (out.organization !== CANON_CP.organization) { out.organization = CANON_CP.organization; changes.push('organization') }
  if (out.location !== CANON_CP.location) { out.location = CANON_CP.location; changes.push('location') }

  const newRev = normalizeRev(out.rev)
  if (out.rev !== newRev) { out.rev = newRev; changes.push(`rev->${newRev}`) }

  const newCoreTeam = unifyCoreTeam(out.coreTeam, CANON_CP.coreTeam)
  if (JSON.stringify(newCoreTeam) !== JSON.stringify(out.coreTeam)) {
    out.coreTeam = newCoreTeam
    changes.push('coreTeam')
  }

  if (!out.approvedBy || !out.approvedBy.trim() || out.approvedBy === 'Carlos Baptista') {
    out.approvedBy = CANON_CP.approvedBy
    changes.push('approvedBy')
  }
  if (!out.plantApproval || !out.plantApproval.trim()) { out.plantApproval = CANON_CP.plantApproval; changes.push('plantApproval') }
  if (!out.reviewedBy || !out.reviewedBy.trim()) { out.reviewedBy = CANON_CP.reviewedBy; changes.push('reviewedBy') }
  if (!out.elaboratedBy || !out.elaboratedBy.trim()) { out.elaboratedBy = CANON_CP.elaboratedBy; changes.push('elaboratedBy') }

  if (out.approvedBy === out.reviewedBy) {
    out.reviewedBy = CANON_CP.reviewedBy
    if (out.approvedBy === out.reviewedBy) out.approvedBy = CANON_CP.approvedBy
    changes.push('approver<>reviewer')
  }

  return { header: out, changes }
}

function unifyHoHeader(h) {
  const out = { ...h }
  const changes = []

  if (out.companyName && !out.organization) { out.organization = out.companyName; changes.push('companyName->organization') }
  delete out.companyName

  if (out.organization !== CANON_HO.organization) { out.organization = CANON_HO.organization; changes.push('organization') }
  if (out.location !== CANON_HO.location) { out.location = CANON_HO.location; changes.push('location') }

  const newCoreTeam = unifyCoreTeam(out.coreTeam, CANON_HO.coreTeam)
  if (JSON.stringify(newCoreTeam) !== JSON.stringify(out.coreTeam)) {
    out.coreTeam = newCoreTeam
    changes.push('coreTeam')
  }

  if (!out.elaboratedBy || !out.elaboratedBy.trim()) { out.elaboratedBy = CANON_HO.elaboratedBy; changes.push('elaboratedBy') }
  if (!out.realizedBy || !out.realizedBy.trim()) { out.realizedBy = CANON_HO.realizedBy; changes.push('realizedBy') }

  return { header: out, changes }
}

async function processTable(table, unifyFn, labelField) {
  console.log(`\n=== ${table} ===`)
  const { data, error } = await sb.from(table).select('*')
  if (error) throw error
  let total = 0
  for (const doc of data) {
    const parsed = typeof doc.data === 'string' ? JSON.parse(doc.data) : doc.data
    if (!parsed?.header) { console.log(`- skip ${doc.id.slice(0, 8)} (no header)`); continue }
    const { header, changes } = unifyFn(parsed.header)
    if (!changes.length) continue
    parsed.header = header
    const { error: upErr } = await sb.from(table).update({ data: parsed }).eq('id', doc.id)
    if (upErr) { console.log(`X ${doc.id}: ${upErr.message}`); continue }
    const label = doc[labelField] || doc.id.slice(0, 8)
    console.log(`OK ${label.toString().padEnd(32)} [${changes.join(', ')}]`)
    total++
  }
  console.log(`Total ${table}: ${total} docs unificados`)
}

await processTable('cp_documents', unifyCpHeader, 'cp_number')
await processTable('ho_documents', unifyHoHeader, 'ho_number')

// Verify
console.log('\n=== Verificacion final ===')
for (const t of ['cp_documents', 'ho_documents']) {
  const { data: v } = await sb.from(t).select('id, data')
  let bad = 0
  for (const d of v) {
    const p = typeof d.data === 'string' ? JSON.parse(d.data) : d.data
    const h = p.header || {}
    const issues = []
    if (h.organization !== 'BARACK MERCOSUL') issues.push('org')
    if (h.location !== 'PLANTA HURLINGHAM') issues.push('loc')
    if (!Array.isArray(h.coreTeam) || h.coreTeam.length !== 3) issues.push('coreTeam')
    if (issues.length) { console.log(`X ${t} ${d.id.slice(0, 8)}: ${issues.join(', ')}`); bad++ }
  }
  if (!bad) console.log(`  ${t}: all OK`)
}
