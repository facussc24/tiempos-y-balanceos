// vitest, sin la app: solo los módulos puros. Desde la raíz del repo:
//   npx vitest run mods/tablero/tests/tablero.test.mjs --pool=threads
import { describe, expect, test } from 'vitest'
import { armarCupo, juntarAgentes, leerEstado, leerSaldo, leerNoche, leerHora, leerAgentes, leerAgentesMod, msModificado, tramo } from '../hooks/estado.mjs'
import { dibujar, textoPlano, faltan, usd, usdRedondo, barra, cuando, largoFila } from '../hooks/dibujo.mjs'

// 11/10/2026 20:50 en hora LOCAL: los archivos de la casa están en hora local y el test
// construye «ahora» igual, así da lo mismo en qué zona corra
const AHORA = new Date(2026, 9, 11, 20, 50).getTime()
const reloj = { ahora: async () => AHORA }
const seg = (ms) => Math.floor(ms / 1000)
const DONDE = { casa: '/casa', repo: '/repo', sesion: 'ses-1', nombreCasa: 'Barack Mercosul', proyecto: 'BarackMercosul', corriendo: 2 }

// El resumen que deja la puerta de la API (scripts/_lib/claudeApi.mjs, saldoPorClave), con la forma del real
const SALDO = {
  actualizado: '2026-10-11 11:47:32',
  ciclo: { desde: '2026-09-30', hasta: '2026-10-29', proximo: '2026-10-30', texto: 'ciclo del 30/09 al 29/10' },
  estimado: true,
  claves: [
    { nombre: 'principal', gastadoUsd: 155.89, creditoUsd: 200, quedanUsd: 44.11 },
    { nombre: 'prestada', hasta: '20261020', gastadoUsd: 107.04, agotada: true, vencida: false },
  ],
}
// La noche del 11/10/2026, tal como quedó: no arrancó por el tope de gasto
const NOCHE_NO = {
  fecha: '2026-10-11', inicio: '2026-10-11 06:30:13', pasos: [], costoUsd: 0, prioridades: [],
  noArranco: 'presupuesto del ciclo en rojo (ciclo del 30/09 al 29/10): $262.93 de $170. No arranco (--sin-tope para forzar).', corte: null,
}
const NOCHE_BIEN = {
  fecha: '2026-10-11', inicio: '2026-10-11 06:30:13', costoUsd: 0.98, prioridades: [{}, {}, {}], noArranco: '', corte: null,
  pasos: [{ nombre: 'datos', estado: 'ok' }, { nombre: 'preauditoria', estado: 'ok' }, { nombre: 'mails', estado: 'ok' }, { nombre: 'vigilante', estado: 'saltado' }],
}

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
  '/repo/.sgc-cache/api/saldo.json': JSON.stringify(SALDO),
  '/repo/.claude/state/nocturno.json': JSON.stringify(NOCHE_NO),
}

const fsFalso = (archivos = {}, carpetas = {}) => ({
  leer: async (ruta) => archivos[ruta] ?? null,
  stat: async (ruta) => (ruta in archivos ? { mtimeMs: AHORA - 22 * 3600_000 } : null), // 10/10 22:50
  listar: async (ruta) => carpetas[ruta] ?? null,
})
const EN_5_DIAS = new Date(2026, 9, 16, 13, 0).getTime() // viernes 16/10 13:00
const LIMITES = [
  { kind: 'five_hour', percentUsed: 62, resetsAt: new Date(AHORA + 130 * 60_000).toISOString() },
  { kind: 'seven_day', percentUsed: 31 },
]
const LIMITES_CON_DIA = [LIMITES[0], { kind: 'seven_day', percentUsed: 60, resetsAt: new Date(EN_5_DIAS - 338).toISOString() }] // 12:59:59,662, como lo da la app

