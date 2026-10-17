export const meta = {
  name: 'revision-adversarial',
  description: 'Revision adversarial de una rama o un diff: lentes en paralelo que leen REVIEW.md, un verificador por hallazgo importante que intenta refutarlo, informe con etiquetas Importante / Nit / Preexistente',
  whenToUse: 'Al cerrar un cambio mediano o grande de codigo, antes del auditor final, o para calibrar al revisor sobre la bancada (tanda 9 del plan del sistema). Args: { repo, base, rama | diff, archivos?, lentes?, maxVerificar?, votos? }',
  phases: [
    { title: 'Lentes', detail: 'cada lente lee REVIEW.md y el diff y devuelve hallazgos con archivo, linea, caso y etiqueta' },
    { title: 'Verificar', detail: 'un verificador por hallazgo Importante, prompteado para refutar' },
  ],
}

// Receta usada a mano el 16/10/2026 sobre la rama de la impresora (docs/auditorias/REVISION_impresora_workflow_2026-10-16.md),
// guardada con parametros (tanda 9, pieza 3). El workflow no escribe archivos: devuelve `informe` (markdown) y la sesion
// lo guarda en docs/auditorias/REVISION_<rama>_<fecha>.md. Los agentes son `investigador` (definicion propia: lo exige
// el guardian de agentes y pasa por el presupuesto de puntos). Tope por defecto: 4 lentes + 6 verificadores = 10 agentes.

const A = args || {}
const REPO = A.repo || '.'
const BASE = A.base || 'main'
const RAMA = A.rama || 'HEAD'
const ARCHIVOS = Array.isArray(A.archivos) ? A.archivos : []
const MAX_VERIFICAR = Number.isFinite(A.maxVerificar) ? Math.max(0, Math.floor(A.maxVerificar)) : 6
const VOTOS = Number.isFinite(A.votos) && A.votos > 0 ? A.votos : 1
const FECHA = A.fecha || ''

const LENTES = Array.isArray(A.lentes) && A.lentes.length ? A.lentes : [
  { key: 'correctitud', enfoque: 'logica y bordes: un valor que se pisa, una condicion invertida, un caso vacio, una excepcion que no se atrapa, un off-by-one' },
  { key: 'controles', enfoque: 'un control (hook, guardian, gate, chequeo) que afloja sin test en las dos direcciones, que falla abierto en silencio (un catch que devuelve limpio u ok cuando no pudo medir) o que no puede dar rojo' },
  { key: 'datos-y-texto', enfoque: 'un numero sin fuente, ingles suelto, «Claude» o una IA nombrada en un documento, una ruta que no existe, un dato tecnico inventado' },
  { key: 'integracion', enfoque: 'quien llama a lo que cambio y que se le rompe, CI, tests que ya no prueban lo que dicen, sesiones abiertas que no toman el cambio' },
]

const QUE_MIRAR = A.diff
  ? `El cambio a revisar es este diff, pegado tal cual:\n<<<\n${A.diff}\n>>>`
  : `El cambio a revisar es \`git -C "${REPO}" diff ${BASE}...${RAMA}${ARCHIVOS.length ? ' -- ' + ARCHIVOS.join(' ') : ''}\`. Leé el diff entero y, de cada archivo tocado, el archivo completo.`

const HALLAZGOS = {
  type: 'object',
  properties: {
    hallazgos: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          archivo: { type: 'string' },
          linea: { type: 'number' },
          clase: { type: 'string', enum: ['TRUE_BUG', 'ROBUSTNESS', 'DOC'] },
          etiqueta: { type: 'string', enum: ['Importante', 'Nit', 'Preexistente'] },
          titulo: { type: 'string' },
          caso: { type: 'string' },
        },
        required: ['archivo', 'linea', 'clase', 'etiqueta', 'titulo', 'caso'],
      },
    },
  },
  required: ['hallazgos'],
}

const VEREDICTO = {
  type: 'object',
  properties: {
    refutado: { type: 'boolean' },
    etiqueta: { type: 'string', enum: ['Importante', 'Nit', 'Preexistente'] },
    caso: { type: 'string' },
  },
  required: ['refutado', 'etiqueta', 'caso'],
}

