"""
_alinearHoDuctos.py — alinea las 4 Hojas de Operacion de Insonos / Ductos de Calefaccion
(VW427-1LA_K-PATAGONIA, cliente COZZUOL) contra el Flujograma 158 Rev.A.

Que hace, y NADA mas que esto:
  1. Elimina de cada libro la pestaña oculta "20" (es la HO GENERAL de mesa de corte, HO-956;
     se saca por decision de Fak del 24/08/2026, no porque este mal — ver la memoria
     `reference_ho_generales_compartidas`).
  2. Renombra cada pestaña con el numero de operacion del flujograma 158.
  3. Escribe el cajetin: B6 (N de operacion), Q3 (N de HO), K6 (modelo), K8 (cliente),
     Q7 (fecha) y Q8 (revision, con LETRA).

Lo que NO toca: los pasos, las imagenes, el ciclo de control, el plan de reaccion, Q5/Q6
(realizo / aprobo) y Q2 (codigo de formulario). Los pasos son instruccion de planta: sin
documento fuente no se reescriben (regla `no-pfd-no-ho`, `core-prohibiciones` §1).

    python scripts/_alinearHoDuctos.py            # dry-run: dice que haria
    python scripts/_alinearHoDuctos.py --apply    # escribe

Trampas de Excel COM que respeta (memoria `excel_com_argumentos_posicionales`):
  - `DispatchEx`, no `Dispatch`: instancia aislada, no se engancha a un Excel zombie.
  - Las pestañas con nombre NUMERICO no se piden por nombre (`wb.Sheets("30")` lo toma como
    indice 30 y revienta): se itera.
  - El workbook se cierra ANTES del `Quit()`, en `finally`, o queda un `~$` huerfano en el
    disco de red que despues no se puede ni borrar.
  - Despues de escribir se verifica el COLOR DE FUENTE: en la HO-986 las celdas heredaron
    fuente blanca y el dato entraba sin verse.
"""
import os
import sys
import glob
import datetime

try:
    import win32com.client as win32
except ImportError:
    sys.exit('ERROR: falta pywin32 (win32com). No se puede hablar con Excel.')

APLICAR = '--apply' in sys.argv
# fecha real, no string: la celda Q7 del formulario guarda un serial de Excel con
# formato dd/mm/yyyy. Un string ahi rompe el tipo y se ve distinto al resto de las HO.
FECHA = datetime.datetime(2026, 8, 24)   # COM no acepta datetime.date, pide datetime
REVISION = 'A'
MODELO = 'PATAGONIA'
CLIENTE = 'COZZUOL'

# El nombre de la carpeta lleva tilde: se resuelve del disco, no se tipea.
ROOT = r'Y:\BARACK\CALIDAD\DOCUMENTACION SGC\PPAP CLIENTES\COZZUOL\00_VW427-1LA_K-PATAGONIA'


def base_ho():
    sub = [d for d in os.listdir(ROOT) if d.startswith('01- Insonos')]
    if len(sub) != 1:
        sys.exit(f'ERROR: esperaba una sola carpeta "01- Insonos...", encontre {sub}')
    return os.path.join(ROOT, sub[0], 'PROYECTO', '26 - Instrucciones de Proceso')


# Mapeo pestaña actual -> numero de operacion del flujograma 158.
# Sale de lo que HACEN los pasos de cada hoja, no del numero que traen hoy.
# El detalle y su justificacion estan en docs/ductos-amfe-hallazgos.md.
LIBROS = [
    {
        'rel': r'MP8146\HO MP8146.xlsx',
        'ho': 987,
        'mtime': '2026-02-18 12:33',
        'mapa': [('30', '60'), ('40', '60.1'), ('40.1', '60.2'),
                 ('40,2', '60.3'), ('40.3', '60.4'), ('40.4', '60.5')],
    },
    {
        'rel': r'MP8147\HO MP8147 CENTRAL.xlsx',
        'ho': 988,
        'mtime': '2026-02-12 15:14',
        'mapa': [('30', '50'), ('50', '50.1'), ('40', '60'), ('40.1', '60.1'), ('40.2', '60.2')],
    },
    {
        'rel': r'MP8147\HO MP8147 LATERAL.xlsx',
        'ho': 988,
        'mtime': '2026-02-12 16:27',
        'mapa': [('40', '60'), ('40.1', '60.1'), ('40.2', '60.2'),
                 ('40.3', '60.3'), ('40.4', '70')],
    },
    {
        'rel': r'MP8148\HO MP8148 CENTRAL.xlsx',
        'ho': 989,
        'mtime': '2026-02-18 09:42',
        'mapa': [('40', '60')],
    },
]

HOJA_GENERAL = '20'  # HO-956, mesa de corte: se saca del libro de producto


def hoja(wb, nombre):
    """Una pestaña con nombre numerico NO se pide por nombre: wb.Sheets('30') es indice 30."""
    for s in wb.Sheets:
        if s.Name == nombre:
            return s
    return None


def excel_de_fak_abierto():
    """Si Fak tiene Excel con cambios sin guardar, abortar. No se mata EXCEL.EXE a lo bruto."""
    try:
        xl = win32.GetObject(Class='Excel.Application')
    except Exception:
        return False
    try:
        sucios = [wb.Name for wb in xl.Workbooks if not wb.Saved]
    except Exception:
        return False
    if sucios:
        print('ABORTADO: hay Excel abierto con cambios sin guardar:', sucios)
        return True
    return False


