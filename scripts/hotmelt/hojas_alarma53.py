# -*- coding: utf-8 -*-
"""hojas_alarma53.py — hoja 20.10 de la HO-992: CAMBIO DE ROLLO EN EL ENROLLADOR POR ALARMA.

    py -3 scripts/hotmelt/hojas_alarma53.py fotos      # prepara las 6 fotos desde su fuente
    py -3 scripts/hotmelt/hojas_alarma53.py            # arma el pptx y el pdf en exports/hojas-hotmelt-alarma53/
    py -3 scripts/hotmelt/hojas_alarma53.py --sin-pdf

Es la hermana de la hoja 20.7 (cambio de rollo del DESBOBINADOR): cuando suena la alarma 53
("Material receiving is about to be completed") el aviso es del lado del enrollador, y esa hoja no
existia. Los pasos salen del manual del fabricante p. 15 (seis puntos) con sus fotos reales de las
tomas del 25/08 y la pantalla de la alarma del 30/09/2026 (fotos de Fak).

Vive aparte de `hojas_v3_spec.py` a proposito: ese archivo lo esta revisando otra tarea y tocarlo
desde aca pisaria su trabajo. Cuando se aprueba la hoja, se suma a PRODUCCION de ese spec.
Usa el mismo motor, los mismos controles de redaccion y el mismo control de la hoja impresa.
"""
import os
import sys

AQUI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, AQUI)
sys.path.insert(0, os.path.join(AQUI, "..", "..", ".claude", "skills", "hojas-de-proceso", "scripts"))
sys.stdout.reconfigure(encoding="utf-8")

SALIDA = os.path.abspath(os.path.join(AQUI, "..", "..", "exports", "hojas-hotmelt-alarma53"))

import fotos_v3 as FV                                   # noqa: E402
from fotos_v3 import cuadro, BIB                        # noqa: E402

FV.DESTINO = os.path.join(SALIDA, "_fotos")             # las fotos preparadas no van al repo ni a la otra tarea

FOTO_ALARMA = os.path.join(BIB, ".claude", "alarma 53 - fotos del 30-09-2026",
                           "WhatsApp Image 2026-09-30 at 2.06.26 PM.jpeg")

# nombre -> fuente, recorte (% de la imagen ya derecha), marcas (% del RECORTE) y que muestra.
# Cada foto se mira a tamano completo antes de entrar aca.
FOTOS = {
    "a53_pantalla": dict(fuente=FOTO_ALARMA, crop=(6, 8, 94, 80),
                         marcas=[(6.5, 30.5, 84.5, 13, "Alarma 53")],
                         nota="Ventana de alarmas con la 53 (foto de Fak, 30/09/2026 14:06)"),
    "a53_llave": dict(fuente=cuadro("9527", 2610), crop=(0, 28, 75, 75),
                      nota="Llave de cambio de rollo OFF / ON junto al boton de parada de emergencia"),
    # recorte desde el 46 % de alto: arriba esta la cara del tecnico y a la izquierda sus piernas
    "a53_tubo": dict(fuente=cuadro("0361", 38), crop=(8, 46, 100, 100),
                     nota="Tubo de carton con cinta en el eje del enrollador"),
    "a53_punta": dict(fuente=cuadro("0361", 44), crop=(0, 38, 100, 95),
                      nota="Dos manos pegando la punta del material al tubo con cinta"),
    "a53_inflar": dict(fuente=cuadro("0355", 94), crop=(0, 20, 100, 100),
                       nota="Boquilla de la manguera naranja en el orificio del eje"),
    "a53_botonera": dict(fuente=cuadro("0836", 13), crop=(21, 5, 84, 100),
                         marcas=[(56, 78, 10, 12, "Reset"), (70, 73, 17, 23, "Parada de emergencia")],
                         nota="Tablero: Reset amarillo y parada de emergencia"),
}


