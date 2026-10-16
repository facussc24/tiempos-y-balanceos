// La cascara del mod (hooks/register.js) contra el motor de pruebas de Claude Code: `claude plugin test` desde
// mods/presupuesto-agentes. La politica pura (hooks/presupuesto.mjs) se prueba con vitest en
// __tests__/mods/presupuesto-agentes.test.mjs; aca se prueba lo que la politica no ve: donde se buscan las
// definiciones y que pasa si no se pueden leer, que ni el libro ni el registro pierdan lanzamientos en paralelo, los
// escapes leidos de disco, que una falla del hook deje pasar Y quede dicha, y la rebaja de `effort: max`.
// Estas pruebas no corren en el CI (no tiene `claude`): las corre scripts/_modsInstalar.mjs antes de copiar el mod.
import { expect, mock, test } from 'claude-code/testing'

const HOME = 'C:/Users/prueba'
const RAIZ = 'C:/Dev/Proyecto'
const AHORA = 1_760_000_000_000
const REGISTRO = `${HOME}/.claude/mods-log/presupuesto-agentes.log`

const DEFINICIONES: Record<string, string> = {
  [`${RAIZ}/.claude/agents/auditor.md`]: '---\nname: auditor\nmodel: opus\neffort: xhigh\n---\n',
  [`${HOME}/.claude/agents/investigador.md`]: '---\nname: investigador\nmodel: sonnet\neffort: xhigh\n---\n',
  [`${HOME}/.claude/agents/buscador.md`]: '---\nname: buscador\nmodel: haiku\neffort: medium\n---\n',
}

const barras = (ruta: string) => String(ruta).replaceAll('\\', '/')

type Opciones = {
  cupo?: { kind: string; percentUsed: number }[]
  escapes?: Record<string, { mtimeMs: number; texto?: string }> // nombre del archivo en ~/.claude -> su stat y texto
  libro?: unknown                                               // lo que ya hay guardado en el libro de lanzamientos
  demora?: boolean                                              // el libro y el registro contestan 50 ms despues de leer
  raiz?: string | null                                          // null = $.session.root() falla
  cwd?: string
  noSeListan?: string[]                                         // carpetas que EXISTEN pero no se dejan listar
  noSeLeen?: string[]                                           // archivos que no se dejan abrir
  libroRoto?: boolean                                           // $.store.get rechaza
}

