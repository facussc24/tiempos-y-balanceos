# recordatorio-ccsc (P34)

Mod de Claude Code (probado contra la app de escritorio 2.1.293, Windows 11). Cuando un prompt de Fak o un Edit/Write de Claude toca las siglas CC, SC, CS, D/TLD, el triangulo del manual o la palabra flujograma, le agrega al modelo un `context` con los nueve renglones de la regla `.claude/rules/caracteristicas-especiales.md`. Sale una vez por hora como mucho (la marca vive en `$.store`, compartida por todas las sesiones de la PC) y nunca frena nada: siempre `next(e)`.

- Parte pura: `hooks/recordatorio.mjs` (sin `$`). Test: `__tests__/mods/recordatorio-ccsc.test.mjs`.
- Cascara: `hooks/register.js` (`session.start`, `prompt.submit`, `tool.call` sobre Edit/Write).
- Registro: `~/.claude/mods-log/recordatorio-ccsc.log`, una linea por evento (`RECORDATORIO` o `silencio (faltan N min)`).

## Instalar (la app carga una copia en ~/.claude, no el repo)

```bash
mkdir -p ~/.claude/mods ~/.claude/mods-log
rm -rf ~/.claude/mods/recordatorio-ccsc && cp -r /c/Dev/BarackMercosul/mods/recordatorio-ccsc ~/.claude/mods/
