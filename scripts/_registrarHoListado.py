"""
_registrarHoListado.py — registra las HO de ductos en el listado maestro de hojas de proceso.

`Y:\\...\\HOJAS DE OPERACIONES\\3- LISTADO\\Listado hojas de proceso.xlsx`

Inserta las filas dentro del bloque GENERAL (no al final del archivo), copia el formato de una
fila activa (nunca de una OBSOLETO, que va en italica gris), re-secuencia la columna `#` —que
es un correlativo ESTATICO, no una formula— y deja la hoja oculta `_CONTEXTO_CLAUDE` al dia
con el proximo numero libre. Todo eso lo pide la propia hoja oculta del archivo.

    python scripts/_registrarHoListado.py            # dry-run
    python scripts/_registrarHoListado.py --apply

Se edita con Excel real por COM: el archivo tiene formato condicional, bordes por bloque y una
hoja oculta que openpyxl en escritura maltrata.
"""
import os
import sys
import datetime

try:
    import win32com.client as win32
except ImportError:
    sys.exit('ERROR: falta pywin32 (win32com). No se puede hablar con Excel.')

APLICAR = '--apply' in sys.argv

LISTADO = (r'Y:\BARACK\CALIDAD\DOCUMENTACION SGC\HOJAS DE OPERACIONES'
           r'\3- LISTADO\Listado hojas de proceso.xlsx')
HOJA = 'INDICE HOJAS DE PROCESO'
CONTEXTO = '_CONTEXTO_CLAUDE'

MTIME_ESPERADO = '2026-08-14 12:29'   # ultima vez que lo toco Fak
FILA_MODELO = 87                       # HO-986: fila activa del bloque GENERAL
FILA_INSERCION = 88                    # justo despues del final del bloque GENERAL
PRIMERA_FILA_DATOS = 7

UNC = (r'\\SERVER\compartido\BARACK\CALIDAD\DOCUMENTACION SGC\PPAP CLIENTES\COZZUOL'
       '\\00_VW427-1LA_K-PATAGONIA\\01- Insonos Ductos de Calefacci\u00f3n'
       r'\PROYECTO\26 - Instrucciones de Proceso')

FECHA = datetime.datetime(2026, 8, 24)

# columnas: C sector, D n de HO, E codigo, F cliente, G descripcion, H tipo,
#           I fecha creacion, J creado por, K ult. rev., L fecha ult. rev., N ubicacion
NUEVAS = [
    (987, 'MP8146', '[GENERAL] INSONO AIR DUCT PATAGONIA', UNC + r'\MP8146'),
    (988, 'MP8147', '[GENERAL] INSONO DEFROSTER DUCT PATAGONIA', UNC + r'\MP8147'),
    (989, 'MP8148', '[GENERAL] INSONO CENTRAL AIR DUCT PATAGONIA', UNC + r'\MP8148'),
]

CONTEXTO_A15_NUEVO = (
    'GENERAL  \u2192 serie 900 (proceso compartido / general). ACLARADO 09/06/2026: cuando el '
    'usuario pide algo "general" SIEMPRE se refiere a la serie 900. Las piezas/telas sin proceso '
    'espec\u00edfico de sector van a GENERAL 900, NO preguntar de nuevo. Pr\u00f3ximo libre: 990 '
    '(987/988/989 = INSONOS DUCTOS DE CALEFACCI\u00d3N PATAGONIA, cliente COZZUOL, cargados el '
    '24/08/2026).'
)

CONTEXTO_LINEA_NUEVA = (
    '24/08/2026: se registraron HO 987 (MP8146 AIR DUCT), 988 (MP8147 DEFROSTER DUCT, un solo '
    'n\u00famero para los dos libros CENTRAL y LATERAL porque son el mismo c\u00f3digo del arb) y '
    '989 (MP8148 CENTRAL AIR DUCT) = INSONOS / DUCTOS DE CALEFACCI\u00d3N, proyecto '
    'VW427-1LA_K-PATAGONIA, cliente COZZUOL. Rev A, form I-IN-002.4-R01, 17 pesta\u00f1as en '
    'total. La numeraci\u00f3n de las operaciones sale del FLUJOGRAMA 158 Rev.A (I-IN-002/III, '
    '24/08/2026) y cierra con el AMFE 172: 50 prearmado y remachado, 60 soldado por ultrasonido, '
    '70 ensamble. Las hojas ya exist\u00edan desde febrero de 2026 (P.GAMBOA) con la celda B6 '
    '(N\u00b0 de operaci\u00f3n) y Q3 (N\u00b0 de HO) VAC\u00cdAS: la numeraci\u00f3n viv\u00eda '
    'solo en el nombre de la pesta\u00f1a. Los pasos no se tocaron. Se quit\u00f3 de los 4 libros '
    'la pesta\u00f1a oculta "20", que es la HO general de mesa de corte (HO-956): se sac\u00f3 por '
    'decisi\u00f3n de Fak, no porque estuviera mal \u2014 las hojas generales se comparten a '
    'prop\u00f3sito. Versiones anteriores en ...\\26 - Instrucciones de Proceso\\OBSOLETO\\.'
)


