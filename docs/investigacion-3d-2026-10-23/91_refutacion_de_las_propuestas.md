**1. SIN RESPALDO**

- **Encabezado: «Salen del informe (`INFORME_borrador.md` …)».** El adjunto es `INFORME_final.md`, y la numeración no siempre coincide (ver abajo).
- **P1: «Indicador del informe §10.1: cero filetes o estética antes del barrido verde».** El §10.1 dice otra cosa: «antes de la entrega existen el barrido verde y las holguras medidas, y bajan tus marcas por fase». El indicador inventado mide el camino, que es justo lo que el §4.1 pide no calificar.
- **P9: «Para corregir alcanza con cambiar parámetros por COM» (informe §4.8).** En el informe es «(opinión) … alcanzaría». Una opinión en condicional pasó a ser un hecho.
- **P10: «El informe §3.12 sugiere revisar el 3-2-1».** Es el §3.13. El §3.12 es rosca en plástico.
- **P11: «crítica §7.3: el único indicador es un examen».** Es el §7.2. El §7.3 es la calibración del revisor.
- **P8 cita mal TICK.** TICK respalda checklists *generadas para cada instrucción* (§3.3). P8 propone checklists fijas por fase, escritas a mano. También cita CADSmith sin su salvedad: la mediana casi no cambia (0,55 → 0,48) y hay una pieza que pasó todo y estaba mal.
- **«NO propongo», copilotos: usa el 17,5 % de CADWorld como argumento en contra.** El informe §2.8 dice textual que «no sirve a favor ni en contra».
- **Cifras sin su salvedad:**
  - P3, «19,6 % con 2 poses»: falta «en un brazo robot».
  - P3, «< 5% of the time»: es la estimación de un usuario, no una medición (§3.8).
  - P14, Formlabs «ineffective»: falta la salvedad del §3.15 (vendedor, SLA).

**2. ARCHIVO O SECCIÓN EQUIVOCADA**

- **P1: «4, fabricación y entrega: los gates de hoy».** Los GATE P, 0, 1 y 2 son de antes de modelar (`SKILL.md` §3, pasos 0 a 3), y el propio P4 manda el GATE P a la fase 0.
- **P1: «La seguridad deja de estar en "Estética y seguridad — DESPUÉS"».** Ese título no existe en ningún archivo de la skill: es del plan de Fak (crítica §4). En `SKILL.md` no hay nada que sacar.
- **P3: cronómetro en `cadlib.envcheck`.**
  - Hoy envcheck solo verifica el intérprete (§1).
  - El «~5 min por posición» del 20/10 corrió en CATIA.
  - Un cronómetro solo en cadlib repite el punto ciego que P1 le marca a un freno «solo en `cadlib`».
- **P5: cambio del GATE 1.** El GATE 1 «extiende `core-prohibiciones` #1». Si se cambia sin tocar esa prohibición, quedan dos reglas que se contradicen, y ese archivo no figura en la lista de los que se tocan.
- **P8: `revision_ciega.py`.**
  - Hoy «sale siempre con 0» y recibe `--step <pieza>`.
  - No escribe evidencia en el manifest ni toma un conjunto.
  - P8 no dice que pase a hacerlo, así que el cierre de fase de P1 no tiene qué leer.
- **P9: «Corre … en los builds de build123d».** No hay un punto de entrada común: cada build es un script de proyecto (`examples/posicionador/build_v2b.py`, `params.json` del workdir). Hace falta un helper en `cadlib` que cada build tenga que llamar. `catia_base` no tiene ese problema.
- **P10: «el `paso0` sale de esta skill».**
  - El bloque está entre los marcadores `<!-- paso0:inicio/fin -->`, señal de que lo inyecta un script.
  - Si se borra a mano, puede volver solo.
  - Primero hay que encontrar el inyector.
- **P10: «menos de 500 líneas».** El `SKILL.md` adjunto ronda las 450 (conteo propio, aproximado). El tope ya se cumple y no obliga a podar nada. El que muerde es el de palabras por fase.
- **P13: rojo por una «cifra escrita a mano en las fuentes de la página».** `gate_entregable.py` juzga la carpeta de entrega (PDF, STEP, renders), y del PDF no se sabe qué número fue tipeado. Para esto hace falta darle las fuentes como entrada nueva.

**3. SÍNTOMA, NO CAUSA**

