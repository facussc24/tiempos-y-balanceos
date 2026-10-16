// La cascara del mod (hooks/register.js) contra el motor de pruebas de Claude Code: `claude plugin test` desde
// mods/recordatorio-temas. La parte pura (hooks/temas.mjs) se prueba con vitest en __tests__/mods/recordatorio-temas.test.mjs
// con los mensajes reales de Fak; aca se prueba lo que la parte pura no ve: que el renglon llegue como `context` del
// mensaje, que el canon se lea de la raiz del proyecto, que un aviso que no es de Fak no reciba nada, la hora por sesion
// y que sin canon el mensaje pase igual. No corre en el CI (no tiene `claude`): lo corre scripts/_modsInstalar.mjs.
import { expect, mock, test } from 'claude-code/testing'

const HOME = 'C:/Users/prueba'
const RAIZ = 'C:/Dev/Proyecto'
const AHORA = 1_760_000_000_000
const REGISTRO = `${HOME}/.claude/mods-log/recordatorio-temas.log`
const CANON = JSON.stringify({
  memoria_dir: '~/.claude/projects/C--Dev-BarackMercosul/memory',
  cooldown_min: 60,
  max_temas_por_mensaje: 3,
  temas: [
    { id: 'plotter-aol', nombre: 'el plotter de corte', archivos: ['reference_plotter_aol_corte_insert.md'], frases: ['plotter de corte'] },
  ],
})

type Opciones = { canon?: string | null; sesion?: string; storeRoto?: boolean }

function armar(on: any, opciones: Opciones = {}) {
  const guardado = new Map<string, unknown>()
  const escrito = new Map<string, string>()
  const clock = mock.clock(on, { now: AHORA })
  mock.env(on, { USERPROFILE: HOME })
  const canon = opciones.canon === undefined ? CANON : opciones.canon
  on('fs.read', ($: any, e: any) => {
    const r = String(e.path).replaceAll('\\', '/')
    if (escrito.has(r)) return { value: escrito.get(r) }
    if (r === `${RAIZ}/scripts/_lib/temasCanon.data.json` && canon !== null) return { value: canon }
    return { deny: 'ENOENT' }
  })
  on('fs.write', ($: any, e: any) => { escrito.set(String(e.path).replaceAll('\\', '/'), e.text); return { value: undefined } })
  on('session.root', () => ({ value: RAIZ }))
  on('session.cwd', () => ({ value: RAIZ }))
  on('session.id', () => ({ value: opciones.sesion ?? 'sesion-1' }))
  on('store.get', ($: any, e: any) => (opciones.storeRoto ? { deny: 'store roto' } : { value: guardado.get(e.key) }))
  on('store.set', ($: any, e: any) => { guardado.set(e.key, e.value); return { value: undefined } })
  // Lo que haria el motor con el mensaje: lo deja entrar tal cual, con el contexto que le pusieron los hooks.
  on('prompt.submit', ($: any, e: any) => ({ text: e.text, context: e.context }))
  const lineas = () => (escrito.get(REGISTRO) ?? '').split('\n').filter(Boolean)
  return { guardado, clock, lineas }
}

const mensaje = (text: string, kind = 'composer') => ({ text, wait: false, origin: { kind } })

test('un mensaje de Fak que nombra el plotter de corte trae el renglon con la ruta absoluta de la memoria', async ($, on) => {
  const { lineas } = armar(on)
  const r: any = await $.prompt.submit(mensaje('no, pelotudo, ese plotter no, el plotter de corte te decía') as any)
  expect(r.context?.join('\n')).toContain(`${HOME}/.claude/projects/C--Dev-BarackMercosul/memory/reference_plotter_aol_corte_insert.md`)
  expect(lineas().at(-1)).toMatch(/origen=composer .*AVISO plotter-aol/)
})

test('un aviso de una tarea o un encargo de otra sesion no recibe nada aunque nombre el tema', async ($, on) => {
  const { lineas } = armar(on)
  for (const kind of ['task-notification', 'peer', 'scheduled-trigger', 'sdk']) {
    const r: any = await $.prompt.submit(mensaje('el plotter de corte', kind) as any)
    expect(r.context ?? []).toEqual([])
  }
  expect(lineas().filter((l) => / sesion=sesion-1 no es de Fak: nada/.test(l)).length).toBe(4)
})

test('si el store falla, el mensaje pasa igual (el mod nunca frena)', async ($, on) => {
  armar(on, { storeRoto: true })
  const r: any = await $.prompt.submit(mensaje('el plotter de corte') as any)
  expect(r.text).toBe('el plotter de corte')
})

test('el mismo tema no se repite en la misma sesion dentro de la hora, y vuelve pasada la hora', async ($, on) => {
  const { clock } = armar(on)
  const a: any = await $.prompt.submit(mensaje('el plotter de corte') as any)
  const b: any = await $.prompt.submit(mensaje('el plotter de corte otra vez') as any)
  expect(a.context?.length).toBe(1)
  expect(b.context ?? []).toEqual([])
  await clock.advance(61 * 60_000)
  const c: any = await $.prompt.submit(mensaje('el plotter de corte') as any)
  expect(c.context?.length).toBe(1)
})

test('sin canon en el proyecto el mensaje pasa igual, sin renglon, y queda dicho en el registro', async ($, on) => {
  const { lineas } = armar(on, { canon: null })
  const r: any = await $.prompt.submit(mensaje('el plotter de corte') as any)
  expect(r.text).toBe('el plotter de corte')
  expect(r.context ?? []).toEqual([])
  expect(lineas().at(-1)).toMatch(/sin canon/)
})

test('un mensaje sin tema pasa sin renglon', async ($, on) => {
  armar(on)
  const r: any = await $.prompt.submit(mensaje('abrí el último power point') as any)
  expect(r.context ?? []).toEqual([])
})
