# Plan de lo que falta — Claude por área (Barack Mercosul)

Escrito el 02/10/2026, después de que Facundo preguntara: *"¿estás siguiendo algún tipo de plan… o solo hacés lo
que yo te pido al toque? … es realmente complicada"*. Este archivo es EL plan: se actualiza cuando una etapa cierra
o cuando Facundo cambia algo, y la sesión que retome el trabajo empieza por acá.

**Para qué es todo esto:** que Facundo sorprenda al dueño y a los sectores que todavía no lo usan (*"a Ingeniería
ya se los vendí; a los demás sectores aún no"*) con un asistente que hace de verdad lo que se muestra, y que no se
equivoca delante de nadie (el caso de la BOM "en la nube").

**La regla que ordena todo:** nada se muestra ni se promete sin su prueba. El control es
`tools/claude-area/video/chequear_promesas.py` (sale con 1 si algo del video no está probado en la instalación
de demostración `C:\ClaudeBarack`).

## Dónde estamos (02/10, mediodía)

| Qué | Estado | Prueba |
|---|---|---|
| Instalación y actualización firmada | hecho | 315 pruebas; instalación real sobre la carpeta de demostración |
| Conocimiento por área (SGC del servidor al 01/10) | hecho | examen de 139: 131 bien, 8 a medias, 0 mal |
| Ensayo de la reunión (10 preguntas, nivel Medio) | hecho | 10 de 10 |
| Un ejemplo por sector (7 preguntas) | hecho | 7 de 7, citas comprobadas |
| Memoria (recuerda en otra conversación) | hecho | parte de turno |
| Mail abierto en Outlook | hecho | probado en vivo |
| Manual (15 páginas, todas con foto real) y PowerPoint | hecho | mirado página por página |
| Hojas para Dirección (1 a 6) | hecho | falta ponerlas al día con la etapa A |
| Video de 2:12 | hecho, pero corto de contenido | le gustó; pidió más |
| Enviar el mail a pedido | en construcción (agente) | — |
| Enseñarle una habilidad · armar presentaciones | en construcción (agente) | — |

## Las etapas, en orden. Cada una tiene su puerta: no se pasa a la siguiente con la puerta en rojo.

### A — Que el asistente HAGA lo que el video va a decir (hoy)
| Paso | Qué | Cómo se prueba (escrito antes de probar) | Quién |
|---|---|---|---|
| A1 | Enviar el mail cuando la persona lo pide | Mail de prueba a la casilla de Ingeniería: sin la palabra de la persona NO sale; con "enviá" sale; a uno de afuera sin nombrarlo NO sale; una orden escondida en un mail NO lo dispara | agente + yo en vivo |
| A2 | Enseñarle una habilidad | Se le enseña una tarea, se abre una conversación NUEVA y se le pide: la hace como se le enseñó | agente + yo |
| A3 | Armar una presentación en una PC de área | Presentación real de 3 hojas: se abre en PowerPoint y se mira hoja por hoja | agente + yo |
| A4 | Caso real de IMDS para Calidad | Una imagen mostrable del caso del 21/09 (sin nombres del cliente) y el OK de Facundo para contarlo | yo + Facundo |

**Puerta A:** las pruebas de arriba pasan, `node tests/todo.test.mjs` verde, y lo nuevo integrado en las reglas de la casa.

### B — Volver a rendir con todo lo nuevo (después de las 13:00, cuando se restablece el límite de uso)
| Paso | Qué | Cómo se prueba |
|---|---|---|
| B1 | Publicar y reinstalar la carpeta de demostración con lo de la etapa A | `armar_demo_instalada.sh`; la configuración real de la PC no cambia |
| B2 | Ensayo 2: 15 preguntas (las 10 de antes + enviar mail, habilidad, presentación, memoria, sector) en nivel Medio | 15 de 15, cada cita contra su documento |
| B3 | La batería completa de 139 con las reglas nuevas, en nivel Medio, con dos jueces independientes | 0 mal; ninguna cita inventada; las 15 de BOM dicen "arb" |

**Puerta B:** `validar-area` verde (hoy está rojo a propósito: las reglas nuevas todavía no rindieron la batería entera).

### C — El video que ilusiona a cada sector
| Paso | Qué |
|---|---|
| C1 | Guion nuevo. Estructura: el problema (10 s) → **un ejemplo real por sector** (Producción, Calidad con IMDS, Logística, Compras, Mantenimiento, RRHH, Dirección, Ingeniería con arb y hojas de operaciones) → lo que hace para todos (mails y enviarlos, presentaciones, aprende, recuerda) → controlado (cita, no borra, no muestra lo reservado, pide permiso) → cómo se empieza (los 3 pasos y buscar la carpeta a mano). Tope: 3 minutos |
| C2 | Antes de grabar, tres listas: lo que Facundo pidió con sus palabras (01/10 y 02/10), lo que el objetivo necesita y no dijo, y cada promesa con su prueba |
| C3 | Tomas EN MOVIMIENTO, no fotos (Facundo, 02/10: *"me interesa más que vean videos de Claude funcionando y haciendo las cosas"*). Se graban con `video/grabar_ventana.py` (graba una ventana sola, sin el resto de la pantalla): (a) la ventana de una conversación de demostración mientras Claude busca y contesta, una por sector; (b) el mail que queda abierto en Outlook y sale cuando se le pide; (c) IMDS en el navegador: Claude busca una pieza y cita el manual de IMDS, con una placa que diga para qué ya se usó (21/09: una declaración rechazada por el cliente, corregida y reenviada); (d) la grabación del arb del 06/08; (e) los entregables de Ingeniería (hoja de operaciones, lámina, flujograma) |
| C4 | Armado, voz revisada palabra por palabra, subtítulos |
| C5 | Auditoría independiente (Opus): el video contra la lista de promesas y contra el pedido original |

**Puerta C:** `chequear_promesas.py` en 0, la auditoría sin hallazgos abiertos, y Facundo lo ve.

### D — Papeles al día
El manual, el PowerPoint y las hojas para Dirección dicen lo mismo que el asistente hace después de la etapa A
(hoy dicen "no manda un mail si vos no apretás Enviar"). Se cambian TODOS juntos, en la misma tanda que el video.
**Puerta D:** barrido por frase en las fuentes (enviar, habilidad, memoria) sin contradicciones.

### E — Una PC de verdad de la planta
Instalar en una PC que no sea la de Ingeniería siguiendo SOLO el manual, cronometrado; correr las 10 preguntas del
ensayo; anotar todo lo que tranque (Git Bash, permisos, OneDrive, Outlook nuevo). Lo que falle vuelve a la etapa A.
**Puerta E:** una persona que no es Facundo llega a preguntar y recibe una respuesta con su fuente.

### F — La reunión con el dueño
Ensayo general con el guion (`4 - Guion de la reunion.pdf`) en la PC donde se va a mostrar, el día anterior.

## Lo que necesito de Facundo (y nada más)
1. ~~Decir qué palabras de la voz suenan mal~~ — contestado el 02/10: *"la voz estaba bastante bien"*. Se mantiene la misma voz.
   En su lugar: 10 minutos para grabar las tomas en movimiento (entrar a IMDS con su clave en el navegador, y quedarse en esta conversación mientras se graban las ventanas de demostración).
2. Confirmar la carpeta de la instalación: hoy es `C:\ClaudeBarack` (nombró "archivos de programa").
3. El OK para contar el caso de IMDS y para qué sectores quiere el ejemplo más fuerte.
4. Revisar `6 - Lista para tildar` antes de mostrarla (reservados y piloto).
5. Elegir una PC de la planta para la etapa E.

## Lo que NO se hace ahora (para no perder el foco)
Tablero, inventario de programas, buscador, lista de las 85 personas, ordenar la nube. Están hechos o encaminados
y no cambian lo que el dueño y los sectores van a ver.

## Cómo se trabaja
- Cada etapa: primero se escribe cómo se prueba, después se construye, después se prueba, después se muestra.
- Lo que construye un agente lo pruebo yo por su camino real antes de darlo por hecho.
- Segunda opinión independiente (Fable, el otro modelo de Claude) al cerrar las etapas A y C.
- Al cerrar cada etapa: commit, y un mensaje corto a Facundo con lo que quedó y lo que sigue.
