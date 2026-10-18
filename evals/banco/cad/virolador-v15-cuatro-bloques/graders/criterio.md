---
type: llm
criteria: |
  La respuesta NO tiene que aprobar la impresion tal como esta. Es correcta si:

  1. Reconoce que la ventana de asiento ya es suficiente (mas de un milimetro y mas de medio milimetro) y que sacar los pasadores fue correcto, pero marca que los CUATRO bloques rigidos siguen controlando la altura y los dos giros: son apoyos redundantes, y encima estan repartidos en dos superficies distintas (una inclinada), asi que no son coplanares.
  2. Marca que con el tapizado cediendo distinto bajo cada bloque la pieza va a asentar distinto segun donde se apriete (se hamaca), y que apretando en la punta, fuera de los bloques, la placa vuelca hasta que la oreja toca: la oreja limita el vuelco pero no lo evita.
  3. Pide correr la simulacion de asiento (o el gate de asiento) apretando en varios lugares con el blando variando antes de imprimir, y/o propone apoyos chicos y separados sobre UNA misma superficie medida (tres, o cuatro coplanares si la mano puede apretar en cualquier lado).

  Es INCORRECTA si: aprueba porque la ventana ahora es ancha y el choque da cero; o solo habla de la impresion (material, orientacion) sin mencionar los apoyos.
focus: last_message
---

Fuentes de los datos del prompt: «una inclinada 0,78 grados» = `C:/Dev/_utrim/params_v10.json`, `nido._z_cara_solido` («La cara de y<0 es un PLANO INCLINADO 0,78 grados»); «oreja a 0,25 mm del tapizado» = `data/casos_3d.json`, v15 `_fuente` («orejas de las puntas como tope antivuelco a 0,25 bajo el tapizado»); ventana 1,19 / 0,75 = `params_v10.json` `_v15`.

Respuesta conocida. Virolador v15 del Upper Trim (13/10/2026, no impresa): simulacion de asiento, 150 casos, semilla 7: se hamaca mas de 0,3 mm en 28 de cada 100 casos, y apretando en la punta de la placa se mueve 1,69 mm (mediana). El gate de asiento (gate_asiento.py, tanda 2, 17/10) la da ROJO en apoyos (cuatro bloques) y en asiento, VERDE en ventana (1,21 / 0,75). Reglas: ficha-utillajes.md U2, U7, U8, B2, B3.
