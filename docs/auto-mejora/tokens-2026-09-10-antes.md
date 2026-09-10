# Medición base — 10/09/2026, ANTES de tocar la prosa (Ola B)

`node scripts/_tokens.mjs --desde 2026-09-02`, sobre los transcripts de `~/.claude/projects/C--Dev-BarackMercosul/`.
Definición de cada métrica: cabecera de `scripts/_tokens.mjs`. Se repite con el mismo comando
después de la Ola B (objetivo: contexto del primer turno ≤ 55k) y a las dos semanas (C2: % de
turnos > 400k y mensajes de límite, para decidir si la ventana de compactación se mueve).

| Métrica | Valor |
|---|---|
| Sesiones con trabajo / turnos del modelo / mensajes de Fak | 68 / 33.811 / 550 |
| Contexto del 1er turno p50 / max | 77k / 100k |
| Compactaciones | 100 |
| Turnos con contexto > 400k | 9.652 (28,5 %) |
| AskUserQuestion | 37 |
| Cierres que piden permiso (lista del hook Stop) | 15 |
| Mensajes sobre el límite de uso | 12 |
| Arranques en inglés / justo post-compactación | 22 / 4 |

Effort por mensaje del asistente: opus-5 xhigh 21.322 · opus-5 (sin effort) 5.617 · fable-5-1 xhigh 2.981 ·
fable-5 xhigh 1.380 · sonnet-5 xhigh 650 · **opus-5 max 54** → `effortLevel: "max"` del settings global no se
aplicaba; se quitó el 10/09 (C1). `xhigh` es el default de Claude Code y el recomendado por la guía de Fable 5.1.

Estado del mismo día: CLI del PATH actualizada 2.1.137 → 2.1.267 (`claude update`, backup en
`~/.local/bin/claude.exe.bak`); hook `InstructionsLoaded` → `.claude/.instrucciones-cargadas.log` (C5).
