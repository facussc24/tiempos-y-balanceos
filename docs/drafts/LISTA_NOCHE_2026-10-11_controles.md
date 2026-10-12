# Lista de la noche del 11/10/2026 — los controles afinados y lo que sigue

Fak, 11/10 21:50, textual: *"pode seguir con el otro? osea eran 3 y enitendo de que ya imepemtnaste 1 y quedan 2 podes
seguri con otro? te dejo laburadno tranquilo cuando temrine el adutiroi que acabod e ver no?"*. Antes (20:59): *"a ver
procede con alguna de las 3 la mas imerpotnaet idmgoa sno se elegi 1"*.

No puso hora: 4 horas desde las 21:54 → **hasta el 12/10 01:55** (regla `trabajar-hasta-la-hora.md`; se renueva si hay
trabajo y cupo). Sesión `4dde7a6e`, Opus 5.5.

## SI LA SESIÓN SE COMPACTÓ, LEER ESTO PRIMERO

- **Estado a las 23:37 del 11/10: los puntos 1, 2, 3 y 4 están EN MAIN y pusheados.** Los tres controles (firma, arb y
  mail) entraron a las 23:27 (`5fa79fad` … `3cc041eb`, siete commits); el módulo `scripts/_lib/guardianes.mjs` de main
  tiene la huella `bb013b71` (`git hash-object`), la misma de la copia que midió el auditor. Lo que sigue es la sección
  «Trabajo que puedo hacer solo». Los renglones de abajo cuentan cómo se llegó; las dos copias siguen en disco.
- **12/10 00:52: el punto 4b (HOY-57 + A1 + B4) también está EN MAIN** (`d05143c1`, `7fcb2951`, `3b1e7e2a`), con el SÍ
  del auditor; el módulo de main tiene la huella `6bd76403`. Lo de después de entrar está hecho: suite completa (01:01),
  push (01:02) y CI verde (01:11). Si un hook deja de contestar:
  `git -C /c/Dev/BarackMercosul revert` de esos tres en el mismo turno. Ya están hechos: memorias, lección, disco
  liberado, nube subida, cola al día. A la 01:55: `_cierreSesion.mjs` completo (con build), `--terminar` y el resumen.
- Se trabaja en DOS copias aparte del repo, nunca sobre el checkout principal (sus hooks están en vivo):
  - `.claude/worktrees/p14-p18`, rama `guardianes-afinados`: un commit, `c57b8747` = **HOY-28** (el agujero del borrado).
    Lo está auditando el agente `a4754b9d81dd6ef1f`; su informe va a `.sgc-cache/auditorias/HOY-28_auditor_2026-10-11.md`.
    (Desde las 22:20 esa copia está en la rama `cierre-listo`, commit `5de5ab45`: el punto 4 de abajo. La rama `guardianes-afinados` tiene HOY-28 completo, ya en main.)
  - `.claude/worktrees/g2`, rama `guardianes-p16` (sale de `c57b8747`): `52404ed8` (P16 original) + `83cd507d` +
    `a64b0d11` (el arreglo del auditor y dos ajustes). Sin enlace a `node_modules`: los tests se corren con
    `node /c/Dev/BarackMercosul/node_modules/vitest/vitest.mjs run <archivos> --pool=threads` desde esa carpeta.
- Lo medido de HOY-28: `.sgc-cache/auditorias/HOY-28_diferencial_2026-10-11.md`. **Los scripts y casos NO se buscan en
  el temporal de la sesión (se limpia a las 12 h): sus copias están en `.sgc-cache/auditorias/casos_2026-10-11/`**
  (`hoy28_casos.mjs`, `diferencial_guardianes.mjs`, `diferencial_g2.mjs`, las carpetas `aud_hoy28/`, `aud_p14p18/` y
  `aud_p14p16/` con `h.test.mjs`, `mutar.test.mjs` y el despachador, y `mutantes_sobre_el_arreglado_preparar.mjs`) y
  en `.sgc-cache/auditorias/HOY-57_medido_2026-10-12/` (casos, diferencial y el del permiso para apagar). Los
  resultados de las suites completas están en el registro de abajo, no en un archivo.
