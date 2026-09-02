# -*- coding: utf-8 -*-
# Interprete: .venv-cad (Py3.12). Correr:
#   C:\Dev\BarackMercosul\.venv-cad\Scripts\python.exe gate_proceso.py --help
"""GATE DE PROCESO — que le pasa a la PIEZA mientras la trabajan. Antes de tocar CAD.

Por que existe. Tres entregas del dispositivo de adhesivado en tres dias, las tres
rechazadas. **El calculo estructural estaba bien las tres veces.** Lo que fallaba era otra
cosa, y era siempre la misma: se disenaba la ESTRUCTURA (que aguante, que no vuelque, que
entre por la puerta) y no se disenaba el PROCESO. El carro apoyaba la pieza y asumia que se
quedaba quieta; el adhesivo va A PISTOLA. Fak, 31/08/2026, textual:

    "no se que, pones la tela ahi, le tiras adhesivo directamente, SE VA A VOLAR LA TELA"

Ninguno de los gates que ya existian podia ver eso. GATE 0 mira la ZONA, GATE 1 el
ensamble, GATE 3 el artefacto, GATE 4 el tamano: todos miran la pieza QUIETA. Un
dispositivo puede pasarlos los cuatro y no servir, porque lo que lo hace fallar pasa
mientras el operario trabaja.

Que exige, y de que fallo real sale cada cosa:

  A. LAS FUERZAS (el fallo del aire de la pistola). Por cada familia de fuerza que aplica
     a este proceso: que magnitud tiene, en que ETAPA actua, y QUE PIEZA del dispositivo
     la resuelve. Una pieza que no esta en la lista de piezas no es una respuesta; una
     respuesta de tres palabras tampoco. Y toda ETAPA de la secuencia tiene que tener al
     menos una fuerza analizada: la etapa sin fuerzas es la que nadie penso — que es
     literalmente lo que paso con "mientras se rocia".

  B. LAS FUENTES (el fallo del video). Si el que pide mando un video, un plano o una foto,
     eso ES el pliego y se mira ANTES de disenar. El video de Carlos (7 min, adhesivado con
     rueda y plato giratorio) estaba desde el 20/08 y no se uso en ninguna de las dos
     primeras vueltas. Con --carpeta-pedido el gate BUSCA los videos en la carpeta del
     pedido y falla si hay alguno que el pliego no declara: lo que hay que cazar es la
     OMISION, no la mentira.

  C. EL RETORNO DE EXPERIENCIA (Fak: "no entiendo por que no lo hacemos"). Antes de
     inventar, mirar lo que Barack ya tiene fabricado y andando. El gate lo verifica contra
     el indice de indice_dispositivos.py: si el indice tiene dispositivos y el pliego no
     abrio ninguno, es rojo. Y si el indice esta viejo o le falta una raiz obligatoria,
     tambien — porque un "no hay nada parecido" apoyado en un indice incompleto es la
     conclusion falsa que habilita a inventar de cero.

Lo que este gate NO hace: juzgar si la respuesta es BUENA. No sabe de adhesivos. Verifica
que la pregunta este contestada, que la respuesta apunte a una pieza que existe y que los
numeros tengan unidad o digan TBD con motivo. La maquina puede MATAR un dato, nunca
APROBARLO.

Uso:
    gate_proceso.py plantilla --tags adhesivo-a-pistola,pieza-flexible > pliego.json
    gate_proceso.py verificar pliego.json --workdir W [--carpeta-pedido <dir del pedido>]
    gate_proceso.py familias            # que pregunta cada familia y cuando aplica

Codigos de salida: 0 OK (puede traer avisos) · 1 falla dura · 2 uso incorrecto.
"""
import argparse
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from cadlib import workdir  # noqa: E402
import indice_dispositivos as idx  # noqa: E402

AQUI = os.path.dirname(os.path.abspath(__file__))
CANON = os.path.join(AQUI, "procesoCanon.data.json")

OK, FALLA, USO = 0, 1, 2

VIDEO_EXT = (".mp4", ".mov", ".avi", ".mkv", ".webm", ".m4v", ".wmv")


def canon():
    with open(CANON, "r", encoding="utf-8") as f:
        return json.load(f)


# =====================================================================================
# el corazon: que familias de fuerza son obligatorias para ESTE proceso
# =====================================================================================
def familias_requeridas(c, tags):
    """Universales (aplica_si vacio) + las que dispara alguna etiqueta del proceso."""
    req = []
    for f in c["familiasDeFuerza"]["entradas"]:
        ap = f.get("aplica_si") or []
        if not ap or (set(ap) & set(tags)):
            req.append(f)
    return req


