#!/usr/bin/env python
# -*- coding: utf-8 -*-
#   C:\Dev\BarackMercosul\.venv-cad\Scripts\python.exe test_constructores.py
"""Los constructores de la casa (cadlib/constructores.py, propuesta 2 del informe 3D) en las dos direcciones.

BIEN: la caja y la placa del constructor salen sin cantos vivos donde va la mano y con el chaflan a 45 grados en la cama;
colocar() ubica con una rotacion propia. MAL: la misma caja hecha a mano da cantos vivos (el control los ve); colocar()
se niega ANTES de mover con un espejo (det -1, el hallazgo del 20/10) o con escala; radio chico o cama sin chaflan sin
motivo, se niegan. Un numero del lenguaje que ya vive en un canon no se duplica. Y el gemelo de CATIA
(scripts/catia/constructores_casa.py) tiene los mismos nombres, parametros y valores por defecto (sin el contexto).
"""
import inspect
import json
import os
import subprocess
import sys
import tempfile

AQUI = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.normpath(os.path.join(AQUI, "..", "..", "..", ".."))
sys.path.insert(0, AQUI)
from cadlib import constructores as k  # noqa: E402
import gate_aristas as ga  # noqa: E402

fallos = []


def chequear(cond, msg):
    print("   %s  %s" % ("ok  " if cond else "FALLA", msg))
    if not cond:
        fallos.append(msg)


def se_niega(fn, clase):
    try:
        fn()
    except clase as e:
        return str(e)
    except Exception as e:  # noqa: BLE001
        return "OTRA:" + repr(e)
    return None


print("1. lenguaje de diseno: un numero en un solo lugar")
L = k.lenguaje()
crudo = json.load(open(k.LENGUAJE, encoding="utf-8"))
canon_cantos = json.load(open(os.path.join(AQUI, "cantosCanon.data.json"), encoding="utf-8"))
canon_torn = json.load(open(os.path.join(AQUI, "tornillosCanon.data.json"), encoding="utf-8"))
chequear(k.radio_mano(L) == canon_cantos["umbral_mm"], "el radio de la casa es el umbral del gate de cantos (%s)"
         % canon_cantos["umbral_mm"])
chequear("mm" not in crudo["radios"]["mano_y_pieza"] and "desde" in crudo["radios"]["mano_y_pieza"],
         "radios.mano_y_pieza apunta al canon (desde) y no escribe el numero otra vez")
chequear(L["tornilleria"]["tuerca_impresa_alto_min_D"]["valor"] == canon_torn["tuerca_impresa_altura_min_D"],
         "la tuerca impresa minima sale de tornillosCanon")
sin_fuente = [f"{g}.{n}" for g in ("radios", "chaflanes") for n, v in crudo[g].items() if not v.get("fuente")]
chequear(not sin_fuente, "cada radio y chaflan tiene fuente (%s)" % (sin_fuente or "todos"))
chequear(k.chaflan_cama_por_defecto(L) is None and "A DECIDIR" in crudo["chaflanes"]["cara_de_cama"]["estado_mm"],
         "el tamano del chaflan de cama esta A DECIDIR (null), no inventado")
chequear("opinion" in crudo["color_por_funcion"]["estado"], "color por funcion marcado como (opinion)")

print("2. caja: el redondeo es propiedad del constructor")
c = k.caja(40, 20, 15)
zona = (-21, -11, 0.05, 21, 11, 16)
r_bien = ga.cantos_convexos(c, 1.5, zona)
from build123d import Align, Box  # noqa: E402
pelada = Box(40, 20, 15, align=(Align.CENTER, Align.CENTER, Align.MIN))
r_mal = ga.cantos_convexos(pelada, 1.5, zona)
nv = lambda r: r["cantos_vivos"] + r["radios_chicos"]  # noqa: E731  (claves de ga.cantos_convexos)
chequear(nv(r_bien) == 0, "caja del constructor: 0 cantos vivos o chicos en la zona de mano (%s)" % nv(r_bien))
chequear(nv(r_mal) > 0, "la misma caja a mano: el control ve %d cantos vivos (gemelo)" % nv(r_mal))
chequear(k.procedencia(c)["procedencia"] == "catalogo_casa" and k.procedencia(c)["parametros"]["radio"] == 1.5,
         "la caja dice de donde sale (catalogo_casa, R1,5, version %s)" % k.procedencia(c)["lenguaje_version"])