- Para ENTRAR a `main` (cada commit solo con el SÍ de su auditor): `git -C /c/Dev/BarackMercosul cherry-pick <hash>`,
  importar `scripts/_lib/guardianes.mjs` desde main con node, un payload por `bash .claude/hooks/_dispatcher.sh`
  (uno normal → 0; uno de los seis del agujero → 2), suite COMPLETA (`npx vitest run --pool=threads`, ~9 min), push,
  CI por API. Si un hook deja de contestar: `git revert` en el mismo turno.
- En una regex NO usar heredoc de Bash (colapsa las barras invertidas): herramienta Edit.

## Lo pedido, en orden

| # | Qué | Estado |
|---|---|---|
| 1 | **HOY-28**: el control de borrado deja pasar un borrado permanente | **EN MAIN y en vivo desde las 22:08** (`135608bd` + `1269458c`). Auditor: SÍ con dos renglones, aplicados tal cual, y sus 8 tests (informe `.sgc-cache/auditorias/HOY-28_auditor_2026-10-11.md`). Suite completa: solo los dos rojos locales ajenos (HOY-50). Pusheado (`712ce919`), **CI verde** (leído 22:24) |
| 2 | **P16** (firma) con el arreglo del auditor | **EN MAIN y en vivo desde las 23:27** (`5fa79fad` + `4504933b` + `9e06069d`). Auditor: SÍ sin arreglos (informe `.sgc-cache/auditorias/P14-P16_auditor_2026-10-11.md`). Contra la historia entera deja de frenar 9 falsos y no empieza a frenar nada |
| 3 | **P14 + P15** (arb y mail miran lo que corre) con los 5 arreglos de la sección 6 del informe `.sgc-cache/auditorias/P14-P18_auditor_2026-10-11.md` | **EN MAIN y en vivo desde las 23:27** (`0604d558` + `e7141e3f` + `a5bee431`; pruebas `3cc041eb`). Auditor: SÍ con dos arreglos (B1 y B2), aplicados tal cual con su parche; entraron las 12 pruebas que pidió y una más, y los cinco mutantes que quedaban vivos ahora mueren. Diferencial: arb −9 / +5, mail −14 / +2. Por el despachador real de main, 20 casos como se esperaba; los seis del borrado siguen frenando. Suite completa: solo los tres rojos locales ajenos (HOY-50). Lo que queda, en la cola: HOY-54 a HOY-60 |
| 4 | **Avisos del cierre (P10 C3)**: dejarlo LISTO sin cablear | Hecho en el worktree `p14-p18`, rama `cierre-listo`, commit `5de5ab45` (T1, T2, test del `.sh` con exit 2 y con los módulos de apoyo rotos, `cierreGuardExplicar` sin contar cuatro). 183 tests. Auditor: SÍ, ningún error real; pidió un arreglo más (R12) que se hizo (`3a1d2348`). **EN MAIN desde las 22:47, sin cablear** (`94f5b6ff`, `cbc0f75e`). Lo que falta para cablearlo está en la fila HOY-47 de la cola. El cableado NO: espera la medición que termina ~17/10 |
| 4b | **HOY-57** (agregado 00:20): apagar la PC o cerrar la sesión de Windows se frena como se escriba, más dos refuerzos del auditor (A1 firma, B4 mail) | Hecho en la copia `.claude/worktrees/g2`, **rama `arb-apagar`** (sale de main en `41e00f56`): `da73ce13` HOY-57, `b7b52dc4` A1, `575cd4ec` B4. 435 pruebas y las dos suites de consola en verde; el módulo queda con la huella `6bd76403`. Diferencial del arb contra 112.162 llamadas reales: 0 aflojan, 4 pasan a frenar (dos apagados reales, del 31/08 y del 02/10, y dos arneses de prueba de otros guardianes). Lo medido: `.sgc-cache/auditorias/HOY-57_medido_2026-10-12/`. **Auditor Opus: SÍ a los tres, sin condiciones** (informe `.sgc-cache/auditorias/HOY-57_auditor_2026-10-12.md`; la huella no cambió durante la auditoría). **EN MAIN y en vivo desde las 00:52** (`d05143c1`, `7fcb2951`, `3b1e7e2a`): `git diff` contra la rama vacío, el módulo carga, 20 casos por el despachador real como se esperaba, las 39 formas de apagar frenan, los seis del borrado siguen frenando, las dos suites de consola en verde. Lo que queda: cola HOY-64 |
| 5 | P18 (borrado en scripts que se escriben): rehacer | NO esta noche: es otro trabajo (requisitos en la sección 6 del mismo informe) |
| 6 | Mejoras de velocidad (C1 y P30) | NO: C1 espera la medición del 17/10; P30 va después de la investigación H37 |

