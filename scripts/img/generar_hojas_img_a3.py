# -*- coding: utf-8 -*-
"""generar_hojas_img_a3.py — las hojas de la moldeadora IMG en el formato A3 de una foto por paso.

Fak, 13/10/2026: "intentemos alinear el formato, asi cuando imprimo, imprimo todo en A3". Las hojas de la
IMG estaban en A4 (generar_hojas_img.py y generar_cambio_molde_img.py) y con "HO-TBD". Aca NO se reescribe
ningun paso: el texto, las fotos, los pies y las notas salen de esos dos specs, que Fak ya corrigio en
septiembre. Lo que cambia es el formato (motor scripts/hotmelt/hoja_a3_fotos.py) y la numeracion, con la
regla del 08/10/2026 (skill hojas-de-proceso, 3 bis):

  produccion  -> HO-992 TOP ROLL, operacion 30 del flujograma 155: las hojas 31..37 pasan a 30.1..30.7
  maquina     -> HO-996 CAMBIO DE MOLDE (hoja de maquina, 2- SECTORES): las hojas 38..46 pasan a 10..90

    python scripts/img/generar_hojas_img_a3.py [produccion] [maquina] [--out carpeta] [--sin-pdf] [--sin-portada]
"""
import os
import re
import sys

from pptx import Presentation
from pptx.util import Cm

AQUI = os.path.dirname(os.path.abspath(__file__))
RAIZ = os.path.abspath(os.path.join(AQUI, "..", ".."))
sys.path.insert(0, AQUI)
sys.path.insert(0, os.path.join(RAIZ, "scripts", "hotmelt"))
sys.path.insert(0, os.path.join(RAIZ, ".claude", "skills", "hojas-de-proceso", "scripts"))
import generar_hojas_img as gh                 # noqa: E402
import generar_cambio_molde_img as cm          # noqa: E402
import generar_hojas_hotmelt_a3 as base        # noqa: E402
import hoja_a3_fotos as H                      # noqa: E402
import hoja_proceso_check as CHK               # noqa: E402
from redaccion import gate_redaccion           # noqa: E402

SALIDA = os.path.join(RAIZ, "exports", "hojas-img-a3")
if "--out" in sys.argv:
    _i = sys.argv.index("--out")
    SALIDA = os.path.abspath(sys.argv[_i + 1])
    del sys.argv[_i:_i + 2]
FECHA = "13/10/2026"
MAQUINA_TXT = "Moldeadora IMG (termoformado y laminado)"

OP_PRODUCCION = {str(n): f"30.{n - 30}" for n in range(31, 38)}
OP_MAQUINA = {str(n): str((n - 37) * 10) for n in range(38, 47)}
OP_NUEVA = dict(OP_PRODUCCION, **OP_MAQUINA)


def renumerar(texto, avisos):
    """Una hoja que nombra a otra por su numero viejo («ver la hoja 40») pasa al numero nuevo."""
    def cambio(m):
        # "hojas 41 y 42", "hojas 41 a 46": se cambian TODOS los numeros de la lista, no solo el primero
        nuevos = re.sub(r"\d{2}", lambda n: OP_NUEVA.get(n.group(0), n.group(0)), m.group(2))
        if nuevos != m.group(2):
            avisos.append(f"referencia '{m.group(0)}' -> '{m.group(1)}{nuevos}'")
        return m.group(1) + nuevos
    return re.sub(r"(?i)\b((?:hojas?)\s+)(\d{2}(?:\s*(?:y|a|,)\s*\d{2})*)\b", cambio, texto)


def a_a3(h, avisos):
    """Una hoja del spec A4 -> el dict que dibuja hoja_a3_fotos. Mismo texto, misma foto."""
    imgs = h.get("imagenes") or []
    pies = h.get("pies") or []
    pasos = []
    if h.get("modo") == "rotulada":
        # una sola foto con los numeros puestos: todos los pasos apuntan a esa foto
        for i, t in enumerate(h["pasos"]):
            p = {"texto": renumerar(t, avisos)}
            if i == 0:
                p.update(foto=imgs[0], pie=(pies[0] if pies else ""), entera=True)
            else:
                p["misma_foto_que"] = 1
            pasos.append(p)
    else:
        if len(imgs) != len(h["pasos"]):
            raise SystemExit(f"OP {h['op']}: {len(imgs)} fotos para {len(h['pasos'])} pasos")
        for i, t in enumerate(h["pasos"]):
            pasos.append({"texto": renumerar(t, avisos), "foto": imgs[i], "pie": pies[i] if i < len(pies) else ""})
    partes = []
    if h.get("nota"):
        partes.append(renumerar(str(h["nota"]), avisos))
    for nombre, valor in (h.get("parametros") or []):
        partes.append(f"{nombre}: {valor}.")
    d = dict(op=OP_NUEVA[h["op"]], denominacion=h["denominacion"], pasos=pasos, epp=h.get("epp"))
    if partes:
        d["aviso"] = " ".join(partes)
    if h.get("hoja_de"):
        d["hoja_de"] = h["hoja_de"]
    return d


