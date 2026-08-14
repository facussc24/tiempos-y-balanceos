#!/usr/bin/env bash
# Mail Guard Hook (PreToolUse, matcher = Bash|PowerShell|Write|Edit)
#
# Bloquea cualquier envio de mail por Outlook que NO pase por
# scripts/_mailEnviar.py, que es el unico camino con gate anti-duplicado.
#
# POR QUE EXISTE (incidente 2026-08-14)
#   Fak mando el mail del AMFE 150; quedo en la Bandeja de salida sin transmitir.
#   Mire la cola, vi el item ahi y afirme "el mail no salio, no hay nada que
#   recuperar". Lo saque de la cola, lo edite y lo mande con un `.Send()` suelto
#   escrito al vuelo: salieron DOS mails a Marcelo, Nicolas y Carlos.
#   Al listar Enviados YA HABIA aparecido la entrada que coincidia en asunto,
#   destinatarios, CC y adjunto — y la explique como "copia vieja".
#
#   Un item en la Bandeja de salida NO prueba que el mensaje no se haya enviado.
#
# La leccion escrita no alcanza: el `.Send()` se escribe en 3 segundos dentro de
# un heredoc. Por eso el bloqueo es aca.
#
# Exit 0 = permite. Exit 2 = bloquea (stderr se muestra al modelo).

set -e

INPUT=$(cat)

# Camino rapido: si el despachador ya parseo, reuso. Si no, parseo yo.
if [ -n "${HOOK_PARSED4+x}" ]; then
  IFS=$'\x1f' read -r _TOOL _CMD _FILE _CONTENT <<< "$HOOK_PARSED4"
  TARGET="$_CMD $_FILE $_CONTENT"
else
  TARGET=$(printf '%s' "$INPUT" | node -e '
let s = "";
process.stdin.on("data", d => s += d);
process.stdin.on("end", () => {
  try {
    const j = JSON.parse(s); const t = j?.tool_input || {};
    const j2 = [t.command, t.file_path, t.content, t.new_string]
      .map(x => String(x ?? "")).join(" ");
    process.stdout.write(j2.replace(/[\x1f\n\r]/g, " ").slice(0, 8000));
  } catch { process.stdout.write(""); }
});
' 2>/dev/null || true)
fi

[ -z "$TARGET" ] && exit 0

# 1) Tiene que oler a Outlook. Sin esto, cualquier .Send() de otra libreria
#    (sockets, APIs) caeria aca y seria ruido.
if ! echo "$TARGET" | grep -qiE "Outlook\.Application|olMailItem|GetDefaultFolder|MailItem|CreateItem\("; then
  exit 0
fi

# 2) Tiene que haber un envio real. Display/Save/ReplyAll NO envian.
if ! echo "$TARGET" | grep -qiE "\.Send\(\)|\.Send[[:space:]]*\(|SendAndReceive|\.Submit\("; then
  exit 0
fi

# 3) Si va por la via autorizada, pasa.
if echo "$TARGET" | grep -qE "_mailEnviar\.py"; then
  exit 0
fi

cat >&2 << 'EOF'

[MAIL-GUARD — BLOQUEO. Regla: .claude/rules/mail-envio.md]

Estas por mandar un mail con un .Send() suelto. Eso ya salio mal.

INCIDENTE 2026-08-14: Fak mando el mail del AMFE 150, quedo en la Bandeja de
salida sin transmitir, mire la cola y afirme "no salio, no hay nada que
recuperar". Lo edite y lo mande. Salieron DOS mails a Marcelo, Nicolas y Carlos.
Peor: la entrada duplicada YA ESTABA en Enviados —mismo asunto, mismos
destinatarios, mismo CC, mismo adjunto— y la explique como "copia vieja".

  Un item en la Bandeja de salida NO prueba que el mensaje no se haya enviado.
  Outlook puede tener la copia en Enviados y el item en cola al mismo tiempo.

EL CAMINO CORRECTO — deja el borrador armado con .Display() y despues:

    python scripts/_mailEnviar.py --buscar "<parte del asunto>"            # dry-run
    python scripts/_mailEnviar.py --buscar "<parte del asunto>" --enviar

Ese script, antes de enviar:
  - barre Enviados de las ultimas 72 h y ABORTA si algo coincide por
    asunto + destinatarios + adjuntos (no solo asunto, no solo una vez al empezar)
  - chequea que no haya nada de ese asunto en la Bandeja de salida
  - abre una ventana de Outlook si no hay ninguna (sin ventana no transmite)
  - despues de enviar verifica que la cola quedo vacia y que aparecio en Enviados,
    y si quedo trabado diagnostica los flags MAPI

REGLA DE FONDO, que ningun script reemplaza: un mail que Fak ya mando NO SE TOCA.
Se le reporta que esta mal y decide el.

Si de verdad hay que mandar algo que el gate marca como duplicado, requiere OK
EXPLICITO de Fak para ese mail y se corre con --forzar.

EOF

exit 2
