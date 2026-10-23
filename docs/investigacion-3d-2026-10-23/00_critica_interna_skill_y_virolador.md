## 1. Causas de raíz

Clases: **(a)** la regla existía y nada la disparó, **(b)** la regla no existía, **(c)** faltaba una herramienta.

**1. Se metió en la estética antes de que el mecanismo funcionara.**
- **Lo que dice la skill.** El flujo es una fila de nueve pasos («0. Declarar el PROCESO … 4. Modelar … 7. Armar lo que Fak mira … 8. Entregar», `SKILL.md` §3) sin criterio de salida entre uno y otro. El único freno duro está al final: «El duro está en `export_deliverables.py`» (`SKILL.md`, Enforcement).
- **Lo que no dice.** Que primero se cierra la cinemática y después la forma. La regla de fases aparece recién en `DONDE_QUEDO.md` («regla de Fak 20/10: no se pasa de fase sin cerrar la anterior»).
- **Lo que empuja hacia lo visual.** El GATE E (motor de imagen, color del render, PDF «a prueba de boludos») y la revisión ciega, que recibe «**solo** el PDF y los renders» (`SKILL.md` G-E4).
- (opinión) Hay mucho control sobre cómo se ve la entrega y ninguno sobre si el mecanismo quedó cerrado antes de detallar.
- **Clase: (b).**

**2. Dibujó desde cero una palanca que ya existía.**
- **Lo que dice la skill.** El GATE P (c), «Retorno de experiencia», mira solo «lo que Barack **ya tiene fabricado y andando**» a través de `indice_dispositivos.py`. El catálogo comercial y los modelos de comunidad no entran.
- **La pregunta llegó tarde.** La de catálogo (`preguntas-antes-de-disenar.md` grupo 5, «¿Lo que se mueve ya existe de catálogo?») está marcada ⊕ y fechada «Fak, 20/10/2026»: se escribió después del error.
- **Una regla juega en contra.** El GATE 1 exige que «Toda cota se EXTRAE del CAD medido … o es dato de Fak». La propia skill admite que «para un rodamiento comprado no hay fuente válida posible» (`SKILL.md`, «Lo que los gates NO cubren»). La regla contra inventar cotas empuja a dibujar.
- **Falta de herramienta.** CATIA no traga mallas («3.700 triángulos = 150.000 entidades», `catia.md` 20/10), así que la pieza de catálogo «se REDIBUJA».
- **Integrarla tuvo errores propios que ningún gate mira.** La palanca quedó armada en espejo («det = −1», `AUDITORIA_auditor.md` hallazgo 1) y la asignación mango/brazo no tiene respaldo (hallazgo 5).
- **Clase: (b) + (c),** con una regla en contra.

**3. Cajas peladas, poco profesionales, con cantos que lastiman.**
- **La regla existía.** `ficha-utillajes.md` E5: «Ningún canto que toque la mano … sin redondear».
- **El mecanismo correcto ya estaba inventado.** «el redondeo es PROPIEDAD del constructor (`caja_tope_redondeado()` en el build)» (`utillajes-de-apriete.md`). Pero esa función vivía en el build123d del virolador de agosto. El 20/10 se modeló con `scripts/catia/`, donde no existe: la protección quedó en un proyecto, no en la biblioteca.
- **El control que suena parecido mide otra cosa.** `gate_aristas.py` caza «concentradores **cóncavos**» (fatiga). Los cantos que cortan la mano son **convexos**, y ningún control los mira.
- **Herramienta.** El redondeo por COM va «arista por arista … más de 10 min» (`catia.md` 20/10).
- **Cantos del propio dispositivo.** La pregunta es la n.º 60 de 60 (`preguntas…` H.60), fuera de los 8 grupos obligatorios.
- **Aspecto «profesional».** Fak ya lo había dicho en agosto («no parece un diseño profesional, parece un parche mal hecho», `utillajes-de-apriete.md`). La respuesta fue una regla sobre parches, no un estándar de aspecto.
- **Clase: (a)** para cantos, **(b)** para aspecto, **(c)** por CATIA.

