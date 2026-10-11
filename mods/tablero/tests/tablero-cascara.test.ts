// La cascara del tablero (hooks/register.mjs) contra el motor de pruebas de Claude Code: `claude plugin test`
// desde mods/tablero. Los modulos puros (estado.mjs, dibujo.mjs) se prueban con vitest en tablero.test.mjs.
// Aca se prueba que el arbol que dibuja es valido en la terminal y en la app de escritorio, y que sin ningun
// archivo o con una llamada que falla la banda igual se dibuja.
import { expect, mock, test } from 'claude-code/testing'

const HOME = 'C:/Users/prueba'
const AHORA = new Date(2026, 9, 11, 20, 50).getTime()
const barras = (ruta: string) => String(ruta).replaceAll('\\', '/')

// Lo que Claude Code le pasa a un ui.render de la banda, salvo la app
const BANDA = {
  plugin: 'tablero-casa',
  component: 'AbovePrompt',
  viewport: { columns: 120, rows: 40 },
  props: { hasSurvey: false, isWorking: false, maxRows: 10, bodyColumns: 100, scroll: { offset: 0, bodyRows: 10 }, view: {} },
} as const

function armar(on: any, archivos: Record<string, string> = {}, cupo: unknown[] | null = [{ kind: 'five_hour', percentUsed: 62 }, { kind: 'seven_day', percentUsed: 31 }]) {
  const clock = mock.clock(on, { now: AHORA })
  mock.env(on, { USERPROFILE: HOME })
  on('session.start', () => ({ cwd: 'C:/Dev/Proyecto' }))
  on('session.usage', () => (cupo === null ? { deny: 'sin lectura' } : { value: { rateLimits: cupo } }))
  on('session.id', () => ({ value: 'ses-1' }))
  on('session.cwd', () => ({ value: 'C:/Dev/Proyecto' }))
  on('agent.list', () => ({ value: [{ id: 'a1', status: 'running' }, { id: 'a2', status: 'done' }] }))
  on('command.register', () => ({ value: undefined }))
  const escrito = new Map<string, string>()
  on('fs.read', ($: any, e: any) => {
    const t = escrito.get(barras(e.path)) ?? archivos[barras(e.path)]   // lo que el mod escribio se vuelve a leer
    return t === undefined ? { deny: 'ENOENT' } : { value: t }
  })
  on('fs.stat', () => ({ deny: 'ENOENT' }))
  on('fs.list', () => ({ deny: 'ENOENT' }))
  on('fs.write', ($: any, e: any) => { escrito.set(barras(e.path), e.text); return { value: undefined } })
  on('ui.log', () => ({ value: undefined }))
  // Lo que otros mods dibujarian en la banda: el tablero lo deja debajo
  on('ui.render', () => ({ type: 'Text', props: {}, children: ['lo de otro mod'] }))
  return { clock, escrito }
}

test('la banda se dibuja en la terminal y en la app de escritorio con el cupo y los agentes', async ($, on) => {
  const seg = Math.floor((AHORA - 60_000) / 1000)
  const { clock } = armar(on, { [`${HOME}/.claude/.agent-spawns.log`]: `${seg} Agent 4\n${seg} Agent 1\n` })
  await $.session.start({ surface: 'desktop', isInteractive: true, cwd: 'C:/Dev/Proyecto' })
  await clock.settle()
  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ ...BANDA, surface })
    expect(await ui.find({ type: 'Text', text: '62 %' })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: '31 %' })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /^5\/40 pts$/ })).toBeDefined()   // el texto entero: «15/40 pts» no pasa
    expect(await ui.find({ type: 'Text', text: 'sin hora fijada' })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: 'lo de otro mod' })).toBeDefined()
    await ui.unmount()
  }
})

test('sin archivos y sin lectura de cupo la banda igual se dibuja («sin datos») y no tapa lo de otros', async ($, on) => {
  const { clock } = armar(on, {}, null)
  await $.session.start({ surface: 'desktop', isInteractive: true, cwd: 'C:/Dev/Proyecto' })
  await clock.settle()
  const ui = await $.ui.mount({ ...BANDA, surface: 'desktop' })
  expect(await ui.find({ type: 'Text', text: 'sin datos' })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: 'lo de otro mod' })).toBeDefined()
})

test('antes de la primera lectura (sin session.start) la banda no rompe', async ($, on) => {
  armar(on)
  const ui = await $.ui.mount({ ...BANDA, surface: 'desktop' })
  expect(await ui.find({ type: 'Text', text: 'lo de otro mod' })).toBeDefined()
})

test('deja en su registro que cargo y la primera vez que la app le pide dibujar la banda (una sola vez por sesion)', async ($, on) => {
  const { clock, escrito } = armar(on)
  await $.session.start({ surface: 'desktop', isInteractive: true, cwd: 'C:/Dev/Proyecto' })
  await clock.settle()
  for (let i = 0; i < 3; i++) { const ui = await $.ui.mount({ ...BANDA, surface: 'desktop' }); await ui.unmount() }
  await clock.settle()
  const lineas = (escrito.get(`${HOME}/.claude/mods-log/tablero.log`) ?? '').split('\n').filter(Boolean)
  expect(lineas.filter((l) => / session\.start mod=\S+tablero$/.test(l)).length).toBe(1)
  expect(lineas.filter((l) => / ui\.render AbovePrompt ancho=100 /.test(l)).length).toBe(1)
})