# =====================================================================================
# verificacion
# =====================================================================================
class Resultado(object):
    def __init__(self):
        self.rojos, self.avisos = [], []

    def rojo(self, gate, msg, detalle=None):
        self.rojos.append((gate, msg, detalle))

    def aviso(self, msg):
        self.avisos.append(msg)

    @property
    def ok(self):
        return not self.rojos


def _texto(v):
    return v.strip() if isinstance(v, str) else ""


def verificar_fuerzas(c, p, r):
    """A — las fuerzas del proceso, sus etapas y quien las resuelve."""
    etiquetas_ok = {e["id"] for e in c["etiquetasProceso"]["entradas"]}
    tags = p.get("tags") or []
    desconocidas = [t for t in tags if t not in etiquetas_ok]
    if desconocidas:
        r.rojo("G-P0", "etiquetas de proceso que no estan en el canon: %s" % ", ".join(desconocidas),
               "Se agregan a procesoCanon.data.json con su fuente, no se inventan en el pliego.\n"
               "  Disponibles: %s" % ", ".join(sorted(etiquetas_ok)))
    if not tags:
        r.rojo("G-P0", "el pliego no declara ninguna etiqueta de proceso (campo 'tags')",
               "Sin saber que le pasa a la pieza no se puede saber que fuerzas hay que contestar.")

    piezas = {d.get("id") for d in (p.get("piezas") or []) if isinstance(d, dict)}
    if not piezas:
        r.rojo("G-P0", "el pliego no declara las PIEZAS del dispositivo (campo 'piezas')",
               "Una respuesta tiene que apuntar a una pieza concreta; sin la lista no hay contra que cotejar.")

    secuencia = [_texto(s.get("etapa")) for s in (p.get("secuencia") or []) if isinstance(s, dict)]
    secuencia = [s for s in secuencia if s]
    if not secuencia:
        r.rojo("G-P0", "el pliego no declara la SECUENCIA del proceso (campo 'secuencia')",
               "El proceso es una sucesion de etapas; sin ellas se vuelve a disenar la pieza quieta.")

    fuerzas = [f for f in (p.get("fuerzas") or []) if isinstance(f, dict)]
    familias_canon = {f["id"]: f for f in c["familiasDeFuerza"]["entradas"]}
    declaradas = {}
    for f in fuerzas:
        fam = _texto(f.get("familia"))
        if fam not in familias_canon:
            r.rojo("G-P1", "familia de fuerza desconocida: '%s'" % (fam or "(vacia)"),
                   "Familias validas: %s" % ", ".join(sorted(familias_canon)))
            continue
        declaradas.setdefault(fam, []).append(f)

    # --- G-P1: falta una familia obligatoria ---
    for fam in familias_requeridas(c, tags):
        if fam["id"] not in declaradas:
            por = ("siempre" if not fam.get("aplica_si")
                   else "porque el proceso es " + ", ".join(sorted(set(fam["aplica_si"]) & set(tags))))
            r.rojo("G-P1", "falta contestar la fuerza '%s' (%s)" % (fam["id"], por),
                   "%s\n  Fuente: %s" % (fam["pregunta"], fam.get("fuente", "-")))

    # --- G-P2/G-P3: cada fuerza declarada, bien formada ---
    etapas_cubiertas = set()
    umb = c["umbrales"]["minCaracteresComo"]["valor"]
    for fam, lista in sorted(declaradas.items()):
        for f in lista:
            et = _texto(f.get("etapa"))
            if not et:
                r.rojo("G-P2", "la fuerza '%s' no dice en que ETAPA actua" % fam)
            elif et not in secuencia:
                r.rojo("G-P2", "la fuerza '%s' actua en la etapa '%s', que no esta en la secuencia" % (fam, et),
                       "Etapas declaradas: %s" % ", ".join(secuencia))
            else:
                etapas_cubiertas.add(et)

            # magnitud: numero con unidad y fuente, o TBD con motivo. Nunca un numero solo.
            m = f.get("magnitud")
            if not isinstance(m, dict):
                r.rojo("G-P2", "la fuerza '%s' no declara magnitud" % fam,
                       'Va {"valor": N, "unidad": "...", "fuente": "..."} o {"tbd": true, "motivo": "..."}')
            elif m.get("tbd"):
                if not _texto(m.get("motivo")):
                    r.rojo("G-P2", "la fuerza '%s' dice TBD sin motivo" % fam,
                           "Un TBD sin motivo es un hueco tapado. Va por que falta el dato y quien lo tiene.")
                else:
                    r.aviso("'%s': magnitud TBD — %s" % (fam, m["motivo"]))
            else:
                if m.get("valor") is None or not _texto(m.get("unidad")):
                    r.rojo("G-P2", "la magnitud de '%s' no tiene valor y unidad" % fam,
                           "Un numero que va a una maquina se confirma con su UNIDAD.")
                if not _texto(m.get("fuente")):
                    r.rojo("G-P2", "la magnitud de '%s' no dice de donde sale" % fam,
                           "Un dato tecnico se cita o no se escribe (core-prohibiciones #1).")

            # resuelve: una pieza real + como. O no_resuelto declarado.
            res = f.get("resuelve")
            if not isinstance(res, dict):
                r.rojo("G-P3", "la fuerza '%s' no dice QUE la resuelve" % fam)
                continue
            if res.get("no_resuelto"):
                if not _texto(res.get("motivo")):
                    r.rojo("G-P3", "la fuerza '%s' esta marcada no_resuelto sin motivo" % fam)
                else:
                    r.aviso("NO RESUELTO — '%s': %s" % (fam, res["motivo"]))
                continue
            pieza = _texto(res.get("pieza"))
            if pieza not in piezas:
                r.rojo("G-P3", "la fuerza '%s' la resuelve '%s', que no es una pieza del dispositivo"
                       % (fam, pieza or "(vacio)"),
                       "Piezas declaradas: %s\n"
                       "  Una respuesta en prosa que no apunta a una pieza no es un diseno: es una intencion."
                       % (", ".join(sorted(piezas)) or "(ninguna)"))
            if len(_texto(res.get("como"))) < umb:
                r.rojo("G-P3", "la respuesta de '%s' es demasiado corta para decir algo" % fam,
                       "Menos de %d caracteres. Va como la resuelve, no que la resuelve." % umb)

    # --- G-P4: la etapa que nadie penso ---
    huerfanas = [e for e in secuencia if e not in etapas_cubiertas]
    if huerfanas:
        r.rojo("G-P4", "etapas del proceso sin ninguna fuerza analizada: %s" % ", ".join(huerfanas),
               "Es el fallo del 31/08 en una linea: la etapa 'mientras se rocia' existia en la\n"
               "  secuencia y no tenia una sola fuerza contestada. Una etapa sin fuerzas es\n"
               "  estructura, no proceso.")


