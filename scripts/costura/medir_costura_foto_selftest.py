"""Selftest de medir_costura_foto.py (tanda 13, item 7): imagenes SINTETICAS de medida conocida.

  py -3 scripts/costura/medir_costura_foto_selftest.py      # tiene que dar "0 fallan"

No corre en `npm test` (el CI no instala OpenCV). Se dibuja la hoja de referencia en milimetros, una pieza gris con el
borde de arriba recto y una costura de puntadas negras a una distancia CONOCIDA del borde (52,4 mm, la del delantero que
midio Fak el 15/10), y despues se «saca la foto»: perspectiva de celular inclinado, desenfoque y ruido. El metodo tiene
que devolver la distancia con error menor a 0,5 mm (si pasa 0,5 mm, el informe A dice que sirve solo como control
previo). Casos ROJOS: sin las marcas, o con una marca tapada, no mide.
"""
import os
import sys

import cv2
import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import medir_costura_foto as m  # noqa: E402

K = 8.0  # px por mm de la hoja sintetica


def hoja_sintetica(dist_mm=52.4, giro_grados=0.0, hilo_mm=1.0, puntada_mm=4.0, hueco_mm=2.0, tapar=None):
    w, h = int(m.HOJA_MM[0] * K), int(m.HOJA_MM[1] * K)
    img = np.full((h, w), 245, np.uint8)
    dic = cv2.aruco.getPredefinedDictionary(m.DICCIONARIO)
    lado = int(m.LADO_MARCA_MM * K)
    for i, (cx, cy) in enumerate(m.CENTROS_NOMINALES):
        if tapar == i:
            continue
        mk = cv2.aruco.generateImageMarker(dic, i, lado)
        x0, y0 = int(round(cx * K - lado / 2)), int(round(cy * K - lado / 2))
        img[y0:y0 + lado, x0:x0 + lado] = mk
        cv2.rectangle(img, (x0 - int(3 * K), y0 - int(3 * K)), (x0 + lado + int(3 * K), y0 + lado + int(3 * K)), 245, int(2 * K) - 1)
    # la pieza: un rectangulo de 130 x 150 mm con el borde de arriba en y=70 mm, girado `giro_grados` alrededor de su centro
    cx, cy = 105.0, 145.0
    pieza = np.array([(40, 70), (170, 70), (170, 220), (40, 220)], np.float64)
    t = np.radians(giro_grados)
    R = np.array([[np.cos(t), -np.sin(t)], [np.sin(t), np.cos(t)]])
    rot = lambda p: (R @ (np.array(p) - [cx, cy])) + [cx, cy]
    cv2.fillPoly(img, [np.round(np.array([rot(p) for p in pieza]) * K).astype(np.int32)], 120)
    # la costura: puntadas a `dist_mm` del borde de arriba, de 45 a 165 mm
    x = 45.0
    while x + puntada_mm <= 165:
        a, b = rot((x, 70 + dist_mm)), rot((x + puntada_mm, 70 + dist_mm))
        cv2.line(img, tuple(np.round(a * K).astype(int)), tuple(np.round(b * K).astype(int)), 25, max(1, int(round(hilo_mm * K))))
        x += puntada_mm + hueco_mm
    return img


def foto(img, inclinacion=0.08, semilla=0, ruido=6.0, desenfoque=3):
    """Perspectiva de un celular inclinado: las 4 esquinas se corren hasta `inclinacion` del ancho; despues ruido y blur."""
    rng = np.random.default_rng(semilla)
    h, w = img.shape
    src = np.float32([[0, 0], [w, 0], [w, h], [0, h]])
    dst = src + rng.uniform(-inclinacion, inclinacion, (4, 2)).astype(np.float32) * np.float32([w, h])
    dst -= dst.min(axis=0)
    H = cv2.getPerspectiveTransform(src, dst)
    W, Hh = int(dst[:, 0].max()) + 1, int(dst[:, 1].max()) + 1
    out = cv2.warpPerspective(img, H, (W, Hh), borderValue=200)
    if desenfoque:
        out = cv2.GaussianBlur(out, (desenfoque * 2 + 1, desenfoque * 2 + 1), 0)
    out = np.clip(out.astype(np.float32) + rng.normal(0, ruido, out.shape), 0, 255).astype(np.uint8)
    return out


def main():
    casos = []
    r = m.medir(hoja_sintetica())
    casos.append(('VERDE: sin perspectiva, 52,4 mm con error < 0,1', abs(r['media'] - 52.4) < 0.1, r['media']))
    errores = []
    for s in range(8):
        r = m.medir(foto(hoja_sintetica(), semilla=s))
        errores.append(abs(r['media'] - 52.4))
        errores.append(max(abs(r['max'] - 52.4), abs(r['min'] - 52.4)))
    casos.append((f'VERDE: 8 fotos inclinadas con ruido y desenfoque, error maximo por tramo {max(errores):.2f} mm < 0,5', max(errores) < 0.5, max(errores)))
    r = m.medir(foto(hoja_sintetica(giro_grados=3.0), semilla=11))
    casos.append(('VERDE: pieza girada 3 grados, la distancia es perpendicular al borde (52,4 +- 0,5)', abs(r['media'] - 52.4) < 0.5, r['media']))
    r = m.medir(foto(hoja_sintetica(dist_mm=46.4), semilla=12))
    casos.append(('VERDE: otra distancia conocida, 46,4 mm (la mano del trasero que midio Fak)', abs(r['media'] - 46.4) < 0.5, r['media']))
    import tempfile
    with tempfile.TemporaryDirectory() as d:
        ruta = m.hoja_referencia(os.path.join(d, 'hoja.png'))
        px = m.marcas(cv2.imread(ruta, cv2.IMREAD_GRAYSCALE))
        nominal = np.array(m.CENTROS_NOMINALES) * 300 / 25.4
        casos.append(('VERDE: la hoja de referencia que se imprime tiene las 4 marcas donde el metodo las espera (< 2 px a 300 dpi)', float(np.abs(px - nominal).max()) < 2, float(np.abs(px - nominal).max())))
    sin = np.full((800, 600), 245, np.uint8)
    try:
        m.medir(sin)
        casos.append(('ROJO: sin marcas no mide', False, None))
    except m.ErrorMedicion as e:
        casos.append(('ROJO: sin marcas no mide', 'no encontre las 4 marcas' in str(e), None))
    try:
        m.medir(foto(hoja_sintetica(tapar=2), semilla=3))
        casos.append(('ROJO: con una marca tapada no mide', False, None))
    except m.ErrorMedicion as e:
        casos.append(('ROJO: con una marca tapada no mide', 'faltan [2]' in str(e), None))
    malos = 0
    for nombre, ok, valor in casos:
        malos += not ok
        print(f'  {"ok" if ok else "MAL"}  {nombre}' + (f'  (medido {valor:.3f})' if isinstance(valor, float) else ''))
    print(f'{len(casos)} casos, {malos} fallan.')
    sys.exit(1 if malos else 0)


if __name__ == '__main__':
    main()
