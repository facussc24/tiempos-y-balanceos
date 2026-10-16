# Plan — tanda 3 del plan del sistema: guardianes que frenan de más (16/10/2026)

Lo escribió la sesión Fable 5.1 de la PC principal (`34df5f0e`) a partir de `10-PLAN_SISTEMA_2026-10-16.md` (tanda 3, 14 y 15)
y del informe `20-informes\casa_guardianes_frenos.md` (CATA, 15/10; sus scripts y datos en `20-informes\scripts\frenos\`).
Lo implementa una hija en Opus 5.5 en su worktree, sin push; cada guardián es un cambio **mediano** (plan corto en el chat de la
hija, test en las dos direcciones, **probado por OTRO**: el auditor Opus que no lo escribió), un commit por guardián.
**El sí de Fak ya está para los 7 aflojes** (15/10 ≈ 16:00, plan §3 punto 1: «sí»; los otros 3 ya lo tenían del 09/10).

## Lo medido que manda
30 días, 436 frenos; sin el de tamaño de script: 71 verdaderos, 51 falsos, 141 sin determinar. Los 5 patrones de falso con su
expresión culpable, 2 comandos reales cada uno y el cambio mínimo están en el **§3 del informe**; los verdaderos que evitaron daño,
en el §4. Los 263 comandos Bash reales (los 436 menos 173 de script-inline y 130 que no son Bash) son la prueba.

## Piezas (un commit cada una, en este orden)

1. **P18 · borrado-masivo** (sí del 09/10): deja pasar borrar temporales de `mktemp`, `__pycache__` y los scripts que PRUEBAN un guardián (13 falsos de 71). Lógica en `scripts/_lib/guardianes.mjs`; el criterio: zona y verbo en la misma sentencia (como ya hace `vidSentencias`).
2. **P12 · secretos-guard**: `ls -la .env.local | head` no es leer el secreto (9 falsos de 12: el `head` cuenta como lector aunque lea la salida del `ls`). Lo que sigue frenando: `cat`, `type`, `Get-Content`, `sed -n`, `grep` SOBRE el archivo.
3. **P13 · apqp-cliente**: distinguir origen de destino en un `cp` del listado (8 de 19): copiar DESDE `1. Imput`/el listado hacia afuera es leer; copiar HACIA, escribir.
4. **escritorio-guard**: zona + verbo tienen que estar en la misma sentencia (11 V / 8 F de 22; los 8 falsos cruzan dos pedazos del mismo comando compuesto).
5. **script-inline · `cat >>`**: agregar a un archivo (`>>`) no es escribir un script inline que pisa (6 de 173); sigue frenando `cat >` y los heredocs que crean un script y lo ejecutan.
6. **mail-guard en tests y scratchpad**: un Write de un archivo bajo `__tests__/` o del scratchpad que NOMBRA mails no es mandar un mail (6 de 14; la regla exacta no se ubicó: encontrarla en `guardianes.mjs` / `mailGuard` y escribir el caso). Lo que sigue frenando: `.Send()`, `--enviar`, `_mailEnviar.py` fuera del camino.
7. **video-maquina · `Namespace(17)`**: el caso del pendrive del 15/10 (`Namespace(17)` + un `cp` suelto en el mismo comando): expulsar un pendrive no es borrar material de Fak.
8. **Retiros con sí del 09/10**: `dev-server-guard` (P11: 4 de 4 falsos; se SACA del settings y del repo, no se optimiza) y `timeout-guard` de PostToolUse (P20: 51.800 corridas, 6 avisos). Nada se borra del historial: el archivo del hook pasa a `.claude/hooks/_retirados/` con un renglón de por qué.
9. **Permisos de un solo uso** (regla + canon): el escape (`.apqp-listado-ok`, `.arb-cerrar-ok`, `.agent-opus-ok`, `.encargo-libre`…) lo escribe la sesión solo con la frase de Fak en el mismo turno y la cita en el comando (`: > ~/.claude/.x-ok # Fak 15/10 13:55: "hacelo sí"`); `permisoGuard --registro` los lista; sin la cita, el freno vale. Hoy: 10 escapes armados por la propia sesión, 4 con sí explícito, 2 sin, y el `arb-cerrar-ok` del 02/10 con un `taskkill` que se ejecutó igual. Va en `.claude/rules/autonomy-contract.md` (o la regla del guardián que corresponda) con un test del formato de la cita.
10. **Condición previa para cualquier MCP nuevo** (tanda 15): `_dispatcher.sh` corre solo para Bash, PowerShell, Write y Edit; **extenderlo a `mcp__*`** con el molde de `mcp-write-gate.sh` (que ya mira Supabase), con test en las dos direcciones (una llamada MCP que escribe/manda → la mira el guardián que corresponda; una que lee → pasa). Antes de instalar el primer MCP nuevo (CATIA, text-to-cad, context-mode).
11. **`onFailure: "block"`** solo en `mcp-write-gate.sh` (Supabase) y en el de mails (v2.1.295): los dos donde dejar pasar es peor que frenar. Test: hook roto → frena.
12. **Hook `PreModelSwitch`** (existe desde la semana 36): bloquea el cambio de modelo a mitad de la sesión salvo frase de Fak en el mismo turno (CLAUDE.md: «no tocar el selector por cuenta propia»; con Fable de sesión principal, cambiar pierde el caché y el razonamiento). Mediano.
13. **No se toca**: el presupuesto de agentes, `commit-rutas`, `push`: casi no fallan.

## La prueba de la tanda (no se da por hecha sin esto)
`20-informes\scripts\frenos\clasif2.json` (436 etiquetas V / F / SD) y `frenos_bruto4.jsonl` (los comandos): escribir
`scripts/_frenosMedir.mjs` que pase los **263 comandos Bash** por los guardianes nuevos (`guardianes.mjs` en modo prueba, sin
ejecutar nada) y compare etiquetas: **los 51 falsos pasan, los 71 verdaderos siguen frenando, los demás no cambian de
resultado** (diferencial, como HOY-28). Los scripts leen rutas de CATA (`C:\Users\catav\...`): adaptar la carpeta de `.jsonl`.
Es también la medición mensual que el plan pide (§6, número 4).

## Qué puede romper
- Aflojar un control abre un agujero: por eso cada cambio lleva el par «lo real sigue frenando» con los comandos reales del §4.
- **Si `guardianes.mjs` revienta, `_dispatcher.sh` devuelve exit 2 en Bash, Write y Edit de TODAS las sesiones** (tanda 14, 2): antes de cada commit `node --check scripts/_lib/guardianes.mjs` y una corrida del despachador con un payload real; el destrabe oficial es `"disableAllHooks": true` en el settings o `claude --safe-mode` (lo escribe Fak).
- Un guardián que falla sin bloquear está apagado (LECCIONES 22/09): los tests de `hooksTienenTest` (5c) tienen que seguir en verde.

## Cómo se entrega
Rama del worktree, un commit por pieza con rutas, sin push; `npm test` entera corrida por la hija (agrega archivos); auditor Opus
con el informe a `docs/auditorias/`; en el último turno: rama, commits, la tabla diferencial (51 / 71 / resto), lo que quedó sin
hacer y por qué, y qué necesita de la madre o de Fak.
