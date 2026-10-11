// vitest, sin la app: solo los módulos puros. Desde la raíz del repo:
//   npx vitest run mods/tablero/tests/tablero.test.mjs --pool=threads
import { describe, expect, test } from 'vitest'
import { armarCupo, juntarAgentes, leerEstado, leerLedger, leerHora, leerAgentes, leerAgentesMod, msModificado, tramo } from '../hooks/estado.mjs'
import { dibujar, textoPlano, faltan, usd, barra } from '../hooks/dibujo.mjs'

// 11/10/2026 20:50 en hora LOCAL: los archivos de la casa están en hora local y el test
// construye «ahora» igual, así da lo mismo en qué zona corra
const AHORA = new Date(2026, 9, 11, 20, 50).getTime()
const reloj = { ahora: async () => AHORA }
const seg = (ms) => Math.floor(ms / 1000)
const DONDE = { casa: '/casa', repo: '/repo', sesion: 'ses-1', nombreCasa: 'Barack Mercosul', proyecto: 'BarackMercosul', corriendo: 2 }

const ARCHIVOS = {
  '/casa/.agent-spawns.log': [
    `${seg(AHORA - 15 * 60_000)} Agent 5`, // hace 15 min: fuera de la ventana
    `${seg(AHORA - 2 * 60_000)} Agent 3`,
    `${seg(AHORA - 30_000)} Agent 5`,
    `${seg(AHORA - 10_000)} Agent 0`,      // como la línea real de la muestra
  ].join('\n') + '\n',
  '/casa/.trabajar-hasta.json': JSON.stringify({
    vieja: { hasta: '2026-10-09 07:30', cumplido: '2026-10-09 06:32', pedido: 'ya cerrada', fijado_ms: 1 },
    'ses-1': { hasta: '2026-10-11 23:00', pedido: 'te dejo modo full auto 48 hs seguidas', fijado_ms: 2 },
  }),
  '/repo/.sgc-cache/api/ledger_2026-10.jsonl': [
    '{"ts":"2026-10-11 01:59:33","tarea":"sesion:auditoria-tanda-12","modelo":"claude-opus-5-5","costoUsd":1.278272}',
    '{"ts":"2026-10-11 02:00:10","tarea":"sesion:auditoria-tanda-10","modelo":"claude-opus-5-5","costoUsd":1.462904}',
    '{"ts":"2026-10-03 10:00:00","tarea":"otra","modelo":"claude-haiku","costoUsd":0.5}',
  ].join('\n') + '\n',
  '/repo/.claude/state/nocturno.json': JSON.stringify({ prioridades: [{}, {}, {}, {}] }),
}
const CARPETAS = { '/repo/.sgc-cache/api/en-curso': [{ name: 'a.json' }, { name: 'b.json' }] }

const fsFalso = (archivos = {}, carpetas = {}) => ({
  leer: async (ruta) => archivos[ruta] ?? null,
  stat: async (ruta) => (ruta in archivos ? { mtimeMs: AHORA - 22 * 3600_000 } : null), // 10/10 22:50
  listar: async (ruta) => carpetas[ruta] ?? null,
})
const LIMITES = [
  { kind: 'five_hour', percentUsed: 62, resetsAt: new Date(AHORA + 130 * 60_000).toISOString() },
  { kind: 'seven_day', percentUsed: 31 },
]

