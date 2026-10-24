#!/usr/bin/env bash
# agentes-guard.sh — TECHO DURO de subagentes. PreToolUse, matcher: Agent|Task|Workflow
#
# Origen: 2026-08-06. Un Workflow disparo 40 subagentes y consumio el limite de uso de
# Fak; quedo 4 horas sin poder trabajar. Ya habia pasado el 2026-08-03 (21 y despues 28
# agentes) y la "regla" que salio de ahi vivio solo como texto en memoria/LECCIONES.
# Texto no frena nada. Esto si: bloquea la llamada antes de que salga.
#
# Reglas:
#   Workflow           -> PRENDIDA (Fak, 16/10/2026; re-prendida el 24/10/2026) y con la regla de Agent. La llamada
#                         no trae model ni effort: van en cada agent() del guion. El LECTOR en node (al final de este
#                         archivo) lee el guion (script, el archivo de scriptPath o .claude/workflows/<name>.js, y UN
#                         nivel de workflow() anidado; nunca args ni description) y se rechaza un effort fuera de
#                         low|medium|high|xhigh (max nunca), un model que no existe, un agentType sin definicion propia
#                         que cumpla el piso, un valor armado con ${...} y un workflow() con argumento calculado.
#                         Descuenta UNA vez, con el modelo mas pesado del guion (model:, la definicion de su agentType,
#                         y Opus si algun agent() no declara ninguno: hereda el de la sesion). LIMITES: los agentes de
#                         ADENTRO no pasan por este hook (los contaba el mod presupuesto-agentes); el esfuerzo que
#                         heredan de la sesion, un valor en una variable (effort: E) y formas raras de un literal (un
#                         comentario entre clave y valor, una clave calculada) no se ven; una sesion Fable se cobra
#                         como Opus. Del 06/08 al 16/10 estuvo DENEGADA: un script multiplica agentes sin que nadie vea
#                         la cuenta (cap por fase != cap total). Apagarla: "disableWorkflows": true en ~/.claude/settings.json.
#   Agent / Task       -> maximo LIMITE spawns por ventana de VENTANA_SEG (10 desde el 30/09/2026).
#                         Pasa solo un subagent_type cuya definicion (en <proyecto>/.claude/agents o
#                         ~/.claude/agents) diga `model: sonnet` (el default) y `effort: xhigh`. Los
#                         built-in (general-purpose, Explore, Plan, claude...) no dejan fijar el esfuerzo
#                         y `fork` corre en el modelo de la sesion: se rechazan y se usa `investigador`
#                         (todas las herramientas) o `explorador` (solo lectura), en ~/.claude/agents.
#                         EXCEPCION: la auditoria final (`auditor`, `auditor-cliente`) corre en OPUS
#                         con effort xhigh (Fak, 30/09/2026); ver AUDITORES mas abajo.
#   MODELO POR TAREA (Fak, 08/10/2026: "es absurdo que solo se pueda usar Sonnet"; hasta ese dia la
#   regla era Sonnet siempre). La llamada elige el modelo segun el trabajo (regla techo-agentes.md):
#                         haiku  = buscar, leer, listar, extraer (barato; muchos en paralelo)
#                         sonnet = escribir, programar, analizar UNA fuente (default de la definicion)
#                         opus   = criterio, cruzar fuentes, decidir, auditar contenido
#                         fable  = revisor independiente de un cambio grande
#                         Opus y Fable son "pesados": hasta PESADOS_MAX por ventana (los auditores no
#                         cuentan). El esfuerzo lo fija la definicion (xhigh); la llamada puede bajarlo
#                         (low|medium|high) y NUNCA pedir max ("el anteultimo", Fak 30/09/2026).
#
# Escape para Fak (no hace falta editar este script):
#   echo 15 > ~/.claude/.agent-limit          # sube el techo a 15
#   echo 0  > ~/.claude/.agent-limit          # 0 = sin limite (apaga el CONTEO, tambien el de pesados)
#   touch ~/.claude/.agent-opus-ok            # 12 h: Opus y Fable descuentan como Sonnet (4); era el cupo de PESADOS_MAX
# La regla de esfuerzo (nunca max) no tiene pase: ningun archivo la saltea. El pase ~/.claude/.workflow-ok (un Workflow cuando estaba
# negada) se retiro el 24/10/2026: Workflow ya no se niega por ser Workflow.
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
#         exit 0 con JSON en stdout = la llamada PASA y el JSON lleva un AVISO (additionalContext)
#         que el modelo lee sin frenar. Hoy hay uno solo: «¿esto es buscar o decidir?» (P5 de la
#         cola, 10/10/2026): un Sonnet con un pedido de busqueda pasa igual, descuenta igual, y se
#         anota en ~/.claude/.agent-busquedas.log para medir cuantos eran busquedas (lo que H7 no
#         pudo contar a mano).