**4. Simulaciones de minutos por posición.**
- **La regla existía.** «si una consulta 3D va a tardar más de 2 minutos, está mal planteada» (`SKILL.md` §3bis). Pero está bajo el título «Antes de mallar: LEER LA TOPOLOGÍA» y nada mide el tiempo: no hay cronómetro que avise.
- **Contradicción.** La lección 36 dice «Un muestreo no le gana a un booleano … el muestreo sobra». Con «~5 min por posición» de booleano exacto (`catia.md` 20/10), esa lección y el presupuesto de 2 minutos no se pueden cumplir juntos.
- **Herramienta.** El GATE 6 «Gira los sólidos `--moviles` alrededor del eje»: un solo eje, y un cuatro barras no es eso. `manifold3d` estaba instalado pero no figura en la lista de entorno de `SKILL.md` §1.
- **Clase: (a) + (c),** más una contradicción.

**5. Rehacía el modelo entero en cada corrección.**
- **La receta lo mandaba.** `catia.md` «Receta», paso 2: «Un script por pieza con `catia_base.correr(..., fresca=True)`: CATIA propia recién abierta». Y también: «Para lo largo, CATIA recién abierta».
- **La arquitectura de toda la skill es «script que regenera».** `params.json` (`SKILL.md` §2) y build parametrizado (§3 paso 4).
- **La regla contraria nació ese día, al fondo del mismo archivo.** «No rearmar desde cero en cada corrección» (`catia.md` 20/10), sin tocar la receta de arriba.
- **La herramienta empuja a regenerar.** «Muchas mediciones en una misma sesión la tumban» y un `SaveAs` puede dejar «el archivo ESCRITO pero ROTO» (`catia.md` 20/10).
- (opinión) Regenerar por script no es el problema; el problema es regenerar todo, lento, adentro de CATIA.
- **Clase: (b) + (c),** con la receta en contra.

**6. Fak tuvo que marcar lo que un diseñador ve solo.**
- **La skill lo sabe.** «Fak termina siendo mi control de calidad». Y sobre los gates: «todos nacieron DESPUÉS de que una persona encontrara el bug … demuestran memoria, no capacidad de detección» (`SKILL.md` §0).
- **El crítico llega al final.** G-E4 corre «después del GATE E verde» y es «sin gate automático».
- **No hay revisión en el medio.** Los 8 grupos son una pasada única antes del croquis.
- **El auditor encontró 4 rojos** (`AUDITORIA_auditor.md`), y dos tenían regla escrita:
  - Números tipeados en la página (el «0,1 mm» del tope, los «47 mm» de la barra), contra la lección 39: «si el dato existe en el JSON, el documento lo LEE».
  - Un guardado que «falló callado», contra «Después de un guardado con excepción se reabre el archivo» (`catia.md`).
  - El tornillo que no toma la tuerca (hallazgo 4) no tiene regla.
- **Clase: (a), de mecanismo.**

**Patrón común**

1. **Los controles están en los dos extremos.** Un cuestionario largo al principio y un export que bloquea al final. En el medio (elegir el concepto, armar el mecanismo, iterar) nada se dispara.
2. **La skill es un verificador de piezas contra el STEP del cliente, no un método para diseñar mecanismos.**
   - Su descripción es «importar … medirlo, registrarlo … verificar interferencia».
   - El 20/10 se diseñó un cuatro barras en CATIA. El §3 no describe ese camino (dice build123d y gmsh).
   - `catia.md` había decidido no tratarlo («Se revisa si algún día se diseña EN CATIA por programa»), y ese día llegó el 19/10 sin que se revisara.
3. **Cada lección se escribe donde nació, como relato.** No va donde se la va a necesitar ni como control. Tres de los seis problemas tenían la regla escrita (cantos, 2 minutos, número leído del JSON) y otros dos una regla parcial.
4. (opinión) **No falta conocimiento: falta el momento en que ese conocimiento se aplica.**

