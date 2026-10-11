import { describe, expect, test } from 'vitest'
import { COOLDOWN_MS, RECORDATORIO, decidirRecordatorio, tocaElTema } from '../../mods/recordatorio-ccsc/hooks/recordatorio.mjs'

const T0 = 1_760_000_000_000

describe('recordatorio CC/SC', () => {
  test('detecta siglas y flujogramas, no el resto', () => {
    expect(tocaElTema('revisa las siglas CC y SC del AMFE 173')).toBe(true)
    expect(tocaElTema('actualiza el flujograma de la op. 40')).toBe(true)
    expect(tocaElTema('corre ccusage y lista los archivos')).toBe(false)
  })

  test('sale una vez y no dos dentro de la misma hora; vuelve a salir pasada la hora', () => {
    const primera = decidirRecordatorio('poner CC en la causa 12', 0, T0)
    expect(primera.emitir).toBe(true)
    expect(primera.ultimoMs).toBe(T0)
    const segunda = decidirRecordatorio('sacar la SC de la causa 13', primera.ultimoMs, T0 + 30 * 60_000)
    expect(segunda.emitir).toBe(false)
    expect(segunda.toca).toBe(true)
    expect(segunda.minutosRestantes).toBe(30)
    const tercera = decidirRecordatorio('flujograma rev. B', segunda.ultimoMs, T0 + COOLDOWN_MS + 1)
    expect(tercera.emitir).toBe(true)
    expect(RECORDATORIO).toContain('S = 9 o 10')
  })

  test('un texto que no toca el tema no consume el cooldown', () => {
    const d = decidirRecordatorio('lista los archivos', 0, T0)
    expect(d.toca).toBe(false)
    expect(d.emitir).toBe(false)
    expect(d.ultimoMs).toBe(0)
  })
})
