#!/usr/bin/env bash
# supabase-write-flag.sh — marca que la sesion ESCRIBIO en Supabase via MCP
# (execute_sql con DML/DDL o apply_migration). El session-close-guard usa el flag
# para recordar backup/auditor aunque no haya archivos git modificados
# (gap detectado 2026-07-16: sesion solo-datos cerraba sin aviso).
#
# Siempre exit 0 (solo observa).

INPUT=$(cat)

IS_WRITE=$(printf '%s' "$INPUT" | node -e '
let s = "";
process.stdin.on("data", d => s += d);
process.stdin.on("end", () => {
  try {
    const j = JSON.parse(s);
    const tool = String(j?.tool_name ?? "");
    const q = String(j?.tool_input?.query ?? j?.tool_input?.sql ?? "");
    if (/apply_migration/.test(tool)) { process.stdout.write("1"); return; }
    // Escritura = un STATEMENT que empieza con verbo DML/DDL. Un SELECT que
    // menciona columnas como created_at/updated_at NO debe marcar la sesion.
    const sql = q.replace(/^\s*--[^\n]*$/gm, "");
    const W = "(insert|update|delete|create|alter|drop|truncate)";
    const starts = new RegExp("^\\s*" + W + "\\b", "i");
    const afterSemi = new RegExp(";\\s*" + W + "\\b", "i");
    const writableCte = new RegExp("^\\s*with\\b[\\s\\S]*\\)\\s*" + W + "\\b", "i");
    if (starts.test(sql) || afterSemi.test(sql) || writableCte.test(sql)) { process.stdout.write("1"); return; }
    process.stdout.write("0");
  } catch { process.stdout.write("0"); }
});
' 2>/dev/null || echo 0)

if [ "$IS_WRITE" = "1" ]; then
    date +%s > "${TMPDIR:-/tmp}/claude-supabase-write.flag" 2>/dev/null
fi
exit 0
