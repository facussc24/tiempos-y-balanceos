#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""Saca de las grabaciones por sector del 02/10/2026 los recortes que usa escenas_ilusiona.json (el video "por sector").

Las grabaciones crudas (sector-<area>.mp4: la ventana de Claude de la PC de cada sector, 1640x1010) NO se copian al
repositorio: viven en .sgc-cache/claude-por-area/tomas-crudas/ (carpeta que git ignora). De ahi salen, con este programa,
recortes chicos en tomas/ que ya vienen cortados a lo que SE PUEDE MOSTRAR:

  - nunca la lista de conversaciones (izquierda) ni el nombre de la cuenta,
  - nunca la franja de abajo de la ventana (copia de trabajo, «Confirmar cambios», Manual/Auto, el texto sugerido),
  - nunca el primer globo de la conversacion («Hola. Antes de empezar...») ni su respuesta de identidad,
  - nunca el renglon gris «Mensaje recibido de...» / «Recibido un mensaje...» (la pregunta la mando otra sesion),
  - en Calidad nada de lo que esta arriba de la ultima respuesta (es otro examen),
  - en Recursos Humanos el primer parrafo de la respuesta (habla de «otra sesion de Claude»).

La conversacion se desplaza hacia arriba a medida que Claude escribe. Por eso el borde de arriba del recorte SIGUE a la
linea gris: se midio con medir_pasos.py (en el cuaderno de trabajo) cuando cambia de lugar, y el recorte baja o sube con
ella; al subir se espera un cuadro (0,04 s) de mas para no mostrar la linea ni un instante (los instantes en que se mueve
se midieron cuadro por cuadro: Calidad 5,87 / 7,37 / 7,87 / 8,50 / 10,63 s, Mantenimiento 44,27 / 45,63, RRHH 39,50 / 41,50). En Calidad, donde el recorte tiene que
quedar debajo de la barra del fondo, se tapa con el color del fondo lo que queda arriba de la respuesta.

Uso:
    python recortar_sectores_ilusiona.py            hace todos los recortes (pisa los que ya estan)
    python recortar_sectores_ilusiona.py nombre     hace solo ese
    python recortar_sectores_ilusiona.py --lista    dice que hace cada uno
