#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""El estado de las puertas del PLAN de "Claude por area", calculado desde los archivos (no desde la memoria).

    python tools/claude-area/puerta.py            semaforo completo (corre tambien las pruebas del plugin: ~1 min)
    python tools/claude-area/puerta.py --rapido   sin correr las pruebas del plugin

Mira: (A) el plugin: pruebas, que este commiteado y que el respaldo de la nube no sea mas viejo que el ultimo commit;
(B) la carpeta de demostracion: que la haya dejado el instalador y como una PC de un area; (C) las promesas del
video; (D) las frases de los papeles que contradicen lo que el asistente hace, y los numeros del examen que citan
(tienen que ser los del ultimo examen completo, no los de uno anterior).
Sale con 0 si todo esta en verde y con 1 si hay algun rojo. No modifica nada.

    python tools/claude-area/puerta.py --autotest   prueba el control de los numeros del examen (rojo y verde)
"""
import io
import json
import os
import re
import subprocess
import sys
from pathlib import Path

AQUI = Path(__file__).resolve().parent
REPO = AQUI.parents[1]
PLUGIN_REPO = Path(r"C:\Dev\barack-claude")
DEMO = Path(os.environ.get("CLAUDE_AREA_HOME", r"C:\ClaudeBarack"))
EXPORTS = REPO / "exports" / "CLAUDES_POR_AREA_20261001" / "fuentes"
RESPALDO = Path.home() / "BARACK ARGENTINA SRL" / "Ingeniería y Proyecto - General" / "Claude Fak" / "repo-privado"

# Frases que dicen "Claude nunca envia un mail". Dejan de ser verdad cuando la promesa mail-enviar esta probada.
FRASES_NO_ENVIA = [
    r"No lo manda", r"[Nn]o manda un mail", r"[Uu]n mail lo env[ií]a la persona", r"ni manda mails",
    r"[Ss]ale reci[eé]n cuando vos apret", r"el bot[oó]n lo aprieta la persona", r"No env[ií]a sin vos",
    r"Enviar lo decide la persona",   # "Nunca solo" se saco el 02/10: sigue siendo verdad (sale a pedido, nunca solo)
]

# La narracion de cada video. Se barre solo si su video esta en la carpeta de entregables: lo que se movio a
# "versiones anteriores" ya no se muestra.
VIDEOS = {
    "voz": "Video tutorial - Claude en Barack.mp4",
    "voz_v2": "Video tutorial - Claude en Barack (version 2).mp4",
    "voz_ilusiona": "Video por sector - Claude en Barack.mp4",
}
EXAMENES = REPO / ".sgc-cache" / "claude-por-area" / "examen"


def examen_vigente(carpeta=EXAMENES):
    """((bien, a_medias, mal), archivo) del ultimo examen completo: el renglon Total de correccion_v<N>.md."""
    archivos = sorted(carpeta.glob("correccion_v*.md"), key=lambda p: int(re.search(r"_v(\d+)", p.name).group(1)))
    if not archivos:
        return None, None
    m = re.search(r"\*\*Total\*\*.*\*\*(\d+)/(\d+)/(\d+)\*\*", archivos[-1].read_text(encoding="utf-8"))
    return (tuple(int(x) for x in m.groups()) if m else None), archivos[-1].name


def cifras_viejas(linea, vigente):
    """Los numeros de examen de un renglon que no son los del examen vigente. Mira «N bien, M a medias[, K mal]» y
    cualquier «N bien» de tres cifras (un total sobre las 139)."""
    texto = re.sub(r"<[^>]+>", "", linea)
    malos = []
    for m in re.finditer(r"(\d+)\s+bien\W+(?:y\s+)?(\d+)\s+a medias(?:\W+(?:y\s+)?(\d+|ninguna)\s+mal)?", texto):
        mal = m.group(3)
        if (int(m.group(1)), int(m.group(2))) != vigente[:2] or (mal is not None and (0 if mal == "ninguna" else int(mal)) != vigente[2]):
            malos.append(m.group(0))
    for m in re.finditer(r"\b(1\d\d)\s+bien\b", texto):
        if int(m.group(1)) != vigente[0] and not any(m.group(0) in x for x in malos):
            malos.append(m.group(0))
    return malos


def correr(cmd, cwd):
    try:
        r = subprocess.run(cmd, cwd=str(cwd), capture_output=True, text=True, encoding="utf-8", errors="replace", timeout=900)
        return r.returncode, (r.stdout or "") + (r.stderr or "")
    except (OSError, subprocess.TimeoutExpired) as e:
        return 99, str(e)


def puerta_a(rapido):
    filas = []
    if rapido:
        filas.append(("am", "pruebas del plugin", "no se corrieron (--rapido)"))
    else:
        cod, out = correr(["node", "tests/todo.test.mjs"], PLUGIN_REPO / "plugins" / "barack-area")
        ultima = [l for l in out.strip().splitlines() if l.strip()][-1:] or ["sin salida"]
        filas.append(("ok" if cod == 0 else "ro", "pruebas del plugin", ultima[0].strip()))
    cod, out = correr(["git", "status", "--short"], PLUGIN_REPO)
    sucios = [l for l in out.splitlines() if l.strip()]
    filas.append(("ok" if not sucios else "ro", "plugin commiteado", "limpio" if not sucios else "%d archivo(s) sin commitear" % len(sucios)))
    cod, out = correr(["git", "log", "-1", "--format=%ct"], PLUGIN_REPO)
    try:
        ultimo = int(out.strip())
        respaldos = sorted(RESPALDO.glob("barack-claude-*.bundle"), key=lambda p: p.stat().st_mtime)
        if not respaldos:
            filas.append(("ro", "respaldo en la nube", "no hay ninguno en %s" % RESPALDO))
        else:
            al_dia = respaldos[-1].stat().st_mtime >= ultimo
            filas.append(("ok" if al_dia else "ro", "respaldo en la nube", respaldos[-1].name + ("" if al_dia else " es mas viejo que el ultimo commit")))
    except ValueError:
        filas.append(("ro", "respaldo en la nube", "no pude leer la fecha del ultimo commit"))
    return filas


def leer_json(ruta):
    try:
        return json.loads(Path(ruta).read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return None


def puerta_b():
    filas = []
    inst, perfil = leer_json(DEMO / "instalado.json"), leer_json(DEMO / "perfil.json")
    if not inst or not perfil:
        return [("ro", "carpeta de demostracion", "no esta instalada en %s" % DEMO)]
    igual = inst.get("area") == perfil.get("area")
    filas.append(("ok" if igual and inst.get("area") not in (None, "", "comun") else "ro", "la dejo el instalador, como una PC de un area",
                  "instalado: %s · perfil: %s" % (inst.get("area"), perfil.get("area"))))
    temporal = "Temp" in str(inst.get("claude_dir", ""))
    filas.append(("am" if temporal else "ok", "configuracion del usuario",
                  "de prueba (el plugin se carga por la configuracion de la carpeta)" if temporal else str(inst.get("claude_dir"))))
    areas = sorted(p.name for p in (DEMO / "publicado" / "conocimiento").glob("*") if p.is_dir())
    esperado = sorted({"comun", perfil.get("area", "")})
    filas.append(("ok" if areas == esperado else "ro", "conocimiento instalado", "tiene %s; una PC de %s lleva %s"
                  % (", ".join(areas) or "nada", perfil.get("area"), ", ".join(esperado))))
    return filas


def puerta_c():
    cod, out = correr([sys.executable, "chequear_promesas.py"], AQUI / "video")
    faltan = [l.strip()[2:] for l in out.splitlines() if l.strip().startswith("- ")]
    if cod == 0:
        return [("ok", "promesas del video", "todas probadas sobre las reglas instaladas")], True
    probado_enviar = not any(f.startswith("mail-enviar") for f in faltan)
    return [("ro", "promesas del video", "%d por cerrar: %s" % (len(faltan), "; ".join(f.split(":")[0] for f in faltan)))], probado_enviar


def puerta_d(envia_probado):
    hallazgos = []
    archivos = list(EXPORTS.glob("*.html")) + list((EXPORTS / "reunion").glob("*.html")) + [AQUI / "manual" / "contenido.json"]
    archivos += [EXPORTS / carpeta / "narracion.txt" for carpeta, video in VIDEOS.items() if (EXPORTS.parent / video).exists()]
    vigente, de_donde = examen_vigente()
    viejas = []
    for a in archivos:
        try:
            lineas = a.read_text(encoding="utf-8").splitlines()
        except OSError:
            continue
        for n, l in enumerate(lineas, 1):
            if l.lstrip().startswith(('"error_que_evita"', '"que_se_ve"', "<!--")):
                continue
            for f in FRASES_NO_ENVIA:
                if re.search(f, l):
                    hallazgos.append("%s/%s:%d  %s" % (a.parent.name, a.name, n, re.search(f, l).group(0)))
                    break
            if vigente:
                viejas += ["%s:%d  %s" % (a.name, n, c) for c in cifras_viejas(l, vigente)]
    if not vigente:
        examen = ("ro", "numeros del examen en los papeles", "no encuentro el renglon Total del ultimo examen (%s)" % (de_donde or EXAMENES))
    elif viejas:
        examen = ("ro", "numeros del examen en los papeles", "%d cifra(s) que no son las del ultimo examen (%d/%d/%d, %s)" % ((len(viejas),) + vigente + (de_donde,)))
    else:
        examen = ("ok", "numeros del examen en los papeles", "todos citan el ultimo examen (%d/%d/%d, %s)" % (vigente + (de_donde,)))
    if not hallazgos:
        return [("ok", "papeles contra lo que hace", "ninguna frase dice que nunca envia"), examen], viejas
    if envia_probado:
        return [("ro", "papeles contra lo que hace", "%d frase(s) dicen que nunca envia y ya envia a pedido" % len(hallazgos)), examen], hallazgos + viejas
    return [("am", "papeles contra lo que hace", "%d frase(s) dicen que nunca envia: hoy es verdad; se cambian juntas cuando el envio este probado" % len(hallazgos)), examen], hallazgos + viejas


def autotest():
    """El control de los numeros del examen, en las dos direcciones."""
    v = (105, 31, 3)
    casos = [
        ("Corregido: <b>131 bien, 8 a medias</b>, ninguna mal.", True),
        ("139 preguntas, 126 bien, 12 a medias, 1 mal.", True),
        ("A la primera, 126 bien.", True),
        ("105 bien, 31 a medias, 0 mal", True),
        ("Dos revisores: <b>105 bien, 31 a medias</b> (correctas, pero les faltó una cita) <b>y 3 mal</b>.", False),
        ("139 preguntas, 105 bien, 31 a medias y 3 mal.", False),
        ("Ensayo de 15 preguntas: 15 de 15. Las 57 de riesgo: 0 mal.", False),
        ("salió mal 1 de 74 que antes había salido a medias", False),
    ]
    fallas = [(t, esperado) for t, esperado in casos if bool(cifras_viejas(t, v)) != esperado]
    for t, esperado in fallas:
        print("FALLA: esperaba %s en: %s" % ("rojo" if esperado else "verde", t))
    print("autotest: %d casos, %d fallas" % (len(casos), len(fallas)))
    return 1 if fallas else 0


def main(argv):
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
    if "--autotest" in argv:
        return autotest()
    rapido = "--rapido" in argv
    marca ={"ok": "VERDE   ", "am": "AMARILLO", "ro": "ROJO    "}
    c, envia = puerta_c()
    d, detalle = puerta_d(envia)
    grupos = (("A · que lo haga de verdad", puerta_a(rapido)), ("B · la demostracion es una PC de area", puerta_b()),
              ("C · el video", c), ("D · papeles al dia", d))
    rojos = 0
    for titulo, filas in grupos:
        print(titulo)
        for color, que, como in filas:
            rojos += color == "ro"
            print("  [%s] %s: %s" % (marca[color], que, como))
    if "--detalle" in argv:
        for h in detalle:
            print("     " + h)
    print("\nPLAN: %s" % ("todas las puertas en verde" if not rojos else "%d puerta(s) en rojo" % rojos))
    return 1 if rojos else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
