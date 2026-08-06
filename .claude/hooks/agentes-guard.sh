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
#   Agent / Task       -> maximo LIMITE spawns por ventana de VENTANA_SEG.
#
# Escape para Fak (no hace falta editar este script):
#   echo 12 > ~/.claude/.agent-limit          # sube el techo a 12
#   echo 0  > ~/.claude/.agent-limit          # 0 = sin limite (desactiva el guard)
#   touch ~/.claude/.workflow-ok              # permite UN Workflow (se consume al usarlo)
#
# Salida: exit 2 = bloquea la tool call y manda stderr a Claude como feedback.

set -uo pipefail

LIMITE_DEFAULT=5
VENTANA_SEG=600          # 10 min — una ventana de trabajo real

BASE="${HOME}/.claude"
LOG="${BASE}/.agent-spawns.log"
ARCHIVO_LIMITE="${BASE}/.agent-limit"
PASE_WORKFLOW="${BASE}/.workflow-ok"

mkdir -p "$BASE" 2>/dev/null

INPUT=$(cat)

# tool_name del payload. Si no se puede leer, asumimos que ES un spawn (fallar bloqueando:
# el matcher ya garantiza que solo llegan Agent|Task|Workflow).
TOOL=$(printf '%s' "$INPUT" \
  | tr -d '\n' \
  | sed -n 's/.*"tool_name"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' \
  | head -1)
[ -z "$TOOL" ] && TOOL="Agent"

# Techo configurable sin tocar codigo
LIMITE="$LIMITE_DEFAULT"
if [ -f "$ARCHIVO_LIMITE" ]; then
  L=$(tr -cd '0-9' < "$ARCHIVO_LIMITE" | head -c 4)
  [ -n "$L" ] && LIMITE="$L"
fi

# Limite 0 = guard desactivado a proposito por Fak
[ "$LIMITE" = "0" ] && exit 0

AHORA=$(date +%s)

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
  2. Si de verdad no sabes DONDE mirar: hasta 5 llamadas a Agent, contadas y explicitas.
  3. Si hace falta un Workflow de verdad: pediselo a Fak y que habilite el pase:
        touch ~/.claude/.workflow-ok
     Antes de pedirlo, decile el numero REAL de agentes = fase1 + (hallazgos x verificadores).
EOF
  exit 2
fi

# ---------------------------------------------------------------- Agent/Task: ventana deslizante
CORTE=$((AHORA - VENTANA_SEG))
if [ -f "$LOG" ]; then
  awk -v c="$CORTE" '$1+0 >= c' "$LOG" > "${LOG}.tmp" 2>/dev/null && mv "${LOG}.tmp" "$LOG"
else
  : > "$LOG"
fi

USADOS=$(wc -l < "$LOG" 2>/dev/null | tr -d ' ')
[ -z "$USADOS" ] && USADOS=0

if [ "$USADOS" -ge "$LIMITE" ]; then
  MIN=$((VENTANA_SEG / 60))
  ANTIGUO=$(head -1 "$LOG" 2>/dev/null | awk '{print $1}')
  ESPERA="?"
  if [ -n "$ANTIGUO" ]; then
    ESPERA=$(( (ANTIGUO + VENTANA_SEG - AHORA) / 60 + 1 ))
  fi
  cat >&2 <<EOF
BLOQUEADO: techo de subagentes alcanzado ($USADOS/$LIMITE en los ultimos $MIN minutos).

Este techo lo puso Fak el 2026-08-06 despues de que 40 subagentes le consumieran el
limite de uso y lo dejaran 4 horas sin poder trabajar. No es una sugerencia.

NO reintentes ni reformules la llamada. Lo que corresponde:
  - Hace el trabajo vos, directo. Si ya identificaste el archivo o la query, leelo.
    El fan-out casi nunca gana contra 10 lecturas dirigidas.
  - Si te faltan agentes para algo realmente ancho: esperá ~$ESPERA min, o decile a Fak
    que suba el techo:   echo 8 > ~/.claude/.agent-limit
  - Reportale a Fak que llegaste al techo y por que lo necesitabas. No lo escondas.
EOF
  exit 2
fi

# Permitido: registrar el spawn
printf '%s %s\n' "$AHORA" "$TOOL" >> "$LOG"
exit 0
