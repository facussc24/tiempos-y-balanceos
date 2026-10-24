#!/usr/bin/env bash
# session-start-context.sh — contexto deterministico al arrancar (SessionStart).
#
# Desde el 04/09/2026 este hook YA NO inyecta docs/LECCIONES_APRENDIDAS.md: el archivo entra
# al system prompt por `@docs/LECCIONES_APRENDIDAS.md` desde CLAUDE.md. Motivo, medido ese dia
# sobre los transcripts: desde el 03/08 (version nueva de Claude Code) toda salida de hook
# mayor a ~10 KB se guarda en un archivo y al modelo le llega un preview de 2 KB ("Output too
# large"). 144 sesiones arrancaron asi: con las lecciones "inyectadas" y sin leerlas. El
# @import no tiene ese tope (4 MiB) y sobrevive la compactacion porque es parte del system
# prompt, asi que tampoco hace falta reinyectarlas en el modo compact.
#
# Uso (cableado en settings.json):
#   session-start-context.sh inicio    → matcher startup|resume|clear: corre cerebro-guard
#       (baja el cerebro si esta PC no lo tiene) y despues imprime los SEGUIMIENTOS CON FECHA
#       abiertos (scripts/_seguimientos.mjs --hook; nada si no hay ninguno). Fak, 02/10/2026:
#       "memorias con fechas que chequees constantemente en las sesiones". Los viernes, en una sesion
#       nueva que abrio Fak, suma el renglon del viernes de planificacion (viernesPlanificacion.mjs).
#   session-start-context.sh compact   → matcher compact: reinyecta el nucleo anti-perdida,
#       menos de 1 KB.
#   "lecciones" se acepta como alias de "inicio" (nombre viejo del modo).

PAYLOAD="$(cat 2>/dev/null)"   # el JSON de stdin (trae session_id)

ROOT="${CLAUDE_PROJECT_DIR:-$(git rev-parse --show-toplevel 2>/dev/null || echo .)}"
MODE="${1:-inicio}"

# Ficha de ESTA PC (tanda 1.6, 16/10/2026; Fak: "debe saber que esta en la PC de Calidad"): si existe
# .claude/pcs/<COMPUTERNAME>.md se imprime entera, al arrancar Y al compactar (el auditor del 16/10 midio que una sesion
# de CATA que compacta perdia el «estoy en CATA»; cuesta 2,4 KB). Viaja por git y se actualiza sola; la PC principal no
# tiene ficha (la casa esta escrita para ella). Sin COMPUTERNAME (una prueba fuera de Windows) no se busca nada.
# Debajo, el aviso «PC nueva» de la ULTIMA sincronizacion (que programas le faltan a esta PC): _nube.mjs lo deja en
# .claude/state/pc-nueva.txt, vacio si no falta nada (el ultimo renglon del log mentia cuando ya no faltaba nada: auditor
# ronda 2, N1). Hasta el 16/10 iba solo al log y nadie lo leia (H6). Solo bash, sin node. BARACK_PC_NUEVA_ARCHIVO: tests.
ficha_pc() {
  if [ -n "${COMPUTERNAME:-}" ]; then
    FICHA_PC="$ROOT/.claude/pcs/${COMPUTERNAME^^}.md"
    [ -f "$FICHA_PC" ] && cat "$FICHA_PC"
  fi
  PCN="${BARACK_PC_NUEVA_ARCHIVO:-$ROOT/.claude/state/pc-nueva.txt}"
  [ -s "$PCN" ] && cat "$PCN"
}

# 03/10/2026: si Fak dejo a ESTA sesion trabajando hasta una hora y todavia no llego, se dice al arrancar, al
# reanudar y al compactar (el latido muere si la app se reinicia y la consigna se puede perder al compactar).
# Nada si no hay nada vigente. Regla trabajar-hasta-la-hora.md.
hora_vigente() { printf '%s' "$PAYLOAD" | node "$ROOT/scripts/_lib/horaGuard.mjs" --contexto-hook 2>/dev/null; }

if [ "$MODE" = "compact" ]; then
  cat << 'NUCLEO'
[POST-COMPACT Barack — nucleo anti-perdida, inyectado por hook]
1. Las reglas .claude/rules/ condicionales (paths:) NO sobreviven la compactacion:
   se recargan recien al volver a LEER archivos que matcheen. Si seguis trabajando
   AMFE/CP/scripts, relee la regla que aplique antes de editar.
2. Prohibiciones core vigentes: NUNCA inventar datos tecnicos (TBD y avisar);
   CC/SC solo Fak; Supabase live = unica verdad (no dumps); espanol AR simple.