m = se_niega(lambda: k.caja(40, 20, 15, radio=0), k.SinMotivo)
chequear(m is not None and "motivo" in m, "radio 0 sin motivo: se niega")
c0 = k.caja(40, 20, 15, radio=0, motivo="cara oculta que no toca nadie")
chequear(k.procedencia(c0).get("motivo") == "cara oculta que no toca nadie", "con motivo: lo deja escrito")
chequear(se_niega(lambda: k.caja(40, 20, 15, radio=1.0, motivo="corto"), k.SinMotivo) is not None,
         "motivo de menos de 10 caracteres no vale")
chequear(se_niega(lambda: k.caja(10, 10, 10, radio=6), k.NoEntra) is not None, "R6 en 10 x 10: no entra, se niega")
c3 = k.caja(40, 20, 15, radio=3.0)
chequear(k.procedencia(c3)["parametros"]["radio"] == 3.0, "un radio MAYOR que el de la casa no pide motivo")
cc = k.caja(40, 20, 15, centro=(100, 0, 5))
bb = cc.bounding_box()
chequear(abs(bb.min.Z - 5) < 1e-6 and abs(bb.center().X - 100) < 1e-6 and k.procedencia(cc),
         "centro: la caja queda apoyada en z 5 y centrada en x 100, con su procedencia")

print("3. placa: chaflan a 45 grados en la cama (G6)")
chequear(se_niega(lambda: k.placa(64, 24, 4), k.FaltaDato) is not None,
         "sin chaflan_cama y con el lenguaje en A DECIDIR: se niega (no inventa el tamano)")
chequear(se_niega(lambda: k.placa(64, 24, 4, chaflan_cama=0), k.SinMotivo) is not None, "cama sin chaflan sin motivo")
chequear(se_niega(lambda: k.placa(64, 24, 4, chaflan_cama=0, radio=0.5, motivo="radio chico por falta de lugar"),
                  k.SinMotivo) is not None, "el motivo del radio no sirve para sacar el chaflan de la cama (motivo_cama)")
chequear(se_niega(lambda: k.placa(64, 24, 2, chaflan_cama=0.6, radio=1.5), k.NoEntra) is not None,
         "chaflan + R que no entran en el espesor: se niega")