def para_redaccion(d):
    pies = [f.get("pie", "") for p in d["pasos"] for f in ([p] if p.get("foto") else [])]
    return dict(op=d["op"], denominacion=d["denominacion"], nota=d.get("aviso"),
                pasos=[p["texto"] for p in d["pasos"]], pies=pies)


JUEGOS = {
    "produccion": dict(
        hojas=gh.HOJAS_IMG, archivo="HO-992 - OP 30 TERMOFORMADO Y LAMINADO IMG - TOP ROLL",
        cajetin=dict(ho="HO-992", sector="IMG", pieza="TOP ROLL — N 216 / N 256 / N 285 / N 315",
                     modelo="PATAGONIA / VW427", cliente="VW / NOVAX"),
        portada=dict(titulo="HOJAS DE PROCESO — TOP ROLL PATAGONIA",
                     subtitulo="Operación 30 del flujograma 155: PROCESO DE TERMOFORMADO Y LAMINADO IMG",
                     ficha=[("Documento", "HO-992 · Form. I-IN-002.4-R01"),
                            ("Cliente / Proyecto", "VW / NOVAX · PATAGONIA / VW427"),
                            ("Pieza", "TOP ROLL — N 216 / N 256 / N 285 / N 315"),
                            ("Operación", "30 — PROCESO DE TERMOFORMADO Y LAMINADO IMG"),
                            ("Máquina", MAQUINA_TXT + " (cambio de molde: HO-996)"),
                            ("Elaboró", "F. Santoro · Ingeniería"),
                            ("Fecha / Revisión", f"{FECHA} · Rev. A")])),
    "maquina": dict(
        hojas=cm.HOJAS_CM, archivo="HO-996 - MOLDEADORA IMG - CAMBIO DE MOLDE - HOJA DE MAQUINA",
        cajetin=dict(ho="HO-996", sector="IMG", pieza="MOLDEADORA IMG — CAMBIO DE MOLDE",
                     modelo="PATAGONIA / VW427", cliente="VW / NOVAX"),
        portada=dict(titulo="HOJAS DE PROCESO — MOLDEADORA IMG",
                     subtitulo="Hoja de la máquina: cambio de molde",
                     ficha=[("Documento", "HO-996 · Form. I-IN-002.4-R01"),
                            ("Máquina", MAQUINA_TXT),
                            ("Sector", "IMG"),
                            ("Proyecto en curso", "PATAGONIA / VW427 · TOP ROLL (HO-992, operación 30)"),
                            ("Elaboró", "F. Santoro · Ingeniería"),
                            ("Fecha / Revisión", f"{FECHA} · Rev. A")])),
}


def generar(nombre, pdf=True):
    j = JUEGOS[nombre]
    prs = Presentation()
    prs.slide_width, prs.slide_height = Cm(base.W), Cm(base.H)
    refs, pendientes = [], []
    hojas = [a_a3(h, refs) for h in j["hojas"]]
    if "--sin-portada" not in sys.argv:
        indice = [(d["op"], d["denominacion"] + (f" (hoja {d['hoja_de'][0]} de {d['hoja_de'][1]})" if d.get("hoja_de") else ""))
                  for d in hojas]
        H.portada(prs, j["portada"]["titulo"], j["portada"]["subtitulo"], j["portada"]["ficha"], indice,
                  logo=base.LOGO_BARACK)
    for d0 in hojas:
        d = dict(fecha=FECHA, rev="A", **j["cajetin"])
        d.update(d0)
        try:
            gate_redaccion(para_redaccion(d))
        except SystemExit as e:
            # --para-mirar: arma la hoja igual para VER el formato; no sirve para imprimir ni para emitir
            if "--para-mirar" not in sys.argv:
                raise
            pendientes.append((d["op"], str(e)[:120]))
        _, avisos = H.hoja(prs, d, logo=base.LOGO_BARACK)
        print(f"  ok  OP {d['op']} {d['denominacion']}" + (f" ({d['hoja_de'][0]}/{d['hoja_de'][1]})" if d.get("hoja_de") else ""))
        for a in avisos:
            print(f"      aviso: {a}")
    for r in refs:
        print(f"      numero cambiado: {r}")
    os.makedirs(SALIDA, exist_ok=True)
    if pendientes:
        print(f"[{nombre}] OJO: {len(pendientes)} hoja(s) no pasan el control de redaccion. Sale SOLO PARA MIRAR.")
    ruta = os.path.join(SALIDA, ("PARA MIRAR - " if pendientes else "") + j["archivo"] + ".pptx")
    prs.core_properties.author = prs.core_properties.last_modified_by = "Facundo Santoro"
    prs.core_properties.comments = ""
    prs.save(ruta)
    print(f"[{nombre}] {len(hojas)} hojas -> {ruta}")
    fallas = CHK.revisar(ruta, {"*": {"secuencia": True}})
    if fallas:
        print(CHK.informe(fallas))
        raise SystemExit(1)
    print(f"[{nombre}] control de la hoja impresa: pasa")
    if pdf:
        base.exportar_pdf_com(ruta)
    return ruta


if __name__ == "__main__":
    pedidos = [a for a in sys.argv[1:] if not a.startswith("--")] or list(JUEGOS)
    for n in pedidos:
        generar(n, pdf="--sin-pdf" not in sys.argv)
