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
    gate_proceso.py plantilla --tags adhesivo-a-pistola,pieza-flexible --out pliego.json
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


def _es_placeholder(c, v):
    """El literal que emite la propia plantilla NO es una respuesta.

    Auditoria del 02/09/2026: la plantilla oficial, sin tocar una sola respuesta, daba VERDE
    y desbloqueaba la entrega — el umbral de "respuesta que dice algo" era de LARGO (25
    caracteres) y el placeholder mide 41. Un gate que aprueba su propio formulario en blanco
    es el verde vacio que este archivo dice existir para no dar.
    """
    t = _texto(v)
    if not t:
        return False
    ph = c.get("placeholders", {})
    if t in ph.get("literales", []):
        return True
    return any(t.upper().startswith(p.upper()) for p in ph.get("prefijos", []))


def _lista_estricta(p, clave, r, gate):
    """Devuelve la lista de dicts de p[clave], marcando ROJO lo que no lo sea.

    Por que no se filtra en silencio (ROB-5 de la auditoria): con `isinstance(x, dict)` como
    filtro, una etapa escrita como string o como numero **desaparecia del universo** en vez de
    fallar — y G-P4 ("toda etapa lleva una fuerza") no podia verla, porque para el gate ya no
    existia. Es el mismo modo de falla que el gate existe para cerrar, en version tipografica.
    """
    v = p.get(clave)
    if v is None:
        return []
    if not isinstance(v, list):
        r.rojo(gate, "'%s' tiene que ser una lista y vino %s" % (clave, type(v).__name__))
        return []
    buenas = []
    for i, x in enumerate(v):
        if isinstance(x, dict):
            buenas.append(x)
        else:
            r.rojo(gate, "'%s[%d]' no es un objeto: vino %s (%r)" % (clave, i, type(x).__name__, x),
                   "Un item con el tipo equivocado no se saltea: si no se puede leer, es rojo.")
    return buenas


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

    # --- piezas: el id vacio NO cuenta (ROB-1) ---
    # Antes el set se armaba con d.get("id") a secas: un `id: ""` dejaba el set en {""}, o sea
    # NO vacio (no disparaba "no declara PIEZAS"), y despues `"" in {""}` validaba CUALQUIER
    # respuesta. Un solo caracter faltante desarmaba el cruce entero.
    piezas = set()
    for d in _lista_estricta(p, "piezas", r, "G-P0"):
        pid = _texto(d.get("id"))
        if not pid:
            r.rojo("G-P0", "hay una pieza sin id: %r" % (d,),
                   "El id es lo que ata una respuesta a una pieza real. Vacio no ata nada.")
        elif _es_placeholder(c, pid) or _es_placeholder(c, d.get("nombre")):
            r.rojo("G-P0", "la pieza '%s' sigue con el texto de la plantilla" % pid)
        else:
            piezas.add(pid)
    if not piezas:
        r.rojo("G-P0", "el pliego no declara las PIEZAS del dispositivo (campo 'piezas')",
               "Una respuesta tiene que apuntar a una pieza concreta; sin la lista no hay contra que cotejar.")

    # --- secuencia: una etapa mal escrita es ROJO, no se filtra (ROB-5) ---
    secuencia = []
    for s in _lista_estricta(p, "secuencia", r, "G-P0"):
        et = _texto(s.get("etapa"))
        if not et:
            r.rojo("G-P0", "hay una etapa sin nombre: %r" % (s,))
        elif _es_placeholder(c, et):
            r.rojo("G-P0", "la etapa '%s' sigue con el texto de la plantilla" % et)
        else:
            secuencia.append(et)
    if not secuencia:
        r.rojo("G-P0", "el pliego no declara la SECUENCIA del proceso (campo 'secuencia')",
               "El proceso es una sucesion de etapas; sin ellas se vuelve a disenar la pieza quieta.")

    for campo in ("dispositivo", "pieza"):
        if _es_placeholder(c, p.get(campo)):
            r.rojo("G-P0", "el campo '%s' sigue con el texto de la plantilla: %r" % (campo, p.get(campo)),
                   "Un formulario en blanco no es un pliego contestado.")

    fuerzas = _lista_estricta(p, "fuerzas", r, "G-P1")
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
                if not _texto(m.get("motivo")) or _es_placeholder(c, m.get("motivo")):
                    r.rojo("G-P2", "la fuerza '%s' dice TBD sin motivo real" % fam,
                           "Un TBD sin motivo es un hueco tapado. Va por que falta el dato y quien lo tiene.")
                else:
                    r.aviso("'%s': magnitud TBD — %s" % (fam, m["motivo"]))
            else:
                # ROB-6: `is None` solo cazaba null. "el que sea", [] y 0 pasaban con unidad y
                # fuente. La regla dice que un numero que va a una maquina se confirma con su
                # unidad — y antes hay que confirmar que sea un NUMERO.
                val = m.get("valor")
                if isinstance(val, bool) or not isinstance(val, (int, float)):
                    r.rojo("G-P2", "la magnitud de '%s' no es un numero: %r" % (fam, val),
                           "Un valor de fuerza, presion, peso o tiempo es un numero. Si no se sabe, "
                           'va {"tbd": true, "motivo": "..."} — no un texto en el campo del valor.')
                if not _texto(m.get("unidad")):
                    r.rojo("G-P2", "la magnitud de '%s' no tiene unidad" % fam,
                           "Un numero que va a una maquina se confirma con su UNIDAD.")
                if not _texto(m.get("fuente")) or _es_placeholder(c, m.get("fuente")):
                    r.rojo("G-P2", "la magnitud de '%s' no dice de donde sale" % fam,
                           "Un dato tecnico se cita o no se escribe (core-prohibiciones #1).")

            # resuelve: una pieza real + como. O no_resuelto declarado.
            res = f.get("resuelve")
            if not isinstance(res, dict):
                r.rojo("G-P3", "la fuerza '%s' no dice QUE la resuelve" % fam)
                continue
            if res.get("no_resuelto"):
                if not _texto(res.get("motivo")) or _es_placeholder(c, res.get("motivo")):
                    r.rojo("G-P3", "la fuerza '%s' esta marcada no_resuelto sin motivo" % fam)
                else:
                    r.aviso("NO RESUELTO — '%s': %s" % (fam, res["motivo"]))
                continue
            if _es_placeholder(c, res.get("como")) or _es_placeholder(c, res.get("pieza")):
                r.rojo("G-P3", "la respuesta de '%s' sigue con el texto de la plantilla" % fam,
                       "Contestarla es reemplazar el TBD, no dejarlo puesto.")
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

    # --- ROB-7: la misma respuesta pegada en otra etapa no analiza esa etapa ---
    # Duplicar una fuerza cambiandole solo el nombre de la etapa tapaba G-P4 con copy-paste.
    vistos = {}
    for fam, lista in sorted(declaradas.items()):
        for f in lista:
            res = f.get("resuelve") if isinstance(f.get("resuelve"), dict) else {}
            firma = (fam, _texto(res.get("pieza")), _texto(res.get("como")).lower())
            if not firma[2]:
                continue
            if firma in vistos:
                r.rojo("G-P3", "la fuerza '%s' esta contestada igual en '%s' y en '%s'"
                       % (fam, vistos[firma], _texto(f.get("etapa"))),
                       "La misma respuesta pegada en otra etapa no analiza esa etapa: la tapa.\n"
                       "  Si la fuerza actua distinto en cada una, la respuesta tiene que decir en que.")
            else:
                vistos[firma] = _texto(f.get("etapa"))

    # --- G-P4: la etapa que nadie penso ---
    huerfanas = [e for e in secuencia if e not in etapas_cubiertas]
    if huerfanas:
        r.rojo("G-P4", "etapas del proceso sin ninguna fuerza analizada: %s" % ", ".join(huerfanas),
               "Es el fallo del 31/08 en una linea: la etapa 'mientras se rocia' existia en la\n"
               "  secuencia y no tenia una sola fuerza contestada. Una etapa sin fuerzas es\n"
               "  estructura, no proceso.")


