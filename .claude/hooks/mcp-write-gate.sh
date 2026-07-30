#!/usr/bin/env bash
# mcp-write-gate.sh — candado BLOQUEANTE de escrituras a documentos APQP via MCP.
#
# POR QUE (2026-07-30): el unico hook que miraba las escrituras por MCP era
# supabase-write-flag.sh, que hace `exit 0` siempre — solo observa. O sea que un
# `UPDATE amfe_documents SET data = ...` o un `DELETE FROM cp_documents` salia sin
# que nada lo frenara, y sin backup restaurable del otro lado. El ultimo backup de
# archivos valido es del 25/06 con 2 de 12 tablas (verificado con _restore --list).
#
# QUE BLOQUEA: solo lo IRREVERSIBLE sobre los 4 tipos de documento APQP —
# UPDATE que toca la columna `data`, DELETE, TRUNCATE y DROP. Un INSERT de un
# documento nuevo no destruye nada y pasa. Los SELECT pasan.
#
# QUE PIDE: evidencia de un backup de menos de 60 minutos. La escribe
# `scripts/_backup.mjs` cuando termina VERDE (no cuando corre: cuando pasa las
# aserciones por tabla).
#
# OVERRIDE: `BARACK_BACKUP_OK="motivo"`. Es a proposito explicito y ruidoso, no un
# `--no-verify` silencioso: queda escrito el motivo en el log del hook. Un candado
# sin salida documentada termina desactivado entero en un mes, que es peor.
#
# FAIL-CLOSED: si node no puede parsear el payload, se cae al grep del JSON crudo
# (mismo patron que cad-guard.sh) en vez de desactivarse en silencio.

INPUT=$(cat)
FLAG="${TMPDIR:-/tmp}/claude-backup-ok.flag"
LOG="${TMPDIR:-/tmp}/claude-mcp-write-gate.log"
MAX_EDAD=3600  # 60 minutos

PARSED=$(printf '%s' "$INPUT" | node -e '
let s = "";
process.stdin.on("data", d => s += d);
process.stdin.on("end", () => {
  try {
    const j = JSON.parse(s);
    const tool = String(j?.tool_name ?? "");
    const q = String(j?.tool_input?.query ?? j?.tool_input?.sql ?? "");
    // Sacar comentarios para que no escondan el verbo real.
    const sql = q.replace(/^\s*--[^\n]*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "");
    const DOCS = "(amfe|cp|ho|pfd|deleted)_documents";

    let destructivo = "";
    // UPDATE de un documento que toca la columna data.
    if (new RegExp("\\bupdate\\s+(public\\.)?" + DOCS + "\\b[\\s\\S]*\\bset\\b[\\s\\S]*\\bdata\\s*=", "i").test(sql))
      destructivo = "UPDATE de la columna data";
    else if (new RegExp("\\bdelete\\s+from\\s+(public\\.)?" + DOCS + "\\b", "i").test(sql))
      destructivo = "DELETE de documentos";
    else if (new RegExp("\\btruncate\\b[\\s\\S]*" + DOCS, "i").test(sql))
      destructivo = "TRUNCATE";
    else if (new RegExp("\\bdrop\\s+table\\b[\\s\\S]*" + DOCS, "i").test(sql))
      destructivo = "DROP TABLE";

    process.stdout.write(destructivo + "\x1f" + tool);
  } catch { process.stdout.write("\x1fPARSE_ERROR"); }
});
' 2>/dev/null || printf '\x1fPARSE_ERROR')

DESTRUCTIVO="${PARSED%%$'\x1f'*}"
TOOL="${PARSED##*$'\x1f'}"

if [ "$TOOL" = "PARSE_ERROR" ]; then
  # No pudimos parsear: grep burdo del JSON crudo. Preferimos un falso positivo
  # molesto antes que dejar pasar un DELETE por no haber podido leer el payload.
  if printf '%s' "$INPUT" | grep -qiE '(delete[[:space:]]+from|truncate|drop[[:space:]]+table)[^"]*(amfe|cp|ho|pfd)_documents'; then
    DESTRUCTIVO="operacion destructiva (payload no parseable)"
  fi
fi

# Nada destructivo: pasar sin ruido.
[ -z "$DESTRUCTIVO" ] && exit 0

# --- Hay una operacion destructiva. Buscar evidencia de backup. ---------------

if [ -n "$BARACK_BACKUP_OK" ]; then
  printf '%s override: %s | %s\n' "$(date -Is)" "$BARACK_BACKUP_OK" "$DESTRUCTIVO" >> "$LOG" 2>/dev/null
  echo "mcp-write-gate: override activo (BARACK_BACKUP_OK=\"$BARACK_BACKUP_OK\"). Registrado en $LOG." >&2
  exit 0
fi

AHORA=$(date +%s)
EDAD=""
if [ -f "$FLAG" ]; then
  TS=$(head -1 "$FLAG" 2>/dev/null | tr -dc '0-9')
  [ -n "$TS" ] && EDAD=$((AHORA - TS))
fi

if [ -n "$EDAD" ] && [ "$EDAD" -ge 0 ] && [ "$EDAD" -lt "$MAX_EDAD" ]; then
  echo "mcp-write-gate: backup verificado hace $((EDAD / 60)) min. $DESTRUCTIVO permitido." >&2
  exit 0
fi

cat >&2 <<MSG
BLOQUEADO por mcp-write-gate: $DESTRUCTIVO sobre documentos APQP sin backup reciente.

$(if [ -z "$EDAD" ]; then echo "  No hay evidencia de backup ($FLAG no existe)."; else echo "  El ultimo backup verificado fue hace $((EDAD / 60)) min (el maximo es $((MAX_EDAD / 60)))."; fi)

Esto es lo unico irreversible del proyecto. Antes de seguir:

  1. node scripts/_backup.mjs
     Escribe la evidencia SOLO si pasa las aserciones por tabla.
     Hoy aborta si falta VITE_AUTO_LOGIN_PASSWORD en .env.local: eso es correcto,
     no es un bug del gate.

  2. Confirmar que quedo: node scripts/_restore.mjs --list
     La carpeta nueva tiene que aparecer con filas > 0.

Si el backup no se puede hacer y la escritura es igual necesaria, la salida es
explicita y queda registrada:

  BARACK_BACKUP_OK="motivo concreto" <comando>

Recordar que existe la papelera: node scripts/_trash.mjs --list
MSG
exit 2
