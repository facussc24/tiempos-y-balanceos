# -*- coding: utf-8 -*-
"""Par ROJO/VERDE del GATE DE PROCESO y del GATE DE ENTREGABLE.

Correr:  .venv-cad\\Scripts\\python.exe test_gates_proceso.py [--out <carpeta>]

Por que en las dos direcciones y no solo en verde. Un gate que solo se probo en verde no
esta probado: no se sabe si frena. Y uno que solo se probo en rojo tampoco, porque un gate
que rechaza todo molesta hasta que alguien lo desactiva — que es como se pierden los
candados de esta casa (feedback_un_control_se_audita_en_las_dos_direcciones).

Los ROJOS de aca no son casos inventados: son los tres fallos reales de las entregas del
dispositivo de adhesivado, 29-31/08/2026.

  * la fuerza del aire de la pistola nunca contestada    -> casos 2 y 3
  * el video de Carlos que estaba ahi y no se miro       -> casos 8 y 9
  * el .txt y el .html entregados en vez de un PDF       -> caso 14
  * los renders de matplotlib, "todo del mismo gris"     -> casos 16 y 17

Y el caso 18 es el gemelo de 17: la MISMA imagen con color no levanta el aviso. Si el
gemelo tampoco lo levantara, la medicion no estaria midiendo el color.

LOS CASOS 26-40 SON DE OTRO ORIGEN, y es el mas util de todos. Estos 25 daban 25/25 y me
parecian enforcement. Un auditor independiente tiro **12 evasiones y pasaron 11** — la
peor, la plantilla oficial de este mismo gate sin contestar una sola pregunta. Cada caso de
esa tanda es una de esas evasiones. **Un gate lo prueba el que lo ataca, y no es el que lo
escribio:** los tests del autor prueban lo que el autor imagino.

No borra nada: cada corrida usa una carpeta nueva con marca de tiempo.
"""
import argparse
import copy
import datetime as dt
import json
import os
import subprocess
import sys
import tempfile
import time

SCR = os.path.dirname(os.path.abspath(__file__))
PY = sys.executable

_ap = argparse.ArgumentParser(description=__doc__,
                              formatter_class=argparse.RawDescriptionHelpFormatter)
_ap.add_argument("--out", default=None)
_ARGS = _ap.parse_args()
W = os.path.join(_ARGS.out or tempfile.gettempdir(),
                 "test_proceso_%s" % time.strftime("%Y%m%d_%H%M%S"))

fallos = []
INDICE = [None]      # lo llena preparar()


def run(script, *args):
    p = subprocess.run([PY, os.path.join(SCR, script)] + [str(a) for a in args],
                       capture_output=True, text=True, encoding="utf-8", errors="replace",
                       env={**os.environ, "PYTHONIOENCODING": "utf-8"})
    return p.returncode, (p.stdout or "") + (p.stderr or "")


def run_gp(pliego, *args):
    """gate_proceso verificar, siempre contra el indice DEL TEST.

    El indice lo elige quien CORRE el gate y no el pliego que se verifica (agujero ROB-3
    de la auditoria del 02/09). El test pasa el suyo por --indice para no depender de que
    la biblioteca de Ingenieria este sincronizada en esta maquina.
    """
    return run("gate_proceso.py", "verificar", pliego, "--indice", INDICE[0], *args)


def check(nombre, cond, salida=""):
    print("   %-4s %s" % ("OK" if cond else "FALLA", nombre))
    if not cond:
        fallos.append(nombre)
        for l in salida.strip().splitlines()[-14:]:
            print("        | %s" % l)