describe('verde: con los archivos de ejemplo da los números esperados', () => {
  test('leerEstado junta todo', async () => {
    const s = await leerEstado(fsFalso(ARCHIVOS, CARPETAS), reloj, { ...DONDE, limites: LIMITES })
    expect(s.cupo.cincoHoras).toMatchObject({ pct: 62, tramo: 'ambar', renueva: '23:00' })
    expect(s.cupo.semana).toMatchObject({ pct: 31, tramo: 'verde', renueva: null })
    expect(s.agentes).toEqual({ puntos: 8, lanzados: 3, tope: 40, corriendo: 2 })
    expect(s.hora).toMatchObject({ hasta: '23:00', faltanMin: 130, propia: true })
    expect(s.api.hoy).toBeCloseTo(2.741176, 6)
    expect(s.api.ciclo).toBeCloseTo(3.241176, 6)
    expect(s.api).toMatchObject({ llamadas: 3, rotas: 0, enCurso: 2, mes: '2026-10' })
    expect(s.noche).toEqual({ fecha: '2026-10-10', prioridades: 4 })
  })

  test('dibujar pone los textos esperados, cada uno en su fila', async () => {
    const s = await leerEstado(fsFalso(ARCHIVOS, CARPETAS), reloj, { ...DONDE, limites: LIMITES })
    const t = textoPlano(dibujar(s, undefined, { ancho: 120 }))
    expect(t).toContain('Barack Mercosul · BarackMercosul')
    expect(t).toContain('5 h 62 % ██████░░░░ renueva 23:00')
    expect(t).toContain('semana 31 % ███░░░░░░░')
    expect(t).toContain('corren 2 · 10 min 8/40 pts')
    expect(t).toContain('laburando hasta 23:00 · faltan 2 h 10')
    expect(t).toContain('«te dejo modo full auto 48 hs seguidas»')
    expect(t).toContain('hoy US$ 2,74 · octubre US$ 3,24 · 3 llamadas · en curso 2')
    expect(t).toContain('2026-10-10 · 4 prioridades')
    // en una banda angosta el pedido se recorta, la banda no
    expect(textoPlano(dibujar(s, undefined, { ancho: 60 }))).toContain('«te dejo modo full…')
  })

  test('tramos y formatos', () => {
    expect([59.9, 60, 85, 85.1, null].map(tramo)).toEqual(['verde', 'ambar', 'ambar', 'rojo', 'sin'])
    expect(faltan(130)).toBe('2 h 10')
    expect(faltan(5)).toBe('5 min')
    expect(usd(38.7)).toBe('US$ 38,70')
    expect(barra(100)).toBe('██████████')
    expect(barra(0)).toBe('░░░░░░░░░░')
  })

  test('msModificado acepta mtimeMs (número) o mtime (Date o ISO); null si no hay', () => {
    expect(msModificado({ mtimeMs: AHORA })).toBe(AHORA)
    expect(msModificado({ mtime: new Date(AHORA) })).toBe(AHORA)
    expect(msModificado({ mtime: new Date(AHORA).toISOString() })).toBe(AHORA)
    expect(msModificado(null)).toBeNull()
    expect(msModificado({})).toBeNull()
  })
})

