"""
_distribuirAmfesPatagonia.py — deja cada AMFE de Patagonia en su lugar del sistema documental.

DOS DESTINOS, cada uno con su convencion (relevada del servidor el 17/08/2026):

  1. MAESTRO de Gestion Ingenieria — solo `.xlsx`, uno por carpeta `<nro> - <PIEZA>`:
     Y:\\Ingenieria\\Documentacion Gestion Ingenieria\\13. Analisis del modo de falla...\\
       2. AMFES DE PROCESO\\VWA\\VW427-1LA_K-PATAGONIA\\<nro> - <PIEZA>\\
       2. AMFES DE PROCESO\\NOVAX\\PATAGONIA\\<nro> - <PIEZA>\\

  2. LEGAJO PPAP del cliente — el `.pdf`, en el elemento APQP `22- FMEA de proceso`.
     La profundidad cambia segun la pieza (Armrest Rear lleva `1-APQP`, el resto `APQP`).

ARCHIVADO: nada se borra. Lo que se reemplaza se MUEVE a `OBSOLETO\\` agregando la fecha
de baja entre parentesis, que es la convencion que ya usa la carpeta del Armrest Rear.

Uso:  python scripts/_distribuirAmfesPatagonia.py            (dry-run: imprime el plan)
      python scripts/_distribuirAmfesPatagonia.py --apply
"""
import os
import shutil
import sys
from datetime import date

ORIGEN = (r'C:\Users\FACUND~1\AppData\Local\Temp\claude\C--Dev-BarackMercosul'
          r'\3bea1fce-efb8-4810-b3c6-6b0a58c9fa1a\scratchpad\amfes-patagonia')

MAESTRO = (r'Y:\Ingenieria\Documentacion Gestion Ingenieria'
           r'\13. Analisis del modo de falla y sus efectos ( I-AC-005.3)\2. AMFES DE PROCESO')
PPAP = r'Y:\BARACK\CALIDAD\DOCUMENTACION SGC\PPAP CLIENTES'

VW427 = r'VW\VW427-1LA_K-PATAGONIA'

# nro -> (pieza, carpeta del maestro, carpeta del legajo PPAP)
AMFES = {
    '149': ('TRIM ASM-UPR WRAPPING',
            rf'VWA\VW427-1LA_K-PATAGONIA\149 - TRIM ASM-UPR WRAPPING',
            rf'{VW427}\IP PADs\APQP\22- FMEA de proceso'),
    '150': ('APOYABRAZOS TRASERO',
            rf'VWA\VW427-1LA_K-PATAGONIA\150 - APOYABRAZOS TRASERO',
            rf'{VW427}\Armrest Rear\1-APQP\22- FMEA de proceso'),
    '151': ('APC DELANTERO CON COSTURA VISTA',
            rf'VWA\VW427-1LA_K-PATAGONIA\151 - APC DELANTERO CON COSTURA VISTA',
            rf'{VW427}\Headrest\APQP\22- FMEA de proceso'),
    '153': ('APC TRASERO CENTRAL CON COSTURA VISTA',
            rf'VWA\VW427-1LA_K-PATAGONIA\153 - APC TRASERO CENTRAL CON COSTURA VISTA',
            rf'{VW427}\Headrest\APQP\22- FMEA de proceso'),
    '155': ('APC TRASERO LATERAL CON COSTURA VISTA',
            rf'VWA\VW427-1LA_K-PATAGONIA\155 - APC TRASERO LATERAL CON COSTURA VISTA',
            rf'{VW427}\Headrest\APQP\22- FMEA de proceso'),
    '158': ('INSERT',
            r'NOVAX\PATAGONIA\158 - INSERT',
            r'NOVAX\Tapizadas puerta\22- FMEA de proceso'),
    '161': ('ARMREST DOOR PANEL',
            r'NOVAX\PATAGONIA\161 - ARMREST DOOR PANEL',
            r'NOVAX\Tapizadas puerta\22- FMEA de proceso'),
    '162': ('TOP ROLL',
            r'NOVAX\PATAGONIA\162 - TOP ROLL',
            r'NOVAX\Tapizadas puerta\22- FMEA de proceso'),
}