// Arma los reemplazos de todo lo que el mod le pide a Claude Code y devuelve lo que quedo escrito
function armar(on: any, opciones: Opciones = {}) {
  const guardado = new Map<string, unknown>()
  if (opciones.libro !== undefined) guardado.set('lanzamientos', opciones.libro)
  const escrito = new Map<string, string>()
  const escapes = opciones.escapes ?? {}
  const esfuerzos: unknown[] = []
  const clock = mock.clock(on, { now: AHORA })
  mock.env(on, { USERPROFILE: HOME })

  const texto = (ruta: string): string | undefined => {
    const r = barras(ruta)
    if (escrito.has(r)) return escrito.get(r)
    if (r in DEFINICIONES) return DEFINICIONES[r]
    const escape = Object.keys(escapes).find((n) => r === `${HOME}/.claude/${n}`)
    return escape ? escapes[escape].texto ?? '' : undefined
  }
  on('fs.read', async ($: any, e: any) => {
    const r = barras(e.path)
    if ((opciones.noSeLeen ?? []).includes(r)) return { deny: 'EPERM' }
    // Se lee ANTES de la demora y se contesta despues: asi dos escrituras del registro se cruzan como en un archivo real
    const t = texto(r)
    if (opciones.demora && r === REGISTRO) await clock.sleep(120)   // mas lento que el libro: es cuando se pisaban
    return t === undefined ? { deny: 'ENOENT' } : { value: t }
  })
  on('fs.stat', ($: any, e: any) => {
    const r = barras(e.path)
    const escape = Object.keys(escapes).find((n) => r === `${HOME}/.claude/${n}`)
    return escape ? { value: { kind: 'file', size: 1, mtimeMs: escapes[escape].mtimeMs, isLink: false } } : { deny: 'ENOENT' }
  })
  const carpetas = () => new Set(Object.keys(DEFINICIONES).map((r) => r.slice(0, r.lastIndexOf('/'))))
  on('fs.list', ($: any, e: any) => {
    const dir = barras(e.path).replace(/\/$/, '')
    if ((opciones.noSeListan ?? []).includes(dir)) return { deny: 'EPERM' }
    const nombres = Object.keys(DEFINICIONES).filter((r) => r.startsWith(dir + '/')).map((r) => r.slice(dir.length + 1))
    return nombres.length ? { value: nombres.map((name) => ({ name, kind: 'file', size: 1, isLink: false })) } : { deny: 'ENOENT' }
  })
  on('fs.exists', ($: any, e: any) => ({ value: carpetas().has(barras(e.path).replace(/\/$/, '')) }))
  on('fs.write', ($: any, e: any) => {
    escrito.set(barras(e.path), e.text)
    return { value: undefined }
  })
  on('session.root', () => (opciones.raiz === null ? { deny: 'sin raiz' } : { value: opciones.raiz ?? RAIZ }))
  on('session.cwd', () => ({ value: opciones.cwd ?? `${RAIZ}/una/subcarpeta` }))
  on('session.id', () => ({ value: 'sesion-1' }))
  on('session.usage', () => ({ value: { rateLimits: opciones.cupo ?? [{ kind: 'five_hour', percentUsed: 5 }, { kind: 'seven_day', percentUsed: 20 }] } }))
  on('store.get', async ($: any, e: any) => {
    if (opciones.libroRoto) return { deny: 'el libro no contesta' }
    // Se lee ANTES de la demora y se contesta despues: sin la fila del mod, las doce leen la lista vacia y cada
    // escritura pisa a la anterior.
    const leido = guardado.get(e.key)
    if (opciones.demora) await clock.sleep(50)
    return { value: leido }
  })
  on('store.set', ($: any, e: any) => {
    guardado.set(e.key, e.value)
    return { value: undefined }
  })
  on('ui.log', () => ({ value: undefined }))
  // Lo que contestaria Claude Code cuando el mod deja pasar el lanzamiento
  on('agent.spawn', ($: any, e: any) => ({ model: e.model ?? 'de-la-definicion', agentId: 'a-' + e.subagentType }))
  // Lo que contestaria el modelo a un pedido: aca solo se anota con que esfuerzo llego
  on('turn.step', async function* ($: any, e: any) {
    esfuerzos.push(e.effort)
    yield { kind: 'text', index: 0, text: 'ok' }
    return { turnId: e.turnId, index: e.index, answer: 'ok', toolUses: [], stopReason: 'end_turn', usage: null }
  })

  const registro = () => escrito.get(REGISTRO) ?? ''
  const lineas = () => registro().split('\n').filter(Boolean)
  return { guardado, registro, lineas, clock, esfuerzos }
}

const lanzar = (tipo: string, extra: Record<string, unknown> = {}) => ({
  tool_use_id: 'tu-' + tipo,
  prompt: 'hace algo',
  description: 'prueba',
  subagentType: tipo,
  provider: { plugin: 'engine', tier: 'core' },
  parentModel: 'claude-opus-5-5',
  background: false,
  fork: false,
  ...extra,
})
const diezSonnet = () => Array.from({ length: 10 }, (_, i) => ({ ts: AHORA - 60_000 - i, tipo: 'investigador', modelo: 'sonnet', peso: 4 }))
const LLENO = [{ kind: 'five_hour', percentUsed: 95 }, { kind: 'seven_day', percentUsed: 90 }]

// ── donde se buscan las definiciones ──────────────────────────────────────────

test('el auditor del proyecto pasa aunque la carpeta de trabajo sea otra y el cupo este lleno', async ($, on) => {
  const { registro } = armar(on, { cupo: LLENO })
  const r = await $.agent.spawn(lanzar('auditor'))
  expect(r.deny).toBeUndefined()
  expect(r.agentId).toBe('a-auditor')
  expect(registro()).toMatch(/agent\.spawn PERMITIR auditor .*peso=0 .*def=C:\/Dev\/Proyecto\/\.claude\/agents ::/)
})

test('si root() no responde, las definiciones del proyecto se buscan en la carpeta de trabajo', async ($, on) => {
  const { registro } = armar(on, { raiz: null, cwd: RAIZ })
  const r = await $.agent.spawn(lanzar('auditor'))
  expect(r.deny).toBeUndefined()
  expect(registro()).toMatch(/PERMITIR auditor .*def=C:\/Dev\/Proyecto\/\.claude\/agents ::/)
})

test('el auditor pasa aunque su definicion no se encuentre (root() da otra carpeta), y queda dicho con def=sin', async ($, on) => {
  const { registro } = armar(on, { raiz: 'C:/Otra/Carpeta', cupo: LLENO })
  const r = await $.agent.spawn(lanzar('auditor'))
  expect(r.deny).toBeUndefined()
  expect(registro()).toMatch(/PERMITIR auditor .*peso=0 .*def=sin ::/)
})