describe('verde: con los archivos de ejemplo da los números esperados', () => {
  test('leerEstado junta todo', async () => {
    const s = await leerEstado(fsFalso(ARCHIVOS), reloj, { ...DONDE, limites: LIMITES })
    expect(s.cupo.cincoHoras).toMatchObject({ pct: 62, tramo: 'ambar', renueva: '23:00', renuevaMs: AHORA + 130 * 60_000 })
    expect(s.cupo.semana).toMatchObject({ pct: 31, tramo: 'verde', renueva: null, renuevaMs: null })
    expect(s.agentes).toEqual({ puntos: 8, lanzados: 3, tope: 40, corriendo: 2 })
    expect(s.hora).toMatchObject({ hasta: '23:00', faltanMin: 130, propia: true })
    expect(s.api).toEqual({
      estimado: true, renueva: '30/10', viejo: false,
      plan: { gastado: 155.89, quedan: 44.11, credito: 200 },
      prestadas: [{ hasta: '20/10', gastado: 107.04, agotada: true }],
    })
    expect(s.noche).toEqual({
      cuandoMs: new Date(2026, 9, 11, 6, 30).getTime(), corrio: false, motivo: 'la API pasó su tope de gasto',
      cortada: false, pasos: 0, conError: 0, costoUsd: 0,
    })
  })

  test('dibujar pone los textos esperados, cada uno en su fila', async () => {
    const s = await leerEstado(fsFalso(ARCHIVOS), reloj, { ...DONDE, limites: LIMITES })
    const t = textoPlano(dibujar(s, undefined, { ancho: 120 }))
    expect(t).toContain('Barack Mercosul · BarackMercosul')
    expect(t).toContain('5 h 62 % ██████░░░░ renueva 23:00')
    expect(t).toContain('semana 31 % ███░░░░░░░')
    expect(t).toContain('corren 2 · últimos 10 min 8/40 pts')
    expect(t).toContain('laburando hasta 23:00 · faltan 2 h 10')
    expect(t).toContain('«te dejo modo full auto 48 hs seguidas»')
    // la plata de la API: por clave, gastado y lo que queda; «≈» porque parte de la cuenta es estimada
    expect(t).toContain('plan: gastado ≈ US$ 156 · quedan ≈ US$ 44 hasta el 30/10 · prestada: agotada')
    expect(t).toContain('tarea automática de hoy 06:30 no corrió · la API pasó su tope de gasto')
    // lo que el dueño no entendió el 11/10/2026 no vuelve a la banda
    for (const viejo of ['llamadas', 'en curso', 'prioridades', 'octubre', 'para mirar']) expect(t).not.toContain(viejo)
    // en una banda angosta el pedido se recorta, la banda no
    expect(textoPlano(dibujar(s, undefined, { ancho: 60 }))).toContain('«te dejo m…')
  })

  test('la ventana de la semana lleva el día; con la banda angosta, sin la fecha; la de 5 h solo la hora', async () => {
    const s = await leerEstado(fsFalso(ARCHIVOS), reloj, { ...DONDE, limites: LIMITES_CON_DIA })
    const ancha = textoPlano(dibujar(s, undefined, { ancho: 120 }))
    expect(ancha).toContain('semana 60 % ██████░░░░ renueva vie 16/10 13:00')
    expect(ancha).toContain('5 h 62 % ██████░░░░ renueva 23:00 ·')
    const angosta = textoPlano(dibujar(s, undefined, { ancho: 95 }))   // el ancho que pidio la app el 11/10/2026
    expect(angosta).toContain('semana 60 % ██████░░░░ renueva vie 13:00')
    expect(angosta).not.toContain('16/10')
  })

  // Una fila mas ancha que la banda se parte o se corta. El auditor midio el 11/10/2026 que con otros datos pasaba:
  // «renueva mañana» 96, las 5 h al 100 % 94, una prestada con saldo 110, dos prestadas 134, una noche con error 113,
  // cortada de ayer 107, un pedido largo en la fila del corte. La app pidio la banda en 93 y 95 columnas.
  test('ninguna fila pasa del ancho de la banda, con ningun dato (cada fila se acorta hasta entrar)', async () => {
    const dia = (d, h, m = 0) => new Date(2026, 9, d, h, m).getTime()
    const limites = (p5, p7, renueva7) => [
      { kind: 'five_hour', percentUsed: p5, resetsAt: new Date(AHORA + 130 * 60_000).toISOString() },
      { kind: 'seven_day', percentUsed: p7, resetsAt: new Date(renueva7).toISOString() },
    ]
    const saldo = (prestadas, estimado = true) => JSON.stringify({ ciclo: { proximo: '2026-10-30' }, estimado, claves: [{ nombre: 'principal', gastadoUsd: 162.93, creditoUsd: 200, quedanUsd: 37.07 }, ...prestadas] })
    const prestada = (hasta, gastadoUsd, agotada) => ({ nombre: 'prestada', hasta, gastadoUsd, agotada })
    const CASOS = [
      { nombre: 'el dia real', limites: LIMITES_CON_DIA, saldo: JSON.stringify(SALDO), noche: NOCHE_NO },
      { nombre: 'renueva mañana y las dos ventanas al 100 %', limites: limites(100, 100, dia(12, 13)), saldo: JSON.stringify(SALDO), noche: NOCHE_BIEN },
      { nombre: 'una prestada con saldo', limites: LIMITES_CON_DIA, saldo: saldo([prestada('20261020', 30, false)], false), noche: NOCHE_BIEN },
      { nombre: 'una agotada y otra con saldo', limites: LIMITES_CON_DIA, saldo: saldo([prestada('20261020', 100, true), prestada('20261025', 1234.5, false)]), noche: NOCHE_BIEN },
      { nombre: 'tres prestadas', limites: LIMITES_CON_DIA, saldo: saldo([prestada('20261020', 100, true), prestada('20261025', 50, false), prestada('20261028', 9, false)]), noche: NOCHE_BIEN },
      { nombre: 'la noche con pasos en error', limites: LIMITES_CON_DIA, saldo: JSON.stringify(SALDO), noche: { ...NOCHE_BIEN, pasos: [{ estado: 'ok' }, { estado: 'error' }, { estado: 'ok' }, { estado: 'ok' }, { estado: 'ok' }] } },
      { nombre: 'la noche cortada, de ayer', limites: LIMITES_CON_DIA, saldo: JSON.stringify(SALDO), noche: { ...NOCHE_BIEN, inicio: '2026-10-10 06:30:00', corte: { motivo: 'tope' } } },
      { nombre: 'no arranco por un motivo largo', limites: LIMITES_CON_DIA, saldo: JSON.stringify(SALDO), noche: { ...NOCHE_NO, noArranco: 'x'.repeat(200) } },
      { nombre: 'el ciclo recien renovado', limites: LIMITES_CON_DIA, saldo: JSON.stringify({ ...SALDO, ciclo: { proximo: '2026-10-11' } }), noche: NOCHE_BIEN },
    ]
    const hora = JSON.stringify({ 'ses-1': { hasta: '2026-10-12 06:00', pedido: 'te dejo modo full auto 48 hs seguidas, lo que tarde en completar todo, no pares hasta terminar la cola entera', fijado_ms: 2 }, otra: { hasta: '2026-10-12 08:00', pedido: 'x', fijado_ms: 1 } })
    for (const c of CASOS) {
      const archivos = { ...ARCHIVOS, '/repo/.sgc-cache/api/saldo.json': c.saldo, '/repo/.claude/state/nocturno.json': JSON.stringify(c.noche), '/casa/.trabajar-hasta.json': hora }
      for (const sesion of ['ses-1', 'ninguna']) {   // la hora propia y la de otra sesion («(otra sesión)» es mas larga)
        const s = await leerEstado(fsFalso(archivos), reloj, { ...DONDE, sesion, limites: c.limites })
        for (const ancho of [80, 93, 95, 100, 120]) {
          for (const fila of dibujar(s, undefined, { ancho }).children.filter((f) => f.type === 'Box')) {
            const celdas = fila.children.slice(1)   // sin la etiqueta, que largoFila ya cuenta
            expect(largoFila(celdas), `${c.nombre}, ancho ${ancho}: ${textoPlano(fila)}`).toBeLessThanOrEqual(ancho)
          }
        }
      }
    }
  })

  test('lo que se va primero cuando no entra: la fecha, despues la hora de las 5 h; el dia de la semana es lo ultimo', async () => {
    const s = await leerEstado(fsFalso(ARCHIVOS), reloj, { ...DONDE, limites: LIMITES_CON_DIA })
    expect(textoPlano(dibujar(s, undefined, { ancho: 80 }))).toContain('5 h 62 % ██████░░░░ · semana 60 % ██████░░░░ renueva vie 13:00')
    // la plata: con poco lugar se va «hasta el 30/10» antes que la prestada; la noche pasa a «tarea de»
    const angosta = textoPlano(dibujar(s, undefined, { ancho: 80 }))
    expect(angosta).toContain('plan: gastado ≈ US$ 156 · quedan ≈ US$ 44 · prestada: agotada')
    expect(angosta).toContain('tarea de hoy 06:30 no corrió · la API pasó su tope de gasto')
  })

  test('tramos y formatos', () => {
    expect([59.9, 60, 85, 85.1, null].map(tramo)).toEqual(['verde', 'ambar', 'ambar', 'rojo', 'sin'])
    expect(faltan(130)).toBe('2 h 10')
    expect(faltan(5)).toBe('5 min')
    expect(usd(38.7)).toBe('US$ 38,70')
    expect(usdRedondo(155.89)).toBe('US$ 156')
    expect(usdRedondo(44.11)).toBe('US$ 44')
    expect(barra(100)).toBe('██████████')
    expect(barra(0)).toBe('░░░░░░░░░░')
  })

  test('cuando: hoy, mañana, ayer y, si no, el día de la semana con su fecha (o sin ella, en corto)', () => {
    const en = (...a) => new Date(...a).getTime()
    expect(cuando(en(2026, 9, 11, 23, 0), AHORA)).toBe('hoy 23:00')
    expect(cuando(en(2026, 9, 12, 1, 0), AHORA)).toBe('mañana 01:00')
    expect(cuando(en(2026, 9, 10, 6, 30), AHORA)).toBe('ayer 06:30')
    expect(cuando(EN_5_DIAS, AHORA)).toBe('vie 16/10 13:00')
    expect(cuando(EN_5_DIAS, AHORA, { corto: true })).toBe('vie 13:00')
    expect(cuando(en(2026, 9, 7, 6, 30), AHORA)).toBe('mié 07/10 06:30')
    // la app da 12:59:59,662: se lee 13:00
    expect(cuando(EN_5_DIAS - 338, AHORA)).toBe('vie 16/10 13:00')
    expect(cuando(null, AHORA)).toBeNull()
    expect(cuando(EN_5_DIAS, null)).toBeNull()
  })

  test('msModificado acepta mtimeMs (número) o mtime (Date o ISO); null si no hay', () => {
    expect(msModificado({ mtimeMs: AHORA })).toBe(AHORA)
    expect(msModificado({ mtime: new Date(AHORA) })).toBe(AHORA)
    expect(msModificado({ mtime: new Date(AHORA).toISOString() })).toBe(AHORA)
    expect(msModificado(null)).toBeNull()
    expect(msModificado({})).toBeNull()
  })
})

