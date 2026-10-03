# Control de antes de mostrar "Claude por area": mira (sin tocar nada) que la PC de la demostracion, el paquete para
# llevar y los papeles esten como tienen que estar. Cada renglon sale BIEN, OJO (no frena) o MAL (hay que arreglarlo).
# Uso: python tools/claude-area/antes_de_la_reunion.py [--area direccion] [--paquete "C:\ClaudeBarack-para-llevar\CLAUDE POR AREA"]
# Sale con 1 si hay algun MAL. No abre ventanas, no manda teclas y no escribe en ningun lado.
import io
import json
import os
import re
import string
import subprocess
import sys

RAIZ = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
CASA = r"C:\ClaudeBarack"
ENTREGABLES = os.path.join(RAIZ, "exports", "CLAUDES_POR_AREA_20261001")
VIDEOS = ["Video por sector - Claude en Barack.mp4", "Video tutorial - Claude en Barack (version 3).mp4"]
HOJAS = ["1 - Propuesta para Direccion.pdf", "3 - Preguntas que puede hacer Direccion.pdf", "4 - Guion de la reunion.pdf",
         "5 - Que dato puede pasar por Claude.pdf", "8 - Prueba en una PC de planta.pdf"]
PLUGIN_REPO = r"C:\Dev\barack-claude\plugins\barack-area"

fallas = 0


def decir(nivel, texto):
    global fallas
    if nivel == "MAL":
        fallas += 1
    print("  %-4s %s" % (nivel, texto))


def leer_json(ruta):
    try:
        return json.load(io.open(ruta, encoding="utf-8-sig"))
    except Exception:
        return None


def arg(nombre, defecto):
    return sys.argv[sys.argv.index(nombre) + 1] if nombre in sys.argv else defecto


def version_reglas(ruta):
    try:
        m = re.search(r"versi[oó]n (\d+), ([\d/]+)", io.open(ruta, encoding="utf-8").read(3000))
        return "v%s (%s)" % (m.group(1), m.group(2)) if m else None
    except Exception:
        return None


def demostracion(area):
    print("La demostracion de esta PC (%s)" % CASA)
    perfil = leer_json(os.path.join(CASA, "perfil.json")) or {}
    marca = leer_json(os.path.join(CASA, "instalado.json")) or {}
    if perfil.get("area") == area and marca.get("area") == area:
        decir("BIEN", "instalada como PC de %s: %s, %s" % (area, perfil.get("nombre") or "sin nombre", perfil.get("puesto") or "sin puesto"))
    else:
        decir("MAL", "esta instalada como «%s» y se va a mostrar como «%s»: correr preparar_reunion.sh %s" % (perfil.get("area"), area, area))
    con = os.path.join(CASA, "publicado", "conocimiento")
    tiene = sorted(os.listdir(con)) if os.path.isdir(con) else []
    decir("BIEN" if tiene == sorted(["comun", area]) else "MAL", "material instalado: %s" % (", ".join(tiene) or "nada"))
    v_inst = (leer_json(os.path.join(CASA, "publicado", "marketplace", "plugins", "barack-area", "version.json")) or {}).get("version")
    v_repo = (leer_json(os.path.join(PLUGIN_REPO, "version.json")) or {}).get("version")
    decir("BIEN" if v_inst and v_inst == v_repo else "MAL", "plugin instalado %s; el del repositorio es %s" % (v_inst, v_repo))
    r_inst = version_reglas(os.path.join(CASA, ".claude", "rules", "casa.md"))
    r_repo = version_reglas(os.path.join(PLUGIN_REPO, "casa", "CLAUDE.md"))
    decir("BIEN" if r_inst and r_inst == r_repo else "MAL", "reglas de la casa instaladas %s; las del repositorio son %s" % (r_inst, r_repo))
    nodo = os.path.join(CASA, "publicado", "marketplace", "plugins", "barack-area", "bin", "node.exe")
    decir("BIEN" if os.path.isfile(nodo) else "MAL", "el programa que hace correr los controles %s" % ("esta" if os.path.isfile(nodo) else "FALTA (sin el no frena nada)"))
    trabajo = os.path.join(CASA, "Trabajo")
    restos = [f for f in (os.listdir(trabajo) if os.path.isdir(trabajo) else []) if f != "LEEME.txt"]
    restos += [f for f in ("mail_borrador.json",) if os.path.exists(os.path.join(CASA, f))]
    decir("BIEN" if not restos else "OJO", "restos de pruebas a la vista: %s" % (", ".join(restos) if restos else "ninguno"))
    # el asistente se carga desde la carpeta que Claude tiene anotada: tiene que ser la de la demostracion
    km = leer_json(os.path.join(os.path.expanduser("~"), ".claude", "plugins", "known_marketplaces.json")) or {}
    anotada = ((km.get("barack") or {}).get("source") or {}).get("path", "")
    esperada = os.path.join(CASA, "publicado", "marketplace")
    if os.path.normcase(anotada) == os.path.normcase(esperada):
        decir("BIEN", "Claude tiene anotado el asistente de esta carpeta")
    else:
        decir("MAL", "Claude tiene anotado el asistente de OTRA carpeta (%s): abrir una conversacion en %s, escribir hola y cerrarla; despues no abrir ninguna de C:\\ClaudeBarack-areas" % (anotada or "ninguna", CASA))


