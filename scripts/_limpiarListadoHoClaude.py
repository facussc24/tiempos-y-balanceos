"""
_limpiarListadoHoClaude.py — saca a "Claude" del listado de hojas de proceso (Fak, 08/10/2026).

Lo que encontro el detector (`scripts/_sinFirmaIA.py`) en
`Y:\\...\\HOJAS DE OPERACIONES\\3- LISTADO\\Listado hojas de proceso.xlsx`:
  1. columna J (CREADO POR) = "Claude" en las filas de las HO 972 a 984 y la HO 118 (junio 2026);
  2. la pestaña oculta "_CONTEXTO_CLAUDE" ("CONTEXTO PARA EL PROXIMO CLAUDE");
  3. la marca del complemento "Claude para Excel" (xl/webextensions, claude.fileId).
Fak: *"es un error gravisimo"*, *"contexto claude tampoco hace falta, nunca mas crear algo asi...
eliminalo donde lo encuentres"*.

Que hace:
  - CREADO POR de esas filas pasa a "F.Santoro": los archivos de esas HO dicen autor
    "Facundo Santoro" en sus propiedades, y asi figuran todas las HO que hizo Ingenieria (985 a 993).
  - Borra la pestaña oculta (su texto se guardo antes en la memoria
    `reference_listado_ho_historia_numeracion`, que es donde va mi contexto, no en el libro).
  - Saca la marca del complemento (cirugia sobre el zip, `firmaIA.quitar_complemento_claude`).
Edita con Excel por COM (preserva el formato), con copia de resguardo y relectura.

Uso: python scripts/_limpiarListadoHoClaude.py            (dry-run)
     python scripts/_limpiarListadoHoClaude.py --apply
"""
import datetime
import os
import shutil
import sys

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '_lib'))
import firmaIA  # noqa: E402

LISTADO = (r'Y:\BARACK\CALIDAD\DOCUMENTACION SGC\HOJAS DE OPERACIONES'
           r'\3- LISTADO\Listado hojas de proceso.xlsx')
MTIME_ESPERADO = '2026-10-01 14:54'
HOJA = 'INDICE HOJAS DE PROCESO'
OCULTA = '_CONTEXTO_CLAUDE'
FILAS = list(range(74, 87)) + [119]          # 14 filas, leidas el 08/10/2026
NUEVO = 'F.Santoro'
APLICAR = '--apply' in sys.argv
RESGUARDO_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'backups')


def hoja(wb, nombre):
    for s in wb.Sheets:
        if s.Name == nombre:
            return s
    return None


def leer(p):
    import openpyxl
    wb = openpyxl.load_workbook(p)
    return {ws.title: {c.coordinate: c.value for fila in ws.iter_rows() for c in fila if c.value is not None}
            for ws in wb.worksheets}


def main():
    if hasattr(sys.stdout, 'reconfigure'):
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    m = datetime.datetime.fromtimestamp(os.path.getmtime(LISTADO)).strftime('%Y-%m-%d %H:%M')
    print(f'{"APLICANDO" if APLICAR else "DRY-RUN"} · {LISTADO}\nmtime {m} (esperado {MTIME_ESPERADO})')
    if m != MTIME_ESPERADO:
        sys.exit('FRENADO: el listado cambio desde la ultima lectura.')
    lock = os.path.join(os.path.dirname(LISTADO), '~$Listado hojas de proceso.xlsx')
    if os.path.exists(lock):
        sys.exit(f'FRENADO: {lock} (alguien lo tiene abierto).')
    antes = leer(LISTADO)
    ind = antes[HOJA]
    malas = [r for r in FILAS if ind.get(f'J{r}') != 'Claude']
    if malas:
        sys.exit(f'FRENADO: estas filas no dicen "Claude" en J: {malas}')
    otras = [k for k, v in ind.items() if isinstance(v, str) and 'claude' in v.lower() and int(k[1:]) not in FILAS]
    if otras:
        sys.exit(f'FRENADO: hay otras celdas con Claude que este script no conoce: {otras}')
    for r in FILAS:
        print(f'  J{r}: HO {ind.get(f"D{r}")} · "Claude" -> "{NUEVO}"')
    print(f'  pestaña oculta "{OCULTA}": se borra ({len(antes.get(OCULTA, {}))} celdas con texto)')
    print('  marca del complemento Claude para Excel: se saca')
    if not APLICAR:
        print('\n(dry-run: no se escribio nada)')
        return

    os.makedirs(RESGUARDO_DIR, exist_ok=True)
    resguardo = os.path.join(RESGUARDO_DIR, f'Listado hojas de proceso_{datetime.datetime.now():%Y-%m-%dT%H-%M}.xlsx')
    shutil.copy2(LISTADO, resguardo)
    print(f'resguardo: {resguardo}')

    import win32com.client as win32
    xl = win32.DispatchEx('Excel.Application')
    xl.Visible = False
    xl.DisplayAlerts = False
    wb = None
    try:
        wb = xl.Workbooks.Open(os.path.abspath(LISTADO), False, False)   # POSICIONALES
        ws = hoja(wb, HOJA)
        for r in FILAS:
            assert ws.Cells(r, 10).Value == 'Claude', f'J{r} = {ws.Cells(r, 10).Value!r}'
            ws.Cells(r, 10).Value = NUEVO
        oc = hoja(wb, OCULTA)
        if oc is not None:
            oc.Visible = -1          # una hoja oculta no se borra; primero visible
            oc.Delete()
        ws.Activate()
        wb.Save()
    finally:
        if wb is not None:
            wb.Close(False)
        xl.Quit()

    sacadas = firmaIA.quitar_complemento_claude(LISTADO)
    print(f'complemento: saque {len(sacadas)} partes {sacadas}')

    # relectura: solo cambiaron esas 14 celdas y la pestaña oculta ya no esta
    despues = leer(LISTADO)
    assert set(despues) == set(antes) - {OCULTA}, f'pestañas: {list(despues)}'
    for t in despues:
        a, d = antes[t], despues[t]
        dif = {k for k in set(a) | set(d) if a.get(k) != d.get(k)}
        esperadas = {f'J{r}' for r in FILAS} if t == HOJA else set()
        assert dif == esperadas, f'{t}: cambiaron celdas inesperadas {sorted(dif - esperadas)[:10]}'
    hs, _, _ = firmaIA.revisar([LISTADO], con_avisos=False)
    for h in hs:
        print(h.renglon())
    if hs:
        sys.exit('QUEDA FIRMA DE IA en el listado')
    print('OK: el listado ya no nombra a Claude (relectura + detector).')


if __name__ == '__main__':
    main()
