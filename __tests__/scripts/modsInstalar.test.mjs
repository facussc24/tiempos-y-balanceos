import { describe, expect, test } from 'vitest'
import { existsSync, mkdtempSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { MARKETPLACE, MODS, archivosDe, armarMarketplace, huella, jsonDeSalida, leerManifiesto, quitar, reemplazarCopia, rutas, viaja } from '../../scripts/_modsInstalar.mjs'

function carpetaDePrueba() {
  const dir = mkdtempSync(join(tmpdir(), 'mods-instalar-'))
  mkdirSync(join(dir, 'hooks'), { recursive: true })
  mkdirSync(join(dir, 'tests'), { recursive: true })
  mkdirSync(join(dir, '.claude-plugin', 'types', 'claude-code'), { recursive: true })
  writeFileSync(join(dir, '.claude-plugin', 'plugin.json'), '{"name":"x","version":"0.1.0","description":"d"}')
  writeFileSync(join(dir, '.claude-plugin', 'types', 'claude-code', 'index.d.ts'), 'tipos')
  writeFileSync(join(dir, 'hooks', 'register.js'), 'export function register() {}')
  writeFileSync(join(dir, 'tests', 'x.test.ts'), 'prueba')
  writeFileSync(join(dir, 'tsconfig.json'), '{}')
  return dir
}

describe('que viaja a la copia instalada', () => {
  test('el codigo y el manifiesto viajan; las pruebas, los tipos generados y el tsconfig no', () => {
    expect(viaja('hooks/register.js')).toBe(true)
    expect(viaja('.claude-plugin/plugin.json')).toBe(true)
    expect(viaja('README.md')).toBe(true)
    expect(viaja('tests')).toBe(false)
    expect(viaja('tests\\x.test.ts')).toBe(false)
    expect(viaja('.claude-plugin/types/claude-code/index.d.ts')).toBe(false)
    expect(viaja('tsconfig.json')).toBe(false)
    // un archivo que solo se parece no se saltea
    expect(viaja('hooks/tests.mjs')).toBe(true)
    expect(viaja('hooks/tsconfig.json')).toBe(true)
  })

  test('archivosDe lista solo lo que viaja, con barras normales y en orden', () => {
    expect(archivosDe(carpetaDePrueba())).toEqual(['.claude-plugin/plugin.json', 'hooks/register.js'])
    expect(archivosDe(join(tmpdir(), 'no-existe-mods-instalar'))).toEqual([])
  })
})

describe('la salida de claude ... --json', () => {
  test('el JSON pelado, con texto antes, con texto despues, y null si no hay', () => {
    expect(jsonDeSalida('[{"id":"a@b"}]')).toEqual([{ id: 'a@b' }])
    expect(jsonDeSalida('aviso: algo\n[\n  {"id":"a@b"}\n]\n')).toEqual([{ id: 'a@b' }])
    expect(jsonDeSalida('[\n  {"id":"a@b"}\n]\nUn renglon de mas al final')).toEqual([{ id: 'a@b' }])
    expect(jsonDeSalida('[]')).toEqual([])
    expect(jsonDeSalida('Failed to list marketplaces')).toBeNull()
    expect(jsonDeSalida('')).toBeNull()
  })
})

describe('la vuelta atras dice la verdad', () => {
  const MODS_DE_PRUEBA = [{ id: 'tablero-casa@mods-casa' }, { id: 'presupuesto-agentes@mods-casa' }]
  // Un `claude` de mentira: lleva la lista de instalados y decide si cada desinstalacion anda.
  function claudeDeMentira({ desinstala = () => true, listaSeLee = () => true } = {}) {
    let instalados = MODS_DE_PRUEBA.map((m) => ({ id: m.id, enabled: true }))
    let mercado = true
    let lecturas = 0
    const llamadas = []
    const correr = (_, args) => {
      llamadas.push(args.join(' '))
      const [a, b, c] = args
      if (a === 'plugin' && b === 'list') return listaSeLee(++lecturas) ? { status: 0, stdout: JSON.stringify(instalados), stderr: '' } : { status: 1, stdout: '', stderr: 'no se pudo' }
      if (a === 'plugin' && b === 'marketplace' && c === 'list') return { status: 0, stdout: JSON.stringify(mercado ? [{ name: 'mods-casa' }] : []), stderr: '' }
      if (a === 'plugin' && b === 'uninstall') { if (!desinstala(c)) return { status: 1, stdout: '', stderr: 'EBUSY' }; instalados = instalados.filter((p) => p.id !== c); return { status: 0, stdout: '', stderr: '' } }
      if (a === 'plugin' && b === 'marketplace' && c === 'remove') { mercado = false; return { status: 0, stdout: '', stderr: '' } }
      return { status: 1, stdout: '', stderr: 'comando desconocido' }
    }
    const dicho = []
    return { correr, llamadas, dicho, consola: { log: (t) => dicho.push(t), error: (t) => dicho.push(t) } }
  }

  test('verde: desinstala los dos, saca el marketplace, lo verifica y sale con 0', () => {
    const c = claudeDeMentira()
    expect(quitar(true, { correr: c.correr, consola: c.consola, mods: MODS_DE_PRUEBA })).toBe(0)
    expect(c.dicho.join('\n')).toContain('Quitados (verificado en la lista)')
    expect(c.llamadas.filter((l) => l.startsWith('plugin uninstall'))).toHaveLength(2)
  })

  test('rojo: una desinstalacion falla: NO dice «Quitados», nombra el que quedo y sale con 1', () => {
    const c = claudeDeMentira({ desinstala: (id) => id !== 'presupuesto-agentes@mods-casa' })
    expect(quitar(true, { correr: c.correr, consola: c.consola, mods: MODS_DE_PRUEBA })).toBe(1)
    const texto = c.dicho.join('\n')
    expect(texto).not.toContain('Quitados')
    expect(texto).toContain('SIGUEN INSTALADOS: presupuesto-agentes@mods-casa')
  })

  test('rojo: la lista no se puede leer: no toca nada y sale con 1', () => {
    const c = claudeDeMentira({ listaSeLee: () => false })
    expect(quitar(true, { correr: c.correr, consola: c.consola, mods: MODS_DE_PRUEBA })).toBe(1)
    expect(c.llamadas.some((l) => l.startsWith('plugin uninstall'))).toBe(false)
    expect(c.dicho.join('\n')).not.toContain('Quitados')
  })

  test('rojo: la lista se lee antes pero no despues: dice que no sabe y sale con 1', () => {
    const c = claudeDeMentira({ listaSeLee: (n) => n === 1 })
    expect(quitar(true, { correr: c.correr, consola: c.consola, mods: MODS_DE_PRUEBA })).toBe(1)
    expect(c.dicho.join('\n')).toContain('NO SE si quedaron quitados')
  })

  test('sin --aplicar no llama a nada que cambie', () => {
    const c = claudeDeMentira()
    expect(quitar(false, { correr: c.correr, consola: c.consola, mods: MODS_DE_PRUEBA })).toBe(0)
    expect(c.llamadas.every((l) => l.endsWith('--json'))).toBe(true)
  })
})

describe('reemplazar la copia instalada', () => {
  const armar = () => {
    const raiz = mkdtempSync(join(tmpdir(), 'mods-copia-'))
    const origen = carpetaDePrueba()
    return { origen, final: join(raiz, 'mod'), anteriores: join(raiz, '_anteriores') }
  }

  test('la primera vez copia lo que viaja; la segunda guarda la anterior y deja la nueva', () => {
    const { origen, final, anteriores } = armar()
    expect(reemplazarCopia(origen, final, { anteriores, nombre: 'mod', marca: 'm1' })).toEqual({ enUso: null })
    expect(archivosDe(final)).toEqual(['.claude-plugin/plugin.json', 'hooks/register.js'])
    expect(existsSync(join(final, 'tests'))).toBe(false)
    writeFileSync(join(origen, 'hooks', 'register.js'), 'export function register() { /* v2 */ }')
    expect(reemplazarCopia(origen, final, { anteriores, nombre: 'mod', marca: 'm2' })).toEqual({ enUso: null })
    expect(huella(final)).toBe(huella(origen))
    expect(readFileSync(join(anteriores, 'mod-m2', 'hooks', 'register.js'), 'utf8')).toBe('export function register() {}')
  })

  test('la carpeta vieja esta en uso (Windows no la deja renombrar): se pisa archivo por archivo y queda igual a la del repo', () => {
    const { origen, final, anteriores } = armar()
    reemplazarCopia(origen, final, { anteriores, nombre: 'mod', marca: 'm1' })
    writeFileSync(join(origen, 'hooks', 'register.js'), 'export function register() { /* v2 */ }')
    const enUso = (de, a) => { if (de === final) { const e = new Error('ocupada'); e.code = 'EBUSY'; throw e } renameSync(de, a) }
    expect(reemplazarCopia(origen, final, { anteriores, nombre: 'mod', marca: 'm2', renombrar: enUso })).toEqual({ enUso: 'EBUSY' })
    expect(huella(final)).toBe(huella(origen))
    expect(existsSync(join(anteriores, 'mod-m2.nueva', 'hooks', 'register.js'))).toBe(true)
    expect(existsSync(`${final}.nuevo-m2`)).toBe(false)
  })

  test('otro error al renombrar no se traga', () => {
    const { origen, final, anteriores } = armar()
    reemplazarCopia(origen, final, { anteriores, nombre: 'mod', marca: 'm1' })
    const roto = () => { const e = new Error('disco'); e.code = 'EIO'; throw e }
    expect(() => reemplazarCopia(origen, final, { anteriores, nombre: 'mod', marca: 'm2', renombrar: roto })).toThrow('disco')
  })
})

describe('huella: dice si la copia es la del repo', () => {
  test('dos carpetas con lo mismo dan la misma huella; un byte distinto la cambia; lo que no viaja no cuenta', () => {
    const a = carpetaDePrueba()
    const b = carpetaDePrueba()
    expect(huella(a)).toBe(huella(b))
    writeFileSync(join(b, 'tests', 'x.test.ts'), 'otra prueba')
    expect(huella(a)).toBe(huella(b))
    writeFileSync(join(b, 'hooks', 'register.js'), 'export function register() { }')
    expect(huella(a)).not.toBe(huella(b))
  })
})

describe('el catalogo y la lista de mods', () => {
  test('el marketplace lista un plugin por mod, con ruta relativa, y no se llama barack', () => {
    const cat = armarMarketplace([{ carpeta: 'tablero', nombre: 'tablero-casa', descripcion: 'd1' }, { carpeta: 'presupuesto-agentes', nombre: 'presupuesto-agentes', descripcion: 'd2' }])
    expect(cat.name).toBe(MARKETPLACE)
    expect(MARKETPLACE).not.toBe('barack')
    expect(cat.plugins).toEqual([
      { name: 'tablero-casa', source: './tablero', description: 'd1' },
      { name: 'presupuesto-agentes', source: './presupuesto-agentes', description: 'd2' },
    ])
  })

  test('se instalan el tablero, el presupuesto y el recordatorio de temas; el recordatorio de CC/SC no (Fak, 11/10/2026)', () => {
    expect(MODS).toEqual(['tablero', 'presupuesto-agentes', 'recordatorio-temas'])
    for (const m of MODS) {
      const man = leerManifiesto(join(process.cwd(), 'mods', m))
      expect(typeof man.name).toBe('string')
      expect(man.name.startsWith('claude-')).toBe(false)
    }
  })

  test('la copia vive adentro de la carpeta de configuracion de Claude Code, fuera del repo', () => {
    const r = rutas('C:/Users/x/.claude')
    expect(r.destino.replaceAll('\\', '/')).toBe('C:/Users/x/.claude/mods-casa')
    expect(r.registro.replaceAll('\\', '/')).toBe('C:/Users/x/.claude/mods-log')
  })

  test('los archivos de git no viajan', () => {
    expect(viaja('.gitignore')).toBe(false)
    expect(viaja('hooks/.gitignore')).toBe(true)   // solo el de la raiz del mod
  })

  test('el script no borra: no usa rm ni unlink', () => {
    const fuente = readFileSync(join(process.cwd(), 'scripts', '_modsInstalar.mjs'), 'utf8')
    expect(fuente).not.toMatch(/\brmSync\b|\bunlinkSync\b|\brmdirSync\b|\brm -rf\b/)
  })
})