def paquete(carpeta):
    print("El paquete para llevar (%s)" % carpeta)
    pub = os.path.join(carpeta, "1- PUBLICADO")
    ver = leer_json(os.path.join(pub, "VERSION.json"))
    if not ver:
        decir("MAL", "no esta, o le falta VERSION.json")
        return None
    faltan = [f for f in ("Instalar.cmd", "CLAUDE.md", "publicador.pub", "MANIFIESTO.json", "MANIFIESTO.sig",
                          os.path.join("contenido", "marketplace", "plugins", "barack-area", "bin", "node.exe"),
                          os.path.join("contenido", "programas", "_paquete.mjs")) if not os.path.isfile(os.path.join(pub, f))]
    decir("BIEN" if not faltan else "MAL", "version %s%s" % (ver.get("version"), "" if not faltan else "; le FALTA: " + ", ".join(faltan)))
    # la firma y cada archivo, con el mismo programa que usa la PC que instala (solo lee)
    guion = ("import * as P from 'file:///%s';const n=process.argv[1];const pub=P.leerPublicacion(n);"
             "const k=P.leerClavePublica(n+'/publicador.pub');"
             "const v=P.verificarFirma({nube:n,bytesManifiesto:pub.bytesManifiesto,clavePublica:k.clave,infoVersion:pub.info});"
             "const c=P.verificarContenido(n,pub.manifiesto,new Set(Object.keys(pub.manifiesto.archivos)));"
             "console.log(JSON.stringify({pub:pub.estado,firma:v.estado,contenido:!!c.ok,huella:P.huellaClave(k.clave)}))"
             % os.path.join(RAIZ, "scripts", "_paquete.mjs").replace("\\", "/"))
    try:
        r = subprocess.run(["node", "--input-type=module", "-e", guion, pub], capture_output=True, text=True, timeout=120, encoding="utf-8")
        j = json.loads(r.stdout.strip().splitlines()[-1])
    except Exception as e:
        decir("MAL", "no pude comprobar la firma del paquete (%s)" % str(e)[:80])
        return ver
    ok = j.get("pub") == "ok" and j.get("firma") == "valida" and j.get("contenido")
    decir("BIEN" if ok else "MAL", "firma %s, archivos %s" % (j.get("firma"), "enteros" if j.get("contenido") else "INCOMPLETOS o cambiados"))
    real = os.path.join(os.path.expanduser("~"), ".claude-area", "publicador.pub")
    try:
        misma = io.open(real, encoding="utf-8").read() == io.open(os.path.join(pub, "publicador.pub"), encoding="utf-8").read()
    except Exception:
        misma = False
    decir("BIEN" if misma else "MAL", "firmado con la llave de esta PC (huella %s)" % j.get("huella") if misma else "NO esta firmado con la llave real de esta PC: una PC instalada con este paquete rechazaria las versiones siguientes")
    # el material del paquete es el del repositorio de hoy?
    try:
        rev = subprocess.run(["git", "-C", r"C:\Dev\barack-claude", "status", "--short"], capture_output=True, text=True, timeout=30).stdout.strip()
        decir("BIEN" if not rev else "OJO", "repositorio del plugin y del material: %s" % ("todo guardado" if not rev else "hay cambios sin guardar; el paquete puede estar atrasado"))
    except Exception:
        pass
    # el instalador y el programa del paquete, contra los del repositorio (distinto = hay algo sin publicar)
    def igual(a, b):
        try:
            return io.open(a, "rb").read().replace(b"\r\n", b"\n") == io.open(b, "rb").read().replace(b"\r\n", b"\n")
        except Exception:
            return False
    viejos = [n for n, a, b in (
        ("Instalar.cmd", os.path.join(pub, "Instalar.cmd"), os.path.join(RAIZ, "tools", "claude-area", "hola", "Instalar.cmd")),
        ("el programa instalador", os.path.join(pub, "contenido", "programas", "_paquete.mjs"), os.path.join(RAIZ, "scripts", "_paquete.mjs")),
        ("el «instalá» de Claude", os.path.join(pub, "CLAUDE.md"), os.path.join(RAIZ, "tools", "claude-area", "hola", "CLAUDE.md")),
    ) if not igual(a, b)]
    decir("BIEN" if not viejos else "OJO", "el paquete trae lo ultimo del repositorio" if not viejos else "el paquete trae una version anterior de: %s (anda igual; lo nuevo esta sin publicar)" % ", ".join(viejos))
    # el validador oficial de Claude sobre el asistente del paquete (solo lee; con el programa de la app)
    try:
        import glob
        binarios = sorted(glob.glob(os.path.join(os.environ.get("APPDATA", ""), "Claude", "claude-code", "*", "*", "claude.exe")), key=os.path.getmtime)
        if binarios:
            mk = os.path.join(pub, "contenido", "marketplace")
            malos = [n for n, ruta in (("la lista de asistentes", mk), ("el asistente", os.path.join(mk, "plugins", "barack-area")))
                     if subprocess.run([binarios[-1], "plugin", "validate", ruta, "--strict"], capture_output=True, text=True, timeout=120).returncode != 0]
            decir("BIEN" if not malos else "MAL", "validador oficial de Claude: %s" % ("pasa" if not malos else "NO pasa en " + " y en ".join(malos)))
        else:
            decir("OJO", "no encontre el programa de la app para pasar el validador oficial")
    except Exception as e:
        decir("OJO", "no pude pasar el validador oficial (%s)" % str(e)[:60])
    return ver


