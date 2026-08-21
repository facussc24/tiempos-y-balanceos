#!/usr/bin/env bash
# Guardian PreToolUse — bloquea RECONSTRUCCIONES CAUSALES de errores ajenos sin fuente.
#
# INCIDENTE (21/08/2026): escribi en memoria, como hecho establecido, que un consumo de
# 15 g/pieza "salia de leer el numero del codigo AD-ADFA15". No tenia ninguna fuente: era una
# historia causal armada sobre una coincidencia numerica. Despues esa frase se cito a si misma
# en sesiones siguientes y se endurecio en "hecho conocido", y termino ganandole a una
# correccion verbal de Fak. Fak: "deja de asumir cosas me molesta... ya te lo dije... es una
# gran fantasia tuya... estoy cansado de que digas todo eso".
#
# CAUSA RAIZ: `core-prohibiciones.md` §1 prohibe inventar DATOS (pesos, tolerancias, part
# numbers) y ese filtro funciona. No se activa con las EXPLICACIONES: decir "confundieron X
# con Y" se siente analisis, no invento. Es lo mismo — un mecanismo causal es una afirmacion
# sobre el mundo y necesita evidencia igual que un numero. Y ademas acusa por implicacion a
# una persona real de Barack.
#
# QUE HACE: si se esta escribiendo una memoria, una regla o LECCIONES_APRENDIDAS y aparece una
# frase del genero prohibido SIN marcador de fuente ni de hipotesis cerca, corta con exit 2.
# Describir el ESTADO ("el doc dice A, el envase dice B") pasa siempre: lo que se bloquea es
# narrar COMO se llego.
set -uo pipefail

FILE="${HOOK_FILE:-}"
CONTENT="${HOOK_PARSED4:-}"

# Sin las variables del despachador, parsea solo (camino lento pero correcto).
if [ -z "${HOOK_FILE+x}" ]; then
  INPUT=$(cat)
  FILE=$(printf '%s' "$INPUT" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{console.log(JSON.parse(s)?.tool_input?.file_path??"")}catch{console.log("")}})' 2>/dev/null)
  CONTENT=$(printf '%s' "$INPUT" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{const t=JSON.parse(s)?.tool_input||{};console.log(String(t.content??t.new_string??""))}catch{console.log("")}})' 2>/dev/null)
fi

[ -z "$FILE" ] && exit 0

# GATE 1 (barato, puro bash): solo los archivos donde una especulacion se vuelve permanente.
case "$FILE" in
  */memory/*.md|*MEMORY.md|*LECCIONES_APRENDIDAS.md|*/.claude/rules/*.md) : ;;
  *) exit 0 ;;
esac

# El archivo que DOCUMENTA la regla cita las frases como ejemplos: no puede autobloquearse.
case "$FILE" in
  *no_inventar_causas_de_errores_ajenos.md|*causas-ajenas-guard*) exit 0 ;;
esac

[ -z "$CONTENT" ] && exit 0

# GATE 2: lista CANONICA de frases, no regex parcial (leccion `heuristicas_lista_canonica`).
# Se mira una ventana alrededor del match: si ahi hay fuente o el hedge esta declarado, pasa.
printf '%s' "$CONTENT" | python -c '
import re, sys
txt = sys.stdin.read()

GENERO = [
  r"se comi[oó] (?:la coma|el \d)",
  r"nadie (?:recalcul|revis|declar|convirti|renegoci|avis|not)",
  r"alguien (?:lo )?(?:copi|edit|aplic|retipe|carg|puso|ley)",
  r"confundi(?:o|ó|eron)",
  r"l[oa]s? leyeron mal|leerlo mal|invita a leer",
  r"sale de leer|copiado plano",
  r"nunca se (?:le )?comunic",
  r"sin que nadie",
]
# Marcadores que convierten la frase en legitima: una FUENTE, o una HIPOTESIS declarada.
OK = re.compile(
  r"fuente|mail del|mail de|textual|dijo|dice el|segun|hilo |PROHIBIDO|ejemplo|"
  r"hipotesis|hipótesis|probablemente|posiblemente|puede ser|no verificado|no consta|"
  r"sin registro|TBD|\bcita\b", re.I)

malas = []
for pat in GENERO:
    for m in re.finditer(pat, txt, re.I):
        ini, fin = max(0, m.start()-300), min(len(txt), m.end()+300)
        if not OK.search(txt[ini:fin]):
            malas.append(m.group(0))

if malas:
    print("|".join(dict.fromkeys(malas))[:200])
    sys.exit(1)
' > /tmp/causas_ajenas.$$ 2>/dev/null
RC=$?
HITS=$(cat /tmp/causas_ajenas.$$ 2>/dev/null); rm -f /tmp/causas_ajenas.$$

[ "$RC" -ne 1 ] && exit 0

cat >&2 <<EOF
[CAUSAS-AJENAS-GUARD] Estas por escribir una RECONSTRUCCION de como se equivoco un tercero,
sin fuente al lado. Frase(s): ${HITS}

Regla core-prohibiciones §1: inventar incluye las EXPLICACIONES CAUSALES, no solo los numeros.
Incidente 21/08/2026 — Fak: "es una gran fantasia tuya".

Como se arregla:
  - Escribi el ESTADO, no el mecanismo:  "la BOM dice 18 KG y la etiqueta dice 15 Kg"
    en vez de  "confundieron litros con kilos".
  - Si tenes la fuente, citala en la misma frase: "mail del 11/12/2025", "fuente: FT120".
  - Si es una inferencia, marcala: "probablemente", "no consta", "sin registro", "TBD".
  - Una coincidencia numerica NO es una fuente.
EOF
exit 2
