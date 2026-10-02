#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""Saca de la grabacion real del 02/10/2026 los recortes que usa escenas_v2.json (el video, version 2).

La grabacion cruda (toma-produccion-1249.mp4: pantalla entera, 1920x1080, 10 cuadros por segundo) NO se copia al
repositorio: vive en .sgc-cache/claude-por-area/tomas-crudas/ (carpeta que git ignora). De ahi salen, con este
programa, recortes chicos en tomas/ que ya vienen cortados a la zona que SE PUEDE MOSTRAR:

  - nunca la lista de conversaciones de la izquierda ni el nombre de la cuenta,
  - nunca la barra de tareas ni el escritorio,
  - nunca la franja de abajo con «Omitir permisos» y «Confirmar cambios»,
  - nunca la bandeja de Outlook (el tramo 182-196 s de la grabacion no se usa).

Cada recorte es una lista de tramos de tiempo (segundos de la grabacion) y una o mas zonas (x, y, ancho, alto, en
pixeles de la grabacion). Con dos zonas, una arriba de la otra, se pegan en una sola imagen: sirve para mostrar la
conversacion y el cuadro donde se escribe sin la franja de «Confirmar cambios» que queda en el medio.

Uso:
    python recortar_demo_v2.py            hace todos los recortes (pisa los que ya estan)
    python recortar_demo_v2.py nombre     hace solo ese
    python recortar_demo_v2.py --lista    dice que hace cada uno
