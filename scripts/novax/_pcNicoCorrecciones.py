# -*- coding: utf-8 -*-
"""_pcNicoCorrecciones.py — aplica sobre una COPIA del plan de control de puertas Patagonia de Nicolas Perez
(PC APB PATAGONIA Rev 0.xls, mail del 05/10/2026 15:37) solo las correcciones que tienen fuente escrita.

    py -3 scripts/novax/_pcNicoCorrecciones.py            # prueba: dice que cambiaria, no guarda
    py -3 scripts/novax/_pcNicoCorrecciones.py --apply    # guarda la copia corregida

Cada celda que cambia queda en amarillo y con un comentario que dice lo que tenia ANTES (pedido de Fak,
06/10/2026: "si pones una nota poneme el antes"; la fuente queda escrita en este archivo). Donde se sacaron
filas, la celda de arriba queda en naranja con el texto de las filas que se sacaron. Antes de
escribir, cada celda tiene que tener el texto viejo esperado: si Nicolas ya la cambio, se saltea y se avisa.
Lo que necesita filas nuevas (operaciones que faltan) no se toca: va a la lista para la reunion con Nicolas.

Fuentes:
  ARB   = export del arb del 05/10/2026 (RELACIONES.TXT / ARTICULO.TXT)
  COST  = "Costura Patagonia - valores y evidencia 05-10-2026 simple.pptx" (mail de Fak a Nicolas, 05/10 10:03)
  FLUJ  = flujograma 153 Rev.E (05/10/2026) y AMFE 161 con la misma numeracion
  HO971 = HO-971 vigente (APB de puerta), segun la revision de Ingenieria del 01/10/2026
  CARLOS= mail de Carlos Baptista 05/10/2026 16:13 ("por ahora caja de carton") -> ficha GE-280
  AMFE162 = flujograma 155 Rev.C y AMFE 162 (Top Roll): 60 refuerzos, 70 tweeter
  HOTMELT = receta de la maquina hot melt leida en pantalla (memoria reference_maquina_hotmelt_parametros)
"""
import os
import shutil
import sys

import win32com.client as w

AQUI = os.path.dirname(os.path.abspath(__file__))
BASE = os.path.abspath(os.path.join(AQUI, '..', '..', 'exports', 'PC_NICO_20261006'))
ORIGEN = os.path.join(BASE, 'original', 'PC APB PATAGONIA Rev 0.xls')
DESTINO = os.path.join(BASE, 'PC APB PATAGONIA Rev 0 - correcciones de Ingenieria 06-10-2026.xls')

F = {
    'ARB': 'arb, export del 05/10/2026',
    'COST': 'valores de costura enviados a Nicolas el 05/10/2026 (norma VW LAH.000.881.N v6)',
    'CUCH': 'manual de la mesa de corte Yin, pags. 52-53 (enviado el 05/10/2026)',
    'FLUJ': 'flujograma 153 Rev.E del 05/10/2026 (mail a Nicolas del 06/10)',
    'HO971': 'HO-971 vigente del APB de puerta',
    'CARLOS': 'Carlos Baptista, mail del 05/10/2026: caja de carton (ficha GE-280)',
    'TR': 'flujograma 155 Rev.C y AMFE 162: 60 refuerzos, 70 tweeter',
    'HM': 'receta de la maquina hot melt leida en pantalla',
    'OTRA': 'controles de inyeccion de PU: el Insert no lleva PU',
    'VISTA1': 'flujograma 153 y HO-971: la costura vista es de 1 sola linea',
}

