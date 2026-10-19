# -*- coding: utf-8 -*-
"""Pruebas de uniones.py (corre en .venv-cad) con el caso que lo origino: el carro de tubo 30 x 30 x 2 del 19/10.
VERDE: patas paradas sobre la esquina del marco (contacto 224 mm2 cada una, arriba y abajo).
ROJO (el error real): patas corridas 30 en diagonal, tocan por una arista -> 4 piezas sin apoyo.
ROJO: una pata 1 mm mas larga se mete en el marco -> solape.
ROJO: un estante suelto a 5 mm del carro -> dos grupos."""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from build123d import Box, Cylinder, Pos, Rot  # noqa: E402
import uniones  # noqa: E402

T, E, L, W, H = 30.0, 2.0, 1000.0, 600.0, 800.0
fallas = []


def chequear(nombre, cond, detalle=""):
    print(("   ok    " if cond else "   FALLA ") + nombre + ("" if cond else f"  [{detalle}]"))
    if not cond:
        fallas.append(nombre)


def tubo(x0, y0, z0, dx, dy, dz):
    """Tubo hueco con la caja (x0,y0,z0)-(+dx,+dy,+dz); el hueco corre a lo largo del lado mas largo."""
    caja = Pos(x0 + dx / 2, y0 + dy / 2, z0 + dz / 2) * Box(dx, dy, dz)
    m = max(dx, dy, dz)
    hx, hy, hz = [(v if v == m else v - 2 * E) for v in (dx, dy, dz)]
    return caja - Pos(x0 + dx / 2, y0 + dy / 2, z0 + dz / 2) * Box(hx, hy, hz)


def carro(pata_xy, largo_pata=H - 2 * T):
    s = []
    for z0 in (0.0, H - T):
        for y0 in (0.0, W - T):
            s.append(tubo(0, y0, z0, L, T, T))
        for x0 in (0.0, L - T):
            s.append(tubo(x0, T, z0, T, W - 2 * T, T))
    for (x0, y0) in pata_xy:
        s.append(tubo(x0, y0, T, T, T, largo_pata))
    return s


bien = carro([(0, 0), (L - T, 0), (0, W - T), (L - T, W - T)])
r = uniones.revisar(bien)
areas_patas = sorted(u["mm2"] for u in r["uniones"] if u["b"] >= 8)
chequear("carro bien: VERDE, un grupo, cada pata 224 mm2 arriba y abajo",
         r["veredicto"] == "VERDE" and r["grupos"] == 1 and areas_patas == [224.0] * 8, r)

mal = carro([(T, T), (L - 2 * T, T), (T, W - 2 * T), (L - 2 * T, W - 2 * T)])
r2 = uniones.revisar(mal)
chequear("patas corridas en diagonal (el error del 19/10): ROJO con las 4 patas sin apoyo",
         r2["veredicto"] == "ROJO" and sorted(r2["piezas_sin_apoyo"]) == [8, 9, 10, 11], r2)

r3 = uniones.revisar(carro([(0, 0), (L - T, 0), (0, W - T), (L - T, W - T)], largo_pata=H - 2 * T + 1))
chequear("pata 1 mm mas larga: ROJO por solape", r3["veredicto"] == "ROJO" and len(r3["solapes"]) >= 1, r3["solapes"])

r4 = uniones.revisar(bien + [Pos(L / 2, W / 2, H + 5 + 1) * Box(200, 200, 2)])
chequear("estante suelto a 5 mm: ROJO, dos grupos", r4["veredicto"] == "ROJO" and r4["grupos"] == 2, r4)

# auditor 19/10: un tubo REDONDO acostado sobre una placa toca por una linea (73 mm2 aparentes): no es union
placa = Pos(0, 0, -5) * Box(200, 100, 10)
r5 = uniones.revisar([placa, Pos(0, 0, 15) * Rot(0, 90, 0) * Cylinder(15, 100)])
chequear("tubo redondo sobre placa (contacto en LINEA): ROJO e informado como solo linea",
         r5["veredicto"] == "ROJO" and len(r5["solo_linea_o_punto"]) == 1 and not r5["uniones"], r5)
r6 = uniones.revisar([placa, Pos(0, 0, 15) * Box(30, 30, 30)])
chequear("cubo apoyado: contacto de CARA 900 mm2, VERDE",
         r6["veredicto"] == "VERDE" and r6["uniones"][0]["mm2"] == 900.0, r6)
r7 = uniones.revisar([placa, Pos(0, 0, 15) * Box(30, 30, 30), Pos(0, 300, -5) * Box(200, 100, 10),
                      Pos(0, 300, 15) * Box(30, 30, 30)])
chequear("dos subconjuntos sanos separados: ROJO por dos grupos (cada pieza apoya en otra)",
         r7["veredicto"] == "ROJO" and r7["grupos"] == 2 and not r7["piezas_sin_apoyo"], r7)

print("RESULTADO:", "OK" if not fallas else f"{len(fallas)} FALLAS {fallas}")
sys.exit(1 if fallas else 0)
