# -*- coding: utf-8 -*-
"""Como esta ESCRITA una hoja de proceso: el vocabulario y la voz.

Dos cosas que el canon ya pedia y ningun control miraba, hasta que Fak las encontro leyendo
el entregable:

1. **El castellano de planta.** `docs/CRITERIOS_HOJAS_DE_PROCESO.md` 3.2 tiene la tabla de
   terminos prohibidos desde el 08/09/2026, y el 21/09 entregue una hoja que decia "SETA".
   Fak: *"encontre un error gravisimo... 'SETA' se llaman boton de parada de emergencia...
   tenes que corregir directamente la skill para incluir vocabulario conocido argentino
   nuestro, no este random que inventaste"*. La tabla estaba escrita en prosa y nadie la leia:
   ahora es `vocabulario.data.json` y la mira este gate.

2. **La voz del paso.** El canon 4.4 pide infinitivo ("Verificar...", "Colocar...") y prohibe
   el lenguaje narrativo. Entregue pasos como *"La mesa entra con el molde y el portico queda
   arriba"*. Fak: *"no me explicas que debo hacer yo... entendes la diferencia?"*. Un paso que
   empieza con articulo describe a la MAQUINA; el operario necesita el verbo de SU accion.

Se usa desde el generador (`gate_redaccion(hoja)`) o a mano:

    py -3 redaccion.py texto "La mesa entra con el molde"
    py -3 redaccion.py spec scripts/img/generar_hojas_img.py HOJAS_IMG
"""
import json
import os
import re
import sys
import unicodedata

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATOS = os.path.join(BASE, "vocabulario.data.json")

# Los verbos con los que Barack arranca un paso. Lista CANONICA a proposito: un verbo nuevo se
# agrega mirando una hoja real, no se acepta por como termina la palabra (leccion
# `heuristicas_lista_canonica_no_regex_parcial`). Los cinco primeros son los del canon 4.4.
VERBOS = {
    "verificar", "colocar", "accionar", "posicionar", "presionar",
    "abrir", "cerrar", "apretar", "soltar", "girar", "bajar", "subir", "sacar", "poner",
    "retirar", "cargar", "descargar", "tomar", "agarrar", "sostener", "apoyar", "centrar",
    "alinear", "ajustar", "regular", "seleccionar", "elegir", "confirmar", "esperar",
    "controlar", "inspeccionar", "revisar", "mirar", "medir", "pesar", "contar",
    "identificar", "rotular", "etiquetar", "registrar", "anotar", "avisar", "informar",
    "dar", "llamar", "detener", "parar", "arrancar", "iniciar", "reiniciar", "habilitar",
    "limpiar", "despejar", "ordenar", "segregar", "apartar", "separar", "descartar",
    "verificarque", "repetir", "continuar", "completar", "cortar", "recortar", "desmoldar",
    "extraer", "trasladar", "acercar", "alejar", "usar", "utilizar", "ubicar", "montar",
    "desmontar", "conectar", "desconectar", "encender", "apagar", "pulsar", "mantener",
    "aguardar", "asegurar", "fijar", "trabar", "destrabar", "desplazar", "empujar", "tirar",
    # los que faltaban, contados en las hojas limpias de Barack (78 pasos, 21/09/2026)
    "mover", "levantar", "verter", "mezclar", "armar", "apilar", "tapar", "desarmar",
    "sumergir", "batir", "rociar", "superar", "prender", "pasar", "enganchar", "precintar",
    "setear", "torquear", "segregar", "operar", "mandar", "golpear", "respetar", "dejar",
}

# Con que arranca una frase que describe a la maquina en vez de mandarle algo al operario.
NARRATIVO = re.compile(
    r"^(el|la|los|las|un|una|unos|unas|este|esta|estos|estas|se|su|sus|cada|"
    r"arriba|abajo|al|del|en|desde|hasta|cuando|si|mientras|durante|despues|antes|"
    r"aca|aqui|ahi|alli|hay|es|son|esta|estan|queda|quedan|tiene|tienen|lo|le)\b",
    re.I)

