# -*- coding: utf-8 -*-
"""
Selftest de patronlib — geometria sintetica, sin ningun dato de piezas reales.

Verifica que el enforcement duro de entregar() efectivamente RECHAZA, incluyendo
los 2 errores caros de este trabajo (patron chueco y direccion mal leida).

    C:\\Dev\\BarackMercosul\\.venv-cad\\Scripts\\python.exe patronlib_selftest.py
"""
import os
import math
import sys
import tempfile

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import patronlib as P


def rect(w, h, n=40):
    """Rectangulo w x h con vertices repartidos (para que dist_contorno tenga con que trabajar)."""
    pts = []
    for i in range(n):
        pts.append((w * i / n, 0.0))
    for i in range(n):
        pts.append((w, h * i / n))
    for i in range(n):
        pts.append((w - w * i / n, h))
    for i in range(n):
        pts.append((0.0, h - h * i / n))
    return pts


def cruz(c, arm=3.0):
    out = []
    for ang in (45, 135):
        a = math.radians(ang)
        dx, dy = arm * math.cos(a), arm * math.sin(a)
        out.append((None, (c[0] - dx, c[1] - dy), (c[0] + dx, c[1] + dy)))
    return {'c': c, 'arms': out}


def rotar(pts, grados, cx=0.0, cy=0.0):
    a = math.radians(grados)
    ca, sa = math.cos(a), math.sin(a)
    return [((x - cx) * ca - (y - cy) * sa + cx, (x - cx) * sa + (y - cy) * ca + cy)
            for x, y in pts]


TMP = tempfile.mkdtemp(prefix="patronlib_selftest_")
fallos = []


def caso(nombre, fn, espera_rechazo):
    out = os.path.join(TMP, nombre.replace(" ", "_").replace(",", "") + ".plt")
    motivo = ""
    try:
        fn(out)
        rechazo = False
    except P.EntregaRechazada as ex:
        rechazo = True
        partes = str(ex).split("\n")
        motivo = partes[1].strip() if len(partes) > 1 else str(ex)
    ok = (rechazo == espera_rechazo)
    if espera_rechazo and os.path.exists(out):
        ok = False
        motivo += "  [!! escribio el archivo igual]"
    if not espera_rechazo and not os.path.exists(out):
        ok = False
        motivo += "  [!! no escribio el archivo]"
    print(f"  [{'OK ' if ok else 'FALLA'}] {nombre:<46} "
          f"{'rechazado' if rechazo else 'aceptado':<10} {motivo[:86]}")
    if not ok:
        fallos.append(nombre)


C = rect(600.0, 200.0)
CR_OK = [cruz((80.0, 20.0)), cruz((520.0, 170.0))]
PQ = [(None, (300.0, 0.0), (300.0, 5.0))]

print("=" * 104)
print("SELFTEST patronlib — el enforcement tiene que RECHAZAR lo que esta mal")
print("=" * 104)

caso("1. todo correcto",
     lambda o: P.entregar(o, C, C, CR_OK, PQ, PQ), False)

C_movido = [(x, y + 0.5) for x, y in C]
caso("2. contorno movido 0.5 mm",
     lambda o: P.entregar(o, C_movido, C, CR_OK, PQ, PQ), True)

# ERROR CARO A: direccion mal leida -> la cruz queda pegada al filo
caso("3. cruz a 1.5 mm del filo (direccion mal leida)",
     lambda o: P.entregar(o, C, C, [cruz((80.0, 1.5)), CR_OK[1]], PQ, PQ), True)

mala = cruz((80.0, 20.0))
mala['arms'][0] = (None, (77.0, 17.0), (84.0, 24.0))     # brazo de ~9.9 mm
caso("4. brazo deformado (cruz reconstruida)",
     lambda o: P.entregar(o, C, C, [mala, CR_OK[1]], PQ, PQ), True)

PQ_mov = [(None, (300.0, 1.0), (300.0, 6.0))]
caso("5. piquete movido 1 mm",
     lambda o: P.entregar(o, C, C, CR_OK, PQ_mov, PQ), True)

# ERROR CARO B: patron chueco -> los deltas se van en diagonal
C_chueco = rotar(C, 2.0)
CR_chueco = [cruz(rotar([c['c']], 2.0)[0]) for c in CR_OK]
caso("6. patron chueco 2 grados (aplomo)",
     lambda o: P.entregar(o, C_chueco, C_chueco, CR_chueco, [], []), True)

caso("7. cruz fuera del contorno",
     lambda o: P.entregar(o, C, C, [cruz((-40.0, 20.0)), CR_OK[1]], PQ, PQ), True)

# 8 — EL PUNTO CIEGO: un vertice que se DESLIZA a lo largo de un tramo recto.
# La distancia punto-a-contorno da 0.000000 en LAS DOS direcciones aunque se movio 5 mm,
# porque el vertice sigue cayendo exacto sobre el borde viejo. Solo lo caza la
# comparacion vertice contra vertice. (Detectado por el auditor el 30/07/2026; su fix
# propuesto —medir en ambos sentidos— tampoco lo hubiera cazado.)
C_desliz = list(C)
C_desliz[5] = (C[5][0] + 5.0, C[5][1])          # sigue sobre el borde inferior recto
assert P.desviacion_max(C_desliz, C) < 1e-9 and P.desviacion_max(C, C_desliz) < 1e-9, \
    "el caso 8 dejo de ser ciego para Hausdorff: revisar el contorno de prueba"