## 2. Lo que está bien hecho

- **Controles que saben fallar.** Pares sintéticos BIEN/MAL en cada corrida: «si no separa, sale con **código 3** y no juzga nada» (`SKILL.md` GATE 3). Y el gemelo tiene que ser «la falla REAL de ESA geometria» (`lecciones-caras.md` 28). Es lo mejor del sistema.
- **«La máquina puede MATAR un dato, nunca APROBARLO»** (`SKILL.md` GATE P). Es el principio correcto para una IA.
- **La entrega se ata al archivo, no al nombre.** Se compara `file_signature()` en lugar del nombre del archivo, y la confirmación de zona exige un archivo de evidencia: «convierte una mentira cómoda (un flag) en una laboriosa» (`enforcement-como-se-cerro.md`).
- **Calibración contra casos conocidos.** El GATE A «no juzga una pieza nueva sin calibración vigente» que reproduzca «EXACTO lo publicado de la v14 … y la v15».
- **Criterio de aceptación escrito antes.** `ficha-utillajes.md` K1, G-E7, y el plan de la v16 «escrito ANTES de diseñarla», con «Decidí distinto del plan, con la evidencia» (`PLAN_3D_A_FONDO`).
- **Fuentes marcadas.** Las fichas distinguen ABIERTA / BUSCADOR / CASA / A MEDIR, y escriben «SIN FUENTE» en lugar de inventar.
- **Honestidad sobre los límites.** El bloque «Lo que los gates NO cubren» de `SKILL.md`.
- **Reglas de concepto, que son oficio de verdad.**
  - «si el requisito nuevo deja un subsistema sin función, el subsistema se VA» (`utillajes-de-apriete.md`).
  - «Una corrección nueva se aplica a la CLASE», con el redondeo como propiedad del constructor (ídem).
  - «Un grado de soldadura es mas barato que un rodamiento» (`lecciones-caras.md` 33).
- **El auditor independiente.** El 20/10 encontró 4 rojos medidos, cada uno con línea de código y cifra (`AUDITORIA_auditor.md`). Conviene conservarlo y adelantarlo.
- **Buscar adentro antes que afuera.** «Antes de investigar algo de CATIA afuera … se busca ADENTRO» (`catia.md`). Además, la escalera de costo de §3bis.

## 3. Lo que está mal planteado

**Medición.** Conteo a mano sobre los adjuntos, aproximado (±15 %). No tengo bytes, cuento palabras. `ingenieria-de-producto.md` no vino adjunto.

| Archivo | Tamaño | Reglas / ítems | Frena la entrega | Herramienta que hay que acordarse de correr | Solo texto |
|---|---|---|---|---|---|
| `SKILL.md` | ~6.500 palabras | 9 gates + ~45 reglas sueltas | 7 condiciones de `export_deliverables` + GATE E con `--final` | ~15 CLIs | ~25 |
| `lecciones-caras.md` | ~9.000 | 39 lecciones (~90 sub-reglas) | 2 (la 10, cavidad sellada; la 20, techo de cuerpos) | ~6 (6, 7, 8, 18, 19; la 36 con un script de un solo proyecto) | ~31 |
| `preguntas-antes-de-disenar.md` | ~3.800 | 8 grupos (~50 viñetas) + 60 preguntas | ~4 vía GATE P (fuerzas por etapa, video, índice propio, zona) | `uniones.py`, GATE A | ~54 |
| `ficha-utillajes.md` | ~1.900 | 35 | 0 | ~6 vía GATE A y G-E7, **los dos en AVISO** | ~29 |
| `ficha-fdm.md` | ~2.100 | 34 | 1 (R2, `make_screw_nut.py`) | 0 | 33 |
| `utillajes-de-apriete.md` | ~1.100 | 10 | 0 | `medir_contorno.py`; el redondeo, en un solo build | 8 |
| `catia.md` | ~11.000 | ~80 trampas y recetas | 0 en la cadena de entrega | tests de herramientas, no de diseño | — |
| `enforcement-como-se-cerro.md` / `ROADMAP.md` | ~700 / ~1.300 | historia | — | — | — |

