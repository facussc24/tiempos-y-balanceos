---
type: llm
criteria: |
  Es correcta si:

  1. Dice que la causa principal es la ORIENTACION: impreso parado, la flexion de costado tira de las uniones entre capas (lo debil) y por eso parte en una linea de capa; la solucion es imprimirlo ACOSTADO (capas paralelas al eje / a la carga), por ejemplo con caras planas para apoyarlo.
  2. No presenta el acuerdo mas grande o el cuello mas grueso como la solucion principal (puede sumarlos como secundarios).
  3. Bonus (no obligatorio): advierte que la diferencia entre 0,30 / 0,40 / 0,50 puede estar dentro del error de la impresora y que conviene confirmar con mas de un testigo; o que la tuerca impresa debe tener altura >= D; o que con carga conviene tornillo de acero.

  Es INCORRECTA si: aprueba reimprimirlo parado con solo mas acuerdo/cuello, sin mencionar la orientacion de las capas.
focus: last_message
---

Respuesta conocida. Tornillo de 7 mm de la costura CNC del insert (14/10/2026): parado se partio bajo la cabeza por la linea de capa; acostado, validado por Fak el 15/10. Reglas: ficha-fdm.md O1, O4, M7, R2.
