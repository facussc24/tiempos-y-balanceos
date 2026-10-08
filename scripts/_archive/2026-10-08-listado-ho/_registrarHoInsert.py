# -*- coding: utf-8 -*-
"""
ARCHIVADO 08/10/2026 — NO USAR COMO MODELO: escribia en una pestaña oculta del listado que nombraba
a Claude (_CONTEXTO_CLAUDE). Fak mando borrarla: mi contexto va a la memoria, nunca adentro de un
documento de la empresa (scripts/_sinFirmaIA.py lo frena).

_registrarHoInsert.py — registra la HO 990 (INSERT PATAGONIA) en el Listado Maestro de Hojas de Proceso.

Ruta: Y:\\BARACK\\CALIDAD\\DOCUMENTACION SGC\\HOJAS DE OPERACIONES\\3- LISTADO\\Listado hojas de proceso.xlsx

Inserta la fila al final del bloque GENERAL (fila 91), copia el formato de la fila activa 90 (HO-989),
re-secuencia la columna # (correlativo estático) y actualiza la hoja oculta _CONTEXTO_CLAUDE
con el próximo número libre (991).

Uso:
    python scripts/novax/_registrarHoInsert.py          # dry-run
    python scripts/novax/_registrarHoInsert.py --apply  # aplica en Excel COM
"""
import os
import sys
import datetime

try:
    import win32com.client as win32
except ImportError:
    sys.exit("ERROR: falta pywin32 (win32com).")

APLICAR = "--apply" in sys.argv

LISTADO = (r"Y:\BARACK\CALIDAD\DOCUMENTACION SGC\HOJAS DE OPERACIONES"
           r"\3- LISTADO\Listado hojas de proceso.xlsx")
HOJA = "INDICE HOJAS DE PROCESO"
CONTEXTO = "_CONTEXTO_CLAUDE"

FILA_MODELO = 90      # HO-989: última fila activa del bloque GENERAL
FILA_INSERCION = 91   # justo antes de INY. PLÁSTICA
PRIMERA_FILA_DATOS = 7

UNC = (r"\\SERVER\compartido\BARACK\CALIDAD\DOCUMENTACION SGC\PPAP CLIENTES\NOVAX"
       r"\Tapizadas puerta\26- Instrucciones de Proceso\INSERT")

FECHA = datetime.datetime(2026, 9, 8)

HO_NUM = 990
CODIGO = "N 227 / N 389 a N 403"
CLIENTE = "NOVAX"
DESC = "[GENERAL] INSERT PATAGONIA"
TIPO = "PROYECTO PATAGONIA"
AUTOR = "F.Santoro"
REV = "A"

CONTEXTO_A15_NUEVO = (
    'GENERAL  → serie 900 (proceso compartido / general). ACLARADO 09/06/2026: cuando el '
    'usuario pide algo "general" SIEMPRE se refiere a la serie 900. Las piezas/telas sin proceso '
    'específico de sector van a GENERAL 900, NO preguntar de nuevo. Próximo libre: 991 '
    '(990 = INSERT PATAGONIA, cliente NOVAX / VWA, cargado el 11/09/2026).'
)

CONTEXTO_LINEA_NUEVA = (
    '11/09/2026: se registró HO 990 (INSERT PATAGONIA), cliente NOVAX / VWA, proyecto '
    'VW427-1LA_K-PATAGONIA, códigos N 227 y N 389 a N 403 (24 códigos). Rev A, form I-IN-002.4-R01, '
    'generado en PowerPoint (17 diapositivas). La numeración de las operaciones sale del FLUJOGRAMA 154 '
    'Rev.B (08/09/2026) y cierra con el AMFE 158 (AMFE-INS-PAT): 10 Recepción MP, 20 Preparación de corte, '
    '21 Corte CNC, 22 Control Mylar, 50 Costura CNC, 60 Troquelado, 70 Inyección, 71 Control Inyección, '
    '90 Adhesivado, 91 Inspección adhesivado, 93 Reproceso, 100 Tapizado semiautomático, 101 Virolado manual, '
    '102 Refilado post-tapizado, 110 Control final, 120 Embalaje. Archivos: HO-990_INSERT_PATAGONIA_REV.A.pptx '
    'y .pdf en ...\\26- Instrucciones de Proceso\\INSERT\\.'
)


