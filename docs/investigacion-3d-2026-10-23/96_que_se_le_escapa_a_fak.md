## 1. Lo que se te escapa

**1. Cada falla se "arregla" escribiendo texto, y el texto no frena nada.**
- **Qué es:** cuando algo sale mal, la corrección queda escrita en un .md.
- **Por qué importa:** es la causa de fondo de que tengas que vigilar. Una regla escrita depende de que la IA la lea y se acuerde en el momento justo.
- **Cómo se resuelve:** una falla no se da por cerrada hasta que hay un control que se dispara (gate, chequeo, test) y un caso en el banco de regresión que la reproduce.
- **Evidencia:** ~170 de las ~210 reglas de la skill son texto que nada dispara. 3 de los 6 problemas del virolador tenían la regla escrita (anexo 00). En el caso 2, la ficha CATA.md ya decía «las notebooks no mandan mails» y aun así se ofreció. El punto 7 del plan es la segunda vez que marcás lo mismo (08/10 y 21/10).

**2. El sensor y la agenda del sistema sos vos.**
- **Qué es:** los casos los detectaste y los escribiste vos. Los pendientes están repartidos en al menos cinco lugares: memoria del plan, casos_viernes, orden de propuestas, borrador de auto-mejora y PEDIDOS. El prompt del 17 lo armaste a mano, con rutas, modelo y tandas.
- **Por qué importa:** no hay una cola única que el sistema lea solo. Por eso no sabés qué prompt dar.
- **Cómo se resuelve:** una bandeja única de pendientes que se alimente sola (opinión). Cada vez que corregís algo («te quise decir», «es raro que no sepas»), se anota como caso con tu frase. El prompt fijo lee esa bandeja.
- **Evidencia:** los tres casos arrancan con «Qué dijo Fak». El prompt del 17 trae instrucciones como «si la sesión pregunta en vez de hacer: contestale…».

**3. Las cosas se rompen en silencio.**
- **Qué es:**
  - Los mails no suben desde el 16/10. La PC principal lo dejó anotado en `_salud\DESKTOP-14JG95B.json` y nadie leyó ese archivo.
  - MEMORY.md está en 24,4 KB, en el límite: lo que pasa de ahí no se carga, así que el sistema puede estar olvidando decisiones sin avisar.
- **Por qué importa:** en el plan, el arreglo del índice está sexto, y tendría que ser lo primero.
- **Cómo se resuelve:** un chequeo al arrancar cada sesión que revise el `_salud` de todas las PC, el tamaño del índice y las fichas de PC, y ponga lo vencido en el primer renglón: primero aviso con vencimiento, después freno.
- **Evidencia:** caso 1; plan, punto 6; la ficha CATA.md dice «notebook de Calidad», o sea, está desactualizada.

**4. El plan pide «100 % automático», la evidencia dice que no, y tu rol no está escrito.**
- **Qué es:** el plan dice «no se le vuelven a preguntar», pero el orden de propuestas está lleno de preguntas para vos: «qué cierres firmás», «quién baja los archivos», «quién la carga», «cuántos casos se suman».
- **Por qué importa:** si no hay una lista de lo que decidís vos, cualquier cosa te puede caer encima.
- **Cómo se resuelve:** una lista cerrada «solo Fak»: reglas nuevas, cierres de fase, reglas de la empresa (ECR, firmas), OK de descargas y gasto por encima del tope. Todo lo demás lo decide el sistema y lo anota. Tus preguntas se juntan en una sola hoja.
- **Evidencia:** el informe dice «tu presencia en el lazo no es un defecto a eliminar sino un rol a ubicar». Ningún estudio muestra una IA que diseñe sola un mecanismo (CAD-bench «near zero», Hephaestus 0 de 400). El borrador dice: «lo único que no conviene automatizar es aprobar la regla nueva».

**5. Tus casos de la semana no están en el plan.**
- **Qué es:** los 7 puntos del plan son 3D y mejoras del propio sistema. Los mails, la notebook y el ECR no figuran.
- **Por qué importa:** son justo lo que te obliga a vigilar en el día a día, y los más fáciles de automatizar porque se pueden controlar por programa. Por ejemplo: que la carga al arb frene sin número de ECR/ECO, y que el cierre en CATA no pueda ofrecer «lo mando».
- **Cómo se resuelve:** que sean el primer ejemplo del punto 5 del plan («generalizar»), antes que el 3D.
- **Evidencia:** `_arbAltaLote.py` y `_arbSustituir.py` «no pasan por ningún freno». Lo que solo vos sabés del ECR (qué cuenta como procedimiento, quién firma) va a la hoja.