Sin contar `catia.md`, son unas **210 reglas de diseño**:

- **~10 frenan la entrega** (5 %).
- **~30 tienen una herramienta** que la IA tiene que acordarse de correr (15 %).
- **~170 son solo texto** (80 %).

La lista que `SKILL.md` §5 manda leer «ANTES de modelar» incluye `catia.md`. Suma ~35.000 palabras (unas 50.000 unidades de texto del modelo) más la ficha de ingeniería. (opinión) Nadie, humano o IA, aplica 200 reglas leídas una sola vez al arrancar.

**Estructura**

- **Orden roto.**
  - «## 4. Verificar» va antes de «## 0. LOS GATES»; después siguen §1, §2, §3, §3bis y §5.
  - El §6 vive en otro archivo y el GATE 5 vive en `cad-3d.md` («el GATE 5 de `cad-3d.md`»).
  - `ROADMAP.md` remite a un «SKILL.md §1bis» que no existe.
- **Un bloque ajeno.** El `paso0`, sobre formularios del SGC y amarillo con «ANTES: …» en las celdas, está metido entre el GATE 6 y el GATE E. No tiene nada que ver con 3D.
- **Estados con fecha que se van a pudrir.** «AVISO la primera semana … revisar el 24/10» (GATE A, G-E5 a G-E7).
- **Diario mezclado con reglas.** Media `SKILL.md` es historia: agujeros cerrados, hipótesis descartadas, el «LIMITE CONOCIDO de G-E2». (opinión) El porqué vale, pero en el momento de diseñar estorba; tiene que ir a otro archivo.
- **Cinco «antes» que compiten.** «ANTES DEL PRIMER CROQUIS», lecciones «antes de modelar», fichas «ANTES de modelar», apriete «antes de la primera linea», GATE P «antes que todo». Cuando todo va antes, nada tiene prioridad.
- **Lo aprendido el 20/10 quedó al fondo de `catia.md`.** Está alrededor de la palabra 11.000 del archivo más largo, debajo de la receta que dice lo contrario.

**Reglas que se contradicen**

1. **Tres apoyos o cuatro.** El GATE A da «ROJO si hay más» de tres apoyos, y el 4-2-1 queda como «Renglón aparte, informativo». Pero `ficha-utillajes.md` U8 manda cuatro «sobre UN mismo plano medido», y la v16 aceptada tiene cuatro («V1 queda ROJO por la letra», `PLAN_3D_A_FONDO`).
2. **Booleano exacto o 2 minutos.** La lección 36 («el muestreo sobra») contra el presupuesto de §3bis.
3. **Cotas medidas o catálogo.** El GATE 1 (cotas solo del CAD medido o de Fak) contra cualquier pieza de catálogo.
4. **Arrancar de cero o no.** `catia.md`: la receta paso 2 (`fresca=True`) contra «No rearmar desde cero».
5. **Con qué se diseña.** «No hay skill `catia` aparte … se revisa si algún día se diseña EN CATIA» contra lo que pasó el 19 y el 20/10. Además el §3 paso 4 sigue diciendo build123d y gmsh.

**Controles que no controlan lo que dicen**

- **`gate_aristas.py`** se lee como «control de aristas», pero solo ve las cóncavas.
- **GATE P (c)** advierte que «un índice incompleto se lee igual que "no hay nada parecido"». Y el índice, por diseño, no tiene el catálogo comercial: el mismo error a mayor escala.
- **`cad-guard.sh`** «solo RECUERDA los gates 1×/hora»: avisa por reloj, no por evento.
- **«Las 39 lecciones caras —con su enforcement al lado—»** (`SKILL.md` §5): unas 31 no tienen ningún control al lado.
- **Los 8 grupos «probados» (26/30).** Se probaron con exámenes escritos por otra IA, que miden si la respuesta escrita menciona el tema, no si el diseño sale bien. La propia lista lo admite: «la prueba que vale es un pedido real». Ese pedido real fue el 20/10.

