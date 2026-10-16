import { describe, expect, test } from 'vitest'
import { PESOS, VENCE_MS, VENTANA_MS, cupoReal, decidir, leerFrontmatter, leerLimite, lineaDeRegistro } from '../../mods/presupuesto-agentes/hooks/presupuesto.mjs'

const AHORA = 1_760_000_000_000
const SONNET = { name: 'investigador', model: 'sonnet', effort: 'xhigh' }
const AUDITOR = { name: 'auditor', model: 'opus', effort: 'xhigh' }
const CUPO_LIBRE = [{ kind: 'five_hour', percentUsed: 12 }, { kind: 'seven_day', percentUsed: 30 }]

const evento = (extra = {}) => ({ subagentType: 'investigador', model: 'sonnet', fork: false, definicion: SONNET, rateLimits: CUPO_LIBRE, sessionId: 's1', ...extra })
// puntosUsados > 0 = un lanzamiento de hace un minuto con ese peso, dentro de la ventana
const estado = (puntosUsados = 0, escapes = {}) => ({
  lanzamientos: puntosUsados ? [{ ts: AHORA - 60_000, tipo: 'investigador', modelo: 'sonnet', peso: puntosUsados }] : [],
  escapes,
})

describe('verde: deja pasar', () => {
  test('un Sonnet con presupuesto libre pasa y descuenta 4', () => {
    const d = decidir(evento(), estado(), AHORA)
    expect(d.accion).toBe('permitir')
    expect(d.peso).toBe(PESOS.sonnet)
    expect(d.estadoNuevo.lanzamientos).toEqual([{ ts: AHORA, tipo: 'investigador', modelo: 'sonnet', peso: 4 }])
  })

  test('la auditoria final pasa siempre y no descuenta, aun con la ventana llena y el cupo al 95 %', () => {
    const e = evento({ subagentType: 'auditor', model: undefined, definicion: AUDITOR, rateLimits: [{ kind: 'five_hour', percentUsed: 95 }] })
    const d = decidir(e, estado(40), AHORA)
    expect(d.accion).toBe('permitir')
    expect(d.peso).toBe(0)
    expect(d.estadoNuevo.lanzamientos).toHaveLength(1) // no se agrego nada
  })

  test('justo en el borde no frena: 60 % semanal y 85 % de las 5 h todavia pasan', () => {
    const d = decidir(evento({ model: 'fable', rateLimits: [{ kind: 'seven_day', percentUsed: 60 }, { kind: 'five_hour', percentUsed: 85 }] }), estado(), AHORA)
    expect(d.accion).toBe('permitir')
    expect(d.motivo).toContain('20/40')
  })

  test('el auditor pasa aunque su definicion no se haya encontrado o no se haya podido leer', () => {
    const lleno = [{ kind: 'five_hour', percentUsed: 99 }, { kind: 'seven_day', percentUsed: 99 }]
    for (const extra of [{ definicion: null }, { definicion: null, definicionError: true }]) {
      const d = decidir(evento({ subagentType: 'auditor', model: undefined, rateLimits: lleno, ...extra }), estado(40), AHORA)
      expect(d.accion).toBe('permitir')
      expect(d.peso).toBe(0)
    }
    expect(decidir(evento({ subagentType: 'auditor-cliente', model: 'opus', definicion: null }), estado(), AHORA).accion).toBe('permitir')
  })

  test('si las definiciones no se pudieron leer no se niega por «sin definicion»: siguen el cupo y la ventana', () => {
    const sinLeer = { definicion: null, definicionError: true }
    const pasa = decidir(evento(sinLeer), estado(), AHORA)
    expect(pasa.accion).toBe('permitir')
    expect(pasa.motivo).toContain('4/40')
    expect(decidir(evento(sinLeer), estado(40), AHORA).motivo).toContain('40/40')
    expect(decidir(evento({ ...sinLeer, rateLimits: [{ kind: 'seven_day', percentUsed: 61 }] }), estado(), AHORA).aviso).toContain('semanal')
  })

  test('un libro con una entrada rota se repara solo: lo que no es un lanzamiento se tira', () => {
    const roto = { lanzamientos: [null, { ts: AHORA - 60_000, tipo: 'x', modelo: 'sonnet', peso: 4 }, 'basura', { tipo: 'sin fecha' }], escapes: {} }
    const d = decidir(evento(), roto, AHORA)
    expect(d.accion).toBe('permitir')
    expect(d.estadoNuevo.lanzamientos.map((l) => l.peso)).toEqual([4, 4])
    expect(decidir(evento(), { lanzamientos: 'no es una lista', escapes: {} }, AHORA).accion).toBe('permitir')
  })

  test('lo que quedo fuera de la ventana de 10 min no cuenta', () => {
    const viejo = { lanzamientos: [{ ts: AHORA - VENTANA_MS - 1, tipo: 'x', modelo: 'fable', peso: 20 }], escapes: {} }
    const d = decidir(evento({ model: 'fable' }), viejo, AHORA)
    expect(d.accion).toBe('permitir')
    expect(d.estadoNuevo.lanzamientos.map((l) => l.peso)).toEqual([20])
  })
})

