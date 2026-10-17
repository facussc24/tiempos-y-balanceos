"""Mide la distancia BORDE -> COSTURA de una pieza cosida en una FOTO, sin calibre (tanda 13, item 7, 17/10/2026).

Por que: en la costura CNC del Insert la maquina no cose donde dice el dibujo y, midiendo con calibre sin estacion fija,
hay +-1,4 mm de ruido (memoria project_insert_muesca_costura_cnc). Con una foto sobre una hoja de referencia se mide toda
una tirada en vez de 4 a 9 piezas, y los numeros entran directo a la cuenta de aptitud (`scripts/_aptitudMaquina.mjs`).

Como funciona:
  1. La pieza se apoya sobre una HOJA DE REFERENCIA impresa con 4 marcas ArUco (diccionario 4x4_50, ids 0 a 3) en
     posiciones conocidas. **La hoja impresa se MIDE con regla y esos numeros se pasan con --centros**: no se confia en el
     tamaño nominal de la impresora. `--hoja-referencia salida.png` la genera (A4, a 300 dpi).
  2. Las 4 marcas dan la homografia foto -> hoja: la foto se endereza a una vista de arriba, en milimetros (no importa que
     el celular este inclinado).
  3. La pieza es lo oscuro sobre la hoja blanca; el BORDE de referencia es el de arriba de la pieza en la hoja enderezada
     (poner la pieza con ese borde hacia el lado de las marcas 0 y 1). La COSTURA es lo que es mas oscuro que la pieza.
  4. Se ajusta una recta al borde y otra al centro de la hilera de puntadas, y se mide la distancia perpendicular del
     centro de la puntada al borde, por tramos de --tramo mm a lo largo del borde.

Lo que NO esta probado: fotos reales. Esta probado sobre imagenes sinteticas de medida conocida, con perspectiva, ruido y
desenfoque (`medir_costura_foto_selftest.py`). Con una pieza real hacen falta: la hoja impresa y medida, la pieza con
contraste contra el papel, luz pareja y el hilo mas oscuro que el vinilo (si no, --umbral-costura). Lo que se mide es al
CENTRO de la puntada, no a su borde: el calibre de Fak midio «hasta la hilera de afuera».

Uso:
  py -3 scripts/costura/medir_costura_foto.py --hoja-referencia hoja.png
  py -3 scripts/costura/medir_costura_foto.py foto.jpg [--centros "20,20;190,20;190,277;20,277"] [--tramo 10]
        [--umbral-pieza N] [--umbral-costura N] [--costura-desde MM]
Si el hilo no se distingue del vinilo (poco contraste, hilo mas claro, sin costura) NO devuelve un numero: frena y lo
dice. Solo se mide lo que esta adentro del rectangulo de los centros de las 4 marcas.
Salida: los valores por tramo (con coma) y el resumen; `--valores` imprime solo los valores, para pasarlos a
`node scripts/_aptitudMaquina.mjs --valores "..."`.
"""
import sys

import cv2
import numpy as np

DICCIONARIO = cv2.aruco.DICT_4X4_50
LADO_MARCA_MM = 20.0
CENTROS_NOMINALES = [(20.0, 20.0), (190.0, 20.0), (190.0, 277.0), (20.0, 277.0)]  # A4 vertical, mm
HOJA_MM = (210.0, 297.0)
PX_POR_MM = 10.0


class ErrorMedicion(Exception):
    pass


def hoja_referencia(ruta, dpi=300):
    """A4 blanca con las 4 marcas en CENTROS_NOMINALES. Se imprime al 100 % y despues se mide con regla."""
    k = dpi / 25.4
    w, h = int(round(HOJA_MM[0] * k)), int(round(HOJA_MM[1] * k))
    img = np.full((h, w), 255, np.uint8)
    dic = cv2.aruco.getPredefinedDictionary(DICCIONARIO)
    lado = int(round(LADO_MARCA_MM * k))
    for i, (cx, cy) in enumerate(CENTROS_NOMINALES):
        m = cv2.aruco.generateImageMarker(dic, i, lado)
        x0, y0 = int(round(cx * k - lado / 2)), int(round(cy * k - lado / 2))
        img[y0:y0 + lado, x0:x0 + lado] = m
    # La leyenda va ABAJO de las marcas 2 y 3, afuera de la zona que se mide (auditor 17/10: escrita entre las marcas 0/1 y
    # la pieza, el metodo tomaba sus letras como borde y como costura y daba 0,42 mm en un tramo).
    cv2.putText(img, 'Hoja de referencia - medir la distancia entre centros con regla', (int(15 * k), int(293 * k)),
                cv2.FONT_HERSHEY_SIMPLEX, 0.5 * k / 11.8, 0, 2)
    cv2.imwrite(ruta, img)
    return ruta


