"""
_planControlLimpio.py -- el plan de control que se entrega, mirado como lo miro Fak el 15/10/2026.

POR QUE EXISTE: LECCIONES 15/10 ("si se rearma entero va limpio: sin amarillo ni notas, una caracteristica
por fila, la D sola"; Fak: "todo amarillo con demasiadas notas... no me gusta", "¿por que no solo D?") y la
skill `planes-de-control` §5, puntos 3 a 6. El generador de los APC (`scripts/apc/_pcApcPatagonia.py`) ya
lo hacia por dentro; este chequeo mira el ARCHIVO que se entrega, lo haya armado quien lo haya armado.

  python scripts/_planControlLimpio.py <plan.xls|plan.xlsx> [--rearmado] [--definitivo]
  python scripts/_planControlLimpio.py --selftest

Siempre (cualquier plan de control, tambien las correcciones de pocas celdas):
  D_TLD          ROJO   la columna CLASIF. dice D/TLD o TLD: en el plan de control la marca critica es la D
                        sola, en rojo (§5 punto 5; el AMFE sigue escribiendo D/TLD)
  VARIAS_MARCAS  ROJO   dos marcas o mas en la misma celda de CLASIF.: una caracteristica por fila (§5 punto 4:
                        con varias en la misma celda se lee "SC SC SC")
  SIGLA_RARA     AVISO  una marca que no es D, SC ni CC (`caracteristicas-especiales.md` punto 5: no se adivina)
  CONFLICTO      ROJO   "CONFLICTO" adentro de una celda de la tabla, en cualquier modo (§5 punto 8 ter, Fak 22/10/2026: dos
                        papeles que no coinciden se resuelven buscando la decision y, si sigue la duda, preguntandole
                        a Fak; un plan que va a Calidad no muestra "CONFLICTO: 45 / 35")
Con --rearmado (el plan se rearmo entero, §5 punto 3):
  AMARILLO       ROJO   celda de la tabla (debajo del encabezado CLASIF.) con relleno amarillo
  NOTA           ROJO   comentario o nota en una celda de la tabla
Con --definitivo (implica --rearmado; §5 punto 6, Fak 15/10: "un plan de control verdadero sin esas cosas"):
  TBD            ROJO   TBD adentro de una celda de la tabla

Lo de arriba del encabezado (titulos, revisiones, firmas) no se mira: la plantilla de Calidad trae banners
amarillos. Sale con 1 si hay un ROJO, 0 si no, 2 si no se pudo leer el archivo o no tiene la columna CLASIF.
Solo lee: no escribe nada.
"""
import os
import re
import sys
import tempfile

MARCAS_VALIDAS = {'D', 'SC', 'CC'}
AMARILLOS = {'FFFF00'}                      # el amarillo puro con que se marcan las celdas cambiadas
RE_TLD = re.compile(r'\bTLD\b', re.I)
RE_TBD = re.compile(r'\bTBD\b', re.I)
RE_CONFLICTO = re.compile(r'\bCONFLICTO\b', re.I)


def _rgb6(valor):
    """'FFFFFF00' / '00FFFF00' / 'FFFF00' -> 'FFFF00'; cualquier otra cosa -> ''."""
    v = str(valor or '').upper()
    return v[-6:] if re.fullmatch(r'[0-9A-F]{6}([0-9A-F]{2})?', v) or re.fullmatch(r'[0-9A-F]{8}', v) else ''


def leer(ruta):
    """Devuelve una lista de hojas: {nombre, celdas: {(r, c): texto}, amarillas: set((r, c)), notas: set((r, c))}."""
    hojas = []
    if ruta.lower().endswith('.xls'):
        import xlrd  # solo para el formato viejo de Calidad; el CI no lo necesita
        libro = xlrd.open_workbook(ruta, formatting_info=True)
        for s in libro.sheets():
            celdas, amarillas = {}, set()
            for r in range(s.nrows):
                for c in range(s.ncols):
                    v = s.cell_value(r, c)
                    if str(v).strip():
                        celdas[(r, c)] = str(v)
                    xf = libro.xf_list[s.cell_xf_index(r, c)]
                    color = libro.colour_map.get(xf.background.pattern_colour_index)
                    if xf.background.fill_pattern and color == (255, 255, 0):
                        amarillas.add((r, c))
            hojas.append({'nombre': s.name, 'celdas': celdas, 'amarillas': amarillas, 'notas': set(s.cell_note_map)})
        return hojas
    import openpyxl
    libro = openpyxl.load_workbook(ruta)
    for s in libro.worksheets:
        celdas, amarillas, notas = {}, set(), set()
        for fila in s.iter_rows():
            for cel in fila:
                r, c = cel.row - 1, cel.column - 1
                if cel.value is not None and str(cel.value).strip():
                    celdas[(r, c)] = str(cel.value)
                relleno = cel.fill
                if relleno is not None and relleno.fill_type == 'solid' and _rgb6(relleno.fgColor.rgb) in AMARILLOS:
                    amarillas.add((r, c))
                if cel.comment is not None:
                    notas.add((r, c))
        hojas.append({'nombre': s.title, 'celdas': celdas, 'amarillas': amarillas, 'notas': notas})
    return hojas


