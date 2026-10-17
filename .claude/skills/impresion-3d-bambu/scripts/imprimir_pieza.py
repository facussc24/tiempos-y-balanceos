"""Una pieza, de punta a punta: laminar -> controlar -> (mandar) -> decir como seguirla.

Uso (python del sistema):
  imprimir_pieza.py <pieza.3mf> <carpeta NUEVA de trabajo> --color-parte 1=negro --color-parte 2=amarillo
                    [--proceso "0.20mm Standard"] [--apply]

- Lee de la IMPRESORA que hay en cada lugar del cargador (material y color): el material del
  laminado sale de ahi, no se asume.
- `--color-parte N=<color>`: la parte N del objeto va con el rollo de ese color. El color se
  escribe en castellano (negro, blanco, amarillo, verde, rojo, azul, gris, naranja) o #RRGGBB.
- Lamina con laminar_bambu.py (sus controles), muestra quien imprime que, y arma el plan de envio.
- Sin --apply NO manda nada. Con --apply sube el archivo y manda la orden; despues hay que lanzar
  el seguimiento en segundo plano (imprime el comando).
"""
import argparse
import json
import os
import subprocess
import sys
from pathlib import Path

AQUI = Path(__file__).resolve().parent
sys.path.insert(0, str(AQUI))
import bambu_red as br  # noqa: E402


def _falla_en_un_renglon(tipo, valor, tb):
    """Una falla de la impresora (no la encuentra, rechazo el codigo) sale en un renglon con su salida, como en
    bambu_red.py, y no como un error de Python (desde el 16/10/2026 bambu_red levanta FallaImpresora). Cualquier otro
    error del programa tambien sale en un renglon, como lo muestra bambu_red.main() (revision 16/10)."""
    if isinstance(valor, br.FallaImpresora):
        print(valor.texto, flush=True)
        os._exit(valor.salida)
    if isinstance(valor, Exception):
        print(f"No se pudo: {tipo.__name__}: {valor}. No es un problema de la impresora: avisar a Fak con este renglon.",
              flush=True)
        os._exit(1)
    sys.__excepthook__(tipo, valor, tb)


sys.excepthook = _falla_en_un_renglon

COLORES = {"negro": "#000000", "blanco": "#FFFFFF", "amarillo": "#F4D31F", "verde": "#00AE42",
           "rojo": "#C12E1F", "azul": "#0A2989", "gris": "#8E9089", "naranja": "#FF6A13"}
# nombre del perfil de Bambu Studio para cada material que informa la impresora
PERFIL = {"PLA Lite": "Bambu PLA Lite", "PLA Basic": "Bambu PLA Basic", "PLA Matte": "Bambu PLA Matte",
          "PETG Basic": "Bambu PETG Basic", "PETG HF": "Bambu PETG HF"}

ap = argparse.ArgumentParser()
ap.add_argument("pieza")
ap.add_argument("carpeta")
ap.add_argument("--color-parte", action="append", required=True)
ap.add_argument("--proceso", default="0.20mm Standard")
ap.add_argument("--apply", action="store_true")
a = ap.parse_args()


def hexa(c):
    c = c.strip()
    return COLORES.get(c.lower(), c.upper())


def dist(c1, c2):
    x, y = (tuple(int(c[i:i + 2], 16) for i in (1, 3, 5)) for c in (c1, c2))
    return sum((p - q) ** 2 for p, q in zip(x, y)) ** 0.5


d = br.cargar_datos()
est = br.leer_estado(d)
lug = br.lugares_del_cargador(est)
print("impresora:", est.get("gcode_state"), "| cargador:",
      {n + 1: f"{nom} {col}" for n, (_, nom, col) in sorted(lug.items())})

# cada parte -> el lugar cuyo color se parece mas al pedido
pedido = [(int(x.split("=")[0]), hexa(x.split("=")[1])) for x in a.color_parte]
usados, plan = {}, []
for parte, col in pedido:
    dmin, n = min((dist(col, c), n) for n, (_, _, c) in lug.items())
    if dmin > 120:
        raise SystemExit(f"no hay un rollo parecido a {col} en el cargador (el mas cercano esta a {dmin:.0f})")
    usados.setdefault(n, len(usados) + 1)          # numero de filamento dentro del archivo
    plan.append((parte, usados[n], n))
orden = sorted(usados.items(), key=lambda kv: kv[1])          # [(lugar, n de filamento)]
for parte, fil, n in plan:
    print(f"  parte {parte} -> filamento {fil} del archivo = lugar {n + 1} ({lug[n][1]} {lug[n][2]})")

cmd = [sys.executable, str(AQUI / "laminar_bambu.py"), a.pieza, a.carpeta, "--proceso", a.proceso]
for n, _ in orden:
    nom = lug[n][1]
    if nom not in PERFIL:
        raise SystemExit(f"no se que perfil de Bambu Studio corresponde a '{nom}': agregarlo a PERFIL")
    cmd += ["--filamento", PERFIL[nom], "--color", lug[n][2]]
for parte, fil, _ in plan:
    cmd += ["--parte-filamento", f"{parte}={fil}"]
r = subprocess.run(cmd, text=True, capture_output=True)
print(r.stdout[-1800:])
if r.returncode != 0:
    print(r.stderr[-600:])
    raise SystemExit("el laminado no paso los controles: no se manda")

carpeta = Path(a.carpeta)
salida = next(p for p in carpeta.glob("*.gcode.3mf") if not p.name.startswith("_"))
q = subprocess.run([sys.executable, str(AQUI / "quien_imprime_que.py"), str(carpeta / "plate_1.gcode")],
                   text=True, capture_output=True)
print(q.stdout)
rc = br.imprimir(str(salida), None, a.apply)
if a.apply and rc == 0:
    # el comando de la vigilancia es UNO solo: el que imprimio --imprimir arriba («AHORA, EN SEGUNDO PLANO», con su
    # carpeta por envio y --despertar); antes aca salia otro distinto, sin --despertar (revision 16/10)
    print("\nSEGUIMIENTO: lanzar en segundo plano el comando de arriba («AHORA, EN SEGUNDO PLANO»), sumando a "
          "--fotos-en las capas del cambio de color")
sys.exit(rc)
