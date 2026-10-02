# -*- coding: utf-8 -*-
"""gates_v3_selftest.py — los controles de `generar_hojas_v3.py`, en ROJO y en VERDE.

    py -3 scripts/hotmelt/gates_v3_selftest.py        # tiene que terminar en "0 fallan"

No genera ninguna hoja. Los titulos de los videos se le pasan a mano para que la prueba no dependa
de tener la biblioteca de videos en la PC; el ultimo caso si la usa, cuando esta.
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
sys.stdout.reconfigure(encoding="utf-8")
import generar_hojas_v3 as G                   # noqa: E402

fallan = 0
corridos = 0


def caso(nombre, ok):
    global fallan, corridos
    corridos += 1
    if not ok:
        fallan += 1
    print(f"  {'ok   ' if ok else 'FALLA'} {nombre}")


def frena(funcion, *a, **k):
    try:
        funcion(*a, **k)
        return False
    except SystemExit:
        return True


TITULOS = {"0360": "# IMG_0360  —  2026-08-25 - MODO DE FALLA - vinilo mal pasado",
           "0362": "# IMG_0362  —  2026-08-25 - DEFECTO - el material se traba",
           "0361": "# IMG_0361  —  2026-08-25 - enhebrado hasta el enrollador",
           "0364": "# IMG_0364  —  2026-08-25 - ALARMA fin de material y destrabe"}
FICHAS = {"mal": {"fuente": r"C:\x\0360\0360_0008.jpg"}, "traba": {"fuente": r"C:\x\0362\0362_0003.jpg"},
          "bien": {"fuente": r"C:\x\0361\0361_0033.jpg"}, "alarma": {"fuente": r"C:\x\0364\0364_0003.jpg"},
          "manual": {"fuente": ("manual", 17)}}
titulo = lambda v: TITULOS.get(v, "")          # noqa: E731


def hoja(*pasos):
    return {"op": "20.3", "pasos": list(pasos)}


def paso(nombre, **mas):
    return dict(texto="Verificar el material.", foto=rf"C:\fotos\{nombre}.jpg", fuentes=["x"], **mas)


# ── gate_foto_no_es_de_falla ─────────────────────────────────────────────────────────────────
caso("ROJO: foto de un video titulado MODO DE FALLA", frena(G.gate_foto_no_es_de_falla, hoja(paso("mal")), FICHAS, titulo))
caso("ROJO: foto de un video titulado DEFECTO", frena(G.gate_foto_no_es_de_falla, hoja(paso("traba")), FICHAS, titulo))
caso("ROJO: la foto de falla va adentro de `fotos` (dos fotos en un paso)",
     frena(G.gate_foto_no_es_de_falla,
           hoja(dict(texto="Verificar.", fuentes=["x"],
                     fotos=[dict(foto=r"C:\fotos\bien.jpg"), dict(foto=r"C:\fotos\mal.jpg")])), FICHAS, titulo))
caso("VERDE: la misma foto declarada contraejemplo=True",
     not frena(G.gate_foto_no_es_de_falla, hoja(paso("mal", contraejemplo=True)), FICHAS, titulo))
caso("VERDE: foto de un video comun", not frena(G.gate_foto_no_es_de_falla, hoja(paso("bien")), FICHAS, titulo))
caso("VERDE: un video de ALARMA no es un video de falla del producto",
     not frena(G.gate_foto_no_es_de_falla, hoja(paso("alarma")), FICHAS, titulo))
caso("VERDE: foto de una pagina del manual", not frena(G.gate_foto_no_es_de_falla, hoja(paso("manual")), FICHAS, titulo))
caso("VERDE: paso sin foto",
     not frena(G.gate_foto_no_es_de_falla, hoja(dict(texto="Verificar.", fuentes=["x"])), FICHAS, titulo))
caso("VERDE: foto sin ficha ni transcripcion no se inventa una falla",
     not frena(G.gate_foto_no_es_de_falla, hoja(paso("desconocida")), FICHAS, titulo))

# ── gate_fuente_por_paso ─────────────────────────────────────────────────────────────────────
caso("ROJO: un paso sin fuente", frena(G.gate_fuente_por_paso,
                                       {"op": "10", "denominacion": "X", "pasos": [dict(texto="Apretar.")]}))
caso("VERDE: todos los pasos con fuente", not frena(G.gate_fuente_por_paso,
                                                    {"op": "10", "denominacion": "X",
                                                     "pasos": [dict(texto="Apretar.", fuentes=["manual p. 12"])]}))

# ── gate_lo_normal_en_produccion ─────────────────────────────────────────────────────────────
normal = {"op": "20.3", "denominacion": "EMPALME DEL MATERIAL", "cuando": "cada rollo"}
caso("VERDE: una hoja de todos los dias", not frena(G.gate_lo_normal_en_produccion, [normal]))
caso("ROJO: una hoja de produccion sin decir cuando se hace",
     frena(G.gate_lo_normal_en_produccion, [{"op": "20.3", "denominacion": "ENHEBRADO DEL MATERIAL"}]))
caso("ROJO: una excepcion metida en el juego de produccion (el enhebrado del 02/10)",
     frena(G.gate_lo_normal_en_produccion,
           [normal, {"op": "20.3", "denominacion": "ENHEBRADO DEL MATERIAL", "cuando": "excepcion"}]))
caso("ROJO: un `cuando` que no esta en la lista", frena(G.gate_lo_normal_en_produccion,
                                                       [dict(normal, cuando="a veces")]))
import hojas_v3_spec as spec_hoy               # noqa: E402
caso("VERDE (caso real): las hojas de produccion de hoy declaran cuando se hacen",
     not frena(G.gate_lo_normal_en_produccion, spec_hoy.PRODUCCION))
caso("VERDE (caso real): el enhebrado esta en la hoja de la maquina, no en produccion",
     any(h["denominacion"] == "ENHEBRADO DEL MATERIAL" for h in spec_hoy.MAQUINA)
     and not any(h["denominacion"] == "ENHEBRADO DEL MATERIAL" for h in spec_hoy.PRODUCCION))
ops = [h["op"] for h in spec_hoy.PRODUCCION]
caso("VERDE (caso real): despues de montar el rollo viene el empalme",
     ops.index("20.3") == ops.index("20.2") + 1
     and spec_hoy.PRODUCCION[ops.index("20.3")]["denominacion"] == "EMPALME DEL MATERIAL")

# ── el caso real del 01/10, contra la biblioteca (si esta en esta PC) ────────────────────────
if G.titulo_del_video("0360"):
    real = hoja(dict(texto="Verificar que el material pase por adentro.", foto=G.ruta_foto("n_adentro"),
                     fuentes=["IMG_0360 00:00"]))
    caso("ROJO (caso real): la foto n_adentro, que salio en la 20.3 del 01/10",
         frena(G.gate_foto_no_es_de_falla, real))
    import hojas_v3_spec as spec               # noqa: E402
    hoy = all(not frena(G.gate_foto_no_es_de_falla, h) for h in spec.MAQUINA + spec.PRODUCCION)
    caso("VERDE (caso real): ninguna hoja de hoy usa una foto de un video de falla", hoy)
else:
    print("  (sin la biblioteca de videos en esta PC: el caso real no se corre)")

print(f"\n{corridos} casos, {fallan} fallan.")
sys.exit(1 if fallan else 0)