def verificar_fuentes(c, p, r, carpeta_pedido=None):
    """B — el video ES el pliego. Lo que hay que cazar es la omision."""
    fuentes = [f for f in (p.get("fuentes") or []) if isinstance(f, dict)]
    for f in fuentes:
        ruta = _texto(f.get("ruta"))
        tipo = _texto(f.get("tipo")) or "?"
        if not ruta:
            r.rojo("G-P5", "hay una fuente declarada sin ruta")
            continue
        if not os.path.exists(ruta):
            r.rojo("G-P5", "la fuente %s no existe en el disco: %s" % (tipo, ruta),
                   "Una fuente que no se puede abrir no respalda nada "
                   "(feedback_no_pedir_lo_que_no_verifique_que_existe).")
            continue
        if not f.get("visto"):
            r.rojo("G-P5", "la fuente %s esta declarada pero NO vista: %s" % (tipo, os.path.basename(ruta)),
                   "En esta casa el video ES el pliego: lo que se ve manda sobre lo que uno suponga.")
            continue
        ev = _texto(f.get("evidencia"))
        if not ev or not os.path.exists(ev):
            r.rojo("G-P5", "la fuente %s dice 'vista' sin evidencia en disco" % os.path.basename(ruta),
                   "Evidencia = los cuadros extraidos, la captura, el extracto. Marcar 'visto: true'\n"
                   "  a mano es exactamente el verde vacio que este gate existe para no dar.")

    if carpeta_pedido:
        if not os.path.isdir(carpeta_pedido):
            r.rojo("G-P5", "la carpeta del pedido no existe: %s" % carpeta_pedido)
            return
        declaradas = {os.path.normcase(os.path.abspath(_texto(f.get("ruta"))))
                      for f in fuentes if _texto(f.get("ruta"))}
        faltan = []
        for dirpath, _, filenames in os.walk(carpeta_pedido):
            for fn in filenames:
                if fn.lower().endswith(VIDEO_EXT):
                    full = os.path.normcase(os.path.abspath(os.path.join(dirpath, fn)))
                    if full not in declaradas:
                        faltan.append(os.path.join(dirpath, fn))
        if faltan:
            r.rojo("G-P5", "hay %d video(s) en la carpeta del pedido que el pliego no declara" % len(faltan),
                   "\n".join("  - %s" % v for v in faltan) +
                   "\n  El de Carlos estuvo ahi desde el 20/08 y no se uso en dos vueltas de diseno.\n"
                   "  Si genuinamente no aplica, va declarado igual con 'visto' y el motivo.")


