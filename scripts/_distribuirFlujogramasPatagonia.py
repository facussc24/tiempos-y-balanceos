"""
_distribuirFlujogramasPatagonia.py — deja los 5 flujogramas Rev. B de Patagonia en su lugar.

Calcado de `_distribuirAmfesPatagonia.py` (mismo contrato: dry-run por defecto, --apply para
ejecutar, nada se borra — lo reemplazado va a OBSOLETO\\ con la fecha entre parentesis).

DOS DESTINOS por flujograma (relevados del servidor el 19/08/2026):

  1. CARPETA DE PRODUCTO de Gestion Ingenieria — el `.png` tal como sale del generador:
     Y:\\Ingenieria\\Documentacion Gestion Ingenieria\\8. Flujograma Sinóptico (I-IN-002III)\\
       CLIENTES\\VWA\\PATAGONIA\\<PRODUCTO>\\
     La carpeta IP PAD no existia: se crea (el IP Pad no tenia flujograma maestro).

  2. LEGAJO PPAP del cliente — el `.pdf` (convertido del PNG con Pillow), en el elemento
     APQP `20- Flujograma de proceso`. Al legajo va PDF, no PNG.

ARCHIVADO explicito: los archivos viejos que cada flujograma reemplaza estan listados uno
por uno (se relevaron a mano). En particular los DOS `122 ...vsdx` del Top Roll: el 122 es
el APC central de Amarok (otro cliente); el flujograma del Top Roll Patagonia es el 155.
El 154 (Insert) sigue en Rev. A y no se toca.

Uso:  python scripts/_distribuirFlujogramasPatagonia.py <carpeta_con_los_png>
      python scripts/_distribuirFlujogramasPatagonia.py <carpeta_con_los_png> --apply

La carpeta de origen es la que produce `node scripts/_flujograma.mjs --todos --out <carpeta>`
(por defecto genera en `tools/flowchart/.build/`).
"""
import os
import shutil
import sys
from datetime import date

MAESTRO = (r'Y:\Ingenieria\Documentacion Gestion Ingenieria'
           r'\8. Flujograma Sinóptico (I-IN-002III)\CLIENTES\VWA\PATAGONIA')
PPAP = r'Y:\BARACK\CALIDAD\DOCUMENTACION SGC\PPAP CLIENTES'

VW427 = r'VW\VW427-1LA_K-PATAGONIA'
EL20 = '20- Flujograma de proceso'

# id -> (png de origen, carpeta producto, viejos a archivar ahi,
#        carpeta del elemento 20 del legajo, viejos a archivar ahi)
FLUJOGRAMAS = {
    '151': ('FLUJOGRAMA_151-APB-TRASERO-CENTRAL.png',
            'APB REAR CENTER',
            ['FLUJOGRAMA_151_ APB TRA CEN_PATAGONIA_REV.A.vsdx'],
            rf'{VW427}\Armrest Rear\1-APQP\{EL20}',
            ['DIAGRAMA_DE_FLUJO_DE_PROCESO___APOYABRAZOS_TRASERO_CENTRAL (1).png']),
    '152': ('FLUJOGRAMA_152-APOYACABEZAS.png',
            'APC',
            ['FLUJOGRAMA_DE_PROCESO_APOYACABEZAS__TODOS_.png'],
            rf'{VW427}\Headrest\APQP\{EL20}',
            ['FLUJOGRAMA_DE_PROCESO_APOYACABEZAS.png']),
    '153': ('FLUJOGRAMA_153-ARMREST-DOOR-PANEL.png',
            'ARMREST DOOR PANEL',
            ['FLUJOGRAMA_153_ARMREST_REV.A.vsdx'],
            rf'NOVAX\Tapizadas puerta\{EL20}',
            []),
    '155': ('FLUJOGRAMA_155-TOP-ROLL.png',
            'TOP ROLL',
            ['122 FLUJOGRAMA TOP ROLL PAT 2..vsdx',
             '122 FLUJOGRAMA TOP ROLL PAT 2.vsdx'],
            rf'NOVAX\Tapizadas puerta\{EL20}',
            []),
    '157': ('FLUJOGRAMA_157-IP-PAD.png',
            'IP PAD',   # no existe: se crea
            [],
            rf'{VW427}\IP PADs\APQP\{EL20}',
            []),
}

HOY = date.today().strftime('%d-%m-%Y')


def nombre_libre(carpeta, raiz, ext):
    """Nombre de archivado que NO pise uno existente (misma logica que el de AMFEs)."""
    destino = os.path.join(carpeta, f'{raiz} ({HOY}){ext}')
    n = 2
    while os.path.exists(destino):
        destino = os.path.join(carpeta, f'{raiz} ({HOY}-{n}){ext}')
        n += 1
    return destino


def png_a_pdf(png, pdf):
    """Una pagina PDF con la imagen entera. resolution fija el tamaño de pagina."""
    from PIL import Image
    with Image.open(png) as img:
        img.convert('RGB').save(pdf, 'PDF', resolution=150)