def hoja(wb, nombre):
    for s in wb.Sheets:
        if s.Name == nombre:
            return s
    return None


def main():
    m = datetime.datetime.fromtimestamp(os.path.getmtime(LISTADO)).strftime('%Y-%m-%d %H:%M')
    print(f'{"APLICANDO" if APLICAR else "DRY-RUN"}  ·  {LISTADO}')
    print(f'mtime en disco: {m}  (esperado {MTIME_ESPERADO})')
    if m != MTIME_ESPERADO:
        sys.exit('FRENADO: el listado cambio desde la ultima lectura. Lo reviso antes de escribir.')
    lock = os.path.join(os.path.dirname(LISTADO), '~$Listado hojas de proceso.xlsx')
    if os.path.exists(lock):
        sys.exit(f'FRENADO: hay lock {lock} (alguien lo tiene abierto).')

    if not APLICAR:
        print(f'\ninsertaria 3 filas en {FILA_INSERCION}, con el formato de la fila {FILA_MODELO}:')
        for ho, cod, desc, ruta in NUEVAS:
            print(f'  HO {ho} | GENERAL | {cod} | COZZUOL | {desc} | PROYECTO PATAGONIA '
                  f'| {FECHA:%d/%m/%Y} | F.Santoro | A | {ruta[-40:]}')
        print(f'\nre-secuenciaria la columna # (B = fila - 6) desde {PRIMERA_FILA_DATOS}')
        print(f'y actualizaria {CONTEXTO}!A15 -> "...Proximo libre: 990..." + una linea nueva')
        print('\n(dry-run: no se escribio nada)')
        return

    xl = win32.DispatchEx('Excel.Application')
    xl.Visible = False
    xl.DisplayAlerts = False
    wb = None
    try:
        wb = xl.Workbooks.Open(os.path.abspath(LISTADO), False, False)   # POSICIONALES
        ws = hoja(wb, HOJA)
        assert ws is not None, f'no encontre la hoja {HOJA}'

        # chequeo de que la fila modelo es la que creo que es, antes de tocar nada
        if str(ws.Cells(FILA_MODELO, 4).Value).split('.')[0] != '986':
            raise RuntimeError(f'la fila {FILA_MODELO} no es la HO-986: '
                               f'D{FILA_MODELO}={ws.Cells(FILA_MODELO, 4).Value!r}')

        n = len(NUEVAS)
        ws.Rows(f'{FILA_INSERCION}:{FILA_INSERCION + n - 1}').Insert()
        # formato de una fila ACTIVA (las OBSOLETO van en italica gris)
        ws.Rows(FILA_MODELO).Copy()
        ws.Rows(f'{FILA_INSERCION}:{FILA_INSERCION + n - 1}').PasteSpecial(-4122)  # xlPasteFormats
        xl.CutCopyMode = False

        for i, (ho, cod, desc, ruta) in enumerate(NUEVAS):
            r = FILA_INSERCION + i
            ws.Cells(r, 3).Value = 'GENERAL'
            ws.Cells(r, 4).Value = ho
            ws.Cells(r, 5).Value = cod
            ws.Cells(r, 6).Value = 'COZZUOL'
            ws.Cells(r, 7).Value = desc
            ws.Cells(r, 8).Value = 'PROYECTO PATAGONIA'
            ws.Cells(r, 9).Value = FECHA
            ws.Cells(r, 10).Value = 'F.Santoro'
            ws.Cells(r, 11).Value = 'A'
            ws.Cells(r, 12).Value = FECHA
            ws.Cells(r, 14).Value = ruta
            print(f'  fila {r}: HO {ho} {cod}')

        # la columna # es un correlativo ESTATICO: se re-secuencia a mano
        ultima = ws.Cells(ws.Rows.Count, 3).End(-4162).Row   # xlUp sobre SECTOR
        for r in range(PRIMERA_FILA_DATOS, ultima + 1):
            ws.Cells(r, 2).Value = r - 6
        print(f'  columna # re-secuenciada, filas {PRIMERA_FILA_DATOS}-{ultima}')

        ctx = hoja(wb, CONTEXTO)
        assert ctx is not None, f'no encontre la hoja {CONTEXTO}'
        ctx.Range('A15').Value = CONTEXTO_A15_NUEVO
        libre = ctx.Cells(ctx.Rows.Count, 1).End(-4162).Row + 1
        ctx.Cells(libre, 1).Value = CONTEXTO_LINEA_NUEVA
        print(f'  {CONTEXTO}: A15 actualizado y linea nueva en A{libre}')

        wb.Save()
    finally:
        if wb is not None:
            wb.Close(False)     # cerrar ANTES del Quit
        xl.Quit()
        del xl
    print('\nlisto.')


if __name__ == '__main__':
    main()
