# Preguntas antes de diseñar (criterio de diseñador, no de herramienta)

Fak, 19/10/2026: *"no podés hacer BOMs sin conocer de diseños de tizadas, cálculos de consumos"* — el oficio va antes
de la herramienta (`docs/IDEA_CONOCIMIENTO_PREVIO_A_LA_HERRAMIENTA_2026-10-19.md`). Y el mismo día, sobre un carro de
tubo cuyas patas tocaban el marco por una arista: *"¿por qué te lo tuve que decir? eso debés preguntártelo vos"*.

**Se contestan POR ESCRITO, en el chat o en el pliego, antes del primer croquis.** Lo que no se sabe va TBD y se dice;
no se inventa (`core-prohibiciones` §1).

## Las 13 obligatorias (cada una ya costó un error real en la casa)

1. **¿La pieza es rígida o flexible?** Rígida: 3-2-1, nada redundante. Flexible (tapizado, termoformado, chapa fina):
   N-2-1, más apoyos (ficha-utillajes U2). Va primera porque cambia todo lo demás.
2. **La secuencia en una línea:** quién apoya qué sobre qué, calor, presión, tiempo, qué hace la mano (GATE 1 p. 5).
3. **Qué fuerza actúa en CADA etapa y qué pieza la resuelve.** La etapa muda es la que nadie pensó («mientras se
   rocía, se vuela la tela»: GATE P).
4. **¿Qué mandó el que pide (video, plano, foto)?** Es el pliego; se mira antes (el video de Eissmann, dos vueltas sin usar).
5. **¿Hay algo andando en planta que haga algo parecido?** (`indice_dispositivos.py`; «no entiendo por qué no lo hacemos»).
6. **¿Dónde exactamente?** La zona se confirma con Fak sobre un render antes de medir (GATE 0).
7. **¿De dónde sale la elasticidad?** Si la pieza trae material blando, ése es el elástico y el utillaje va rígido.
   En la casa: *"PLA, sin gomas ni espumitas"* (virolador, 12/08).
8. **¿Cómo ENTRA la pieza y queda centrada aunque la apoyen torcida, y cómo SALE sin herramienta?**
9. **Cada unión: ¿dónde apoya, dónde se suelda o atornilla, y con cuánta área?** «0 de solape» no es «unido»: se
   mide con `scripts/uniones.py` en toda estructura (las patas del carro del 19/10 tocaban por una arista).
10. **¿En qué dirección va la carga respecto de las capas?** Paralela a las capas, nunca tirando de ellas (el
    tornillo de 7 mm impreso parado se partió bajo la cabeza, 14/10).
11. **¿Qué máquina lo hace y con qué material?** Desde el 13/10 la Bambu A2L con PLA Lite; un número de la Elegoo no
    se traslada sin decirlo. Si es otro taller, con qué matrices o herramientas trabaja.
12. **¿Toca algo blando, pintado o clase A?** Bordes redondeados, área, y la simulación apoyada y apretada (GATE A).
13. **¿Cuál es el criterio de aceptación, escrito ANTES?** (cuánto, medido cómo, con qué pieza).

Después de estas, y antes de cerrar: **el tamaño del conjunto contra lo que hace** (GATE 4: un dispositivo que
aprieta 6 N no puede pesar medio kilo).

## La lista completa (60 preguntas, auditada el 19/10 contra los cuatro informes: 0 números inventados)

Las referencias (f1 a f4) son los informes de criterio del 19/10/2026 en `.sgc-cache/criterio-disenador-2026-10-19/`
(locales, fuera del repo); cada uno trae la fuente original con su página.

