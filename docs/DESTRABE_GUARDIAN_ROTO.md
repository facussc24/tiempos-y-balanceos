# Si un guardián roto traba todas las sesiones: el destrabe oficial (lo hace Fak, 30 segundos)

Tanda 15 del plan del sistema (18/10/2026), ítem 2 del informe E. Reemplaza el destrabe que la tanda 14 había
inferido sin probar (arreglar `guardianes.mjs` desde otro worktree).

## Cuándo

Cuando en TODAS las sesiones cualquier comando, escritura o edición vuelve frenado con un texto del despachador
(`_dispatcher.sh`) que dice que algo no cargó. La sesión trabada no se puede destrabar sola: el freno le corta justo las
herramientas con que lo arreglaría. Si lo roto es solo `scripts/_lib/guardianes.mjs`, la sesión todavía puede editarlo
(el despachador deja pasar un Edit o un Write sobre ese archivo y sus datos); para todo lo demás, esto.

## Qué hace Fak

1. Cerrar las sesiones trabadas.
2. Abrir con el Bloc de notas el archivo de configuración de su usuario:
   - en la PC principal: `C:\Users\FacundoS-PC\.claude\settings.json`
   - en la notebook CATA: `C:\Users\catav\.claude\settings.json`
3. Debajo de la primera llave `{`, pegar este renglón y guardar:

   ```
     "disableAllHooks": true,
   ```

4. Abrir una sesión nueva en `C:\Dev\BarackMercosul` y pedirle que arregle el guardián roto. Esa sesión corre **sin
   ningún freno de la casa y sin los mods** (presupuesto de agentes, tablero): conviene que arregle solo eso.
5. Cuando esté arreglado, **sacar el renglón** (o cambiar `true` por `false`) y abrir sesiones nuevas.

Otra forma, solo para la consola de la PC principal: `claude --safe-mode` adentro de `C:\Dev\BarackMercosul` arranca una
sesión sin CLAUDE.md, skills, plugins, hooks, MCP ni memoria (o con la variable `CLAUDE_CODE_SAFE_MODE=1`). En CATA
`claude` no está en el PATH, así que ahí va el paso del Bloc de notas.

## De dónde sale y qué se verificó

- **La documentación oficial** de Claude Code: `disableAllHooks` en «Disable or remove hooks»
  (code.claude.com/docs/en/hooks.md) y en la referencia de settings; `--safe-mode` y `CLAUDE_CODE_SAFE_MODE` en la guía
  para depurar la configuración (debug-your-config.md) y en env-vars.md (informe E del 15/10, ítem 2).
- **El ejecutable instalado en la PC principal** (Claude Code 2.1.302, `C:\Users\FacundoS-PC\.local\bin\claude.exe`,
  leído el 18/10): trae los mensajes «hooks are turned off in your settings (disableAllHooks)» y «the session runs in
  safe mode», y los dos casos apagan también los mods instalados. `claude --help` de esa versión lista `--safe-mode`.
- **Precedencia**: un `"disableAllHooks": false` en el `.claude/settings.json` del repo le ganaría al `true` del usuario.
  Medido el 18/10: ni el settings del repo, ni el del usuario, ni el `.claude/settings.local.json` del checkout principal
  (existe, del 14/10) tienen esa clave.
- **No se probó** que una sesión ya abierta tome el cambio sin reabrirse (la doc dice que los cambios a los hooks
  «normalmente» se toman solos): por eso el paso 4 abre una sesión nueva.
- **No se probó de punta a punta** con un guardián roto de verdad: lanzar una sesión de prueba desde esta PC por
  consola no anda (la consola no tiene la sesión iniciada; memoria del 02/10).

## Para no llegar a esto

Antes de fundir algo que toque `guardianes.mjs` o un hook: `node --check scripts/_lib/guardianes.mjs` y
`node scripts/_despachadorPayloads.mjs` (los seis pedidos conocidos de `__tests__/scripts/despachadorPayloadsConocidos.jsonl`
con un HOME aparte; tiene que dar 2 2 2 2 0 0). **Nunca con el HOME real**: dos de los pedidos escriben el listado
maestro y gastan el permiso de un solo uso que Fak haya dejado (auditor de la tanda 15). Está en la regla
`codigo-madre.md` y su test corre en cada suite.