def la_nube(ver):
    """La copia de la nube de Ingenieria: que sea la misma version que el paquete para llevar y que haya subido."""
    org = os.path.join(os.path.expanduser("~"), "BARACK ARGENTINA SRL")
    bib = [os.path.join(org, n) for n in (os.listdir(org) if os.path.isdir(org) else []) if re.match(r"^Ingenier.{1,2}a y Proyecto - General$", n)]
    carpeta = os.path.join(bib[0], "CLAUDE POR AREA") if bib else None
    print("La copia de la nube (%s)" % (carpeta or "no veo la biblioteca de Ingenieria"))
    if not carpeta or not os.path.isdir(carpeta):
        decir("OJO", "no esta la carpeta «CLAUDE POR AREA» en la nube de Ingenieria: las PC se instalan solo desde el pendrive")
        return
    v = leer_json(os.path.join(carpeta, "1- PUBLICADO", "VERSION.json"))
    igual = bool(v and ver and v.get("manifest_sha256") == ver.get("manifest_sha256"))
    decir("BIEN" if igual else "MAL", "version %s%s" % ((v or {}).get("version"), ", la misma que el paquete para llevar" if igual else "; el paquete para llevar es la %s: no son la misma" % (ver or {}).get("version")))
    try:
        r = subprocess.run(["powershell", "-NoProfile", "-ExecutionPolicy", "Bypass", "-File", os.path.join(RAIZ, "scripts", "_nubeSubio.ps1"), "-Carpeta", "CLAUDE POR AREA"],
                           capture_output=True, text=True, timeout=180, encoding="utf-8", errors="replace")
        decir("BIEN" if r.returncode == 0 else "OJO", "subio entera a la nube" if r.returncode == 0 else "todavia hay archivos sin subir a la nube: esperar y medir de nuevo")
    except Exception as e:
        decir("OJO", "no pude medir si subio a la nube (%s)" % str(e)[:60])