const pedidoLente = (l) => `Sos una lente de una revision adversarial de codigo. Repo: ${REPO}. Antes de mirar el cambio leé ${REPO}/REVIEW.md entero: dice que es falla aca, que NO se reporta (datos de la empresa en el repo, estilo y limpieza), las rutas que no se revisan y las etiquetas.

${QUE_MIRAR}

Tu lente: ${l.enfoque}. Mirá solo eso; otras lentes miran lo demas.

Cada hallazgo lleva archivo y linea, la clase (TRUE_BUG si rompe algo, ROBUSTNESS si se rompe en un borde raro, DOC si el texto miente), la etiqueta de REVIEW.md (Importante, Nit o Preexistente si ya estaba antes del cambio: compará contra ${BASE}) y el CASO: la entrada concreta y lo que sale mal, medido si podés correrlo sin escribir fuera de una carpeta temporal. Un «podria» sin caso no se reporta. Como mucho 3 Nit. Solo lectura: no edites ni commitees nada en el repo. Si no encontrás nada, devolvé la lista vacia.`

const pedidoVerificar = (h, n) => `Sos verificador ${n} de una revision adversarial. Repo: ${REPO}. Tu trabajo es REFUTAR este hallazgo; si no podés reproducirlo o la lectura del codigo no lo sostiene, refutado=true.

Hallazgo: ${h.archivo}:${h.linea} · ${h.clase} · ${h.titulo}
Caso que dio la lente: ${h.caso}

${QUE_MIRAR}

Leé el codigo real (no el resumen), intentá reproducir el caso en una carpeta temporal y decidí. Si se sostiene, refutado=false y en caso escribí lo que mediste. Revisá tambien la etiqueta: si el defecto ya estaba en ${BASE} es Preexistente. Solo lectura sobre el repo.`

phase('Lentes')
// Barrera a proposito (la unica): se juntan los hallazgos de TODAS las lentes por archivo y linea antes de verificar.
// Prueba del 17/10/2026 sobre un diff con 2 defectos plantados: 3 lentes encontraron los dos, el informe contaba
// 6 Importante y se gastaron 5 verificadores en 2 defectos. Ahora cada defecto se verifica una vez y se cuenta una vez.
// Una lente que no contesto (agente caido, `null`) NO es «sin hallazgos»: se cuenta y el informe lo dice (auditor 17/10).
const porLente = await parallel(LENTES.map((l) => () =>
  agent(pedidoLente(l), { label: `lente:${l.key}`, phase: 'Lentes', schema: HALLAZGOS, agentType: 'investigador' })
    .then((r) => (r ? (r.hallazgos || []).map((h) => ({ ...h, lente: l.key })) : null))))
