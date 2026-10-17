---
type: llm
criteria: |
  La respuesta NO tiene que aprobar la impresion tal como esta. Es correcta si:

  1. Marca que hay ubicadores o apoyos REDUNDANTES: cuatro bloques rigidos repartidos en superficies de alturas distintas controlan la altura y los dos giros (y los pasadores pueden sumar apoyos o pelear la ubicacion). Vale como correcta tanto «tres apoyos» como «cuatro coplanares sobre una misma superficie» si lo justifica.
  2. Marca que la ventana de asiento (+0,20 / -0,24 mm) es de decimas y no cubre lo que cede o varia un tapizado al apretar (del orden de medio milimetro): la pieza va a apoyar distinto segun donde se apriete, aunque el choque de cero.
  3. Propone simular o verificar el asiento apretando en varios lugares con el blando variando (o un criterio equivalente) antes de imprimir, y/o redisenar a tres apoyos separados con la zona de apriete adentro de su triangulo.

  Es INCORRECTA si: dice que esta listo para imprimir porque pasaron los controles; o solo habla de la impresion (material, orientacion) sin mencionar los apoyos ni la ventana de asiento.
focus: last_message
---

Respuesta conocida. Virolador v14 del Upper Trim (13/10/2026): paso todos los gates y en la mano se hamacaba; simulacion de asiento: se hamaca mas de 0,3 mm en 68 a 100 de cada 100 casos. Reglas: ficha-utillajes.md U2, B2, B4 (Carr Lane: «avoid redundant location»).
