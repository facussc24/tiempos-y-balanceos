import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { describe, expect, test } from 'vitest'
import { decidir, esDeFak, leerCanon, normalizar, temasDelTexto } from '../../mods/recordatorio-temas/hooks/temas.mjs'

// El canon de verdad, el mismo que lee el mod en vivo: estas pruebas fallan si alguien lo cambia y deja de reconocer un
// mensaje real de Fak.
const CANON_TXT = fs.readFileSync(path.join(import.meta.dirname, '..', '..', 'scripts', '_lib', 'temasCanon.data.json'), 'utf8')
const canon = leerCanon(CANON_TXT)
const T0 = 1_760_000_000_000
const FAK = { kind: 'composer' }
const ids = (texto) => temasDelTexto(texto, canon).map((t) => t.id)
const archivos = (texto) => temasDelTexto(texto, canon).flatMap((t) => t.archivos)

// Mensajes REALES de Fak, textuales (docs/PLAN_MEMORIA_Y_MAQUINAS_2026-10-16.md 1.3.2 y 1.4, de los transcripts).
const CON_TEMA = [
  ['no, pelotudo, ese plotter no, el plotter de corte te decía', 'reference_plotter_aol_corte_insert.md'], // 14/10 15:58
  ['también es grave que no recuerde las medidas del plotter o qué papel usa para imprimir el otro plotter', 'reference_plotter_inkjet_software_htv2a.md'], // 14/10 16:02
  ['creo que el papel mide 90 cm de ancho', 'reference_plotter_inkjet_software_htv2a.md'], // 30/09 14:08
  ['recordá las medidas del plotter', 'reference_plotter_aol_corte_insert.md'], // 02/10 16:00
  ['siempre usamos el pla rapid', 'reference_impresora_3d_fak.md'], // 13/08
  ['el que imprime los plt el plotter usa ese software', 'reference_plotter_inkjet_software_htv2a.md'], // 07/08 12:51
]
const SIN_TEMA = ['dale', 'ok gracias', 'mandalo', '¿cuánto falta?', 'abrí el último power point']

// Los 10 temas de la prueba de 1.3.1, con las palabras de Fak: el archivo esperado tiene que salir del canon.
const DIEZ = [
  ['lo del tornillo CNC', 'project_tornillo_cabeza_ancha_impreso.md'],
  ['el plotter de corte', 'reference_plotter_aol_corte_insert.md'],
  ['el otro plotter', 'reference_plotter_inkjet_software_htv2a.md'],
  ['valores de costura IP PAD', 'reference_valores_costura_patagonia_confirmados.md'],
  ['la impresora', 'reference_impresora_3d_fak.md'],
  ['la hotmelera', 'reference_maquina_hotmelt_parametros.md'],
  ['el 8D de la tapa', 'project_8d_11010843_tapa_amarok.md'],
  ['el Sika del top roll', 'project_sika_toproll_codigo_y_consumo.md'],
  ['la reunión con Calidad', 'project_reunion_amfe_calidad_2026-10.md'],
  ['el plan del sistema', 'project_plan_sistema_2026-10-16_donde_quedo.md'],
]

describe('recordatorio-temas: mensajes reales de Fak', () => {
  test.each(CON_TEMA)('«%s» trae %s', (mensaje, archivo) => {
    expect(archivos(mensaje)).toContain(archivo)
    const d = decidir({ texto: mensaje, origen: FAK, sesion: 's1', vistos: {}, ahoraMs: T0, canon })
    expect(d.renglones.map((r) => r.texto).join('\n')).toContain(`/${archivo}`)
  })

  test.each(SIN_TEMA)('«%s» no trae nada', (mensaje) => {
    expect(ids(mensaje)).toEqual([])
    expect(decidir({ texto: mensaje, origen: FAK, sesion: 's1', vistos: {}, ahoraMs: T0, canon }).renglones).toEqual([])
  })

  test.each(DIEZ)('tema «%s» -> %s', (tema, archivo) => {
    expect(archivos(tema)).toContain(archivo)
  })
})

