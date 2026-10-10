# Lista del orquestador — 10/10/2026 11:00 → 12/10/2026 11:00 (48 h, pedido de Fak a las 02:10)

Pedido textual: *"te dejo modo full auto 48 hs seguidas, lo que tarde en completar todo"*. Prompt: `docs/drafts/PROMPT_ORQUESTADOR_2026-10-10_v5.md`.
Reglas de la tanda: las 21 de la v3 §2, más la del 10/10 ~11:10 (*"todo lo que digo son sugerencias sin evidencia... si creés que hay una mejor forma, decímelo: mirá, creo que lo que querés es esto"*). Nada que necesite un clic de Fak mientras no está; pasado el 85 % del cupo de 5 h no se lanzan hijas ni agentes; el cupo se mira cada hora; cada hora un renglón en el chat.

## Lo pedido, en orden

1. [~] **Los carteles (HOY-8 + HOY-7)**: hecho el cambio (encargo `--lanzada`, settings sin plan, `_hijaEstado.mjs`, skill `lanzar-sesion-hija`, memoria, regla, CLAUDE.md), tests en verde (66), hija real lanzada a las 11:26 (`local_e4632689`). Falta: auditor Opus (corriendo), aplicar hallazgos, commit con rutas, CI, tachar en la cola.
2. [ ] **La cola** (`docs/COLA_CAMBIOS_CODIGO.md`) por su orden de trabajo, con hijas que lanzo (una o dos a la vez), cada una con encargo por `_encargo.mjs --lanzada`.
3. [ ] Vigilar el contexto de cada hija (`get_usage`); al 85 % cierre prolijo y la siguiente.
4. [ ] Cada fase se tacha solo con `git log` + CI + `_cierreSesion.mjs --sin-build`.
5. [ ] Modelos: hijas en Opus 5.5 para medianos; Fable 5.1 para grandes (P6, P9+P10, P33, P55, P56).
6. [ ] Lo que necesita a Fak va a la sección de abajo.
7. [ ] Cada hora un renglón en el chat. Al final, una página en `exports/explicaciones/`.

## Hijas (estado)

| Sesión | Encargo | Modelo / modo | Qué hace | Estado |
|---|---|---|---|---|
| `local_8e259e7a` (madrugada) | E261010-72c7 (acotado a H14+P26; el 169b cerrado) | Opus 5.5 / bypass (arrancó en plan: 2 OJOs del control) | cerrar H14+P26, commit, y parar | mensaje entregado 11:18, turno en curso |
| `local_e4632689` (hija 1) | E261010-8c59 | Opus 5.5 desde el 2.º turno / bypass heredado | paso 11: H20+H21 novedades | lanzada 11:26, abortada 11:28 (arrancó en default) |

Próximas (de a una o dos, sin pisar archivos): paso 12 H23+H24 (skills) · 13 H25-H27 (consumos) · 14 H30+H31 · 15 H5+H6 · después H17, H19, H22, H28… · grandes en Fable: P6, P9+P10, P33, P55, P56 (con su sí ya dado el 09/10 16:55; el plan en `docs/` igual se le muestra).

- 11:44 · prueba por reloj (`prueba-modo-reloj-20261010`, sesión `local_3225f44a`): sin `defaultMode` en el settings, la corrida disparada por el reloj arranca en **default** (y tomó el modelo Fable del selector). Confirma: el modo sale de la tarea o del settings; sin ninguno, `default`.
- 11:45 · la hija de la madrugada subió H14 (`b2f56ae1`, CI verde); P26 (`_imprimir.py` + test) sigue sin commitear.
- 11:48 · auditor Opus del cambio: 3 errores reales (el modo no se hereda; el control juzgaba con el modo del primer mensaje y mandaba frenar un vitest largo de la madrugada; «0 llamadas» a start_session era falso: busqué `ccd_session_mgmt__start_session` y el nombre real es `ccd_session__start_session`, hubo 6 el 08/10) y 8 de robustez. Aplicados; tests 25/25.
- 11:52 · fijado el momento: `start_session` estaba en las herramientas de todas las sesiones hasta la del 09/10 17:21 y falta desde la primera posterior a la actualización de la app 2.31226.1 (instalada 17:04-17:05; primera sin ella 17:26). El bundle viejo (2.31226.0) también la tenía: es el interruptor remoto, no el código.
- 11:56 · commit `2d8f8d53` (12 archivos, solo mi alcance + la cola) y push. Cola: HOY-7 cerrado, HOY-8 hecho en parte, P84 (la decisión de Fak), HOY-14 (falso positivo del guardián de firma).
- Tareas que quedan para limpiar en Programadas cuando Fak esté (borrar una tarea archiva sus sesiones y eso pide cartel): `prueba-modo-reloj-20261010`, `hija-novedades-h20-h21-20261010` (su corrida abortada), `sesion-sistema-claude-fase2-20261009`.

## Trabajo que puedo hacer solo (cuando se acabe lo pedido)

- HACER YA de la cola en su orden (lo de arriba).
- Las propuestas con el SÍ de Fak del 09/10 16:55 (tanda P12-P22 probada por otro a ciegas, P30-P32, P6, P9+P10, P33, P55, P56, P25, P38, P39, P41).
- Medir qué modo toma una corrida disparada por el RELOJ ahora que el settings no tiene `defaultMode: plan` (una tarea con `fireAt` a los 2 minutos y un prompt de un renglón; leer el primer mensaje con `_hijaEstado.mjs`).