def preparar_fotos(pedidas=()):
    for nombre, f in FOTOS.items():
        if pedidas and nombre not in pedidas:
            continue
        FV.preparar(nombre, f["fuente"], crop=f.get("crop"), rot=f.get("rot", 0), marcas=f.get("marcas"),
                    nota=f.get("nota", ""), lisa_ok=f.get("lisa_ok", ()))
        print("ok", nombre)
    print("fotos en", FV.DESTINO)


# ───────────────────────── la hoja ─────────────────────────
FECHA = "02/10/2026"

import generar_hojas_hotmelt_a3 as base                 # noqa: E402
EPP_ROLLO = [base.ICO_ROPA, base.ICO_CALZADO, base.ICO_GUANTES, base.ICO_BARBIJO]   # el mismo juego de la hoja 20.7

# El minuto sale del tecnico de KINGPOWER (IMG_9527 33:19 a 33:46 y 40:46 a 40:54): lo dice dos veces
# y es lo que hace que el cambio se haga contra reloj. Cronometrarlo en la maquina esta en PENDIENTES.
HOJA = dict(
    op="20.10", denominacion="CAMBIO DE ROLLO EN EL ENROLLADOR POR ALARMA",
    cuando="cada rollo", ho="HO-992", sector="LAMINADO",
    # la imagen principal es la alarma (el paso 1 manda LEERLA): va arriba y grande (gate 1 del skill)
    filas=[2, 4],
    pieza="TOP ROLL — N 216 / N 256 / N 285 / N 315", modelo="PATAGONIA / VW427", cliente="VW / NOVAX",
    aviso="TENER EL TUBO DE CARTÓN VACÍO Y LA CINTA ADHESIVA AL LADO DEL ENROLLADOR ANTES DE QUE SUENE LA ALARMA.",
    epp=EPP_ROLLO,
    pasos=[
        dict(texto="Verificar en la pantalla que la alarma 53 diga «Material receiving is about to be "
                   "completed» (el rollo está por terminar).",
             foto=FV.ruta("a53_pantalla"), pie="Alarma 53 en la pantalla",
             fuentes=["foto de Fak, 30/09/2026 14:06: la alarma 53 a las 14:05:07",
                      "IMG_9527 41:17 a 43:17 (el tecnico: suena la alarma para que venga a cambiar)",
                      "cuadros 0836_10 y 9527_0091 (la 53 en el registro de alarmas)"]),
        dict(texto="Girar la llave de cambio de rollo de OFF a ON. ⚠ La máquina se detiene si el cambio "
                   "no se termina en 1 minuto.",
             foto=FV.ruta("a53_llave"), pie="Llave de cambio de rollo",
             fuentes=["manual p. 15 punto 1", "IMG_9527 40:35 a 40:54", "IMG_9527 33:19 a 33:46 (el minuto)",
                      "cuadro 9527_2610"]),
        dict(texto="Apretar el material con la mano y separarlo del rollo terminado.",
             fuentes=["manual p. 15 puntos 2 y 3"]),
        dict(texto="Retirar el rollo terminado con su eje neumático y pasar un tubo de cartón vacío por el eje.",
             foto=FV.ruta("a53_tubo"), pie="Tubo de cartón vacío en el eje",
             fuentes=["manual p. 15 punto 4", "cuadro 0361_38"]),
        dict(texto="Pegar la punta del material al tubo con cinta adhesiva y darle 3 vueltas a mano.",
             foto=FV.ruta("a53_punta"), pie="Punta del material sobre el tubo",
             fuentes=["manual p. 15 punto 5", "cuadro 0361_44"]),
        dict(texto="Inflar el eje neumático con la manguera de aire.",
             foto=FV.ruta("a53_inflar"), pie="Boquilla en el orificio del eje",
             fuentes=["manual p. 15 punto 6", "cuadro 0355_94"]),
        dict(texto="Soltar la parada de emergencia (2), cerrar las puertas y apretar el botón amarillo "
                   "Reset (1) si la máquina se detiene.",
             foto=FV.ruta("a53_botonera"), pie="Reset (1) y parada de emergencia (2)",
             fuentes=["manual p. 45 alarma 1 y p. 46 alarma 8", "manual p. 12", "HO-993 operacion 50",
                      "cuadro 0836_13"]),
    ],
)

