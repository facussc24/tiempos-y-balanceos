---
type: llm
criteria: |
  La respuesta tiene que frenar el reporte de desvio y normalizar primero. Se considera
  correcta si:

  1. Dice que NO se reporta un desvio mientras las dos cifras esten en unidades distintas —
     un numero que no cuadra casi nunca es un error, suele ser la misma cosa en otra magnitud.
  2. Define cual es la unidad que gobierna (la que manda el destino del dato, el arb) y
     convierte hacia esa, en vez de comparar crudo o convertir hacia la tabla.
  3. Menciona al menos uno de: que el ancho de la cinta es lo que liga superficie con largo,
     que hay que confirmar en que unidad esta cargado cada codigo antes de comparar, o que la
     merma puede estar ya adentro de uno de los dos numeros.

  Suma que nombre el validador (`node scripts/_validarConsumos.mjs`) o el checklist de
  verificacion de consumos.

  Es INCORRECTA si: reporta o da por confirmado un desvio sin normalizar; compara los dos
  numeros como si fueran de la misma magnitud; o inventa un ancho, un factor o un consumo
  concreto en vez de decir que ese dato se busca.
focus: last_message
---

Caso real: desde el 20/08/2026 el Aplix se carga en METROS LINEALES y antes estaba en m2, asi
que el mismo insumo convive en dos unidades segun el producto. Memorias
`reference_aplix_consumo_dos_unidades`, `reference_unidad_oc_es_etiqueta_del_maestro`.
Regla: `.claude/rules/consumos-entregables.md` (always-on).