# Lo que puede ir adelante del verbo sin romper la regla.
PREFIJO_OK = re.compile(r"^(?:\d+[\.\)]\s*|[▲▸•\-—]\s*|"
                        r"(?:critico\s+vw|atencion|importante)[:\s]+)+", re.I)


def _plano(s):
    """Minusculas y sin acentos: los patrones se escriben una sola vez."""
    s = unicodedata.normalize("NFD", str(s))
    return "".join(c for c in s if unicodedata.category(c) != "Mn").lower()


def cargar(ruta=DATOS):
    with open(ruta, encoding="utf-8") as f:
        return json.load(f)


def revisar_vocabulario(texto, datos=None):
    """Devuelve [(termino_encontrado, reemplazo, motivo, fuente)] del texto."""
    datos = datos or cargar()
    plano = _plano(texto)
    hallazgos = []
    for e in datos["prohibidos"]:
        m = re.search(e["patron"], plano)
        if m:
            hallazgos.append((m.group(0), e["reemplazo"], e["motivo"], e["fuente"]))
    ctx = datos.get("_contextos", {})
    for e in datos.get("prohibidos_con_contexto", []):
        m = re.search(e["patron"], plano)
        if m and re.search(ctx.get(e.get("contexto", ""), r"$^"), plano):
            hallazgos.append((m.group(0), e["reemplazo"], e["motivo"], e["fuente"]))
    for e in datos.get("partes_inexistentes", {}).get("patrones", []):
        m = re.search(e[0], plano)
        if m:
            hallazgos.append((m.group(0), "(esa pieza no existe en esta maquina)", e[1],
                              datos["partes_inexistentes"].get("fuente", "")))

    for clave in ("dramatizacion", "borrador"):
        bloque = datos.get(clave, {})
        for pat in bloque.get("patrones", []):
            m = re.search(pat, plano)
            if m:
                hallazgos.append((m.group(0), "(sacarlo)",
                                  "Tono: " + clave, bloque.get("fuente", "")))
    return hallazgos


# El operario lee castellano. El ideograma de la serigrafia va rotulado SOBRE la foto, que es
# donde el operario lo va a reconocer; en el texto del paso no entra.
# IATF 16949:2016 8.5.1.2 c), pag. 55: las normas de trabajo "se presentan en un idioma(s)
# entendible para el personal responsable de su ejecucion". Canon 2.6.
CJK = re.compile(r"[　-〿㐀-䶿一-鿿＀-￯]")


def revisar_idioma(texto):
    """Devuelve los caracteres que el operario no puede leer, si los hay."""
    hallados = CJK.findall(str(texto))
    return "".join(dict.fromkeys(hallados))


def revisar_cocina(texto, datos=None):
    """Lo que es mio y no del operario. Devuelve [(hallado, que_es)]."""
    datos = datos or cargar()
    plano = _plano(texto)
    out = []
    for pat, que in datos.get("cocina", {}).get("patrones", []):
        # los patrones se escriben como se lean mejor; el texto ya viene sin acentos y en
        # minusculas, asi que la busqueda va sin distinguir mayusculas (IMG_0844 / img_0844)
        m = re.search(pat, plano, re.IGNORECASE)
        if m:
            out.append((m.group(0), que))
    # TBD se puede escribir, pero solo: el porque va a la bitacora. Se mira SU renglon:
    # en la lamina los pasos van en un solo cuadro, uno por renglon, y cruzar el salto
    # tomaba el paso siguiente como "la explicacion" (falso rojo en la 30.3, 22/09/2026).
    m = re.search(r"\btbd\b([^\n]{0,400})", plano)
    if m and len(m.group(1).strip(" .,:;-")) > 40:
        out.append(("TBD ...", "un TBD con explicacion (va TBD y nada mas)"))
    return out


def revisar_pie(pie, datos=None):
    """Un pie NOMBRA lo que se ve. Devuelve el verbo de movimiento si lo narra."""
    datos = datos or cargar()
    plano = " " + _plano(pie) + " "
    for v in datos.get("pie_narrado", {}).get("verbos", []):
        if " " + v + " " in plano:
            return v
    return None