## Decidí distinto de lo pedido

- **Hora fijada a 36 h, no 48**: `horaGuard --fijar` rechaza más de 36 h («revisar la fecha»). Fijé el 11/10 23:00 y la renuevo ese día hasta el 12/10 11:00 (el latido avisa). No toqué el tope: es un freno contra una fecha mal tipeada.
- **La hija no es la anidada «debajo del chat» (Fak ~11:14: "no una rutina, ojo")**: `start_session` existe en la app pero está apagada por gate remoto (0 llamadas en todos los registros; lo que vio fueron 24 fichas que él clickeó). El único camino sin clic es la tarea manual + `run_scheduled_task`, que hereda el modo. Se lo dije como «mirá, creo que lo que querés es esto». La skill prueba primero si `start_session` apareció.
- **Acoté el encargo de la madrugada a H14+P26** (era «la cola desde el paso 9»): un encargo, un entregable (G3 y el propio prompt v5); los pasos siguientes van a hijas nuevas, una por paso.

## Avisos del control de cierre (11:50)

- Disco C: 9,8 GB libres (el control quiere 10). Se libera deshidratando OneDrive, nunca borrando material de Fak (memoria `reference_onedrive_files_on_demand_liberar_espacio`); lo hago si baja de 8.
- LECCIONES estaba 79 bytes arriba del aviso de 26 KiB: fundí el bullet del 08/10 con el del 09-10/10 (misma memoria).

## No pude verificar

- Que una corrida disparada por el reloj (cron/fireAt) arranque ahora en bypass: sin `defaultMode` toma el default de la app/CLI, que no medí (está en «Trabajo que puedo hacer solo»).
- El aviso `notifyOnCompletion` de una tarea nunca se vio llegar: no lo uso; vigilo con `get_usage` + `list_events` + `_hijaEstado.mjs`.

## Lo que necesita a Fak (para cuando vuelva)

- **P84** (el modo de arranque de las hijas): (a) `permissions.defaultMode: bypassPermissions` en su `~/.claude/settings.json` o (b) tareas fijas en Programadas. Preguntado 11:35.
- **P55** (plan `docs/PLAN_P55_AMFE_EN_LA_NUBE_2026-10-10.md`): ¿edita AMFE adentro de la app o solo mira y exporta? · ¿quiénes son "todos" y con qué herramienta? · OK a la etapa 1 (escribe en `1- GENERAL\AMFE\DATOS\` de la biblioteca y en Supabase).

- Lo que el contrato marca preguntar: Supabase, servidor, arb, mails, listados maestros, la primera vez.
- Si quiere que una tarea por reloj arranque en bypass: la crea él desde Programadas con el selector de modo (la creada por MCP no guarda modo).
- P83 contestada el 10/10 (queda aviso, `--logo-bloquea` no se prende). Las 49 firmas de `exports/HO_CORREGIDAS_20261007` e `IMPRESION_0710_FINAL`: limpiadas el 10/10 por la hija de la madrugada.

## Registro (hora · qué pasó)

- 11:00 · arranqué. Fable 5.1, omitir permisos. Cupo 5 h: 8 %. Semanal 19 %, Fable 28 %. CI en curso para 87d8f9c1. La noche de las 06:30 corrió ($1,51). Hija de la madrugada quieta, última actividad 11:01.
- 11:05 · Fak: *"testeá si podés abrir una sesión hija y fijate cómo memorizás eso, si con una skill propia"*. ~11:10: *"todo lo que digo son sugerencias sin evidencia"*. ~11:14: *"no una rutina, ojo con eso"*.
- 11:08 · hora fijada (36 h) y latido lanzado.
- 11:08-11:17 · investigación: `start_session` gated (bundle de la app), 24 fichas spawn_task, el cartel del 09/10 = `set_session_permission_mode`, la madrugada arrancó en plan por el reloj + settings + ARRANQUE.
- 11:18 · encargo E261010-72c7 a la madrugada: «delivered», su turno arrancó.
- 11:19-11:25 · cambio escrito; tests 66/66; `_hijaEstado.mjs` sobre registros reales: madrugada 2 OJOs, 09/10 bien.
- 11:26 · hija 1 lanzada (`local_e4632689`, H20+H21), modelo Opus y título puestos sin cartel. Auditor Opus lanzado.
- 11:28 · **la hija arrancó en modo `default`, no en bypass**: la hipótesis «hereda el modo de la que la lanza» era falsa (la del 09/10 estaba en bypass porque la madre le cambió el modo 5 s después de lanzarla, antes del primer mensaje: ese fue el cartel). La frené (stop_session, sin cartel) y la renombré «abortada».
- 11:33 · en el código de la app: la tarea tiene campos `permissionMode` y `model` (los escribe el selector de Programadas); la app carga el archivo al arrancar y lo tiene en memoria (editarlo a mano no sirve). Caminos que quedan: (a) `permissions.defaultMode: bypassPermissions` en `~/.claude/settings.json` de Fak (doc oficial: el del usuario sí vale; toda sesión nueva de la PC arrancaría en bypass); (b) una tarea «hija del orquestador» que Fak configura UNA vez en Programadas con omitir permisos y yo reutilizo cambiándole el texto. Es su configuración: se lo pregunté por el chat. Textos corregidos (skill, memoria, regla, CLAUDE.md, `_hijaEstado`).
