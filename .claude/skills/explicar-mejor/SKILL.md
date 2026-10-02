---
name: explicar-mejor
description: Cómo explicar algo para que se entienda en una sola lectura — texto corto en castellano técnico simplificado, un dibujo, una página o un video. Usar cuando la persona dice que no entendió ("no entiendo", "no entendí un carajo"), pide que se lo expliquen ("explicame mejor", "más fácil", "sintetizá", "mucho texto"), o se nota que no entendió (pregunta dos veces lo mismo, contesta otra cosa). No es para lo que sale a terceros (mail, PDF, PowerPoint, planilla): eso sigue con sus reglas.
---

# Explicar mejor

Fak cada vez hace menos trabajo a mano y revisa y decide cada vez más. Lo que le llega tiene que
entenderse en una sola lectura. En 38 de 257 sesiones escribió "no entiendo" o "no entendí", y la
respuesta habitual era la misma explicación con más detalle.

Origen: post de Andrej Karpathy del 01/10/2026 (lenguaje controlado → dibujo → página → video),
probado ese día con el caso de la espuma del IP Pad. Fak, 02/10/2026: *"aplicarlo permanente para
cuando alguien quiere y pide una mejor explicación o nota que no entiende"*.

## Cuándo se usa

- La persona dice que no entendió, o pide que se lo expliquen mejor, más fácil o más corto.
- Se nota que no entendió: pregunta dos veces lo mismo, o contesta otra cosa.
- **No** se usa para lo que sale a otra persona. Un mail, un PDF, un PowerPoint, una planilla o un
  documento del SGC siguen con sus reglas.

## La regla madre

**No se repite lo mismo más largo: se cambia la forma.** Si el texto no se entendió, más texto no
lo arregla. Se sube un escalón.

## Qué escalón va

| Lo que preguntó | Lo que va |
|---|---|
| Un dato, un sí o un no, "sintetizá" | Escalón 1: texto, de 1 a 4 renglones |
| Algo con dos o más partes que se relacionan: un proceso, una comparación, un "debería pasar / pasa" | Escalón 2: texto corto y UN dibujo |
| Algo con muchas partes para recorrer: el estado de un proyecto, el resultado de una revisión, muchos renglones de antes y después | Escalón 3: texto corto y una página |
| Algo para enseñarle a otro, o un proceso que pasa en el tiempo | Escalón 4: video con voz. Solo si lo piden; se propone en un renglón |

**Dibujo o página, no los dos.** Si va la página, el dibujo va adentro de la página. La prueba del
01/10 mandó las dos cosas y era lo mismo dos veces.

## Escalón 1 — texto: castellano técnico simplificado

La base es ASD-STE100, el inglés controlado de los manuales de mantenimiento de aviones, y su par en
castellano (Español Técnico Simplificado). Van sus reglas de escritura; en lugar de su diccionario
cerrado van las palabras de la persona.

1. La primera oración contesta lo que preguntó.
2. Una idea por oración. Hasta 20 palabras si es una instrucción; hasta 25 si describe.
3. Una instrucción por oración, con el verbo adelante: "Abrí", "Cargá", "Mirá".
4. Se dice quién hace qué: "Carlos pidió el código", no "el código fue pedido".
5. Una palabra para cada cosa. Si la primera vez dije "espuma", después no digo "material" ni "insumo".
6. Verbos simples: pasó, pasa, va a pasar. Sin "habría", sin "estaría siendo".
7. Tres o más cosas parecidas van en lista, no en un párrafo.
8. En el texto no van códigos, números de documento ni siglas que la persona no usa. Van plegados
   en la página, o se dan si los pide.
9. Lo que no se sabe se dice una sola vez y sin vueltas: "No se sabe quién lo decidió".
10. Cada número va con su unidad. Si puede haber cambiado, va con su fecha.
11. Sin relleno: nada de "cabe destacar", "es importante mencionar", "en resumen".

El orden de una explicación: **qué debería pasar, qué pasa, qué falta saber**. Si hace falta una
decisión, va una sola pregunta al final, que se pueda contestar con una palabra.

Si lo que no entiende es por qué hice o no hice algo, se contesta eso en un renglón y se sigue.

## Escalón 2 — un dibujo

- Un dibujo, una idea. Hasta 7 cajas. Cada caja: un título de hasta 5 palabras.
- Los números que importan van en las cajas. **Si un número importante no entra, el dibujo no
  alcanza: va la página.** No se deja el dato solo en el texto.
- Tres moldes alcanzan para casi todo:
  - **"Debería / pasa / falta saber"**: tres columnas.
  - **Pasos en orden**: cajas con flechas, en una sola dirección.
  - **Dos cosas lado a lado**: para comparar.