p = k.placa(64, 24, 4, chaflan_cama=0.6)
with tempfile.TemporaryDirectory() as td:
    from build123d import export_step  # noqa: E402
    st = os.path.join(td, "placa.step")
    export_step(p, st)
    corr = os.path.join(REPO, "evals", "banco3d", "correctores", "chaflan_cama.py")
    r = subprocess.run([sys.executable, "-I", corr, st], capture_output=True, text=True, timeout=600)
    j = json.loads([x for x in r.stdout.splitlines() if x.startswith("{")][-1])
    chequear(r.returncode == 0 and j["medidas"]["chaflan_45"] == j["medidas"]["aristas_contorno_cama"] > 0,
             "placa del constructor: todo el contorno de la cama a 45 grados (%s)" % j["detalle"][:70])
    # gemelo del revisor (24/10): un FALDON (la seccion crece hacia la cama, filo agudo de 45 grados) daba verde
    from build123d import Location, Rectangle, extrude  # noqa: E402
    faldon = extrude(Rectangle(65.2, 25.2), amount=0.6, taper=45)        # caras planas (un loft da BSpline)
    faldon = faldon + Box(64, 24, 3.4, align=(Align.CENTER, Align.CENTER, Align.MIN)).moved(Location((0, 0, 0.6)))
    stf = os.path.join(td, "faldon.step")
    export_step(faldon, stf)
    r = subprocess.run([sys.executable, "-I", corr, stf], capture_output=True, text=True, timeout=600)
    j = json.loads([x for x in r.stdout.splitlines() if x.startswith("{")][-1])
    chequear(r.returncode == 3 and j["medidas"]["faldon"] > 0 and j["medidas"]["chaflan_45"] == 0,
             "faldon (45 grados al reves): ROJO (%s)" % j["detalle"][:60])
    wd = os.path.join(td, "w")
    e = k.registrar(wd, "placa_brida", p, archivo=st)
    chequear(e["kind"] == "procedencia" and e["procedencia"] == "catalogo_casa" and e["firma"],
             "registrar(): evidencia 'procedencia' en el manifest atada a la firma del STEP")
    chequear(se_niega(lambda: k.declarar(wd, "x", "de_cero"), k.FaltaDato) is not None, "de_cero sin motivo: se niega")
    chequear(se_niega(lambda: k.declarar(wd, "x", "catalogo_comercial", archivo=st, codigo="A1"), k.FaltaDato)
             is not None, "catalogo_comercial sin fabricante ni fecha: se niega")
    chequear(se_niega(lambda: k.declarar(wd, "x", "me_parecio"), k.FaltaDato) is not None, "procedencia desconocida")
    chequear(se_niega(lambda: k.registrar(wd, "x", pelada), k.FaltaDato) is not None,
             "registrar() una caja a mano: se niega (no salio del constructor)")
    chequear(se_niega(lambda: k.declarar(wd, "x", "catalogo_casa", constructor="la hice a mano"), k.FaltaDato)
             is not None, "«catalogo_casa» no se autodeclara (revisor 24/10: aceptaba cualquier texto)")
    ec = k.declarar(wd, "sargento", "catalogo_comercial", archivo=st, fabricante="X", codigo="A1", fecha="2026-10-24")
    chequear(ec["fuente_valida"] is False, "catalogo_comercial queda declarado con fuente_valida False (P5)")
    # heredar: el pedestal hueco (caja menos hueco) conserva la procedencia con el cambio escrito
    ped = k.caja(52, 30, 53.11)
    hue = k.caja(44, 22, 47.11, radio=2.0, centro=(0, 0, -0.01))
    hueca = k.heredar(ped - hue, ped, hue, cambio="hueco de paredes 4 y tapa 6")
    chequear(k.procedencia(ped - hue) is None, "sin heredar(), el booleano pierde la procedencia (por eso existe)")
    chequear(k.procedencia(hueca)["cambios"] == ["hueco de paredes 4 y tapa 6"]
             and k.procedencia(hueca)["constructor"] == ["cadlib.constructores.caja"], "heredar(): conserva y anota")
    sth = os.path.join(td, "pedestal.step")
    export_step(hueca, sth)
    chequear(k.registrar(wd, "pedestal", hueca, archivo=sth)["procedencia"] == "catalogo_casa",
             "registrar() la pieza heredada")
    chequear(se_niega(lambda: k.heredar(pelada - hue, pelada, hue, cambio="hueco de paredes"), k.FaltaDato)
             is not None, "heredar() desde una caja a mano: se niega")
    chequear(se_niega(lambda: k.heredar(ped - hue, ped, hue, cambio="hueco"), k.SinMotivo) is not None,
             "heredar() sin escribir el cambio: se niega")
    from build123d import Sphere  # noqa: E402
    chequear(se_niega(lambda: k.heredar(Sphere(40), k.caja(10, 10, 10), cambio="cualquier texto largo"), k.FaltaDato)
             is not None, "heredar() una esfera a mano desde una caja chica: se niega (revisor 24/10)")
    pegada = Sphere(5)
    pegada.procedencia = dict(k.procedencia(k.caja(10, 10, 10)))
    chequear(se_niega(lambda: k.registrar(wd, "pegada", pegada), k.FaltaDato) is not None,
             "registrar() una procedencia pegada a mano en otra forma: se niega por el volumen")
    chequear(se_niega(lambda: k.declarar(wd, "x", "fak"), k.FaltaDato) is not None, "«fak» sin la cita: se niega")
    chequear(se_niega(lambda: k.declarar(wd, "x", "medida"), k.FaltaDato) is not None, "«medida» sin de donde: se niega")
    chequear(se_niega(lambda: k.declarar(wd, "x", "fak", cita="Fak 24/10: 52 de largo", firma="x"), k.FaltaDato)
             is not None, "un dato reservado (firma) no se pasa a mano")
    os.makedirs(os.path.join(wd, "out"), exist_ok=True)
    import shutil  # noqa: E402
    shutil.copyfile(sth, os.path.join(wd, "out", "pedestal.step"))
    shutil.copyfile(st, os.path.join(wd, "out", "suelta.step"))
    inf = k.informe_procedencias(wd)
    chequear([p["archivo"] for p in inf["piezas"]] == ["pedestal.step"] and inf["piezas"][0]["firma_ok"]
             and "suelta.step" in inf["sin_procedencia"], "informe_procedencias(): la pieza con y la pieza sin")
pr = k.procedencia(p)["parametros"]
chequear(pr["chaflan_cama"] == 0.6 and pr["radio"] == 1.5, "la placa deja escrito el chaflan que se uso")

print("4. colocar: rotacion propia o nada")
M = k.marco((0, 0, 1), (1, 0, 0), (5, 6, 7))
chequear(k.estado_matriz(M)["det"] == 1.0, "marco(): det +1 por construccion")
chequear(se_niega(lambda: k.marco((1, 0, 0), (2, 0, 0)), k.NoEsRotacion) is not None, "marco con ejes paralelos")
espejo = [[1, 0, 0, 0], [0, 1, 0, 0], [0, 0, -1, 0], [0, 0, 0, 1]]
escala = [[2, 0, 0, 0], [0, 1, 0, 0], [0, 0, 1, 0], [0, 0, 0, 1]]
m = se_niega(lambda: k.colocar(c, espejo), k.Espejo)
chequear(m is not None and "ESPEJO" in m, "colocar() con det -1: se niega y nombra el espejo")
chequear(se_niega(lambda: k.colocar(c, escala), k.NoEsRotacion) is not None, "colocar() con escala: se niega")
cm = k.colocar(c, M)
chequear(abs(cm.volume - c.volume) < 1e-6 and cm.colocaciones[-1]["det"] == 1.0 and k.procedencia(cm),
         "colocar() build123d: mismo volumen, la pose queda anotada y la procedencia sigue")