def hoja(wb, nombre):
    for s in wb.Sheets:
        if s.Name == nombre:
            return s
    return None


def main():
    if not os.path.exists(LISTADO):
        sys.exit(f"ERROR: no existe el archivo {LISTADO}")

    lock = os.path.join(os.path.dirname(LISTADO), "~$Listado hojas de proceso.xlsx")
    if os.path.exists(lock):
        sys.exit(f"FRENADO: hay lock {lock} (alguien lo tiene abierto).")

    print(f"{'APLICANDO' if APLICAR else 'DRY-RUN'}  ·  {LISTADO}")

    if not APLICAR:
        print(f"\nInsertaría 1 fila en {FILA_INSERCION}, con el formato de la fila {FILA_MODELO}:")
        print(f"  HO {HO_NUM} | GENERAL | {CODIGO} | {CLIENTE} | {DESC} | {TIPO} "
              f"| {FECHA:%d/%m/%Y} | {AUTOR} | {REV} | {UNC}")
        print(f"\nRe-secuenciaría la columna # (B = fila - 6) desde {PRIMERA_FILA_DATOS}")
        print(f"y actualizaría {CONTEXTO}!A15 -> '...Próximo libre: 991...' + línea de log")
        print("\n(dry-run: no se escribió nada. Ejecutar con --apply para aplicar)")
        return

    xl = win32.DispatchEx("Excel.Application")
    xl.Visible = False
    xl.DisplayAlerts = False
    wb = None
    try:
        wb = xl.Workbooks.Open(os.path.abspath(LISTADO), False, False)
        ws = hoja(wb, HOJA)
        assert ws is not None, f"No encontré la hoja {HOJA}"

        val_90 = str(ws.Cells(FILA_MODELO, 4).Value).split(".")[0]
        if val_90 != "989":
            raise RuntimeError(f"La fila {FILA_MODELO} no es HO-989: D{FILA_MODELO}={val_90!r}")

        ws.Rows(FILA_INSERCION).Insert()
        ws.Rows(FILA_MODELO).Copy()
        ws.Rows(FILA_INSERCION).PasteSpecial(-4122)  # xlPasteFormats
        xl.CutCopyMode = False

        r = FILA_INSERCION
        ws.Cells(r, 3).Value = "GENERAL"
        ws.Cells(r, 4).Value = HO_NUM
        ws.Cells(r, 5).Value = CODIGO
        ws.Cells(r, 6).Value = CLIENTE
        ws.Cells(r, 7).Value = DESC
        ws.Cells(r, 8).Value = TIPO
        ws.Cells(r, 9).Value = FECHA
        ws.Cells(r, 10).Value = AUTOR
        ws.Cells(r, 11).Value = REV
        ws.Cells(r, 12).Value = FECHA
        ws.Cells(r, 14).Value = UNC
        print(f"  fila {r}: HO {HO_NUM} {CODIGO}")

        # Re-secuenciar columna B (# = fila - 6)
        ultima = ws.Cells(ws.Rows.Count, 3).End(-4162).Row  # xlUp sobre col C
        for row_idx in range(PRIMERA_FILA_DATOS, ultima + 1):
            ws.Cells(row_idx, 2).Value = row_idx - 6
        print(f"  columna # re-secuenciada, filas {PRIMERA_FILA_DATOS}-{ultima}")

        ctx = hoja(wb, CONTEXTO)
        assert ctx is not None, f"No encontré la hoja {CONTEXTO}"
        ctx.Range("A15").Value = CONTEXTO_A15_NUEVO
        libre = ctx.Cells(ctx.Rows.Count, 1).End(-4162).Row + 1
        ctx.Cells(libre, 1).Value = CONTEXTO_LINEA_NUEVA
        print(f"  {CONTEXTO}: A15 actualizado y línea nueva en A{libre}")

        wb.Save()
        print("\n¡Listado Maestro actualizado y guardado con éxito!")
    finally:
        if wb is not None:
            wb.Close(False)
        xl.Quit()
        del xl


if __name__ == "__main__":
    main()