"""
import subprocess
import sys
from pathlib import Path

AQUI = Path(__file__).resolve().parent
CRUDAS = AQUI.parents[2] / ".sgc-cache" / "claude-por-area" / "tomas-crudas"
SALIDA = AQUI / "tomas"
FONDO = "0x141414"          # el gris del fondo de la conversacion (20, 20, 20)
X0, ANCHO = 400, 900        # la columna del texto de la conversacion

# 'tops': (desde_s, y) -> el borde de arriba del recorte vale 'y' desde ese instante de la grabacion (en orden).
# 'tapar': (desde_s, hasta_s, y_desde, y_hasta) -> pinta del color del fondo ese pedazo de la grabacion en ese tramo.
RECORTES = [
    {"nombre": "sector-logistica-responde", "fuente": "sector-logistica.mp4", "ts": 21.0, "te": 33.5,
     "tops": [(0, 380)], "alto": 250,
     "que": "Logistica: espera, y la respuesta con racks de 2 a 5 y cajas hasta 4; fuente I-LG-010."},
    {"nombre": "sector-compras-responde", "fuente": "sector-compras.mp4", "ts": 36.0, "te": 47.0,
     "tops": [(0, 382)], "alto": 330,
     "que": "Compras: espera, y la respuesta (el primer embarque vale como aceptacion); fuente I-CO-001."},
    {"nombre": "sector-calidad-responde", "fuente": "sector-calidad.mp4", "ts": 6.0, "te": 16.0,
     "tops": [(0, 743), (7.37, 706), (7.87, 674), (8.50, 622), (10.63, 589)], "alto": 176,
     "tapar": [(5.88, 7.37, 743, 795), (7.37, 7.87, 706, 758), (7.87, 8.50, 674, 726), (8.50, 10.63, 622, 674),
               (10.63, 16, 589, 641),
               (0, 16, 876, 930)],          # la barra de la copia de trabajo («Confirmar cambios»): nunca se muestra
     "que": "Calidad: la ultima respuesta (24 horas desde que se crea la Notificacion al Proveedor); fuente I-AC-010."},
    {"nombre": "sector-mantenimiento-responde", "fuente": "sector-mantenimiento.mp4", "ts": 38.0, "te": 48.4,
     "tops": [(0, 456), (44.31, 399), (45.67, 365)], "alto": 468,
     "que": "Mantenimiento: la inspeccion por los sentidos (vista, oido, olfato, tacto); fuente I-MT-001."},
    {"nombre": "sector-rrhh-responde", "fuente": "sector-rrhh.mp4", "ts": 33.0, "te": 55.0,
     "tops": [(0, 362), (39.35, 421), (41.54, 388)], "alto": 500,
     "que": "Recursos Humanos: el tramite de una capacitacion paso por paso (sin el primer parrafo); fuente P-18."},
    {"nombre": "sector-direccion-espera", "fuente": "sector-direccion.mp4", "ts": 37.0, "te": 44.0,
     "tops": [(0, 362)], "alto": 500,
     "que": "Direccion: la espera (solo el contador de Claude trabajando)."},
    {"nombre": "sector-direccion-responde", "fuente": "sector-direccion.mp4", "ts": 44.4, "te": 59.9,
     "tops": [(0, 40)], "alto": 880, "tapar": [(46.95, 60, 40, 60)],
     "que": "Direccion: la respuesta ya completa (los temas de la revision, MC-09 rev F, P-01, P-22)."},
]


def y_expr(tops):
    """Expresion de ffmpeg: el borde de arriba segun el instante (de la grabacion, no del recorte)."""
    # escalones: if(gte(t,t2),y2,if(gte(t,t1),y1,y0)); el primero vale desde el principio
    expr = str(tops[0][1])
    for (t, y) in tops[1:]:
        expr = f"if(gte(t,{t}),{y},{expr})"
    return expr


def filtro(r):
    cadena = []
    for (a, b, y0, y1) in r.get("tapar", []):
        cadena.append(f"drawbox=x=0:y={y0}:w=iw:h={y1 - y0}:color={FONDO}:t=fill:enable='between(t,{a},{b})'")
    cadena.append(f"trim=start={r['ts']}:end={r['te']}")
    cadena.append("setpts=PTS-STARTPTS")
    # 't' dentro de crop es el del recorte (ya reiniciado), no el de la grabacion: los escalones se corren r['ts']
    escalones = [(0 if i == 0 else round(t - r["ts"], 3), y) for i, (t, y) in enumerate(r["tops"])]
    cadena.append(f"crop={ANCHO}:{r['alto']}:{X0}:'{y_expr(escalones)}':exact=1")
    cadena.append("fps=30")
    return ",".join(cadena)


def hacer(r):
    SALIDA.mkdir(exist_ok=True)
    origen = CRUDAS / r["fuente"]
    destino = SALIDA / (r["nombre"] + ".mp4")
    tops = r["tops"]
    # seguridad: el recorte nunca puede salirse de la grabacion ni pisar la franja de abajo (y >= 925) o la caja de escribir
    for (_, y) in tops:
        assert y + r["alto"] <= 925, (r["nombre"], y, r["alto"])
    cmd = ["ffmpeg", "-y", "-hide_banner", "-loglevel", "error", "-i", str(origen), "-an", "-vf", filtro(r),
           "-c:v", "libx264", "-preset", "slow", "-crf", "12", "-pix_fmt", "yuv420p", "-movflags", "+faststart", str(destino)]
    p = subprocess.run(cmd, capture_output=True, text=True)
    if p.returncode != 0:
        print(f"  ERROR {r['nombre']}: {p.stderr[-800:]}")
        return False
    print(f"  {r['nombre']}.mp4  {destino.stat().st_size / 1024:.0f} KB")
    return True


def main():
    args = sys.argv[1:]
    if "--lista" in args:
        for r in RECORTES:
            print(f"{r['nombre']:<34} {r['ts']:5.1f}-{r['te']:5.1f} s  tops {r['tops']}  alto {r['alto']}  {r['que']}")
        return 0
    if not CRUDAS.exists():
        print(f"No encuentro las grabaciones crudas: {CRUDAS}")
        return 2
    sel = [r for r in RECORTES if not args or r["nombre"] in args]
    if not sel:
        print("Ningun recorte se llama asi. Probar con --lista.")
        return 2
    return 0 if all([hacer(r) for r in sel]) else 1


if __name__ == "__main__":
    sys.exit(main())
