# -*- coding: utf-8 -*-
"""Lamina A3 del proceso del Insert Patagonia — armado en DOS FRANJAS que se leen de corrido.

Regla del armado: todo avanza de izquierda a derecha y los numeros van en orden de lectura.
  franja 1: los tres componentes, uno al lado del otro (vinilo 1-2-3, sustrato 4, espuma 5-6)
  franja 2: el armado (7-8-9-10) y la pieza terminada al final, a la derecha

Uso:  python scripts/lamina_proceso/insert_patagonia.py <salida.pptx> <carpeta de datos>
      (la carpeta de datos trae fotos.json, usos.json y las fotos)
"""
from motor import *  # noqa: F401,F403
from PIL import ImageFont

USO = json.load(open(os.path.join(DATOS, "usos.json"), encoding="utf-8"))
ROT = FOTOS.get("_rotar_piezas", 90)

caja(0, 0, W, H, relleno=FONDO)

# ------------------------------------------------------------ encabezado
caja(0, 0, W, 30, relleno=BLANCO)
caja(0, 30, W, 1.6, relleno=AZUL)
lh = 15.0
lw = lh * 1181 / 354
sp.add_picture(os.path.join(AQUI, "logo_barack.png"), Mm(13), Mm(7.5), Mm(lw), Mm(lh))
caja(13 + lw + 7, 7, 0.5, 16, relleno=GRIS_BORDE)
tx = 13 + lw + 13
texto(tx, 5.2, 260, 12, "PROCESO DE FABRICACIÓN  ·  INSERT DE PUERTA", tam=22, color=AZUL, negrita=True)
texto(tx, 17.2, 260, 8, "Proyecto Patagonia  ·  Insert delantero y trasero  ·  del corte del vinilo a la pieza terminada",
      tam=12.5, color=GRIS_TXT)

_f = ImageFont.truetype("C:/Windows/Fonts/segoeui.ttf", 100)
rx = W - 13
for clave in ("A", "E", "S", "V"):
    L = LINEAS[clave]
    nom = L["nombre"].capitalize() if clave != "A" else "Armado y tapizado"
    tw = _f.getlength(nom) / 100 * 10.5 * 0.3528 + 1.0
    rx -= tw
    texto(rx, 11, tw + 2, 8, nom, tam=10.5, color=AZUL_OSC)
    rx -= 5.6
    pto = sp.add_shape(MSO_SHAPE.OVAL, Mm(rx), Mm(13.0), Mm(4.0), Mm(4.0))
    pto.fill.solid()
    pto.fill.fore_color.rgb = rgb(L["color"])
    pto.line.fill.background()
    sin_sombra(pto)
    rx -= 9

# ------------------------------------------------------------ grilla
MX = 11.0
ANCHO = W - 2 * MX
PAD = 3.2          # borde de cada franja de color alrededor de sus tarjetas
PAD_T = 5.4        # arriba hay mas borde: ahi va la pestaña con el nombre
G1 = 7.0           # separacion entre tarjetas de la franja 1 (entra la flecha)
GP = 5.0           # separacion entre franjas de color
Y1 = 38.6          # arriba de la franja 1
H1 = 99.0          # alto de las tarjetas de la franja 1
SALTO = 9.5        # espacio entre la franja 1 y la 2
PIE = 7.5
H2 = H - PIE - 5.5 - PAD - (Y1 + PAD_T + H1 + PAD + SALTO + PAD_T)

w1 = (ANCHO - 3 * G1 - 3 * 2 * PAD - 2 * GP) / 6
yc1 = Y1 + PAD_T


def fx(paso, clave, **base):
    d = dict(clave=clave, **base)
    d.update(FOTOS.get(str(paso), {}).get(clave + "_op", {}))
    if "foco" in d:
        d["foco"] = tuple(d["foco"])
    return d


MAQ = dict(modo="cubrir", alto=1.55)
TIRA = dict(modo="entera", rotar=ROT, alto=1.0)