# (celda, texto viejo que tiene que contener, valor nuevo o (viejo_sub, nuevo_sub), fuente)
APB = [
    ('B6', 'DE PARTE', 'Nº DE PARTE : N 231 / N 267 / N 297 / N 328', 'ARB'),
    ('A65', '', 'N 231 / N 267 / N 297 / N 328', 'ARB'),
    # Auditoria del 06/10: el color se deja como estaba (el arb corta la descripcion y no lo dice; la
    # HO-971 dice Jet Black para el hilo de union). Solo cambia el codigo, que manda el arb.
    # El hilo vista (E85) no se toca: VW nombra Carbon Black y el arb y la HO-971 compran Jet Black.
    ('E77', '427-VIN-009', 'Vinilo de tapizado\nPVC Texture PR022\nCarbon Black (codigo\nVIN-SKM-001)', 'ARB'),
    ('E82', '427-HIL-001', 'Hilo de union 30/3\nJet Black (codigo\nFX284-E0PTO)', 'ARB'),
    ('H109', 'DK840400', 'DK/1840400', 'ARB'),
    ('H114', '5 - 8 mm', ('5 - 8 mm', '4 mm minimo'), 'CUCH'),
    ('I114', 'MC213', 'Calibre MC167', 'CUCH'),
    ('B122', 'Apoyabrazos delantero', ('Apoyabrazos delantero', 'APB de puerta (del. y tras.)'), 'FLUJ'),
    ('H132', '427-HIL-001', 'Hilo de union 30/3 Jet Black (codigo FX284-E0PTO)', 'ARB'),
    ('H151', '4 mm', '4 mm  (+/- 0,5)', 'COST'),
    ('H157', 'HIL-005', None, 'HO971'),      # se le agrega la bobina 30/3 (HO-971 hoja 41)
    ('H160', '', 'Delantero 120 ± 5 g\nTrasero 115 ± 5 g', 'HO971'),
    ('H165', 'Controlar dimensional cotas',
     'Cota index: delantero 214 ±1 mm / trasero 173,5 ±1 mm, medida a los 20 min de inyectada', 'HO971'),
    ('A166', 'Operación 60', 'Operación 70', 'FLUJ'),
    ('A184', 'Operación 70', 'Operación 80', 'FLUJ'),
    ('A191', 'Operación 80-82', 'Operación 90-93', 'FLUJ'),
    ('A203', 'Operación 90', 'Operación 100', 'FLUJ'),
    ('A211', '', 'Operación 110', 'FLUJ'),
    ('E211', 'TBD', 'Caja de carton, ficha GE-280 (24 piezas por caja)', 'CARLOS'),
]
APB_BORRAR = [(147, 148, 'Paralelismo entre costuras', 'VISTA1')]

INS = [
    ('B6', 'DE PARTE', 'Nº DE PARTE : N 227 / N 389 a N 403', 'ARB'),
    ('A65', '', 'N 227 / N 389 a N 403', 'ARB'),
    ('E122', 'DK/1840400', ('DK/1840400', 'DK/1840600'), 'ARB'),
    ('H122', 'DK840400', 'DK/1840600', 'ARB'),
    ('H127', '5 - 8 mm', ('5 - 8 mm', '4 mm minimo'), 'CUCH'),
    ('I127', 'MC213', 'Calibre MC167', 'CUCH'),
    ('C133', 'costura recta', 'Maquina de costura CNC', 'FLUJ'),
    ('H141', 'Aguja Correcta', 'Aguja Correcta\nN° 22 (Groz-Beckert 134-35 S)', 'COST'),
    ('H143', 'FX483TK', None, 'COST'),          # se le agrega la bobina (ver abajo)
    ('H145', '2 x 3', '3 a 4 puntadas, una vez atras y una adelante', 'COST'),
    ('H149', '', '4 en 16 mm  (+/- 1)', 'COST'),
]
INS_BORRAR = [(172, 179, 'Peso', 'OTRA')]

TR = [
    ('B6', 'DE PARTE', 'Nº DE PARTE : N 216 / N 256 / N 285 / N 315', 'ARB'),
    ('A65', '', 'N 216 / N 256 / N 285 / N 315', 'ARB'),
    ('H91', 'DK840400', 'DK/1840400', 'ARB'),
    ('H135', 'Cantidad de grampas', 'Cantidad de grampas: 27 delantero / 34 trasero.\nSin daño por grampas', 'ARB'),
]

AMARILLO = 65535  # RGB(255,255,0) en BGR
NARANJA = 49407   # RGB(255,192,0) en BGR