describe('rojo: niega con motivo legible', () => {
  test('un Fable con 30 puntos usados no entra (30 + 20 > 40)', () => {
    const d = decidir(evento({ model: 'fable' }), estado(30), AHORA)
    expect(d.accion).toBe('negar')
    expect(d.motivo).toContain('30/40 puntos')
    expect(d.motivo).toContain('pesa 20')
    expect(d.estadoNuevo.lanzamientos).toHaveLength(1)
  })

  test('al 90 % de la ventana de 5 h se niega todo lanzamiento nuevo, con el % en el motivo (sigue frenando: 13 agentes cortados por el limite de sesion)', () => {
    const d = decidir(evento({ rateLimits: [{ kind: 'five_hour', percentUsed: 90 }] }), estado(), AHORA)
    expect(d.accion).toBe('negar')
    expect(d.motivo).toContain('90 %')
    expect(d.motivo).toContain('5 horas')
  })

  test('CAMBIO 16/10/2026 (Fak 15/10: sin evidencia no hay freno por cupo SEMANAL): al 61 % sale con aviso (desde el 60 %); al 86 % con el del 85 %; por debajo del 60 % sin aviso', () => {
    const semana = [{ kind: 'five_hour', percentUsed: 10 }, { kind: 'seven_day', percentUsed: 61 }]
    const d = decidir(evento({ rateLimits: semana }), estado(), AHORA)
    expect(d.accion).toBe('permitir')
    expect(d.aviso).toContain('semanal')
    expect(d.aviso).toContain('61 %')
    expect(d.aviso).toContain('aviso desde el 60 %')
    expect(d.aviso).toContain('investigador')
    expect(d.aviso).toContain('peso 4')
    expect(d.estadoNuevo.lanzamientos).toHaveLength(1)   // descuenta igual: la ventana de 10 min sigue
    expect(decidir(evento({ model: 'haiku', rateLimits: semana }), estado(), AHORA).accion).toBe('permitir')
    const alto = decidir(evento({ rateLimits: [{ kind: 'seven_day', percentUsed: 86 }] }), estado(), AHORA)
    expect(alto.accion).toBe('permitir')
    expect(alto.aviso).toContain('aviso desde el 85 %')
    expect(decidir(evento({ rateLimits: [{ kind: 'seven_day', percentUsed: 59 }] }), estado(), AHORA).aviso).toBeNull()
    // con el pase opus-ok el aviso dice el peso que se descuenta de verdad (auditor 16/10, H7)
    const conOpus = decidir(evento({ model: 'opus', rateLimits: semana }), estado(0, { opusOk: { mtimeMs: AHORA } }), AHORA)
    expect(conOpus.peso).toBe(4)
    expect(conOpus.aviso).toContain('peso 4')
  })

  test('effort max se niega aunque todo lo demas este bien', () => {
    const d = decidir(evento({ effort: 'max' }), estado(), AHORA)
    expect(d.accion).toBe('negar')
    expect(d.motivo).toContain('xhigh')
  })

  test('fork (por campo o por nombre), built-in sin definicion y modelo inventado se niegan', () => {
    expect(decidir(evento({ fork: true }), estado(), AHORA).accion).toBe('negar')
    expect(decidir(evento({ subagentType: 'fork', fork: false }), estado(), AHORA).motivo).toContain('fork')
    expect(decidir(evento({ subagentType: 'general-purpose', definicion: null }), estado(), AHORA).motivo).toContain('definicion propia')
    expect(decidir(evento({ model: 'gpt-5' }), estado(), AHORA).motivo).toContain('validos')
  })
})