describe('recordatorio-temas: lo que no tiene que disparar', () => {
  test('palabras parecidas no son el tema: plan, plano, plantilla no son «pla»; IMG_0585 no es la moldeadora', () => {
    expect(ids('mandame el plano y la plantilla del plan de control')).not.toContain('impresora-3d')
    expect(ids('el video IMG_0585 de la puerta')).not.toContain('moldeadora-img')
    expect(ids('el papel de la reunión')).toEqual([])
  })

  test('sin acentos ni mayusculas: «Hotmelera», «la HORTMELERA» y «el Plotter de Corte» se reconocen', () => {
    expect(ids('la Hotmelera')).toContain('hotmelt')
    expect(ids('la HORTMELERA')).toContain('hotmelt')
    expect(ids('el Plotter de Corte')).toContain('plotter-aol')
    expect(normalizar('Reunión  con   Calidad!')).toBe(' reunion con calidad ')
  })

  test('lo que no escribe Fak no recibe nada: un aviso de tarea, otra sesion, una tarea programada, un plugin, un meta', () => {
    for (const kind of ['task-notification', 'peer', 'peer-send-message', 'scheduled-trigger', 'plugin', 'coordinator']) {
      expect(esDeFak({ kind })).toBe(false)
      expect(decidir({ texto: 'el plotter de corte', origen: { kind }, sesion: 's1', vistos: {}, ahoraMs: T0, canon }).renglones).toEqual([])
    }
    expect(esDeFak(FAK, true)).toBe(false)
    expect(esDeFak(FAK)).toBe(true)
    expect(esDeFak({ kind: 'bridge' })).toBe(true)
  })

  test('sin canon no sale nada y no rompe', () => {
    expect(leerCanon('no es json')).toBeNull()
    expect(decidir({ texto: 'el plotter de corte', origen: FAK, sesion: 's1', vistos: {}, ahoraMs: T0, canon: null }).renglones).toEqual([])
  })
})

describe('recordatorio-temas: una vez por hora, por tema y por sesion', () => {
  test('el mismo tema no sale dos veces en la hora en la misma sesion; en otra sesion si; pasada la hora vuelve', () => {
    const a = decidir({ texto: 'el plotter de corte', origen: FAK, sesion: 's1', vistos: {}, ahoraMs: T0, canon })
    expect(a.renglones.map((r) => r.id)).toContain('plotter-aol')
    const b = decidir({ texto: 'el plotter de corte', origen: FAK, sesion: 's1', vistos: a.vistos, ahoraMs: T0 + 30 * 60_000, canon })
    expect(b.renglones).toEqual([])
    expect(b.silenciados).toContain('plotter-aol')
    const otra = decidir({ texto: 'el plotter de corte', origen: FAK, sesion: 's2', vistos: a.vistos, ahoraMs: T0 + 30 * 60_000, canon })
    expect(otra.renglones.map((r) => r.id)).toContain('plotter-aol')
    const luego = decidir({ texto: 'el plotter de corte', origen: FAK, sesion: 's1', vistos: a.vistos, ahoraMs: T0 + 61 * 60_000, canon })
    expect(luego.renglones.map((r) => r.id)).toContain('plotter-aol')
  })

  test('un mensaje sin tema no gasta la hora, y lo de mas de 24 h se poda', () => {
    const a = decidir({ texto: 'dale', origen: FAK, sesion: 's1', vistos: { viejo: { x: T0 - 25 * 3600_000 } }, ahoraMs: T0, canon })
    expect(a.vistos).toEqual({})
  })

  test('como mucho max_temas_por_mensaje renglones, lo especifico primero', () => {
    const t = temasDelTexto('el plotter de corte, la hotmelera, el tornillo y la impresora 3d', canon)
    expect(t.length).toBeLessThanOrEqual(canon.maxTemas)
    expect(temasDelTexto('ese plotter no, el plotter de corte', canon)[0].id).toBe('plotter-aol')
  })
})

describe('recordatorio-temas: el canon', () => {
  test('cada tema tiene id unico, nombre, archivos con forma de memoria y frases', () => {
    const vistos = new Set()
    for (const t of canon.temas) {
      expect(vistos.has(t.id)).toBe(false)
      vistos.add(t.id)
      expect(t.nombre.length).toBeGreaterThan(3)
      for (const a of t.archivos) expect(a).toMatch(/^(feedback|project|reference)_[\w.-]+\.md$/)
      expect(t.frases.length).toBeGreaterThan(0)
    }
  })

  // La carpeta de memoria vive fuera del repo: en el CI no esta y la prueba no aplica.
  const MEM = path.join(os.homedir(), '.claude', 'projects', 'C--Dev-BarackMercosul', 'memory')
  test.skipIf(!fs.existsSync(path.join(MEM, 'MEMORY.md')))('cada archivo del canon existe en la memoria y esta nombrado en MEMORY.md', () => {
    const indice = fs.readFileSync(path.join(MEM, 'MEMORY.md'), 'utf8')
    for (const t of canon.temas) for (const a of t.archivos) {
      expect(fs.existsSync(path.join(MEM, a)), a).toBe(true)
      expect(indice.includes(a), a).toBe(true)
    }
  })
})
