import { describe, expect, test } from 'vitest'
import { PESOS, VENCE_MS, VENTANA_MS, decidir, leerFrontmatter, leerLimite } from '../../mods/presupuesto-agentes/hooks/presupuesto.mjs'

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

  test('al 90 % de la ventana de 5 h se niega todo lanzamiento nuevo, con el % en el motivo', () => {
    const d = decidir(evento({ rateLimits: [{ kind: 'five_hour', percentUsed: 90 }] }), estado(), AHORA)
    expect(d.accion).toBe('negar')
    expect(d.motivo).toContain('90 %')
    expect(d.motivo).toContain('5 horas')
  })

  test('al 61 % de la semanal tambien', () => {
    const d = decidir(evento({ rateLimits: [{ kind: 'seven_day', percentUsed: 61 }] }), estado(), AHORA)
    expect(d.accion).toBe('negar')
    expect(d.motivo).toContain('semanal')
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

  test('.agent-limit = 0 apaga el conteo pero no el cupo real', () => {
    const escapes = { limite: { valor: 0, mtimeMs: AHORA } }
    expect(decidir(evento({ model: 'fable' }), estado(40, escapes), AHORA).accion).toBe('permitir')
    expect(decidir(evento({ model: 'fable', rateLimits: [{ kind: 'five_hour', percentUsed: 86 }] }), estado(0, escapes), AHORA).accion).toBe('negar')
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

describe('lectura de archivos', () => {
  test('frontmatter y .agent-limit', () => {
    expect(leerFrontmatter('---\nname: buscador\nmodel: "haiku"\neffort: medium\n---\n# cuerpo\nmodel: opus')).toEqual({ name: 'buscador', model: 'haiku', effort: 'medium' })
    expect(leerFrontmatter('sin frontmatter')).toEqual({ name: '', model: '', effort: '' })
    expect(leerLimite('15\n')).toBe(15)
    expect(leerLimite('')).toBeNull()
  })
})