set -uo pipefail

LIMITE_DEFAULT=10        # Fak, 30/09/2026 (era 5 desde el 06/08). Desde el 08/10 se lee como "10 Sonnet": ver PESOS.
VENTANA_SEG=600          # 10 min — una ventana de trabajo real
VENCE_SEG=43200          # 12 h — vida util de ~/.claude/.agent-limit

# PRESUPUESTO POR COSTO (08/10/2026). Fak: "ese techo de 10 lo puse yo, ni siquiera se si es correcto... que nos
# optimicemos de entrada". Diez agentes iguales no cuestan lo mismo: por la tabla oficial de precios Haiku 5.5 sale
# $0.10/M de entrada, Sonnet 5.5 $2, Opus 5.5 $4 y Fable 5.1 $10 (08/10/2026). El techo pasa a ser un presupuesto
# en PUNTOS por ventana: el techo de LIMITE agentes vale LIMITE x PESO_SONNET puntos (10 -> 40), y cada llamada
# descuenta el peso de su modelo. Asi 40 busquedas en Haiku cuestan lo que 10 Sonnet o 5 Opus o 2 Fable.
PESO_HAIKU=1
PESO_SONNET=4
PESO_OPUS=8
PESO_FABLE=20
PESADOS_MAX=3            # (historico; ya no gobierna: el presupuesto por puntos lo reemplaza)

BASE="${HOME}/.claude"
LOG="${BASE}/.agent-spawns.log"
ARCHIVO_LIMITE="${BASE}/.agent-limit"
PASE_BUILTIN="${BASE}/.agent-builtin-ok"
LOG_BUSQUEDAS="${BASE}/.agent-busquedas.log"   # P5: "<epoch> <subagent_type> <palabra>" por Sonnet con pedido de busqueda

# P5 (A2b; Fak 09/10/2026 08:06 pregunto que agentes se usan y D1 #12 pidio contar cuantos Sonnet eran
# busquedas). Las palabras son las de las dos filas de la tabla de techo-agentes.md, en sus formas rioplatenses
# y de shell: BUSQUEDA = buscar, listar, leer, extraer un dato, contar, verificar un formato, traer una cita;
# TRABAJO = escribir, programar, ensayar, analizar, investigar, decidir, cruzar, auditar. Si el texto trae lo
# primero y nada de lo segundo, parece una busqueda. Es heuristica: por eso AVISA y no frena.
RE_BUSQUEDA='(busc(a|á|ar|ame|ate)|list(a|á|ar|ame)|lee(r|me|lo|la)|le(e|é) (el|la|los|las|qu)|extra(e|é|er|eme)|cont(a|á|ar|ame) (cu|los|las|qu)|verific(a|á|ar) (el|la|si|que)|tra(e|é)(me|r)? (el|la|un|una|los|las)|encontr|ubic(a|á|ar)|d(o|ó)nde (est|se|hay|qued)|grep|find |locate|solo lectura|sin modificar|no (modifiques|escribas|toques)|read.only|search|look for)'
RE_TRABAJO='(escrib|program|implement|arregl|corr(e|i)g|ensay|analiz|investig|decid|cruz(a|á|ar)|audit|redact|dise(ñ|n)(a|á|ar|o)|refactor|cre(a|á)(r|me)? (el|la|un|una)|arm(a|á|ar) (el|la|un|una)|hac(e|é)(r|me|lo)? (el|la|un|una)|prob(a|á|ar) (que|si|el|la|con)|teste|commit|edit(a|á|ar)|modific(a|á|ar) |write|fix |analy|review|revis(a|á|ar) (el|la|si|que)|propon|sintetiz|resum(i|í))'
AVISO=""      # texto del aviso P5; vacio = la llamada pasa callada (set -u: se inicializa siempre)
PALABRA=""    # la forma que disparo el aviso, para el registro (los espacios van como _)

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

