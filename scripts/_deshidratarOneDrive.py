# -*- coding: utf-8 -*-
"""Libera espacio local de archivos que YA ESTAN subidos a OneDrive. NO BORRA NADA.

Deshidratar = marcar UNPINNED y sacar PINNED (lo que el menu de Windows llama "Liberar
espacio"). El archivo sigue COMPLETO en la nube y pasa a ocupar 0 bytes locales; vuelve a
bajarse solo con abrirlo. Un archivo que TODAVIA NO SUBIO nunca se toca: deshidratarlo lo
dejaria sin ningun ejemplar en el mundo.

  Regla de la casa (Fak, 07/09/2026): el material de Fak NO se borra para hacer lugar.
  El disco se libera deshidratando. Memoria feedback_material_de_fak_no_se_borra_va_a_la_nube.

Uso:
    python scripts/_deshidratarOneDrive.py "<carpeta>" [...]  [--ext .mov,.mp4] [--patron 2026-09]
    ... --recursivo para barrer el arbol entero (sin esto mira SOLO el primer nivel)
    ... agregar --aplicar para que haga el trabajo (sin eso es dry-run y no toca nada)

Por que esta escrito con esta combinacion rara de PowerShell + ctypes (07/09/2026, cinco
intentos fallidos, cada uno por un motivo distinto):

LEER "ya subio?" = el bit FILE_ATTRIBUTE_REPARSE_POINT. Solo lo ve `Get-ChildItem`
(FindFirstFile). Las tres vias de Python contestan que NO para TODOS los archivos de OneDrive,
subidos o no: `os.stat()` sigue el reparse point y devuelve los atributos del destino;
`os.lstat()` tampoco sirve porque CPython BORRA ese bit cuando el tag no es un name surrogate,
y el de OneDrive (IO_REPARSE_TAG_CLOUD) no lo es; y `GetFileAttributesW` por ctypes viene
igual de recortado. El mismo archivo: Get-ChildItem dice 0x501620 y GetFileAttributesW dice
0x500020. Por eso el "ya subio?" se pregunta a PowerShell y nada mas.

ESCRIBIR el atributo. `attrib.exe +U -P` responde "Formato de parametros incorrecto" con
nombres largos, con espacios y comas, aunque vayan entre comillas — y ADEMAS sale con codigo 0,
asi que miente el resultado (reporte "deshidratados: 24" con 5 hechos). Y PowerShell
`[IO.File]::SetAttributes(..., [IO.FileAttributes]$n)` explota con UndefinedIntegerToEnum
porque UNPINNED y RECALL no estan en el enum de .NET. Queda `SetFileAttributesW` de kernel32,
que no valida enums ni parsea linea de comandos.

VERIFICAR. El marcador de "esta deshidratado" es RECALL_ON_DATA_ACCESS (0x400000), NO el
atributo Offline y NO UNPINNED — UNPINNED (0x100000) es el bit que escribe este script, o sea
que verificar con el confirma la propia escritura, no que OneDrive haya vaciado el archivo.
RECALL y UNPINNED SI sobreviven a GetFileAttributesW, asi que esa parte se puede leer de aca.
OneDrive libera con demora de segundos a minutos: se reverifica en loop, no una sola vez.

🔴 Los metadatos se sacan ANTES: cualquier lectura (ffprobe, hash, un preview) REHIDRATA el
archivo entero. Memoria reference_onedrive_files_on_demand_liberar_espacio.
"""
import ctypes
import io
import os
import subprocess
import sys
import tempfile
import time

PINNED = 0x00080000
UNPINNED = 0x00100000
RECALL = 0x00400000
INVALIDO = 0xFFFFFFFF

_get = ctypes.windll.kernel32.GetFileAttributesW
_get.argtypes = [ctypes.c_wchar_p]
_get.restype = ctypes.c_uint32
_set = ctypes.windll.kernel32.SetFileAttributesW
_set.argtypes = [ctypes.c_wchar_p, ctypes.c_uint32]
_set.restype = ctypes.c_bool

# Escribe una linea por archivo que YA SUBIO y todavia ocupa disco. La carpeta entra como
# ARGUMENTO, nunca literal adentro del .ps1: powershell.exe lee el script como ANSI y las
# rutas de Barack llevan tildes (arbol de carpetas fantasma, 07/08/2026).
PS = r'''
param([string]$Carpeta, [string]$Salida, [string]$Ext, [string]$Patron, [string]$Recursivo)
$hidratados = @(); $subiendo = @()
$gci = @{ LiteralPath = $Carpeta; File = $true; Force = $true
          ErrorAction = "SilentlyContinue"; ErrorVariable = "errGci" }
if ($Recursivo -eq "1") { $gci.Recurse = $true }
foreach ($f in (Get-ChildItem @gci)) {
    if ($Ext -and ($Ext -split ',') -notcontains $f.Extension.ToLower()) { continue }
    if ($Patron -and $f.Name -notmatch $Patron) { continue }
    $a = [int]$f.Attributes
    if (-not ($a -band 0x400)) { $subiendo += $f.FullName; continue }   # no subio: no se toca
    if ($a -band 0x400000) { continue }                                 # ya deshidratado
    $hidratados += $f.FullName
}
[IO.File]::AppendAllLines($Salida, [string[]]$hidratados, [Text.UTF8Encoding]::new($false))
foreach ($s in $subiendo) { Write-Output ("TODAVIA NO SUBIO - no se toca: " + [IO.Path]::GetFileName($s)) }
if ($errGci) {
    Write-Output ("NO SE PUDO LEER: " + $errGci.Count + " carpeta(s): lo que haya adentro NO se conto")
    $errGci | Select-Object -First 5 | ForEach-Object { Write-Output ("   " + $_.CategoryInfo.TargetName) }
}
'''


