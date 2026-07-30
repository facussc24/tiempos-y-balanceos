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

# rotar90 no puede deformar: perimetro identico y bbox intercambiado
per0 = sum(P.dist(C[i], C[(i + 1) % len(C)]) for i in range(len(C)))
Cr = P.rotar90(C)
per1 = sum(P.dist(Cr[i], Cr[(i + 1) % len(Cr)]) for i in range(len(Cr)))
b0, b1 = P.bbox(C), P.bbox(Cr)
okrot = (abs(per1 - per0) < 1e-9
         and abs((b1[2] - b1[0]) - (b0[3] - b0[1])) < 1e-9
         and abs((b1[3] - b1[1]) - (b0[2] - b0[0])) < 1e-9)
print(f"  [{'OK ' if okrot else 'FALLA'}] rotar90: perimetro {per0:.6f} -> {per1:.6f}, "
      f"bbox {b0[2]-b0[0]:.1f}x{b0[3]-b0[1]:.1f} -> {b1[2]-b1[0]:.1f}x{b1[3]-b1[1]:.1f}")
if not okrot:
    fallos.append("rotar90")

# la distancia de un punto al filo tiene que sobrevivir la rotacion EXACTA
d_antes = P.dist_contorno(CR_OK[0]['c'], C)
d_desp = P.dist_contorno(P.rotar90([CR_OK[0]['c']])[0], Cr)
okd = abs(d_antes - d_desp) < 1e-9
print(f"  [{'OK ' if okd else 'FALLA'}] rotar90 conserva la distancia al filo: "
      f"{d_antes:.9f} -> {d_desp:.9f}")
if not okd:
    fallos.append("rotar90 distancia al filo")

# texto: ubicado adentro, sin tocar contorno ni marcas
lineas = ["INSERT PRUEBA DERECHO", "2026-01-01"]
mk = [(a, b) for cr in CR_OK for _, a, b in cr['arms']] + [(p[1], p[2]) for p in PQ]
pos = P.ubicar_texto(lineas, C, mk, altura=9.0, margen_contorno=10.0, margen_marcas=10.0)
if pos is None:
    print("  [FALLA] ubicar_texto no encontro lugar en un rectangulo de 600x200")
    fallos.append("ubicar_texto")
else:
    tr = P.bloque_texto(lineas, pos[0], pos[1], altura=9.0)
    pts = [p for t in tr for p in t]
    dc = min(P.dist_contorno(p, C) for p in pts)
    dm = min(P.seg_dist(p, a, b) for p in pts for a, b in mk)
    todos = all(P.dentro(p, C) for p in pts)
    okt = todos and dc >= 10.0 - 1e-6 and dm >= 10.0 - 1e-6
    print(f"  [{'OK ' if okt else 'FALLA'}] texto: {len(tr)} trazos, {len(pts)} puntos, "
          f"todos dentro={todos}, al contorno {dc:.2f} mm, a las marcas {dm:.2f} mm")
    if not okt:
        fallos.append("ubicar_texto margenes")
    # un texto absurdamente grande NO tiene que entrar (y no debe reventar)
    if P.ubicar_texto(["X" * 400], C, mk, altura=40.0) is not None:
        print("  [FALLA] ubicar_texto acepto un bloque que no entra")
        fallos.append("ubicar_texto sobredimensionado")
    else:
        print("  [OK ] ubicar_texto devuelve None cuando el bloque no entra")

# la fuente no inventa glifos: un caracter desconocido no dibuja nada
if P.texto_vectorial("Ñ@#", 0, 0, 8.0):
    print("  [FALLA] la fuente dibujo algo para caracteres que no tiene")
    fallos.append("fuente inventa glifos")
else:
    print("  [OK ] caracteres fuera de la fuente se saltean, no se inventan")

print()
if fallos:
    print(f"!!! {len(fallos)} FALLAS: " + ", ".join(fallos))
    sys.exit(1)
print("TODO OK — el enforcement rechaza los 7 casos malos y acepta el bueno.")