describe('la plata de la API: lo que se lee de saldo.json', () => {
  const dibujo = (api) => textoPlano(dibujar({ ahora: AHORA, api }, undefined, { ancho: 120 }))
  test('con todo anotado por clave no lleva «≈»; una prestada con saldo dice lo gastado y cuándo vence', () => {
    const api = leerSaldo(JSON.stringify({
      ciclo: { proximo: '2026-10-30' }, estimado: false,
      claves: [{ nombre: 'principal', gastadoUsd: 60.5, creditoUsd: 200, quedanUsd: 139.5 }, { nombre: 'prestada', hasta: '20261020', gastadoUsd: 30, agotada: false }],
    }), '2026-10-11')
    expect(dibujo(api)).toContain('plan: gastado US$ 61 · quedan US$ 140 hasta el 30/10 · prestada: gastado US$ 30 vence el 20/10')
    // un `hasta` que llega como numero no tumba la banda
    const conNumero = leerSaldo(JSON.stringify({ ciclo: { proximo: '2026-10-30' }, claves: [{ nombre: 'principal', gastadoUsd: 1, creditoUsd: 200, quedanUsd: 199 }, { nombre: 'prestada', hasta: 20261020, gastadoUsd: 30, agotada: false }] }), '2026-10-11')
    expect(conNumero.prestadas).toEqual([{ hasta: '20/10', gastado: 30, agotada: false }])
    expect(dibujo(api)).not.toContain('≈')
  })
  test('una prestada vencida no se muestra (se decide contra hoy, no contra el día en que se escribió el archivo)', () => {
    const texto = JSON.stringify({ ...SALDO, claves: [SALDO.claves[0], { nombre: 'prestada', hasta: '20261020', gastadoUsd: 107.04, agotada: true, vencida: false }] })
    expect(leerSaldo(texto, '2026-10-20').prestadas).toHaveLength(1)   // el último día todavía cuenta
    expect(leerSaldo(texto, '2026-10-21').prestadas).toEqual([])
    expect(dibujo(leerSaldo(texto, '2026-10-21'))).not.toContain('prestada')
  })
  test('cuando el ciclo ya renovó y nadie gastó todavía, no muestra los números del ciclo viejo', () => {
    const api = leerSaldo(JSON.stringify(SALDO), '2026-10-30')
    expect(api.viejo).toBe(true)
    const t = dibujo(api)
    expect(t).toContain('plan: renovó el 30/10 · todavía sin gasto anotado')
    expect(t).not.toContain('US$ 156')
  })
  test('un saldo.json roto, sin claves o sin la del plan: «sin datos», no un número inventado', () => {
    expect(leerSaldo('{ rot', '2026-10-11')).toBeNull()
    expect(leerSaldo(JSON.stringify({ ciclo: {} }), '2026-10-11')).toBeNull()
    expect(leerSaldo(null, '2026-10-11')).toBeNull()
    const sinPlan = leerSaldo(JSON.stringify({ claves: [{ nombre: 'prestada', hasta: '20261020', gastadoUsd: 5, agotada: false }] }), '2026-10-11')
    expect(sinPlan.plan).toBeNull()
    expect(dibujo(sinPlan)).toContain('sin datos')
    const sinNumero = leerSaldo(JSON.stringify({ claves: [{ nombre: 'principal', gastadoUsd: 'mucho' }] }), '2026-10-11')
    expect(sinNumero.plan).toBeNull()
  })
})