def armar_plan(origen):
    """[(src, dst, [viejos a archivar en la carpeta destino])] + carpetas a crear + problemas."""
    acciones, crear, problemas = [], [], []
    for fid, (png, dir_prod, viejos_prod, dir_ppap, viejos_ppap) in FLUJOGRAMAS.items():
        src_png = os.path.join(origen, png)
        if not os.path.exists(src_png):
            problemas.append(f'FALTA el origen: {src_png}')
            continue

        # PDF generado al lado del PNG de origen (mismo nombre)
        src_pdf = os.path.splitext(src_png)[0] + '.pdf'

        carpeta_prod = os.path.join(MAESTRO, dir_prod)
        if not os.path.isdir(carpeta_prod):
            if fid == '157':
                crear.append(carpeta_prod)
            else:
                problemas.append(f'NO EXISTE la carpeta destino: {carpeta_prod}')
                continue

        carpeta_ppap = os.path.join(PPAP, dir_ppap)
        if not os.path.isdir(carpeta_ppap):
            problemas.append(f'NO EXISTE la carpeta destino: {carpeta_ppap}')
            continue

        for viejo in viejos_prod + viejos_ppap:
            base = carpeta_prod if viejo in viejos_prod else carpeta_ppap
            if not os.path.exists(os.path.join(base, viejo)):
                problemas.append(f'NO ESTA el archivo viejo a archivar: {os.path.join(base, viejo)}')

        acciones.append((src_png, os.path.join(carpeta_prod, png),
                         [os.path.join(carpeta_prod, v) for v in viejos_prod]))
        acciones.append((src_pdf, os.path.join(carpeta_ppap, os.path.basename(src_pdf)),
                         [os.path.join(carpeta_ppap, v) for v in viejos_ppap]))
    return acciones, crear, problemas


def mostrar_plan(acciones, crear, problemas):
    print(f'PLAN — {len(acciones)} archivo(s) a copiar\n')
    for carpeta in crear:
        print(f'  CREAR carpeta: {carpeta}')
    for src, dst, viejos in acciones:
        print(f'  {os.path.basename(dst)}')
        print(f'     -> {os.path.dirname(dst)}')
        for v in viejos:
            print(f'     ARCHIVA "{os.path.basename(v)}" en OBSOLETO\\ como "... ({HOY})"')
        if os.path.exists(dst):
            print(f'     ARCHIVA el existente en OBSOLETO\\ como "... ({HOY})"')
    a_archivar = sum(len(v) for _, _, v in acciones)
    a_archivar += sum(1 for _, dst, _ in acciones if os.path.exists(dst))
    print(f'\n  TOTAL: {len(acciones)} copias, {a_archivar} archivo(s) a archivar.')
    print('  Nada se borra: lo reemplazado se MUEVE a OBSOLETO\\.')
    if problemas:
        print(f'\n  PROBLEMAS ({len(problemas)}):')
        for p in problemas:
            print(f'    - {p}')


def archivar(archivo):
    obsoleto = os.path.join(os.path.dirname(archivo), 'OBSOLETO')
    os.makedirs(obsoleto, exist_ok=True)
    raiz, ext = os.path.splitext(os.path.basename(archivo))
    destino = nombre_libre(obsoleto, raiz, ext)
    shutil.move(archivo, destino)
    print(f'  archivado  {os.path.basename(destino)}')


def ejecutar(acciones, crear):
    copiados, archivados, fallos = 0, 0, []
    for carpeta in crear:
        os.makedirs(carpeta, exist_ok=True)
        print(f'  creada  {carpeta}')
    for src, dst, viejos in acciones:
        try:
            for v in viejos:
                if os.path.exists(v):
                    archivar(v)
                    archivados += 1
            if os.path.exists(dst):
                archivar(dst)
                archivados += 1
            shutil.copy2(src, dst)
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
        sys.exit('Uso: python scripts/_distribuirFlujogramasPatagonia.py <carpeta_con_los_png> [--apply]')
    origen = os.path.abspath(sys.argv[1])
    if not os.path.isdir(origen):
        sys.exit(f'ERROR: no existe la carpeta de origen {origen}')

    # Los PDF se generan SIEMPRE (tambien en dry-run) para poder mirarlos antes de aplicar.
    for fid, (png, *_resto) in FLUJOGRAMAS.items():
        src_png = os.path.join(origen, png)
        if os.path.exists(src_png):
            png_a_pdf(src_png, os.path.splitext(src_png)[0] + '.pdf')

    acciones, crear, problemas = armar_plan(origen)
    mostrar_plan(acciones, crear, problemas)
    if problemas:
        print('\nHay problemas sin resolver: no se ejecuta nada. Corregir y reintentar.')
        sys.exit(1)
    if '--apply' not in sys.argv:
        print('\nDRY-RUN. Agrega --apply para copiar.')
        sys.exit(0)
    print()
    ejecutar(acciones, crear)
