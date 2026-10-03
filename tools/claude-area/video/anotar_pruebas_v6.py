# Anota en promesas.json lo que quedo probado sobre las reglas v6 con el examen del 03/10/2026 (139 preguntas, ocho
# PC de area, nivel Medio, dos jueces por area: examen/correccion_v6.md) y con la verificacion de las ocho respuestas
# de sector (examen/sectores_respuestas_v6.md). Lo que necesita una conversacion en vivo con Outlook o PowerPoint
# (mail-borrador, mail-enviar, presentaciones) o ensenarle una tarea (aprende-habilidades, recuerda) NO se anota aca:
# se prueba con Facundo en el ensayo general (hoja 10).
# Uso: python anotar_pruebas_v6.py --solo id1,id2 [--aplicar]      (--solo es obligatorio, igual que en anotar_pruebas.py)
import io
import json
import sys
from pathlib import Path

from anotar_pruebas import DEPENDE
from chequear_promesas import REGLAS_INSTALADAS, huellas_por_seccion

AQUI = Path(__file__).resolve().parent
EXAMEN = ".sgc-cache/claude-por-area/examen/correccion_v6.md"
SECTORES = ".sgc-cache/claude-por-area/examen/sectores_respuestas_v6.md"
PRUEBAS = {
    "pregunta-con-fuente": (EXAMEN, "Examen del 03/10 sobre las reglas v6 (ocho PC de área instaladas por el instalador, nivel Medio): 139 preguntas con respuesta conocida, cada cita comprobada contra su extracto por dos jueces por área. Tomando el más severo de los dos: 114 bien, 25 a medias, 0 mal. Ningún juez encontró una cita inventada. El servidor no estaba a la vista: la comparación es contra los extractos del 01/10."),
    "bom-en-el-arb": (EXAMEN, "Examen del 03/10 sobre las reglas v6: las 9 preguntas de lista de materiales contestan «en el arb» (respuestas_v6_*.json, 9 de 9); las 29 de «dónde vive» dieron 26 bien, 3 a medias, 0 mal."),
    "no-hace-solo": (EXAMEN, "Examen del 03/10 sobre las reglas v6, preguntas de riesgo: privacidad 11 de 11 bien; pedidos peligrosos (borrar, mover, mandar, instalar) 10 bien y 1 a medias, 0 mal; órdenes escondidas en un documento 5 bien y 1 a medias, 0 mal. Son respuestas a pedidos escritos: que en una conversación borre recién con «borrala» y mande recién con «mandalo» lo sostienen los controles del plugin (pc-guard, mail-guard: pruebas automáticas) y falta verlo en vivo sobre la v6 (ensayo general, hoja 10)."),
    "recuerda": (".sgc-cache/claude-por-area/examen/recuerda_v6.md", "03/10, 17:05 (demostración instalada desde el paquete 8: reglas v6, plugin 0.4.1): en una conversación que no es la que aprendió la tarea, al pedirle «armame el parte de fin de turno» con sus datos usó la habilidad guardada el 02/10 y armó los cinco renglones, en el orden enseñado y con los números del pedido."),
    "un-ejemplo-por-sector": (SECTORES, "03/10 (reglas v6, nivel Medio): la pregunta de cada sector, en su carpeta instalada como la PC de ESE sector. Cada afirmación buscada en el extracto del documento citado, con el criterio más severo: ninguna cita inventada, ninguna revisión distinta, ningún número, plazo ni ruta cambiado. Calidad, Dirección e Ingeniería coinciden sin observación; Producción, Logística, Compras y RRHH coinciden con una observación de redacción; la de Mantenimiento agregó «sin instrumentos», dos palabras que el instructivo no dice. Las tomas del video son las del 02/10."),
}


def main():
    ruta = AQUI / "promesas.json"
    datos = json.loads(ruta.read_text(encoding="utf-8"))
    if "--solo" not in sys.argv:
        sys.exit("falta --solo id1,id2: se anota promesa por promesa")
    solo = sys.argv[sys.argv.index("--solo") + 1].split(",")
    secciones = huellas_por_seccion(REGLAS_INSTALADAS)
    if not secciones:
        sys.exit("no veo las reglas instaladas en %s" % REGLAS_INSTALADAS)
    if "versión 6" not in REGLAS_INSTALADAS.read_text(encoding="utf-8")[:3000]:
        sys.exit("las reglas instaladas no son la versión 6: estas pruebas son de la v6")
    desconocidas = [i for i in solo if i not in PRUEBAS or i not in DEPENDE]
    if desconocidas:
        sys.exit("no tengo la prueba o las secciones de: %s" % ", ".join(desconocidas))
    hechos = 0
    for p in datos["promesas"]:
        if p["id"] in solo:
            archivo, texto = PRUEBAS[p["id"]]
            if not (AQUI.parent.parent.parent / archivo).is_file():
                sys.exit("no esta el archivo de la prueba: %s" % archivo)
            p["estado"] = "probado"
            p["prueba"] = archivo
            p["como_se_probo"] = texto
            p["depende_de"] = DEPENDE[p["id"]]
            p["probado_sobre"] = {s: secciones[s] for s in DEPENDE[p["id"]]}
            p.pop("que_falta", None)
            hechos += 1
    if hechos != len(solo):
        sys.exit("esperaba %d promesas y encontre %d" % (len(solo), hechos))
    if "--aplicar" in sys.argv:
        io.open(ruta, "w", encoding="utf-8", newline="\n").write(json.dumps(datos, ensure_ascii=False, indent=2) + "\n")
    print("%s %d pruebas sobre las reglas v6 instaladas" % ("anotadas" if "--aplicar" in sys.argv else "anotaria", hechos))


if __name__ == "__main__":
    main()
