# -*- coding: utf-8 -*-
"""_registrarAmfe173.py — da de alta el AMFE 173 en el Listado Maestro de AMFEs.

El 173 es el proximo ID libre: el maximo cargado es 172 (INSONOS / DUCTOS, fila 72),
verificado el 21/09/2026 leyendo el listado. El numero se lee del listado, nunca del
nombre de un archivo (memoria `pieza_nueva_no_es_revision`).

Escribe UNA fila nueva copiando el formato de la ultima activa, y aborta si esa ultima
no es el 172 o si el 173 ya esta cargado. No toca ninguna otra fila.

Se usa COM (Excel) y no openpyxl a proposito: el libro tiene estilos que openpyxl no sabe
releer y reescribirlo le rompe el formato al listado entero.
Las fechas van como datetime, NUNCA como texto: por COM un "21/09/2026" string se
interpreta en formato ingles.

Uso:  py -3 scripts/_registrarAmfe173.py           (dry-run)
      py -3 scripts/_registrarAmfe173.py --apply   (escribe)
"""
import datetime
import os
import sys

sys.stdout.reconfigure(encoding="utf-8")

APPLY = "--apply" in sys.argv

LISTADO = (r"Y:\Ingenieria\Documentacion Gestion Ingenieria"
           r"\13. Analisis del modo de falla y sus efectos ( I-AC-005.3)"
           r"\1. LISTADO DE AMFES\Listado_Maestro_AMFE.xlsx")
HOJA = "Listado AMFE"

FILA_MODELO = 72       # 172 — INSONOS / DUCTOS, la ultima activa
FILA_NUEVA = 73
ID_MODELO = "172"
PRIMERA_FILA_DATOS = 7

UBICACION = (r"Y:\Ingenieria\Documentacion Gestion Ingenieria"
             r"\13. Analisis del modo de falla y sus efectos ( I-AC-005.3)"
             r"\2. AMFES DE PROCESO\SMRC\173 - APB P21 HILO NARANJA COSTURA SIMPLE")

# columna -> valor  (cabecera en la fila 6, verificada el 21/09/2026)
VALORES = {
    2:  173,                                             # ID AMFE
    3:  "Proceso (PFMEA)",                               # Tipo
    4:  "APB P21 HILO NARANJA COSTURA SIMPLE",           # Producto / Componente
    5:  "00257327-01-NHZD / 00257328-01-NHZD",           # Codigo de pieza (PN)
    6:  "SMRC",                                          # Cliente
    7:  "P21 SSRT MY2026",                               # Proyecto
    8:  "PLANTA HURLINGHAM",                             # Planta / Proceso / Linea
    9:  UBICACION,                                       # Ubicacion / Link
    10: "En revisión",                                   # Estado
    11: "Carlos Baptista",                               # Propietario / Responsable
    13: datetime.datetime(2026, 9, 21),                  # Fecha de creacion
    14: "A",                                             # Revision actual
    15: datetime.datetime(2026, 9, 21),                  # Fecha de revision (ultima)
}

import win32com.client as win32

excel = win32.gencache.EnsureDispatch("Excel.Application")
excel.Visible = False
excel.DisplayAlerts = False
wb = None
try:
    wb = excel.Workbooks.Open(LISTADO)
    ws = wb.Worksheets(HOJA)

    modelo = str(ws.Cells(FILA_MODELO, 2).Value or "").split(".")[0]
    if modelo != ID_MODELO:
        raise RuntimeError(f"la fila {FILA_MODELO} no es el {ID_MODELO}: B{FILA_MODELO}={modelo!r}. No se toca nada.")

    # que el 173 no este ya cargado en ningun lado
    for r in range(PRIMERA_FILA_DATOS, 300):
        v = str(ws.Cells(r, 2).Value or "").split(".")[0]
        if v == "173":
            raise RuntimeError(f"el 173 YA esta cargado en la fila {r}. No se duplica.")

    print(f"Fila modelo {FILA_MODELO} (el {ID_MODELO}): {ws.Cells(FILA_MODELO, 4).Value!r}")
    print(f"Fila {FILA_NUEVA} hoy: B={ws.Cells(FILA_NUEVA, 2).Value!r}  D={ws.Cells(FILA_NUEVA, 4).Value!r}")
    print("\nLo que se va a escribir en la fila", FILA_NUEVA)
    cab = {c: ws.Cells(6, c).Value for c in VALORES}
    for c, v in VALORES.items():
        etiqueta = str(cab.get(c) or f"col {c}")[:30]
        muestra = v.strftime("%d/%m/%Y") if isinstance(v, datetime.datetime) else v
        print(f"   {etiqueta:<32} = {muestra}")

    if not os.path.isdir(UBICACION):
        print(f"\nAVISO: la carpeta de destino todavia no existe:\n   {UBICACION}")
        print("       (se registra igual: la crea el export del AMFE oficial)")

    if not APPLY:
        print("\nDRY-RUN. Corre con --apply para escribir.")
    else:
        ws.Rows(FILA_NUEVA).Insert()
        ws.Rows(FILA_MODELO).Copy()
        ws.Rows(FILA_NUEVA).PasteSpecial(-4122)   # xlPasteFormats
        excel.CutCopyMode = False
        for c in range(2, 18):
            ws.Cells(FILA_NUEVA, c).Value = None
        for c, v in VALORES.items():
            ws.Cells(FILA_NUEVA, c).Value = v
        wb.Save()
        print("\nGUARDADO. Relectura de control de la fila", FILA_NUEVA)
        for c in sorted(VALORES):
            print(f"   col {c:<3} = {ws.Cells(FILA_NUEVA, c).Value!r}")
        print(f"\n   fila siguiente ({FILA_NUEVA+1}) intacta: B={ws.Cells(FILA_NUEVA+1, 2).Value!r}")
finally:
    if wb is not None:
        wb.Close(SaveChanges=False)
    excel.Quit()