def atributos(ruta):
    a = _get(ruta)
    if a == INVALIDO:
        raise OSError('GetFileAttributesW fallo en %s' % ruta)
    return a


def hidratados(carpetas, ext, patron, recursivo=False):
    """Los que ya subieron y todavia ocupan disco, segun PowerShell (el unico que ve el
    ReparsePoint). Devuelve rutas absolutas."""
    ps = os.path.join(tempfile.gettempdir(), '_deshidratarOneDrive.ps1')
    with io.open(ps, 'w', encoding='utf-8') as fh:
        fh.write(PS)
    salida = os.path.join(tempfile.gettempdir(), '_deshidratarOneDrive.txt')
    if os.path.exists(salida):
        os.remove(salida)
    for carpeta in carpetas:
        if not os.path.isdir(carpeta):
            print('NO ESTA  %s' % carpeta)
            continue
        r = subprocess.run(['powershell', '-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', ps,
                            '-Carpeta', carpeta, '-Salida', salida, '-Ext', ext, '-Patron', patron,
                            '-Recursivo', '1' if recursivo else '0'],
                           capture_output=True, text=True)
        # con un decode fallido subprocess devuelve None, y .strip() explotaba
        if (r.stdout or '').strip():
            print(r.stdout.strip())
        if r.returncode:
            print((r.stderr or '(sin stderr legible)').strip())
    if not os.path.exists(salida):
        return []
    with io.open(salida, encoding='utf-8') as fh:
        return [l.strip() for l in fh if l.strip()]


def main():
    args = sys.argv[1:]
    aplicar = '--aplicar' in args
    recursivo = '--recursivo' in args
    args = [a for a in args if a not in ('--aplicar', '--recursivo')]
    ext = patron = ''
    for bandera in ('--ext', '--patron'):
        if bandera in args:
            i = args.index(bandera)
            valor = args[i + 1]
            args = args[:i] + args[i + 2:]
            if bandera == '--ext':
                ext = valor.lower()
            else:
                patron = valor
    if not args:
        print(__doc__)
        return 2

    rutas = hidratados(args, ext, patron, recursivo)
    if not rutas:
        print('No hay nada para deshidratar: o ya estan todos en 0 bytes, o todavia estan subiendo.')
        return 0

    tam = {r: os.path.getsize(r) for r in rutas}
    print('%d archivos ya subidos ocupan %.2f GB de disco'
          % (len(rutas), sum(tam.values()) / 1073741824.0))
    if not aplicar:
        # en un barrido recursivo la lista entera son miles de lineas: van los 20 mas grandes
        top = sorted(rutas, key=lambda x: -tam[x])[:20]
        for r in top:
            print('  %7.1f MB  %s' % (tam[r] / 1048576.0, r if recursivo else os.path.basename(r)))
        if len(rutas) > len(top):
            print('  ... y %d archivo(s) mas' % (len(rutas) - len(top)))
        print('PLAN (dry-run). Nada se toco. Para aplicar: --aplicar')
        return 0

    for r in rutas:
        if not _set(r, (atributos(r) | UNPINNED) & ~PINNED):
            print('SetFileAttributesW fallo  %s' % os.path.basename(r))

    pendientes, libres, bytes_libres = list(rutas), 0, 0
    for _ in range(30):
        quedan = []
        for r in pendientes:
            if atributos(r) & RECALL:
                libres += 1
                bytes_libres += tam[r]
            else:
                quedan.append(r)
        pendientes = quedan
        if not pendientes:
            break
        time.sleep(10)

    print('deshidratados: %d de %d  (%.2f GB liberados)'
          % (libres, len(rutas), bytes_libres / 1073741824.0))
    for r in pendientes[:20]:
        print('SIGUE OCUPANDO  0x%06x  %s' % (atributos(r), os.path.basename(r)))
    if len(pendientes) > 20:
        print('  ... y %d mas' % (len(pendientes) - 20))
    # Si NINGUNO se libero y todos quedaron con UNPINNED puesto y RECALL apagado, el bit se
    # escribio bien: el que no esta trabajando es el motor de sync. Marcar no vacia el archivo.
    if pendientes and not libres:
        atras = [x for x in pendientes if atributos(x) & UNPINNED and not atributos(x) & RECALL]
        if len(atras) == len(pendientes):
            print('\nOJO: el atributo quedo escrito en los %d y OneDrive no vacio ninguno.'
                  % len(pendientes))
            print('     Quien vacia el archivo es el motor de sync, no este script: si esta')
            print('     colgado, el pedido queda encolado para siempre. Medir el atraso y, si')
            print('     no se mueve, reconstruir el indice — memoria')
            print('     reference_onedrive_sync_colgado_como_detectarlo.')
    return 1 if pendientes else 0


if __name__ == '__main__':
    sys.exit(main())
