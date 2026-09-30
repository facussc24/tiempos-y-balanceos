#!/usr/bin/env bash
# agentes-guard.sh — TECHO DURO de subagentes. PreToolUse, matcher: Agent|Task|Workflow
#
# Origen: 2026-08-06. Un Workflow disparo 40 subagentes y consumio el limite de uso de
# Fak; quedo 4 horas sin poder trabajar. Ya habia pasado el 2026-08-03 (21 y despues 28
# agentes) y la "regla" que salio de ahi vivio solo como texto en memoria/LECCIONES.
# Texto no frena nada. Esto si: bloquea la llamada antes de que salga.
#
# Reglas:
#   Workflow           -> DENEGADO siempre. Es un script que multiplica agentes sin que
#                         nadie vea la cuenta (cap por fase != cap total). Ese fue el bug.
#   Agent / Task       -> maximo LIMITE spawns por ventana de VENTANA_SEG (10 desde el 30/09/2026).
#                         Y SIEMPRE Sonnet 5.5 con esfuerzo xhigh, el anteultimo (Fak, 30/09/2026):
#                         pasa solo un subagent_type cuya definicion (en <proyecto>/.claude/agents
#                         o ~/.claude/agents) diga `model: sonnet` y `effort: xhigh`. Los built-in
#                         (general-purpose, Explore, Plan, claude...) no dejan fijar el esfuerzo y
#                         `fork` corre en el modelo de la sesion: se rechazan y se usa `investigador`
#                         (todas las herramientas) o `explorador` (solo lectura), en ~/.claude/agents.
#                         EXCEPCION: la auditoria final (`auditor`, `auditor-cliente`) corre en OPUS
#                         con effort xhigh (Fak, 30/09/2026); ver AUDITORES mas abajo.
#
# Escape para Fak (no hace falta editar este script):
#   echo 15 > ~/.claude/.agent-limit          # sube el techo a 15
#   echo 0  > ~/.claude/.agent-limit          # 0 = sin limite (apaga el CONTEO)
#   touch ~/.claude/.workflow-ok              # permite UN Workflow (se consume al usarlo)
# La regla de modelo y esfuerzo no tiene escape: el `echo 0` apaga el conteo, no esa regla.
#
# El override VENCE a las 12 horas (A6, 10/09/2026): se respeta solo si el archivo tiene menos
# de VENCE_SEG desde su ultima modificacion; pasado eso se retira y vuelve el techo de 10 solo.
# Un `echo 0` de otro dia no puede seguir apagando el guard en silencio. Cuando Fak lo pide
# TEXTUAL en el chat ("usa agentes en paralelo", "no me importa gastar tokens"), Claude lo
# escribe por el (Fak no corre comandos) y lo dice; sin esa frase de Fak, no se toca.
#
# Velocidad (30/09/2026): el camino normal no abre NINGUN programa externo (ni grep, sed, awk,
# date, tr, wc ni cat): todo con builtins de bash. Con la PC cargada cada proceso tardaba ~1 s
# y el hook llego a 12 s por llamada.
#
# Salida: exit 2 = bloquea la tool call y manda stderr a Claude como feedback.

set -uo pipefail

LIMITE_DEFAULT=10        # Fak, 30/09/2026 (era 5 desde el 06/08)
VENTANA_SEG=600          # 10 min — una ventana de trabajo real
VENCE_SEG=43200          # 12 h — vida util de ~/.claude/.agent-limit

BASE="${HOME}/.claude"
LOG="${BASE}/.agent-spawns.log"
ARCHIVO_LIMITE="${BASE}/.agent-limit"
PASE_WORKFLOW="${BASE}/.workflow-ok"
PASE_BUILTIN="${BASE}/.agent-builtin-ok"

[ -d "$BASE" ] || mkdir -p "$BASE" 2>/dev/null

