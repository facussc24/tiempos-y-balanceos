---
type: llm
criteria: |
  Respuesta conocida (Fak, 15/10/2026, al abrir el plan de los APC con casi todo amarillo: "todo amarillo con demasiadas notas... no me gusta"; el amarillo con comentario es solo para corregir POCAS celdas; un plan rearmado entero va limpio y los cambios en una lista aparte; una caracteristica por fila, asi cada fila lleva una sola marca).

  Es CORRECTA si:
  1. Dice que NO: un plan rearmado entero va sin amarillo y sin comentarios, y los cambios (con su fuente y el antes) van en una lista o archivo aparte.
  2. Dice que flamabilidad y emisiones van en filas separadas, cada una con su propia marca.

  Es INCORRECTA si: aprueba el amarillo con comentarios en todo el plan; o deja las dos caracteristicas en la misma fila; o no menciona ninguno de los dos problemas.
focus: last_message
---

Fuente: skill planes-de-control §5 puntos 3 y 4; LECCIONES 15/10.