## Reglas de esta tanda

- Nada entra a `main` sin el SÍ del auditor (Opus) de ESE cambio. Lo que afloja un control lo prueba otro.
- No se le pregunta nada a Fak: lo que necesite su palabra va abajo. Nada que le muestre un cartel.
- Sin Supabase, sin servidor, sin mails, sin API con créditos.
- Cupo: mirarlo cada hora. Semana por encima de **75 %** → cerrar lo abierto y parar. Ventana de 5 h por encima de 85 %
  → sin subagentes nuevos.
- Subagentes: solo `auditor` (el mod de presupuesto frena los demás con la semana arriba de 60 %).
- Un hook roto en `main` se vuelve atrás en el mismo turno.

## Trabajo que puedo hacer solo (cuando se acabe lo de arriba)

- ~~H37: investigar los 194 casos de código 127 (solo lectura), que es lo que destraba P30.~~ HECHA 23:50.
- Los textos que todavía nombran los cuatro hooks viejos de mensajes (`CLAUDE.md`, dos reglas, `explicar-mejor/SKILL.md`).
- HOY-45 (instalador de mods: R-B y R-C, decir la verdad cuando el marketplace queda registrado o un mod está apagado).
- Diseñar P18 con los requisitos del auditor (sin aplicarlo).

## Lo que necesita a Fak

- (sigue de antes) El freno de agentes al 60 % de la semana rige hasta el vie 16/10 13:00; la tarea de las 06:30 sigue
  frenada hasta el 30/10 (HOY-49); borrar los cuatro `.sh` viejos; `__cleanupAmfeActions` (HOY-37); las dos tareas de
  prueba de Programadas.
- (nuevo, de H37) **HOY-62**: una sesión que la app abre sin carpeta y después entra al repo trabaja sin los controles
  del repo. El arreglo de fondo es poner los controles de las reglas duras (arb, mail, borrado, firma, nube personal,
  secretos) en la configuración general de Claude Code, que vale para todas las sesiones de la PC: es un cambio
  grande y va con su sí. Mientras tanto: abrir las sesiones eligiendo la carpeta `C:\Dev\BarackMercosul`.

## Decidí distinto de lo pedido

- Fak dijo «ya implementaste 1 y quedan 2». La cuenta real: de las tres, la primera (los controles) está a medias (dos
  partes hechas, una por hacer) y es la que sigo; la segunda se puede dejar lista pero no cablear; la tercera no se puede
  tocar hasta el 17/10. Se lo dije antes de arrancar.
- **P30 queda en espera, y Fak le había dado el sí** (09/10: «SÍ, grandes, con revisor»). Por qué: medí en toda la
  historia al menos 11 frenos por un control roto, en tres momentos de un par de minutos, y ninguno desde el 08/10;
  desde el 09/10 los controles se cambian en una copia aparte y entran de una vez, que tapa la causa. Un cambio grande
  para algo que ya no pasa no rinde. Se reabre si vuelve a aparecer un freno así. Fuente: nota en la fila P30 de la cola.