INPUT=""
IFS= read -r -d '' INPUT || true
PLANO=${INPUT//$'\n'/}
PLANO=${PLANO//$'\r'/}

# Valor de un campo "clave":"valor" del payload, en $CAMPO. Adentro del prompt las comillas
# vienen escapadas (\"), asi que un "subagent_type" citado en el texto del prompt no matchea.
campo() {
  local re="\"$1\"[[:space:]]*:[[:space:]]*\"([^\"]*)\""
  if [[ $PLANO =~ $re ]]; then CAMPO=${BASH_REMATCH[1]}; else CAMPO=""; fi
}

# tool_name del payload. Si no se puede leer, asumimos que ES un spawn (fallar bloqueando:
# el matcher ya garantiza que solo llegan Agent|Task|Workflow).
campo tool_name; TOOL=$CAMPO
[ -z "$TOOL" ] && TOOL="Agent"

printf -v AHORA '%(%s)T' -1

# Techo configurable sin tocar codigo — con vencimiento (12 h desde la ultima modificacion).
# Si `stat` no puede leer la fecha, se respeta el archivo como antes (fallar abierto aca es
# respetar lo que Fak escribio, no aflojar el techo).
LIMITE="$LIMITE_DEFAULT"
if [ -f "$ARCHIVO_LIMITE" ]; then
  MOD=$(stat -c %Y "$ARCHIVO_LIMITE" 2>/dev/null || echo 0)
  if [ "$MOD" -gt 0 ] 2>/dev/null && [ $((AHORA - MOD)) -gt "$VENCE_SEG" ]; then
    rm -f "$ARCHIVO_LIMITE"
    echo "agentes-guard: el override ~/.claude/.agent-limit tenia mas de 12 h y se retiro; techo de vuelta en $LIMITE_DEFAULT." >&2
  else
    L=""
    IFS= read -r L < "$ARCHIVO_LIMITE" || true
    L=${L//[^0-9]/}
    L=${L:0:4}
    [ -n "$L" ] && LIMITE="$L"
  fi
fi

# ---------------------------------------------------------------- Agent/Task: Sonnet 5.5 en xhigh
# Va ANTES del conteo (una llamada rechazada no gasta cupo) y antes del escape `.agent-limit=0`.
RE_SEP='^---[[:space:]]*$'

# Valor de una linea "clave: valor" sin comillas ni espacios; lo deja en la variable $2.
valor() {
  local v=$1
  v=${v//\"/}
  v=${v//\'/}
  v=${v#"${v%%[![:space:]]*}"}
  v=${v%%[[:space:]]*}
  printf -v "$2" '%s' "$v"
}

# Frontmatter de una definicion de agente (entre el primer --- y el segundo) -> D_NOMBRE,
# D_MODELO, D_ESFUERZO. Deja de leer en el cierre del frontmatter.
leer_def() {
  D_NOMBRE=""; D_MODELO=""; D_ESFUERZO=""
  local l n=0
  while IFS= read -r l || [ -n "$l" ]; do
    l=${l%$'\r'}
    n=$((n + 1))
    if [ "$n" -eq 1 ]; then [[ $l =~ $RE_SEP ]] || return 0; continue; fi
    [[ $l =~ $RE_SEP ]] && return 0
    case "$l" in
      name:*)   valor "${l#name:}" D_NOMBRE ;;
      model:*)  valor "${l#model:}" D_MODELO ;;
      effort:*) valor "${l#effort:}" D_ESFUERZO ;;
    esac
  done < "$1"
}

rechazar() {
  cat >&2 <<EOF
BLOQUEADO: los subagentes corren en Sonnet 5.5 con esfuerzo xhigh, y la auditoria final
(auditor, auditor-cliente) en Opus con xhigh (Fak, 30/09/2026).
$1

Que hacer: relanzar con subagent_type "investigador" (todas las herramientas) o "explorador"
(solo lectura); los dos viven en ~/.claude/agents con model: sonnet y effort: xhigh. Un agente
propio pasa si su definicion dice esas dos lineas. Excepcion: `auditor` y `auditor-cliente` van en opus.
EOF
  exit 2
}

# La auditoria final la hace OPUS, no Sonnet (Fak, 30/09/2026: "la auditoria la deberia hacer un
# Opus... es la auditoria final, Sonnet no se si puede hacerla"). Estos agentes DEBEN declarar
# `model: opus` (y effort: xhigh); el resto, `model: sonnet`.
AUDITORES=" auditor auditor-cliente "

if [ "$TOOL" != "Workflow" ]; then
  campo subagent_type; SUBTIPO=$CAMPO
  campo model; MODELO=$CAMPO
  [ -z "$SUBTIPO" ] && rechazar "La llamada no dice subagent_type: correria general-purpose, que no deja fijar el esfuerzo."
  [ "$SUBTIPO" = "fork" ] && rechazar "Un fork corre en el modelo de la sesion principal, no en Sonnet."
  ES_AUDITOR=0
  case "$AUDITORES" in *" $SUBTIPO "*) ES_AUDITOR=1 ;; esac
  if [ "$ES_AUDITOR" = "1" ]; then
    case "$MODELO" in
      ""|opus|claude-opus-*) ;;
      *) rechazar "\"$SUBTIPO\" es la auditoria final y corre en Opus: no se le pasa model=$MODELO." ;;
    esac
  else
    case "$MODELO" in
      ""|sonnet|claude-sonnet-*) ;;
      *) rechazar "Se pidio model=$MODELO." ;;
    esac
  fi

  DEF=""
  for DIR in "${CLAUDE_PROJECT_DIR:+${CLAUDE_PROJECT_DIR}/.claude/agents}" "${BASE}/agents"; do
    [ -n "$DIR" ] && [ -d "$DIR" ] || continue
    for F in "$DIR"/*.md; do
      [ -f "$F" ] || continue
      leer_def "$F"
      if [ "$D_NOMBRE" = "$SUBTIPO" ]; then DEF="$F"; break 2; fi
    done
  done

  if [ -n "$DEF" ] && [ "$ES_AUDITOR" = "1" ]; then
    case "$D_MODELO" in
      opus|claude-opus-*) ;;
      *) rechazar "La definicion $DEF no dice model: opus (la auditoria final la hace Opus)." ;;
    esac
    [ "$D_ESFUERZO" = "xhigh" ] || rechazar "La definicion $DEF no dice effort: xhigh."
  elif [ -n "$DEF" ]; then
    case "$D_MODELO" in
      sonnet|claude-sonnet-*) ;;
      *) rechazar "La definicion $DEF no dice model: sonnet." ;;
    esac
    [ "$D_ESFUERZO" = "xhigh" ] || rechazar "La definicion $DEF no dice effort: xhigh."
  else
    # Pase de UNA sesion para los built-in: ~/.claude/.agent-builtin-ok con el session_id adentro.
    # Existe porque un agente nuevo de ~/.claude/agents puede tardar en cargar en la sesion donde
    # se crea. Lo escribe Claude solo si la sesion corre en xhigh (el built-in hereda ese
    # esfuerzo), lo dice y lo retira al cerrar; exige model sonnet EXPLICITO. Otra sesion no lo usa.
    campo session_id; SESION=$CAMPO
    PASE=""
    if [ -f "$PASE_BUILTIN" ]; then IFS= read -r PASE < "$PASE_BUILTIN" || true; fi
    PASE=${PASE//[[:space:]]/}
    if [ -n "$SESION" ] && [ "$PASE" = "$SESION" ]; then
      case "$MODELO" in
        sonnet|claude-sonnet-*) ;;
        *) rechazar "Con el pase de sesion, el built-in necesita model sonnet explicito en la llamada." ;;
      esac
    else
      rechazar "\"$SUBTIPO\" no tiene definicion propia (built-in o inexistente): no se le puede fijar modelo y esfuerzo."
    fi
  fi
fi

# Limite 0 = techo desactivado a proposito por Fak (por 12 h); la regla de arriba ya corrio
[ "$LIMITE" = "0" ] && exit 0

# ---------------------------------------------------------------- Workflow: denegado
if [ "$TOOL" = "Workflow" ]; then
  if [ -f "$PASE_WORKFLOW" ]; then
    rm -f "$PASE_WORKFLOW"          # pase de un solo uso
    exit 0
  fi
  cat >&2 <<'EOF'
BLOQUEADO: la tool Workflow esta deshabilitada en esta maquina.

Por que: el 2026-08-06 un Workflow lanzo 40 subagentes y consumio el limite de uso de
Fak (4 horas sin poder trabajar). El modo de fallo no fue "pedi demasiado": fue que el
script tenia un tope POR FASE (6 verificadores por fuente) y ninguno TOTAL, asi que
8 fuentes x 6 = 48. La cuenta nunca se hizo. Un Workflow esconde la multiplicacion.

Que hacer en su lugar, en este orden:
  1. Resolvelo vos. Si ya sabes QUE archivo/celda/tabla mirar, leelo directo. Casi
     siempre es mas rapido y el dato sale mas duro que fan-out.
  2. Si de verdad no sabes DONDE mirar: hasta 10 llamadas a Agent, contadas y explicitas.
  3. Si hace falta un Workflow de verdad: pediselo a Fak y que habilite el pase:
        touch ~/.claude/.workflow-ok
     Antes de pedirlo, decile el numero REAL de agentes = fase1 + (hallazgos x verificadores).
EOF
  exit 2
fi

# ---------------------------------------------------------------- Agent/Task: ventana deslizante
CORTE=$((AHORA - VENTANA_SEG))
USADOS=0
ANTIGUO=""
VIGENTES=""
if [ -f "$LOG" ]; then
  while IFS= read -r LINEA || [ -n "$LINEA" ]; do
    TS=${LINEA%% *}
    [[ $TS =~ ^[0-9]+$ ]] || continue
    if [ "$TS" -ge "$CORTE" ]; then
      VIGENTES+="$LINEA"$'\n'
      USADOS=$((USADOS + 1))
      [ -z "$ANTIGUO" ] && ANTIGUO=$TS
    fi
  done < "$LOG"
fi
printf '%s' "$VIGENTES" > "$LOG"

if [ "$USADOS" -ge "$LIMITE" ]; then
  MIN=$((VENTANA_SEG / 60))
  ESPERA="?"
  if [ -n "$ANTIGUO" ]; then
    ESPERA=$(( (ANTIGUO + VENTANA_SEG - AHORA) / 60 + 1 ))
  fi
  cat >&2 <<EOF
BLOQUEADO: techo de subagentes alcanzado ($USADOS/$LIMITE en los ultimos $MIN minutos).

Este techo lo puso Fak el 2026-08-06 despues de que 40 subagentes le consumieran el
limite de uso y lo dejaran 4 horas sin poder trabajar (el 30/09/2026 lo subio de 5 a 10,
en Sonnet). No es una sugerencia.

NO reintentes ni reformules la llamada. Lo que corresponde:
  - Hace el trabajo vos, directo. Si ya identificaste el archivo o la query, leelo.
    El fan-out casi nunca gana contra 10 lecturas dirigidas.
  - Si te faltan agentes para algo realmente ancho: espera ~$ESPERA min, o que Fak suba el
    techo:   echo 15 > ~/.claude/.agent-limit   (vale 12 h). Si Fak ya lo pidio TEXTUAL en el
    chat ("usa agentes en paralelo", "no me importa gastar tokens"), escribilo vos y decilo.
  - Reportale a Fak que llegaste al techo y por que lo necesitabas. No lo escondas.
EOF
  exit 2
fi

# Permitido: registrar el spawn
printf '%s %s\n' "$AHORA" "$TOOL" >> "$LOG"
exit 0
