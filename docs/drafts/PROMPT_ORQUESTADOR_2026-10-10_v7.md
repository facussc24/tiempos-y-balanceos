# Prompt del orquestador — v7 (estado al 10/10/2026 23:55; sigue a la v6 de las 19:41)

Si esta sesión se compacta o Fak abre una nueva para seguir la tanda, se arranca con esto. Vale todo lo de la v6
(orden de trabajo, reglas de la tanda, regla 17 de la API, «una pregunta a Fak no frena el resto») y se agrega lo
de abajo. La lista viva es `docs/drafts/LISTA_ORQUESTADOR_2026-10-10.md` (secciones de arriba puestas al día a las
23:15): se lee ENTERA antes de tocar nada.

## 1. Dónde quedó la tanda (23:55)

- **Hora fijada** hasta el 11/10 23:00 (renovar ese día con `node scripts/_lib/horaGuard.mjs --fijar "2026-10-12 11:00" --lista docs/drafts/LISTA_ORQUESTADOR_2026-10-10.md --pedido "te dejo modo full auto 48 hs seguidas, lo que tarde en completar todo"`). Latido: `node scripts/_latido.mjs` en segundo plano (`LATIDO`); con exit 5, además `node scripts/_orquestador.mjs --hora`.
- **Hijas activas (tope: dos a la vez)**: hija 5 `local_c138efc5-d4d2-4ec8-85e7-f44175a8126b` (Opus; cerró P41, P41b y P9 C0; está clasificando 71 fallas de los tests del cierre; **después recibe el encargo ya registrado E261011-4026, HOY-12+HOY-21**, texto en el scratchpad `encargo_hoy12_texto.txt` de la sesión ae95ec7e o se rehace con `_encargo.mjs --lanzada`); hija 6 `local_15a241d5-8c4d-424c-b5b6-e0788034b6df` (cerró P6 etapa 1 en Fable; **en Opus desde las 23:35 con P6 etapa 2**, encargo E261011-927e, auditor corriendo a las 23:49).
- **Cerradas** (no reciben más): hija 2 `local_218252c2` (~78 %), hija 3 `local_c5fa43f0` (65 %), hija 4 `local_34ba1fc9` (~75 %).
- **Lista para lanzar cuando se libere un lugar**: hija 7, tarea `hija-hoy14-novedades-x-20261010` (HOY-14, encargo E261011-dc92 ya registrado): `run_scheduled_task` → `set_session_model claude-opus-5-5` + título → `_hijaEstado.mjs <id> --espera-modelo claude-opus-5-5` → `stop_session` + reenviar el mismo texto por `send_message` (el primer turno sale en el modelo del selector).
- **Siguiente orden** (de la revisión de la tanda por la API, 23:10, adoptado): HOY-12+21 (hija 5) → HOY-14 (hija 7) → HOY-23 (lo sin commitear de sesiones anteriores) → H17, H28, H22 → HOY-18b, c, d. **No tocar**: HOY-22 (pisa la P6 de la hija 6), HOY-16/18f/19c/19i/19k (necesitan a Fak), H34 (espera P11). P33 y P56 (grandes) esperan el cupo.
- **Cupo** (medido 23:48): 5 h 51 %, semanal 43 %, Fable 59 %. Reglas que me puse (en «Decidí distinto» de la lista): Fable 70 % → ninguna hija Fable (la 6 ya pasó a Opus); semanal 60 % → sin hijas nuevas; 65 % → cerrar la tanda con la página y explicarlo con los números. Se mide en cada renglón de la hora con `get_usage`.
- **Probado y descartado a las 23:50**: hijas por la clave de la API (`claude -p` + `ANTHROPIC_API_KEY`) → «Credit balance is too low» con las dos claves. No insistir; memoria `reference_api_claude_clave_y_ciclo`.

## 2. Reglas nuevas de la tanda (desde la v6)

18. **Dos hijas activas a la vez como máximo**, más el orquestador (con cuatro, el semanal subía ~4 puntos por hora).
19. **Las hijas no commitean `docs/COLA_CAMBIOS_CODIGO.md`**: la editan y dicen la fila en su síntesis; la commitea el orquestador (dos commits cruzados hoy, sin pérdida).
20. **Cada encargo `--lanzada` ya trae el renglón `permisoGuard --heredar <madre>`** (P41b): la hija hereda la hora y el hook de carteles; no fija hora propia ni lanza latido.
21. **El orquestador no programa**: los chicos también van a una hija (HOY-13 lo hice yo y rompió el CI 23 minutos). Lo mío: encargos, lista, cola, planes, la API, el control.
22. **Un chico/mediano/grande se arma con `.sh` en el scratchpad y se corre por ruta** (el guardián frena comandos de más de 3.000 caracteres pegados); el texto registrado se manda TAL CUAL (hash).

## 3. Lo que necesita a Fak (en la lista, sección «Lo que necesita a Fak»): cuatro preguntas de sí o no (HOY-16, HOY-19c, HOY-19k, HOY-19i) y los avisos (bypass global desde las 18:40 con su respaldo, CATIA licencia, HOY-18f, HOY-19j, tareas para borrar en Programadas).

## 4. Al final de la tanda

La página en `exports/explicaciones/` (ya hay una del 10/10 23:50: `novedades_2026-10-10.html`, pedida por Fak como «vendémelo»; la final la actualiza con lo del 11/10), el auditor final de la tanda (Opus) sobre lo que hizo el orquestador (incluye HOY-13), `node scripts/_cierreSesion.mjs --sin-build` cuando no quede ninguna hija abierta, y el resumen a Fak a la hora, no antes.