"""
import subprocess
import sys
from pathlib import Path

AQUI = Path(__file__).resolve().parent
CRUDA = AQUI.parents[2] / ".sgc-cache" / "claude-por-area" / "tomas-crudas" / "toma-produccion-1249.mp4"
SALIDA = AQUI / "tomas"

# La ventana de Claude a pantalla entera: la conversacion ocupa x 740-1420. Con la ventana pegada a la mitad
# izquierda de la pantalla (desde ~165 s) la conversacion va en x 262-938 y Outlook ocupa la mitad derecha.
CHAT = (740, 60, 680)
CHAT_MITAD = (262, 60, 676)

RECORTES = [
    {   # la pregunta de las tres piezas, de que se manda hasta que Claude contesta y cita sus fuentes
        "nombre": "demo-02oct-tres-piezas-responde",
        "tramos": [(31.6, 80.0)],
        "zonas": [(*CHAT, 470)],       # corta antes de la linea «Los dos estan en Y:\...» (ruta interna del servidor)
        "que": "Se manda la pregunta; Claude busca, lee el P-09.1 y contesta con la lista de pasos y las fuentes.",
    },
    {   # el pedido del mail, ya enviado, mientras Claude trabaja
        "nombre": "demo-02oct-mail-pedido",
        "tramos": [(99.4, 140.3)],       # a los 141 s ya asoma la ventana de Outlook por abajo
        "zonas": [(*CHAT, 330)],
        "que": "El pedido «Armame un mail para...» y Claude armando el borrador (antes de que se abra Outlook).",
    },
    {   # la ventana de Outlook con el borrador (solo la ventana: sin lo que hay detras, ni la barra de tareas)
        "nombre": "demo-02oct-mail-se-abre",
        "tramos": [(141.7, 147.4)],       # antes la ventana todavia se esta dibujando; despues la mueve con el mouse
        "zonas": [(444, 328, 1148, 596)],
        "que": "Se abre Outlook con el mail armado: Para, asunto, texto y firma, y el boton Enviar.",
    },
    {   # «mandalo» escrito en el cuadro de Claude y la conversacion arriba (pegados: se saca la franja del medio)
        "nombre": "demo-02oct-mail-mandalo",
        "tramos": [(156.9, 159.55)],      # a los 159,6 s aparece la vista previa de la barra de tareas (Enviados)
        "zonas": [(*CHAT, 560), (740, 964, 680, 42)],
        "que": "Se escribe «mandalo» en el cuadro de Claude y aparece en la conversacion.",
    },
    {   # Claude manda el mail y lo dice (ventana pegada a la izquierda; Outlook, que esta a la derecha, no entra)
        "nombre": "demo-02oct-mail-listo",
        "tramos": [(177.5, 182.3)],       # antes del 177,4 se ve la guia gris para pegar ventanas; Outlook (a la derecha) queda afuera del recorte
        "zonas": [(*CHAT_MITAD, 590)],
        "que": "Claude manda el mail y contesta «Listo: salio a Facundo Santoro...».",
    },
    {   # el pedido de la presentacion y Claude trabajando
        "nombre": "demo-02oct-presentacion-pedido",
        "tramos": [(209.6, 213.0), (249.0, 257.0)],   # el 209,0 todavia muestra la tarjeta de uso de la cuenta
        "zonas": [(*CHAT, 330)],
        "que": "El pedido «Armame una presentacion de 3 hojas...» y Claude armandola.",
    },
    {   # PowerPoint abierto con las diapositivas (sin la cinta de arriba, el titulo ni la barra de tareas)
        "nombre": "demo-02oct-presentacion-powerpoint",
        "tramos": [(291.0, 307.0)],
        "zonas": [(0, 196, 1790, 764)],
        "que": "PowerPoint abierto con las diapositivas que armo Claude, cada una con su fuente al pie.",
    },
    {   # le ensena la tarea y Claude muestra como quedaria
        "nombre": "demo-02oct-aprende-propone",
        "tramos": [(323.4, 326.0), (338.6, 352.0)],   # del 333,3 al 338,3 la pantalla muestra OTRA conversacion: no entra
        "zonas": [(*CHAT, 400)],
        "que": "Se le ensena el parte de fin de turno y Claude muestra como quedaria la habilidad: «¿La guardo asi?».",
    },
    {   # la respuesta de la persona y «Listo, la deje guardada»
        "nombre": "demo-02oct-aprende-guardado",
        "tramos": [(377.4, 393.4)],
        "zonas": [(740, 380, 680, 340)],
        "que": "La persona dice que si, Claude crea la habilidad y contesta «Listo, la deje guardada».",
    },
]


def grafo(r):
    """El filtro de ffmpeg de un recorte: zonas (una o dos, apiladas) y tramos de tiempo pegados."""
    partes = []
    zonas = r["zonas"]
    ancho = zonas[0][2]
    assert all(z[2] == ancho for z in zonas), "las zonas apiladas tienen que tener el mismo ancho"
    assert all(z[2] % 2 == 0 for z in zonas) and sum(z[3] for z in zonas) % 2 == 0, "ancho y alto pares (yuv420p)"
    n = len(r["tramos"])
    if n > 1:
        partes.append(f"[0:v]split={n}" + "".join(f"[t{i}]" for i in range(n)))
    for i, (a, b) in enumerate(r["tramos"]):
        ent = f"[t{i}]" if n > 1 else "[0:v]"
        corte = f"trim=start={a:.3f}:end={b:.3f},setpts=PTS-STARTPTS"
        if len(zonas) == 1:
            x, y, w, h = zonas[0]
            partes.append(f"{ent}{corte},crop={w}:{h}:{x}:{y},fps=10[v{i}]")
        else:
            k = len(zonas)
            partes.append(f"{ent}{corte},split={k}" + "".join(f"[z{i}_{j}]" for j in range(k)))
            for j, (x, y, w, h) in enumerate(zonas):
                partes.append(f"[z{i}_{j}]crop={w}:{h}:{x}:{y}[c{i}_{j}]")
            partes.append("".join(f"[c{i}_{j}]" for j in range(k)) + f"vstack=inputs={k},fps=10[v{i}]")
    if n > 1:
        partes.append("".join(f"[v{i}]" for i in range(n)) + f"concat=n={n}:v=1:a=0[sal]")
        return ";".join(partes), "[sal]"
    return ";".join(partes), "[v0]"


def hacer(r):
    SALIDA.mkdir(exist_ok=True)
    destino = SALIDA / (r["nombre"] + ".mp4")
    g, etiqueta = grafo(r)
    cmd = ["ffmpeg", "-y", "-hide_banner", "-loglevel", "error", "-i", str(CRUDA), "-an", "-filter_complex", g,
           "-map", etiqueta, "-c:v", "libx264", "-preset", "slow", "-crf", "12", "-pix_fmt", "yuv420p",
           "-movflags", "+faststart", str(destino)]
    p = subprocess.run(cmd, capture_output=True, text=True)
    if p.returncode != 0:
        print(f"  ERROR {r['nombre']}: {p.stderr[-600:]}")
        return False
    print(f"  {r['nombre']}.mp4  {destino.stat().st_size / 1024:.0f} KB")
    return True


def main():
    args = sys.argv[1:]
    if "--lista" in args:
        for r in RECORTES:
            dur = sum(b - a for a, b in r["tramos"])
            print(f"{r['nombre']:<40} {dur:5.1f} s  zonas {r['zonas']}  {r['que']}")
        return 0
    if not CRUDA.exists():
        print(f"No encuentro la grabacion cruda: {CRUDA}")
        return 2
    sel = [r for r in RECORTES if not args or r["nombre"] in args]
    if not sel:
        print("Ningun recorte se llama asi. Probar con --lista.")
        return 2
    ok = all([hacer(r) for r in sel])
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
