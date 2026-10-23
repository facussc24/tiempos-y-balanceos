# -*- coding: utf-8 -*-
"""Ejercicio 00 del obrero: prueba del ciclo entero SIN abrir CATIA. Es lo primero que corre la notebook.

Uso: python catia.py <carpeta de trabajo>. Lee <trabajo>/asignado.json (si esta), hace una cuenta trivial (volumen de
una caja de 60 x 40 x 20 mm = 48 000 mm3, la misma pieza de ensayo del ejercicio 04), dibuja un PNG de 100 x 100 sin
ninguna biblioteca, y mira sin abrir nada si en esta PC estan pywin32 y la clase COM de CATIA. Escribe salida.json.
"""
import json
import os
import platform
import struct
import sys
import time
import zlib


def png(ruta, ancho=100, alto=100):
    """PNG en escala de grises: fondo blanco, borde negro de 3 px y una diagonal (zlib + struct, sin Pillow)."""
    filas = []
    for y in range(alto):
        fila = bytearray([0])                                   # filtro 0 por fila
        for x in range(ancho):
            negro = x < 3 or y < 3 or x >= ancho - 3 or y >= alto - 3 or abs(x - y) <= 1
            fila.append(0 if negro else 255)
        filas.append(bytes(fila))

    def bloque(tipo, datos):
        return struct.pack(">I", len(datos)) + tipo + datos + struct.pack(">I", zlib.crc32(tipo + datos) & 0xFFFFFFFF)

    cab = struct.pack(">IIBBBBB", ancho, alto, 8, 0, 0, 0, 0)   # 8 bits, gris, sin entrelazar
    with open(ruta, "wb") as f:
        f.write(b"\x89PNG\r\n\x1a\n" + bloque(b"IHDR", cab) + bloque(b"IDAT", zlib.compress(b"".join(filas), 9))
                + bloque(b"IEND", b""))
    return os.path.getsize(ruta)


def diagnostico():
    """Sin arrancar CATIA: pywin32 se puede importar? la clase CATIA.Application esta registrada en Windows?"""
    d = {}
    try:
        import win32com.client  # noqa: F401
        d["pywin32"] = "instalado"
    except Exception as e:  # noqa: BLE001
        d["pywin32"] = f"NO se pudo importar: {e!r}"[:200]
    try:
        import winreg
        with winreg.OpenKey(winreg.HKEY_CLASSES_ROOT, r"CATIA.Application\CLSID") as k:
            d["catia_com_registrada"] = True
            d["catia_clsid"] = winreg.QueryValueEx(k, "")[0]
    except OSError:
        d["catia_com_registrada"] = False
    except Exception as e:  # noqa: BLE001
        d["catia_com_registrada"] = f"no se pudo mirar: {e!r}"[:200]
    return d


def main():
    if len(sys.argv) < 2:
        print("uso: python catia.py <carpeta de trabajo>", file=sys.stderr)
        return 2
    carpeta = os.path.abspath(sys.argv[1])
    os.makedirs(carpeta, exist_ok=True)
    t0 = time.time()
    try:
        with open(os.path.join(carpeta, "asignado.json"), encoding="utf-8") as f:
            asignado = json.load(f)
    except (OSError, ValueError):
        asignado = {}
    largo, ancho, alto = 60.0, 40.0, 20.0
    bytes_png = png(os.path.join(carpeta, "prueba_100x100.png"))
    salida = {
        "ok": True,
        "ejercicio": "00_prueba_sin_catia",
        "abre_catia": False,
        "medidas": {"caja_mm": [largo, ancho, alto], "volumen_caja_mm3": largo * ancho * alto,
                    "esperado_mm3": 48000.0, "cuenta_ok": largo * ancho * alto == 48000.0},
        "png": {"archivo": "prueba_100x100.png", "ancho": 100, "alto": 100, "bytes": bytes_png},
        "archivos": ["prueba_100x100.png"],
        "instrucciones_recibidas": asignado.get("instrucciones"),
        "pc": {"nombre": platform.node(), "python": sys.version.split()[0], "bits": struct.calcsize("P") * 8,
               "windows": platform.platform()},
        "diagnostico": diagnostico(),
        "segundos": round(time.time() - t0, 3),
    }
    with open(os.path.join(carpeta, "salida.json"), "w", encoding="utf-8") as f:
        json.dump(salida, f, ensure_ascii=False, indent=1)
    print("ok", json.dumps(salida["medidas"]))
    return 0


if __name__ == "__main__":
    sys.exit(main())