- **El disco: borré 6,63 GB con `_liberarDisco.mjs --aplicar`** (00:17), sin poder deshacerlo: 75 carpetas temporales
  de conversaciones de Claude sin cambios en más de 12 horas y 57 copias viejas de respaldo de Supabase (quedan las 12
  más nuevas y la primera de cada día). Nada de Fak. El disco tenía 8,4 GB libres y el control de cierre lo marcaba.
- El auditor dejó tres mejoras más, medidas y con parche, que NO entraron (HOY-54, HOY-55 y HOY-56): su SÍ era para los
  dos arreglos obligatorios; una de las tres afloja un control y ninguna tiene veredicto propio. Quedan en la cola.

## No pude verificar

- Nada de lo que los controles frenan corrió de verdad (ni un cierre del arb, ni un mail, ni un documento): «frena» y
  «pasa» son veredictos del control, medidos por el despachador real.
- `_probarMejora.mjs --mensaje` no aplica a estos tres controles: no leen mensajes de Fak, miran comandos y archivos.
  Lo que ocupó su lugar fue la pasada de 20 casos por el despachador de main.
- La herramienta PowerShell tiene 3 usos en toda la historia: sus casos no tienen contra qué medirse.
- **El plan corto de HOY-57 (cambio mediano) no quedó en el registro del chat.** Lo escribí antes de crear la rama (qué,
  por qué, que las reglas se suman sin tocar la vieja, pruebas en las dos direcciones, qué puede romper), pero a la
  01:16 lo busqué en el archivo de la sesión y no está; el asesor tampoco lo vio. Vale como no dicho: la regla
  `codigo-madre.md` pide ese plan en el chat ANTES. El qué y el porqué quedaron en el comentario del código y en el
  commit `d05143c1`, y el auditor lo revisó entero antes de entrar. Y las horas: tres veces en el día anoté una hora o
  un hecho de memoria y no medido (22:22, 00:12 y esto). Cola HOY-65.
- Nada corrió de verdad tampoco en la segunda tanda: ni un apagado, ni un mail, ni un documento.

## Registro (horas medidas con `date` o del commit)

