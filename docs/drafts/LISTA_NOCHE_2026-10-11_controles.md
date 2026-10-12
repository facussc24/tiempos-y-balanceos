# Lista de la noche del 11/10/2026 — los controles afinados y lo que sigue

Fak, 11/10 21:50, textual: *"pode seguir con el otro? osea eran 3 y enitendo de que ya imepemtnaste 1 y quedan 2 podes
seguri con otro? te dejo laburadno tranquilo cuando temrine el adutiroi que acabod e ver no?"*. Antes (20:59): *"a ver
procede con alguna de las 3 la mas imerpotnaet idmgoa sno se elegi 1"*.

No puso hora: 4 horas desde las 21:54 → **hasta el 12/10 01:55** (regla `trabajar-hasta-la-hora.md`; se renueva si hay
trabajo y cupo). Sesión `4dde7a6e`, Opus 5.5.

## SI LA SESIÓN SE COMPACTÓ, LEER ESTO PRIMERO

- Se trabaja en DOS copias aparte del repo, nunca sobre el checkout principal (sus hooks están en vivo):
  - `.claude/worktrees/p14-p18`, rama `guardianes-afinados`: un commit, `c57b8747` = **HOY-28** (el agujero del borrado).
    Lo está auditando el agente `a4754b9d81dd6ef1f`; su informe va a `.sgc-cache/auditorias/HOY-28_auditor_2026-10-11.md`.
    NO editar esa copia mientras el auditor corre.
  - `.claude/worktrees/g2`, rama `guardianes-p16` (sale de `c57b8747`): `52404ed8` (P16 original) + `83cd507d` +
    `a64b0d11` (el arreglo del auditor y dos ajustes). Sin enlace a `node_modules`: los tests se corren con
    `node /c/Dev/BarackMercosul/node_modules/vitest/vitest.mjs run <archivos> --pool=threads` desde esa carpeta.
- Lo medido de HOY-28: `.sgc-cache/auditorias/HOY-28_diferencial_2026-10-11.md`. Scripts en el scratchpad de la sesión
  (`hoy28_casos.mjs`, `diferencial_guardianes.mjs` para p14-p18, `diferencial_g2.mjs` para g2, `aud_p14p18/h.mjs` con
  `AUD_NUEVO=<ruta del módulo>`).
- Para ENTRAR a `main` (cada commit solo con el SÍ de su auditor): `git -C /c/Dev/BarackMercosul cherry-pick <hash>`,
  importar `scripts/_lib/guardianes.mjs` desde main con node, un payload por `bash .claude/hooks/_dispatcher.sh`
  (uno normal → 0; uno de los seis del agujero → 2), suite COMPLETA (`npx vitest run --pool=threads`, ~9 min), push,
  CI por API. Si un hook deja de contestar: `git revert` en el mismo turno.
- En una regex NO usar heredoc de Bash (colapsa las barras invertidas): herramienta Edit.

## Lo pedido, en orden

| # | Qué | Estado |
|---|---|---|
| 1 | **HOY-28**: el control de borrado deja pasar un borrado permanente | **EN MAIN y en vivo desde las 22:08** (`135608bd` + `1269458c`). Auditor: SÍ con dos renglones, aplicados tal cual, y sus 8 tests (informe `.sgc-cache/auditorias/HOY-28_auditor_2026-10-11.md`). Falta: suite completa, push, CI |
| 2 | **P16** (firma) con el arreglo del auditor | Hecho en g2 (`83cd507d`, `a64b0d11`), 142 tests, diferencial −9 falsos / +0. **Auditor pedido 22:11** (mismo agente `a4754b9d81dd6ef1f`; informe en `.sgc-cache/auditorias/P14-P16_auditor_2026-10-11.md`) |
| 3 | **P14 + P15** (arb y mail miran lo que corre) con los 5 arreglos de la sección 6 del informe `.sgc-cache/auditorias/P14-P18_auditor_2026-10-11.md` | Hecho en g2 (`00c9ac68` + `b7a55160`): los cinco arreglos + dos más; arnés: quedan solo los rebuscados; 134 tests; diferencial arb −9 / +5, mail −14 / +2. Lo medido: `.sgc-cache/auditorias/P14-P16_arreglos_medido_2026-10-11.md`. **Auditor pedido 22:11**. Para entrar a main (con su SÍ): cherry-pick de `52404ed8 83cd507d a64b0d11 00c9ac68 b7a55160` (g2 tiene además `3b4e24bc`, que ya está en main) |
| 4 | **Avisos del cierre (P10 C3)**: dejarlo LISTO sin cablear | Sin empezar. Arreglar T1 (`scripts/_lib/stopHooks.mjs:16`, import estático de `hooksTiempos.mjs`), T2 (`scripts/_lib/probarMejora.mjs:128`, filtra `/cierre-guard/`), un test del `.sh` que frene con exit 2 y `cierreGuardExplicar.test.mjs:303` («4 o más» hooks). El cableado NO: espera la medición que termina ~17/10 |
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

- H37: investigar los 194 casos de código 127 (solo lectura), que es lo que destraba P30.
- Los textos que todavía nombran los cuatro hooks viejos de mensajes (`CLAUDE.md`, dos reglas, `explicar-mejor/SKILL.md`).
- HOY-45 (instalador de mods: R-B y R-C, decir la verdad cuando el marketplace queda registrado o un mod está apagado).
- Diseñar P18 con los requisitos del auditor (sin aplicarlo).

## Lo que necesita a Fak

- (sigue de antes) El freno de agentes al 60 % de la semana rige hasta el vie 16/10 13:00; la tarea de las 06:30 sigue
  frenada hasta el 30/10 (HOY-49); borrar los cuatro `.sh` viejos; `__cleanupAmfeActions` (HOY-37); las dos tareas de
  prueba de Programadas.

## Decidí distinto de lo pedido

- Fak dijo «ya implementaste 1 y quedan 2». La cuenta real: de las tres, la primera (los controles) está a medias (dos
  partes hechas, una por hacer) y es la que sigo; la segunda se puede dejar lista pero no cablear; la tercera no se puede
  tocar hasta el 17/10. Se lo dije antes de arrancar.

## No pude verificar

- (se completa durante la noche)

## Registro (horas medidas con `date` o del commit)

- 20:59 Fak: «procedé con alguna de las 3». 21:05 rama `guardianes-afinados`. 21:07-21:14 HOY-28 y sus tests.
- 21:10-21:18 dos corridas del diferencial (90 días, 110.743 comandos). 21:20 commit `c57b8747`. 21:22 auditor lanzado.
- 21:22-21:45 P16 en g2 (`83cd507d`, `a64b0d11`), arnés de casos del auditor, diferencial (9 / 0).
- 21:50 Fak: «te dejo laburando tranquilo». 21:54 esta lista y la hora fijada.
- 21:55-22:10 P14+P15 en g2 con los cinco arreglos (`b7a55160`). Después de las 22:03 (último despertar anotado) el latido salió con 5 (aviso «0 pedidos a la API»): no aplica, esta noche no se usa la API (regla de arriba); relanzado.
- Volvió el auditor de HOY-28: SÍ con dos renglones. 22:08 `b7b68173` en la copia (hora del commit). Enseguida, cherry-pick a main (`135608bd`, `1269458c`), módulo cargado y los seis casos frenando en vivo; suite completa lanzada. 22:11 (`date`) segunda auditoría pedida (firma, arb y mail).
