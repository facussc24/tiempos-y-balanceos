## 1. INVENTADO

- **P15, viñeta Formlabs.** La URL `formlabs.com/white-papers/how-to-3d-print-in-house-jigs-fixtures-and-other-manufacturing-aids/`, las «surrogate parts» y el «operando con una mano» no aparecen en ningún adjunto. El único Formlabs del material es el PDF de solidprint3d que cita P14, y habla de roscas en plástico. La «operación a una mano» aparece en f14, pero atribuida a blogs (rivcut y otros), no a Formlabs. **Hay que sacar la viñeta.**
- **Referencias [9], [15], [24], [29] y [96].** No están en ===FUENTES=== y no se pueden cotejar con los adjuntos, porque el informe base no vino. Lo que les atribuye el agregado coincide con las verificaciones:
  - [9]: BenchCAD, 64 %;
  - [15]: ArtiCAD;
  - [24]: página de Creo;
  - [29]: 2609.05559;
  - [96]: augura.

  Antes de publicar hay que confirmar que esos números son los del listado del informe. No lo marco como inventado, pero así no se puede verificar.

## 2. ESTIRADO

- **Booth [133] (§12.2, P15, P6 y P12).** El agregado dice «en un aula, sin consecuencia, no tuvo efecto». La fuente atribuye el resultado nulo a la **motivación** («highlights the limitations of the worksheet»). Que fuera por falta de consecuencia es lectura de la verificación de f12, no del paper. Con esa lectura se justifican tres cambios (P6, P12 y P15), así que hay que corregirla.
- **CAD-bench [143] (§12.3).** Poner «3,7 % en tareas funcionales» al lado de «con retroalimentación, los agentes llegan a 67,7 %» sugiere que la retroalimentación sube lo funcional de 3,7 a 67,7. La verificación compara 67,7 % contra el **59,9 % del mejor modelo**, no contra el 3,7. Además falta el límite que dan los propios autores: solo 17 tareas.
- **Marwood 16.1 como apoyo de P15.** La prueba que decide en Marwood es un **Gauge R&R**, o sea, la repetibilidad de un calibre metálico de chapa. Pasar de eso a «probar la pieza impresa en el puesto con el tapizado» es una analogía, y hay que decirlo así. El §12.4 dice que «el estándar la exige» sin ese matiz.
- **«Tres puertas formales sobran»** (§12.4 y riesgo de P15). La verificación de f14 dice «**pueden ser** sobrecarga».
- **«Hoy los controles miran el modelo»** (§12.4). El informe de f14 dice «**parece** controlar el modelo». Leyendo P1-P14 se sostiene, porque K5 solo registra. Pero conviene apoyarlo en P1-P14 y no en f14.
- **Chaflán de Marwood 7.3** (§12.4, P6). La verificación aclara que el 7.3 vale **solo para los rasgos que no son de control**, y es acero o aluminio. Como apoyo de «chaflán = no vivo» en la zona de mano es débil, y no se dice.
- **NO propongo, ítem TO.** Dice «La simulación sobreestimó la rigidez en FDM entre 14 y 52 %». La fuente es **un estudio con CF-PLA**, sin abrir. El §12.1 lo decía bien; el ítem lo generaliza.
- **Onshape como confirmación de P9 [139].** Los agentes «tracked, visible, and reversible» son, según la verificación, «una visión a futuro, sin fecha». Confirman una intención del vendedor, no una práctica.
- **Fijación por ejemplos, «un estudio de 2020 encontró lo contrario» [155].** Ese estudio encontró menos fijación con el ejemplo dado que con la idea propia. No contradice la réplica de 2013, que trata sobre el efecto de las advertencias. Mejor: «otro estudio encontró menos fijación con el ejemplo que con la idea propia».
- **[127].** Lo que el agregado atribuye a ese issue, la cara de cama contada como voladizo y la separación entre «no medido» y PASS, sale de los issues #65 y #66. No consta que la verificación los haya abierto: los cita a través del #81.

## 3. SIN MARCAR

- **P15, Omni3D.** Está marcado como vendedor, pero falta **(solo búsqueda)**: así figura en la verificación de f12.
- **§12.3, «O sea, tus controles solo atrapan lo que alguien escribió».** Es la conclusión del informe de f13 a partir de un competidor. Va como **(opinión)**.
- **§12.4, «La cinemática la tiene que controlar un solver o la prueba física, no el modelo».** Es inferencia de la verificación. Va como **(opinión)**.
- **§12.4 y P2, «Lo "profesional" es información, según el estándar».** Marwood pide placa, peso y secuencia; no habla de «profesional». Ese encuadre es opinión del informe de f14. P2 sí marca como opinión que eso resuelva las «cajas peladas», pero el marco «profesional» queda atribuido a Marwood.
- **Onshape, «en octubre está en Labs».** No hay fuente abierta para eso: la nota del 05/10 no se abrió, y lo del MCP en Labs lo dice un competidor. Va como (fuente sin abrir).
- **Creo [24].** Es la página de venta, con Assist en beta y Automate en alfa. Se usa como confirmación de P1 y P8 sin decir que es marketing.
- **SL Corp [117].** Es un caso publicado por Materialise, que es vendedor. No se marca.
- **NX [142].** Figura como «abierta» por el informe, pero la verificación la dejó **sin verificar**. Hay que agregarlo.

