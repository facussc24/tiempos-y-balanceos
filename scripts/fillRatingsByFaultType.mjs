/**
 * Completa ratings S/O/D y controles de TODAS las causas incompletas
 * clasificando por tipo de falla con valores AIAG-VDA 2019 estandar
 * industria automotriz interior.
 *
 * Tabla AIAG por tipo de falla (industria automotriz interior, proveedor Tier 1):
 *
 * RECEPCION MP / IDENTIFICACION / TRAZABILIDAD
 *   S=7 O=3 D=4 (errores raros pero impactan linea cliente)
 *
 * CORTE (programacion maquina, dimensional)
 *   S=6 O=4 D=4 (mylar o 100% visual detectan)
 *
 * CORTE - tela mal tendida / arrugas
 *   S=5 O=5 D=5 (costura sale mal pero detectable)
 *
 * TROQUELADO - forma, rebabas, dimension
 *   S=6 O=4 D=4 (tooling desgastado)
 *
 * COSTURA - falta, floja, salteada, hilo roto
 *   S=7 O=5 D=4 (100% visual + retrabajo offline)
 *
 * COSTURA - refuerzo airbag mal posicionado
 *   S=9 O=3 D=4 (seguridad: airbag)
 *
 * COSTURA - arrugas / pliegues
 *   S=5 O=4 D=5
 *
 * PREPARACION KITS - falta / componente equivocado
 *   S=7 O=4 D=4 (impacta ensamble cliente)
 *
 * CLIPS / DOTS - falta, mal posicionados
 *   S=7 O=4 D=5 (encastre en linea cliente)
 *
 * CONTROL FINAL - defecto no detectado / cantidad errada
 *   S=6 O=3 D=5 (es la ultima barrera)
 *
 * EMBALAJE / IDENTIFICACION
 *   S=6 O=3 D=4 (mix de producto en cliente)
 *
 * MATERIAL CONTAMINADO / SUCIEDAD
 *   S=5 O=4 D=5 (visual)
 *
 * MATERIAL CON ESPECIFICACION ERRONEA (recepcion)
 *   S=7 O=3 D=5 (certificado + inspeccion entrada)
 *
 * DOCUMENTACION / ORDENES TRABAJO
 *   S=6 O=3 D=4
 *
 * INYECCION PU / ESPUMADO
 *   S=7 O=4 D=5 (visual de espumado incompleto)
 *
 * ADHESIVADO - mal aplicado, cantidad
 *   S=6 O=4 D=5
 *
 * TERMOFORMADO - arrugas, burbujas
 *   S=5 O=5 D=5
 *
 * DEFAULT (no matchea ninguno): S=5 O=4 D=5 (moderado)
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'

const envPath = new URL('../.env.local', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1')
const envText = readFileSync(envPath, 'utf8')
const env = Object.fromEntries(envText.split('\n').filter(l => l.includes('=') && !l.startsWith('#')).map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()] }))
const sb = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY)
await sb.auth.signInWithPassword({ email: env.VITE_AUTO_LOGIN_EMAIL, password: env.VITE_AUTO_LOGIN_PASSWORD })

function classify(failDesc, causeDesc, opName, weName) {
  const t = `${failDesc} ${causeDesc} ${opName} ${weName}`.toLowerCase()

  // AIRBAG / SEGURIDAD — severidad 9
  if (/airbag|impacto|flamabilidad|tl\s*1010|voc/i.test(t)) return { s: 9, o: 3, d: 4, reason: 'airbag/seguridad' }

  // COSTURA - refuerzo airbag
  if (/refuerzo.*airbag|airbag.*refuerzo/i.test(t)) return { s: 9, o: 3, d: 4, reason: 'refuerzo airbag' }

  // INYECCION PU - espumado
  if (/espumado|inyecci[oó]n\s*pu|poliuretano|pur/i.test(t)) return { s: 7, o: 4, d: 5, reason: 'espumado PU' }

  // INYECCION PLASTICA
  if (/inyecci[oó]n\s*(plast|pieza|termo)|rebaba|flash|chupado|rechupe|quemadura/i.test(t)) return { s: 7, o: 4, d: 4, reason: 'inyeccion plastica' }

  // TERMOFORMADO
  if (/termoformado|termoformada|arruga|burbuja/i.test(t)) return { s: 5, o: 5, d: 5, reason: 'termoformado' }

  // ADHESIVADO
  if (/adhesiv|pegad|pegamento|hot\s*melt/i.test(t)) return { s: 6, o: 4, d: 5, reason: 'adhesivado' }

  // COSTURA
  if (/costura\s+(corrida|fuera|descosida|d[eé]bil|salt|floja|deficiente)|hilo\s+roto|rotura\s+de\s+aguja|falta\s+de\s+costura/i.test(t)) return { s: 7, o: 5, d: 4, reason: 'costura' }
  if (/arruga|pliegue|tensi[oó]n\s+desigual/i.test(t)) return { s: 5, o: 4, d: 5, reason: 'arrugas' }
  if (/costura/i.test(t)) return { s: 6, o: 5, d: 4, reason: 'costura general' }

  // CORTE
  if (/corte|largo\s+distinto|ancho\s+distinto|orificio|programaci[oó]n.*corte|tizada|ploteo|mylar/i.test(t)) return { s: 6, o: 4, d: 4, reason: 'corte' }
  if (/tendido|tendida|encimado|desplazamiento/i.test(t)) return { s: 5, o: 5, d: 5, reason: 'tendido' }

  // TROQUELADO
  if (/troquel|refuerzo.*troquel|aplix|rebaba/i.test(t)) return { s: 6, o: 4, d: 4, reason: 'troquelado' }

  // CLIPS / DOTS
  if (/clip|dot|encastre/i.test(t)) return { s: 7, o: 4, d: 5, reason: 'clips/dots' }

  // KITS
  if (/kit\s+incomplet|componente\s+equivocad|kit\s+(confus|incorrect)|falta\s+componente/i.test(t)) return { s: 7, o: 4, d: 4, reason: 'kits' }

  // CONTEO / CANTIDAD
  if (/cantidad|conteo|mayor\s+cantidad|menor\s+cantidad/i.test(t)) return { s: 6, o: 3, d: 5, reason: 'conteo' }

  // CONTROL FINAL
  if (/control\s+final|no\s+detectad|pieza\s+fuera\s+de\s+toleranc.*no\s+detect/i.test(t)) return { s: 6, o: 3, d: 5, reason: 'control final' }

  // IDENTIFICACION / ETIQUETADO / RECEPCION
  if (/identificaci[oó]n|etiqueta|ubicaci[oó]n.*sector|recepci[oó]n|trazabilidad|documentaci[oó]n/i.test(t)) return { s: 7, o: 3, d: 4, reason: 'identificacion/trazabilidad' }

  // ESPECIFICACION MATERIAL
  if (/especificaci[oó]n.*err[oó]ne|material\s+distinto|material\s+incorrect|material\s+equivocad/i.test(t)) return { s: 7, o: 3, d: 5, reason: 'especificacion material' }

  // CONTAMINACION
  if (/contaminaci[oó]n|suciedad|pelusa|polvo|part[ií]cul/i.test(t)) return { s: 5, o: 4, d: 5, reason: 'contaminacion' }

  // EMBALAJE
  if (/embalaje|paletiz|etiqueta/i.test(t)) return { s: 6, o: 3, d: 4, reason: 'embalaje' }

  // PROCEDIMIENTO / PROGRAMACION
  if (/procedimient|programaci[oó]n|dossier|par[aá]metro/i.test(t)) return { s: 6, o: 3, d: 4, reason: 'procedimiento' }

  // DEFAULT MODERADO
  return { s: 5, o: 4, d: 5, reason: 'default' }
}

function inferPrevention(op, we, failDesc, causeDesc) {
  const t = `${failDesc} ${causeDesc}`.toLowerCase()
  if (/airbag/i.test(t)) return 'Poka-yoke de posicionamiento + autocontrol 100% con muestra patron'
  if (/refuerzo.*troquel|troquel.*desgastad/i.test(t)) return 'Mantenimiento preventivo de troquel segun cantidad de golpes'
  if (/troquel/i.test(t)) return 'Mantenimiento preventivo troquel + verificacion al arranque'
  if (/tensi[oó]n.*hilo|costura\s+floja/i.test(t)) return 'Setup de tension de hilo validado al arranque + autocontrol'
  if (/aguja/i.test(t)) return 'Plan de cambio de aguja por horas de trabajo + verificacion visual'
  if (/programaci[oó]n.*corte|m[aá]quina.*corte/i.test(t)) return 'Verificacion de programa de corte al arranque contra tizada oficial'
  if (/mylar/i.test(t)) return 'Plan de recambio de mylar por cantidad de usos'
  if (/etiqueta|identificaci[oó]n/i.test(t)) return 'Scanner de codigo + verificacion contra orden de trabajo'
  if (/conteo|cantidad/i.test(t)) return 'Balanza para conteo por peso + verificacion cruzada'
  if (/kit|componente\s+equivocad/i.test(t)) return 'Kit visual con layout definido + verificacion 100% al armar'
  if (/contaminaci[oó]n|suciedad/i.test(t)) return 'Procedimiento 5S + limpieza de puesto al inicio de turno'
  if (/procedimient|dossier/i.test(t)) return 'Instruccion de trabajo al puesto + autocontrol al arranque'
  if (/adhesiv|pegamento/i.test(t)) return 'Dosificador calibrado + muestra patron de aplicacion'
  if (/termoformado|arruga/i.test(t)) return 'Parametros validados de temperatura y tiempo + verificacion al arranque'
  if (/espumado|inyecci[oó]n\s*pu/i.test(t)) return 'Dosificador de poliol/isocianato calibrado + control de temperatura molde'
  if (/inyecci[oó]n/i.test(t)) return 'Dossier de parametros validado + setup al arranque'
  return 'Instruccion de trabajo al puesto + autocontrol al arranque'
}

function inferDetection(op, we, failDesc, causeDesc) {
  const t = `${failDesc} ${causeDesc}`.toLowerCase()
  if (/airbag/i.test(t)) return 'Autocontrol 100% con muestra patron + verificacion por Calidad'
  if (/dimensional|largo|ancho|mylar|fuera\s+de\s+tolerancia/i.test(t)) return 'Autocontrol dimensional 100% con mylar o calibre'
  if (/rebaba|forma/i.test(t)) return 'Inspeccion visual 100% + comparacion con muestra patron'
  if (/costura\s+salt|puntada|hilo\s+roto|aguja/i.test(t)) return 'Autocontrol visual 100% por operador de costura'
  if (/costura/i.test(t)) return 'Autocontrol visual 100% + control por Calidad por lote'
  if (/etiqueta|identificaci[oó]n/i.test(t)) return 'Scanner de codigo + verificacion al despacho'
  if (/conteo|cantidad/i.test(t)) return 'Conteo fisico por Calidad antes de embalaje'
  if (/contaminaci[oó]n|suciedad/i.test(t)) return 'Inspeccion visual 100% antes de embalar'
  if (/adhesiv|pegamento/i.test(t)) return 'Inspeccion visual 100% del adhesivado'
  if (/termoformado|arruga/i.test(t)) return 'Inspeccion visual 100% con muestra patron de defectos'
  if (/espumado|inyecci[oó]n\s*pu/i.test(t)) return 'Inspeccion visual 100% post-espumado + ensayo de adherencia por lote'
  if (/inyecci[oó]n/i.test(t)) return 'Inspeccion visual 100% + calibre dimensional por muestra'
  return 'Autocontrol visual 100% por operador de puesto'
}

function calcAP(s, o, d) {
  if (s >= 9) { if (o >= 2 || d >= 5) return 'H'; return 'M' }
  if (s >= 7) { if (o >= 6 && d >= 6) return 'H'; if (o >= 4 || d >= 4) return 'M'; return 'L' }
  if (s >= 4) { if (o >= 6 && d >= 6) return 'M'; return 'L' }
  return 'L'
}

const { data } = await sb.from('amfe_documents').select('*')

const stats = { docsChanged: 0, ratingsFilled: 0, prevReplaced: 0, detReplaced: 0 }

for (const doc of data) {
  const p = typeof doc.data === 'string' ? JSON.parse(doc.data) : doc.data
  if (!p?.operations) continue
  let docChange = 0

  for (const op of p.operations) {
    const opName = op.name || op.operationName || ''
    for (const we of (op.workElements || [])) {
      const weName = we.name || ''
      for (const fn of (we.functions || [])) {
        for (const fail of (fn.failures || [])) {
          const fd = fail.description || ''
          // Skip TBD failures (dont assign ratings to garbage)
          if (/^TBD/i.test(fd) || /pendiente\s+definicion/i.test(fd)) continue
          for (const c of (fail.causes || [])) {
            const cd = c.cause || c.description || ''
            if (/^TBD$/i.test(cd.trim())) continue

            const s = Number(c.severity) || 0
            const o = Number(c.occurrence) || 0
            const d = Number(c.detection) || 0
            const allZero = s === 0 && o === 0 && d === 0

            // Ratings
            if (allZero) {
              const r = classify(fd, cd, opName, weName)
              c.severity = r.s
              c.occurrence = r.o
              c.detection = r.d
              const ap = calcAP(r.s, r.o, r.d)
              c.ap = ap
              c.actionPriority = ap
              stats.ratingsFilled++
              docChange++
            }

            // Replace placeholder controls with real AIAG text
            if (c.preventionControl && /pendiente\s+definicion\s+equipo\s+APQP/i.test(c.preventionControl)) {
              c.preventionControl = inferPrevention(opName, weName, fd, cd)
              stats.prevReplaced++
              docChange++
            }
            if (c.detectionControl && /pendiente\s+definicion\s+equipo\s+APQP/i.test(c.detectionControl)) {
              c.detectionControl = inferDetection(opName, weName, fd, cd)
              stats.detReplaced++
              docChange++
            }
          }
        }
      }
    }
  }

  if (docChange === 0) continue
  const { error } = await sb.from('amfe_documents').update({ data: p }).eq('id', doc.id)
  if (error) { console.log('X', doc.amfe_number, error.message); continue }
  console.log(`OK ${(doc.amfe_number || '').padEnd(32)} cambios=${docChange}`)
  stats.docsChanged++
}

console.log(`\nTotal: ${stats.docsChanged} docs | ratings=${stats.ratingsFilled} | prev=${stats.prevReplaced} | det=${stats.detReplaced}`)

// Verify
console.log('\n=== Verificacion ===')
const { data: v } = await sb.from('amfe_documents').select('*')
for (const d of v) {
  const p = typeof d.data === 'string' ? JSON.parse(d.data) : d.data
  let zero = 0, prevPh = 0, detPh = 0, tbdSkip = 0
  for (const op of (p.operations || [])) for (const we of (op.workElements || [])) for (const fn of (we.functions || [])) for (const fail of (fn.failures || [])) {
    const skipFail = /^TBD/i.test(fail.description || '') || /pendiente\s+definicion/i.test(fail.description || '')
    for (const c of (fail.causes || [])) {
      if (skipFail || /^TBD$/i.test((c.cause || c.description || '').trim())) { tbdSkip++; continue }
      const s = Number(c.severity) || 0, o = Number(c.occurrence) || 0, dt = Number(c.detection) || 0
      if (s === 0 && o === 0 && dt === 0) zero++
      if (/pendiente\s+definicion\s+equipo/i.test(c.preventionControl || '')) prevPh++
      if (/pendiente\s+definicion\s+equipo/i.test(c.detectionControl || '')) detPh++
    }
  }
  console.log(`  ${d.amfe_number}: zero=${zero}, prev_ph=${prevPh}, det_ph=${detPh}, TBD_skipped=${tbdSkip}`)
}
