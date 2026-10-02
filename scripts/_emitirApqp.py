# -*- coding: utf-8 -*-
"""_emitirApqp.py — deja un documento controlado (flujograma o AMFE, ya exportado) en su lugar
del servidor: el maestro en Gestion Ingenieria y la copia en el casillero del legajo APQP.

Por que existe: `_emitirUpperTrim.py` hacia esto para UNA pieza, con las rutas escritas adentro.
Era la tercera vez que se escribia algo asi. Este lee que emitir de
`scripts/_lib/emisionesApqp.data.json`: para una pieza nueva se agregan sus dos entradas ahi.

Emitir un documento controlado lleva el OK de Fak (autonomy-contract §F): cada entrada lo
anota en `ok_de_fak`, y sin eso `--apply` no corre.

Solo COPIA. Si el destino ya existe y es identico lo dice; si es distinto FRENA: un documento
ya emitido no se reemplaza en silencio. Dos salidas, las dos explicitas:
  --reemplazar   cambio de revision: el archivo anterior va a la carpeta Obsoleto de al lado.
                 Vale para el mismo nombre con otro contenido y para la revision anterior del
                 mismo documento ("... - Rev.A" cuando se emite "... - Rev.B"): sin esta
                 bandera, una revision anterior en el destino frena.
  --pisar        el archivo anterior se reemplaza en su lugar y queda una copia LOCAL en
                 `.sgc-cache/emitidos-respaldo/`. Es para corregir una emision propia que no
                 llego a usarse: dejarla en un Obsoleto del legajo seria guardar un documento
                 que nunca valio.

Uso:  python scripts/_emitirApqp.py --lista
      python scripts/_emitirApqp.py <clave>                      (muestra que haria)
      python scripts/_emitirApqp.py <clave> --apply [--pisar | --reemplazar]
      python scripts/_emitirApqp.py --selftest                   (carpetas temporales, sin servidor)
"""
import datetime
import hashlib
import json
import os
import re
import shutil
import sys

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATOS = os.path.join(REPO, "scripts", "_lib", "emisionesApqp.data.json")
EXTENSIONES = {"flujograma": (".pdf", ".png"), "amfe": (".xlsx", ".pdf")}
PESO_MINIMO = 10_000   # una fuente de menos de 10 KB es un export que fallo


def sha(ruta):
    h = hashlib.sha256()
    with open(ruta, "rb") as f:
        for bloque in iter(lambda: f.read(1 << 20), b""):
            h.update(bloque)
    return h.hexdigest()


def png_a_pdf(png, pdf):
    """150 DPI: la convencion de los flujogramas hermanos del legajo."""
    from PIL import Image
    Image.MAX_IMAGE_PIXELS = None
    with Image.open(png) as img:
        img.convert("RGB").save(pdf, "PDF", resolution=150)


def ruta(tramos, raices):
    if tramos[0] not in raices:
        raise ValueError(f"la raiz '{tramos[0]}' no esta en 'raices'")
    return os.path.join(raices[tramos[0]], *tramos[1:])


def a_obsoleto(archivo, decir):
    """Manda un archivo a la carpeta Obsoleto de al lado, sin pisar lo que ya haya ahi."""
    obsoleto = os.path.join(os.path.dirname(archivo), "Obsoleto")
    os.makedirs(obsoleto, exist_ok=True)
    base, ext = os.path.splitext(os.path.basename(archivo))
    n, anterior = 1, os.path.join(obsoleto, base + ext)
    while os.path.exists(anterior):
        n += 1
        anterior = os.path.join(obsoleto, f"{base} ({n}){ext}")
    shutil.move(archivo, anterior)
    decir(f"  anterior -> {anterior}")


def revisiones_anteriores(carpeta, nombre, ext):
    """Archivos del MISMO documento con otra letra de revision ("... - Rev.A.pdf" cuando se
    emite "... - Rev.B.pdf"). El nombre lleva la revision, asi que comparar por nombre igual
    no los ve: sin esto un cambio de revision dejaba las dos juntas (auditoria del 02/10/2026)."""
    m = re.match(r"^(.*) - Rev\.[A-Z]+$", nombre)
    if not m or not os.path.isdir(carpeta):
        return []
    patron = re.compile(re.escape(m.group(1)) + r" - Rev\.[A-Z]+" + re.escape(ext) + "$", re.I)
    return [os.path.join(carpeta, f) for f in sorted(os.listdir(carpeta))
            if patron.match(f) and f.lower() != (nombre + ext).lower()]