def encabezado(celdas):
    """(fila, columna) del primer encabezado CLASIF., o None."""
    candidatos = sorted(k for k, v in celdas.items() if 'CLASIF' in v.upper())
    return candidatos[0] if candidatos else None


def marcas(texto):
    """'SC\\nSC' -> ['SC', 'SC']; 'D/TLD' -> ['D/TLD']."""
    return [t for t in re.split(r'[\s,;]+', texto.strip().upper()) if t]


def revisar(hojas, rearmado=False, definitivo=False):
    """Lista de hallazgos (nivel, codigo, hoja, celda, evidencia). Con ninguna hoja con CLASIF., un ERROR."""
    rearmado = rearmado or definitivo
    hallazgos, con_tabla = [], 0
    for h in hojas:
        enc = encabezado(h['celdas'])
        if not enc:
            continue
        con_tabla += 1
        fila0, col = enc
        nombre = h['nombre'].strip()
        celda = lambda r, c: f'{nombre}!{chr(65 + c) if c < 26 else c}{r + 1}'
        for (r, c), v in sorted(h['celdas'].items()):
            if r <= fila0:
                continue
            if c == col and 'CLASIF' not in v.upper():
                ms = marcas(v)
                if RE_TLD.search(v):
                    hallazgos.append(('ROJO', 'D_TLD', nombre, celda(r, c), v.replace('\n', ' / ')))
                if len(ms) > 1:
                    hallazgos.append(('ROJO', 'VARIAS_MARCAS', nombre, celda(r, c), v.replace('\n', ' / ')))
                for m in ms:
                    if m not in MARCAS_VALIDAS and not RE_TLD.search(m):
                        hallazgos.append(('AVISO', 'SIGLA_RARA', nombre, celda(r, c), m))
            if RE_CONFLICTO.search(v):
                hallazgos.append(('ROJO', 'CONFLICTO', nombre, celda(r, c), v.replace('\n', ' / ')[:80]))
            if definitivo and RE_TBD.search(v):
                hallazgos.append(('ROJO', 'TBD', nombre, celda(r, c), v.replace('\n', ' / ')[:80]))
        if rearmado:
            for (r, c) in sorted(h['amarillas']):
                if r > fila0:
                    hallazgos.append(('ROJO', 'AMARILLO', nombre, celda(r, c), h['celdas'].get((r, c), '')[:60]))
            for (r, c) in sorted(h['notas']):
                if r > fila0:
                    hallazgos.append(('ROJO', 'NOTA', nombre, celda(r, c), h['celdas'].get((r, c), '')[:60]))
    if not con_tabla:
        hallazgos.append(('ERROR', 'SIN_CLASIF', '-', '-', 'ninguna hoja tiene el encabezado CLASIF.: no parece un plan de control I-AC-005.1'))
    return hallazgos


def codigo_salida(hallazgos):
    if any(h[0] == 'ERROR' for h in hallazgos):
        return 2
    return 1 if any(h[0] == 'ROJO' for h in hallazgos) else 0


def main(argv):
    if '--selftest' in argv:
        return selftest()
    rutas = [a for a in argv if not a.startswith('--')]
    if len(rutas) != 1:
        print(__doc__)
        return 2
    try:
        hojas = leer(rutas[0])
    except Exception as e:  # el archivo no abre: no se juzga
        print(f'No pude leer {rutas[0]}: {e}')
        return 2
    hallazgos = revisar(hojas, rearmado='--rearmado' in argv, definitivo='--definitivo' in argv)
    modo = 'definitivo' if '--definitivo' in argv else 'rearmado' if '--rearmado' in argv else 'correccion'
    for nivel, cod, hoja, cel, ev in hallazgos[:200]:
        print(f'{nivel:5} {cod:13} {cel:22} {ev}')
    rojos = sum(1 for h in hallazgos if h[0] == 'ROJO')
    print(f'plan de control ({modo}): {rojos} ROJO · {sum(1 for h in hallazgos if h[0] == "AVISO")} AVISO')
    return codigo_salida(hallazgos)


