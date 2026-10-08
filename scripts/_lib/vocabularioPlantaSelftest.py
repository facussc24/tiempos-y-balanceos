# -*- coding: utf-8 -*-
"""
Selftest del control de vocabulario de planta, en ROJO y en VERDE.

Un control que no puede dar rojo esta tan roto como el que no puede dar verde. Cada ROJO de aca es una
frase que Fak rechazo o un caso que la lista blanca tiene que frenar; cada VERDE es un texto REAL de
una hoja de operaciones de Barack (sacado de Y:\\...\\HOJAS DE OPERACIONES\\, modificada antes del
01/08/2026) o un caso que el control no debe tocar (codigos de pieza, unidades, palabras con fuente).

Corre con: python scripts/_vocabularioPlanta.py --selftest
Lo corre tambien vitest: __tests__/scripts/vocabularioPlanta.test.mjs
"""
from __future__ import annotations

import json
import os
import sys
import tempfile

AQUI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, AQUI)
import vocabulario_planta as vp  # noqa: E402

malos = 0
corridos = 0


def caso(nombre, ok, detalle=''):
    global malos, corridos
    corridos += 1
    if not ok:
        malos += 1
    print(f'  {"ok  " if ok else "MAL "}  {nombre}' + (f'   [{detalle}]' if detalle and not ok else ''))


def palabras_afuera(texto, ruta=vp.DATOS):
    return sorted({h['palabra'] for h in vp.revisar_textos([('t', texto)], ruta)})


def con_datos_temporales(mutar):
    """Copia el data.json, le aplica `mutar(dict)` y devuelve la ruta del temporal."""
    with open(vp.DATOS, encoding='utf-8') as f:
        d = json.load(f)
    mutar(d)
    fd, ruta = tempfile.mkstemp(suffix='.json', prefix='vocabulario_selftest_')
    with os.fdopen(fd, 'w', encoding='utf-8') as f:
        json.dump(d, f, ensure_ascii=False)
    return ruta


# Texto REAL de hojas de operaciones de Barack (HO 933 REV2 y otras del servidor).
HO_REAL = [
    'Colocar Lamina PEAD dentro del porta bobina.',
    'A través del panel de comando cerrar porta bobina.',
    'Hacer tope de la bobina sobre la izquierda hasta que la misma no presente juego.',
    'Seleccionar programa de corte según el ancho de la bobina que se desee cortar.',
    'Finalizado el corte destrabar porta bobina y retirar los rollos fraccionados.',
    'Verificar que la pieza coincida con la forma con el troquel.',
    'PLAN DE REACCION ANTE NO CONFORME. DE INMEDIATO A SU LIDER O SUPERVISOR',
    'Caracteristicas a controlar. Control visual de pantalla. Recepción de materia prima.',
]