*A. Función, proceso y uso*
1. ¿Qué función cumple y en qué operación, **hoy** en planta? ¿La cota que gobierna sale del proceso real o del dibujo? (f2 Q1; f4 A7: el pin Ø2,8 salía del Ø3 del DXF, pero en planta el agujero se hace con sacabocado Ø2.)
2. ¿Cuál es la secuencia, en una línea? Quién apoya qué sobre qué, calor, presión, tiempo, qué hace la mano. (f4 A2 · `cad-3d` GATE 1 p. 5; f1 §2.2; f3 §1.1)
3. ¿Qué fuerza actúa en cada etapa y qué pieza del dispositivo la resuelve? Toda etapa tiene al menos una; la etapa muda es la que nadie pensó. (f4 A1; f1 §2.3 · Carr Lane)
4. ¿Qué mandó el que pide (video, plano, foto)? Eso es el pliego, y lo que hay que cazar es la omisión. (f4 A3: el video de Eissmann estuvo sin usar dos vueltas.)
5. ¿Ya hay algo andando en planta que haga algo parecido? Un índice incompleto se lee igual que «no hay nada». (f4 A4; f1 §2.4)
6. ¿Dónde exactamente? La zona se confirma antes de medir. (f4 A5)
7. ¿En qué estado llega la pieza a esta operación: qué caras existen y cuáles no? (f1 §2.1 · Joshi p. 205)
8. ¿Cómo se usa: cuántas veces por turno, quién lo mueve, vive parado? (f4 A13)
9. ¿Qué cambia entre variantes y cuánto dura el programa? ¿Ajustable, recambiable o uno por variante? (f1 §2.5 · Joshi p. 111; IATF 8.5.1.6 e). La duración es dato del cliente: TBD.
10. ¿El pedido es «lo mismo pero simétrico, doble o más grande»? Entonces se rehace la cuenta que gobierna antes de tocar el modelo. (f4 A10)

*B. La pieza y sus referencias*

11. ¿Cuál es el datum del plano, de qué cara salen las cotas que gobiernan y cuál es la superficie más precisa? (f1 §2.6 · Ub1, Ub2)
12. ¿Es rígida o flexible (tapizado, termoformado, chapa fina)? ¿Qué dice el plano sobre estado libre y restricción? **Se contesta PRIMERO aunque figure doceava** (f1 §5.2 pide que sea la primera: de ella dependen las reglas 5 y 8). (f1 §2.7, §5.2; Fl5 es SECUNDARIA)
13. ¿Cuánto varía de pieza a pieza y de lote a lote? Eso define tope fijo, regulable, excéntrico o nido. (f1 Ub9)
14. ¿El cliente tiene puntos de referencia definidos (RPS)? SIN FUENTE verificada: confirmar con el cliente. (f1 §2.9)
15. ¿Hay una cara que se mecaniza, corta o recubre después? Esa no sirve de ubicador. (f1 §2.10)
16. ¿Con qué pieza acopla y dónde está su 3D? Suele estar entregado. (f4 A6)
17. ¿El STEP del cliente es la pieza terminada, con tapizado también sobre las caras de apoyo? (f4 B5)

*C. Cargas (f3 §1, salvo indicación)*

18. ¿Qué fuerza pide el proceso, para arrancar y para mantener? ¿Se midió con dinamómetro? (Liberty Mutual). Si no se midió: medir en planta, TBD.
19. ¿Quién lo usa? El más débil y el más fuerte, con o sin guantes, con una o dos manos.
20. ¿Se puede usar sin querer como agarre, apoyo, escalón o palanca? En todo lo que está a la altura de la mano se supone que sí (NASA-STD-3001 p. 362).
21. ¿Hay golpes, cargas de golpe o caídas? ¿Desde qué altura? **SIN FUENTE** para golpes y caídas de banco: se pregunta y se escribe el número que dé Fak.
22. ¿Cuánto tiempo queda cargado: segundos, un turno, semanas?
23. ¿A qué temperatura está el punto de apoyo? (ficha-fdm T1: TBD)
24. ¿Se transporta o se apila?
25. ¿Hay vibración? ¿Cuál es la frecuencia propia del dispositivo? (KSC p. 4 y 7)
26. ¿Va apretado con bulón? ¿Con qué torque y qué lubricación?
27. ¿Cuántos ciclos en su vida?
28. ¿Qué pasa si falla: lastima a una persona, rompe la pieza del cliente, para la línea?
29. ¿Qué se sabe del material: hoja del proveedor, probeta propia o nada?
30. ¿Qué modo de falla manda? Se revisan los seis de KSC (paso 4).
31. ¿Cuál es el criterio de aceptación, escrito antes? (también f2 Q11; f4 E8)

*D. Sujeción*