cm2 = k.colocar(cm, M)
chequear(len(cm2.colocaciones) == 2, "colocar() dos veces: quedan las dos poses (revisor 24/10)")
import trimesh  # noqa: E402
tm = trimesh.creation.box((4, 2, 1))
tc = k.colocar(tm, M)
chequear(abs(tc.volume - tm.volume) < 1e-9 and abs(tc.bounds.mean(0)[0] - 5) < 1e-9, "colocar() trimesh tambien")
with tempfile.TemporaryDirectory() as td2:
    chequear(se_niega(lambda: k.registrar(td2, "malla", tc), k.FaltaDato) is not None,
             "registrar() una malla de afuera colocada: FaltaDato, no TypeError (revisor 24/10)")
chequear(se_niega(lambda: k.componentes_catia(espejo), k.Espejo) is not None,
         "componentes_catia() se niega antes de llegar a SetComponents")
chequear(k.componentes_catia(M) == [M[0][0], M[1][0], M[2][0], M[0][1], M[1][1], M[2][1], M[0][2], M[1][2], M[2][2],
                                    5.0, 6.0, 7.0], "componentes de CATIA: rotacion por columnas y traslacion")
poses = {"estados": [{"matrices": {"a": M, "b": espejo}}, {"matrices": {"c": escala}}]}
malas = k.verificar_poses(poses)
chequear([x[0] for x in malas] == ["/estados[0]/matrices/b", "/estados[1]/matrices/c"],
         "verificar_poses(): encuentra el espejo y la escala por su camino")
plana = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, -1, 0, 0, 0, 0, 1]
rv = k.revisar_poses({"a": plana})
chequear(rv["revisadas"] == 1 and len(rv["malas"]) == 1, "revisar_poses(): un espejo escrito como 16 numeros cuenta "
         "(auditor 24/10)")
with tempfile.TemporaryDirectory() as td3:
    vacio = os.path.join(td3, "vacio.json")
    with open(vacio, "w", encoding="utf-8") as fh:
        fh.write("{}")
    chequear(k.revisar_poses({})["revisadas"] == 0 and k.main(["--poses", vacio]) == 2,
             "un json sin matrices: la linea de comandos da NO MEDIDO (2), no verde")
est = r"C:\Dev\_catia_practica\virolador_auto\palanca_makerworld\estados.json"
if os.path.exists(est):
    chequear(not k.verificar_poses(json.load(open(est, encoding="utf-8"))),
             "estados.json del 20/10 (despues del arreglo): las 65 poses son rotaciones propias")

print("5. catalogo de la casa")
chequear([f["id"] for f in k.buscar("palanca de traba")] == ["palanca_traba_makerworld"], "buscar('palanca')")
chequear("caja" in [f["id"] for f in k.buscar("tope redondeado")], "buscar('tope redondeado') -> caja")
chequear(k.buscar("xyzzy inexistente") == [], "lo que no esta: lista vacia")
for f in k.catalogo()["fichas"]:
    b = f.get("banco", "").split(" ")[0]
    chequear(os.path.isdir(os.path.join(REPO, *b.split("/"))), "la ficha %s apunta a un caso del banco que existe" % f["id"])

print("6. gemelo de CATIA: mismos nombres, parametros y valores por defecto")
sys.path.insert(0, os.path.join(REPO, "scripts", "catia"))
import constructores_casa as cc_  # noqa: E402
for n in ("caja", "placa", "colocar"):
    a = list(inspect.signature(getattr(k, n)).parameters.values())
    b = list(inspect.signature(getattr(cc_, n)).parameters.values())[1:]           # sin el contexto de CATIA
    chequear([(x.name, x.default) for x in a] == [(x.name, x.default) for x in b],
             "%s: build123d %s == CATIA %s" % (n, [x.name for x in a], [x.name for x in b]))
chequear(cc_._k is k and cc_.componentes is k.componentes_catia,
         "CATIA usa el MISMO nucleo (lenguaje, radios, matrices): no hay una segunda copia que se separe")

print("")
print("RESULTADO:", "OK" if not fallos else "%d falla(s)" % len(fallos))
sys.exit(1 if fallos else 0)