## 4. P15 y los cambios

**Respaldo.** P15 tiene respaldo razonable: Marwood con el matiz del Gauge R&R, Omni3D marcado, y K5 y P7 en la casa. Hay que sacar Formlabs y corregir Booth. El tamaño mediano es coherente con la tabla.

**Contradicciones o huecos:**

- **P5 contra P15: el índice se vacía.** El cambio a P5, «solo dispositivos con "pasa" en P15», deja afuera todo lo que ya está «fabricado y andando» sin registro P15, incluida la palanca. Eso rompe la prueba de P5: «la palanca "ya existía hecha y probada" tenía que aparecer en los pasos 1 a 3». Falta una regla de migración. Por ejemplo: lo que ya está en uso entra como «pasa por uso», con fecha y quién lo afirma, o como «no probado» visible en la búsqueda. Sin eso, P15 desarma P5.
- **KWE «para los controles de P6 y P13».** P13 controla la página de entrega y `pasos.json`, no el `.CATPart`. KWE no ve eso. Tiene que decir **P6** (y como mucho P14).
- **Fase «planta».** P7 registra la fase con P1 en 0 a 4. «Planta» es un valor nuevo. El cambio a P1 lo agrega en la fase 4, pero el registro de P15 dice fase «planta»: hay que unificar.
- **Las 5 del §10.** El §12.4 dice «cambia el #1… las otras cuatro quedan igual», pero la tabla y P15 dicen «#1 y #5». Hay que alinear.
- **P6, chaflán.** Decide el principio («cuenta como no vivo») con un apoyo débil (ver 2). Conviene dejarlo como propuesta a decidir por vos.
- **P6 y P12, fecha de vencimiento del aviso.** No contradicen nada, porque P6 y P12 ya dejaban la decisión en tus manos. Pero el motivo hereda el estiramiento de Booth.
- **P4, material.** Bien. Está rotulado como referencia y no como número de la A2L, y no choca con «sin chequeo propio de fabricación».
- **P2, placa.** No choca con «no más reglas de texto», porque es un constructor y no una regla.

## 5. VEREDICTO

**Sale con estas correcciones:**

1. P15, viñeta Formlabs → **eliminar**.
2. «Omni3D: … es un vendedor» → «… es un vendedor; solo búsqueda».
3. «En un aula, sin consecuencia, no tuvo efecto» (§12.2, P15, P6 y P12) → «en un aula no tuvo efecto; los autores lo atribuyen a la motivación (que sea por falta de consecuencia es lectura nuestra)».
4. «Con retroalimentación, los agentes llegan a 67,7 %» → «en el puntaje general, los agentes con retroalimentación llegan a 67,7 % contra 59,9 % del mejor modelo; son 17 tareas».
5. P5, «solo dispositivos con "pasa" en P15» → «…; lo ya fabricado y en uso entra como "pasa por uso" (fecha y quién) o "no probado" visible, nunca excluido».
6. «Candidato para los controles de P6 y P13» → «candidato para los controles de P6».
7. «La simulación sobreestimó la rigidez en FDM entre 14 y 52 %» → «en un estudio con CF-PLA, la simulación sobreestimó la rigidez entre 14 y 52 %».
8. «Cambia el #1 en un punto… las otras cuatro quedan igual» → «cambia el #1 y el #5 en un punto».
9. «La prueba física… el estándar la exige» → «el estándar exige una prueba (Gauge R&R de un calibre metálico); trasladarla a la pieza impresa en el puesto es analogía».
10. «Tres puertas formales sobran» → «tres puertas formales pueden ser sobrecarga».
11. «Lo "profesional" es información, según el estándar» → «el estándar pide identificación: placa, peso, secuencia (llamarlo "profesional" es opinión)».
12. «O sea, tus controles solo atrapan lo que alguien escribió» → anteponer «(opinión)».
13. Onshape, «en octubre está en Labs» → agregar «(fuente sin abrir)».
14. Confirmar que [9], [15], [24], [29] y [96] apuntan a lo que se les atribuye en el listado del informe base.