def texto(c):
    v = c.MergeArea.Cells(1, 1).Value
    if v is None:
        return ''
    if isinstance(v, float) and v.is_integer():
        return str(int(v))
    return str(v)


def marcar(c, nota, color=AMARILLO):
    m = c.MergeArea
    m.Interior.Color = color
    m.Cells(1, 1).ClearComments()
    m.Cells(1, 1).AddComment(nota)


def antes(txt):
    txt = txt.replace('\r', '').strip()
    return 'ANTES: ' + (txt if txt else '(vacia)')


def aplicar_celdas(ws, lista, apply, informe):
    for celda, viejo, nuevo, fuente in lista:
        c = ws.Range(celda)
        actual = texto(c).replace('\r', '')
        if viejo and viejo not in actual:
            informe.append(f'  SALTEADA {ws.Name.strip()}!{celda}: esperaba "{viejo}" y dice "{actual[:60]}"')
            continue
        if not viejo and actual.strip():
            informe.append(f'  SALTEADA {ws.Name.strip()}!{celda}: esperaba vacia y dice "{actual[:60]}"')
            continue
        if nuevo is None:                      # Insert H143: se agrega la bobina
            nuevo = actual.rstrip(' /\n') + '\nBobina: hilo 30/3 (FX284-E0PTO)'
        elif isinstance(nuevo, tuple):
            nuevo = actual.replace(nuevo[0], nuevo[1])
        informe.append(f'  {ws.Name.strip()}!{celda}: "{actual[:50]}" -> "{nuevo[:70]}"')
        if apply:
            # la letra la da la columna del plan de reaccion de la misma fila (igual en toda la hoja)
            ref = ws.Cells(c.Row, 14).Font
            nombre, tam = ref.Name, ref.Size
            c.MergeArea.Cells(1, 1).Value = nuevo
            if nombre:
                c.MergeArea.Font.Name = nombre
            if tam and c.Row > 70:
                c.MergeArea.Font.Size = tam
            if fuente == 'OTRA_TEXTO':
                continue
            marcar(c, antes(actual))


def borrar_filas(ws, lista, apply, informe):
    for desde, hasta, clave, fuente in sorted(lista, reverse=True):
        txt = ' '.join(texto(ws.Range(f'{col}{r}')) for r in range(desde, hasta + 1) for col in 'EH')
        if clave not in txt:
            informe.append(f'  SALTEADO borrar {ws.Name.strip()} filas {desde}-{hasta}: no encuentro "{clave}"')
            continue
        informe.append(f'  {ws.Name.strip()}: borro filas {desde}-{hasta} ({F[fuente]})')
        if apply:
            sacado = ' / '.join(t for t in (texto(ws.Range(f'{col}{r}')).replace('\r', '').replace('\n', ' ').strip()
                                            for r in range(desde, hasta + 1) for col in 'DEFHIJKLM') if t)
            ws.Rows(f'{desde}:{hasta}').Delete()
            marcar(ws.Range(f'H{desde - 1}'), f'SE SACARON {hasta - desde + 1} FILAS DEBAJO DE ESTA. Decian: {sacado}',
                   NARANJA)


def top_roll_orden(ws, apply, informe):
    """60 = soldadura de refuerzos, 70 = soldadura de tweeter: el bloque de refuerzos sube arriba."""
    a123, a128 = texto(ws.Range('A123')), texto(ws.Range('A128'))
    b124, b129 = texto(ws.Range('B124')), texto(ws.Range('B129'))
    if not ('60' in a123 and 'TWEETER' in b124.upper() and '70' in a128 and 'REFUERZOS' in b129.upper()):
        informe.append(f'  SALTEADO orden Top Roll: A123="{a123}" B124="{b124[:30]}" A128="{a128}"')
        return
    informe.append('  PC  Top Roll: el bloque de refuerzos (filas 128-131) sube antes del de tweeter; '
                   'refuerzos = Operación 60, tweeter = Operación 70')
    if apply:
        ws.Rows('128:131').Cut()
        ws.Rows('123').Insert()
        ws.Range('A123').MergeArea.Cells(1, 1).Value = 'Operación 60'
        marcar(ws.Range('A123'), 'ANTES: Operación 70, y este bloque (refuerzos) iba debajo del de tweeter')
        # el bloque de tweeter trae abajo la linea doble que separaba la 60 de la 70: entre la 70 y el
        # control final (80) el original tenia linea fina en toda la fila
        borde = ws.Range('A131:N131').Borders(9)          # xlEdgeBottom
        borde.LineStyle, borde.Weight = 1, 2              # continua, fina
        ws.Range('A127').MergeArea.Cells(1, 1).Value = 'Operación 70'
        marcar(ws.Range('A127'), 'ANTES: Operación 60, y este bloque (tweeter) iba arriba del de refuerzos')