def emitir(e, raices, repo, respaldo_raiz, apply=False, pisar=False, reemplazar=False,
           convertir=png_a_pdf, decir=print):
    """Devuelve 0 si salio bien (o si el dry-run no encontro frenos) y 1 si freno.
    No usa sys.exit: el selftest la llama muchas veces."""
    tipo, nombre = e["tipo"], e["nombre"]
    if tipo not in EXTENSIONES:
        decir(f"ERROR: tipo desconocido '{tipo}' (va flujograma o amfe)")
        return 1
    salida = os.path.join(repo, e["salida"])
    maestro = ruta(e["maestro"], raices)
    candidatas = [ruta(c, raices) for c in e["legajo"]]
    existen = [c for c in candidatas if os.path.isdir(c)]
    if len(existen) > 1:
        # Un legajo a medio mudar: emitir en uno deja al otro con la version vieja.
        decir("ERROR: existen DOS carpetas de legajo para esta pieza; resolver cual vale antes de emitir:\n  " + "\n  ".join(existen))
        return 1
    legajo = existen[0] if existen else None

    # --- 1. las fuentes, en la carpeta de salida del repo ---
    os.makedirs(salida, exist_ok=True)
    if tipo == "flujograma":
        png_generador = os.path.join(repo, e["png_generador"])
        if not os.path.isfile(png_generador):
            decir(f"ERROR: falta el PNG del generador: {png_generador}\n  node scripts/_flujograma.mjs <clave>")
            return 1
        png = os.path.join(salida, nombre + ".png")
        pdf = os.path.join(salida, nombre + ".pdf")
        # El PDF se rehace SOLO si cambio el dibujo. PIL le graba la hora al PDF: rehecho en cada
        # corrida nunca daba "igual" contra el ya emitido y pedia reemplazar un archivo identico
        # a la vista (auditoria de cierre del 01/10/2026).
        if not (os.path.isfile(png) and os.path.isfile(pdf) and sha(png) == sha(png_generador)):
            shutil.copyfile(png_generador, png)
            convertir(png, pdf)
            decir(f"  (cambio el dibujo: PNG y PDF rehechos en {salida})")

    fuentes = [os.path.join(salida, nombre + ext) for ext in EXTENSIONES[tipo]]
    for f in fuentes:
        if not os.path.isfile(f) or os.path.getsize(f) < PESO_MINIMO:
            decir(f"ERROR: falta la fuente o pesa demasiado poco: {f}")
            return 1

    # --- 2. el plan ---
    if legajo is None:
        decir("ERROR: no encuentro el legajo APQP de la pieza en ninguna de:\n  " + "\n  ".join(candidatas))
        return 1
    casillero = os.path.join(legajo, e["casillero"])
    if not os.path.isdir(casillero):
        decir(f"ERROR: el legajo no tiene el casillero: {casillero}")
        return 1

    plan, problemas, anteriores = [], [], []
    for donde, destino_dir in (("maestro", maestro), ("legajo", casillero)):
        for f in fuentes:
            destino = os.path.join(destino_dir, os.path.basename(f))
            if len(destino) > 259:
                problemas.append(f"ruta de {len(destino)} caracteres, no abre en Windows: {destino}")
            if os.path.isfile(destino):
                estado = "igual" if sha(destino) == sha(f) else "DISTINTO"
            else:
                estado = "nuevo"
            plan.append((f, destino, estado, donde))
            anteriores += revisiones_anteriores(destino_dir, nombre, os.path.splitext(f)[1])

    decir(f"{tipo.upper()} — {nombre}\n")
    for f, destino, estado, _ in plan:
        decir(f"  [{estado:<8}] {destino}")
    for a in anteriores:
        decir(f"  [REV.ANT.] {a}")
    if not os.path.isdir(maestro):
        # Se crea solo el ultimo nivel (la carpeta del documento). Si falta mas que eso, un
        # tramo esta mal escrito y crear el arbol dejaria una carpeta paralela en el servidor.
        if not os.path.isdir(os.path.dirname(maestro)):
            problemas.append(f"no existe la carpeta donde iria el maestro: {os.path.dirname(maestro)}")
        else:
            decir(f"\n  (se crea la carpeta {maestro})")
    distintos = [p for p in plan if p[2] == "DISTINTO"]
    if distintos and not (reemplazar or pisar):
        problemas.append(f"{len(distintos)} destino(s) ya existen con otro contenido: --reemplazar (el anterior a Obsoleto) o --pisar (correccion de una emision propia sin usar)")
    if anteriores and not reemplazar:
        problemas.append(f"hay {len(anteriores)} archivo(s) de una revision anterior del mismo documento: un cambio de revision va con --reemplazar (los manda a Obsoleto)")
    if apply and not e.get("ok_de_fak"):
        problemas.append("la entrada no tiene 'ok_de_fak': emitir un documento controlado lleva su OK (autonomy-contract §F)")
    if problemas:
        decir("\nFRENO:\n  " + "\n  ".join(problemas))
        return 1
    if not apply:
        decir("\nDRY-RUN. Corre con --apply para copiar.")
        return 0

    # --- 3. copiar y verificar ---
    # Si algo falla a mitad de camino (el servidor se cae, un archivo abierto) se dice en que
    # destino quedo: lo ya copiado esta verificado y volver a correr termina el resto.
    destino = maestro
    try:
        os.makedirs(maestro, exist_ok=True)
        sello = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
        for f, destino, estado, donde in plan:
            if estado == "igual":
                continue
            if estado == "DISTINTO" and pisar:
                respaldo_dir = os.path.join(respaldo_raiz, sello, donde)
                os.makedirs(respaldo_dir, exist_ok=True)
                respaldo = os.path.join(respaldo_dir, os.path.basename(destino))
                shutil.copyfile(destino, respaldo)
                if sha(respaldo) != sha(destino):
                    decir(f"ERROR: no pude respaldar {destino}; no lo piso")
                    return 1
                decir(f"  respaldo local del anterior: {respaldo}")
            elif estado == "DISTINTO":
                a_obsoleto(destino, decir)
            shutil.copyfile(f, destino)
            if sha(destino) != sha(f):
                decir(f"ERROR: la copia no coincide con la fuente: {destino}")
                return 1
            decir(f"  copiado y verificado: {destino}")
        for a in anteriores:
            destino = a
            a_obsoleto(a, decir)
    except OSError as err:
        decir(f"ERROR: fallo en {destino}: {err}\n  Lo anterior a ese renglon quedo copiado y verificado. Volver a correr termina el resto.")
        return 1
    decir("\nListo.")
    return 0