# Primeros $2 caracteres de un campo de texto largo (prompt, description), en minusculas, en $FRAGMENTO.
# campo() corta en la primera comilla, y adentro de un prompt las comillas vienen escapadas (\"): aca
# primero se vacian los escapes (\\ \" \n \t -> espacio) sobre una copia del payload y recien despues se
# toma el campo entero hasta su comilla de cierre. Asi un prompt que cita algo se lee igual, y el texto
# NO sigue de largo hasta el campo siguiente (si siguiera, "subagent_type":"investigador" metia «investig»
# en el texto y tapaba todos los avisos cuando el prompt era corto). Sin {n,m}: no toca RE_DUP_MAX.
fragmento() {
  local s re esc
  s=$PLANO
  for esc in '\\' '\"' '\n' '\t'; do s=${s//"$esc"/ }; done
  re="\"$1\"[[:space:]]*:[[:space:]]*\"([^\"]*)\""
  if [[ $s =~ $re ]]; then FRAGMENTO=${BASH_REMATCH[1]:0:$2}; FRAGMENTO=${FRAGMENTO,,}; else FRAGMENTO=""; fi
}

# Unica salida "pasa". Con AVISO puesto lo manda por JSON (additionalContext: el modelo lo lee, nada se
# frena) y anota la llamada para medir. Sin AVISO no imprime nada, como siempre.
permitir() {
  if [ -n "$AVISO" ]; then
    printf '%s %s %s\n' "$AHORA" "${SUBTIPO:-?}" "${PALABRA// /_}" >> "$LOG_BUSQUEDAS"
    printf '{"hookSpecificOutput":{"hookEventName":"PreToolUse","additionalContext":"%s"}}\n' "$AVISO"
  fi
  exit 0
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
BLOQUEADO: los subagentes pasan por una definicion propia (sonnet + effort xhigh) y el modelo se
elige por tarea: haiku (buscar/leer/extraer), sonnet (escribir/programar), opus (criterio/cruzar
fuentes), fable (revisor de un cambio grande). La auditoria final (auditor, auditor-cliente) va en
Opus (Fak, 30/09 y 08/10/2026).
$1

Que hacer: relanzar con subagent_type "investigador" (todas las herramientas) o "explorador"
(solo lectura), que viven en ~/.claude/agents, pasando model: haiku|sonnet|opus|fable segun el
trabajo y, si hace falta, effort: low|medium|high (nunca max). Excepcion: \`auditor\` y
\`auditor-cliente\` van en opus.
EOF
  exit 2
}

# Workflow (24/10/2026): la misma regla que Agent, leida en el guion. Mensaje propio porque el arreglo es otro.
rechazar_wf() {
  cat >&2 <<EOF
BLOQUEADO (Workflow): $1

Workflow esta prendida (Fak, 16/10 y 24/10/2026) y pasa por la misma regla que Agent: cada agent() del guion va
con effort 'low' | 'medium' | 'high' | 'xhigh' (nunca 'max'), con model 'haiku' | 'sonnet' | 'opus' | 'fable'
segun el trabajo y, si lleva agentType, una definicion propia que cumpla el piso (investigador, explorador,
buscador; los built-in no). Corregi el guion y relanzalo. Descuenta del presupuesto de 40 puntos cada 10 min con
el modelo mas pesado que declara el guion; si no declara ninguno, como Opus (el de la sesion).
EOF
  exit 2
}

# La definicion de un agente por su nombre, en el proyecto y despues en ~/.claude/agents: deja DEF (vacio = no hay)
# y D_NOMBRE/D_MODELO/D_ESFUERZO de leer_def. La usa la rama de Workflow para cada agentType del guion.
buscar_def() {
  DEF=""
  local dir f
  for dir in "${CLAUDE_PROJECT_DIR:+${CLAUDE_PROJECT_DIR}/.claude/agents}" "${BASE}/agents"; do
    [ -n "$dir" ] && [ -d "$dir" ] || continue
    for f in "$dir"/*.md; do
      [ -f "$f" ] || continue
      leer_def "$f"
      if [ "$D_NOMBRE" = "$1" ]; then DEF="$f"; return 0; fi
    done
  done
  return 0
}

# Pase de Fak que LEVANTA el cupo de PESADOS_MAX Opus/Fable por ventana (01/10/2026: "si habia una
# regla que te impedia desplegar otros Opus la puse yo mismo..."; 08/10/2026: Opus y Fable ya pasan
# sin pase, hasta PESADOS_MAX). ~/.claude/.agent-opus-ok vale 12 h desde su ultima modificacion,
# igual que .agent-limit; pasado eso se retira y el cupo vuelve solo.
PASE_MODELO="${BASE}/.agent-opus-ok"
pase_modelo_vigente() {
  [ -f "$PASE_MODELO" ] || return 1
  local mod
  mod=$(stat -c %Y "$PASE_MODELO" 2>/dev/null || echo 0)
  if [ "$mod" -gt 0 ] 2>/dev/null && [ $((AHORA - mod)) -gt "$VENCE_SEG" ]; then
    rm -f "$PASE_MODELO"
    echo "agentes-guard: el pase ~/.claude/.agent-opus-ok tenia mas de 12 h y se retiro; vuelve el cupo de $PESADOS_MAX Opus/Fable por ventana." >&2
    return 1
  fi
  return 0
}

# La auditoria final la hace OPUS, no Sonnet (Fak, 30/09/2026: "la auditoria la deberia hacer un
# Opus... es la auditoria final, Sonnet no se si puede hacerla"). Estos agentes DEBEN declarar
# `model: opus` (y effort: xhigh); el resto, `model: sonnet` en la definicion (la llamada elige).
AUDITORES=" auditor auditor-cliente "

PESADO=0   # 1 = la llamada pide Opus o Fable para un agente comun (cuenta en el cupo de PESADOS_MAX)
if [ "$TOOL" != "Workflow" ]; then
  campo subagent_type; SUBTIPO=$CAMPO
  campo model; MODELO=$CAMPO
  campo effort; ESFUERZO=$CAMPO
  [ -z "$SUBTIPO" ] && rechazar "La llamada no dice subagent_type: correria general-purpose, que no deja fijar el esfuerzo."
  [ "$SUBTIPO" = "fork" ] && rechazar "Un fork corre en el modelo de la sesion principal: no se le puede elegir modelo ni esfuerzo."
  case "$ESFUERZO" in
    ""|low|medium|high|xhigh) ;;
    *) rechazar "Se pidio effort=$ESFUERZO: el maximo es xhigh, el anteultimo (Fak, 30/09/2026)." ;;
  esac
  ES_AUDITOR=0
  case "$AUDITORES" in *" $SUBTIPO "*) ES_AUDITOR=1 ;; esac
  if [ "$ES_AUDITOR" = "1" ]; then
    case "$MODELO" in
      ""|opus|claude-opus-*) ;;
      *) rechazar "\"$SUBTIPO\" es la auditoria final y corre en Opus: no se le pasa model=$MODELO." ;;
    esac
  else
    case "$MODELO" in
      ""|sonnet|claude-sonnet-*|haiku|claude-haiku-*) ;;
      opus|claude-opus-*|fable|claude-fable-*) PESADO=1 ;;
      *) rechazar "Se pidio model=$MODELO: los modelos validos son haiku, sonnet, opus o fable." ;;
    esac
  fi
  # El peso de ESTA llamada en el presupuesto. Los auditores no descuentan: la auditoria final es obligatoria.
  # Con el pase de Fak (.agent-opus-ok) Opus y Fable descuentan como Sonnet: el lo autorizo a gastar.
  PESO=$PESO_SONNET
  if [ "$ES_AUDITOR" = "1" ]; then PESO=0
  else
    case "$MODELO" in
      haiku|claude-haiku-*) PESO=$PESO_HAIKU ;;
      opus|claude-opus-*) PESO=$PESO_OPUS ;;
      fable|claude-fable-*) PESO=$PESO_FABLE ;;
    esac
    if [ "$PESADO" = "1" ] && pase_modelo_vigente; then PESO=$PESO_SONNET; fi
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
    # La definicion fija el piso: sonnet+xhigh (investigador, explorador) o haiku+medium (buscador, 08/10/2026).
    # Opus o Fable en una definicion comun no: eso se pide en la llamada y descuenta su peso.
    case "$D_MODELO" in
      sonnet|claude-sonnet-*) [ "$D_ESFUERZO" = "xhigh" ] || rechazar "La definicion $DEF no dice effort: xhigh." ;;
      haiku|claude-haiku-*)
        case "$D_ESFUERZO" in medium|high|xhigh) ;; *) rechazar "La definicion $DEF (haiku) no dice effort: medium, high o xhigh." ;; esac
        # un agente definido en haiku descuenta como haiku aunque la llamada no diga modelo
        [ -z "$MODELO" ] && PESO=$PESO_HAIKU ;;
      *) rechazar "La definicion $DEF no dice model: sonnet ni haiku." ;;
    esac
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

  # ¿Es Sonnet de verdad? El modelo explicito manda; sin modelo, lo dice la definicion (un buscador sin
  # modelo es haiku). Opus y Fable con pase descuentan como Sonnet pero no son Sonnet: no se les avisa.
  ES_SONNET=0
  case "$MODELO" in
    sonnet|claude-sonnet-*) ES_SONNET=1 ;;
    "") [ -n "$DEF" ] && case "$D_MODELO" in sonnet|claude-sonnet-*) ES_SONNET=1 ;; esac ;;
  esac

  # P5: un Sonnet con un pedido de busqueda. AVISO, no freno (Fak: "no quiero bloqueantes, quiero soluciones"):
  # la llamada sigue y descuenta sus 4 puntos; se le dice para que la proxima vaya en buscador (haiku, 1 punto)
  # y se anota para tener el numero que H7 dejo pendiente. Los auditores no entran: su modelo lo fija la definicion.
  if [ "$ES_SONNET" = "1" ] && [ "$ES_AUDITOR" = "0" ]; then
    fragmento description 240; TEXTO="$FRAGMENTO "
    fragmento prompt 500; TEXTO+="$FRAGMENTO"
    # las negaciones ("no escribas", "sin modificar") son senial de busqueda, no de trabajo: se sacan antes
    # de buscar los verbos de trabajo, si no "escrib" taparia justo los pedidos de solo lectura
    LIMPIO=$TEXTO
    for NEG in "no escrib" "sin escrib" "no modifi" "sin modifi" "no edit" "no toqu" "no cambi"; do
      LIMPIO=${LIMPIO//"$NEG"/}
    done
    if [[ $TEXTO =~ $RE_BUSQUEDA ]]; then
      PALABRA=${BASH_REMATCH[1]}
      if ! [[ $LIMPIO =~ $RE_TRABAJO ]]; then
        # sin comillas ni barras: va adentro de un JSON armado a mano
        PALABRA=${PALABRA//\"/}; PALABRA=${PALABRA//\\/}
        AVISO="AVISO (agentes-guard, P5): este Sonnet lleva un pedido que parece una busqueda (dice «${PALABRA}»). ¿Es buscar o decidir? La llamada ya paso y desconto ${PESO_SONNET} puntos; no la relances. Si solo hay que ubicar, leer o extraer, la proxima va en buscador (haiku, pesa ${PESO_HAIKU}); si hay que escribir, analizar o cruzar fuentes, esta bien asi. Quedo anotada en ~/.claude/.agent-busquedas.log para medir cuantas eran busquedas (H7)."
      else
        PALABRA=""
      fi
    fi
  fi
else
  # ---------------------------------------------------------------- Workflow: la regla de Agent, leida en el guion
  # Prendida desde el 16/10/2026 (Fak) y re-prendida el 24/10/2026. La llamada trae script | scriptPath | name | args
  # (esquema de la tool y las 25 llamadas de los registros, medido el 24/10/2026): model y effort van en cada
  # agent(prompt, { model, effort, agentType }) del guion. El guion lo lee node (el LECTOR, al final de este archivo):
  # toma los campos de tool_input de verdad (no los de args), lee el archivo de scriptPath o el guardado de name, sigue
  # UN nivel de workflow() anidado (lo que la tool permite) y devuelve una linea CLAVE|valor por dato. Aca se decide con
  # la misma regla que Agent. Es el unico proceso externo del hook y solo corre para Workflow (23 llamadas distintas en
  # toda la historia de la PC). Va ANTES del `.agent-limit=0`: ningun pase saltea la regla de esfuerzo.
  W_SALIDA=$(printf '%s' "$INPUT" | node -e "const s=require('fs').readFileSync(process.argv[1],'utf8');eval(s.slice(s.lastIndexOf('//@@LECTOR'+'_WORKFLOW@@')))" "${BASH_SOURCE[0]}" 2>/dev/null)
  W_RC=$?
  case "$W_SALIDA" in
    *"FIN|"*) ;;
    *) rechazar_wf "No se pudo leer el guion (el lector en node no contesto; salida $W_RC): sin leerlo no se ve el modelo ni el esfuerzo de sus agentes." ;;
  esac
  W_PESO=-1   # el modelo mas pesado que declara el guion; -1 = no hay ningun dato
  while IFS= read -r W_LINEA || [ -n "$W_LINEA" ]; do
    W_LINEA=${W_LINEA%$'\r'}
    W_CLAVE=${W_LINEA%%|*}
    V=${W_LINEA#*|}
    P=-1
    case "$W_CLAVE" in
      FIN|SIN_ARCHIVO) ;;   # SIN_ARCHIVO: un workflow de fabrica, sin archivo que leer; se cobra igual
      CORRIDA) permitir ;;  # solo runId (parar o ver una corrida): no lanza agentes y no se frena
      HEREDA) P=$PESO_OPUS ;;   # un agent() sin model ni agentType corre en el modelo de la sesion: como Opus
      NO_SE_LEE) rechazar_wf "No se puede leer el guion $V: sin leerlo no se ve el modelo ni el esfuerzo de sus agentes." ;;
      NOMBRE_RARO) rechazar_wf "El nombre de workflow '$V' no es el de un workflow guardado (lleva una barra o ..)." ;;
      CALCULADO) rechazar_wf "El guion arma $V con \${...}: no se puede revisar. Escribilo literal." ;;
      ANIDADO_CALCULADO) rechazar_wf "El guion llama a workflow() con un argumento calculado ($V): no se puede leer el guion hijo. Escribi el nombre o la ruta literal." ;;
      ERROR) rechazar_wf "No se pudo leer la llamada ($V)." ;;
      EFFORT)
        case "$V" in
          ""|low|medium|high|xhigh) ;;
          *) rechazar_wf "El guion pide effort '$V' para un agente: el maximo es xhigh, el anteultimo (Fak, 30/09/2026)." ;;
        esac ;;
      MODEL)
        case "$V" in
          ""|inherit) ;;
          haiku|haiku\[*|claude-haiku-*) P=$PESO_HAIKU ;;
          sonnet|sonnet\[*|claude-sonnet-*) P=$PESO_SONNET ;;
          opus|opus\[*|claude-opus-*) P=$PESO_OPUS ;;
          fable|fable\[*|claude-fable-*) P=$PESO_FABLE ;;
          *) rechazar_wf "El guion pide model '$V': los modelos validos son haiku, sonnet, opus o fable." ;;
        esac ;;
      TIPO)
        # el mismo piso que una definicion para Agent: sonnet+xhigh, haiku+medium/high/xhigh; auditores opus+xhigh
        if [ -n "$V" ]; then
          buscar_def "$V"
          [ -n "$DEF" ] || rechazar_wf "agentType '$V' no tiene definicion propia (built-in o inexistente): no se le puede fijar modelo y esfuerzo."
          P=$PESO_SONNET
          case "$AUDITORES" in
            *" $V "*)
              case "$D_MODELO" in opus|claude-opus-*) ;; *) rechazar_wf "La definicion $DEF no dice model: opus (la auditoria final la hace Opus)." ;; esac
              [ "$D_ESFUERZO" = "xhigh" ] || rechazar_wf "La definicion $DEF no dice effort: xhigh."
              P=$PESO_OPUS ;;
            *)
              case "$D_MODELO" in
                sonnet|claude-sonnet-*) [ "$D_ESFUERZO" = "xhigh" ] || rechazar_wf "La definicion $DEF no dice effort: xhigh." ;;
                haiku|claude-haiku-*)
                  case "$D_ESFUERZO" in medium|high|xhigh) ;; *) rechazar_wf "La definicion $DEF (haiku) no dice effort: medium, high o xhigh." ;; esac
                  P=$PESO_HAIKU ;;
                *) rechazar_wf "La definicion $DEF no dice model: sonnet ni haiku." ;;
              esac ;;
          esac
        fi ;;
      *) rechazar_wf "Respuesta inesperada del lector del guion: $W_LINEA" ;;
    esac
    [ "$P" -gt "$W_PESO" ] && W_PESO=$P
  done <<< "$W_SALIDA"

  # Sin ningun dato (un workflow de fabrica, un guion sin agent()), como Opus: el modelo de la sesion en esta PC
  # ("model": "opus[1m]"). Una sesion en Fable queda cobrada de menos: limite conocido.
  if [ "$W_PESO" -lt 0 ]; then PESO=$PESO_OPUS; else PESO=$W_PESO; fi
  # Con el pase de Fak (.agent-opus-ok) Opus y Fable descuentan como Sonnet, igual que en Agent.
  if [ "$PESO" -gt "$PESO_SONNET" ] && pase_modelo_vigente; then PESO=$PESO_SONNET; fi
fi

# Limite 0 = techo desactivado a proposito por Fak (por 12 h); la regla de arriba ya corrio
[ "$LIMITE" = "0" ] && permitir

# ---------------------------------------------------------------- Agent/Task/Workflow: ventana deslizante por PUNTOS
# Cada linea del log: "<epoch> <tool> <peso>", con el peso en puntos de la llamada. Las lineas viejas
# ("pesado"/"liviano" o sin peso) cuentan como Sonnet.
PRESUPUESTO=$((LIMITE * PESO_SONNET))
CORTE=$((AHORA - VENTANA_SEG))
USADOS=0
PUNTOS=0
ANTIGUO=""
VIGENTES=""
if [ -f "$LOG" ]; then
  while IFS= read -r LINEA || [ -n "$LINEA" ]; do
    TS=${LINEA%% *}
    [[ $TS =~ ^[0-9]+$ ]] || continue
    if [ "$TS" -ge "$CORTE" ]; then
      VIGENTES+="$LINEA"$'\n'
      USADOS=$((USADOS + 1))
      P=${LINEA##* }
      [[ $P =~ ^[0-9]+$ ]] || P=$PESO_SONNET
      PUNTOS=$((PUNTOS + P))
      [ -z "$ANTIGUO" ] && ANTIGUO=$TS
    fi
  done < "$LOG"
fi
printf '%s' "$VIGENTES" > "$LOG"

if [ $((PUNTOS + PESO)) -gt "$PRESUPUESTO" ]; then
  MIN=$((VENTANA_SEG / 60))
  ESPERA="?"
  if [ -n "$ANTIGUO" ]; then
    ESPERA=$(( (ANTIGUO + VENTANA_SEG - AHORA) / 60 + 1 ))
  fi
  cat >&2 <<EOF
BLOQUEADO: presupuesto de subagentes agotado ($PUNTOS/$PRESUPUESTO puntos en los ultimos $MIN minutos; esta llamada pesa $PESO).
Pesos por costo (precios oficiales 08/10/2026): haiku $PESO_HAIKU · sonnet $PESO_SONNET · opus $PESO_OPUS · fable $PESO_FABLE.

El techo nacio el 2026-08-06, cuando 40 subagentes le consumieron el limite de uso a Fak y lo
dejaron 4 horas sin poder trabajar. Desde el 08/10/2026 se mide por costo, no por cantidad.

NO reintentes ni reformules la llamada. Lo que corresponde:
  - Hace el trabajo vos, directo. Si ya identificaste el archivo o la query, leelo.
  - Si es buscar, leer o extraer: relanzalo en haiku (pesa $PESO_HAIKU). Si es escribir, sonnet ($PESO_SONNET).
  - Si te falta presupuesto para algo realmente ancho: espera ~$ESPERA min, o que Fak lo suba:
        echo 15 > ~/.claude/.agent-limit   (vale 12 h; 15 = 60 puntos). Si Fak ya lo pidio TEXTUAL
    en el chat ("usa agentes en paralelo", "no me importa gastar tokens"), escribilo vos y decilo.
  - La auditoria final (auditor, auditor-cliente) no descuenta: lanzala igual.
  - Reportale a Fak que llegaste al techo y por que lo necesitabas. No lo escondas.
EOF
  exit 2
fi

# Permitido: registrar el spawn con su peso
printf '%s %s %s\n' "$AHORA" "$TOOL" "$PESO" >> "$LOG"
permitir   # P5: sale con 0; con AVISO puesto imprime el JSON y anota. No vuelve: el exit 0 de abajo queda de respaldo.
exit 0

# ---------------------------------------------------------------- LECTOR de la rama Workflow (node)
# Bash no llega aca (esta despues del exit) y el heredoc es para que `bash -n` no lo lea como bash. La rama Workflow
# le pasa el payload por stdin a node, que corre desde la marca de abajo hasta el final. Solo LEE y dice lo que ve, una
# linea CLAVE|valor por dato; la regla la aplica el bash de arriba. Se lee: el guion de tool_input.script, el archivo
# de tool_input.scriptPath (le gana a script y a name, como en la tool) o .claude/workflows/<name>.js del proyecto o de
# ~/.claude, y UN nivel de workflow('nombre') / workflow({ scriptPath | name }) con literal. No se lee args ni
# description. Limites: un valor en una variable (effort: E), formas raras de un literal (un comentario entre la
# clave y el valor, parentesis, una clave calculada) y un workflow de fabrica (sin archivo).
: <<'//FIN-LECTOR-WORKFLOW'
//@@LECTOR_WORKFLOW@@
const fs = require('fs'), path = require('path'), os = require('os');
const salida = [];
const decir = (k, v = '') => salida.push(k + '|' + String(v).replace(/[\r\n]+/g, ' '));
// Lo que va entre el abridor de src[i] y su cierre, salteando strings; aproximado (un ${} con comillas adentro lo
// confunde) y con tope, para que un parentesis sin cerrar no recorra el guion entero en cada llamada.
const hastaCierre = (src, i) => {
  let prof = 0, q = null, j = i;
  const tope = Math.min(src.length, i + 50000);
  for (; j < tope; j++) {
    const c = src[j];
    if (q) { if (c === '\\') { j++; continue; } if (c === q) q = null; continue; }
    if (c === '"' || c === "'" || c === '`') { q = c; continue; }
    if (c === '(' || c === '[' || c === '{') prof++;
    else if (c === ')' || c === ']' || c === '}') { prof--; if (prof === 0) return src.slice(i + 1, j); }
  }
  return src.slice(i + 1, j);
};
const literal = (clave) => new RegExp('(?:^|[^\\w$])["\']?' + clave + '["\']?\\s*:\\s*(["\'`])((?:\\\\.|(?!\\1)[^\\\\\\n])*)\\1');
try {
  const p = JSON.parse(fs.readFileSync(0, 'utf8'));
  const ti = (p && typeof p.tool_input === 'object' && p.tool_input) || {};
  const casa = process.env.HOME || os.homedir();
  const proyecto = process.env.CLAUDE_PROJECT_DIR || '';
  const cwd = typeof p.cwd === 'string' && p.cwd ? p.cwd : process.cwd();
  const txt = (v) => (typeof v === 'string' && v ? v : '');
  if (txt(ti.runId) && !txt(ti.script) && !txt(ti.scriptPath) && !txt(ti.name)) {
    decir('CORRIDA');
  } else {
    const guiones = [];
    const deRuta = (r) => {
      const f = path.resolve(cwd, /^~[\\/]/.test(r) ? path.join(casa, r.slice(2)) : r);
      try { guiones.push(fs.readFileSync(f, 'utf8')); } catch { decir('NO_SE_LEE', f); }
    };
    const guardado = (n) => {
      if (n.includes('${')) return decir('ANIDADO_CALCULADO', n);
      if (/[\\/]|\.\./.test(n)) return decir('NOMBRE_RARO', n);
      const dirs = [proyecto && path.join(proyecto, '.claude', 'workflows'), path.join(casa, '.claude', 'workflows')].filter(Boolean);
      for (const d of dirs) for (const ext of ['.js', '.mjs']) {
        const f = path.join(d, n + ext);
        if (fs.existsSync(f)) return guiones.push(fs.readFileSync(f, 'utf8'));
      }
      decir('SIN_ARCHIVO', n);
    };
    if (txt(ti.scriptPath)) deRuta(ti.scriptPath);
    else {
      if (txt(ti.script)) guiones.push(ti.script);
      if (txt(ti.name)) guardado(ti.name);
    }
    // UN nivel de workflow() anidado: el hijo se lee igual que el de arriba (la referencia de la tool: un solo nivel).
    for (const t of guiones.slice()) {
      const re = /(?<![\w$.])workflow\(/g;
      let m;
      while ((m = re.exec(t))) {
        const arg = hastaCierre(t, m.index + m[0].length - 1).trim();
        let a;
        if ((a = /^(["'`])([^"'`\n]+)\1/.exec(arg))) { guardado(a[2]); continue; }
        if (arg.startsWith('{')) {
          const sp = literal('scriptPath').exec(arg), nm = literal('name').exec(arg);
          if (/(?:^|[^\w$])["']?scriptPath["']?\s*:/.test(arg)) {   // scriptPath le gana a name: si no es literal, calculado
            if (sp && !sp[2].includes('${')) { deRuta(sp[2]); continue; }
          } else if (nm) { guardado(nm[2]); continue; }
          else if (literal('script').test(arg)) continue;   // guion en linea: ya esta en el texto del padre
        }
        decir('ANIDADO_CALCULADO', arg.slice(0, 60));
      }
    }
    for (const t of guiones) {
      for (const [clave, k] of [['effort', 'EFFORT'], ['model', 'MODEL'], ['agentType', 'TIPO']]) {
        const re = new RegExp(literal(clave).source, 'g');
        let m;
        while ((m = re.exec(t))) decir(m[2].includes('${') ? 'CALCULADO' : k, m[2].includes('${') ? clave : m[2]);
      }
      // Un agent() que no declara model ni agentType corre en el modelo de la sesion.
      const re = /(?<![\w$.])agent\(/g;
      let m;
      while ((m = re.exec(t))) {
        if (!/(?:^|[^\w$])["']?(?:model|agentType)["']?\s*:/.test(hastaCierre(t, m.index + m[0].length - 1))) { decir('HEREDA'); break; }
      }
    }
  }
} catch (e) {
  decir('ERROR', (e && e.message ? e.message : String(e)).slice(0, 120));
}
decir('FIN');
process.stdout.write([...new Set(salida)].join('\n') + '\n');
//FIN-LECTOR-WORKFLOW