# =====================================================================================
# material del test
# =====================================================================================
def preparar():
    for d in ("in", "pedido", "evidencia", "entrega", "renders"):
        os.makedirs(os.path.join(W, d), exist_ok=True)

    # el "video del pedido": lo que importa del caso es que EXISTA y que el pliego lo
    # nombre o no, no que sea un mp4 reproducible.
    video = os.path.join(W, "pedido", "videoplayback.mp4")
    with open(video, "wb") as f:
        f.write(b"\x00" * 64)
    with open(os.path.join(W, "evidencia", "frame_001.png"), "wb") as f:
        f.write(b"\x00" * 8)

    # indice de dispositivos propio del test: asi el ROJO/VERDE no depende de que la
    # biblioteca de Ingenieria este sincronizada en esta maquina.
    disp_dir = os.path.join(W, "in", "DISPOSITIVO VIEJO QUE ANDA")
    os.makedirs(disp_dir, exist_ok=True)
    with open(os.path.join(disp_dir, "pieza.step"), "w", encoding="utf-8") as f:
        f.write("ISO-10303-21;\n")
    indice = os.path.join(W, "in", "dispositivos.json")
    with open(indice, "w", encoding="utf-8") as f:
        json.dump({"generado": dt.datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                   "raices": [{"id": "test", "ruta": os.path.join(W, "in"), "que": "test",
                               "obligatoria": True, "estado": "ok", "dispositivos": 1}],
                   "dispositivos": [{"id": "test/viejo", "nombre": "DISPOSITIVO VIEJO QUE ANDA",
                                     "raiz": "test", "ruta": disp_dir, "contexto": [],
                                     "archivos": {"modelo3d": ["pieza.step"]},
                                     "fecha": "2026-01-01", "resuelve": None, "notas": None}]},
                  f, indent=2, ensure_ascii=False)
    INDICE[0] = indice
    return video, indice, disp_dir


def pliego_bueno(video, indice, disp_dir):
    """Un pliego que contesta todo. De aca salen los rojos, mutandolo de a una cosa."""
    return {
        "dispositivo": "Carro de adhesivado (caso de test)",
        "pieza": "SAB1740",
        "tags": ["adhesivo-a-pistola", "pieza-flexible", "hay-espera"],
        "secuencia": [
            {"etapa": "carga", "que": "el operario apoya el sustrato en el nido"},
            {"etapa": "rociado", "que": "se rocia el adhesivo a pistola"},
            {"etapa": "secado", "que": "la pieza queda en el carro hasta que evapora"},
            {"etapa": "descarga", "que": "el operario retira la pieza"},
        ],
        "piezas": [
            {"id": "nido", "nombre": "Placa CNC del nido"},
            {"id": "panel-aspirado", "nombre": "Panel perforado de aspiracion"},
            {"id": "embudo", "nombre": "Guia conica de entrada"},
            {"id": "bandeja", "nombre": "Bandeja de secado"},
        ],
        "fuerzas": [
            {"familia": "peso-propio", "etapa": "carga",
             "magnitud": {"valor": 0.42, "unidad": "kg", "fuente": "pesado en balanza de laboratorio"},
             "resuelve": {"pieza": "nido", "como": "el nido copia el contorno y la apoya en toda la cara, "
                                                   "asi no flecta entre apoyos"}},
            {"familia": "como-entra", "etapa": "carga",
             "magnitud": {"tbd": True, "motivo": "falta medir el desalineado tipico del operario; lo mide Fak en planta"},
             "resuelve": {"pieza": "embudo", "como": "la guia conica la centra sola aunque entre torcida "
                                                     "hasta 6 mm fuera de eje"}},
            {"familia": "como-queda-fija", "etapa": "rociado",
             "magnitud": {"valor": 12.0, "unidad": "N", "fuente": "empuje del chorro medido con dinamometro"},
             "resuelve": {"pieza": "panel-aspirado", "como": "el panel aspira por detras y la mantiene "
                                                             "contra el nido mientras dura el rociado"}},
            {"familia": "como-se-saca", "etapa": "descarga",
             "magnitud": {"tbd": True, "motivo": "depende del adhesivo final, que todavia no eligio Ingenieria"},
             "resuelve": {"pieza": "nido", "como": "el nido deja libres los dos bordes secos para "
                                                   "agarrarla sin tocar la zona engomada"}},
            {"familia": "gesto-operario", "etapa": "carga",
             "magnitud": {"valor": 900.0, "unidad": "mm", "fuente": "altura de trabajo del puesto actual"},
             "resuelve": {"pieza": "bandeja", "como": "la bandeja mas baja queda a 900 mm, asi el operario "
                                                      "no se agacha en ningun momento"}},
            {"familia": "aire-de-la-pistola", "etapa": "rociado",
             "magnitud": {"valor": 2.5, "unidad": "bar", "fuente": "ficha tecnica de la pistola del puesto"},
             "resuelve": {"pieza": "panel-aspirado", "como": "el aire la empuja contra el panel en vez de "
                                                             "volarla, porque la succion va del mismo lado"}},
            {"familia": "agarre-mojado", "etapa": "descarga",
             "magnitud": {"tbd": True, "motivo": "el tack inicial lo da la ficha del adhesivo, todavia sin elegir"},
             "resuelve": {"pieza": "nido", "como": "los bordes libres del nido son la zona seca por donde "
                                                   "se la agarra mojada"}},
            {"familia": "secado", "etapa": "secado",
             "magnitud": {"valor": 8.0, "unidad": "min", "fuente": "tiempo de oreo del proceso actual"},
             "resuelve": {"pieza": "bandeja", "como": "la bandeja la sostiene por los bordes secos y nada "
                                                      "queda apoyado sobre la zona engomada"}},
        ],
        "fuentes": [{"tipo": "video", "ruta": video, "visto": True,
                     "evidencia": os.path.join(W, "evidencia")}],
        "retorno_experiencia": {
            "indice": indice,
            "candidatos_abiertos": [
                {"id": "test/viejo", "ruta": disp_dir,
                 "que_vi": "sujeta la pieza por el contorno con un marco abisagrado y la libera de un gesto",
                 "se_reusa": True, "motivo": ""}]},
    }