32. **¿De dónde sale la elasticidad?** Es la «pregunta cero» de la casa (f4 B1, ver paso 2).
33. ¿Dónde puede apoyar el apriete sin deformar? ¿Qué zonas no se pueden marcar (clase A, tapizado)? (f1 §2.11 · Joshi p. 42-43; Carr Lane)
34. ¿Aprieta la mano o un motor? ¿Cuántas veces por turno? (f1 Su6)
35. ¿Cuánta variación de la pieza tiene que absorber el apriete? (f1 Su7)
36. ¿El apriete estorba la carga, la descarga o la herramienta? (f1 Su4)

*E. Operario y puesto (f1 §2 D, salvo indicación)*

37. ¿Trabaja de pie o sentado? ¿Cuántas horas por día y cuántos ciclos por hora? (Res. 295/2003, págs. 5-6; HSE p. 8)
38. ¿Cuánto pesan la pieza y el dispositivo? ¿A qué altura toma y deja, a qué distancia del cuerpo? ¿Hay torsión del tronco? ¿Hay agarre? (NIOSH; HSE p. 7-8; Res. 295)
39. ¿Se puede evitar que el operario mueva la carga? (HSE p. 3-4)
40. ¿La mano y la vista llegan al apoyo y al apriete? ¿Se ve la pieza bien asentada? (AE p. 1 y 5; Joshi p. 43)
41. ¿Qué parte del ciclo se va en cargar, apretar y soltar? El ciclo disponible es dato de Barack: TBD. (Joshi p. 43; AE p. 8)
42. ¿A qué altura llega cómodo el operario y **de qué fuente** sale esa altura? (f4 C1)
43. ¿Cómo entra la pieza y queda centrada aunque la apoyen torcida? ¿Cómo se saca sin tocar la zona engomada y sin herramienta? (f4 C2)

*F. Error y calidad (f1 §2 E)*

44. ¿Qué error de carga es posible (girada, espejada, la pieza vecina, falta un componente)? ¿Cuál llegaría al cliente? ¿Qué dice el AMFE? (Joshi p. 15-16; IATF 10.2.4; `I-AC-032`)
45. ¿Cuánto de la tolerancia de la pieza consume el dispositivo? Si es calibre de control: ¿con qué estudio de repetibilidad y reproducibilidad se verifica y con qué pieza patrón? (Carr Lane; `I-AC-009`)
46. ¿El calibre es del cliente? Entonces se valida al recibirlo y tras cada cambio. (`I-AC-022` §5.2)

*G. Fabricación (f2 §2)*

47. ¿Cuántas piezas? ¿Una vez o repetidas? (Q2 · MIT lec12)
48. ¿Quién la fabrica (la A2L, un taller de chapa, un mecanizado) y **con qué matrices o herramientas** trabaja? (Q3 · Protolabs, Xometry)
49. ¿En qué dirección va la carga respecto de las capas (FDM) o de la fibra (chapa)? (Q4)
50. ¿Cuántas posiciones en máquina hacen falta? ¿Se puede en una sola? (Q5 · Protolabs)
51. ¿Qué tolerancia manda de verdad y qué pasa si se afloja? (Q6)
52. Por cada pieza, las tres preguntas de Boothroyd-Dewhurst, contestadas desde un rediseño (Q7, paso 2).
53. ¿Cómo se monta y cómo se repara? ¿Entra desde un solo lado y a la vista? (Q8 · MIT)
54. ¿Toca algo blando, pintado o clase A? ¿Qué espesor medido tiene, cuánto tiempo queda cargado y a qué temperatura? (Q9)
55. ¿Qué cota depende de otra y quién la deriva? (Q10 · `cad-3d` GATE 4)
56. ¿Qué proceso es el más barato que cumple la función? Es criterio del redactor: **no hay guía de selección de proceso** (Q12; ver huecos).

*H. Vida, mantenimiento y costo (f1 §2 F)*

57. ¿Qué se desgasta, qué se recambia, quién lo repara y cada cuánto se verifica? (IATF 8.5.1.5 y 8.5.1.6; Joshi p. 170-171)
58. ¿De quién es? ¿Cómo se identifica y en qué estado está (producción, reparación, destruir)? (IATF 8.5.1.6 g)
59. ¿Cuánto cuesta, cuánto ahorra y a qué volumen se paga? (Joshi p. 179-183). La cuenta del punto de equilibrio es **SIN FUENTE** (f1 Co4).
60. ¿Qué cantos, atrapamientos o peso de manipulación tiene el propio dispositivo? (AE p. 5)