def verificar_retorno(c, p, r):
    """C — reusar antes de crear, verificado contra el indice."""
    ret = p.get("retorno_experiencia")
    if not isinstance(ret, dict):
        r.rojo("G-P6", "el pliego no declara retorno de experiencia",
               "Antes de inventar uno nuevo se mira lo que Barack ya tiene andando.\n"
               "  Que hay:  indice_dispositivos.py --buscar <lo que busco>")
        return

    datos = idx.cargar_indice(ret.get("indice") or idx.SALIDA_JSON)
    if datos is None:
        r.rojo("G-P6", "no hay indice de dispositivos para verificar el relevamiento",
               "Correr: indice_dispositivos.py")
        return

    dias_max = c["umbrales"]["indiceDiasFrescura"]["valor"]
    dias = idx.dias_de_antiguedad(datos)
    if dias > dias_max:
        r.rojo("G-P6", "el indice de dispositivos tiene %.0f dias (maximo %d)" % (dias, dias_max),
               "Re-escanear: indice_dispositivos.py")
    caidas = [x for x in datos["raices"] if x.get("obligatoria") and x.get("estado") != "ok"]
    if caidas:
        r.rojo("G-P6", "el indice se armo con %d raiz(ces) obligatoria(s) caida(s): %s"
               % (len(caidas), ", ".join(x["id"] for x in caidas)),
               "Un indice incompleto se lee igual que 'no hay nada parecido'.")

    disponibles = len(datos.get("dispositivos", []))
    abiertos = [a for a in (ret.get("candidatos_abiertos") or []) if isinstance(a, dict)]
    if disponibles and not abiertos:
        r.rojo("G-P6", "el indice tiene %d dispositivos ya fabricados y el pliego no abrio ninguno"
               % disponibles,
               "Fak, 31/08/2026: 'no entiendo por que no lo hacemos'.\n"
               "  Buscar:  indice_dispositivos.py --buscar <mecanismo que necesito>")
    for a in abiertos:
        ruta = _texto(a.get("ruta"))
        if not ruta or not os.path.exists(ruta):
            r.rojo("G-P6", "el candidato '%s' apunta a algo que no existe: %s"
                   % (_texto(a.get("id")) or "?", ruta or "(vacio)"))
            continue
        if len(_texto(a.get("que_vi"))) < c["umbrales"]["minCaracteresComo"]["valor"]:
            r.rojo("G-P6", "del candidato '%s' no se escribio que se vio adentro" % os.path.basename(ruta),
                   "Abrirlo y no anotar como resuelve lo suyo es no haberlo abierto.")
        if not a.get("se_reusa") and not _texto(a.get("motivo")):
            r.rojo("G-P6", "el candidato '%s' se descarta sin motivo" % os.path.basename(ruta),
                   "Descartar lo que ya funciona es una decision, y las decisiones llevan motivo.")