**6. Se implementa todo antes de medir.**
- **Qué es:** el plan dice «las 15, TODAS, en 36 h», y eso choca con «decidir con datos».
- **Por qué importa:** sin una medición de la skill actual, al final no hay forma de saber si el sistema mejoró o empeoró.
- **Cómo se resuelve:** primero P11 y la medición de la skill actual como línea de base. Cada propuesta entra con la misma regla que la auto-mejora: mejora el banco sin romper nada, o se descarta.
- **Evidencia:** el borrador dice «solo si el brazo 3 le gana al 2», «lo que está menos probado es que así mejoren las reglas» y «con un banco chico, la mejora no se distingue del azar».

**7. «Corregir hasta que salga» es la receta para que el sistema se engañe solo.**
- **Qué es:** los agentes engañan al corrector cuando pueden, y Opus no mejoró reintentando (32,7 → 31,4 %). El punto 4 del plan no menciona casos ocultos, huella del corrector ni caso canario.
- **Por qué importa:** además, la suite tiene pruebas que «fallan por tiempo y pasan solas». Un juez automático con tests que fallan al azar o frena todo, o le enseña al sistema a ignorar el rojo (opinión).
- **Cómo se resuelve:**
  - banco y corrector fuera del alcance del agente, con huella;
  - casos ocultos que se renuevan, y un canario;
  - las pruebas inestables, arregladas o apartadas antes de usar la suite como juez.
- **Evidencia:** borrador, riesgos 1, 2 y 4; plan, punto 1.

## 2. El prompt de los viernes

```
Viernes de mejora. Sesión común en C:\Dev\BarackMercosul. No te doy tareas: las juntás vos.
1) Salud: revisá _salud de cada PC, tamaño de MEMORY.md, fichas de PC, suite de tests y ramas sin fundir. Lo roto va primero.
2) Pendientes: leé la bandeja de pendientes. Si no existe, creala con las memorias project_viernes_*, los casos de la semana, los PEDIDOS abiertos y mis correcciones de los últimos 7 días. Ordená por impacto × frecuencia.
3) Antes de cambiar nada, medí cómo está hoy contra el banco. Si un pendiente no tiene caso que lo reproduzca, primero creás el caso.
4) Cada arreglo es un control que se dispara (gate, chequeo, test) más su caso de regresión. Texto solo no cierra nada.
5) Camino grande: worktree, tests, auditor Opus, revisor independiente. Entra solo lo que mejora el banco sin romper nada; lo demás se descarta y anotás por qué.
6) Nunca toques el corrector, el banco ni los tests para que algo pase.
7) Lo técnico lo decidís vos, con datos. A mí pedime SOLO lo de la lista «solo Fak» (reglas nuevas, cierres de fase, reglas de la empresa, descargas, gasto sobre el tope vigente): juntalo en una hoja y seguí con lo demás.
8) Si ves algo que no está en la bandeja y pesa más, decilo primero y sumalo.
9) Commit por tanda. Al cerrar: una página con el antes/después medido, lo descartado, lo que falló, la hoja de preguntas y lo que vuelve a la bandeja con su próximo paso.
```

Hoy no existen ni la bandeja, ni el chequeo de salud, ni la lista «solo Fak». El primer viernes el prompt los crea, y de ahí en adelante sirve sin cambios (opinión).

## 3. Lo que no tenés que hacer más

1. **Juntar y redactar los casos de falla:** se anotan solos cuando corregís algo.
2. **Escribir el prompt de cada viernes:** rutas, tandas, «si pregunta, contestale…». Queda el prompt fijo.
3. **Revisar si los mails suben, si el índice se llenó o si una ficha de PC está mal:** lo dice el arranque.
4. **Marcar dos veces lo mismo:** si pasa una segunda vez, es una falla del sistema y se convierte en control.
5. **Contestar preguntas técnicas sueltas en medio de la sesión** (qué propuesta va, cuántos casos, aviso o freno): eso lo decide la medición. A vos te llega una sola hoja con lo «solo Fak».

## 4. El riesgo más grande del plan del viernes

Son 36 h con 15 propuestas, sin línea de base, sin tope de gasto escrito y, si se repite el modo del 17, con permisos omitidos. El borrador ya avisa que el tope de USD 8 por corrida no alcanza.
El lunes podés tener muchos commits en verde y ninguna forma de saber si el sistema mejoró, empeoró o aprendió a pasar sus propios tests.