describe('la tarea automática de la madrugada: lo que se lee de nocturno.json', () => {
  const dibujo = (noche) => textoPlano(dibujar({ ahora: AHORA, noche }, undefined, { ancho: 120 }))
  test('corrió bien: lo dice, con lo que gastó; los pasos salteados no cuentan', () => {
    const n = leerNoche(JSON.stringify(NOCHE_BIEN), null)
    expect(n).toEqual({ cuandoMs: new Date(2026, 9, 11, 6, 30).getTime(), corrio: true, motivo: null, cortada: false, pasos: 3, conError: 0, costoUsd: 0.98 })
    expect(dibujo(n)).toContain('tarea automática de hoy 06:30 corrió bien · US$ 0,98')
  })
  // Lo que la noche deja para revisar son sugerencias sin verificar para la sesión de la mañana (api-claude.md §6):
  // no va a la banda, ni como «dejó N cosas» ni como «no dejó nada» (que además era falso si el paso no corrió).
  test('lo que la noche deja para revisar no va a la banda, corra como corra', () => {
    const casos = [
      NOCHE_BIEN,
      { ...NOCHE_BIEN, prioridades: [] },
      { ...NOCHE_BIEN, pasos: [{ nombre: 'datos', estado: 'ok' }, { nombre: 'prioridades', estado: 'error' }], prioridades: [] },
      { ...NOCHE_BIEN, corte: { motivo: 'tope por corrida' }, prioridades: [] },
    ]
    for (const c of casos) {
      const n = leerNoche(JSON.stringify(c), null)
      expect('paraMirar' in n).toBe(false)
      expect(dibujo(n)).not.toMatch(/para mirar|dejó|prioridad/)
    }
  })
  test('corrió con pasos en error, o se cortó sola: lo dice en vez de «bien»', () => {
    const conError = leerNoche(JSON.stringify({ ...NOCHE_BIEN, pasos: [{ estado: 'ok' }, { estado: 'error' }, { estado: 'error' }], prioridades: [] }), null)
    expect(dibujo(conError)).toContain('corrió con 2 de 3 pasos con error')
    const cortada = leerNoche(JSON.stringify({ ...NOCHE_BIEN, corte: { motivo: 'tope por corrida' }, prioridades: [{}] }), null)
    expect(dibujo(cortada)).toContain('se cortó antes de terminar')
  })
  test('no arrancó: el motivo en corto; uno que no se reconoce va tal cual, recortado', () => {
    expect(leerNoche(JSON.stringify({ ...NOCHE_NO, noArranco: 'falta la clave ANTHROPIC_API_KEY' }), null).motivo).toBe('falta la clave de la API')
    const raro = leerNoche(JSON.stringify({ ...NOCHE_NO, noArranco: 'x'.repeat(200) }), null)
    expect(raro.motivo).toHaveLength(60)
    expect(raro.motivo.endsWith('…')).toBe(true)
    expect(dibujo(leerNoche(JSON.stringify({ ...NOCHE_NO, noArranco: 'sin red' }), null))).toContain('no corrió · sin red')
  })
  test('sin `inicio` usa la fecha del archivo; de ayer dice «ayer»; roto o vacío da null', () => {
    const sinInicio = leerNoche(JSON.stringify({ ...NOCHE_BIEN, inicio: undefined }), { mtimeMs: AHORA - 22 * 3600_000 })
    expect(dibujo(sinInicio)).toContain('tarea automática de ayer 22:50')
    expect(dibujo(leerNoche(JSON.stringify({ ...NOCHE_BIEN, inicio: '2026-10-10 06:30:00' }), null))).toContain('de ayer 06:30')
    expect(dibujo(leerNoche(JSON.stringify({ ...NOCHE_BIEN, inicio: undefined }), null))).toContain('sin fecha')
    expect(leerNoche('{ rot', null)).toBeNull()
    expect(leerNoche('null', null)).toBeNull()
    expect(leerNoche(null, null)).toBeNull()
  })
})

describe('rojo: sin archivos no rompe, una línea rota se saltea', () => {
  test('sin ningún archivo: «sin datos» en cada fila y nada tira', async () => {
    const s = await leerEstado(fsFalso(), reloj, { sesion: 'ses-1' })
    expect(s.hora).toBeNull()
    expect(s.noche).toBeNull()
    expect(s.api).toBeNull()
    expect(s.agentes).toMatchObject({ puntos: null, lanzados: null, corriendo: null })
    expect(s.cupo).toEqual({ cincoHoras: null, semana: null })
    const t = textoPlano(dibujar(s))
    expect(t.match(/sin datos/g)).toHaveLength(4)
    expect(t).toContain('sin hora fijada')
  })

  test('sin estado (todavía no se leyó nada) también dibuja', () => {
    expect(textoPlano(dibujar(null))).toContain('sin datos')
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