# ---------------------------------------------------------------------------
# selftest: por el camino que ESCRIBE, en carpetas temporales
# ---------------------------------------------------------------------------
def selftest():
    import tempfile
    base = tempfile.mkdtemp(prefix="emitirApqp_")
    repo = os.path.join(base, "repo")
    raices = {"GI": os.path.join(base, "srv", "GI"), "PPAP": os.path.join(base, "srv", "PPAP")}
    respaldo = os.path.join(base, "respaldo")
    legajo_real = os.path.join(raices["PPAP"], "CLIENTE", "PIEZA", "_VIEJA", "APQP")
    os.makedirs(os.path.join(legajo_real, "22- FMEA de proceso"))
    os.makedirs(os.path.join(legajo_real, "20- Flujograma de proceso"))
    os.makedirs(os.path.join(repo, "salida"))
    os.makedirs(os.path.join(repo, "build"))
    # La carpeta del cliente ya existe en el servidor; la del documento la crea el emisor.
    os.makedirs(os.path.join(raices["GI"], "13. AMFE", "CLIENTE"))
    os.makedirs(os.path.join(raices["GI"], "8. Flujograma", "CLIENTE"))

    amfe = {"tipo": "amfe", "nombre": "AMFE 999 - PRUEBA - Rev.A", "salida": "salida",
            "maestro": ["GI", "13. AMFE", "CLIENTE", "999 - PRUEBA"],
            "legajo": [["PPAP", "CLIENTE", "PIEZA", "APQP"], ["PPAP", "CLIENTE", "PIEZA", "_VIEJA", "APQP"]],
            "casillero": "22- FMEA de proceso", "ok_de_fak": "selftest"}
    flujo = {"tipo": "flujograma", "nombre": "FLUJOGRAMA 998 - PRUEBA - Rev.A", "salida": "salida",
             "png_generador": "build/F.png", "maestro": ["GI", "8. Flujograma", "CLIENTE", "998 - PRUEBA"],
             "legajo": amfe["legajo"], "casillero": "20- Flujograma de proceso", "ok_de_fak": "selftest"}

    def escribir(ruta_archivo, relleno):
        with open(ruta_archivo, "wb") as f:
            f.write((relleno * 20_000)[:20_000].encode("ascii"))

    fuentes = [os.path.join(repo, "salida", amfe["nombre"] + ext) for ext in (".xlsx", ".pdf")]
    destinos = [os.path.join(d, os.path.basename(f))
                for d in (ruta(amfe["maestro"], raices), os.path.join(legajo_real, amfe["casillero"]))
                for f in fuentes]
    salida = []
    correr = lambda e, **kw: emitir(e, raices, repo, respaldo, decir=salida.append, **kw)   # noqa: E731
    fallas = []

    def caso(nombre, cond):
        print(f"  {'ok ' if cond else 'MAL'}  {nombre}")
        if not cond:
            fallas.append(nombre)

    # (g) falta una fuente: error y nada copiado
    escribir(fuentes[0], "a")
    caso("g. falta una fuente -> error y no copia nada",
         correr(amfe, apply=True) == 1 and not any(os.path.exists(d) for d in destinos))
    # dry-run no escribe
    escribir(fuentes[1], "b")
    caso("   dry-run -> 0 y no escribe", correr(amfe) == 0 and not any(os.path.exists(d) for d in destinos))
    # (a) destino vacio + apply
    caso("a. destino vacio + apply -> copia los 4 y coinciden por hash",
         correr(amfe, apply=True) == 0 and all(os.path.isfile(d) for d in destinos)
         and all(sha(d) == sha(fuentes[i % 2]) for i, d in enumerate(destinos)))
    caso("   uso la segunda carpeta candidata del legajo (la primera no existe)",
         os.path.isfile(os.path.join(legajo_real, amfe["casillero"], os.path.basename(fuentes[0]))))
    # (b) identico
    antes = [os.path.getmtime(d) for d in destinos]
    salida.clear()
    caso("b. destino identico -> dice igual y no escribe",
         correr(amfe, apply=True) == 0 and sum("[igual" in s for s in salida) == 4
         and antes == [os.path.getmtime(d) for d in destinos])
    # (c) distinto sin bandera
    viejo = sha(destinos[0])
    escribir(fuentes[0], "c")
    caso("c. destino distinto sin bandera -> frena y no toca nada",
         correr(amfe, apply=True) == 1 and sha(destinos[0]) == viejo)
    # (d) --pisar
    caso("d. --pisar -> reemplaza y deja el respaldo local del anterior",
         correr(amfe, apply=True, pisar=True) == 0 and sha(destinos[0]) == sha(fuentes[0])
         and any(sha(os.path.join(r, f)) == viejo for r, _, fs in os.walk(respaldo) for f in fs)
         and not os.path.isdir(os.path.join(os.path.dirname(destinos[0]), "Obsoleto")))
    # (e) --reemplazar
    viejo = sha(destinos[0])
    escribir(fuentes[0], "e")
    obsoleto = os.path.join(os.path.dirname(destinos[0]), "Obsoleto", os.path.basename(destinos[0]))
    caso("e. --reemplazar -> el anterior va a Obsoleto y queda el nuevo",
         correr(amfe, apply=True, reemplazar=True) == 0 and sha(destinos[0]) == sha(fuentes[0])
         and os.path.isfile(obsoleto) and sha(obsoleto) == viejo)
    # sin OK de Fak no hay apply
    sin_ok = dict(amfe, ok_de_fak="")
    escribir(fuentes[0], "h")
    viejo = sha(destinos[0])
    caso("   sin 'ok_de_fak' -> apply frena y no toca nada",
         correr(sin_ok, apply=True, pisar=True) == 1 and sha(destinos[0]) == viejo)
    # legajo o casillero que no existen
    caso("   legajo inexistente -> error", correr(dict(amfe, legajo=[["PPAP", "NO", "EXISTE"]]), apply=True) == 1)
    caso("   casillero inexistente -> error", correr(dict(amfe, casillero="99- No existe"), apply=True) == 1)
    # flujograma: el PDF se rehace solo si cambio el PNG
    hechos = []

    def falso_convertir(png, pdf):
        hechos.append(png)
        escribir(pdf, "p" + str(len(hechos)))

    caso("   flujograma sin PNG del generador -> error", correr(flujo, apply=True, convertir=falso_convertir) == 1)
    escribir(os.path.join(repo, "build", "F.png"), "1")
    caso("   flujograma: primera vez convierte y copia",
         correr(flujo, apply=True, convertir=falso_convertir) == 0 and len(hechos) == 1)
    salida.clear()
    caso("   flujograma: mismo PNG -> no rehace el PDF y da igual",
         correr(flujo, apply=True, convertir=falso_convertir) == 0 and len(hechos) == 1
         and sum("[igual" in s for s in salida) == 4)
    escribir(os.path.join(repo, "build", "F.png"), "2")
    caso("   flujograma: cambio el PNG -> rehace el PDF y frena por distinto",
         correr(flujo, apply=True, convertir=falso_convertir) == 1 and len(hechos) == 2)
    # Obsoleto numerado: un segundo reemplazo del mismo nombre no pisa el primero
    escribir(fuentes[0], "j")
    caso("   segundo --reemplazar -> el Obsoleto se numera y no pisa el anterior",
         correr(amfe, apply=True, reemplazar=True) == 0
         and os.path.isfile(obsoleto.replace(".xlsx", " (2).xlsx")) and sha(obsoleto) != sha(obsoleto.replace(".xlsx", " (2).xlsx")))
    # una fuente que pesa demasiado poco es un export que fallo
    with open(fuentes[1], "wb") as f:
        f.write(b"chico")
    caso("   fuente de menos de 10 KB -> error", correr(amfe, apply=True, pisar=True) == 1)
    escribir(fuentes[1], "b")
    # cambio de REVISION: el nombre cambia, y la revision anterior no puede quedar al lado
    rev_b = dict(amfe, nombre="AMFE 999 - PRUEBA - Rev.B")
    fuentes_b = [os.path.join(repo, "salida", rev_b["nombre"] + ext) for ext in (".xlsx", ".pdf")]
    for f in fuentes_b:
        escribir(f, "B")
    dir_maestro = ruta(amfe["maestro"], raices)
    dir_legajo = os.path.join(legajo_real, amfe["casillero"])
    caso("h. Rev.B con la Rev.A en el destino, sin bandera -> frena y no copia",
         correr(rev_b, apply=True) == 1 and not os.path.exists(os.path.join(dir_maestro, os.path.basename(fuentes_b[0]))))
    caso("   Rev.B con --pisar -> tambien frena (pisar no es para cambiar de revision)",
         correr(rev_b, apply=True, pisar=True) == 1)
    quedan = lambda d: sorted(f for f in os.listdir(d) if os.path.isfile(os.path.join(d, f)))   # noqa: E731
    caso("   Rev.B con --reemplazar -> queda solo la Rev.B y la Rev.A va a Obsoleto, en los dos lugares",
         correr(rev_b, apply=True, reemplazar=True) == 0
         and quedan(dir_maestro) == sorted(os.path.basename(f) for f in fuentes_b)
         and quedan(dir_legajo) == sorted(os.path.basename(f) for f in fuentes_b)
         and os.path.isfile(os.path.join(dir_legajo, "Obsoleto", amfe["nombre"] + ".pdf")))
    # dos carpetas de legajo que existen a la vez (otra pieza, con el legajo a medio mudar)
    dos = dict(rev_b, legajo=[["PPAP", "CLIENTE", "PIEZA2", "APQP"], ["PPAP", "CLIENTE", "PIEZA2", "_VIEJA", "APQP"]])
    for c in dos["legajo"]:
        os.makedirs(os.path.join(ruta(c, raices), "22- FMEA de proceso"))
    caso("i. existen las dos carpetas candidatas del legajo -> frena y no copia a ninguna",
         correr(dos, apply=True, reemplazar=True) == 1
         and not any(os.listdir(os.path.join(ruta(c, raices), "22- FMEA de proceso")) for c in dos["legajo"]))
    # un tramo del maestro mal escrito no crea un arbol paralelo
    mal = dict(amfe, maestro=["GI", "13. AMFES", "CLIENTE", "999 - PRUEBA"])
    caso("   tramo del maestro mal escrito -> error y no crea la carpeta",
         correr(mal, apply=True, pisar=True) == 1 and not os.path.isdir(os.path.join(raices["GI"], "13. AMFES")))
    # (f) clave inexistente, por la linea de comandos real
    caso("f. clave inexistente -> error claro", main(["no-existe"], decir=salida.append) == 1
         and "no existe" in salida[-1])
    # la linea de comandos: lo que no conoce frena, y cada bandera llega tal cual
    llamadas = []
    espia = lambda *a, **kw: (llamadas.append(kw), 0)[1]   # noqa: E731
    caso("   bandera desconocida junto a --apply -> error y no emite",
         main(["174-amfe", "--apply", "--help"], decir=salida.append, emitir_con=espia) == 1 and not llamadas)
    main(["174-amfe"], decir=salida.append, emitir_con=espia)
    main(["174-amfe", "--apply", "--pisar"], decir=salida.append, emitir_con=espia)
    main(["174-amfe", "--apply", "--reemplazar"], decir=salida.append, emitir_con=espia)
    banderas = [(k["apply"], k["pisar"], k["reemplazar"]) for k in llamadas]
    caso("   sin banderas no escribe; --pisar y --reemplazar llegan cada una por separado",
         banderas == [(False, False, False), (True, True, False), (True, False, True)])
    caso("   --pisar y --reemplazar juntas -> error y no emite",
         main(["174-amfe", "--apply", "--pisar", "--reemplazar"], decir=salida.append, emitir_con=espia) == 1 and len(llamadas) == 3)
    # los datos reales cargan y cada entrada esta completa
    datos = json.load(open(DATOS, encoding="utf-8"))
    completos = all(all(k in e for k in ("tipo", "nombre", "salida", "maestro", "legajo", "casillero"))
                    and e["maestro"][0] in datos["raices"] and all(c[0] in datos["raices"] for c in e["legajo"])
                    and (e["tipo"] != "flujograma" or "png_generador" in e)
                    for e in datos["emisiones"].values())
    caso("   emisionesApqp.data.json: todas las entradas completas", completos and len(datos["emisiones"]) >= 2)

    print(f"\nselftest emitirApqp: {'todo verde' if not fallas else str(len(fallas)) + ' en rojo'}  ({base})")
    return 1 if fallas else 0


