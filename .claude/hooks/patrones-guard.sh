#!/usr/bin/env bash
# patrones-guard.sh — RECORDATORIO (1x por hora) de los 3 gates de patrones de corte.
# Detalle y librería: skill patrones-corte-plotter · regla .claude/rules/patrones-corte.md
#
# HONESTIDAD: esto NO es enforcement — bloquea UNA llamada y recuerda los gates; la
# siguiente pasa. El enforcement DURO vive en patronlib.entregar(), que levanta
# EntregaRechazada y NO escribe el PLT si el contorno se movio, si una cruz quedo a
# menos de 3 mm del filo, si un brazo no mide 6.000 o si el patron esta chueco.
#
# Matching por tool_name para no disparar con read-only que solo MENCIONAN un .dxf:
# Bash/PowerShell solo si EJECUTA python sobre algo de patrones; Write/Edit solo si
# escribe un .dxf/.plt o un .py que importa ezdxf/patronlib.
#
# Exit 0 = permite. Exit 2 = bloquea con recordatorio.

set -e
INPUT=$(cat)

# Camino rapido: si el despachador ya parseo el JSON, lo reuso.
# Si no (guardian corrido suelto), parseo yo como siempre.
if [ -n "${HOOK_PARSED4+x}" ]; then
  PARSED="$HOOK_PARSED4"
else
PARSED=$(printf '%s' "$INPUT" | node -e '
let s = "";
process.stdin.on("data", d => s += d);
process.stdin.on("end", () => {
  try {
    const j = JSON.parse(s);
    const t = j?.tool_input || {};
    const clean = x => String(x ?? "").replace(/[\x1f\n\r]/g, " ");
    process.stdout.write([
      clean(j?.tool_name),
      clean(t.command).slice(0, 4000),
      clean(t.file_path),
      clean(t.content ?? t.new_string).slice(0, 4000)
    ].join("\x1f"));
  } catch { process.stdout.write(""); }
});
' 2>/dev/null || true)
fi

MATCH=0
if [ -z "$PARSED" ]; then
  # Fallback si node no pudo parsear: NO desactivarse en silencio
  printf '%s' "$INPUT" | grep -qiE '(ezdxf|patronlib|\.(dxf|plt|hpgl)([^a-z]|$))' && MATCH=1
else
  IFS=$'\x1f' read -r TOOL CMD FILE BODY <<< "$PARSED"
  case "$TOOL" in
    Bash|PowerShell)
      if printf '%s' "$CMD" | grep -qiE '(python|\.venv-cad)'; then
        printf '%s' "$CMD" | grep -qiE '(ezdxf|patronlib|\.(dxf|plt|hpgl)([^a-z]|$))' && MATCH=1
      fi ;;
    Write|Edit)
      printf '%s' "$FILE" | grep -qiE '\.(dxf|plt|hpgl)$' && MATCH=1
      if [ "$MATCH" -eq 0 ] && printf '%s' "$FILE" | grep -qiE '\.py$'; then
        printf '%s' "$BODY" | grep -qiE '(import +ezdxf|from +ezdxf|import +patronlib|from +patronlib)' && MATCH=1
      fi ;;
  esac
fi

[ "$MATCH" -eq 0 ] && exit 0

# Cooldown 60 min.
# El flag va a una ruta que NO depende de TMPDIR (en los hooks puede venir distinto o
# vacio, y entonces el recordatorio se dispara en cada llamada en vez de 1x/h).
FLAGDIR="${HOME:-/tmp}/.claude"
mkdir -p "$FLAGDIR" 2>/dev/null || true
FLAG="$FLAGDIR/patrones-guard.flag"
NOW=$(date +%s 2>/dev/null || echo 0)
LAST=$(cat "$FLAG" 2>/dev/null || echo 0)
case "$LAST" in ''|*[!0-9]*) LAST=0 ;; esac
case "$NOW" in ''|*[!0-9]*) NOW=0 ;; esac
if [ "$NOW" -gt 0 ] && [ "$LAST" -gt 0 ] && [ $((NOW - LAST)) -lt 3600 ]; then
  exit 0
fi
printf '%s' "$NOW" > "$FLAG" 2>/dev/null || true

cat >&2 << 'EOF'
[PATRONES-GUARD — RECORDATORIO 1x/h de los 3 gates. Detalle: skill patrones-corte-plotter]
Los 2 errores caros de este trabajo no se ven mirando: se miden en 3 segundos.

GATE 1 — APLOMO (posicion 0), ANTES de mover nada:
  gate_aplomo(C). La pieza apoyada en la mesa toca en 2 puntos: el envolvente convexo
  INFERIOR. Esa recta es el datum. Si el patron esta chueco, "1 mm para abajo" se va en
  diagonal -> convertir los deltas con a_marco_pieza() o enderezar primero.
  NO ajustar una recta al borde inferior: es curvo, devuelve la curvatura y no el giro.

GATE 2 — DIRECCION: EL CHEQUEO FRENA, NO DECIDE.
  Si Fak dice "moveme el punto 4,5 a la derecha", eso es un DATO, no una hipotesis.
  Si tabla_4_combinaciones() da alarma (punto a menos de 3 mm del filo; sano 5-17 mm),
  la accion correcta es MOSTRARLE LA TABLA Y PREGUNTAR — jamas invertirle la direccion
  por cuenta propia. Invertir en silencio ya rompio un patron (30/07/2026).
  Y ojo con la regla de negocio que hace que la alarma sea un falso positivo:
  PARA QUE LA COSTURA VAYA A LA IZQUIERDA, EL PUNTO VA A LA DERECHA (se mueven en
  sentido contrario). Que el punto se acerque al filo puede ser exactamente lo buscado.
  Anclar a la anatomia (punta_fina), nunca a "izquierda/derecha" ni al nombre del archivo.

GATE 3 — VERIFICACION RITUAL antes de entregar:
  contorno con desviacion maxima 0.000000 mm · brazos de cruz en 6.000 · misma cantidad
  de entidades · piquetes sin mover · Y MIRAR la imagen de comparacion, con un zoom por
  CADA punto movido.

Mover trasladando los brazos existentes (nunca reconstruir la cruz) y guardar con
doc.saveas() sobre el documento leido. Enforcement duro: patronlib.entregar().
Si ya cumpliste (o no aplica), reintenta y segui.
EOF
exit 2
