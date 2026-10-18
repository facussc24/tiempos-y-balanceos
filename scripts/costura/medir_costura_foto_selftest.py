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


def sobre_hoja_real(ruta_hoja, dist_mm=52.4, pieza_gris=120, hilo_gris=25, x0=40, x1=170, borde_y=70, con_costura=True):
    """La pieza dibujada sobre la hoja que imprime hoja_referencia() (300 dpi, con su leyenda): la posicion x 40-170 y el
    borde a 70 mm son los del caso que el auditor hizo fallar el 17/10 (la leyenda caia entre las marcas y la pieza)."""
    img = cv2.imread(ruta_hoja, cv2.IMREAD_GRAYSCALE)
    k = 300 / 25.4
    cv2.rectangle(img, (int(x0 * k), int(borde_y * k)), (int(x1 * k), int((borde_y + 150) * k)), pieza_gris, -1)
    if con_costura:
        x = x0 + 5.0
        while x + 4 <= x1 - 5:
            cv2.line(img, (int(x * k), int((borde_y + dist_mm) * k)), (int((x + 4) * k), int((borde_y + dist_mm) * k)), hilo_gris, max(1, int(round(k))))
            x += 6
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
        casos.append(('VERDE: la hoja de referencia que se imprime tiene las 4 marcas donde el metodo las espera (< 1 px a 300 dpi)', float(np.abs(px - nominal).max()) < 1, float(np.abs(px - nominal).max())))
        # el caso del auditor (17/10): con la hoja que imprime el script y la pieza en x 40-170, la leyenda daba 0,42 mm
        peor = 0.0
        for s in range(3):
            r = m.medir(foto(sobre_hoja_real(ruta), semilla=s))
            peor = max(peor, abs(r['min'] - 52.4), abs(r['max'] - 52.4))
        casos.append(('VERDE: sobre la hoja que imprime el script (con su leyenda), 3 fotos, todos los tramos a < 0,5 de 52,4', peor < 0.5, peor))
        r = m.medir(foto(sobre_hoja_real(ruta, pieza_gris=90, hilo_gris=40), semilla=1))
        casos.append(('VERDE: con menos contraste que se distingue (vinilo 90, hilo 40) sigue midiendo 52,4', abs(r['media'] - 52.4) < 0.5, r['media']))
        # ROJO: si la costura no se distingue, frena en vez de devolver ~1 mm (auditor 17/10)
        for nombre, kw in [('sin costura', {'con_costura': False}), ('hilo apenas mas oscuro (60 contra 40)', {'pieza_gris': 60, 'hilo_gris': 40}),
                           ('hilo mas claro que el vinilo (60 contra 200)', {'pieza_gris': 60, 'hilo_gris': 200})]:
            try:
                r = m.medir(foto(sobre_hoja_real(ruta, **kw), semilla=1))
                casos.append((f'ROJO: {nombre} no da un numero', False, r['media']))
            except m.ErrorMedicion as e:
                casos.append((f'ROJO: {nombre} no da un numero ({str(e)[:40]}...)', True, None))
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