def correr():
    print('\nROJO: lo que la lista blanca tiene que frenar\n')
    # 1. el caso que origino todo (Fak, 08/10/2026)
    txt = 'RESTITUCION DE CONTROL DE MATERIA PRIMA (IQC) CON CUARENTENA'
    fuera = palabras_afuera(txt)
    caso('el flujograma que Fak rechazo da rojo', bool(fuera), f'salio {fuera}')
    caso('...y nombra a iqc', 'iqc' in fuera, f'salio {fuera}')
    caso('...y nombra a restitucion', 'restitucion' in fuera, f'salio {fuera}')
    h = vp.revisar_textos([('flow[3].description', txt)])
    caso('...y cada palabra dice DONDE esta', all(x['donde'] == 'flow[3].description' for x in h))
    caso('...y la prohibida a mano lo dice como prohibida', {x['palabra']: x['motivo'] for x in h}.get('iqc') == 'prohibida')
    # 2. jerga que nadie penso en prohibir: lo que la lista negra no atrapa
    caso('jerga de oficina que nadie prohibio da rojo',
         {'sinergico', 'paradigma'} <= set(palabras_afuera('Paradigma sinergico de gobernanza holistica')))
    caso('una sigla inventada da rojo', 'xqz' in palabras_afuera('Control XQZ de la pieza'))
    # 3. las prohibidas que ya existian siguen siendo rojo (hojas de proceso y candado del AMFE)
    r = vp.revisar_textos([('t', 'Apretar la seta de emergencia')])
    caso('"seta" (vocabulario de las hojas) da rojo con su reemplazo',
         any(x['motivo'] == 'prohibida' and 'parada de emergencia' in x['reemplazo'] for x in r))
    r = vp.revisar_textos([('t', 'Medir con flexometro')])
    caso('"flexometro" (candado del AMFE) da rojo', any(x['motivo'] == 'prohibida' for x in r))
    r = vp.revisar_textos([('t', 'Tirar al contenedor de rechazo')])
    caso('"contenedor de rechazo" (varias palabras) da rojo',
         any(x['motivo'] == 'prohibida' and x['reemplazo'] == 'cajon de scrap' for x in r))
    # 4. la prohibida le gana al corpus y a la aprobada
    ruta = con_datos_temporales(lambda d: (d['corpus'].__setitem__('pieza', [5, 5, 5]),
                                           d['aprobadas'].__setitem__('pieza', {'fuente': 'x'}),
                                           d['prohibidas'].__setitem__('pieza', {'reemplazo': 'parte', 'nota': 'n', 'fuente': 'f'})))
    try:
        vp._cache.clear()
        r = vp.revisar_textos([('t', 'Colocar la pieza')], ruta)
        caso('una prohibida le gana al corpus y a las aprobadas', any(x['palabra'] == 'pieza' and x['motivo'] == 'prohibida' for x in r))
    finally:
        os.remove(ruta)
        vp._cache.clear()
    # 5. sin fuente no entra
    for seccion in ('aprobadas', 'prohibidas'):
        ruta = con_datos_temporales(lambda d, s=seccion: d[s].__setitem__('palabraxx', {'nota': 'sin fuente'}))
        try:
            vp._cache.clear()
            try:
                vp.cargar(ruta)
                caso(f'una entrada de {seccion} sin fuente rompe la carga', False)
            except ValueError:
                caso(f'una entrada de {seccion} sin fuente rompe la carga', True)
        finally:
            os.remove(ruta)
            vp._cache.clear()

    print('\nVERDE: lo que Barack escribe de verdad tiene que pasar\n')
    for t in HO_REAL:
        f = palabras_afuera(t)
        caso(f'HO real: "{t[:60]}"', not f, f'fuera: {f}')
    caso('codigos de pieza, numeros y unidades no se miran',
         not palabras_afuera('2HC.858.417 N 231 MP8147 21-9689 OP 10 OP-20.1 I-IN-002.4-R01 10mm 5 kg 2 bar 180 rpm'))
    caso('un numero pegado a letras es codigo, no palabra', not palabras_afuera('Pieza 2HC.858.417.A PN4455XQ'))
    caso('fechas, porcentajes y rangos no se miran', not palabras_afuera('08/10/2026 85% 3,5 - 4,5 mm +/- 0,2'))
    caso('plural y genero cuentan como la misma palabra',
         not palabras_afuera('Colocar las bobinas y retirar los rollos fraccionados'))
    caso('mayusculas y tildes no importan', not palabras_afuera('RECEPCIÓN DE MATERIA PRIMA'))
    caso('una URL o un mail no se miran', not palabras_afuera('ver https://www.xqzkwv.com/abc o escribir a juan@xqzkwv.com'))

    # 6. una palabra aprobada con fuente pasa, y la misma sin aprobar no
    ruta = con_datos_temporales(lambda d: d['aprobadas'].__setitem__(
        'xqzterm', {'fuente': 'Selftest: documento ficticio de prueba'}))
    try:
        vp._cache.clear()
        caso('antes de aprobarla, la palabra nueva da rojo', 'xqzterm' in palabras_afuera('Colocar xqzterm'))
        caso('aprobada con fuente, pasa', not palabras_afuera('Colocar xqzterm', ruta))
        caso('aprobada, tambien en plural', not palabras_afuera('Colocar xqzterms', ruta))
    finally:
        os.remove(ruta)
        vp._cache.clear()

    # 7. el umbral de Fak: una palabra que Fak dijo una sola vez (o quoteando a Claude) no alcanza
    ruta = con_datos_temporales(lambda d: (d['reglas'].__setitem__('min_mensajes_fak', 3),
                                           d['corpus'].__setitem__('xqzsolofakuno', [0, 0, 1]),
                                           d['corpus'].__setitem__('xqzsolofaknueve', [0, 0, 9]),
                                           d['corpus'].__setitem__('xqzenho', [1, 0, 0])))
    try:
        vp._cache.clear()
        caso('una palabra dicha por Fak una vez no alcanza', 'xqzsolofakuno' in palabras_afuera('xqzsolofakuno', ruta))
        caso('una dicha en muchos mensajes de Fak alcanza', not palabras_afuera('xqzsolofaknueve', ruta))
        caso('una que esta en una hoja de operaciones alcanza', not palabras_afuera('xqzenho', ruta))
    finally:
        os.remove(ruta)
        vp._cache.clear()

    # 8. tokenizacion: exactamente lo que dice el docstring (el gemelo JS lo repite)
    caso('palabras(): sin tildes, sin codigos, partidas por guion',
         vp.palabras('Pre-armado de CÓDIGO MP8147 y 2HC.858.417, pieza N° 231') == ['pre', 'armado', 'de', 'codigo', 'pieza'])
    caso('palabras(): la enie es n', vp.palabras('diseño año') == ['diseno', 'ano'])
    caso('variantes(): operaciones -> operacion, controles -> control',
         {'operacion', 'control'} <= vp.variantes('operaciones') | vp.variantes('controles'))

    print(f'\n{corridos} casos corridos, {malos} fallan.')
    if malos:
        print('selftest vocabularioPlanta: HAY FALLAS')
        return 1
    print('selftest vocabularioPlanta: todo verde')
    return 0


if __name__ == '__main__':
    for _f in (sys.stdout, sys.stderr):
        try:
            _f.reconfigure(encoding='utf-8', errors='replace')
        except Exception:
            pass
    sys.exit(correr())