- El color significa siempre lo mismo y lleva su leyenda: verde = cierra o está verificado, rojo = no
  cierra, ámbar = falta saber, gris = neutro.
- Lo que no está verificado se dibuja distinto (borde punteado) y dice "falta saber".
- Va en el chat con la herramienta de dibujo (`show_widget`; antes de la primera vez se le pide su
  guía con `read_me`, módulo `diagram`). Si esa herramienta no está, va la página.
- Antes de mandarlo: ¿se entiende sin leer el texto de al lado? Si no, sobra una caja o falta una flecha.

## Escalón 3 — una página

- Un solo archivo `.html`, sin nada que se baje de internet: tiene que abrir sin conexión.
- Arriba, la respuesta en una oración grande. Después el dibujo. Después las partes.
- Cada parte tiene plegado su "de dónde sale": el documento, la fecha y el código. Ahí sí van los
  códigos. La persona lo abre solo si lo necesita.
- Lo interactivo va cuando ayuda a entender: plegar, filtrar, pasar el mouse, mover un número y ver
  qué cambia. Animación de adorno, no.
- **Es descartable.** Se guarda en `exports/explicaciones/` (fuera de git). No va a la biblioteca de
  Ingeniería, ni al servidor, ni a ninguna nube. Si Fak la quiere para mostrar, se pasa al formato de
  la casa (PDF o PowerPoint).
- Se muestra en el panel (`SendUserFile` con `display: render`). Si no se puede, la ruta va en la
  primera línea.
- Antes de mandarla se abre y se mira entera, en claro y en oscuro, con los plegados abiertos y cerrados.

## Escalón 4 — video con voz

Solo a pedido. Lo que ya hay: la voz (`.venv-audio`, Piper `es_AR-daniela-high`, la que eligió Fak;
lleva crédito al final por su licencia) y el armador `tools/claude-area/video/armar_video.py`, que
arma el video desde un `escenas.json`. El guion se escribe con las reglas del escalón 1 y las láminas
son los dibujos del escalón 2. Al 02/10/2026 este escalón no se probó todavía para una explicación.

## Lo que no cambia

- **Nada inventado.** Cada dato del texto, del dibujo y de la página está en una fuente. Lo que falta
  dice "falta saber" (`core-prohibiciones.md` §1).
- Las palabras son las de la planta (memoria `feedback_lenguaje_del_entregable_palabras_de_fak`).
- No se cuenta cómo se llegó al dato, salvo que lo pregunten.
- Si Fak pregunta "qué es esto / por qué", se explica y se para: no se arregla nada en paralelo
  (memoria `feedback_si_pide_que_le_explique_se_explica_y_se_para`).

## Control antes de mandar

1. ¿La primera oración contesta la pregunta?
2. ¿Alguna oración pasa de 25 palabras? Se parte en dos.
3. ¿Hay dos palabras distintas para la misma cosa? Queda una.
4. ¿Quedó un código o una sigla en el texto? Va al plegado.
5. ¿El dibujo se entiende solo?
6. ¿Cada número está en la fuente, con su unidad?

## Cómo se dispara solo

El hook `explicar-prompt.sh` (UserPromptSubmit, no bloquea) lee cada mensaje de Fak. Si dice que no
entendió o pide que se lo expliquen, avisa que hay que cargar este skill. Si pide corto, avisa que la
respuesta va en 1 a 4 renglones. Las palabras y sus errores de tipeo están en
`scripts/_lib/explicarCanon.data.json`; la lógica, en `scripts/_lib/explicarGuard.mjs`. Una palabra
nueva se agrega al canon y se vuelve a medir contra sus mensajes reales
(`node scripts/_lib/explicarGuard.mjs --medir <mensajes.jsonl> --muestra`). Medido el 02/10/2026:
salta en 154 de 1.592 mensajes. Tests: `__tests__/scripts/explicarGuard.test.mjs`.

Lo que el hook no ve es cuando se nota que no entendió sin que lo diga: eso lo tengo que ver yo.

## Fuentes

- Post de Andrej Karpathy, 01/10/2026: `https://x.com/karpathy/status/2105819303471976479`
- ASD-STE100, Simplified Technical English: `https://asd-ste100.org/about_STE.html`
- Español Técnico Simplificado (tesis de la Universidad de Bolonia):
  `https://amsdottorato.unibo.it/id/eprint/6681/1/Tesi_Gobbi_ETS.pdf`
- Lo que Fak ya corrigió sobre cómo le explico: memorias `feedback_no_hacer_informes`,
  `feedback_entregables_para_fak`, `feedback_mail_de_una_tarea_va_con_la_info_procesada`.