def pendrive(ver):
    print("El pendrive")
    hallado = False
    for letra in string.ascii_uppercase[3:]:
        v = leer_json("%s:\\CLAUDE POR AREA\\1- PUBLICADO\\VERSION.json" % letra)
        if v:
            hallado = True
            igual = ver and v.get("manifest_sha256") == ver.get("manifest_sha256")
            decir("BIEN" if igual else "MAL", "%s: tiene la version %s%s" % (letra, v.get("version"), "" if igual else " y el paquete para llevar es la %s: copiarlo de nuevo" % (ver or {}).get("version")))
    if not hallado:
        decir("OJO", "no veo un pendrive con la carpeta «CLAUDE POR AREA»: copiarla entera desde C:\\ClaudeBarack-para-llevar")


def papeles():
    print("Videos y hojas (%s)" % ENTREGABLES)
    for f in VIDEOS + HOJAS:
        p = os.path.join(ENTREGABLES, f)
        decir("BIEN" if os.path.isfile(p) and os.path.getsize(p) > 10000 else "MAL", f if os.path.isfile(p) else f + ": FALTA")
    try:
        r = subprocess.run([sys.executable, os.path.join(RAIZ, "tools", "claude-area", "puerta.py")], capture_output=True, text=True, timeout=300, encoding="utf-8", errors="replace")
        rojos = [l.strip() for l in r.stdout.splitlines() if "[ROJO" in l]
        decir("BIEN" if not rojos else "OJO", "puertas del plan: %s" % ("todas en verde o amarillo" if not rojos else " | ".join(x[:110] for x in rojos)))
    except Exception as e:
        decir("OJO", "no pude correr las puertas del plan (%s)" % str(e)[:60])


def la_pc():
    print("Esta PC, ahora")
    decir("BIEN" if os.path.isdir("Y:\\") else "OJO", "servidor (Y:) %s" % ("a la vista" if os.path.isdir("Y:\\") else "NO esta a la vista: en la planta tiene que verse"))
    try:
        t = subprocess.run(["tasklist", "/FI", "IMAGENAME eq OUTLOOK.EXE", "/NH"], capture_output=True, text=True, timeout=30).stdout
        decir("BIEN" if "OUTLOOK.EXE" in t.upper() else "OJO", "Outlook %s" % ("abierto" if "OUTLOOK.EXE" in t.upper() else "cerrado: abrirlo si se va a mostrar un mail"))
    except Exception:
        pass
    # el servicio de Claude: si esta con problemas, la demostracion en vivo se cambia por los videos
    try:
        import urllib.request
        with urllib.request.urlopen("https://status.claude.com/api/v2/status.json", timeout=15) as resp:
            est = json.loads(resp.read().decode("utf-8")).get("status", {})
        normal = est.get("indicator") == "none"
        decir("BIEN" if normal else "OJO", "servicio de Claude: %s" % ("funcionando normal" if normal else "CON PROBLEMAS (%s): tener los videos a mano" % est.get("description")))
    except Exception as e:
        decir("OJO", "no pude mirar el estado del servicio de Claude (status.claude.com): %s" % str(e)[:60])
    decir("OJO", "mirar el cupo de la cuenta (el anillo al lado del selector de modelo) y no lanzar examenes ni ayudantes las 5 horas de antes")


def main():
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
    area = arg("--area", "direccion")
    demostracion(area)
    ver = paquete(arg("--paquete", r"C:\ClaudeBarack-para-llevar\CLAUDE POR AREA"))
    pendrive(ver)
    la_nube(ver)
    papeles()
    la_pc()
    print("RESULTADO: %s" % ("nada en MAL" if not fallas else "%d cosa(s) en MAL" % fallas))
    return 1 if fallas else 0


if __name__ == "__main__":
    sys.exit(main())