def marcas(gris):
    """Centros en pixeles de las marcas 0 a 3. Tira si falta alguna."""
    det = cv2.aruco.ArucoDetector(cv2.aruco.getPredefinedDictionary(DICCIONARIO), cv2.aruco.DetectorParameters())
    esquinas, ids, _ = det.detectMarkers(gris)
    encontradas = {}
    if ids is not None:
        for c, i in zip(esquinas, ids.flatten()):
            if 0 <= int(i) <= 3:
                encontradas[int(i)] = c.reshape(4, 2).mean(axis=0)
    faltan = [i for i in range(4) if i not in encontradas]
    if faltan:
        raise ErrorMedicion(f'no encontre las 4 marcas de la hoja de referencia (faltan {faltan}): la hoja entera tiene que verse en la foto')
    return np.array([encontradas[i] for i in range(4)], np.float64)


def enderezar(img, centros_mm=CENTROS_NOMINALES, k=PX_POR_MM):
    gris = img if img.ndim == 2 else cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    px = marcas(gris)
    destino = np.array(centros_mm, np.float64) * k
    H, _ = cv2.findHomography(px, destino)
    w, h = int(round(HOJA_MM[0] * k)), int(round(HOJA_MM[1] * k))
    return cv2.warpPerspective(gris, H, (w, h), flags=cv2.INTER_LINEAR, borderValue=255)


def _sin_marcas(mascara, centros_mm, k):
    """Solo lo que esta ADENTRO del rectangulo de los centros de las marcas, sin las marcas: lo de afuera (la leyenda,
    el borde de la hoja, la mesa) no puede pasar por pieza."""
    m = np.zeros_like(mascara)
    xs = [c[0] for c in centros_mm]
    ys = [c[1] for c in centros_mm]
    y0, y1 = int(round(min(ys) * k)), int(round(max(ys) * k))
    x0, x1 = int(round(min(xs) * k)), int(round(max(xs) * k))
    m[y0:y1, x0:x1] = mascara[y0:y1, x0:x1]
    r = int(round((LADO_MARCA_MM / 2 + 4) * k))
    for cx, cy in centros_mm:
        x, y = int(round(cx * k)), int(round(cy * k))
        m[max(0, y - r):y + r, max(0, x - r):x + r] = 0
    return m


# Una costura de verdad es una franja ANGOSTA y SEPARADA del borde. Si «lo oscuro adentro de la pieza» es mas de este
# pedazo de la pieza, no se distingue la costura del vinilo (hilo apenas mas oscuro, hilo mas claro, o sin costura) y se
# frena en vez de devolver ~1 mm (auditor 17/10: con poco contraste daba 1,02 mm sin aviso).
TOPE_FRACCION_COSTURA = 0.15
COSTURA_DESDE_MM = 2.0   # la hilera empieza a 2 mm o mas del borde (la del APB va a 4 +-1 mm)
COSTURA_ANCHO_MAX_MM = 3.0