def revisar_denominacion(nombre, datos=None):
    """Como se llama la operacion. Devuelve el motivo si no es un nombre de Barack."""
    datos = datos or cargar()
    r = datos.get("denominacion", {})
    t = str(nombre).strip()
    if not t:
        return "esta vacia"
    if len(t) < r.get("largo_min", 8):
        return f"tiene {len(t)} caracteres; en el corpus el minimo es {r['largo_min']}"
    if len(t) > r.get("largo_max", 64):
        return (f"tiene {len(t)} caracteres; la mas larga del corpus tiene "
                f"{r['largo_max']}. Se parte con guion largo y calificador.")
    plano = _plano(t)
    if re.match(r"^(el|la|los|las|un|una)\b", plano):
        return ("arranca con articulo. En 113 denominaciones reales de Barack no hay "
                "NINGUNA que empiece asi.")
    if ":" in t or "?" in t or "\u00bf" in t:
        return ("lleva dos puntos o una pregunta. Eso es un titulo de capitulo, no una "
                "denominacion: en el corpus no aparece ni una vez.")
    primera = re.split(r"[\s,.-]+", plano)[0]
    if t.upper() in [x.upper() for x in r.get("una_palabra_ok", [])]:
        return None
    canon = [_plano(x) for x in r.get("primera_palabra", [])]
    if primera in canon:
        return None
    # una palabra nueva no da rojo: avisa, para que se agregue mirando un documento real
    return ("AVISO: arranca con \"%s\", que no esta entre las %d primeras palabras que "
            "Barack usa de verdad. Si es correcta, agregarla a primera_palabra citando la "
            "denominacion real de donde sale. Ejemplos: %s."
            % (primera, len(canon), ", ".join(r.get("ejemplos_reales", [])[:3])))


def revisar_voz(paso):
    """(estado, detalle) para UN paso. estado: 'ok' | 'narrativo' | 'verbo_nuevo'."""
    t = _plano(paso).strip()
    t = PREFIJO_OK.sub("", t).strip()
    if not t:
        return "narrativo", "el paso esta vacio"
    palabras = re.split(r"[\s,:;.]+", t)
    primera = palabras[0]
    # un paso puede arrancar negado: "No superar 6 niveles ni mezclar mano DERECHA /
    # IZQUIERDA" es un paso real de Barack (HO-71). Lo que manda es el verbo que sigue.
    if primera == "no" and len(palabras) > 1:
        primera = palabras[1]
    if primera in VERBOS:
        return "ok", primera
    if NARRATIVO.match(t):
        return "narrativo", primera
    if primera.endswith(("ar", "er", "ir")) and len(primera) > 3:
        return "verbo_nuevo", primera
    return "narrativo", primera


