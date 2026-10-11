# Sesión de código en Opus 5.5 — instalar los mods y aplicar lo que quedó preparado (sin Fak en el laburo)

Pedido de Fak, 11/10/2026 04:05: *"podemos implementar todo en una nueva sesión... el de SC/CC al pedo me parece,
pero los otros 2 mods sí me parecen útiles... y todo lo que se pueda implementar sin necesidad de estar en el laburo,
con Opus"*.

## Cómo se arranca

Sesión nueva en la pestaña Code, modelo **Opus 5.5**, en `C:\Dev\BarackMercosul` (no en un worktree: los mods y los hooks
se instalan desde acá). Primer mensaje: *«Leé `docs/drafts/PROMPT_SESION_OPUS_2026-10-11_mods.md` y hacelo»*.

Antes de tocar nada: leer la memoria `project_tanda_orquestador_2026-10-10_donde_quedo` (sección «La ola por la API») y
las filas de la cola que nombra cada paso. Los materiales están en `.sgc-cache/investigacion-2026-10-11/` (borradores en
`codigo_api/`, integraciones en `integracion_api/`, doc oficial de mods en `mods_docs/`, evidencia de C1 en `c1_evidencia/`).
Herramientas que ya existen: `node scripts/_aplicarIntegracion.mjs <integracion.md> [--aplicar] [--solo n,m]` (saca archivos
nuevos y parches `git apply` de una integración de la API) y `node scripts/_apiLotes.mjs <jobs.json>` (pedidos a la API en
paralelo; los juegos de esta noche están en `.sgc-cache/investigacion-2026-10-11/jobs/`).

## Reglas de esta sesión

- **Opus 5.5 para todo.** La API con créditos solo si hace falta un pedido que no necesita herramientas, y poco: a la clave
  principal le quedan unos US$ 40 hasta el 30/10 (la prestada de Pedro se agotó; `node scripts/_claude.mjs --check`).
- Cada cambio por el camino de su tamaño (`codigo-madre.md`): tests del módulo, `npm run build` si toca la app, **auditor
  Opus al cerrar cada tanda** (en el código que escribió la API el auditor encontró 5 errores reales en dos tandas: no se
  saltea), commit por rutas, push, CI leído por API (`git-deploy.md`).
- **Lo que toca a TODAS las sesiones** (`~/.claude/settings.json`, hooks, mods instalados) va con copia de respaldo con
  fecha al lado (`settings.json.antes-<tarea>-<fecha>`), se prueba con `node scripts/_probarMejora.mjs --mensaje "<real>"`
  y, si algo falla, **se vuelve atrás en el mismo turno** y se anota. Un hook roto se lo come Fak en su próxima sesión.
- Cupo del plan: mirarlo cada hora (`get_usage`); si la ventana semanal pasa del **75 %**, se cierra lo abierto, se anota
  dónde quedó y se para (Fak, 11/10 01:05: *"ya usamos demasiado de la semana"*).
- No se le pregunta nada a Fak: lo que necesite su sí va a la lista del cierre. Lo que el contrato de autonomía marca
  «preguntar» (datos en Supabase, servidor, mails) no entra en esta sesión.
- Ningún documento ni comentario dice que lo hizo una IA (`core-prohibiciones.md` §9); el guardián de firma ya revisa
  en vivo cada escritura.

## Qué hacer, en este orden