HOY = date.today().strftime('%d-%m-%Y')


def armar_plan():
    """Devuelve [(origen, destino, previo_a_archivar_o_None)] y la lista de problemas."""
    acciones, problemas = [], []
    for nro, (pieza, dir_maestro, dir_ppap) in AMFES.items():
        base = f'AMFE {nro} - {pieza} - Rev.A'
        for ext, raiz, sub in (('xlsx', MAESTRO, dir_maestro), ('pdf', PPAP, dir_ppap)):
            src = os.path.join(ORIGEN, base + '.' + ext)
            carpeta = os.path.join(raiz, sub)
            dst = os.path.join(carpeta, base + '.' + ext)
            if not os.path.exists(src):
                problemas.append(f'FALTA el origen: {src}')
                continue
            if not os.path.isdir(carpeta):
                problemas.append(f'NO EXISTE la carpeta destino: {carpeta}')
                continue
            acciones.append((src, dst, dst if os.path.exists(dst) else None))
    return acciones, problemas


def mostrar_plan(acciones, problemas):
    print(f'PLAN — {len(acciones)} archivo(s) a copiar\n')
    for src, dst, previo in acciones:
        print(f'  {os.path.basename(src)}')
        print(f'     -> {os.path.dirname(dst)}')
        if previo:
            print(f'     ARCHIVA el existente en OBSOLETO\\ como "... ({HOY})"')
    a_archivar = sum(1 for _, _, p in acciones if p)
    print(f'\n  TOTAL: {len(acciones)} copias, {a_archivar} archivo(s) previo(s) a archivar.')
    print('  Nada se borra: lo reemplazado se MUEVE a OBSOLETO\\.')
    if problemas:
        print(f'\n  PROBLEMAS ({len(problemas)}):')
        for p in problemas:
            print(f'    - {p}')


def ejecutar(acciones):
    copiados, archivados, fallos = 0, 0, []
    for src, dst, previo in acciones:
        try:
            if previo:
                obsoleto = os.path.join(os.path.dirname(dst), 'OBSOLETO')
                os.makedirs(obsoleto, exist_ok=True)
                raiz, ext = os.path.splitext(os.path.basename(previo))
                destino_viejo = os.path.join(obsoleto, f'{raiz} ({HOY}){ext}')
                shutil.move(previo, destino_viejo)
                archivados += 1
                print(f'  archivado  {os.path.basename(destino_viejo)}')
            shutil.copy2(src, dst)
            # Verificar la COPIA, no el hecho de haber llamado a copy2.
            if not os.path.exists(dst):
                fallos.append(f'{os.path.basename(dst)}: no quedo en destino')
                continue
            b_src, b_dst = os.path.getsize(src), os.path.getsize(dst)
            if b_src != b_dst:
                fallos.append(f'{os.path.basename(dst)}: {b_dst} b en destino vs {b_src} b en origen')
                continue
            copiados += 1
            print(f'  OK  {b_dst:>9,} b  {os.path.basename(dst)}')
        except Exception as e:                                # noqa: BLE001
            fallos.append(f'{os.path.basename(src)}: {e}')

    print(f'\n=== COPIADOS {copiados}/{len(acciones)} | ARCHIVADOS {archivados} ===')
    if fallos:
        print(f'\n=== FALLARON {len(fallos)} ===')
        for f in fallos:
            print(f'  {f}')
        sys.exit(1)


if __name__ == '__main__':
    acciones, problemas = armar_plan()
    mostrar_plan(acciones, problemas)
    if problemas:
        print('\nHay problemas sin resolver: no se ejecuta nada. Corregir y reintentar.')
        sys.exit(1)
    if '--apply' not in sys.argv:
        print('\nDRY-RUN. Agrega --apply para copiar.')
        sys.exit(0)
    print()
    ejecutar(acciones)
