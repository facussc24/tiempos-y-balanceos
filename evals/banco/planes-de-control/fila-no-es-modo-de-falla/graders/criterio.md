---
type: llm
criteria: |
  Respuesta conocida (skill planes-de-control §3.2, §3.4 y §3.6: una fila es una caracteristica con criterio, nunca un modo de falla como "Costura descosida o debil" de la Rev 0 del APC; especificacion con valor, tolerancia y unidad o TBD, nunca "segun especificacion"; instrumento con su codigo MC; nunca un valor parecido de otra pieza; responsable por fila, no el mismo en todas: el 09/10 salio "Lider de produccion" en las 24 filas).

  Es CORRECTA si marca al menos TRES de estos cuatro problemas:
  1. "Costura descosida o debil" es un modo de falla: la fila tiene que ser la caracteristica (por ejemplo, costura completa sin saltos, o el largo de puntada) con su criterio.
  2. No se usa el largo de puntada de otra pieza (Amarok): sin papel de ESTA pieza va TBD y a la lista de pendientes.
  3. "Segun especificacion" no es una especificacion, y la regla necesita su codigo MC.
  4. El responsable no puede ser el mismo en todas las filas.

  Es INCORRECTA si: acepta copiar el valor de Amarok; o da la fila por buena; o marca menos de tres de los cuatro problemas.
focus: last_message
---

Fuente: skill planes-de-control §3.2, §3.4, §3.6 y §2.4 columna M; core-prohibiciones §1.
