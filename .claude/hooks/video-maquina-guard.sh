#!/usr/bin/env bash
# video-maquina-guard.sh — wrapper fino. La logica vive en scripts/_lib/guardianes.mjs
# (guardian "video-maquina-guard"), junto con la de los otros catorce: el despachador
# _dispatcher.sh los corre a todos dentro de UN solo node.
#
# Que hace: BLOQUEA dejar un video (.MOV/.MP4/.M4V) en una carpeta del Escritorio — su lugar es
# `5- VIDEOS Y FOTOS` de la biblioteca de Ingenieria, por cliente/maquina y con nombre
# `AAAA-MM-DD - lo que se ve (IMG_xxxx).MOV` — y BLOQUEA copiar del telefono por MTP sin haber
# cruzado antes contra esa biblioteca (`node scripts/_videoBiblioteca.mjs --cruzar <indice.tsv>`,
# que deja la marca ~/.claude/.cruce-video; vale 12 h).
# Incidente 2026-09-07: 13 videos (5,59 GB) rebajados del celular estando archivados desde el
# 02/09. Regla: .claude/rules/video-maquina.md
#
#   printf '%s' "$JSON" | bash .claude/hooks/video-maquina-guard.sh   # 0 pasa · 2 bloquea
RAIZ="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
exec node "$RAIZ/scripts/_lib/guardianes.mjs" --solo video-maquina-guard