def medir(img, centros_mm=CENTROS_NOMINALES, k=PX_POR_MM, tramo_mm=10.0, umbral_pieza=None, umbral_costura=None,
          costura_desde_mm=COSTURA_DESDE_MM):
    """Distancia borde -> centro de la costura por tramos, en mm. Devuelve {'tramos': [...], 'media', 'min', 'max'}."""
    plano = enderezar(img, centros_mm, k)
    suave = cv2.GaussianBlur(plano, (5, 5), 0)
    adentro_hoja = _sin_marcas(np.ones_like(suave, np.uint8), centros_mm, k) > 0
    up = umbral_pieza if umbral_pieza is not None else cv2.threshold(suave[adentro_hoja].reshape(-1, 1), 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)[0]
    pieza = _sin_marcas((suave < up).astype(np.uint8), centros_mm, k)
    pieza = cv2.morphologyEx(pieza, cv2.MORPH_OPEN, np.ones((5, 5), np.uint8))
    ys, xs = np.nonzero(pieza)
    if len(xs) < 1000:
        raise ErrorMedicion('no encontre la pieza sobre la hoja (poca diferencia entre la pieza y el papel: probar --umbral-pieza)')
    # la costura: lo mas oscuro DENTRO de la pieza (Otsu sobre los pixeles de la pieza, si no se da el umbral)
    adentro = cv2.erode(pieza, np.ones((7, 7), np.uint8))
    valores = suave[adentro > 0]
    uc = umbral_costura if umbral_costura is not None else cv2.threshold(valores.reshape(-1, 1), 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)[0]
    costura = ((suave < uc) & (adentro > 0)).astype(np.uint8)
    fraccion = costura.sum() / max(1, int((adentro > 0).sum()))
    if fraccion > TOPE_FRACCION_COSTURA:
        raise ErrorMedicion(f'no distingo la costura del vinilo ({fraccion:.0%} de la pieza parece costura): el hilo tiene que ser mas oscuro que la pieza; probar --umbral-costura o mejorar la luz')
    desde, ancho_max = costura_desde_mm * k, COSTURA_ANCHO_MAX_MM * k
    x0, x1 = xs.min(), xs.max()
    paso = int(round(tramo_mm * k))
    tramos = []
    for a in range(x0 + paso // 2, x1 - paso // 2, paso):
        cols = range(a, min(a + paso, x1))
        borde, puntada = [], []
        for c in cols:
            col = np.nonzero(pieza[:, c])[0]
            if not len(col):
                continue
            yb = col.min()
            borde.append((c, yb))
            cs = np.nonzero(costura[yb:, c])[0]
            if len(cs):
                # la primera hilera debajo del borde: el tramo continuo de pixeles oscuros mas cercano al borde
                corrida = [cs[0]]
                for v in cs[1:]:
                    if v != corrida[-1] + 1:
                        break
                    corrida.append(v)
                # pegada al borde o mas ancha que un hilo no es una hilera de puntadas: esa columna no se mide
                if corrida[0] >= desde and corrida[-1] - corrida[0] + 1 <= ancho_max:
                    puntada.append((c, yb + (corrida[0] + corrida[-1]) / 2.0))
        if len(borde) < paso * 0.5 or len(puntada) < 3:
            continue
        vx, vy, px, py = cv2.fitLine(np.array(borde, np.float32), cv2.DIST_L2, 0, 0.01, 0.01).flatten()
        n = np.array([-vy, vx])  # normal al borde
        # un tramo donde el «borde» no es una recta (la esquina de la pieza, una muesca) no se mide: daria cualquier cosa
        resid = [abs(np.dot(np.array(b) - np.array([px, py]), n)) for b in borde]
        if np.percentile(resid, 95) > 0.5 * k:
            continue
        d = [abs(np.dot(np.array(p) - np.array([px, py]), n)) for p in puntada]
        tramos.append(float(np.median(d)) / k)
    if not tramos:
        raise ErrorMedicion('no encontre la costura debajo del borde (el hilo tiene que ser mas oscuro que la pieza: probar --umbral-costura)')
    return {'tramos': tramos, 'media': float(np.mean(tramos)), 'min': float(min(tramos)), 'max': float(max(tramos))}


def coma(x, d=2):
    return f'{x:.{d}f}'.replace('.', ',')


def main(argv):
    if not argv:
        sys.exit(__doc__)
    if argv[0] == '--hoja-referencia':
        if len(argv) != 2:
            sys.exit('uso: --hoja-referencia salida.png')
        print('hoja de referencia:', hoja_referencia(argv[1]), '(imprimir al 100 % y medir la distancia entre centros)')
        return 0
    foto, resto = argv[0], argv[1:]
    centros, tramo, solo_valores = CENTROS_NOMINALES, 10.0, False
    up = uc = None
    desde = COSTURA_DESDE_MM
    while resto:
        a = resto.pop(0)
        if a == '--centros' and resto:
            centros = [tuple(float(v.replace(',', '.')) for v in p.split(',', 1)) if p.count(',') == 1 else (None, None) for p in resto.pop(0).split(';')]
            if len(centros) != 4 or any(c[0] is None for c in centros):
                sys.exit('--centros va como "x0,y0;x1,y1;x2,y2;x3,y3" en mm, con punto decimal (4 marcas)')
        elif a == '--tramo' and resto:
            tramo = float(resto.pop(0).replace(',', '.'))
        elif a == '--umbral-pieza' and resto:
            up = int(resto.pop(0))
        elif a == '--umbral-costura' and resto:
            uc = int(resto.pop(0))
        elif a == '--costura-desde' and resto:
            desde = float(resto.pop(0).replace(',', '.'))
        elif a == '--valores':
            solo_valores = True
        else:
            sys.exit(f'argumento que no conozco: {a}. No hago nada.')
    img = cv2.imread(foto)
    if img is None:
        sys.exit(f'no pude abrir la foto {foto}')
    try:
        r = medir(img, centros, tramo_mm=tramo, umbral_pieza=up, umbral_costura=uc, costura_desde_mm=desde)
    except ErrorMedicion as e:
        print(f'*** {e}', file=sys.stderr)
        return 1
    vals = ' '.join(coma(t) for t in r['tramos'])
    if solo_valores:
        print(vals)
        return 0
    print(f'{len(r["tramos"])} tramos de {coma(tramo, 0)} mm: {vals}')
    print(f'media {coma(r["media"])} mm · min {coma(r["min"])} · max {coma(r["max"])} (borde de arriba -> centro de la puntada)')
    return 0


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
