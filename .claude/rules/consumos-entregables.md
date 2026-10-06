# Consumos y entregables ejecutables — regla corta (always-on)

Aplica a TODA tabla de consumos, carga para el arb, o entregable que Fak vaya a
EJECUTAR (cargar en arb/Supabase, enviar a cliente):

1. **Regla canonica > dato puntual.** El chequeo va sobre la TABLA FINAL:
   `node scripts/_validarConsumos.mjs` + checklist del skill `verificacion-consumos`.
2. **Tolerancia 0,1%** en auditorias de valores (2% tapa typos reales) +
   invariantes que cierran + un agente independiente ademas del script.
3. **Entrega con dato crudo before→after** (columna "actual en arb" al lado del
   correcto) y el archivo ABIERTO y mirado antes de pasarlo.
4. **"No documentado" prohibido** sin pegar el listado del folder (BOM: tomar la
   Rev de numero MAYOR, parseando el int).
5. **Cada numero que va al arb lleva su papel, y el papel lo abre el programa.** Desde el
   25/09/2026 `_arbCargar.py` y `_arbUnidad.py` no escriben con `--apply` si la tabla no trae
   `fuente` + `cita` verificables, si una cuenta usa un numero que ningun papel dice, si el
   ancho no es el de las OC, o si hay un mail sobre ese consumo sin mirar
   (`scripts/_lib/respaldoCarga.py`, BLOQUEANTE; formato en el skill `arb-operar`).
   Caso: TPO del Top Roll, 0,2526 / 1,4 con un 1,4 sin papel y el pedido de Carlos sin leer.

6. **El consumo de un material de corte (vinilo, tela, microfibra) no se carga ni se cambia sin
   la planilla oficial de Mesa de Corte o la confirmacion de Pablo Gamboa** (Fak, 06/10/2026:
   *"no cambiamos el consumo sin un excel oficial o una confirmacion oficial... ante la duda le
   preguntamos a Pablo Gamboa"*). Una tizada (.MRK) sola no alcanza: puede ser una prueba. Tampoco
   una BOM de proyecto, un flujograma ni una cuenta mia. Freno 4 de `respaldoCarga.py`
   (BLOQUEANTE, listas en `corte_fuente_oficial` del canon): el consumo tiene que estar ESCRITO
   en un mail de Pablo, en el adjunto de un mail suyo (citando ese mail) o en una planilla que
   este en el SERVIDOR; no se arma con una cuenta, y lo que arme yo no cuenta, este donde este.
   Un margen pedido por el gerente (06/10: Carlos, *"en la BOM cargar 5% mas"*) entra por `fak:`. `python scripts/_tizadaVsArb.py <producto>` compara el
   arb con la tizada mas nueva: es un aviso opcional para ir a preguntar, nunca la fuente.
   **Limite conocido:** el freno corre en `_arbCargar.py`; un alta (`_arbAltaLote.py`) o una
   sustitucion con cantidad (`_arbSustituir.py`) no pasan por el, asi que ahi la regla la cumplo
   yo: sin planilla o mail de Pablo, el consumo no se escribe. Caso: microfibra del Upper
   Trimming, 0,0724 cargado el 31/07 (un alta) con el paño y las piezas de una BOM de 2025.

Enforcement: hook `consumos-entregable-guard.sh` (PreToolUse, logica en
`scripts/_lib/guardianes.mjs`) recuerda el checklist 1×/h al detectar trabajo de
consumos/entregables — como `additionalContext`, no bloquea. Que cuenta como "trabajo de
consumos" es la lista `guard_disparadores` del canon (rutas de BOM, INSUMOS.TXT, scripts
`_arb*`/`_validarConsumos`, "carga arb", tizadas; la palabra suelta "consumo" no esta en la
lista, para poder escribir memorias y reglas sobre consumos), calibrada el 05/09/2026 contra
los disparos reales de 15/08-04/09. Reglas canonicas viven en
`scripts/_lib/consumosCanon.data.json` — regla nueva de Fak se agrega AHI en la
misma sesion, con `fuente:`.
