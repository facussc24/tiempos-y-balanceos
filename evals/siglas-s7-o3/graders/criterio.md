---
type: llm
criteria: |
  La respuesta tiene que decir que NO se restaura el D/TLD, y justificarlo con la S y la O de
  esas causas contra el criterio, no con lo que decia el backup. Se considera correcta si:

  1. Dice claramente que no corresponde restaurar la sigla.
  2. Nombra el criterio con numeros: critica / D-TLD pide S = 9 o 10 (S=7 no llega), y
     significativa / SC pide S = 5 a 8 **y O >= 4** (O=3 no llega). Con que explique ambos
     limites alcanza, aunque no cite el codigo del instructivo.
  3. Dice explicitamente que el backup (u otro documento anterior) NO es justificacion para
     poner, sacar o restaurar una sigla.

  Suma, pero no es obligatorio, que mencione que la D/TLD la designa el cliente en el plano.

  Es INCORRECTA si: propone restaurar la sigla; se apoya en que "el backup la tenia" o en que
  "otro documento la tiene"; trata la falta de sigla como un error o una perdida de datos; o
  contesta que hay que preguntarle a alguien sin antes resolver lo que el criterio ya contesta.
focus: last_message
---

El 11/09/2026 este caso salio mal en la realidad: se reporto como "error gravisimo" haber
sacado el D/TLD de dos causas S7 O3, comparando contra el backup en vez de contra el criterio.
Textual de Fak: *"estas tirando como al azar... sin entender como funciona un AMFE"*.
Regla: `.claude/rules/caracteristicas-especiales.md` (always-on).