def verificar_fuentes(c, p, r, carpeta_pedido=None):
    """B — el video ES el pliego. Lo que hay que cazar es la omision."""
    # ROB-2: con `fuentes` ausente o vacio no corria UN SOLO check — el agujero clasico de
    # esta casa, el que se saltea cuando el campo falta. Ahora hay que declarar algo:
    # una lista vacia es una AFIRMACION ("no me mandaron nada") y se escribe a proposito;
    # que la clave no este es una omision, y las omisiones son lo que este gate caza.
    if "fuentes" not in p:
        r.rojo("G-P5", "el pliego no declara el campo 'fuentes'",
               "Si el que pide no mando nada, va 'fuentes': [] escrito a mano — eso es una\n"
               "  afirmacion y se puede contrastar. Que la clave falte no dice nada, y el video\n"
               "  de Carlos estuvo dos vueltas de diseno ahi sin que nadie lo nombrara.")
        return
    fuentes = _lista_estricta(p, "fuentes", r, "G-P5")
    if not fuentes and not carpeta_pedido:
        # Decir "no me mandaron nada" es una afirmacion, y las afirmaciones se prueban. La
        # unica prueba posible es abrir la carpeta del pedido. Con fuentes declaradas el
        # --carpeta-pedido queda como aviso; con CERO fuentes es obligatorio.
        r.rojo("G-P5", "el pliego declara CERO fuentes y nadie miro la carpeta del pedido",
               "Correr con --carpeta-pedido <carpeta del pedido>. Que no te hayan mandado nada\n"
               "  no se declara: se comprueba. El video de Carlos estuvo dos vueltas de diseno\n"
               "  en la carpeta sin que ningun pliego lo nombrara.")
    elif not carpeta_pedido:
        r.aviso("sin --carpeta-pedido: nadie comprobo si el que pide mando ADEMAS algo que el "
                "pliego no nombra. Es el unico check que caza la OMISION.")
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
        elif os.path.normcase(os.path.abspath(ev)) == os.path.normcase(os.path.abspath(ruta)):
            # ROB-4: alcanzaba con nombrar cualquier archivo que exista, incluso la propia fuente.
            r.rojo("G-P5", "la evidencia de %s es la fuente misma" % os.path.basename(ruta),
                   "La evidencia es lo que quedo de HABERLA MIRADO (los cuadros extraidos, una\n"
                   "  captura, el extracto), no otro puntero al mismo archivo.")

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