def main():
    base = base_ho()
    print(f'{"APLICANDO" if APLICAR else "DRY-RUN"}  ·  {base}\n')

    # Gate 1: nadie toco los archivos, y no hay lock
    frenar = False
    for lib in LIBROS:
        f = os.path.join(base, lib['rel'])
        if not os.path.exists(f):
            print('FALTA', f); frenar = True; continue
        m = datetime.datetime.fromtimestamp(os.path.getmtime(f)).strftime('%Y-%m-%d %H:%M')
        if m != lib['mtime'] and not lib.get('yaAplicado'):
            print(f'*** {lib["rel"]} cambio en el servidor: {m} (esperaba {lib["mtime"]})')
            frenar = True
    locks = glob.glob(os.path.join(base, '**', '~$*'), recursive=True)
    if locks:
        print('*** hay locks ~$:', locks); frenar = True
    if frenar:
        sys.exit('FRENADO. Reviso a mano antes de tocar nada.')
    if APLICAR and excel_de_fak_abierto():
        sys.exit(1)

    # Gate 2: el respaldo en OBSOLETO tiene que existir ANTES de escribir
    obs = os.path.join(base, 'OBSOLETO')
    for lib in LIBROS:
        b = os.path.join(obs, os.path.basename(lib['rel']))
        if not os.path.exists(b):
            sys.exit(f'FRENADO: no hay respaldo en OBSOLETO de {os.path.basename(lib["rel"])}')
    print('respaldo en OBSOLETO: OK\n')

    xl = None
    try:
        if APLICAR:
            xl = win32.DispatchEx('Excel.Application')
            xl.Visible = False
            xl.DisplayAlerts = False

        for lib in LIBROS:
            f = os.path.join(base, lib['rel'])
            print(f'--- {lib["rel"]}   ->  HO N° {lib["ho"]}  Rev.{REVISION}')
            if not APLICAR:
                for viejo, nuevo in lib['mapa']:
                    print(f'      pestaña "{viejo}"  ->  "{nuevo}"   B6 = {nuevo}')
                print(f'      eliminar pestaña oculta "{HOJA_GENERAL}" (HO-956, general de corte)')
                print(f'      Q3 = HO N° {lib["ho"]}  ·  Q7 = {FECHA:%d/%m/%Y}  ·  Q8 = {REVISION}'
                      f'  ·  K6 = {MODELO}  ·  K8 = {CLIENTE}')
                continue

            wb = None
            try:
                wb = xl.Workbooks.Open(os.path.abspath(f), False, False)  # POSICIONALES

                # 1) sacar la hoja general de corte
                g = hoja(wb, HOJA_GENERAL)
                if g is not None:
                    g.Visible = -1      # xlSheetVisible: una hoja oculta no se puede borrar
                    g.Delete()
                    print(f'      eliminada pestaña "{HOJA_GENERAL}"')

                # 2) renombrar + cajetin. Se renombra a un temporal primero para que un
                #    nombre nuevo no choque con uno viejo todavia presente (40 -> 60.1 y 60 -> ...).
                for viejo, nuevo in lib['mapa']:
                    s = hoja(wb, viejo)
                    if s is None:
                        raise RuntimeError(f'no encontre la pestaña "{viejo}" en {lib["rel"]}')
                    s.Name = '_tmp_' + nuevo
                for viejo, nuevo in lib['mapa']:
                    s = hoja(wb, '_tmp_' + nuevo)
                    s.Name = nuevo
                    # B6 va como TEXTO a la fuerza: en locale es-AR, "60.1" en una celda
                    # General lo come el punto como separador de miles y queda 601.
                    s.Range('B6').NumberFormat = '@'
                    s.Range('B6').Value = nuevo
                    s.Range('Q3').Value = f'HO N° {lib["ho"]}'
                    s.Range('K6').Value = MODELO
                    s.Range('K8').Value = CLIENTE
                    s.Range('Q7').Value = FECHA          # date real, no string
                    s.Range('Q8').Value = REVISION
                    # la trampa de la HO-986: fuente blanca heredada -> el dato no se ve
                    for celda in ('B6', 'Q3', 'K6', 'K8', 'Q7', 'Q8'):
                        if s.Range(celda).Font.Color == 16777215:
                            s.Range(celda).Font.Color = 0
                            print(f'      {nuevo}: {celda} tenia fuente blanca, corregida')
                    # releer lo que quedo en la celda, no confiar en la llamada
                    leido = str(s.Range('B6').Value)
                    if leido != nuevo:
                        raise RuntimeError(
                            f'{lib["rel"]} hoja {nuevo}: B6 quedo "{leido}", esperaba "{nuevo}"')
                    print(f'      "{viejo}" -> "{nuevo}"   B6={leido}  Q3=HO N° {lib["ho"]}')

                wb.Save()
            finally:
                if wb is not None:
                    wb.Close(False)     # cerrar ANTES del Quit o queda ~$ huerfano
    finally:
        if xl is not None:
            xl.Quit()
            del xl

    print('\nlisto.' if APLICAR else '\n(dry-run: no se escribio nada)')


if __name__ == '__main__':
    main()
