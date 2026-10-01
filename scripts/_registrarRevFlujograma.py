# -*- coding: utf-8 -*-
"""_registrarRevFlujograma.py — anota la revision nueva de un flujograma en el Listado Maestro.

Busca la fila por el numero de flujograma (columna B) y escribe SOLO dos celdas de esa fila:
M (revision) y N (fecha de revision). Si el numero no aparece, o aparece mas de una vez, aborta.

Se usa Excel por COM y no openpyxl: el libro tiene tablas y estilos que openpyxl rompe al
guardar. Excel se abre en una instancia PROPIA (DispatchEx): si Fak tiene otro Excel abierto,
no se lo toca ni se lo cierra. La fecha va como objeto fecha, nunca como texto.

Uso:  py -3 scripts/_registrarRevFlujograma.py 153 D 01/10/2026            (muestra que haria)
      py -3 scripts/_registrarRevFlujograma.py 153 D 01/10/2026 --apply    (escribe)
"""
import datetime
import os
import sys

sys.stdout.reconfigure(encoding="utf-8")

args = [a for a in sys.argv[1:] if not a.startswith("--")]
APPLY = "--apply" in sys.argv
if len(args) != 3:
    sys.exit("Uso: py -3 scripts/_registrarRevFlujograma.py <numero> <revision> <dd/mm/aaaa> [--apply]")
ID, REV, FECHA_TXT = args[0], args[1].upper(), args[2]
FECHA = datetime.datetime.strptime(FECHA_TXT, "%d/%m/%Y")

LISTADO = (r"Y:\Ingenieria\Documentacion Gestion Ingenieria"
           "\\8. Flujograma Sinóptico (I-IN-002III)"
           r"\1. LISTADO DE FLUJOGRAMAS\Listado_Maestro_FLUJOGRMAS.xlsx")
HOJA = "Listado FLUJOGRAMAS"
COL_ID, COL_PRODUCTO, COL_REV, COL_FECHA_REV = 2, 3, 13, 14   # B, C, M, N

if not os.path.isfile(LISTADO):
    sys.exit(f"ERROR: no existe el listado {LISTADO}")

import win32com.client as win32

excel = win32.DispatchEx("Excel.Application")
excel.Visible = False
excel.DisplayAlerts = False
wb = None
try:
    wb = excel.Workbooks.Open(LISTADO, ReadOnly=not APPLY)
    if APPLY and wb.ReadOnly:
        raise RuntimeError("el listado se abrio en solo lectura (lo tiene abierto otra persona). No se escribe.")
    ws = wb.Worksheets(HOJA)
    ultima = ws.Cells(ws.Rows.Count, COL_ID).End(-4162).Row          # xlUp
    filas = [f for f in range(1, ultima + 1)
             if str(ws.Cells(f, COL_ID).Value or "").split(".")[0].strip() == ID]
    if len(filas) != 1:
        raise RuntimeError(f"el {ID} aparece {len(filas)} veces en la columna B (filas {filas}). No se toca nada.")
    fila = filas[0]

    print(f"Fila {fila} — como esta hoy:")
    for col, et in ((COL_ID, "B numero"), (COL_PRODUCTO, "C producto"), (COL_REV, "M revision"),
                    (COL_FECHA_REV, "N fecha rev")):
        print(f"   {et:<12} = {ws.Cells(fila, col).Value!r}")
    print("\nLo que se escribe:")
    print(f"   M{fila} revision  = {REV}")
    print(f"   N{fila} fecha rev = {FECHA:%d/%m/%Y}")

    if not APPLY:
        print("\nPRUEBA EN SECO. Con --apply se escribe.")
    else:
        ws.Cells(fila, COL_REV).Value = REV
        ws.Cells(fila, COL_FECHA_REV).Value = FECHA
        wb.Save()
        print("\nGUARDADO. Relectura:")
        for col, et in ((COL_REV, "M revision"), (COL_FECHA_REV, "N fecha rev")):
            print(f"   {et:<12} = {ws.Cells(fila, col).Value!r}")
finally:
    if wb is not None:
        wb.Close(SaveChanges=False)
    excel.Quit()