def escribir(p, nombre):
    path = os.path.join(W, nombre)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(p, f, indent=2, ensure_ascii=False)
    return path


def png(path, color):
    """Imagen chica: objeto de un color sobre fondo blanco."""
    import numpy as np
    from PIL import Image
    a = np.ones((300, 300, 3), dtype=np.uint8) * 255
    a[60:240, 60:240] = color
    Image.fromarray(a).save(path)
    return path


# =====================================================================================
def main():
    os.makedirs(W, exist_ok=True)
    video, indice, disp_dir = preparar()
    bueno = pliego_bueno(video, indice, disp_dir)

    print("GATE DE PROCESO\n")

    print(" 1) VERDE — el pliego contesta todas las fuerzas del proceso")
    rc, out = run_gp(escribir(bueno, "pliego_ok.json"), "--workdir", W)
    check("un pliego completo pasa y registra evidencia",
          rc == 0 and "VERDE" in out and "proceso_declarado" in out, out)

    print("\n 2) ROJO — el fallo del 31/08: no se contesta la fuerza del aire de la pistola")
    p = copy.deepcopy(bueno)
    p["fuerzas"] = [f for f in p["fuerzas"] if f["familia"] != "aire-de-la-pistola"]
    rc, out = run_gp(escribir(p, "pliego_sin_aire.json"))
    check("falta una familia obligatoria -> rojo", rc == 1 and "aire-de-la-pistola" in out, out)

    print("\n 3) ROJO — la etapa que nadie penso: 'rociado' sin ninguna fuerza")
    p = copy.deepcopy(bueno)
    p["fuerzas"] = [f for f in p["fuerzas"] if f["etapa"] != "rociado"]
    rc, out = run_gp(escribir(p, "pliego_etapa_muda.json"))
    check("una etapa sin fuerzas -> rojo (G-P4)", rc == 1 and "G-P4" in out and "rociado" in out, out)

    print("\n 4) ROJO — la respuesta apunta a una pieza que no existe en el dispositivo")
    p = copy.deepcopy(bueno)
    p["fuerzas"][5]["resuelve"]["pieza"] = "algun-sistema-de-sujecion"
    rc, out = run_gp(escribir(p, "pliego_pieza_fantasma.json"))
    check("resolver con una pieza inexistente -> rojo", rc == 1 and "G-P3" in out, out)

    print("\n 5) ROJO — 'se sujeta' como respuesta")
    p = copy.deepcopy(bueno)
    p["fuerzas"][5]["resuelve"]["como"] = "se sujeta"
    rc, out = run_gp(escribir(p, "pliego_corto.json"))
    check("una respuesta de dos palabras -> rojo", rc == 1 and "demasiado corta" in out, out)

    print("\n 6) ROJO — un numero sin unidad")
    p = copy.deepcopy(bueno)
    p["fuerzas"][5]["magnitud"] = {"valor": 2.5, "unidad": "", "fuente": "ficha"}
    rc, out = run_gp(escribir(p, "pliego_sin_unidad.json"))
    check("magnitud sin unidad -> rojo", rc == 1 and "no tiene unidad" in out, out)

    print("\n 7) ROJO — un numero sin fuente (dato inventado)")
    p = copy.deepcopy(bueno)
    p["fuerzas"][5]["magnitud"] = {"valor": 2.5, "unidad": "bar", "fuente": ""}
    rc, out = run_gp(escribir(p, "pliego_sin_fuente.json"))
    check("magnitud sin fuente -> rojo", rc == 1 and "de donde sale" in out, out)

    print("\n 8) ROJO — la fuente esta declarada pero NO se miro")
    p = copy.deepcopy(bueno)
    p["fuentes"][0]["visto"] = False
    rc, out = run_gp(escribir(p, "pliego_no_visto.json"))
    check("fuente declarada sin mirar -> rojo", rc == 1 and "NO vista" in out, out)

    print("\n 9) ROJO — el video de Carlos: esta en la carpeta del pedido y el pliego no lo nombra")
    p = copy.deepcopy(bueno)
    p["fuentes"] = []
    rc, out = run_gp(escribir(p, "pliego_sin_fuentes.json"),
                  "--carpeta-pedido", os.path.join(W, "pedido"))
    check("video no declarado en la carpeta del pedido -> rojo",
          rc == 1 and "no declara" in out and "videoplayback" in out, out)

    print("\n10) VERDE del 9 — con el video declarado y visto, la misma carpeta pasa")
    rc, out = run_gp(escribir(bueno, "pliego_ok2.json"),
                  "--carpeta-pedido", os.path.join(W, "pedido"))
    check("declarado y visto -> verde (el control no rechaza todo)", rc == 0 and "VERDE" in out, out)

    print("\n11) ROJO — hay dispositivos en el indice y no se abrio ninguno")
    p = copy.deepcopy(bueno)
    p["retorno_experiencia"]["candidatos_abiertos"] = []
    rc, out = run_gp(escribir(p, "pliego_sin_retorno.json"))
    check("retorno de experiencia vacio -> rojo", rc == 1 and "no abrio ninguno" in out, out)

    print("\n12) ROJO — se descarta lo que ya funciona sin decir por que")
    p = copy.deepcopy(bueno)
    p["retorno_experiencia"]["candidatos_abiertos"][0].update({"se_reusa": False, "motivo": ""})
    rc, out = run_gp(escribir(p, "pliego_descarte_mudo.json"))
    check("descarte sin motivo -> rojo", rc == 1 and "sin motivo" in out, out)

    print("\n13) ROJO — etiqueta de proceso inventada")
    p = copy.deepcopy(bueno)
    p["tags"] = p["tags"] + ["la-pieza-flota"]
    rc, out = run_gp(escribir(p, "pliego_tag_inventada.json"))
    check("etiqueta fuera del canon -> rojo", rc == 1 and "no estan en el canon" in out, out)

    # =================================================================================
    print("\n\nGATE DE ENTREGABLE\n")

    ent = os.path.join(W, "entrega")
    with open(os.path.join(ent, "carro.step"), "w", encoding="utf-8") as f:
        f.write("ISO-10303-21;\n")
    with open(os.path.join(ent, "documento tecnico.html"), "w", encoding="utf-8") as f:
        f.write("<html>lo que se entrego el 31/08</html>")
    with open(os.path.join(ent, "lista de corte.txt"), "w", encoding="utf-8") as f:
        f.write("tubo 40x40\n")
    r_color = png(os.path.join(W, "renders", "render_color.png"), (60, 110, 190))
    r_gris = png(os.path.join(W, "renders", "render_gris.png"), (128, 128, 128))

    print("14) ROJO — el fallo del 31/08: .html y .txt en vez de PDF")
    rc, out = run("gate_entregable.py", "--entrega", ent, "--motor", "foto3d", "--render", r_color)
    check("sin PDF y con .html/.txt -> rojo", rc == 1 and "no hay PDF" in out, out)

    print("\n15) ROJO — con PDF pero sin la simulacion grabada")
    with open(os.path.join(ent, "carro.pdf"), "wb") as f:
        f.write(b"%PDF-1.4\n")
    rc, out = run("gate_entregable.py", "--entrega", ent, "--motor", "foto3d", "--render", r_color)
    check("falta la simulacion grabada -> rojo", rc == 1 and "simulacion-grabada" in out, out)

    print("\n16) ROJO — renders de matplotlib")
    with open(os.path.join(ent, "proceso.mp4"), "wb") as f:
        f.write(b"\x00" * 32)
    rc, out = run("gate_entregable.py", "--entrega", ent, "--motor", "matplotlib", "--render", r_color)
    check("motor rechazado -> rojo", rc == 1 and "rechazado" in out, out)

    # Los renders van DENTRO de la entrega: se juzga lo que Fak recibe (ROB-9).
    import shutil as _sh17
    _sh17.copy(r_gris, os.path.join(ent, "gris.png"))
    _sh17.copy(r_color, os.path.join(ent, "color.png"))

    print("\n17) AVISO — 'todo del mismo gris' se MIDE y se informa, no bloquea")
    # Nacio bloqueante con umbral 0,35 y el auditor lo tumbo por los dos lados el mismo dia:
    # un matplotlib real da 0,353 (pasaba) y un render legitimo de un dispositivo de UN SOLO
    # material da 0,000 (lo frenaba). Dejaba pasar lo malo Y frenaba lo bueno.
    rc, out = run("gate_entregable.py", "--entrega", ent, "--motor", "foto3d",
                  "--render", os.path.join(ent, "gris.png"))
    check("gris -> verde con el numero a la vista", rc == 0 and "G-E3b" in out, out)

    print("\n18) GEMELO del 17 — la MISMA imagen con color no levanta el aviso")
    rc, out = run("gate_entregable.py", "--entrega", ent, "--motor", "foto3d",
                  "--render", os.path.join(ent, "color.png"), "--workdir", W)
    check("con color no hay aviso de color (la medicion distingue, aunque no bloquee)",
          rc == 0 and "VERDE" in out and "G-E3b" not in out, out)

    print("\n19) ROJO — el STEP se toco despues de armar el PDF")
    time.sleep(1.1)
    os.utime(os.path.join(ent, "carro.step"), None)
    rc, out = run("gate_entregable.py", "--entrega", ent, "--motor", "foto3d", "--render", r_color)
    check("STEP mas nuevo que el PDF -> rojo (G-E2)", rc == 1 and "G-E2" in out, out)

    # =================================================================================
    print("\n\nENGANCHE CON export_deliverables.py\n")

    w2 = os.path.join(W, "wk_sin_proceso")
    print("20) ROJO — no se puede entregar sin el gate de proceso")
    rc, out = run("export_deliverables.py", "--workdir", w2, "--pieces",
                  os.path.join(W, "out_inexistente.step"), "--deliver", os.path.join(W, "e2"),
                  "--skip-gate", "zona", "--reason", "test")
    check("sin proceso_declarado -> rojo", rc != 0 and "GATE proceso" in out, out)

    print("\n21) ROJO — con el proceso declarado pero una fuerza SIN RESOLVER")
    p = copy.deepcopy(bueno)
    p["fuerzas"][5]["resuelve"] = {"no_resuelto": True,
                                   "motivo": "todavia no se decidio si va aspiracion o marco"}
    run_gp(escribir(p, "pliego_no_resuelto.json"), "--workdir", w2)
    rc, out = run("export_deliverables.py", "--workdir", w2, "--pieces",
                  os.path.join(W, "out_inexistente.step"), "--deliver", os.path.join(W, "e2"),
                  "--skip-gate", "zona", "--reason", "test")
    check("una fuerza no resuelta frena la ENTREGA (no el diseno) -> rojo",
          rc != 0 and "SIN RESOLVER" in out, out)

    print("\n22) VERDE del gate de proceso dentro de export — con todo resuelto ya no se queja")
    w3 = os.path.join(W, "wk_con_proceso")
    run_gp(os.path.join(W, "pliego_ok.json"), "--workdir", w3)
    rc, out = run("export_deliverables.py", "--workdir", w3, "--pieces",
                  os.path.join(W, "out_inexistente.step"), "--deliver", os.path.join(W, "e3"),
                  "--skip-gate", "zona", "--reason", "test")
    # No alcanza con que NO diga "GATE proceso": eso tambien seria cierto si el script
    # se cayera antes de llegar. Se exige ademas que haya llegado al control SIGUIENTE.
    check("con el proceso resuelto el gate de proceso ya no dispara",
          "GATE proceso" not in out and "No existe la pieza" in out, out)

    # =================================================================================
    print("\n\nINDICE DE DISPOSITIVOS\n")

    print("23) VERDE — el indice del test pasa el --check")
    rc, out = run("indice_dispositivos.py", "--check", "--json", indice)
    check("indice fresco y completo -> ok", rc == 0, out)

    print("\n24) ROJO — una raiz obligatoria caida no puede dar un indice 'valido'")
    with open(indice, "r", encoding="utf-8") as f:
        d = json.load(f)
    d2 = copy.deepcopy(d)
    d2["raices"][0]["estado"] = "no-alcanzable"
    caido = os.path.join(W, "in", "dispositivos_caido.json")
    with open(caido, "w", encoding="utf-8") as f:
        json.dump(d2, f)
    rc, out = run("indice_dispositivos.py", "--check", "--json", caido)
    check("raiz obligatoria caida -> rojo", rc == 1 and "CAIDA" in out, out)

    print("\n25) ROJO — un indice viejo no respalda un 'no hay nada parecido'")
    d3 = copy.deepcopy(d)
    d3["generado"] = (dt.datetime.now() - dt.timedelta(days=120)).strftime("%Y-%m-%d %H:%M:%S")
    viejo = os.path.join(W, "in", "dispositivos_viejo.json")
    with open(viejo, "w", encoding="utf-8") as f:
        json.dump(d3, f)
    rc, out = run("indice_dispositivos.py", "--check", "--json", viejo)
    check("indice de 120 dias -> rojo", rc == 1 and "re-escanear" in out.lower(), out)


    # =================================================================================
    print("\n\nEVASIONES QUE ENCONTRO EL AUDITOR (02/09/2026)\n")
    print("   De 12 intentos pasaban 11. Cada uno de estos es uno de esos.\n")

    print("26) ROJO - la PLANTILLA OFICIAL, con todo en TBD, no puede dar verde")
    rc, out = run("gate_proceso.py", "plantilla", "--tags", "adhesivo-a-pistola,pieza-flexible",
                  "--out", os.path.join(W, "plantilla_cruda.json"))
    p = json.load(open(os.path.join(W, "plantilla_cruda.json"), encoding="utf-8"))
    p["fuentes"] = []
    p["retorno_experiencia"]["candidatos_abiertos"] = []
    rc, out = run_gp(escribir(p, "pliego_plantilla.json"), "--carpeta-pedido", os.path.join(W, "pedido"))
    check("el formulario en blanco del propio gate -> rojo", rc == 1 and "plantilla" in out, out)

    print("\n27) ROJO - piezas con id vacio (desarmaba el cruce entero)")
    p = copy.deepcopy(bueno)
    p["piezas"] = [{"id": "", "nombre": "algo"}]
    for f in p["fuerzas"]:
        if "pieza" in f["resuelve"]:
            f["resuelve"]["pieza"] = ""
    rc, out = run_gp(escribir(p, "pliego_id_vacio.json"))
    check("id vacio -> rojo", rc == 1 and "sin id" in out, out)

    print("\n28) ROJO - el pliego sin la clave 'fuentes' (el check que se salteaba)")
    p = copy.deepcopy(bueno)
    del p["fuentes"]
    rc, out = run_gp(escribir(p, "pliego_sin_clave_fuentes.json"))
    check("clave 'fuentes' ausente -> rojo", rc == 1 and "no declara el campo" in out, out)

    print("\n29) ROJO - 'no me mandaron nada' sin haber mirado la carpeta del pedido")
    p = copy.deepcopy(bueno)
    p["fuentes"] = []
    rc, out = run_gp(escribir(p, "pliego_cero_fuentes.json"))
    check("cero fuentes sin --carpeta-pedido -> rojo", rc == 1 and "CERO fuentes" in out, out)

    print("\n30) ROJO - la 'evidencia' de haber visto el video es el video mismo")
    p = copy.deepcopy(bueno)
    p["fuentes"][0]["evidencia"] = p["fuentes"][0]["ruta"]
    rc, out = run_gp(escribir(p, "pliego_evidencia_circular.json"))
    check("evidencia == fuente -> rojo", rc == 1 and "es la fuente misma" in out, out)

    print("\n31) ROJO - un candidato que existe en el disco pero no es un dispositivo")
    p = copy.deepcopy(bueno)
    p["retorno_experiencia"]["candidatos_abiertos"][0].update(
        {"id": "cualquiera", "ruta": os.path.join(os.environ.get("WINDIR", "C:\\Windows"), "win.ini")})
    rc, out = run_gp(escribir(p, "pliego_candidato_falso.json"))
    check("candidato fuera del indice -> rojo", rc == 1 and "no esta en el indice" in out, out)

    print("\n32) ROJO - el pliego elige su propio indice vacio para apagar el check")
    vacio = os.path.join(W, "in", "indice_vacio.json")
    with open(vacio, "w", encoding="utf-8") as f:
        json.dump({"generado": dt.datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                   "raices": [], "dispositivos": []}, f)
    p = copy.deepcopy(bueno)
    p["retorno_experiencia"]["indice"] = vacio
    p["retorno_experiencia"]["candidatos_abiertos"] = []
    rc, out = run_gp(escribir(p, "pliego_indice_propio.json"))
    check("el pliego no elige contra que se lo verifica -> rojo",
          rc == 1 and "no abrio ninguno" in out, out)

    print("\n33) ROJO - una etapa escrita como texto suelto no se filtra en silencio")
    p = copy.deepcopy(bueno)
    p["secuencia"].append("etapa_fantasma")
    rc, out = run_gp(escribir(p, "pliego_etapa_string.json"))
    check("etapa con tipo equivocado -> rojo", rc == 1 and "no es un objeto" in out, out)

    print("\n34) ROJO - magnitud con algo que no es un numero en el campo del valor")
    for i, val in enumerate(["el que sea", [], True]):
        p = copy.deepcopy(bueno)
        p["fuerzas"][5]["magnitud"] = {"valor": val, "unidad": "bar", "fuente": "ficha de la pistola"}
        rc, out = run_gp(escribir(p, "pliego_valor_%d.json" % i))
        check("valor %r -> rojo" % (val,), rc == 1 and "no es un numero" in out, out)

    print("\n35) ROJO - copy-paste literal de una fuerza para tapar una etapa muda")
    p = copy.deepcopy(bueno)
    gemela = copy.deepcopy(p["fuerzas"][2])
    gemela["etapa"] = "descarga"
    p["fuerzas"].append(gemela)
    rc, out = run_gp(escribir(p, "pliego_copypaste.json"))
    check("la misma respuesta en dos etapas -> rojo", rc == 1 and "contestada igual" in out, out)

    print("\n36) VERDE de control - despues de 10 rojos nuevos, el pliego bueno sigue pasando")
    rc, out = run_gp(os.path.join(W, "pliego_ok.json"), "--carpeta-pedido", os.path.join(W, "pedido"))
    check("el endurecimiento no rompio el caso legitimo", rc == 0 and "VERDE" in out, out)

    print("\n37) VERDE - 'plantilla --out' escribe UTF-8 y 'verificar' lo puede leer")
    check("la receta documentada funciona en este shell",
          os.path.isfile(os.path.join(W, "plantilla_cruda.json"))
          and json.load(open(os.path.join(W, "plantilla_cruda.json"), encoding="utf-8"))["tags"]
          == ["adhesivo-a-pistola", "pieza-flexible"], "")

    print("\n38) ROJO - un render declarado que no esta en la carpeta de entrega")
    rc, out = run("gate_entregable.py", "--entrega", ent, "--motor", "foto3d", "--render", r_color)
    check("render fuera de la entrega -> rojo", rc == 1 and "no esta dentro de la entrega" in out, out)

    print("\n39) ROJO - un PDF nuevo no puede tapar a un informe viejo (G-E2)")
    import shutil as _sh
    _sh.copy(r_color, os.path.join(ent, "render_color.png"))
    r_dentro = os.path.join(ent, "render_color.png")
    with open(os.path.join(ent, "informe_viejo.pdf"), "wb") as f:
        f.write(b"%PDF-1.4\n")
    viejo_t = time.time() - 600
    os.utime(os.path.join(ent, "informe_viejo.pdf"), (viejo_t, viejo_t))
    with open(os.path.join(ent, "plano_nuevo.pdf"), "wb") as f:
        f.write(b"%PDF-1.4\n")
    rc, out = run("gate_entregable.py", "--entrega", ent, "--motor", "foto3d", "--render", r_dentro)
    check("STEP mas nuevo que el PDF mas VIEJO -> rojo", rc == 1 and "G-E2" in out, out)

    print("\n40) AVISO (ya no rojo) - un render de un dispositivo de un solo color")
    for f in os.listdir(ent):
        if f.endswith(".pdf"):
            os.utime(os.path.join(ent, f), None)
    _sh.copy(r_gris, os.path.join(ent, "render_gris.png"))
    rc, out = run("gate_entregable.py", "--entrega", ent, "--motor", "foto3d",
                  "--render", os.path.join(ent, "render_gris.png"))
    check("el color se informa y NO bloquea (mataba renders monocromos legitimos)",
          rc == 0 and "G-E3b" in out and "VERDE" in out, out)

    print("\n" + ("TODOS LOS CONTROLES DAN LO ESPERADO" if not fallos
                  else "FALLARON %d: %s" % (len(fallos), ", ".join(fallos))))
    print("carpeta del test: %s" % W)
    return 1 if fallos else 0


if __name__ == "__main__":
    sys.exit(main())