**Lo que depende de que la IA «se acuerde»**

- «Render → MIRARLO» (`SKILL.md` §4).
- «grep del nombre viejo» (lección 39).
- «TRES pasadas» (lección 29).
- «Barrer el parametro» (lección 24).
- Barrer los parámetros estáticos antes de un mecanismo (lección 33).
- «aplica a la CLASE» (`utillajes-de-apriete.md`).
- La revisión ciega.
- Leer las 35.000 palabras.

## 4. Las ideas del ingeniero

| Idea | Veredicto | ¿Causa o síntoma? |
|---|---|---|
| Trabajar por fases | **Buena, incompleta** | Causa: crea los puntos de control que faltan en el medio |
| Catálogo antes de dibujar | **Buena, incompleta** | Causa del problema 2 |
| Patas roscadas para imprimir sin soportes | **Buena puntual, con un error** | Síntoma |
| Chaflán en la cara de cama | **Correcta, ya existía** | Síntoma de (a) |
| Simular más rápido | **Buena, a medio generalizar** | Mitad causa, mitad síntoma |
| Cursos oficiales de CATIA | **Mala para estos problemas** (opinión) | No ataca ninguna causa |

**Fases.**
- **Falta un criterio de salida escrito y revisado por otro en cada fase.** El espejo de la palanca lo encontró el auditor, no el cierre de fase («el espejo lo cazó el auditor», `DONDE_QUEDO.md`).
- **La seguridad está mal ubicada.** El plan pone «Estética y seguridad — DESPUÉS» con «Cantos que toca el operario» en la fase 4. La seguridad no es estética:
  - el atrapamiento se decide en la fase del mecanismo;
  - el canto, en la primera caja, como propiedad del constructor.
- **Falta una fase de concepto con alternativas** (sección 6).

**Catálogo.** Le falta:
- **Lista de fuentes y formato.** STEP antes que STL, porque la malla es «inusable en CATIA» (`catia.md`).
- **Distinguir comercial de comunidad.** Un sargento comercial (Kipp, DE-STA-CO) viene probado por el fabricante y con carga nominal. Un modelo de MakerWorld viene «probado» por otro, en otra impresora, y con licencia a revisar.
- **Un protocolo para integrarla.** Instrucciones del autor, qué pieza es cuál, matrices con det +1: lo que falló en los hallazgos 1 y 5.
- **Arreglar el GATE 1**, con «procedencia: catálogo» como fuente válida.

**Patas roscadas.**
- **El error, por cuenta.** `DONDE_QUEDO.md` propone «~M12 en la zona maciza de la placa», y la placa mide 15 mm (`AUDITORIA_auditor.md` hallazgo 4: «placa 15 mm»). Con `ficha-fdm.md` R3 (1,5·D a 2,5·D), un M12 pide 18 a 30 mm de rosca: no entra ni con la cifra baja.
- (opinión) **Preguntar para qué regulable.** Cuatro patas regulables son un hiperestático que alguien tiene que nivelar. Si el objetivo es solo imprimir sin soportes, alcanza con una pata atornillada impresa acostada.

**Chaflán de cama.** Ya está en `ficha-fdm.md` G6: «Cara de abajo (la que toca la cama): chaflán, no filete». No falta la regla; falta que la ponga el constructor de placas o que la revise un chequeo automático de la fase de fabricación.

**Simular más rápido.** Ya está hecho (`sim_rapida.py`, «65 posiciones en 4,5 s»). Falta:
- pasarlo a herramienta de la skill, con poses calculadas por la cinemática y no un solo eje;
- escribir «malla para barrer, exacto para decidir», cerrando la contradicción con la lección 36;
- un cronómetro que avise a los 2 minutos.