describe('rojo: sin archivos no rompe, una línea rota se saltea', () => {
  test('sin ningún archivo: «sin datos» en cada fila y nada tira', async () => {
    const s = await leerEstado(fsFalso(), reloj, { sesion: 'ses-1' })
    expect(s.hora).toBeNull()
    expect(s.noche).toBeNull()
    expect(s.api).toMatchObject({ hoy: null, ciclo: null, llamadas: null, rotas: 0, enCurso: null })
    expect(s.agentes).toMatchObject({ puntos: null, lanzados: null, corriendo: null })
    expect(s.cupo).toEqual({ cincoHoras: null, semana: null })
    const t = textoPlano(dibujar(s))
    expect(t.match(/sin datos/g)).toHaveLength(4)
    expect(t).toContain('sin hora fijada')
  })

  test('sin estado (todavía no se leyó nada) también dibuja', () => {
    expect(textoPlano(dibujar(null))).toContain('sin datos')
  })

  test('un ledger con una línea rota se saltea esa línea y cuenta el resto', () => {
    const texto = [
      '{"ts":"2026-10-11 01:00:00","costoUsd":1}',
      '{"ts":"2026-10-11 02:00:00","cost',          // write a medias
      '',
      '{"ts":"2026-10-11 03:00:00","costoUsd":"x"}', // costo que no es número
      '{"ts":"2026-10-11 04:00:00","costoUsd":2}',
    ].join('\n')
    expect(leerLedger(texto, '2026-10-11')).toEqual({ hoy: 3, ciclo: 3, llamadas: 2, rotas: 2 })
  })

  test('un .trabajar-hasta.json roto o sin vigente da null', () => {
    expect(leerHora('{ rot', AHORA, 'ses-1')).toBeNull()
    expect(leerHora(JSON.stringify({ x: { hasta: '2026-10-11 20:00', pedido: 'ya pasó' } }), AHORA, 'ses-1')).toBeNull()
  })

  test('una hora vigente de OTRA sesión se muestra marcada', () => {
    const h = leerHora(JSON.stringify({ otra: { hasta: '2026-10-12 06:00', pedido: 'toda la noche' } }), AHORA, 'ses-1')
    expect(h).toMatchObject({ hasta: '06:00', faltanMin: 550, propia: false })
    expect(textoPlano(dibujar({ hora: h }))).toContain('(otra sesión)')
  })

  test('un log de agentes con basura no suma', () => {
    expect(leerAgentes('basura\n\n' + `${seg(AHORA)} Agent 2\n`, AHORA)).toEqual({ puntos: 2, lanzados: 1, tope: 40 })
  })

  test('el registro del mod presupuesto-agentes: cuenta las PERMITIR de la ventana y toma el tope de la última decisión', () => {
    const iso = (ms) => new Date(ms).toISOString()
    const log = [
      `${iso(AHORA - 15 * 60_000)} agent.spawn PERMITIR investigador model=sonnet peso=4 cupo[five_hour=5%] def=x :: 4/40 puntos en la ventana`, // fuera de la ventana
      `${iso(AHORA - 3 * 60_000)} session.start surface=desktop raiz=C:/Dev/BarackMercosul`,
      `${iso(AHORA - 2 * 60_000)} agent.spawn PERMITIR buscador model=(definicion) peso=1 cupo[seven_day=61%] def=x :: 1/60 puntos en la ventana`,
      `${iso(AHORA - 60_000)} agent.spawn PERMITIR auditor model=(definicion) peso=0 cupo[seven_day=61%] def=x :: auditoria final: pasa sin descontar`,
      `${iso(AHORA - 30_000)} agent.spawn NEGAR investigador model=fable peso=20 cupo[seven_day=61%] def=x :: Presupuesto de subagentes agotado: 41/60 puntos en los ultimos 10 minutos; esta llamada pesa 20`,
      'basura',
    ].join('\n') + '\n'
    expect(leerAgentesMod(log, AHORA)).toEqual({ puntos: 1, lanzados: 2, tope: 60 })
    expect(leerAgentesMod(null, AHORA)).toEqual({ puntos: null, lanzados: null, tope: 40 })
    expect(leerAgentesMod('', AHORA)).toEqual({ puntos: 0, lanzados: 0, tope: 40 })
  })

  test('los dos libros no se suman: vale el que más puntos tiene, con el tope que dijo el mod', async () => {
    const bash = { puntos: 8, lanzados: 3, tope: 40 }
    expect(juntarAgentes(bash, { puntos: null, lanzados: null, tope: 40 })).toEqual(bash)
    expect(juntarAgentes({ puntos: null, lanzados: null, tope: 40 }, { puntos: 5, lanzados: 2, tope: 60 })).toEqual({ puntos: 5, lanzados: 2, tope: 60 })
    expect(juntarAgentes(bash, { puntos: 8, lanzados: 3, tope: 60 })).toEqual({ puntos: 8, lanzados: 3, tope: 60 })
    expect(juntarAgentes({ puntos: 0, lanzados: 0, tope: 40 }, { puntos: 9, lanzados: 3, tope: 40 })).toEqual({ puntos: 9, lanzados: 3, tope: 40 })
    // de punta a punta: sin el libro del bash (el día que se retire), el tablero muestra lo del mod
    const iso = new Date(AHORA - 60_000).toISOString()
    const archivos = { '/casa/mods-log/presupuesto-agentes.log': `${iso} agent.spawn PERMITIR investigador model=opus peso=8 cupo[] def=x :: 8/40 puntos en la ventana\n` }
    const s = await leerEstado(fsFalso(archivos), reloj, DONDE)
    expect(s.agentes).toEqual({ puntos: 8, lanzados: 1, tope: 40, corriendo: 2 })
  })

  test('cupo sin lectura (antes del primer session.measure)', () => {
    expect(armarCupo([])).toEqual({ cincoHoras: null, semana: null })
    expect(armarCupo(undefined)).toEqual({ cincoHoras: null, semana: null })
  })
})