def gate_redaccion(hoja, datos=None):
    """El gate que corre el generador. Sale con SystemExit si la hoja no se puede imprimir."""
    datos = datos or cargar()
    op = hoja.get("op", "?")
    rojos, avisos = [], []

    campos = []
    for k in ("denominacion", "nota", "disparador"):
        if hoja.get(k):
            campos.append((k, hoja[k]))
    for k in ("pasos", "pies", "acciones", "epp"):
        for i, v in enumerate(hoja.get(k) or [], 1):
            campos.append((f"{k}[{i}]", v if isinstance(v, str) else " ".join(map(str, v))))
    for par in hoja.get("parametros") or []:
        campos.append(("parametros", " ".join(map(str, par))))

    for donde, txt in campos:
        for hallado, reemplazo, motivo, fuente in revisar_vocabulario(txt, datos):
            rojos.append(f"{op} {donde}: dice \"{hallado}\" -> va \"{reemplazo}\".\n"
                         f"        {motivo}\n        fuente: {fuente}")

    for donde, txt in campos:
        raros = revisar_idioma(txt)
        if raros:
            rojos.append(
                f'{op} {donde}: el texto impreso tiene "{raros}", que el operario no lee.\n'
                '        El ideograma va ROTULADO SOBRE LA FOTO, donde el operario lo\n'
                '        reconoce; en el texto del paso va el nombre en castellano.\n'
                '        fuente: IATF 16949:2016 8.5.1.2 c), pag. 55 + canon 2.6.')

    mal = revisar_denominacion(hoja.get("denominacion", ""), datos)
    if mal and mal.startswith("AVISO"):
        avisos.append(f'{op} denominacion: {mal}')
    elif mal:
        rojos.append(
            f'{op} la denominacion "{hoja.get("denominacion", "")}" {mal}\n'
            '        Fak, 21/09/2026: "eso es cualquier cosa". La regla y los ejemplos\n'
            '        reales estan en vocabulario.data.json, seccion denominacion.')

    for donde, txt in campos:
        for hallado, que in revisar_cocina(txt, datos):
            rojos.append(
                f'{op} {donde}: dice {que} -> "{hallado}".\n'
                '        Eso es mio, no del operario: va a la bitacora o al PDF de\n'
                '        pendientes, no impreso adelante suyo (Fak, 21/09/2026).')

    for i, pie in enumerate(hoja.get("pies") or [], 1):
        v = revisar_pie(pie, datos)
        if v:
            rojos.append(
                f'{op} pie {i} narra un movimiento ("{v}"): "{pie}".\n'
                '        Un fotograma es un instante: no puede mostrar que algo se mueve.\n'
                '        El pie NOMBRA lo que se ve; lo que pasa va en el paso.')

    for i, paso in enumerate(hoja.get("pasos") or [], 1):
        estado, det = revisar_voz(paso)
        if estado == "narrativo":
            rojos.append(f"{op} paso {i} describe en vez de mandar (arranca con \"{det}\").\n"
                         f"        \"{str(paso)[:90]}\"\n"
                         f"        Un paso arranca con el verbo de lo que hace EL OPERARIO "
                         f"(canon 4.4). Fak 21/09: \"no me explicas que debo hacer yo\".")
        elif estado == "verbo_nuevo":
            avisos.append(f"{op} paso {i}: \"{det}\" parece un verbo pero no esta en la lista "
                          f"canonica de redaccion.py. Si es correcto, agregarlo mirando una "
                          f"hoja real de Barack.")

    for a in avisos:
        print(f"  aviso  {a}")
    if rojos:
        print("\n  LA HOJA NO SE PUEDE IMPRIMIR ASI:")
        for r in rojos:
            print(f"    - {r}")
        raise SystemExit(1)
    return True


def _cli():
    if len(sys.argv) >= 3 and sys.argv[1] == "texto":
        txt = " ".join(sys.argv[2:])
        h = revisar_vocabulario(txt)
        estado, det = revisar_voz(txt)
        for hallado, reemplazo, motivo, fuente in h:
            print(f"  vocabulario: \"{hallado}\" -> \"{reemplazo}\"  ({motivo})")
        print(f"  voz: {estado} ({det})")
        return 1 if (h or estado == "narrativo") else 0
    if len(sys.argv) == 4 and sys.argv[1] == "spec":
        import importlib.util
        ruta, nombre = sys.argv[2], sys.argv[3]
        spec = importlib.util.spec_from_file_location("_spec", ruta)
        mod = importlib.util.module_from_spec(spec)
        sys.modules["_spec"] = mod
        spec.loader.exec_module(mod)
        malas = 0
        for hoja in getattr(mod, nombre):
            try:
                gate_redaccion(hoja)
                print(f"  ok    {hoja.get('op')}  {hoja.get('denominacion', '')[:50]}")
            except SystemExit:
                malas += 1
        print(f"\n{malas} hojas no pasan la redaccion.")
        return 1 if malas else 0
    print(__doc__)
    return 2


if __name__ == "__main__":
    # la consola de Windows viene en cp1252 y los pasos citan serigrafia china
    for _f in (sys.stdout, sys.stderr):
        try:
            _f.reconfigure(encoding="utf-8", errors="replace")
        except Exception:
            pass
    sys.exit(_cli())