**Cursos de CATIA** (opinión).
- Ninguno de los seis problemas fue de manejo de CATIA. La IA resolvió decenas de ejercicios con respuesta publicada (`catia.md` 19/10), y el mismo archivo dice «Leer el plano es el cuello de botella, no CATIA».
- Los cursos oficiales enseñan la interfaz gráfica; la IA trabaja por COM.
- Lo que falta es oficio de utillajes: la guía de Carr Lane, el «Jig and Fixture Design» de Applied Engineering y Joshi, que las fichas ya citan, más normas de seguridad de máquinas.
- Si alguien hace el curso, que sea Fak, para revisar mejor. Pero eso no es la causa.

## 5. El orden del dibujo

«Experiencia > criterio > herramientas > proceso de pensamiento» mezcla cuatro cosas de distinta clase: dos saberes, un medio y un método.

**Por qué no sirve para la IA** (opinión):
- Para un diseñador humano el orden tiene sentido: su experiencia vive en la cabeza y la aplica sin acordarse.
- La IA no acumula experiencia entre sesiones. Todo lo que sabe de Barack está en archivos, y el 20/10 mostró que tenerlo escrito no alcanza (sección 1).
- Lo que faltó fue justamente el proceso que dispara cada saber en su momento. Ponerlo último es poner último lo que falló.

**Lo que yo usaría** (opinión): un ciclo, construido en este orden.

1. **Proceso.** Fases con criterio de salida y revisión en cada una. Es el esqueleto: decide cuándo se usa cada cosa. Es lo único que la IA ejecuta siempre; lo demás lo ejecuta si el proceso lo llama.
2. **Experiencia materializada.** Biblioteca de piezas probadas, catálogo, y casos viejos con sus defectos. Se consulta en la fase de concepto. Para una IA, la experiencia no es una virtud: es un archivo que hay que abrir en el momento justo.
3. **Criterio.** Checklists cortos por fase. Cada ítem que se pueda pasa a propiedad del constructor o a control.
4. **Herramientas.** Rápidas y con presupuesto de tiempo, al servicio de la fase. Van cuarto porque el 20/10 la herramienta lenta solo amplificó un problema de método.
5. **Retorno.** Prueba física, auditor y marcas de Fak, que vuelven a alimentar el 2 y el 3.

## 6. Qué falta

| Práctica de un equipo con experiencia | Qué hay hoy (parcial) | Qué falta |
|---|---|---|
| **Revisión de diseño en puntos fijos** | G-E4 al final; `revisor-pedido` y auditor Opus, usados el 20/10; «una REVISIÓN por otro modelo» al terminar la propuesta (`preguntas…`) | Revisión al cierre de cada fase, con el checklist de esa fase |
| **Alternativas de concepto** | Lección 33 (barrer lo estático antes de un mecanismo) | Nada exige 2 o 3 conceptos, catálogo incluido, con una tabla de decisión antes de modelar |
| **Checklist por fase** | 8 grupos (al inicio) y gates (al final) | Concepto, mecanismo y fabricación sin lista. (opinión) ≤10 ítems cada una, el resto a referencia |
| **Biblioteca de piezas probadas** | `indice_dispositivos.py`, `make_screw_nut.py`, los tornillos M5 impresos (`DONDE_QUEDO.md`), `caja_tope_redondeado()` en un build | Un módulo de componentes de la casa, igual en build123d y CATIA: placa con chaflán de cama, tope redondeado, pata, inserto, perno, la palanca validada con su armado |
| **Catálogo antes que dibujo** | La pregunta ⊕ del 20/10 | Procedimiento, fuentes, STEP, licencia, protocolo de integración, GATE 1 con procedencia |
| **Ergonomía y seguridad** | `ficha-utillajes.md` E1-E7; `preguntas…` grupo 4 (ISO 13857, 13855, 13732-1) | Control de cantos convexos; control de atrapamiento a lo largo del recorrido (luces entre partes móviles que se cierran por debajo del tamaño de un dedo; ISO 13854 trata espacios mínimos, cifra a verificar en la norma); peso del útil (E4) calculado del modelo |
| **DFM / DfAM** | `ficha-fdm.md`, `contrasalidas.py`, `uniones.py`, `laminar_bambu.py` | Un chequeo de fase que corra solo: cara de cama, voladizos de más de 45°, soportes que estima el laminador, si entra en la cama |
| **Cálculo de tornillería** | `ficha-fdm.md` R1-R7 en texto | Largo de agarre: tornillo contra brida, placa, arandela y tuerca (hallazgo 4) |
| **Lenguaje de diseño de la casa** | Nada (salvo E7, la versión grabada) | Dos o tres radios y chaflanes estándar, tornillería normalizada, color por función. (opinión) «Profesional» es consistencia, no adorno |
| **Coherencia entre documento y modelo** | Lección 39 | Que la página se genere leyendo del JSON, siempre; el 20/10, `pasos.json` tenía números tipeados |
| **Presupuesto de tiempo** | «2 minutos» (§3bis) | Medido y avisado por herramienta |