test('la carpeta de agentes del proyecto existe y no se deja listar: el auditor pasa y queda def=error', async ($, on) => {
  const { registro } = armar(on, { noSeListan: [`${RAIZ}/.claude/agents`] })
  const r = await $.agent.spawn(lanzar('auditor'))
  expect(r.deny).toBeUndefined()
  expect(registro()).toMatch(/PERMITIR auditor .*def=error ::/)
})

test('un .md de definicion no se deja abrir: no se niega a nadie por «sin definicion»; siguen el cupo y la ventana', async ($, on) => {
  const { registro } = armar(on, { noSeLeen: [`${HOME}/.claude/agents/investigador.md`] })
  const r = await $.agent.spawn(lanzar('investigador', { model: 'sonnet' }))
  expect(r.deny).toBeUndefined()
  expect(registro()).toMatch(/PERMITIR investigador .*peso=4 .*def=error :: 4\/40 puntos/)
})

test('con la definicion sin leer el cupo lleno (5 h) frena igual', async ($, on) => {
  armar(on, { noSeLeen: [`${HOME}/.claude/agents/investigador.md`], cupo: LLENO })
  const r = await $.agent.spawn(lanzar('investigador', { model: 'sonnet' }))
  expect(String(r.deny)).toMatch(/Cupo real/)
})

test('un buscador (haiku) pasa y descuenta 1; el registro dice de que carpeta salio la definicion', async ($, on) => {
  const { guardado, registro } = armar(on)
  const r = await $.agent.spawn(lanzar('buscador'))
  expect(r.deny).toBeUndefined()
  expect((guardado.get('lanzamientos') as any[]).map((l) => l.peso)).toEqual([1])
  expect(registro()).toMatch(/PERMITIR buscador .*peso=1 .*def=C:\/Users\/prueba\/\.claude\/agents :: 1\/40 puntos/)
})

test('un built-in que de verdad no tiene definicion se niega con el motivo, y queda anotado con def=sin', async ($, on) => {
  const { registro } = armar(on)
  const r = await $.agent.spawn(lanzar('general-purpose', { model: 'sonnet' }))
  expect(String(r.deny)).toMatch(/no tiene definicion propia/)
  expect(registro()).toMatch(/NEGAR general-purpose .*def=sin ::/)
})

// ── el cupo real y los escapes, leidos de disco ───────────────────────────────

test('cupo lleno (5 h al 91 %): un investigador se niega', async ($, on) => {
  armar(on, { cupo: [{ kind: 'five_hour', percentUsed: 91 }, { kind: 'seven_day', percentUsed: 40 }] })
  const r = await $.agent.spawn(lanzar('investigador', { model: 'sonnet' }))
  expect(String(r.deny)).toMatch(/de 5 horas esta al 91 %/)
})

test('semana al 61 %: una busqueda en haiku SALE con el aviso del 60 % en el registro (16/10/2026, Fak 15/10: sin evidencia no hay freno por cupo semanal)', async ($, on) => {
  const { registro } = armar(on, { cupo: [{ kind: 'five_hour', percentUsed: 5 }, { kind: 'seven_day', percentUsed: 61 }] })
  const r = await $.agent.spawn(lanzar('buscador'))
  expect(r.deny).toBeUndefined()
  expect(registro()).toMatch(/PERMITIR buscador .*AVISO Cupo real: la ventana semanal esta al 61 % \(aviso desde el 60 %\)/)
})

test('con ~/.claude/.agent-cupo-ok vigente el mismo lanzamiento pasa, y sin aviso', async ($, on) => {
  const { registro } = armar(on, { cupo: LLENO, escapes: { '.agent-cupo-ok': { mtimeMs: AHORA - 60_000 } } })
  const r = await $.agent.spawn(lanzar('investigador', { model: 'sonnet' }))
  expect(r.deny).toBeUndefined()
  expect(registro()).not.toMatch(/AVISO Cupo real/)
})

test('~/.claude/.agent-cupo-ok de hace 13 horas ya no vale', async ($, on) => {
  armar(on, { cupo: LLENO, escapes: { '.agent-cupo-ok': { mtimeMs: AHORA - 13 * 3_600_000 } } })
  const r = await $.agent.spawn(lanzar('investigador', { model: 'sonnet' }))
  expect(String(r.deny)).toMatch(/Cupo real/)
})