# ---------------------------------------------------------------- selftest (sin archivos reales: el CI no los tiene)

def _plan(dir_, nombre, filas, amarillas=(), notas=(), banner_amarillo=False, con_clasif=True):
    import openpyxl
    from openpyxl.comments import Comment
    from openpyxl.styles import PatternFill
    amarillo = PatternFill('solid', fgColor='FFFF00')
    wb = openpyxl.Workbook()
    s = wb.active
    s.title = 'PC CENTRAL '
    s['A2'] = 'PLAN DE CONTROL'
    if banner_amarillo:
        s['A2'].fill = amarillo
    s.cell(row=5, column=7, value='CLASIF. CARAC.' if con_clasif else 'METODOS')
    for i, (clasif, espec) in enumerate(filas):
        s.cell(row=7 + i, column=5, value='Caracteristica')
        if clasif:
            s.cell(row=7 + i, column=7, value=clasif)
        if espec:
            s.cell(row=7 + i, column=8, value=espec)
    for i in amarillas:
        s.cell(row=7 + i, column=8).fill = amarillo
    for i in notas:
        s.cell(row=7 + i, column=8).comment = Comment('fuente + ANTES', 'F.Santoro')
    ruta = os.path.join(dir_, nombre + '.xlsx')
    wb.save(ruta)
    return ruta


def selftest():
    casos = []  # (nombre, ruta, flags, codigo esperado, codigos que tienen que aparecer)
    with tempfile.TemporaryDirectory() as d:
        limpio = _plan(d, 'limpio', [('D', '< 100 mm/min'), ('SC', '4 ± 1 mm'), ('', 'Visual')], banner_amarillo=True)
        casos += [
            ('limpio, correccion', limpio, [], 0, []),
            ('limpio con banner amarillo de la plantilla, definitivo', limpio, ['--definitivo'], 0, []),
            ('D/TLD en CLASIF.', _plan(d, 'dtld', [('D/TLD', '< 100 mm/min')]), [], 1, ['D_TLD']),
            ('dos SC en una celda', _plan(d, 'varias', [('SC\nSC', '4 ± 1 mm')]), [], 1, ['VARIAS_MARCAS']),
            ('sigla W', _plan(d, 'rara', [('W', '4 ± 1 mm')]), [], 0, ['SIGLA_RARA']),
        ]
        amar = _plan(d, 'amarillo', [('SC', '4 ± 1 mm')], amarillas=[0])
        nota = _plan(d, 'nota', [('SC', '4 ± 1 mm')], notas=[0])
        tbd = _plan(d, 'tbd', [('SC', 'TBD')])
        conf = _plan(d, 'conflicto', [('', 'CONFLICTO: 45 ± 5 kg/m³ (ficha) / 35 kg/m³ (arb)')])
        casos += [
            ('amarillo en la tabla, correccion de pocas celdas', amar, [], 0, []),
            ('amarillo en la tabla, rearmado', amar, ['--rearmado'], 1, ['AMARILLO']),
            ('nota en la tabla, correccion de pocas celdas', nota, [], 0, []),
            ('nota en la tabla, rearmado', nota, ['--rearmado'], 1, ['NOTA']),
            ('TBD, rearmado (version de trabajo)', tbd, ['--rearmado'], 0, []),
            ('TBD, definitivo', tbd, ['--definitivo'], 1, ['TBD']),
            ('CONFLICTO, correccion', conf, [], 1, ['CONFLICTO']),
            ('CONFLICTO, rearmado (version de trabajo)', conf, ['--rearmado'], 1, ['CONFLICTO']),
            ('sin columna CLASIF.', _plan(d, 'sin', [('SC', 'x')], con_clasif=False), [], 2, ['SIN_CLASIF']),
        ]
        malos = 0
        for nombre, ruta, flags, esperado, codigos in casos:
            hall = revisar(leer(ruta), rearmado='--rearmado' in flags, definitivo='--definitivo' in flags)
            sale = codigo_salida(hall)
            vistos = {h[1] for h in hall}
            ok = sale == esperado and set(codigos) <= vistos and (codigos or not [h for h in hall if h[0] != 'AVISO'])
            malos += not ok
            print(f'  {"ok" if ok else "MAL"}  {nombre}  esperado={esperado} salio={sale} codigos={sorted(vistos)}')
    print('selftest planControlLimpio: todo verde' if not malos else f'selftest planControlLimpio: {malos} MAL')
    return 1 if malos else 0


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