- 20:59 Fak: «procedé con alguna de las 3». 21:05 rama `guardianes-afinados`. 21:07-21:14 HOY-28 y sus tests.
- 21:10-21:18 dos corridas del diferencial (90 días, 110.743 comandos). 21:20 commit `c57b8747`. 21:22 auditor lanzado.
- 21:22-21:45 P16 en g2 (`83cd507d`, `a64b0d11`), arnés de casos del auditor, diferencial (9 / 0).
- 21:50 Fak: «te dejo laburando tranquilo». 21:54 esta lista y la hora fijada.
- 21:55-22:10 P14+P15 en g2 con los cinco arreglos (`b7a55160`). Después de las 22:03 (último despertar anotado) el latido salió con 5 (aviso «0 pedidos a la API»): no aplica, esta noche no se usa la API (regla de arriba); relanzado.
- Volvió el auditor de HOY-28: SÍ con dos renglones. 22:08 `b7b68173` en la copia (hora del commit). Enseguida, cherry-pick a main (`135608bd`, `1269458c`), módulo cargado y los seis casos frenando en vivo; suite completa lanzada. 22:11 (`date`) segunda auditoría pedida (firma, arb y mail).
- 22:18 suite completa en main: 2 rojos locales ajenos. Push `712ce919`; 22:24 CI verde.
- 22:20-22:24 punto 4 (aviso único del cierre, sin cablear) en la rama `cierre-listo`: `5de5ab45`. 22:24 pedida la verificación al auditor de P10.
- 22:28 cola: HOY-28 hecha y tres filas nuevas (`ba8389a2`). 22:46 volvió el auditor de P10: SÍ; R12 aplicado (`3a1d2348`). 22:47 punto 4 en main y pusheado.
- Un aviso falso del control del cierre a las 22:30: dijo que escribí `C:/Users/Alguien/…/x.pdf` «afuera del repo»; es un dato de prueba de `nubePersonalGuard.test.mjs` que salió en la salida de una corrida de tests. No existe. Para la cola (anotado 23:35: HOY-61).
- 23:13 volvió el informe del auditor de la firma, el arb y el mail: firma SÍ; arb y mail SÍ con dos arreglos (B1 y B2), con su parche. 23:14 apliqué el parche en g2 (`git apply`; el cambio de las 23:14:29 que el auditor anotó como «de otra sesión» fue este): el módulo quedó con la huella `bb013b71`, igual a su copia `mut/fix`. 417 pruebas y las dos suites de consola en verde. 23:21 commit `11656581`.
- 23:23 las pruebas que pidió el auditor (`7e2845a3`, 421 en verde, solo el archivo de pruebas). 23:26 sus cinco mutantes vivos, corridos de nuevo sobre el módulo arreglado: mueren los cinco (el preparador quedó en `.sgc-cache/auditorias/casos_2026-10-11/mutantes_sobre_el_arreglado_preparar.mjs`).
- 23:27 cherry-pick de los siete commits a main; `git diff` contra la rama `guardianes-p16` vacío en los tres archivos; el módulo carga; por el despachador real de main, 20 casos del auditor como se esperaba (4 normales, 4 del arb, 3 del mail, 3 de firma, 6 liberados) y los casos del borrado siguen frenando; las dos suites de consola en verde. 23:27 a 23:37 suite completa: 7.792 pasan, fallan los tres ajenos de HOY-50. 23:37 push (`3cc041eb`).
- 23:43 CI de `3cc041eb`: completed success. Las sesiones abiertas toman los tres controles solas (el despachador carga el módulo de main en cada llamada).
- 23:40 a 23:50 **H37 hecha** (solo lectura): informe `.sgc-cache/investigacion-2026-10-11/H37_codigo_127_2026-10-11.md`. Los 194 eran el hook llamado con ruta relativa, arreglado el 22/09. Lo que queda abierto es otra cosa: una sesión que la app abre sin carpeta y después entra al repo trabaja sin los controles del repo (08/10, dos sesiones). Cola: H37 hecha, fila nueva HOY-62, notas en P30, P31, H38 y X27.
- 23:53 a 00:04 **medición previa de P18** (solo lectura): 105 archivos escritos que el control de borrado frena hoy y 27 que pasan solo por nombrar un temporal; plan corto en la fila P18 de la cola; lectores y salidas en `.sgc-cache/investigacion-2026-10-11/p18/`. **P30 medido y en espera**: 11 frenos por un control roto en toda la historia, ninguno desde el 08/10 (nota en su fila).
- 00:05 el latido salió con 5 otra vez (aviso «0 pedidos a la API»): no aplica, esta noche no se usa la API. 00:06 dos memorias nuevas (la sesión sin carpeta; la receta para entrar a main desde una copia), la de «dónde quedó» al día y una lección. El índice de la memoria quedó cerca de su tope: 18 ganchos acortados, sin borrar punteros (cola HOY-63).
- Entre las 00:08 y las 00:14 `_cierreSesion.mjs --sin-build`: faltaban dos cosas. El disco C: tenía 8,4 GB libres: 00:17 `_liberarDisco.mjs --aplicar` sacó 6,63 GB (75 temporales de Claude de más de 12 h y 57 copias viejas de respaldo, con su regla de conservar las 12 más nuevas y la primera de cada día); quedaron 15 GB. Lo otro: 7 archivos modificados que no son de esta sesión (ya estaban así al arrancar): no se tocan.
- 00:18 lectura parcial de la medición del cierre (130 corridas): lo que más pesa es el control de la firma, no releer el registro (nota en la fila P9). 00:18 CI del último push (`4f269332`): completed success. 00:18 los casos de los tres auditores y los diferenciales, copiados a `.sgc-cache/auditorias/casos_2026-10-11/` (el temporal de la sesión se limpia solo a las 12 h).
- 00:19 `_nube.mjs --subir --aplicar` (345 archivos). 00:20 quedaban 295 por subir; **00:33 medido otra vez: subió todo lo mío**; queda 1 archivo pendiente que no es de esta sesión (`…\1- GENERAL\TAREAS CERRADAS\2026\LISTADO DE TAREAS CERRADAS 2026.xlsx`, con fecha 31/07).
- 00:20 a 00:33 **HOY-57** (el plan corto: ver «No pude verificar»): reglas nuevas que se suman a la vieja; 39 formas de apagar frenan y 33 usos normales pasan (queda `findstr`, que no está entre los lectores); commits `da73ce13` (00:29), `b7b52dc4` (00:30) y `575cd4ec` (00:31) en la rama `arb-apagar` de la copia; diferencial 00:29 a 00:31; auditor pedido 00:33.
- 00:36 la causa del aviso falso del cierre, leída en el registro de la sesión (fila HOY-61). 00:51 volvió el auditor del punto 4b: SÍ a los tres commits. 00:52 cherry-pick a main, comprobaciones por ruta absoluta y suite completa lanzada. 00:52 a 01:01 suite completa: 7.806 pasan, fallan los tres ajenos de HOY-50. 01:02 push (`bd850542`). 01:04 `_cierreSesion.mjs` completo: build de producción bien; lo único que marca son 7 archivos modificados el 08 y 09/10 por otras sesiones (el generador del AMFE del Upper Trimming y su prueba, dos informes de `docs/auto-mejora`, `LEEME_CARPETA.txt`, `.env.example`), que no son de esta sesión y no se tocan. 01:11 CI de `bd850542`: completed success. Las sesiones abiertas toman los controles solas. Cola: HOY-55, HOY-56 y HOY-57 hechas; fila nueva HOY-64.
- 01:13 el asesor marcó tres cosas, hechas entre la 01:15 y la 01:22: el plan corto que no está en el registro (arriba, «No pude verificar»; cola HOY-65), qué pasa si Fak pide apagar la PC (medido: la sesión escribe el permiso de un solo uso y reintenta; anotado en la memoria `feedback_no_cerrar_arb_sin_consultar`) y las rutas de esta lista que apuntaban al temporal. 01:16 la nube, medida otra vez: lo mío subió; sigue pendiente el mismo archivo ajeno del 31/07.
- 01:22 el control de la hora frenó un mensaje mío que sonaba a despedida (faltaban 33 minutos) y el del cierre pidió la prueba con un mensaje real: 01:23 `_probarMejora.mjs --mensaje` con el último mensaje de Fak, textual: sin fallas; no hay piezas del sistema sin commitear. 01:23 las horas de esta lista cruzadas contra git: las 19 que dicen la hora de un commit calzan (nota en HOY-65).
- Entre la 01:18 y la 01:20 cupo: semana 66 %, ventana de 5 h 14 %. 01:20 un conteo del aviso falso del cierre contra los registros, que no sirvió (nota en HOY-61). 01:21 el archivo de lecciones estaba pegado a su aviso de 26 KB: la lección del mail del 07/10 pasó entera a la memoria `feedback_mail_corto_como_los_de_fak` y acá quedó su renglón.
- 23:30 a 23:35 la cola: P14, P15 y P16 hechas; filas nuevas HOY-54 a HOY-61. Los cuatro parches del auditor quedaron en `.sgc-cache/auditorias/P14-P16_parches/` y su memoria del worktree pasó a `.claude/agent-memory/auditor/` de main con lo que pidió sumarle.