1. **Instalar los dos mods que Fak quiere, de forma persistente** (filas P33 y HOY-25 de la cola; **NO** el recordatorio
   CC/SC, P34: Fak dijo que está al pedo; el hook bash sigue haciendo eso).
   - El camino documentado para que un mod cargue en todas las sesiones es instalarlo como plugin desde un marketplace
     propio (`mods_docs/mods_create.md`, sección «Use the mod in other sessions» y «share»; `mods_docs/mods_overview.md`).
     La variable `CLAUDE_CODE_PLUGIN_DIRS` que propuso la API está en los tipos pero no en la doc de instalación: no usarla
     sin verla documentada.
   - Pasos: `claude plugin validate mods/tablero` y `mods/presupuesto-agentes` (los dos pasan hoy) → armar el marketplace
     local (un directorio con un `marketplace.json` que liste los dos plugins, según la doc) → `claude plugin marketplace add
     <ruta>` → `claude plugin install <nombre>` para cada uno → en una sesión nueva, `/plugin` tiene que listar
     `2 mods active`. El tablero se ve arriba del cuadro de texto; `/tablero` abre el panel.
   - Presupuesto: convive con `~/.claude/hooks/agentes-guard.sh` (los dos deciden; el bash sigue hasta que haya dos días de
     registro coherente en `~/.claude/mods-log/`). Probarlo: un `buscador` (haiku) pasa; un lanzamiento con `effort: max`
     se niega. Lo que el auditor dejó anotado (fila P33): `$.store` no es atómico, `buscarDefinicion` con ruta relativa
     (usar `$.session.root`), sin archivo de escape para el cupo real; `FALLA_CERRADA = false` (falla abierto) se queda.
   - Tablero: lee `~/.claude/.agent-spawns.log`; si el presupuesto deja de escribirlo, el tablero tiene que leer el registro
     del mod (`mods-log`). Arreglarlo antes de instalar los dos juntos.
   - Si la app de escritorio no toma un plugin instalado por línea de comandos, decirlo con lo medido y dejar el comando
     exacto para que Fak lo corra cuando esté.
2. **HOY-24b — cerrar `correr_comando` del agente por API** (fila HOY-24b): con el sandbox del auditor como test del repo
   (`agente_sandbox.mjs` del scratchpad de la sesión ae95ec7e; si ya no está, rehacerlo con los seis casos de la fila).
   Recién con ese test en verde se saca el candado de `--seco` en `scripts/_agente.mjs`.
3. **P14, P15, P16, P18 — guardianes afinados**: borrador en dos partes + integración en `integracion_api/
   integrar-guardianes-afinados-P14-P15-P16-P18.md` (5 parches aplican, el de tests no). Afloja cuatro controles: se aplica
   de a uno, con sus tests en las dos direcciones, y **un auditor Opus solo para esto** antes de commitear.
4. **P10 — juntar los hooks en un solo proceso**: `integracion_api/integrar-hooks-un-solo-node-P10.md` (10 archivos nuevos
   + parche al `settings.json` del repo; dos parches de tests no aplican: rehacerlos a mano). Con respaldo del settings,
   `_probarMejora.mjs` con un mensaje real, y vuelta atrás si un hook deja de contestar.
5. **HOY-26 y HOY-27 — confirmar los hallazgos de las dos auditorías de la API**, de a uno, abriendo el archivo y
   reproduciendo. Cada uno confirmado pasa a ser fila propia de la cola; el resto se tacha con el motivo.
6. **P9 / C1 (H6)**: el parche v1 (`c1_evidencia/C1_cierreGuard.patch`) pasa sus 15 tests; la evidencia dio 1 registro con
   diferencia por el tope de 600 miradas de subagentes; el diagnóstico de la API está en
   `integracion_api/arreglo-cierre-incremental-C1.md` (§1). Rehacer el parche con ese diagnóstico, correr
   `scripts/_h6Evidencia.mjs --base HEAD --max 0` (está en el scratchpad `c1_retirado/` de ae95ec7e y en `c1_evidencia/`)
   y aplicar solo si la evidencia da 0 inesperados.
7. **P30** (guardianes concurrentes): el borrador está (`codigo_api/codigo-guardianes-concurrentes-P30.md`); la
   integración hay que escribirla acá (la de la API volvió vacía).
8. Lo chico que quedó en las filas HOY-12 (`cierreGuardSesiones.test.mjs`, mutantes de H5) y HOY-18d (la página HTML
   de la línea de tiempo).

## Cierre

Al terminar (o al 75 % del cupo semanal): `node scripts/_cierreSesion.mjs`, LECCIONES si hubo correcciones, memoria
«dónde quedó» actualizada, `node scripts/_nube.mjs --subir --aplicar`, y el resumen para Fak con: qué quedó andando,
qué mod se ve y cuál no, y la lista de lo que necesita su sí.
