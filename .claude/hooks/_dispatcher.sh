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
#   horas de espera. Ahora el matching de los guardianes (NOMBRES) vive en scripts/_lib/guardianes.mjs
#   y corre DENTRO del unico node que ya se levantaba para parsear. bash queda para: leer
#   stdin, arrancar node y, solo si node dejo la marca, correr supabase-guard.sh (el unico con
#   un efecto ademas del veredicto: el backup).
#   2026-09-30: lo que quedaba de bash eran ~9 procesos por llamada en msys (el `$(dirname ..)` +
#   `$(cd .. && pwd)` del DIR, `$(cat)`, `mktemp -d`, `mkdir -p`, el `printf |` y, al salir, `rm` y
#   `rmdir`), que en Windows cuestan mas que el guardian. Ahora bash no lee stdin (node lo hereda y lo
#   lee), no calcula DIR (node resuelve guardianes.mjs desde la ruta de este script), no crea ni borra
#   el directorio temporal (lo hace node; bash solo lo borra si la corrida dejo la marca de supabase o
#   node murio a medio camino). Queda: bash + node. Motivo y medicion de origen: docs/auto-mejora/
#   2026-09-30-automejora-10-frentes.md §9 (el dispatcher costaba ~0,9 s con la PC tranquila, 0,6 s de eso era bash).
#
# CONTRATO (identico al de un hook suelto):
#   exit 0 = permite · exit 2 = bloquea y el stderr va a Claude.
#   Recordatorios (escritorio, cad, patrones, HO, consumos, rule-gate, CC/SC, doc. oficial): ya NO
#   bloquean, y desde el 30/09/2026 salen UNA vez por sesion (clave session_id; sin session_id, 1x/h).
#   Salen como {"hookSpecificOutput":{"hookEventName":"PreToolUse","additionalContext":...}}
#   en stdout con exit 0. Si en la misma llamada hay un bloqueo, no se emiten ni se marcan (la
#   herramienta no va a correr; saltan en el reintento).
#   Si node no arranca o revienta: exit 2 con el error. Un guardian que no corre parece un
#   guardian que aprobo — se prefiere el bloqueo ruidoso al silencio.
#
# El bloque `node -e '...' "$TMP" "${BASH_SOURCE[0]}"` escribe los campos parseados en
# archivos (tool, cmd, file, target, parsed4, parsed3), VACIOS de verdad si el JSON no parsea:
# eso es lo que hace caer a los guardianes a su red de seguridad sobre el JSON crudo.
# _dispatcher.test.sh extrae ese bloque con awk y lo prueba solo: no cambiar sus delimitadores
# (la linea que arranca con `node -e '` y la que arranca con `' "$TMP"`).
set -uo pipefail

# Directorio de esta corrida. NO se crea aca: lo crea node (mkdirSync) y lo borra node salvo que haya
# marca de supabase. El trap solo actua si el directorio quedo (rama supabase, o node murio).
TMP="${TMPDIR:-/tmp}/hookdisp.$$"
limpiar() { [ -d "$TMP" ] && rm -rf "$TMP"; }
trap limpiar EXIT