# posiciones x de las 6 tarjetas de la franja 1
x = MX + PAD
xs = []
for grupo in (3, 1, 2):
    for k in range(grupo):
        xs.append(x)
        x += w1 + (G1 if k < grupo - 1 else 0)
    x += PAD + GP + PAD

banda(xs[0] - PAD, Y1, 3 * w1 + 2 * G1 + 2 * PAD, PAD_T + H1 + PAD, "V")
banda(xs[3] - PAD, Y1, w1 + 2 * PAD, PAD_T + H1 + PAD, "S")
banda(xs[4] - PAD, Y1, 2 * w1 + G1 + 2 * PAD, PAD_T + H1 + PAD, "E")

tarjeta(1, xs[0], yc1, w1, H1, "Corte del vinilo", "V", [
    [fx(1, "principal", rotulo="Mesa de corte", **MAQ)],
    [fx(1, "rollo", rotulo="Rollo de vinilo", modo="cubrir", peso=0.8, alto=1.0),
     fx(1, "pieza", rotulo="Vinilo cortado", modo="entera", rotar=ROT, peso=1.25, alto=1.0)],
], uso=USO["1"])
tarjeta(2, xs[1], yc1, w1, H1, "Costura CNC", "V", [
    [fx(2, "principal", rotulo="Máquina de costura CNC", **MAQ)],
    [fx(2, "pieza", rotulo="Pieza cosida", **TIRA)],
], uso=USO["2"])
tarjeta(3, xs[2], yc1, w1, H1, "Adhesivado del vinilo", "V", [
    [fx(3, "pieza", rotulo="Vinilo adhesivado", modo="entera")],
], uso=USO["3"])
tarjeta(4, xs[3], yc1, w1, H1, "Inyección plástica del sustrato", "S", [
    [fx(4, "principal", rotulo="Inyectora")],
    [fx(4, "segunda", rotulo="Inyectora con robot")],
], uso=USO["4"])
tarjeta(5, xs[4], yc1, w1, H1, "Adhesivado de espuma de 3 mm", "E", [
    [fx(5, "espuma", rotulo="Espuma"), fx(5, "adhesivo", rotulo="Cinta adhesiva")],
    [fx(5, "placa", rotulo="Placa adhesivada")],
], uso=USO["5"])
tarjeta(6, xs[5], yc1, w1, H1, "Troquelado de la espuma", "E", [
    [fx(6, "principal", rotulo="Troqueladora", **MAQ)],
    [fx(6, "troquel", rotulo="Troquel", modo="cubrir", peso=1.25, alto=1.0),
     fx(6, "pieza", rotulo="Pieza troquelada", modo="entera", peso=0.8, alto=1.0)],
])

a = 1.5
my1 = yc1 + H1 / 2
flecha([(xs[0] + w1 + a, my1), (xs[1] - a, my1)], color=AZUL)
flecha([(xs[1] + w1 + a, my1), (xs[2] - a, my1)], color=AZUL)
flecha([(xs[4] + w1 + a, my1), (xs[5] - a, my1)], color=AMBAR)

# ------------------------------------------------------------ franja 2: armado
Y2 = Y1 + PAD_T + H1 + PAD + SALTO
yc2 = Y2 + PAD_T
banda(MX, Y2, ANCHO, PAD_T + H2 + PAD, "A")
G2 = 8.0
w2 = 64.0
wh = ANCHO - 2 * PAD - 4 * w2 - 4 * G2
x2 = [MX + PAD + k * (w2 + G2) for k in range(4)]
xh = x2[3] + w2 + G2

