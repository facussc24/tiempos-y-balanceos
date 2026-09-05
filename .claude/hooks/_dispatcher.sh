#!/usr/bin/env bash
# Despachador de guardianes PreToolUse (matcher: Bash|PowerShell|Write|Edit).
#
# HISTORIA
#   2026-08-04: los 8 guardianes corrian como 8 hooks separados (8 bash + 8 node para parsear
#   EL MISMO JSON = 5.580 ms por comando). Se consolidaron aca: un bash, un node para parsear,
#   y cada guardian bash en subshell.
#   2026-09-05 (Ola 2 del plan de mejoras): medido de nuevo, cada guardian bash forkeaba 4-6
#   procesos ($(cat), printf | grep por chequeo, date): 2,6-3,5 s por llamada con la maquina
#   tranquila y 6-12 s con otras sesiones abiertas; con 11.400 Bash/Edit/Write en dos semanas,
#   horas de espera. Ahora el matching de los 13 guardianes vive en scripts/_lib/guardianes.mjs
#   y corre DENTRO del unico node que ya se levantaba para parsear. bash queda para: leer
#   stdin, arrancar node y, solo si node dejo la marca, correr supabase-guard.sh (el unico con
#   un efecto ademas del veredicto: el backup).
#
# CONTRATO (identico al de un hook suelto):
#   exit 0 = permite · exit 2 = bloquea y el stderr va a Claude.
#   Recordatorios 1x/h (escritorio, cad, patrones, HO, consumos, rule-gate): ya NO bloquean.
#   Salen como {"hookSpecificOutput":{"hookEventName":"PreToolUse","additionalContext":...}}
#   en stdout con exit 0. Si en la misma llamada hay un bloqueo, no se emiten ni consumen su
#   cooldown (la herramienta no va a correr; saltan en el reintento).
#   Si node no arranca o revienta: exit 2 con el error. Un guardian que no corre parece un
#   guardian que aprobo — se prefiere el bloqueo ruidoso al silencio.
#
# El bloque `printf '%s' "$INPUT" | node -e '...' "$TMP"` escribe los campos parseados en
# archivos (tool, cmd, file, target, parsed4, parsed3), VACIOS de verdad si el JSON no parsea:
# eso es lo que hace caer a los guardianes a su red de seguridad sobre el JSON crudo.
# _dispatcher.test.sh extrae ese bloque con awk y lo prueba solo: no cambiar sus delimitadores.
set -uo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MOD="$DIR/../../scripts/_lib/guardianes.mjs"
INPUT=$(cat)

TMP=$(mktemp -d 2>/dev/null || echo "${TMPDIR:-/tmp}/hookdisp.$$")
mkdir -p "$TMP"
limpiar() { rm -f "$TMP"/* 2>/dev/null; rmdir "$TMP" 2>/dev/null; }
trap limpiar EXIT

printf '%s' "$INPUT" | node -e '
const fs = require("fs");
const dir = process.argv[1];
const mod = process.argv[2];
let s = "";
process.stdin.on("data", d => s += d);
process.stdin.on("end", () => {
  let cmd = "", file = "", tool = "", content = "", ok = false;
  try {
    const j = JSON.parse(s);
    const t = j?.tool_input || {};
    tool = String(j?.tool_name ?? "");
    cmd = String(t.command ?? "");
    file = String(t.file_path ?? "");
    content = String(t.content ?? t.new_string ?? "");
    ok = true;
  } catch {}
  const clean = x => String(x ?? "").replace(/[\x1f\n\r]/g, " ");
  const w = (n, v) => { try { fs.writeFileSync(dir + "/" + n, v); } catch {} };
  if (!ok) {
    // JSON roto: TODO vacio de verdad — ni un separador (lo probo _dispatcher.test.sh, 2026-08-04).
    for (const n of ["tool","cmd","file","target","parsed4","parsed3"]) w(n, "");
  } else {
    w("tool", tool);
    w("cmd", cmd);
    w("file", file);
    w("target", cmd + " " + file);
    w("parsed4", [clean(tool), clean(cmd).slice(0,6000), clean(file), clean(content).slice(0,6000)].join("\x1f"));
    w("parsed3", [clean(tool), clean(cmd).slice(0,6000), clean(file)].join("\x1f"));
  }
  if (!mod) return;   // el test solo prueba el parseo
  const url = "file:///" + mod.replace(/\\/g, "/").replace(/^\/([a-zA-Z])\//, (m, d) => d.toUpperCase() + ":/");
  import(url).then(g => g.despachar(s, dir)).then(code => { process.exitCode = code; }, e => {
    process.stderr.write("[GUARDIANES] no pude correr scripts/_lib/guardianes.mjs — bloqueo por seguridad:\n" + (e && e.stack || e) + "\n");
    process.exitCode = 2;
  });
});
' "$TMP" "$MOD"
RC=$?

if [ "$RC" -ne 0 ] && [ "$RC" -ne 2 ]; then
  echo "[GUARDIANES] node salio con codigo $RC — bloqueo por seguridad (revisar scripts/_lib/guardianes.mjs)." >&2
  RC=2
fi

# supabase-guard: solo si node dejo la marca (script destructivo contra Supabase) y nada
# bloqueo. Corre el backup ANTES del comando. Antes corria aunque otro guardian bloqueara el
# comando: un backup para un comando que no iba a correr.
if [ "$RC" -eq 0 ] && [ -f "$TMP/supabase" ]; then
  export HOOK_CMD="$(<"$TMP/cmd")"
  ( source "$DIR/supabase-guard.sh" ) <<< "$INPUT" 2>"$TMP/err"
  RC2=$?
  MSG="$(<"$TMP/err")"
  [ -n "$MSG" ] && printf '%s\n' "$MSG" >&2
  [ "$RC2" -eq 2 ] && RC=2
fi

exit "$RC"
