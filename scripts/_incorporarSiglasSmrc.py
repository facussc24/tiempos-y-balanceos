# -*- coding: utf-8 -*-
"""_incorporarSiglasSmrc.py — incorpora la simbologia de SMRC / Stellantis al canon.

Pedido de Fak, 21/09/2026: *"no no usa las del cliente por favor... incorporalas a nuestro
canon porque las vamos a volver a utilizar, son las oficiales de SMRC"* y *"cuando el cliente
tiene, hay que usar las del cliente"*.

QUE SIGLAS SON Y DE DONDE SALEN
Leidas celda por celda el 21/09/2026 en `P21 ARMREST_SSRT MY2026_LSC_v1.xlsx`, hoja LSC,
bloque "Customers / marking of SC" (fila 4), con la clave en las filas 8 y 10:

    columna K  ->  ( S )  ->  <cc/s>   critica de SEGURIDAD
    columna L  ->  ( H )  ->  <cc/h>   critica de HOMOLOGACION
    columna M  ->  ( M )  ->  <sc/f>   significativa FUNCIONAL

SMRC parte la critica en DOS marcas. Colapsarlas en nuestra CC pierde la distincion que el
cliente hizo a proposito, y ademas IATF 16949 §8.3.3.3 d) pide que, si se usan simbolos
propios equivalentes, exista una TABLA DE CONVERSION presentable al cliente. Por eso ademas
de las siglas se carga la tabla.

Uso:  py -3 scripts/_incorporarSiglasSmrc.py           (dry-run: muestra el diff)
      py -3 scripts/_incorporarSiglasSmrc.py --apply   (escribe)
"""
import json
import sys

sys.stdout.reconfigure(encoding="utf-8")

APPLY = "--apply" in sys.argv
CANON = "core/amfe/caracteristicasEspeciales.data.json"

with open(CANON, encoding="utf-8") as fh:
    d = json.load(fh)

antes = json.dumps(d, ensure_ascii=False, sort_keys=True)
cambios = []

# --- 1. aliases: que el validador las reconozca -----------------------------
# normalizarSigla() pasa a MAYUSCULAS y colapsa los espacios de la barra, asi que
# el alias se guarda como lo va a ver el validador: "cc/s" -> "CC/S".
for nivel, nuevas in (("CRITICA", ["CC/S", "CC/H"]), ("SIGNIFICATIVA", ["SC/F"])):
    for s in nuevas:
        if s not in d["aliases"][nivel]:
            d["aliases"][nivel].append(s)
            cambios.append(f"aliases.{nivel} += {s}")

# --- 2. simbologia por destinatario -----------------------------------------
if "SMRC" not in d["simbologia"]:
    d["simbologia"]["SMRC"] = {
        "CRITICA": "cc/h",
        "SIGNIFICATIVA": "sc/f",
        "SEGURIDAD_OPERADOR": "OS",
        "ALTO_IMPACTO": "HI",
    }
    cambios.append("simbologia.SMRC (nueva)")

d["simbologia_comentario"] = (
    "Para VW la critica se escribe D/TLD (Formel Q pag. 28 §7.5: D y TLD son UNA marca, mismo "
    "rango; CSR VW 'parts with D/TLD-marking') y la significativa SC. Para SMRC / Stellantis la "
    "critica se PARTE EN DOS: <cc/s> cuando el motivo es SEGURIDAD y <cc/h> cuando es "
    "HOMOLOGACION; la significativa funcional es <sc/f>. En simbologia.SMRC la CRITICA figura "
    "como cc/h porque es la mayoritaria, pero la sigla correcta de cada caracteristica la dice "
    "el LSC del cliente columna por columna: no se elige por defecto. La tabla completa, con el "
    "equivalente interno, esta en tabla_conversion."
)

# --- 3. tabla de conversion (la que pide IATF 16949 §8.3.3.3 d) --------------
d["tabla_conversion"] = {
    "_comentario": (
        "Tabla de conversion de simbolos exigida por IATF 16949 §8.3.3.3 d): si la organizacion "
        "usa simbolos propios en lugar de los del cliente, la equivalencia tiene que estar "
        "definida y ser presentable al cliente. Se carga una entrada por cada cliente que tenga "
        "simbologia propia, la primera vez que aparece."
    ),
    "SMRC": {
        "fuente": "P21 ARMREST_SSRT MY2026_LSC_v1.xlsx, hoja LSC, bloque 'Customers / marking of SC' (fila 4), clave en las filas 8 y 10; leido el 21/09/2026",
        "marcas": [
            {"cliente": "cc/s", "columna_lsc": "K", "clave_lsc": "( S )", "nivel": "CRITICA",
             "significa": "caracteristica critica de SEGURIDAD", "equivalente_interno": "CC"},
            {"cliente": "cc/h", "columna_lsc": "L", "clave_lsc": "( H )", "nivel": "CRITICA",
             "significa": "caracteristica critica de HOMOLOGACION", "equivalente_interno": "CC"},
            {"cliente": "sc/f", "columna_lsc": "M", "clave_lsc": "( M )", "nivel": "SIGNIFICATIVA",
             "significa": "caracteristica significativa FUNCIONAL", "equivalente_interno": "SC"},
        ],
    },
    "VW": {
        "fuente": "Formel Q Capacidad de Calidad 8a ed. pag. 28 §7.5 y pag. 35; CSR VW IATF 2018 §8.3.3.3",
        "marcas": [
            {"cliente": "D/TLD", "nivel": "CRITICA",
             "significa": "documentacion obligatoria legal (D y TLD son la misma marca)",
             "equivalente_interno": "CC"},
            {"cliente": "SC", "nivel": "SIGNIFICATIVA",
             "significa": "VW no tiene sigla propia de significativa: el proveedor nombra la suya",
             "equivalente_interno": "SC"},
        ],
    },
}
cambios.append("tabla_conversion (nueva, con SMRC y VW)")