def verificar(pliego_path, workdir_path=None, carpeta_pedido=None):
    c = canon()
    with open(pliego_path, "r", encoding="utf-8") as f:
        p = json.load(f)

    r = Resultado()
    verificar_fuerzas(c, p, r)
    verificar_fuentes(c, p, r, carpeta_pedido)
    verificar_retorno(c, p, r)

    print("GATE DE PROCESO — %s" % (p.get("dispositivo") or os.path.basename(pliego_path)))
    print("  pieza: %s | etiquetas: %s" % (p.get("pieza") or "-", ", ".join(p.get("tags") or []) or "-"))
    req = [f["id"] for f in familias_requeridas(c, p.get("tags") or [])]
    print("  fuerzas obligatorias para este proceso: %d (%s)" % (len(req), ", ".join(req)))
    print("")

    for msg in r.avisos:
        print("  AVISO  %s" % msg)
    if r.avisos:
        print("")

    if r.ok:
        print("VERDE — el proceso esta declarado y contestado.")
        if workdir_path:
            w = workdir.ensure_workdir(workdir_path)
            no_resueltas = [f.get("familia") for f in (p.get("fuerzas") or [])
                            if isinstance(f, dict) and isinstance(f.get("resuelve"), dict)
                            and f["resuelve"].get("no_resuelto")]
            workdir.record_evidence(
                w, "proceso_declarado",
                pliego=os.path.basename(pliego_path),
                pliego_firma=workdir.file_signature(pliego_path),
                dispositivo=p.get("dispositivo"),
                tags=p.get("tags"),
                familias_requeridas=req,
                etapas=[s.get("etapa") for s in (p.get("secuencia") or []) if isinstance(s, dict)],
                no_resueltas=no_resueltas,
                avisos=r.avisos)
            print("Evidencia 'proceso_declarado' registrada en %s/manifest.json" % w)
            if no_resueltas:
                print("OJO: %d fuerza(s) sin resolver (%s). El gate de diseno las deja pasar; "
                      "export_deliverables.py NO entrega con eso." % (len(no_resueltas), ", ".join(no_resueltas)))
        return OK

    print("ROJO — %d problema(s). No se modela hasta que esto cierre.\n" % len(r.rojos))
    for gate, msg, det in r.rojos:
        print("  [%s] %s" % (gate, msg))
        if det:
            for linea in det.split("\n"):
                print("      %s" % linea.lstrip())
        print("")
    return FALLA


# =====================================================================================
# plantilla y ayuda
# =====================================================================================
def plantilla(tags):
    c = canon()
    req = familias_requeridas(c, tags)
    return {
        "dispositivo": "TBD — nombre del dispositivo",
        "pieza": "TBD — que pieza trabaja",
        "tags": tags,
        "secuencia": [{"etapa": "TBD-1", "que": "que pasa en esta etapa"}],
        "piezas": [{"id": "TBD-pieza", "nombre": "TBD — como se llama en el plano"}],
        "fuerzas": [
            {"familia": f["id"],
             "_pregunta": f["pregunta"],
             "etapa": "TBD-1",
             "magnitud": {"tbd": True, "motivo": "TBD — por que falta el dato y quien lo tiene"},
             "resuelve": {"pieza": "TBD-pieza", "como": "TBD — como esa pieza resuelve esta fuerza"}}
            for f in req],
        "fuentes": [{"tipo": "video", "ruta": "TBD", "visto": False, "evidencia": "TBD — cuadros extraidos"}],
        "retorno_experiencia": {
            "indice": os.path.abspath(idx.SALIDA_JSON),
            "candidatos_abiertos": [
                {"id": "TBD", "ruta": "TBD", "que_vi": "TBD — como resuelve lo suyo",
                 "se_reusa": False, "motivo": "TBD"}]},
    }


def main():
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest="cmd")

    v = sub.add_parser("verificar", help="verifica un pliego de proceso")
    v.add_argument("pliego")
    v.add_argument("--workdir", help="si pasa, registra la evidencia 'proceso_declarado'")
    v.add_argument("--carpeta-pedido", help="carpeta del pedido: busca videos que el pliego no declare")

    t = sub.add_parser("plantilla", help="emite un pliego en blanco con las fuerzas que aplican")
    t.add_argument("--tags", default="", help="etiquetas de proceso separadas por coma")

    sub.add_parser("familias", help="lista las familias de fuerza y cuando aplican")

    args = ap.parse_args()

    if args.cmd == "verificar":
        return verificar(args.pliego, args.workdir, args.carpeta_pedido)
    if args.cmd == "plantilla":
        tags = [t.strip() for t in args.tags.split(",") if t.strip()]
        print(json.dumps(plantilla(tags), indent=2, ensure_ascii=False))
        return OK
    if args.cmd == "familias":
        c = canon()
        print("ETIQUETAS DE PROCESO (con estas se arma la lista de fuerzas):\n")
        for e in c["etiquetasProceso"]["entradas"]:
            print("  %-24s %s" % (e["id"], e["que"]))
        print("\nFAMILIAS DE FUERZA:\n")
        for f in c["familiasDeFuerza"]["entradas"]:
            print("  %-28s %s" % (f["id"], "SIEMPRE" if not f.get("aplica_si")
                                  else "si: " + ", ".join(f["aplica_si"])))
            print("  %-28s %s" % ("", f["pregunta"]))
            print("")
        return OK

    ap.print_help()
    return USO


if __name__ == "__main__":
    sys.exit(main())