def verificar_retorno(c, p, r, indice_cli=None):
    """C — reusar antes de crear, verificado contra el indice."""
    ret = p.get("retorno_experiencia")
    if not isinstance(ret, dict):
        r.rojo("G-P6", "el pliego no declara retorno de experiencia",
               "Antes de inventar uno nuevo se mira lo que Barack ya tiene andando.\n"
               "  Que hay:  indice_dispositivos.py --buscar <lo que busco>")
        return

    # ROB-3: el indice lo elegia el PLIEGO (`ret["indice"]`). Un JSON propio con
    # `dispositivos: []` y fecha de hoy apagaba de un saque el "hay N fabricados y no abriste
    # ninguno" y el chequeo de raices caidas. El verificado no elige contra que se lo verifica:
    # el indice es SIEMPRE el canonico del skill.
    declarado = _texto(ret.get("indice"))
    canonico = os.path.abspath(indice_cli or idx.SALIDA_JSON)
    if declarado and os.path.normcase(os.path.abspath(declarado)) != os.path.normcase(canonico):
        r.aviso("el pliego declara otro indice (%s); se verifica igual contra %s"
                % (declarado, canonico))
    if indice_cli:
        # El indice lo elige QUIEN CORRE EL GATE, nunca el pliego que se esta verificando
        # (ese era el agujero ROB-3). Que se haya usado uno distinto del canonico queda
        # registrado en la evidencia, no se pierde.
        r.aviso("indice pasado por linea de comandos: %s" % canonico)
    datos = idx.cargar_indice(canonico)
    if datos is None:
        r.rojo("G-P6", "no hay indice de dispositivos para verificar el relevamiento",
               "Correr: indice_dispositivos.py")
        return
    if "raices" not in datos or "dispositivos" not in datos:
        r.rojo("G-P6", "el indice de dispositivos esta incompleto (le faltan 'raices' o 'dispositivos')",
               "Re-generarlo: indice_dispositivos.py")
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
    # ROB-3b: un candidato se validaba solo con os.path.exists — C:\Windows\win.ini pasaba.
    # Tiene que ser uno de los dispositivos del indice.
    por_id = {d.get("id"): d for d in datos.get("dispositivos", [])}
    por_ruta = {os.path.normcase(os.path.abspath(d.get("ruta", ""))): d
                for d in datos.get("dispositivos", []) if d.get("ruta")}
    for a in abiertos:
        ruta = _texto(a.get("ruta"))
        cid = _texto(a.get("id"))
        if not ruta or not os.path.exists(ruta):
            r.rojo("G-P6", "el candidato '%s' apunta a algo que no existe: %s"
                   % (cid or "?", ruta or "(vacio)"))
            continue
        if cid not in por_id and os.path.normcase(os.path.abspath(ruta)) not in por_ruta:
            r.rojo("G-P6", "el candidato '%s' no esta en el indice de dispositivos" % (cid or ruta),
                   "Que la ruta exista no la convierte en un dispositivo de Barack.\n"
                   "  Buscarlo con: indice_dispositivos.py --buscar <texto>")
            continue
        if len(_texto(a.get("que_vi"))) < c["umbrales"]["minCaracteresComo"]["valor"] \
                or _es_placeholder(c, a.get("que_vi")):
            r.rojo("G-P6", "del candidato '%s' no se escribio que se vio adentro" % os.path.basename(ruta),
                   "Abrirlo y no anotar como resuelve lo suyo es no haberlo abierto.")
        if not a.get("se_reusa") and not _texto(a.get("motivo")):
            r.rojo("G-P6", "el candidato '%s' se descarta sin motivo" % os.path.basename(ruta),
                   "Descartar lo que ya funciona es una decision, y las decisiones llevan motivo.")