- **P7: «`SKILL.md`, arriba de todo, la regla de salida».**
  - Es el sexto «antes» de los cinco que ya compiten (crítica §3).
  - El registro de marcas no tiene disparador: nada lo llena cuando marcás algo.
  - El chequeo solo mira que una regla nueva traiga sus campos.
- **P8: reordenar `preguntas-antes-de-disenar.md`** («la 60 deja de estar última») es mover prosa. G-E4 falla por estar al final **y** por ser «sin gate automático». P8 arregla lo primero, no lo segundo.
- **P4: «Después de cada corrección se revalida lo medible».** No nombra script ni momento: depende de acordarse.
- **P5: el protocolo de integración «corre al integrarla».** Tampoco tiene script ni disparador. Como guarda del barrido de P3 y de `catia_base`, se dispara solo.
- **P1, fase 1: «2 o 3 alternativas con tabla de decisión».** Ningún control lo verifica, y no está en el pliego de P4. La falta «Alternativas de concepto» (crítica §6) sigue siendo texto.
- **P14 «chico si solo avisa».** Un aviso fuera de la cadena es una más de las ~30 «herramientas que hay que acordarse de correr».

**4. TAMAÑO O RIESGO MAL CALCULADO**

El documento no escribe la regla: remite a `codigo-madre.md`, que no vino. La reconstruyo de sus propias justificaciones: grande = sin caso anterior, se usa en cada diseño o cambia el método.

- **P3, de mediano a grande, o partido.**
  - La cinemática de lazo cerrado (cuatro barras, §8) no tiene caso anterior.
  - El cronómetro común toca todos los CLIs.
  - Es el freno de fase 2 de todo mecanismo.
  - De `sim_rapida.py` se hereda solo el barrido.
- **P7, de mediano a grande.** «Cambia cómo aprende la skill» y no tiene caso anterior: es el mismo argumento con el que P1 se declara grande.
- **P8, mediano sin justificación, debería ser grande.** Corre en cada cierre de fase de cada diseño y reorganiza un archivo de lectura obligatoria.
- **P9, de mediano a grande.** Editar por COM no tiene caso en la casa (el informe lo da como opinión y dice que no hay benchmark de COM), y se usaría en cada corrección.
- **P14, de chico a mediano.** Tiene que reconocer tornillos y lo que atraviesan (es su propio riesgo), y «corre al cierre de la fase 3» lo ata a P1.
- **P11.** La corrida «sin skill», con parte oculta y varias corridas, es una tarea de diseño completa, no «se suma un caso».

Riesgos que faltan:

- **P1: dispositivos sin partes móviles** (posicionador, gancho, nidos). Chocan con «sin barrido verde no corren …» y van a vivir de `--reason`, y el bypass se vuelve costumbre. Hay que condicionarlo a «si hay partes que se mueven», como hace P5.
- **P10: tope de ~2.000 palabras por fase.** Implica reescribir `catia.md` (~11.000) y `lecciones-caras.md` (~9.000), y eso no está contado.
- **P9: los controles nuevos suman mediciones.** El antes/después por pieza y la reapertura después de cada `SaveAs` son justo lo que «tumba» CATIA.
- **P6: con la zona sin declarar «se toman todas las caras exteriores».** Así, el falso positivo masivo es seguro, no un riesgo.

**5. FALTA**

- **Causa 3 (c), el redondeo por COM de «más de 10 min».** Queda como riesgo de P2 («hay que medir»). Nadie lo ataca, y sin eso la mitad CATIA de los constructores no sale.
- **P2 sin el dato de repetición.** No depende de saber cuántas piezas se repiten, que el informe pide antes de construir grande (§3.5, §5, §11). El propio documento lo exige para PartCAD.
- **Se cayeron en silencio,** sin propuesta y sin figurar en «NO propongo»:
  - del §8, fase 3: la «unión con poscondición» (§4.3, «barato de copiar») y `design_audit`;
  - de la crítica §6: el «peso del útil (E4) calculado del modelo».
- **§9.8, la poda.** «Una regla que en varios diseños no frenó nada pasa a archivo»: P10 tiene el tope, pero no la poda.
- **Riesgos vivos fuera de las causas:**
  - `ROADMAP.md` lista la skill global `text-to-cad-harness` (earthtojake/text-to-cad), el mismo repo que según el informe manda telemetría por defecto. Hay que verificarlo y apagarla.
  - `build123d-mcp.md` avisa de un `.mcp.json` sin commitear que hoy cuesta 30 s en cada arranque. «NO propongo» lo trata como hipotético.
