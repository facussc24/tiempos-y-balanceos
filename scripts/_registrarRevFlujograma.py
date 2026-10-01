# -*- coding: utf-8 -*-
"""_registrarRevFlujograma.py — anota la revision nueva de un flujograma en el Listado Maestro.

Busca la fila por el numero de flujograma (columna B) y escribe SOLO dos celdas de esa fila:
M (revision) y N (fecha de revision). Antes de escribir comprueba que el encabezado de esas dos
columnas siga siendo "Revision actual" y "Fecha de revision": si alguien inserto una columna, no
escribe. Si el numero no aparece, o aparece mas de una vez, aborta.

Se usa Excel por COM y no openpyxl: el libro tiene tablas y estilos que openpyxl rompe al
guardar. Excel se abre en una instancia PROPIA (DispatchEx): si Fak tiene otro Excel abierto,
no se lo toca ni se lo cierra. La fecha va como numero de serie de Excel (un dia entero): por
COM un datetime sin zona queda corrido tres horas (asi estan las filas viejas, con 03:00).

Uso:  py -3 scripts/_registrarRevFlujograma.py 153 D 01/10/2026            (muestra que haria)
      py -3 scripts/_registrarRevFlujograma.py 153 D 01/10/2026 --apply    (escribe y relee del archivo)
"""
import datetime
import os
import re
import sys
import unicodedata

sys.stdout.reconfigure(encoding="utf-8")

args = [a for a in sys.argv[1:] if not a.startswith("--")]
APPLY = "--apply" in sys.argv
if len(args) != 3:
    sys.exit("Uso: py -3 scripts/_registrarRevFlujograma.py <numero> <revision> <dd/mm/aaaa> [--apply]")
ID, REV, FECHA_TXT = args[0], args[1].upper(), args[2]
if not re.fullmatch(r"[A-Z]{1,2}", REV):
    sys.exit(f"ERROR: la revision es una letra (I-IN-002 5.1), no {REV!r}")
FECHA = datetime.datetime.strptime(FECHA_TXT, "%d/%m/%Y")
SERIE = (FECHA - datetime.datetime(1899, 12, 30)).days

LISTADO = (r"Y:\Ingenieria\Documentacion Gestion Ingenieria"
           "\\8. Flujograma Sinóptico (I-IN-002III)"
           r"\1. LISTADO DE FLUJOGRAMAS\Listado_Maestro_FLUJOGRMAS.xlsx")
HOJA = "Listado FLUJOGRAMAS"
FILA_ENCABEZADO = 6
COL_ID, COL_PRODUCTO, COL_REV, COL_FECHA_REV = 2, 3, 13, 14   # B, C, M, N
ENCABEZADOS = {COL_ID: "id flujograma", COL_REV: "revision actual", COL_FECHA_REV: "fecha de revision"}

if not os.path.isfile(LISTADO):
    sys.exit(f"ERROR: no existe el listado {LISTADO}")


def plano(t):
    t = unicodedata.normalize("NFD", str(t or ""))
    return "".join(c for c in t if unicodedata.category(c) != "Mn").lower().strip()


def leer_fila(ws, fila):
    return {et: ws.Cells(fila, col).Text for col, et in ((COL_ID, "B numero"), (COL_PRODUCTO, "C producto"),
                                                         (COL_REV, "M revision"), (COL_FECHA_REV, "N fecha rev"))}


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
    for col, esperado in ENCABEZADOS.items():
        real = plano(ws.Cells(FILA_ENCABEZADO, col).Value)
        if not real.startswith(esperado):
            raise RuntimeError(f"el encabezado de la columna {col} dice {real!r} y esperaba {esperado!r}: "
                               "cambio la forma del listado. No se toca nada.")
    ultima = ws.Cells(ws.Rows.Count, COL_ID).End(-4162).Row          # xlUp
    filas = [f for f in range(FILA_ENCABEZADO + 1, ultima + 1)
             if str(ws.Cells(f, COL_ID).Value or "").split(".")[0].strip() == ID]
    if len(filas) != 1:
        raise RuntimeError(f"el {ID} aparece {len(filas)} veces en la columna B (filas {filas}). No se toca nada.")
    fila = filas[0]

    print(f"Fila {fila} — como esta hoy:")
    for et, v in leer_fila(ws, fila).items():
        print(f"   {et:<12} = {v}")
    print("\nLo que se escribe:")
    print(f"   M{fila} revision  = {REV}")
    print(f"   N{fila} fecha rev = {FECHA:%d/%m/%Y}")

    if not APPLY:
        print("\nPRUEBA EN SECO. Con --apply se escribe.")
    else:
        ws.Cells(fila, COL_REV).Value = REV
        ws.Cells(fila, COL_FECHA_REV).Value2 = SERIE
        wb.Save()
        wb.Close(SaveChanges=False)
        wb = None
        # relectura DEL ARCHIVO, no de la hoja que quedo en memoria
        wb = excel.Workbooks.Open(LISTADO, ReadOnly=True)
        print("\nGUARDADO. Relectura del archivo:")
        for et, v in leer_fila(wb.Worksheets(HOJA), fila).items():
            print(f"   {et:<12} = {v}")
finally:
    try:
        if wb is not None:
            wb.Close(SaveChanges=False)
    finally:
        excel.Quit()
