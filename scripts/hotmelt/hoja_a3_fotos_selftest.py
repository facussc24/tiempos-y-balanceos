# -*- coding: utf-8 -*-
"""hoja_a3_fotos_selftest.py — el acomodo de fotos de la hoja A3, en ROJO y en VERDE.

    py -3 scripts/hotmelt/hoja_a3_fotos_selftest.py        # tiene que terminar en "0 fallan"

No abre PowerPoint ni necesita las fotos reales: fabrica imagenes lisas del tamano que hace falta.
Lo que mira es la cuenta (cuanto mide cada foto y quien gana, grilla o filas), que es lo que el
control duro `hoja_proceso_check.py` no puede decir: ese mide la hoja ya dibujada.
"""
import os
import sys
import tempfile

from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
sys.stdout.reconfigure(encoding="utf-8")
import hoja_a3_fotos as H                      # noqa: E402
import generar_hojas_hotmelt_a3 as base        # noqa: E402

TMP = os.path.join(tempfile.gettempdir(), "hoja_a3_fotos", "selftest")
os.makedirs(TMP, exist_ok=True)
fallan = 0
corridos = 0


def foto(ancho, alto, pie="foto"):
    p = os.path.join(TMP, f"{ancho}x{alto}.png")
    if not os.path.exists(p):
        Image.new("RGB", (ancho, alto), "gray").save(p)
    return {"foto": p, "pie": pie}


def caso(nombre, ok, detalle=""):
    global fallan, corridos
    corridos += 1
    if not ok:
        fallan += 1
    print(f"  {'ok   ' if ok else 'FALLA'} {nombre}" + (f"  [{detalle}]" if detalle and not ok else ""))


ACOSTADA, PARADA = (1840, 1000), (1080, 1920)

# ── 1. repartir el alto entre filas ─────────────────────────────────────────────────────────
altos = H._repartir_alto([6.5, 20.7], [2, 1], 19.0)
caso("ninguna fila pasa su tope", altos[0] <= 6.5 + 1e-9 and altos[1] <= 20.7 + 1e-9, str(altos))
caso("lo que una fila no usa se lo lleva la otra", abs(altos[0] - 6.5) < 1e-9 and abs(altos[1] - 12.5) < 1e-9, str(altos))
caso("el reparto no pasa del alto libre", sum(altos) <= 19.0 + 1e-9, str(altos))
altos = H._repartir_alto([30.0, 30.0], [3, 1], 16.0)
caso("sin topes, el alto va en proporcion a las fotos de cada fila",
     abs(altos[0] - 12.0) < 1e-9 and abs(altos[1] - 4.0) < 1e-9, str(altos))
altos = H._repartir_alto([4.0, 5.0], [1, 1], 19.0)
caso("si todas entran con su tope, quedan en su tope", altos == [4.0, 5.0], str(altos))

# ── 2. quien gana: grilla o filas ────────────────────────────────────────────────────────────
iguales = [foto(*ACOSTADA) for _ in range(6)]
forma, _ = H.elegir_acomodo(iguales)
caso("VERDE: seis pantallas iguales se quedan en la grilla", forma == "grilla", forma)

mezcla = [foto(*ACOSTADA), foto(*ACOSTADA), foto(*PARADA), foto(900, 1900), foto(1200, 1000)]
forma, acomodo = H.elegir_acomodo(mezcla)
caso("ROJO de la grilla: dos pantallas y tres fotos paradas pasan a filas", forma == "filas", forma)
if forma == "filas":
    areas = [w * alto for alto, _, anchos in acomodo for w in anchos]
    caso("  ninguna foto queda bajo el piso de 25 cm2", min(areas) >= H.AREA_MIN, str([round(a) for a in areas]))
    caso("  ninguna fila se sale del ancho del bloque",
         all(sum(anchos) + H.PAD * (len(anchos) + 1) <= base.IMG_W + 1e-6 for _, _, anchos in acomodo))
    caso("  las filas con sus pies entran en el alto del bloque",
         sum(a + p for a, p, _ in acomodo) + H.PAD * (len(acomodo) + 1) <= base.IMG_H + 1e-6)

caso("una sola foto no se reparte en filas", H.elegir_acomodo([foto(*ACOSTADA)])[0] == "grilla")

# ── 3. el reparto pedido a mano ──────────────────────────────────────────────────────────────
dos = [foto(*ACOSTADA), foto(*PARADA)]
filas = H.filas_pedidas(dos, [2])
caso("VERDE: filas=[2] deja las dos fotos a la misma altura", len(filas) == 1 and len(filas[0][2]) == 2)
for mal, por_que in (([1], "reparte menos fotos de las que hay"), ([2, 1], "reparte mas fotos de las que hay"),
                     ([2, 0], "una fila vacia")):
    try:
        H.filas_pedidas(dos, mal)
        caso(f"ROJO: filas={mal} ({por_que}) se rechaza", False)
    except ValueError:
        caso(f"ROJO: filas={mal} ({por_que}) se rechaza", True)
try:
    H.filas_pedidas([foto(*ACOSTADA) for _ in range(5)] + [foto(400, 1900)], [6])
    caso("ROJO: un reparto que deja una foto de estampilla se rechaza", False)
except ValueError:
    caso("ROJO: un reparto que deja una foto de estampilla se rechaza", True)

# ── 4. el pie y las unidades ─────────────────────────────────────────────────────────────────
caso("un pie corto va en un renglon", H._alto_pie("Botón 1", 8.0) == H.PIE_H)
caso("un pie largo en una foto mediana va en dos", H._alto_pie("Material entre el rodillo plateado y el verde", 6.0) == H.PIE_H_DOBLE)
caso("un pie largo en una foto angosta va en tres (la caja crece, no se corta)",
     H._alto_pie("Material entre el rodillo plateado y el verde", 4.0) > H.PIE_H_DOBLE)
for mal, por_que in (((([5.0], [1], 0.0)), "sin alto libre"), ((([5.0, 5.0], [1, 0], 10.0)), "una fila sin fotos")):
    try:
        H._repartir_alto(*mal)
        caso(f"ROJO: repartir el alto {por_que} se rechaza (antes dividia por cero)", False)
    except ValueError:
        caso(f"ROJO: repartir el alto {por_que} se rechaza (antes dividia por cero)", True)
caso("el numero no se separa de su unidad", H._sin_cortar("supere los 150 °C.") == "supere los 150 °C.")
caso("un texto sin unidades queda igual", H._sin_cortar("Apretar el botón Stop.") == "Apretar el botón Stop.")

print(f"\n{corridos} casos, {fallan} fallan.")
sys.exit(1 if fallan else 0)