def verificar(pliego_path, workdir_path=None, carpeta_pedido=None, indice_cli=None):
    c = canon()
    with open(pliego_path, "r", encoding="utf-8") as f:
        p = json.load(f)

    r = Resultado()
    verificar_fuerzas(c, p, r)
    verificar_fuentes(c, p, r, carpeta_pedido)
    verificar_retorno(c, p, r, indice_cli)

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
                # ROB-2: se registra si alguien comprobo la carpeta del pedido. Sin esto,
                # export_deliverables no puede exigir despues lo unico que caza la OMISION
                # de una fuente — y la evidencia decia "proceso declarado" igual.
                carpeta_pedido=os.path.abspath(carpeta_pedido) if carpeta_pedido else None,
                indice=os.path.abspath(indice_cli or idx.SALIDA_JSON),
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
    v.add_argument("--indice", help="indice de dispositivos a usar (default: el del skill). Lo elige QUIEN CORRE el gate, nunca el pliego; queda registrado en la evidencia")

    t = sub.add_parser("plantilla", help="emite un pliego en blanco con las fuerzas que aplican")
    t.add_argument("--tags", default="", help="etiquetas de proceso separadas por coma")
    t.add_argument("--out", help="escribe el pliego en este archivo (UTF-8). USAR ESTO, no '> archivo'")

    sub.add_parser("familias", help="lista las familias de fuerza y cuando aplican")

    args = ap.parse_args()

    if args.cmd == "verificar":
        return verificar(args.pliego, args.workdir, args.carpeta_pedido, args.indice)
    if args.cmd == "plantilla":
        tags = [t.strip() for t in args.tags.split(",") if t.strip()]
        txt = json.dumps(plantilla(tags), indent=2, ensure_ascii=False)
        # --out y no `> archivo`: el redirect del shell escribe con la codificacion de la
        # consola y `verificar` abre en UTF-8. En Git Bash el em-dash salia como 0x97 y en
        # PowerShell el redirect escribe UTF-16LE con BOM: los dos rompian con
        # UnicodeDecodeError en el PRIMER comando que corre el que acaba de chocar con el gate.
        if args.out:
            with open(args.out, "w", encoding="utf-8") as f:
                f.write(txt + "\n")
            print("pliego en blanco -> %s" % args.out)
            print("Contestalo y despues:  gate_proceso.py verificar %s --workdir W "
                  "--carpeta-pedido <carpeta del pedido>" % args.out)
        else:
            print(txt)
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
