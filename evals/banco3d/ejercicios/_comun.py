"""Ayudas comunes de las piezas del banco: copiar un 3D real de la nube verificando su sha256.
Si la fuente no esta o cambio (otro sha256), la pieza NO se construye: sale con 2 y lo dice."""
import hashlib, json, os, shutil, sys

# Carpeta 3D de la nube de Ingenieria. Se puede cambiar con la variable BANCO3D_NUBE_3D.
NUBE_3D = os.environ.get('BANCO3D_NUBE_3D', r'C:\Users\FacundoS-PC\BARACK ARGENTINA SRL\Ingeniería y Proyecto - General'
                         r'\INGENIERIA BARACK (NUNCA BORRAR)\1- GENERAL\5. 3D')


def sha256(ruta):
    h = hashlib.sha256()
    with open(ruta, 'rb') as f:
        for bloque in iter(lambda: f.read(1 << 20), b''):
            h.update(bloque)
    return h.hexdigest()


def salir_error(texto):
    print(json.dumps({'error': texto}, ensure_ascii=True), flush=True)
    sys.exit(2)


def ruta_nube(relativa):
    return os.path.join(NUBE_3D, *relativa.split('/'))


def verificar(relativa, sha_esperado):
    """Devuelve la ruta de NUBE_3D/relativa si existe y su sha256 coincide; si no, sale con 2."""
    origen = ruta_nube(relativa)
    if not os.path.exists(origen):
        salir_error(f'no esta la fuente: {relativa}')
    h = sha256(origen)
    if h != sha_esperado:
        salir_error(f'la fuente cambio (sha256 {h}, se esperaba {sha_esperado}): {relativa}')
    return origen


def copiar(relativa, sha_esperado, carpeta, nombre_salida):
    """Copia NUBE_3D/relativa a carpeta/nombre_salida si el sha256 coincide. Devuelve la ruta copiada."""
    origen = ruta_nube(relativa)
    if not os.path.exists(origen):
        salir_error(f'no esta la fuente: {relativa}')
    h = sha256(origen)
    if h != sha_esperado:
        salir_error(f'la fuente cambio (sha256 {h}, se esperaba {sha_esperado}): {relativa}')
    os.makedirs(carpeta, exist_ok=True)
    destino = os.path.join(carpeta, nombre_salida)
    shutil.copyfile(origen, destino)
    return destino


def carpeta_salida():
    if len(sys.argv) < 2:
        salir_error('uso: python <pieza>.py <carpeta_salida>')
    os.makedirs(sys.argv[1], exist_ok=True)
    return sys.argv[1]