test('ventana llena (40 puntos): un Sonnet mas no entra', async ($, on) => {
  armar(on, { libro: diezSonnet() })
  const r = await $.agent.spawn(lanzar('investigador', { model: 'sonnet' }))
  expect(String(r.deny)).toMatch(/40\/40 puntos/)
})

test('con ~/.claude/.agent-limit en 15 la misma ventana tiene 60 puntos y el Sonnet entra', async ($, on) => {
  const { registro } = armar(on, { libro: diezSonnet(), escapes: { '.agent-limit': { mtimeMs: AHORA - 60_000, texto: '15\n' } } })
  const r = await $.agent.spawn(lanzar('investigador', { model: 'sonnet' }))
  expect(r.deny).toBeUndefined()
  expect(registro()).toMatch(/:: 44\/60 puntos/)
})

test('un Opus pesa 8; con ~/.claude/.agent-opus-ok pesa como un Sonnet', async ($, on) => {
  const { registro } = armar(on)
  await $.agent.spawn(lanzar('investigador', { model: 'opus' }))
  expect(registro()).toMatch(/PERMITIR investigador model=opus peso=8 /)
})

test('~/.claude/.agent-opus-ok: el mismo Opus descuenta 4', async ($, on) => {
  const { registro } = armar(on, { escapes: { '.agent-opus-ok': { mtimeMs: AHORA - 60_000 } } })
  await $.agent.spawn(lanzar('investigador', { model: 'opus' }))
  expect(registro()).toMatch(/PERMITIR investigador model=opus peso=4 /)
})

// ── en paralelo: ni el libro ni el registro pierden nada ──────────────────────

test('doce Sonnet lanzados a la vez: entran diez (40 puntos), el libro tiene diez y el registro las doce decisiones', async ($, on) => {
  const { guardado, lineas, clock } = armar(on, { demora: true })
  const pedidos = Array.from({ length: 12 }, () => $.agent.spawn(lanzar('investigador', { model: 'sonnet' })))
  // el libro contesta a los 50 ms y el registro a los 120 (del reloj de prueba): se avanza hasta que todas contestaron
  for (let i = 0; i < 80; i++) await clock.advance(50)
  const resultados = await Promise.all(pedidos)
  expect(resultados.filter((r) => r.deny === undefined).length).toBe(10)
  expect(resultados.filter((r) => r.deny !== undefined).length).toBe(2)
  expect((guardado.get('lanzamientos') as any[]).length).toBe(10)
  expect(lineas().filter((l) => / agent\.spawn PERMITIR /.test(l)).length).toBe(10)
  expect(lineas().filter((l) => / agent\.spawn NEGAR /.test(l)).length).toBe(2)
})

// ── una falla del hook deja pasar y queda dicha ───────────────────────────────

test('el libro no contesta: el lanzamiento PASA (decide el guardian bash) y el registro dice que el hook fallo', async ($, on) => {
  const { lineas } = armar(on, { libroRoto: true })
  const r = await $.agent.spawn(lanzar('investigador', { model: 'sonnet' }))
  expect(r.deny).toBeUndefined()
  expect(r.agentId).toBe('a-investigador')
  expect(lineas().filter((l) => / agent\.spawn ERROR investigador :: el hook fallo/.test(l)).length).toBe(1)
})

// ── el arranque y el esfuerzo ─────────────────────────────────────────────────

test('al arrancar la sesion deja un renglon con la raiz que resolvio', async ($, on) => {
  const { registro } = armar(on)
  on('session.start', () => ({ cwd: RAIZ }))
  await $.session.start({ surface: 'desktop', isInteractive: true, cwd: RAIZ })
  expect(registro()).toMatch(/ session\.start surface=desktop raiz=C:\/Dev\/Proyecto mod=\S+presupuesto-agentes\n$/)
})

test('un subagente que pide effort max se rebaja a xhigh; la sesion principal y los demas esfuerzos no se tocan', async ($, on) => {
  const { esfuerzos } = armar(on)
  const pedir = async (extra: Record<string, unknown>) => {
    const flujo = $.turn.step({ turnId: 't', index: 0, model: 'claude-test', messageCount: 1, ...extra })
    let paso = await flujo.next()
    while (paso.done !== true) paso = await flujo.next()
  }
  await pedir({ agentId: 'a1', effort: 'max' })
  await pedir({ effort: 'max' })
  await pedir({ agentId: 'a2', effort: 'high' })
  expect(esfuerzos).toEqual(['xhigh', 'max', 'high'])
})