- **Las 5 del §10:** todas tienen propuesta.

**6. CONTRADICCIONES**

- **P1 contra P2 y P5.** P1 dice «sin barrido verde no corren los constructores». Pero la búsqueda de la fase 1 empieza por «los constructores de P2», y la palanca validada es un constructor que hace falta en la fase 2.
- **P1 contra sí mismo.** Dice «el control mira el resultado, no el orden», pero su prueba («redondear antes del mecanismo tiene que terminar con error») y su indicador miden orden.
- **P6 contra P4.** P6 depende de «la zona de mano en el pliego (P4)», y la lista de campos de P4 no la tiene.
- **P7 contra P10, fechas.** P7 pide «fecha de revisión» en cada regla; P10 manda «sin fecha en el texto».
- **P7 contra P10, archivo de «por qué».** P7 manda el relato a `lecciones-caras.md`; P10 manda la historia a `enforcement-como-se-cerro.md`. Quedan dos archivos, y el §9.1 pide uno.
- **P8 contra P7.** P8 pone la pregunta 60 (cantos, atrapamiento, peso) como ítem de checklist, pero P7 manda los cantos a P2 y P6, y el atrapamiento a P12.
- **P8 contra P10.** Las checklists de P8 viven en `preguntas…`, que tiene ~3.800 palabras y pasa el tope de 2.000 de P10.
- **P2 contra G6.** P2 pone «R1,5 por defecto» y G6 pide chaflán en la cara de cama. Además, la cara de cama se decide en la fase 4 (`a_plano.py`), después del constructor.
- **P14 contra el informe.** P14 usa R3 como criterio, pero:
  - el §3.12 dice que lo de afuera contradice R3 y que hay que usar inserto o tuerca;
  - R5 saca el plástico del camino de la carga;
  - el §8 pone el chequeo en la fase 4, no en la 3.
- **«NO propongo» contra P7 y P8.** El documento dice que no suma reglas de texto, y P7 suma una regla y P8, checklists.
- **P12 contra el informe y contra P11.**
  - P12 deja cizalla y arrastre como «no cubre», y el §8 pide «más cizalla y arrastre».
  - P11 exige probar cada propuesta contra el virolador, y P12 admite que el virolador no tiene atrapamiento.
- **Orden sugerido, paso 2: «licencias (DMU, KWA) para P3».** P3 solo necesita DMU. KWA es para Knowledgeware, que está en «NO propongo».

**7. VEREDICTO**

**Sale con estas correcciones:**

1. P1, «4: los gates de hoy» → «4: GATE 3, GATE E y `export_deliverables`; los GATE P, 0, 1 y 2 van en la fase 0».
2. P1, «sin barrido verde no corren los constructores de detalle» → «…si el conjunto tiene partes móviles; los constructores de mecanismo quedan habilitados en las fases 1 y 2».
3. P1, el indicador → el del §10.1, textual.
4. P9, «alcanza» → «alcanzaría (opinión del informe §4.8, sin probar)»; tamaño grande.
5. Citas:
   - P10, «§3.12» → «§3.13»;
   - P11, «§7.3» → «§7.2»;
   - encabezado → `INFORME_final.md`.
6. P3, «cronómetro en `cadlib.envcheck`» → «en `cadlib.envcheck` y en `catia_base`»; tamaño grande, o partido en dos.
7. P4: agregar el campo «zona de mano» y nombrar qué script revalida después de cada corrección.
8. P5: el control det +1 pasa a «guarda del barrido de P3 y de `catia_base`», y se suma `core-prohibiciones` #1 a los archivos que se tocan.
9. P8:
   - «`revision_ciega.py` escribe evidencia con firma en el manifest»;
   - sacar la pregunta 60 del ejemplo;
   - citar TICK con su alcance real.
10. P7, «arriba de todo» → «en el registro y en el chequeo, no como texto de lectura». La fecha va en `data/`, y queda un solo archivo de «por qué».
11. P14, «compara con 1,5 y 2,5·D» → «con carga, rojo si no hay inserto o tuerca (R5, §3.12); sin carga, informa 1,5 y 2,5·D». Tamaño mediano.
12. P2: sumar «depende del dato de repetición (§11)» y resolver la cara de cama contra G6.