describe('escapes por archivo (valen 12 h)', () => {
  test('echo 15 > .agent-limit levanta el tope a 60: el Fable con 30 usados entra', () => {
    const d = decidir(evento({ model: 'fable' }), estado(30, { limite: { valor: 15, mtimeMs: AHORA - 3_600_000 } }), AHORA)
    expect(d.accion).toBe('permitir')
    expect(d.motivo).toContain('50/60')
  })

  test('el mismo archivo con mas de 12 h se ignora', () => {
    const d = decidir(evento({ model: 'fable' }), estado(30, { limite: { valor: 15, mtimeMs: AHORA - VENCE_MS - 1 } }), AHORA)
    expect(d.accion).toBe('negar')
  })

  test('.agent-limit = 0 apaga el conteo pero no el freno de la ventana de 5 h; la semanal solo avisa', () => {
    const escapes = { limite: { valor: 0, mtimeMs: AHORA } }
    expect(decidir(evento({ model: 'fable' }), estado(40, escapes), AHORA).accion).toBe('permitir')
    expect(decidir(evento({ model: 'fable', rateLimits: [{ kind: 'five_hour', percentUsed: 86 }] }), estado(0, escapes), AHORA).accion).toBe('negar')
    const d = decidir(evento({ model: 'fable', rateLimits: [{ kind: 'seven_day', percentUsed: 86 }] }), estado(0, escapes), AHORA)
    expect(d.accion).toBe('permitir')
    expect(d.aviso).toContain('86 %')
  })

  test('.agent-cupo-ok saltea el freno de 5 h y apaga el aviso semanal durante 12 h; vencido se ignora', () => {
    const rojo = [{ kind: 'five_hour', percentUsed: 95 }, { kind: 'seven_day', percentUsed: 90 }]
    const conPase = decidir(evento({ model: 'fable', rateLimits: rojo }), estado(0, { cupoOk: { mtimeMs: AHORA - 3_600_000 } }), AHORA)
    expect(conPase.accion).toBe('permitir')
    expect(conPase.motivo).toContain('20/40')
    expect(conPase.aviso).toBeNull()
    const vencido = decidir(evento({ rateLimits: rojo }), estado(0, { cupoOk: { mtimeMs: AHORA - VENCE_MS - 1 } }), AHORA)
    expect(vencido.accion).toBe('negar')
    expect(vencido.motivo).toContain('5 horas')
  })

  test('.agent-cupo-ok no levanta la ventana de 10 min: con 40 puntos usados un Sonnet no entra', () => {
    const d = decidir(evento(), estado(40, { cupoOk: { mtimeMs: AHORA } }), AHORA)
    expect(d.accion).toBe('negar')
    expect(d.motivo).toContain('40/40')
  })

  test('.agent-opus-ok hace que Opus descuente como Sonnet', () => {
    expect(decidir(evento({ model: 'opus' }), estado(0, { opusOk: { mtimeMs: AHORA } }), AHORA).peso).toBe(PESOS.sonnet)
  })

  test('el pase de sesion deja pasar un built-in solo con model sonnet explicito y el session_id correcto', () => {
    const builtin = evento({ subagentType: 'Explore', definicion: null })
    expect(decidir(builtin, estado(0, { builtinOk: { sessionId: 's1' } }), AHORA).accion).toBe('permitir')
    expect(decidir({ ...builtin, model: 'haiku' }, estado(0, { builtinOk: { sessionId: 's1' } }), AHORA).accion).toBe('negar')
    expect(decidir(builtin, estado(0, { builtinOk: { sessionId: 'otra' } }), AHORA).accion).toBe('negar')
  })
})

describe('lectura del cupo real', () => {
  test('toma el % mas alto de cada ventana, ignora otras ventanas y da null sin lectura', () => {
    expect(cupoReal([{ kind: 'seven_day', percentUsed: 55 }, { kind: 'seven_day', percentUsed: 77 }, { kind: 'five_hour', percentUsed: 4 }, { kind: 'spend_limit', percentUsed: 120 }]))
      .toEqual({ cincoHoras: 4, semana: 77 })
    expect(cupoReal([])).toEqual({ cincoHoras: null, semana: null })
    expect(cupoReal(undefined)).toEqual({ cincoHoras: null, semana: null })
    expect(cupoReal([{ kind: 'five_hour' }, null])).toEqual({ cincoHoras: null, semana: null })
  })

  test('sin lectura de cupo no se frena por cupo: decide solo la ventana de 10 min', () => {
    expect(decidir(evento({ rateLimits: [] }), estado(), AHORA).accion).toBe('permitir')
  })
})

describe('el renglon del registro', () => {
  test('fecha ISO, la decision en mayusculas, el peso, el cupo, de donde salio la definicion y el motivo', () => {
    expect(lineaDeRegistro({ ahora: Date.UTC(2026, 9, 11, 13, 5, 0), accion: 'permitir', tipo: 'buscador', model: undefined, peso: 1, cupo: 'five_hour=5%', def: 'C:/x/.claude/agents', motivo: '1/40 puntos en la ventana' }))
      .toBe('2026-10-11T13:05:00.000Z agent.spawn PERMITIR buscador model=(definicion) peso=1 cupo[five_hour=5%] def=C:/x/.claude/agents :: 1/40 puntos en la ventana')
    expect(lineaDeRegistro({ ahora: 0, accion: 'negar', tipo: 'x', model: 'fable', peso: 20, cupo: 'sin lectura', motivo: 'm' })).toContain(' NEGAR x model=fable peso=20 cupo[sin lectura] def=sin :: m')
  })
})

describe('lectura de archivos', () => {
  test('frontmatter y .agent-limit', () => {
    expect(leerFrontmatter('---\nname: buscador\nmodel: "haiku"\neffort: medium\n---\n# cuerpo\nmodel: opus')).toEqual({ name: 'buscador', model: 'haiku', effort: 'medium' })
    expect(leerFrontmatter('sin frontmatter')).toEqual({ name: '', model: '', effort: '' })
    expect(leerLimite('15\n')).toBe(15)
    expect(leerLimite('')).toBeNull()
  })
})