# --- 4. de donde sale cada sigla --------------------------------------------
for sigla, fuente in (
    ("cc/s", "simbologia SMRC / Stellantis — LSC v1 del cliente, columna K ('( S )', <cc/s>): critica de SEGURIDAD"),
    ("cc/h", "simbologia SMRC / Stellantis — LSC v1 del cliente, columna L ('( H )', <cc/h>): critica de HOMOLOGACION"),
    ("sc/f", "simbologia SMRC / Stellantis — LSC v1 del cliente, columna M ('( M )', <sc/f>): significativa FUNCIONAL"),
):
    if sigla not in d["fuente_por_sigla"]:
        d["fuente_por_sigla"][sigla] = fuente
        cambios.append(f"fuente_por_sigla.{sigla}")

# --- 5. la fuente, en la lista de fuentes -----------------------------------
ya = any("LSC" in json.dumps(f, ensure_ascii=False) for f in d["fuentes"])
if not ya:
    d["fuentes"].append({
        "doc": "P21 ARMREST_SSRT MY2026_LSC_v1.xlsx — List of Special Characteristics de SMRC / Stellantis (10/07/2026, G. Medina)",
        "paginas": "hoja LSC, filas 4 a 35, columnas K / L / M",
        "dice": "El cliente designa cada caracteristica una por una en tres columnas: K '( S )' = <cc/s> critica de seguridad, L '( H )' = <cc/h> critica de homologacion, M '( M )' = <sc/f> significativa funcional. En el P21 hilo naranja el reparto es 3 cc/s, 15 cc/h y 1 sc/f.",
    })
    cambios.append("fuentes += LSC v1 de SMRC")

# --- 6. la regla permanente que pidio Fak -----------------------------------
NUEVAS_REGLAS = [
    "Cuando el cliente TIENE su propia simbologia, en el documento que va a ese cliente se escribe la del CLIENTE, no la nuestra. Lo dice el propio I-AC-005 ('sera utilizada la simbologia especificada por el Cliente cuando el mismo asi lo requiera') y lo exige IATF 16949 §8.3.3.3 d). Fak, 21/09/2026: 'cuando el cliente tiene, hay que usar las del cliente'.",
    "La primera vez que aparece la simbologia de un cliente nuevo se INCORPORA A ESTE CANON en la misma sesion, con su fuente y su equivalente interno en tabla_conversion. Nunca se traduce en silencio a la nuestra ni se deja caer en SIGLA_DESCONOCIDA. Fak, 21/09/2026: 'incorporalas a nuestro canon porque las vamos a volver a utilizar'. Incorporar una sigla NO es asignarla: asignar sigue siendo de Fak o del cliente.",
    "Un cliente puede partir un nivel en varias marcas (SMRC parte la critica en <cc/s> seguridad y <cc/h> homologacion). Esa distincion NO se colapsa: se escribe la marca exacta que el cliente designo caracteristica por caracteristica, y la equivalencia con nuestro nivel vive en tabla_conversion.",
]
for r in NUEVAS_REGLAS:
    if r not in d["regla_operativa"]:
        d["regla_operativa"].append(r)
        cambios.append("regla_operativa += " + r[:58] + "...")

# --- resultado ---------------------------------------------------------------
print("CAMBIOS:")
for c in cambios:
    print("   -", c)
print(f"\ntotal: {len(cambios)}")
print(f"tamano: {len(antes)} -> {len(json.dumps(d, ensure_ascii=False, sort_keys=True))} caracteres")

if not APPLY:
    print("\nDRY-RUN. Corre con --apply para escribir.")
else:
    with open(CANON, "w", encoding="utf-8", newline="\n") as fh:
        json.dump(d, fh, ensure_ascii=False, indent=2)
        fh.write("\n")
    # relectura de control
    with open(CANON, encoding="utf-8") as fh:
        v = json.load(fh)
    print("\nGUARDADO. Relectura de control:")
    print("   aliases.CRITICA      =", v["aliases"]["CRITICA"])
    print("   aliases.SIGNIFICATIVA=", v["aliases"]["SIGNIFICATIVA"])
    print("   simbologia.SMRC      =", v["simbologia"]["SMRC"])
    print("   tabla_conversion     =", list(v["tabla_conversion"]))
    print("   regla_operativa      =", len(v["regla_operativa"]), "reglas")