const lentesCaidas = LENTES.filter((l, i) => !porLente[i]).map((l) => l.key)
if (lentesCaidas.length) log(`${lentesCaidas.length} lente(s) no contestaron (${lentesCaidas.join(', ')}): el informe queda incompleto`)
const crudos = porLente.filter(Boolean).flat()
const unicos = []
for (const h of crudos) {
  // la misma ruta escrita distinto (./x, x, C:/repo/x, con barras invertidas) es el mismo archivo (auditor 17/10)
  const raiz = String(REPO).replace(/\\/g, '/').toLowerCase().replace(/\/+$/, '') + '/'
  let ruta = String(h.archivo).replace(/\\/g, '/').toLowerCase()
  if (ruta.startsWith(raiz)) ruta = ruta.slice(raiz.length)
  ruta = ruta.replace(/^\.\//, '')
  const clave = `${ruta}:${h.linea}`
  const ya = unicos.find((u) => u.clave === clave)
  if (ya) { if (!ya.lentes.includes(h.lente)) ya.lentes.push(h.lente); if (h.etiqueta === 'Importante') ya.etiqueta = 'Importante'; if (h.clase === 'TRUE_BUG') ya.clase = 'TRUE_BUG' }
  else unicos.push({ ...h, clave, lentes: [h.lente] })
}
const importantes = unicos.filter((h) => h.clase === 'TRUE_BUG' || h.etiqueta === 'Importante')
// Tope total de 10 agentes (techo-agentes.md) tambien con votos > 1, salvo args.sinTope (auditor 17/10: con votos 3 salian 22)
const cupoVerif = A.sinTope ? MAX_VERIFICAR : Math.min(MAX_VERIFICAR, Math.max(0, Math.floor((10 - LENTES.length) / VOTOS)))
const aVerificar = importantes.slice(0, cupoVerif)
log(`${crudos.length} hallazgos de las lentes, ${unicos.length} distintos por archivo y linea, ${aVerificar.length} a verificar`)
const saltados = importantes.length - aVerificar.length
if (saltados) log(`${saltados} hallazgos importantes quedaron sin verificar por el tope de ${MAX_VERIFICAR}: van en «Sin verificar»`)

phase('Verificar')
const verificados = (await parallel(aVerificar.map((h) => () =>
  parallel(Array.from({ length: VOTOS }, (_, v) => () =>
    agent(pedidoVerificar(h, v + 1), { label: `verificar:${h.archivo.split(/[\\/]/).pop()}:${h.linea}:${v + 1}`, phase: 'Verificar', schema: VEREDICTO, agentType: 'investigador' })))
    .then((vs) => {
      const ok = vs.filter(Boolean)
      const sostienen = ok.filter((x) => !x.refutado)
      return { ...h, votos: ok.length, sostienen: sostienen.length, confirmado: ok.length > 0 && sostienen.length * 2 > ok.length, etiquetaVerificada: (sostienen[0] || ok[0] || {}).etiqueta || h.etiqueta, casoVerificado: (sostienen[0] || ok[0] || {}).caso || '' }
    })))).filter(Boolean)
// Un hallazgo cuyos verificadores no contestaron (0 votos) no es «refutado»: vuelve a «sin verificar» y cuenta (auditor 17/10).
const sinVoto = verificados.filter((h) => h.votos === 0)
const sinVerificar = [...unicos.filter((h) => !aVerificar.includes(h)), ...sinVoto]
const confirmados = verificados.filter((h) => h.confirmado)
const refutados = verificados.filter((h) => !h.confirmado && h.votos > 0)

const etiqueta = (h) => h.etiquetaVerificada || h.etiqueta
const cuenta = (e) => confirmados.filter((h) => etiqueta(h) === e).length + sinVerificar.filter((h) => h.etiqueta === e).length
const L = []
L.push(`# Revisión adversarial de ${A.diff ? 'un diff pegado' : `${RAMA} contra ${BASE}`}${FECHA ? ` — ${FECHA}` : ''}`)
L.push('')
L.push(`**${cuenta('Importante')} Importante, ${cuenta('Nit')} Nit, ${cuenta('Preexistente')} Preexistente** (confirmados más sin verificar; los refutados no cuentan). ${LENTES.length} lentes (${LENTES.map((l) => l.key).join(', ')}), ${crudos.length} hallazgos de las lentes, ${unicos.length} distintos por archivo y linea, ${verificados.length} verificados con ${VOTOS} voto(s) cada uno, tope ${MAX_VERIFICAR}.`)
if (lentesCaidas.length || sinVoto.length) L.push('', `**INCOMPLETO**: ${lentesCaidas.length} lente(s) no contestaron (${lentesCaidas.join(', ') || '-'}) y ${sinVoto.length} hallazgo(s) quedaron sin ningún voto del verificador. Un agente caído no es «sin hallazgos».`)
L.push('')
L.push('Al lado de cada hallazgo, quien lo recibe anota qué hizo: **arreglado / rechazado / a propósito / no importa** (REVIEW.md). Eso mide el ruido del revisor.')
L.push('')
L.push(`## Confirmados (${confirmados.length})`)
for (const h of confirmados) L.push(`- [${etiqueta(h)}] \`${h.archivo}:${h.linea}\` · ${h.clase} · lentes ${h.lentes.join(", ")} — ${h.titulo} · caso: ${h.casoVerificado || h.caso} · respuesta: ____`)
L.push('')
L.push(`## Refutados (${refutados.length})`)
for (const h of refutados) L.push(`- \`${h.archivo}:${h.linea}\` · ${h.clase} · lentes ${h.lentes.join(", ")} — ${h.titulo} · por qué no: ${h.casoVerificado || 'sin veredicto'}`)
L.push('')
L.push(`## Sin verificar (${sinVerificar.length}: ROBUSTNESS, DOC y lo que pasó el tope; se juzgan al leerlos)`)
const nits = sinVerificar.filter((h) => h.etiqueta === 'Nit'); const otros = sinVerificar.filter((h) => h.etiqueta !== 'Nit')
for (const h of [...otros, ...nits.slice(0, 3)]) L.push(`- [${h.etiqueta}] \`${h.archivo}:${h.linea}\` · ${h.clase} · lentes ${h.lentes.join(', ')} — ${h.titulo} · caso: ${h.caso} · respuesta: ____`)
if (nits.length > 3) L.push(`- y ${nits.length - 3} nits mas (tope de 3 de REVIEW.md)`)

return { conteo: { Importante: cuenta('Importante'), Nit: cuenta('Nit'), Preexistente: cuenta('Preexistente') }, incompleto: lentesCaidas.length > 0 || sinVoto.length > 0, lentesCaidas, confirmados, refutados, sinVerificar, informe: L.join('\n') }
