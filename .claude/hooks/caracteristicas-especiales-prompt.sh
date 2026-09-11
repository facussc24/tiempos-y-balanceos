#!/usr/bin/env bash
# caracteristicas-especiales-prompt.sh — UserPromptSubmit, matcher vacio. NO bloquea.
#
# Cuando el mensaje de Fak nombra las caracteristicas especiales (CC/SC, D/TLD, critica,
# significativa, la sigla, las marcas del flujograma, el I-AC-005...), inyecta el criterio
# canonico como additionalContext, SIN cooldown. Pedido textual de Fak, 11/09/2026: "siempre
# que te preguntes, recuerdes todo esto... me gustan esas memorias pero a veces no las lees".
# Ese dia llame "error" a que dos causas S7 O3 perdieran su D/TLD comparando contra un backup,
# sin mirar S y O ("estas tirando como al azar... es un error gravisimo que debemos corregir
# para siempre").
#
# El texto (`recordatorio`) y los disparadores (`prompt_disparadores`) viven en
# core/amfe/caracteristicasEspeciales.data.json — la MISMA fuente que leen el validador, la app
# y el guard PreToolUse. Si el JSON no se puede leer, avisa por stderr y no inyecta nada.
# Contrato: exit 0 siempre; stdout = {"hookSpecificOutput":{"hookEventName":"UserPromptSubmit",
# "additionalContext":"..."}} o vacio. Test: __tests__/scripts/hooksVarios.test.mjs.
RAIZ="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
INPUT=$(cat)

printf '%s' "$INPUT" | node -e '
const fs = require("fs");
const path = require("path");
// bash de Git entrega /c/Dev/...: node en Windows lo leeria como C:\c\Dev\... (mismo arreglo que _dispatcher.sh).
const raiz = String(process.argv[1] || ".").replace(/^\/([a-zA-Z])\//, (m, d) => d.toUpperCase() + ":/");
let s = "";
process.stdin.on("data", (d) => { s += d; });
process.stdin.on("end", () => {
  let prompt = "";
  try { prompt = String(JSON.parse(s).prompt ?? ""); } catch { prompt = s; }
  let canon = null;
  try { canon = JSON.parse(fs.readFileSync(path.join(raiz, "core", "amfe", "caracteristicasEspeciales.data.json"), "utf8")); } catch {}
  if (!canon || !Array.isArray(canon.prompt_disparadores) || !Array.isArray(canon.recordatorio)) {
    process.stderr.write("[CARACTERISTICAS-ESPECIALES-PROMPT] core/amfe/caracteristicasEspeciales.data.json ilegible: el recordatorio quedo apagado.\n");
    return;
  }
  if (!canon.prompt_disparadores.some((d) => new RegExp(d.regex, "i").test(prompt))) return;
  process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: "UserPromptSubmit", additionalContext: canon.recordatorio.join("\n") } }));
});
' "$RAIZ"
exit 0