caso("8. vertice deslizado 5 mm sobre un tramo recto",
     lambda o: P.entregar(o, C_desliz, C, CR_OK, PQ, PQ), True)

# 9 — el sub-check de piquetes NO corre si no se pasan los originales: tiene que DECLARARSE
_o = os.path.join(TMP, "declara.plt")
_r = P.entregar(_o, C, C, CR_OK, PQ)            # sin piquetes_originales
print(f"  [{'OK ' if _r['piquetes_verificados'] is False else 'FALLA'}] "
      f"9. sin piquetes_originales el retorno lo declara      "
      f"piquetes_verificados={_r['piquetes_verificados']}")
if _r['piquetes_verificados'] is not False:
    fallos.append("declaracion de piquetes no verificados")

print()
print("=" * 104)
print("FUNCIONES DE MEDICION")
print("=" * 104)

L = P.linea_de_apoyo(C)
print(f"  linea_de_apoyo sobre un rectangulo recto : angulo {L['angulo']:+.4f} grados "
      f"(span {L['pct']:.0f}%)   -> esperado 0.0000")
if abs(L['angulo']) > 1e-6:
    fallos.append("linea_de_apoyo en recto")

for g in (0.05, 0.5, 3.0, -1.25):
    rot = rotar(C, g)
    L2 = P.linea_de_apoyo(rot)
    err = abs(L2['angulo'] - g)
    print(f"  linea_de_apoyo sobre el mismo girado {g:+6.2f} : mide {L2['angulo']:+.4f} "
          f"(error {err:.6f})   veredicto {P.gate_aplomo(rot)['veredicto']}")
    if err > 1e-6:
        fallos.append(f"linea_de_apoyo a {g} grados")

dx, dy = P.a_marco_pieza(0.0, -1.0, 3.0)
esperado = 1.0 * math.sin(math.radians(3.0))
print(f"  a_marco_pieza(0,-1) con patron a 3 grados : ({dx:+.4f}, {dy:+.4f})   "
      f"-> el movimiento 'vertical' tiene {abs(dx):.4f} mm de componente horizontal")
if abs(abs(dx) - esperado) > 1e-9:
    fallos.append("a_marco_pieza")

plt_path = os.path.join(TMP, "roundtrip.plt")
P.escribir_plt(plt_path, C, [(a, b) for _, a, b in PQ])
tray = P.leer_plt(plt_path)
sp1 = [t for t in tray if t[0] == 1]
xs = [p[0] for t in sp1 for p in t[1]]
ys = [p[1] for t in sp1 for p in t[1]]
print(f"  PLT ida y vuelta                         : {len(tray)} trayectorias, "
      f"bbox {max(xs)-min(xs):.3f} x {max(ys)-min(ys):.3f} mm   -> esperado 600.000 x 200.000")
if abs((max(xs) - min(xs)) - 600.0) > 0.001 or abs((max(ys) - min(ys)) - 200.0) > 0.001:
    fallos.append("roundtrip PLT")
crlf = open(plt_path, "rb").read().count(b"\r\n")
print(f"  PLT terminadores CRLF                    : {crlf} lineas")
if crlf == 0:
    fallos.append("CRLF")

# contornos degenerados: tienen que fallar con mensaje claro, no con un IndexError pelado
for nombre, degen in (("vacio", []), ("1 punto", [(0.0, 0.0)]),
                      ("todos iguales", [(5.0, 5.0)] * 6)):
    try:
        P.linea_de_apoyo(degen)
        print(f"  [FALLA] contorno degenerado ({nombre}) no levanto error")
        fallos.append(f"degenerado {nombre}")
    except ValueError as ex:
        print(f"  [OK ] contorno degenerado ({nombre}) -> ValueError con mensaje: "
              f"{str(ex)[:60]}...")
    except Exception as ex:
        print(f"  [FALLA] contorno degenerado ({nombre}) -> {type(ex).__name__} sin mensaje util")
        fallos.append(f"degenerado {nombre}")

# comparar_par tiene que aceptar la estructura de leer() y tambien (x,y) crudos
cmp_dicts = P.comparar_par(C, CR_OK, C, CR_OK)
cmp_tuplas = P.comparar_par(C, [c['c'] for c in CR_OK], C, [c['c'] for c in CR_OK])
igual = cmp_dicts['residuos'] == cmp_tuplas['residuos']
print(f"  [{'OK ' if igual else 'FALLA'}] comparar_par acepta cruces de leer() y (x,y) crudos")
if not igual:
    fallos.append("comparar_par con las 2 formas")

print()
if fallos:
    print(f"!!! {len(fallos)} FALLAS: " + ", ".join(fallos))
    sys.exit(1)
print("TODO OK — el enforcement rechaza los 7 casos malos y acepta el bueno.")