tarjeta(7, x2[0], yc2, w2, H2, "Pegado de espuma en plástico", "A", [
    [fx(7, "pieza", rotulo="Pieza plástica con espuma pegada", modo="entera")],
], entra=[("S", "Sustrato"), ("E", "Espuma")])
tarjeta(8, x2[1], yc2, w2, H2, "Adhesivado de pieza plástica con espuma", "A", [
    [fx(8, "pieza", rotulo="Pieza adhesivada", modo="entera")],
])
tarjeta(9, x2[2], yc2, w2, H2, "Tapizado en Hot Press", "A", [
    [fx(9, "principal", rotulo="Hot Press", modo="cubrir", alto=1.25)],
] + ([[fx(9, "pieza", rotulo="Pieza tapizada (dorso)", **TIRA)]] if F(9, "pieza") else []), entra=[("V", "Vinilo"), ("A", "Pieza con espuma")])
tarjeta(10, x2[3], yc2, w2, H2, "Virolado", "A", [
    [fx(10, "pieza", rotulo="Pieza virolada", modo="entera")],
], uso=USO["10"])

my2 = yc2 + H2 / 2
for k in range(3):
    flecha([(x2[k] + w2 + a, my2), (x2[k + 1] - a, my2)], color=AZUL_OSC)
flecha([(x2[3] + w2 + a, my2), (xh - a, my2)], color=AZUL_OSC)

# pieza terminada, al final de la franja 2
heroe = caja(xh, yc2, wh, H2, relleno=AZUL, radio=3.0)
sombra(heroe, alpha=28)
texto(xh, yc2 + 4.0, wh, 8, "INSERT TERMINADO", tam=15, color=BLANCO, negrita=True, alin="c", espaciado=100)
texto(xh, yc2 + 12.2, wh, 5, "Refilado  ·  Control final  ·  Embalaje", tam=9, color="DCE6F2", alin="c")
th = 64.0  # alto del recuadro blanco de la pieza
ty = yc2 + 20.5 + (H2 - 24 - 9 - th) / 2
foto(F("final", "pieza"), xh + 3.5, ty, wh - 7, th, modo="entera", fondo=BLANCO, borde=BLANCO,
     radio=2.0, margen=4.0, rotar=FOTOS.get("final", {}).get("rotar", 0))
texto(xh, yc2 + H2 - 12.5, wh, 6, "Delantero y trasero  ·  izquierdo y derecho", tam=9.5, color="DCE6F2", alin="c")

# de la franja 1 a la franja 2: cada componente dice a que paso va (la misma pastilla esta en ese paso)
yb = Y1 + PAD_T + H1 + PAD
for cx, clave, destino in ((xs[1] + w1 / 2, "V", "Va al paso 9"), (xs[3] + w1 / 2, "S", "Va al paso 7"),
                           (xs[4] + w1 + G1 / 2, "E", "Va al paso 7")):
    pw_ = 30.0
    caja(cx - pw_ / 2, yb - 3.1, pw_, 6.2, relleno=LINEAS[clave]["color"], radio=3.1)
    texto(cx - pw_ / 2, yb - 3.1, pw_, 6.2, "▼  " + destino, tam=8.5, color=BLANCO, negrita=True, alin="c")

# ------------------------------------------------------------ pie
caja(0, H - PIE, W, PIE, relleno=AZUL)
texto(13, H - PIE, 250, PIE, "BARACK MERCOSUL  ·  Ingeniería", tam=8.5, color=BLANCO, espaciado=60)
texto(110, H - PIE, 200, PIE, "Uso por pieza: sin aclaración, el valor es el mismo para delantero y trasero",
      tam=8.5, color="DCE6F2", alin="c")
texto(W - 113, H - PIE, 100, PIE, "Octubre 2026", tam=8.5, color=BLANCO, alin="r", espaciado=60)

cp = prs.core_properties
cp.author = cp.last_modified_by = "Ingeniería - Barack Mercosul"
cp.title = "Proceso de fabricación - Insert Patagonia"
cp.subject = cp.comments = cp.keywords = ""
prs.core_properties.author = prs.core_properties.last_modified_by = 'Facundo Santoro'; prs.core_properties.comments = ''  # sin firma de programa (Fak, 08/10/2026: scripts/_lib/firmaIA.py)
prs.save(SALIDA)
print("OK", SALIDA, "w1=%.1f H2=%.1f wh=%.1f" % (w1, H2, wh))