def medidas(ws):
    ultima = ws.UsedRange.Row + ws.UsedRange.Rows.Count - 1
    return ([ws.Rows(r).RowHeight for r in range(1, ultima + 1)],
            [ws.Columns(c).ColumnWidth for c in range(1, 17)])


def fila_vieja_top_roll(r):
    """Fila del original que ocupa hoy la fila r, despues de subir el bloque de refuerzos (128-131)."""
    if r == 123:
        return 128
    if 124 <= r <= 126:
        return r + 5
    if r == 127:
        return 123
    if 128 <= r <= 131:
        return r - 4
    return r


def reponer_medidas(ws, med, fila_vieja, editadas_viejas):
    altos, anchos = med
    for c, ancho in enumerate(anchos, start=1):
        if ws.Columns(c).ColumnWidth != ancho:
            ws.Columns(c).ColumnWidth = ancho
    for r in range(1, len(altos) + 1):
        vieja = fila_vieja(r)
        if vieja > len(altos) or vieja in editadas_viejas:
            continue
        if ws.Rows(r).RowHeight != altos[vieja - 1]:
            ws.Rows(r).RowHeight = altos[vieja - 1]


def main():
    apply = '--apply' in sys.argv
    if apply:
        shutil.copyfile(ORIGEN, DESTINO)
    xl = w.DispatchEx('Excel.Application')
    xl.Visible = False
    xl.DisplayAlerts = False
    informe = []
    try:
        wb = xl.Workbooks.Open(DESTINO if apply else ORIGEN, 0, not apply)
        hojas = {s.Name.strip(): s for s in wb.Worksheets}
        apb, ins, tr = hojas['PC APB'], hojas['PC INSERTO'], hojas['PC  Top Roll']
        # Alto de filas y ancho de columnas del original: Excel los recalcula al guardar (la auditoria del
        # 06/10 vio la fila 10 del encabezado de 435 a 276 twips) y se reponen al final, salvo en las filas
        # cuyo texto cambio, que se dejan con el alto que Excel les da para que el texto nuevo entre.
        med = {h.Name: medidas(h) for h in (apb, ins, tr)}
        aplicar_celdas(apb, APB, apply, informe)
        borrar_filas(apb, APB_BORRAR, apply, informe)
        aplicar_celdas(ins, INS, apply, informe)
        borrar_filas(ins, INS_BORRAR, apply, informe)
        aplicar_celdas(tr, TR, apply, informe)
        top_roll_orden(tr, apply, informe)
        if apply:
            for h, lista, viejo in ((apb, APB, lambda r: r if r < 147 else r + 2),
                                    (ins, INS, lambda r: r if r < 172 else r + 8),
                                    (tr, TR, fila_vieja_top_roll)):
                reponer_medidas(h, med[h.Name], viejo, {int(''.join(ch for ch in c if ch.isdigit())) for c, *_ in lista})
            wb.Save()
        wb.Close(False)
    finally:
        xl.Quit()
    print('\n'.join(informe))
    print(f'\n{"GUARDADO: " + DESTINO if apply else "PRUEBA: no se guardo nada (--apply para guardar)"}')
    n_salt = sum(1 for l in informe if 'SALTEAD' in l)
    print(f'{len(informe) - n_salt} cambios, {n_salt} salteados')


if __name__ == '__main__':
    main()
