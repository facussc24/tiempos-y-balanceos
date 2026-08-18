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

Uso:  python scripts/_distribuirAmfesPatagonia.py <carpeta_con_los_amfe>
      python scripts/_distribuirAmfesPatagonia.py <carpeta_con_los_amfe> --apply

La carpeta de origen es la que tiene los `AMFE <nro> - <PIEZA> - Rev.A.xlsx` y `.pdf` ya
generados y verificados (la que produce `_exportAmfeOficial.ts` + `_xlsxAPdf.py`).
Sin `--apply` solo imprime el plan con el conteo.
"""
import os
import shutil
import sys
from datetime import date

# La carpeta de origen se pasa por linea de comandos. La primera version la tenia
# hardcodeada al scratchpad de UNA sesion de Claude Code (con su UUID adentro): esos
# scratchpads no sobreviven a la sesion, asi que el script quedaba imposible de reusar.
ORIGEN = None  # se completa en __main__

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


def nombre_libre(carpeta, raiz, ext):
    """
    Nombre de archivado que NO pise uno existente.

    En Windows, mover a un destino que ya existe no falla: se copia, se borra el origen y
    se pisa el destino en silencio, con exit 0. Como el nombre de archivado llevaba solo la
    fecha (`... (18-08-2026).xlsx`), dos corridas el mismo dia se comian la primera version
    archivada sin dejar ningun rastro. Si el nombre esta ocupado se agrega un contador.
    """
    destino = os.path.join(carpeta, f'{raiz} ({HOY}){ext}')
    n = 2
    while os.path.exists(destino):
        destino = os.path.join(carpeta, f'{raiz} ({HOY}-{n}){ext}')
        n += 1
    return destino


def armar_plan(origen):
    """Devuelve [(origen, destino, previo_a_archivar_o_None)] y la lista de problemas."""
    acciones, problemas = [], []
    for nro, (pieza, dir_maestro, dir_ppap) in AMFES.items():
        base = f'AMFE {nro} - {pieza} - Rev.A'
        for ext, raiz, sub in (('xlsx', MAESTRO, dir_maestro), ('pdf', PPAP, dir_ppap)):
            src = os.path.join(origen, base + '.' + ext)
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
                destino_viejo = nombre_libre(obsoleto, raiz, ext)
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
    if len(sys.argv) < 2 or sys.argv[1].startswith('--'):
        sys.exit('Uso: python scripts/_distribuirAmfesPatagonia.py <carpeta_con_los_amfe> [--apply]')
    ORIGEN = os.path.abspath(sys.argv[1])
    if not os.path.isdir(ORIGEN):
        sys.exit(f'ERROR: no existe la carpeta de origen {ORIGEN}')
    acciones, problemas = armar_plan(ORIGEN)
    mostrar_plan(acciones, problemas)
    if problemas:
        print('\nHay problemas sin resolver: no se ejecuta nada. Corregir y reintentar.')
        sys.exit(1)
    if '--apply' not in sys.argv:
        print('\nDRY-RUN. Agrega --apply para copiar.')
        sys.exit(0)
    print()
    ejecutar(acciones)