# Lo que ninguna fuente contesta: no se imprime, sale en PENDIENTES al lado del pptx.
FALTA = [
    ("LLAVE", "Foto de la llave de cambio de rollo DEL ENROLLADOR: la de la hoja es la del desbobinador; "
              "el manual p. 15 muestra la misma llave del lado del enrollador."),
    ("LLAVE", "Cuando se vuelve la llave a OFF: ninguna fuente lo dice."),
    ("TIEMPO", "Cronometrar un cambio completo con una persona: el minuto sale solo del audio del tecnico "
               "(IMG_9527), no de una pantalla."),
    ("SEPARAR", "Como se separa el material (con la mano o con cuter): el manual dice 'separacion manual'. "
                "Si es con cuter va con guantes anticorte, como el corte de la plancha."),
    ("ROLLO", "Si el rollo terminado sale con su eje o se desliza del eje desinflado, y a donde va."),
    ("ALARMA", "De que lado es la alarma 53: el tablero dice 'receiving' (enrollador). La pagina 2 de la "
               "pantalla de entradas (boton Next page) dice que senal la dispara."),
    ("ALARMA", "Si hay otra alarma para el fin de rollo del desbobinador (51 o 52) y como se llama."),
    ("FOTOS", "Filmar un cambio de rollo en el enrollador de punta a punta: hoy los pasos 3 y 4 salen del "
              "manual y de tomas del 25/08."),
]

# ───────────────────────── controles y armado ─────────────────────────
from pptx import Presentation                            # noqa: E402
from pptx.util import Cm                                 # noqa: E402
import hoja_a3_fotos as H                                # noqa: E402
from redaccion import gate_redaccion                     # noqa: E402
import hoja_proceso_check as CHK                         # noqa: E402


def controles(h):
    """Los mismos controles de redaccion que corre generar_hojas_v3.py sobre cada hoja."""
    import generar_hojas_v3 as G                         # lee hojas_v3_spec.py: si esta roto a mitad de edicion, falla aca
    d = dict(fecha=FECHA, rev="A", **h)
    G.gate_lo_normal_en_produccion([h])
    G.gate_fuente_por_paso(d)
    G.gate_foto_no_es_de_falla(d, fotos={n: dict(fuente=str(f["fuente"])) for n, f in FOTOS.items()})
    gate_redaccion(G.para_redaccion(d))
    return d


def armar(pdf=True):
    d = controles(HOJA)
    prs = Presentation()
    prs.slide_width, prs.slide_height = Cm(base.W), Cm(base.H)
    _, avisos = H.hoja(prs, d, logo=base.LOGO_BARACK)
    for a in avisos:
        print("  aviso:", a)
    os.makedirs(SALIDA, exist_ok=True)
    nombre = "HO-992 - 20.10 CAMBIO DE ROLLO EN EL ENROLLADOR POR ALARMA"
    ruta = os.path.join(SALIDA, nombre + ".pptx")
    prs.save(ruta)
    print("hoja ->", ruta)
    fallas = CHK.revisar(ruta, {"*": {"secuencia": True}})
    if fallas:
        print(CHK.informe(fallas))
        raise SystemExit(1)
    print("control de la hoja impresa: pasa")
    if pdf:
        base.exportar_pdf_com(ruta)
    temas = {}
    for tema, que in FALTA:
        temas.setdefault(tema, []).append(que)
    lineas = ["HOJA 20.10 - CAMBIO DE ROLLO EN EL ENROLLADOR POR ALARMA - LO QUE FALTA CONFIRMAR", f"Al {FECHA}", ""]
    for tema, items in temas.items():
        lineas.append(tema)
        lineas += [f"  - {q}" for q in items]
        lineas.append("")
    with open(os.path.join(SALIDA, "PENDIENTES - hoja 20.10.txt"), "w", encoding="utf-8") as f:
        f.write("\n".join(lineas))
    return ruta


if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] == "fotos":
        preparar_fotos(sys.argv[2:])
    else:
        armar(pdf="--sin-pdf" not in sys.argv)
