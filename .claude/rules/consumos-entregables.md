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

Enforcement: hook `consumos-entregable-guard.sh` (PreToolUse) inyecta el
checklist al detectar trabajo de consumos/entregables. Reglas canonicas viven en
`scripts/_lib/consumosCanon.data.json` — regla nueva de Fak se agrega AHI en la
misma sesion, con `fuente:`.