BANDERAS = {"--apply", "--pisar", "--reemplazar", "--lista"}


def main(argv, decir=print, emitir_con=None):
    args = [a for a in argv if not a.startswith("--")]
    # Lo que escribe frena ante un argumento que no conoce: el 01/10/2026 un "--instalar --help"
    # que crei inofensivo instalo de verdad (LECCIONES). Aca "--apply --help" emitia.
    desconocidas = [a for a in argv if a.startswith("--") and a not in BANDERAS]
    if desconocidas:
        decir(f"ERROR: no conozco {', '.join(desconocidas)}. Van: {', '.join(sorted(BANDERAS))}, --selftest")
        return 1
    datos = json.load(open(DATOS, encoding="utf-8"))
    if "--lista" in argv:
        for clave, e in datos["emisiones"].items():
            decir(f"  {clave:<18} {e['nombre']}")
        return 0
    pisar, reemplazar = "--pisar" in argv, "--reemplazar" in argv
    if len(args) != 1 or (pisar and reemplazar):
        decir("Uso: python scripts/_emitirApqp.py <clave> [--apply] [--pisar | --reemplazar]   (--lista muestra las claves)")
        return 1
    if args[0] not in datos["emisiones"]:
        decir(f"ERROR: la clave '{args[0]}' no existe en emisionesApqp.data.json. Hay: {', '.join(datos['emisiones'])}")
        return 1
    return (emitir_con or emitir)(datos["emisiones"][args[0]], datos["raices"], REPO,
                                  os.path.join(REPO, ".sgc-cache", "emitidos-respaldo"),
                                  apply="--apply" in argv, pisar=pisar, reemplazar=reemplazar, decir=decir)


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    sys.exit(selftest() if "--selftest" in sys.argv else main(sys.argv[1:]))