## 7. Cómo debería aprender el sistema de un diseño al siguiente

1. **Toda marca tiene una salida con jerarquía fija.** Venga de Fak, del auditor o de la prueba física, se convierte en lo primero que se pueda de esta lista:
   1. propiedad del constructor (imposible hacerlo mal);
   2. control con par BIEN/MAL en la fase donde ocurre;
   3. ítem del checklist de esa fase.

   La lección narrativa va a un archivo de «por qué» que no se lee al diseñar. La semilla ya está: «Una corrección nueva se aplica a la CLASE … el redondeo es PROPIEDAD del constructor» (`utillajes-de-apriete.md`). Falta que la propiedad viva en la biblioteca y no en un build.

2. **Registro de marcas con métrica.** Cada corrección se anota con fase y clase (a, b o c).
   - Indicador semanal: marcas de Fak por diseño, y qué porcentaje encontró el sistema antes que él.
   - Hoy el único indicador es un examen escrito por otra IA (`preguntas…`, «26/30»). El que importa es cuántas veces Fak tuvo que decir «¿por qué te lo tuve que decir?».

3. **Calibrar al revisor como al GATE A.** El virolador del 20/10 entra a `evals/banco/cad/` con su lista de defectos conocidos:
   - palanca dibujada de cero;
   - cantos vivos;
   - armado en espejo;
   - tornillo corto;
   - números tipeados;
   - conjunto guardado sin la parte fija.

   El revisor de fase no se usa si no vuelve a encontrar los defectos de los casos viejos. Es «calibrar tiene que haber reproducido EXACTO lo publicado» (`SKILL.md` GATE A) aplicado al juicio, no a la geometría.

4. **El valor gemelo, también para los checklists.** Se le da al checklist de fase un diseño viejo con su defecto puesto y se exige que lo frene. Es la lección 28 aplicada al texto: si el checklist sigue verde con la falla puesta, el ítem está mal escrito.

5. **Revisión al cierre de cada fase, no solo G-E4.** Un agente que reciba el checklist de la fase y el estado del modelo, sin el razonamiento, con la pregunta de G-E4 adaptada: «sos el diseñador senior, ¿qué ves que esté mal antes de pasar de fase?».

6. **Poda con presupuesto.** (opinión) Un tope de lectura por fase, del orden de 2.000 palabras. Una regla que en varios diseños no frenó ni previno nada pasa a archivo, y cada regla nueva obliga a revisar si saca otra. Sin esto, cada tanda engorda los archivos y baja la probabilidad de que la regla correcta se lea en el momento justo.

7. **La primera pieza impresa como dato.** `ficha-utillajes.md` K5 ya pide que el resultado «vuelve al registro de versiones … el mismo día». Que use el mismo registro de marcas, con fase y clase, para que la prueba física también se convierta en constructor, control o checklist.
