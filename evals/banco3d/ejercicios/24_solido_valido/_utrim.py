# -*- coding: utf-8 -*-
"""Comun del ejercicio 24: copia un STEP real del virolador desde la carpeta de trabajo local C:\\Dev\\_utrim (no esta en
la nube) y verifica su sha256. BANCO3D_UTRIM cambia la carpeta. Si el archivo no esta o cambio, sale con 2 como
_comun.copiar: la pieza real no se reemplaza por otra."""
import os
import shutil
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from _comun import carpeta_salida, salir_error, sha256  # noqa: E402,F401

UTRIM = os.environ.get('BANCO3D_UTRIM', r'C:\Dev\_utrim')

# relativa a UTRIM -> sha256 completo (empiezan como en el 04_decision.md: f398e2dc18c6d772 y e3ee1ad262c16f02)
ORIGEN = {
    'v13': ('out/v13/virolador_v10_two.step', 'f398e2dc18c6d772f1a0cc6e746b10b11afd7de4addfdcf7b31e8dce3765bb81'),
    'v14': ('out/v14/virolador_v10_two.step', 'e3ee1ad262c16f02f5295fb3930543b54b346d1c6faffbd81fb8580b5b553572'),
}


def copiar(clave, carpeta, nombre_salida):
    relativa, esperado = ORIGEN[clave]
    origen = os.path.join(UTRIM, *relativa.split('/'))
    if not os.path.exists(origen):
        salir_error(f'no esta la fuente: {origen} (BANCO3D_UTRIM cambia la carpeta)')
    h = sha256(origen)
    if h != esperado:
        salir_error(f'la fuente cambio (sha256 {h}, se esperaba {esperado}): {origen}')
    destino = os.path.join(carpeta, nombre_salida)
    shutil.copyfile(origen, destino)
    return destino