node -e '
const fs = require("fs");
const dir = process.argv[1];
const script = process.argv[2];
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
  try { fs.mkdirSync(dir, { recursive: true }); } catch {}
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
  if (!script) return;   // el test solo prueba el parseo
  // guardianes.mjs vive en ../../scripts/_lib/ respecto de este script (lo resuelve node: bash ya no calcula DIR).
  const aWin = p => String(p).replace(/\\/g, "/").replace(/^\/([a-zA-Z])\//, (m, d) => d.toUpperCase() + ":/");
  const mod = require("path").resolve(require("path").dirname(aWin(script)), "..", "..", "scripts", "_lib", "guardianes.mjs");
  const modWin = mod.replace(/\\/g, "/").replace(/^\/([a-zA-Z])\//, (m, d) => d.toUpperCase() + ":/");
  const url = "file:///" + modWin;
  // Sin marca de supabase el directorio no se necesita mas: se borra aca y bash no gasta un rm.
  const soltar = () => { try { if (!fs.existsSync(dir + "/supabase")) fs.rmSync(dir, { recursive: true, force: true }); } catch {} };
  // CARRIL DE AUTO-REPARACION (22/09/2026): si el modulo no carga, solo pasa un Edit/Write sobre
  // los archivos de los guardianes (guardianes.mjs, sus modulos ./locales y los .data.json que
  // lee). Misma regla que esArchivoDeReparacion() de guardianes.mjs, que aca no se puede importar.
  const reparacion = () => {
    if (!ok || (tool !== "Edit" && tool !== "Write")) return false;
    const f = require("path").posix.normalize(file.replace(/\\/g, "/").replace(/^\/([a-zA-Z])\//, (m, d) => d.toUpperCase() + ":/"));
    const base = (f.split("/").pop() || "").toLowerCase();
    if (!base) return false;
    // Solo archivos DE ESTE REPO (22/09/2026, prueba de ataque: pasaba un Write a
    // <Escritorio>/scripts/_lib/guardianes.mjs). La raiz sale de la ruta del modulo.
    const raiz = require("path").posix.normalize(modWin).replace(/\/scripts\/_lib\/guardianes\.mjs$/i, "").toLowerCase();
    if (!f.toLowerCase().startsWith(raiz + "/")) return false;
    const enLib = /(^|\/)scripts\/_lib\/[^\/]+$/i.test(f);
    if (enLib && (base === "guardianes.mjs" || base.endsWith(".data.json"))) return true;
    let src = "";
    try { src = fs.readFileSync(modWin, "utf8"); } catch {}
    const locales = [...src.matchAll(/from\s+["\x27]\.\/([^"\x27]+)["\x27]/g)].map(x => x[1].toLowerCase());
    if (enLib && locales.includes(base)) return true;
    const datos = [...src.matchAll(/["\x27`\/\\]([\w.-]+\.data\.json)["\x27`]/g)].map(x => x[1].toLowerCase());
    return datos.includes(base);
  };
  import(url).then(g => g.despachar(s, dir)).then(code => {
    process.exitCode = code;
    // La rama supabase de bash relee el payload: se lo deja en el directorio (antes bash lo tenia en $INPUT).
    if (fs.existsSync(dir + "/supabase")) w("input", s); else soltar();
  }, e => {
    const error = "[GUARDIANES] no pude correr scripts/_lib/guardianes.mjs:\n" + (e && e.stack || e) + "\n";
    if (reparacion()) {
      process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: "PreToolUse", additionalContext:
        error + "[CARRIL DE AUTO-REPARACION] Los guardianes estan CAIDOS. Este Edit/Write sobre " + file + " pasa para que se puedan arreglar; todo lo demas sigue bloqueado hasta que el modulo vuelva a cargar (node --check scripts/_lib/guardianes.mjs)." } }));
      process.exitCode = 0;
      soltar();
      return;
    }
    process.stderr.write(error + "Bloqueo por seguridad. Para arreglarlo, un Edit/Write sobre scripts/_lib/guardianes.mjs (o sus modulos y .data.json) SI pasa.\n");
    process.exitCode = 2;
    soltar();
  });
});
' "$TMP" "${BASH_SOURCE[0]}"
RC=$?

if [ "$RC" -ne 0 ] && [ "$RC" -ne 2 ]; then
  echo "[GUARDIANES] node salio con codigo $RC — bloqueo por seguridad (revisar scripts/_lib/guardianes.mjs)." >&2
  RC=2
fi

# supabase-guard: solo si node dejo la marca (script destructivo contra Supabase) y nada
# bloqueo. Corre el backup ANTES del comando. Antes corria aunque otro guardian bloqueara el
# comando: un backup para un comando que no iba a correr.
if [ "$RC" -eq 0 ] && [ -f "$TMP/supabase" ]; then
  DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"     # solo en esta rama (rara): no se paga en cada comando
  export HOOK_CMD="$(<"$TMP/cmd")"
  ( source "$DIR/supabase-guard.sh" ) < "$TMP/input" 2>"$TMP/err"
  RC2=$?
  MSG="$(<"$TMP/err")"
  [ -n "$MSG" ] && printf '%s\n' "$MSG" >&2
  [ "$RC2" -eq 2 ] && RC=2
fi

exit "$RC"
