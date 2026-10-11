// El registro del mod presupuesto-agentes lo ESCRIBE un mod y lo LEE otro (el tablero). Son dos plugins: no pueden
// importarse entre si. Este test los cruza desde el repo: lo que arma `lineaDeRegistro` y `decidir` tiene que ser lo
// que `leerAgentesMod` entiende. Si alguien cambia el formato de un lado (la fecha, «peso=», «N/M puntos»), da rojo aca.
import { describe, expect, test } from 'vitest'
import { decidir, lineaDeRegistro } from '../../mods/presupuesto-agentes/hooks/presupuesto.mjs'
import { leerAgentesMod, juntarAgentes, leerAgentes } from '../../mods/tablero/hooks/estado.mjs'

const AHORA = Date.UTC(2026, 9, 11, 13, 0, 0)
const SONNET = { name: 'investigador', model: 'sonnet', effort: 'xhigh' }
const evento = (extra = {}) => ({ subagentType: 'investigador', model: 'sonnet', fork: false, definicion: SONNET, rateLimits: [], sessionId: 's', ...extra })

// Lo que haria el mod: decidir y dejar el renglon, llevando el libro de un lanzamiento al siguiente.
function correr(pedidos, escapes = {}) {
  let lanzamientos = []
  const lineas = []
  for (const { hace, ...extra } of pedidos) {
    const ahora = AHORA - hace
    const d = decidir(evento(extra), { lanzamientos, escapes }, ahora)
    lanzamientos = d.estadoNuevo.lanzamientos
    lineas.push(lineaDeRegistro({ ahora, accion: d.accion, tipo: extra.subagentType ?? 'investigador', model: extra.model ?? 'sonnet', peso: d.peso, cupo: 'sin lectura', def: 'C:/x/.claude/agents', motivo: d.motivo }))
  }
  return lineas.join('\n') + '\n'
}

describe('el tablero entiende lo que escribe el presupuesto', () => {
  test('cuenta los permitidos de la ventana con su peso; un negado y un auditor no suman puntos', () => {
    const log = correr([
      { hace: 15 * 60_000 },                                   // fuera de la ventana
      { hace: 5 * 60_000 },                                    // sonnet: 4
      { hace: 4 * 60_000, model: 'opus' },                     // opus: 8
      { hace: 3 * 60_000, model: 'haiku' },                    // haiku: 1
      { hace: 2 * 60_000, subagentType: 'auditor', model: undefined, definicion: { name: 'auditor', model: 'opus', effort: 'xhigh' } },
      { hace: 60_000, model: 'fable', rateLimits: [{ kind: 'five_hour', percentUsed: 91 }] },   // negado por cupo
    ])
    expect(leerAgentesMod(log, AHORA)).toEqual({ puntos: 13, lanzados: 4, tope: 40 })
  })

  test('el tope es el que dijo la ultima decision de la ventana (con ~/.claude/.agent-limit en 15 son 60)', () => {
    const log = correr([{ hace: 2 * 60_000 }, { hace: 60_000, model: 'haiku' }], { limite: { valor: 15, mtimeMs: AHORA - 3_600_000 } })
    expect(leerAgentesMod(log, AHORA)).toEqual({ puntos: 5, lanzados: 2, tope: 60 })
  })

  test('un negado por la ventana tambien dice el tope, y no suma', () => {
    const lleno = Array.from({ length: 10 }, (_, i) => ({ hace: (9 - i) * 30_000 + 60_000 }))
    const log = correr([...lleno, { hace: 30_000 }])
    expect(log.trim().split('\n').at(-1)).toMatch(/ NEGAR investigador .*40\/40 puntos/)
    expect(leerAgentesMod(log, AHORA)).toEqual({ puntos: 40, lanzados: 10, tope: 40 })
  })

  test('los dos libros juntos no se suman', () => {
    const log = correr([{ hace: 2 * 60_000 }, { hace: 60_000 }])
    const seg = (ms) => Math.floor((AHORA - ms) / 1000)
    const bash = leerAgentes(`${seg(2 * 60_000)} Agent 4\n${seg(60_000)} Agent 4\n`, AHORA)
    expect(juntarAgentes(bash, leerAgentesMod(log, AHORA))).toEqual({ puntos: 8, lanzados: 2, tope: 40 })
  })
})
