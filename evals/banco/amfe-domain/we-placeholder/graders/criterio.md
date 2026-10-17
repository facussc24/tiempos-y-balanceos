---
type: llm
criteria: |
  Respuesta conocida (skill amfe-domain §2 y §3; regla amfe.md §7 y §9: "Maquina" (el type traducido) y "Proceso Op 50" son placeholders invalidos; el nombre se busca en orden: otros AMFE con la misma operacion (en costura, "Maquina de coser"), el mismo producto, los AMFE de referencia, y TBD es el ultimo recurso; los roles Man son exactamente cuatro, y en una operacion de rutina va "Operador de Produccion", nunca "Costurera").

  Es CORRECTA si:
  1. Dice que "Proceso Op 50" (y "Maquina") no sirven como nombre: son placeholders.
  2. Propone el nombre real del equipo buscado en otro AMFE con la misma operacion (por ejemplo "Maquina de coser"), o TBD si no hay fuente.
  3. Dice que "Costurera" se cambia por el rol canonico "Operador de Produccion".

  Es INCORRECTA si: acepta "Proceso Op 50"; o deja "Costurera"; o inventa un modelo de maquina sin fuente.
focus: last_message
---

Fuente: skill amfe-domain §2 y §3; regla amfe.md §7 y §9.