3. Entregables ejecutables (tablas para arb/Supabase): dato crudo before→after
   + abrir el archivo + validador de consumos ANTES de entregar.
4. Si habia numeros/decisiones criticas en la parte compactada: verificarlos de
   nuevo contra la fuente, no confiar en el resumen.
5. docs/LECCIONES_APRENDIDAS.md sigue en el system prompt (@import desde CLAUDE.md):
   no hace falta releerlo. Las memorias del tema que estabas tocando, si.
6. Seguis en espanol rioplatense, como siempre: el resumen de compactacion viene en
   ingles y arrastra el idioma (19 arranques en ingles en la semana del 02/09/2026).
7. Caracteristicas especiales (Fak 11/09/2026, "para siempre"): CC = S 9-10 (para VW se
   escribe D/TLD: UNA marca, legal, la designa el cliente en el plano); SC = S 5-8 y O>=4.
   La sigla se justifica con S y O de ESA causa, nunca porque otro documento la tenia.
   Regla always-on caracteristicas-especiales.md; fuente core/amfe/caracteristicasEspeciales.data.json.
NUCLEO
  ficha_pc
  hora_vigente
  exit 0
fi

# El cerebro va PRIMERO: si esta PC no lo tiene, bajarlo es prioritario sobre todo lo demas.
bash "$ROOT/.claude/hooks/cerebro-guard.sh" 2>/dev/null

# La ficha de esta PC y el ultimo aviso «PC nueva» (funcion de arriba).
ficha_pc
# Noche de Claude (6b, viernes 23/10/2026): si la ultima noche NO CORRIO, no arranco o fallo, un renglon [NOCHE] al
# arrancar (el 23/10 a las 06:30 quedo «no arranco: presupuesto en rojo» en nocturno.json y ninguna sesion lo dijo).
# Nada si corrio bien. Solo lee el estado, nunca frena; no al compactar. BARACK_NOCTURNO_ESTADO: tests.
node "$ROOT/scripts/_lib/nocturnoHook.mjs" --hook 2>/dev/null

# Seguimientos con fecha: lo que hay que volver a pedir (lunes y viernes) hasta que contesten.
# Va DESPUES del cerebro porque los datos viven en la memoria. Detalla hasta 10 (unos 5 KB) y
# cuenta el resto; un dato mal escrito lo DICE por esta misma salida; si node falla, no frena.
node "$ROOT/scripts/_seguimientos.mjs" --hook 2>/dev/null
# Hilos abiertos (Fak, 08/10/2026: un mail de Carlos con el consumo corregido quedo sin ver en una tarea
# abierta; "nunca mas puede volver a pasar"): por cada tarea del Escritorio, los mails del mismo hilo
# POSTERIORES al ultimo .msg guardado en la carpeta. Nada si no hay ninguno. Detalle: _hilosAbiertos.mjs.
node "$ROOT/scripts/_hilosAbiertos.mjs" --hook 2>/dev/null
# Novedades de Claude Code (Fak, 04/10/2026): un renglon si paso una semana sin leer a quienes sigue. No sale a internet.
node "$ROOT/scripts/_novedadesClaude.mjs" --hook 2>/dev/null
# PC de area (Fak, 06/10/2026: "el sistema de feedback no me termina de convencer... no te envia un reporte cuando pasa
# algo grave"): un renglon con lo NUEVO que dejaron las PC en el buzon (frenos de los controles, juntos por episodio) y
# las PC para mirar. Nada si no hay novedades o si la nube no esta. El detalle y el dar por visto: vigia.mjs [--marcar].
node "$ROOT/tools/claude-area/vigia.mjs" --hook 2>/dev/null
# Viernes de planificacion (Fak, 15/10/2026: "que el lo sepa y me lo sugiera"; no es tarea programada): los viernes, en una
# sesion nueva que abrio Fak (no una lanzada por otra sesion ni por el reloj), un renglon que le pide a la sesion proponer
# el ritual. Una vez por viernes por PC; ante la duda calla. Logica y por que esas señales: viernesPlanificacion.mjs.
# De lunes a jueves no se arranca node (0,5 a 0,9 s por arranque, auditor 16/10); el date de Git Bash da la hora local
# (medido el 16/10). VIERNES_HOY_PRUEBA solo la ponen los tests, y node la respeta solo con VITEST.
if [ "$(date +%u)" = "5" ] || [ -n "${VIERNES_HOY_PRUEBA:-}" ]; then
  printf '%s' "$PAYLOAD" | node "$ROOT/scripts/_lib/viernesPlanificacion.mjs" --hook 2>/dev/null
fi
hora_vigente
exit 0
