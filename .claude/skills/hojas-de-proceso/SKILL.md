---
name: hojas-de-proceso
description: Hojas de proceso / hojas de operaciones de Barack (formulario I-IN-002.4-R01) en PPTX o Excel — que imagen manda, como se acomodan y como se prepara una pantalla de HMI para que se lea impresa. Trae la libreria `hojalib`, el gate que rechaza la hoja y su selftest.
---

# Una hoja de proceso se lee de pie, al lado de la maquina, impresa en A4

> **El que decide si una hoja sirve no es como se ve en el monitor: es como se lee en el papel.**
> El 03/09/2026 Fak miro la lamina 3 de la HOTMELT y pregunto: *"en la filmina 3 un celular se
> ve mucho mas grande que una hoja con parametros, ¿que clase de criterio estas aplicando a
> las hojas de proceso?"*. Tenia razon, y al medir aparecio algo peor que esa lamina:
> **ninguna de las 7 pantallas del deck se leia impresa** — entre 2,3 y 4,5 pt, contra 7 que
> es lo mas chico que Barack pone en estos documentos. Yo las habia dado por buenas
> mirandolas ampliadas en la pantalla.

Dos causas, las dos ciegas de la misma forma:

- el repartidor de imagenes **maximizaba superficie total** y no sabia cual imagen importaba;
- yo juzgaba la legibilidad **en el zoom equivocado**.

Ninguna se arregla con buena voluntad. Las dos se arreglan con un numero.

---

## 0. LOS GATES (bloqueantes, en este orden)

### GATE 0 — antes de escribir nada: ¿cuantos pasos tiene esta hoja, y entran?

**Un paso es UNA accion que alguien hace y que se ve en UNA foto.** Lo que no se puede
fotografiar no es un paso: una condicion va en la NOTA, un valor va en PARAMETROS.

- **De 2 a 4 pasos por hoja, con una foto cada uno.** Cuatro es el tope: en A4 con mas de
  cuatro fotos no se ve ninguna. Menos de dos no es una hoja, es una foto con epigrafe.
  La excepcion es `modo="rotulada"` (un panel, una pantalla): ahi la foto es una sola y
  entran hasta **6** items, porque partir el panel en dos hojas se ve peor que mostrarlo
  entero una vez.
- **La operacion que no entra se PARTE, no se comprime**: `SET UP INICIAL (HOJA 1 DE 2)`,
  `(HOJA 2 DE 2)`. **El N° de operacion no cambia** — lo manda el flujograma
  (`no-pfd-no-ho.md`). Sale solo del campo `hoja_de=(1, 2)`.
- Si al partir queda un paso suelto, se reparte: **3+2 antes que 4+1**.

Fak, 21/09/2026: *"en el flujograma lo que nos paso es que en algunos casos pusimos muy
pocos pasos, a veces muchisimos, esta medio confuso"*. Antes esto no estaba escrito y por
eso cada hoja salia con la cantidad de pasos que quedara. Ahora lo frena
`_gate_una_foto_por_paso()` del generador.

**La hoja es operativa, no un manual** (Fak, mismo dia): *"con las fotos se entienda
rapidamente de que va el paso, y solo haga falta leer para entender mas a fondo"*. La foto
cuenta el paso; el renglon lo precisa; los parametros van en la hoja, no aparte.

### GATE 0 bis — la transcripcion del video se lee ENTERA, siempre

Fak, 21/09/2026: *"siempre leer las transcripciones si o si, ¿entendiste?"*. Y antes:
*"si no sabes algo no lo asumas vos, lees las transcripciones de audio para entender lo que
pasa en vez de inventar"*.

El caso: escribi un paso de *"prender los servicios: refrigeracion y atemperador"* mirando
los fotogramas del IMG_0596. La transcripcion de ESE MISMO video dice lo contrario —
**"todo eso se maneja de alla, de la pantalla"**— y yo la tenia al lado sin leer. En la
misma hoja escribi *"mirar la presion de aire antes de pedir cualquier movimiento"*: eso no
lo dijo nadie, vi un panel de manometros en una foto y lo converti en un paso.

**Los fotogramas dicen QUE HAY. La transcripcion dice QUE PASA.** Un paso es lo segundo.

- **Cada paso declara su `fuentes`**: un video con su minuto, un documento, o quien lo dijo
  y cuando. Sin fuente, el paso no va. Lo frena `_gate_cada_paso_con_fuente()`.
- **Si la fuente es un video, tiene que existir su transcripcion.** Lo frena
  `_gate_transcripcion_leida()`; sacarla es una linea:
  `py -3 scripts/video/_infoDeVideos.py audio "<carpeta>" --solo 0869`.
- **Del audio de planta sirve lo que narra Facundo**, no lo que sale del traductor: es chino
  traducido por celular y el transcriptor inventa. Un numero sale de la PANTALLA.
- Y una charla con el tecnico **no es un procedimiento**: sirve para saber que preguntar.
  Si lo unico que hay es esa charla, la hoja dice QUE ES CADA COSA y la secuencia queda
  pendiente (`no-pfd-no-ho.md` §3: sin documento fuente va TBD).

### GATE 1 — antes de acomodar: ¿cual es la imagen PRINCIPAL de esta hoja?

Se contesta **por hoja y por escrito**, antes de tocar el layout: *la imagen que el paso
manda mirar o leer*. No la mas linda, no la que quedo mejor encuadrada.

Sin esta respuesta el reparto vuelve a ser geometrico, y el resultado ya se conoce: en 11 de
las 17 hojas de la HOTMELT las tres imagenes salieron **exactamente del mismo tamaño**.

En el spec de la maquina va como `principal=<indice>` y `leer=[<indices>]`.

### GATE 2 — antes de dibujar una pantalla: ¿a cuantos cm va a salir impresa?

```bash
py -3 .claude/skills/hojas-de-proceso/scripts/hojalib.py   # ver ancho_que_le_toca_cm
```

Lo contraintuitivo: **la imagen se acomoda por su ALTURA dentro del bloque**, asi que una
pantalla mas alta termina mas ANGOSTA impresa. Agrandar el dibujo la achica en el papel.

Del ancho salen los pixeles: `ancho_px <= cuerpo_px x ancho_cm / (7 x 0,0352778)`.
Si los campos no entran, **no se achica la letra: se sacan campos** — los que el paso no nombra.

### GATE 3 — antes de entregar: el chequeo, en verde

```bash
py -3 .claude/skills/hojas-de-proceso/scripts/hoja_proceso_check.py "<deck.pptx>" --spec <spec.py>
```

Sale con codigo 1 y no se entrega. `--jerarquia 20.2=0,20.4=0` sirve para chequear sin spec.

---

## 1. Los criterios, con su numero

| # | Criterio | Umbral | Por que ese numero |
|---|---|---|---|
| 1 | Una imagen **principal** por hoja | >= **45 %** de la superficie de foto de la hoja **y** >= **1,6x** la segunda | sobre la TINTA, no sobre el bloque: una foto vertical 9:16 a la altura completa ocupa 32 % y **no puede ocupar mas** |
| 2 | **Lo que hay que leer, se lee** | cuerpo impreso >= **7 pt** | es lo mas chico que Barack imprime en estas hojas (las referencias de EPP) |
| 3 | La principal no es una estampilla | >= **25 %** del bloque | piso absoluto, para que el criterio 1 no se cumpla achicando a las otras |
| 4 | **Lo ajeno no entra** | se recorta o se descarta | celulares de traductor, caras, gente de espaldas, piso vacio, cajas del fondo |
| 5 | **Cantidad** | **2 o 3** en jerarquia · **hasta 4** en secuencia, y con mas la hoja se PARTE | en A4, con 4 fotos de tamaños distintos no se ve ninguna; en secuencia van las 4 iguales en grilla 2x2, 34 cm² cada una |
| 6 | Las pantallas son la **foto real enderezada**, con el rotulo encima | — | ver §3 |

**Ojo con el criterio 1.** Primero lo escribi como *"45 % del bloque"* y **13 de 17 hojas lo
violaban sin tener nada malo**: era imposible de cumplir para cualquier foto vertical. Un
umbral se prueba contra la poblacion entera antes de declararlo, no contra el caso que lo
inspiro.

---

## 1 bis. Que hace que una foto EXPLIQUE un paso (criterios 7 a 13)

El test: **sin leer nada, ¿se contesta QUE OBJETO y QUE LE ESTA PASANDO?** Si no, la foto
decora. Medido sobre las laminas del 21/09/2026.

| # | Criterio | Como se ve que esta mal |
|---|---|---|
| 7 | **El sujeto del paso llena el cuadro** | En `r_botonera` los cinco comandos que la hoja señala vivian en **2,7 cm de alto** impresos (25 % del area). Recortada a la banda, los mismos botones pasan a 9,3 cm: **3,4x** |
| 8 | **Lo ajeno no es solo gente: es todo lo que ningun renglon nombra** | el cartel del proveedor ocupaba el **36 % del alto** de una foto del ciclo; pared y techo, entre 36 y 41 % |
| 9 | **Una persona entra si sus MANOS son el paso. Si entra su espalda, tapa el paso** | dos operarios de espaldas tapaban el **35 % del ancho** y el molde quedaba en **2,5 cm²**: no se distingue si sacan la pieza o un marco |
| 10 | **En una secuencia, la foto n+1 dice QUE CAMBIO — y va en el orden del reloj** | cuatro fotos del mismo video en los segundos 198 · 153 · 110 · 327: los pasos 1→2→3 iban **para atras**. Y dos con el mismo recorte y el mismo punto de vista no muestran ningun cambio |
| 11 | **El pie describe el instante que la foto MUESTRA**, no el que el paso quiere | el pie decia *"la pieza queda en la cavidad"* y la foto mostraba una mano ya sacandola |
| 12 | **El punto de vista es el del operario parado en el puesto** | una toma centrada de frente al molde es el punto de vista del que filmo, no el del que opera |
| 13 | **Si la accion pasa ADENTRO, la foto del paso es la PANTALLA** | una maquina cerrada es la misma foto para cualquier paso del ciclo |

Del 7 y del 14 (*dos chapas no se pisan*) falta el numero: **el umbral se corre antes contra
las 17 hojas de la HOTMELT**, que es la poblacion que hay. Con 4 fotos no se declara un
umbral — eso ya costo una vez (criterio 1, "45 % del bloque", reprobaba 13 de 17 hojas sanas).

Lo que **si** esta en codigo hoy: el orden del reloj (`_gate_secuencia_en_orden`), que cada
foto de secuencia lleve al menos una marca (aviso: poner la marca obliga a BUSCAR el objeto
en el cuadro, y ahi se ve solo que no esta), y que la foto llene su celda.

Lo que **no ve ningun script** y hay que mirar: si lo que esta en el cuadro es el objeto que
el paso nombra, si el pie describe el instante que se ve, si la persona agarra o tapa, y el
punto de vista.

## 2. Como se dimensiona una pantalla para que entre legible

1. cuantas imagenes va a tener la hoja (2 o 3), y cual es la principal;
2. `hojalib.ancho_que_le_toca_cm(ancho_px, alto_px, n)` -> los cm reales;
3. `ancho_px_max = cuerpo_px x cm / (7 x 0,0352778)`;
4. si no entran los campos, **se sacan los que el paso no nombra** y se declaran en el pie
   de la imagen ("la pantalla real trae ademas ...");
5. al guardar, la metrica va **adentro del PNG**:
   `hojalib.guardar_pantalla(im, dst, cuerpo_px=30, que_es="...")`.

`cuerpo_px` es **la tipografia mas chica que el operario tiene que leer** — la de los
rotulos, no la de los titulos ni la de los valores grandes. Declararla mas grande de lo que
es hace pasar el gate y no arregla nada.

El dato viaja en un chunk de texto del PNG y no en un archivo al lado porque el gate lee las
imagenes **ya embebidas en el pptx**, donde no hay nombre de archivo que seguir.

---

## 2 bis. La foto sale del VIDEO, no del fotograma de la biblioteca

`_INFO SACADA DE LOS VIDEOS` (hoy `.claude\fotogramas de cada video`) muestrea **un cuadro
cada 2 segundos, escalado a 1600**. Eso sirve para ENCONTRAR el momento; la foto de la hoja
se saca aparte, y por tres motivos medidos el 21/09/2026:

1. **Entre dos muestras hay 59 cuadros que nadie miro** y el foco entre vecinos se mueve un
   orden de magnitud. Se extrae la ventana entera a resolucion completa y se elige por foco.
2. **El metadato de rotacion del telefono puede estar mal**: el IMG_0585 declara
   `rotation=90`, ffmpeg la aplica, y el tablero igual sale acostado. La rotacion se MIRA.
3. **Una toma general sin recortar no explica un paso.** Desde un punto fijo, el portico
   arriba y el portico abajo se parecen. El recorte es lo que convierte una foto en una
   instruccion.

```bash
S=.claude/skills/hojas-de-proceso/scripts
py -3 $S/fotodevideo.py ubicar  --video V --cuadro <frame de la biblioteca>   # el segundo
py -3 $S/fotodevideo.py ventana --video V --seg 110 --radio 2 --plancha p.jpg # mirar y elegir
py -3 $S/fotodevideo.py sacar   --video V --seg 110 --crop 15,25,34,34 --out f.jpg --nota "..."
py -3 $S/fotodevideo.py leer    assets/*.jpg      # sale 1 si alguna no dice de donde salio
```

**La procedencia va ADENTRO del archivo** (EXIF / chunk PNG): video, segundo, rotacion,
recorte y nota. Un JPG suelto en una carpeta de assets sin eso es un huerfano — nadie puede
rehacerlo ni verificarlo. Y es lo que evita el defecto que tenia el set anterior: de 36
fotos, **7 eran el mismo archivo con otro nombre** (una foto del portico se llamaba
`30.9_b_cadenas_grua` y tambien `30.7_b_descenso_portico`).

**El recorte se pide en la relacion de la CELDA, que no es 16:9.** Con 4 fotos y pie, la
celda da **2,0:1** (7,86 x 3,89 cm); sin pie, 1,78:1. Una foto de otra relacion entra
contenida, queda mas chica que las otras y puede caer abajo de los 25 cm2 del gate —
paso el 21/09 con una foto de 1,60:1 que quedo en 24 cm2. El generador avisa cuando una
foto llena menos del 80 % de su celda.

## 2 ter. Rotular: el numero va en la foto, el texto va en la HOJA

`rotular.py` pone recuadro + numero sobre lo que hay que mirar. Dentro de una hoja se usa
**`--banda ninguna`**: el texto de cada numero ya esta en el bloque DESCRIPCION, y repetirlo
en una banda al costado lo pone dos veces y, al tamaño que le toca a la foto en A4, la copia
no se lee. La banda (`derecha` / `abajo`) es para una foto que viaja sola, en un mail o un PDF.

```bash
py -3 $S/rotular.py --foto f.jpg --out r.jpg --banda ninguna \
     --marca "8,50,25,28|Selector AUTOMATICO / MANUAL" --marca "52,48,9,27|Verde ARRANQUE"
```

- **La serigrafia en chino se cita, no se traduce sobre la maquina**: el rotulo dice
  *"Verde ARRANQUE DE CICLO (循环启动)"* porque eso es lo que el operario tiene delante.
  La fuente es Microsoft YaHei (latino + CJK); con Calibri los ideogramas salen como
  cuadraditos vacios y `sin_glifo()` corta antes de guardar.
- **El numero va montado sobre la ESQUINA del recuadro**, no adentro: adentro le tapa al
  control justo la serigrafia que el rotulo esta citando.
- La foto guarda la lista de rotulos adentro, y el generador la lee: **si la foto trae 5
  marcas, la hoja tiene que tener 5 pasos**. Si alguien saca una marca y no toca la hoja,
  el gate lo frena.

## 2 quater. Una marca es una POSICION, y una posicion se mide

Fak, 21/09/2026: *"le erraste con los cuadraditos, no estan bien puestos sobre los botones,
eso revisalo cuidadosamente... errores obvios"*, *"el skill deberia verificar bien esas
cosas, no podemos fallar en algo tan obvio"*. Y tenia razon: yo habia puesto las marcas
mirando un render, despues **cambie el recorte y volvi a estimar los porcentajes sin volver
a mirar**. Es el mismo error del 15/09 con el aire de una tarjeta: mirar no es medir.

```bash
py -3 $S/medir_marca.py --foto f.jpg --marcado prueba.jpg   # donde esta cada pulsador
py -3 $S/rotular.py --foto f.jpg --out r.jpg --zona 50,45,90,75 \
     --marca "color:verde|Verde ARRANQUE DE CICLO" --marca "color:rojo#1|Rojo PARO"
```

- **`color:verde` mide la caja**; nadie tipea la posicion, asi que no se puede poner mal.
  Colores: verde, rojo, azul, amarillo, y `oscuro` / `claro` para lo que no es de color
  (el contorno del molde sobre la grilla de resistencias). Si hay varias manchas del mismo
  color, **corta y las lista** en vez de elegir por su cuenta: se desempata con `rojo#1` o
  acotando con `--zona`.
- **La marca escrita a mano se chequea**: si la caja cae sobre una zona LISA (chapa, pared,
  panel vacio) `rotular.py` sale con error. Una marca corrida unos centimetros cae justo al
  lado del boton, se ve prolija en el codigo y mal en el papel. `--lisa-ok 2` para el caso
  en que rodear una zona lisa sea a proposito.
- **El orden de los numeros es el orden en que se escriben las marcas**, midan o no. El
  numero del rotulo ES el numero del paso.
- Y despues igual **se mira la foto rotulada a tamaño completo**, antes de meterla en la
  hoja. El control ubica, no aprueba.

## 2 quinquies. La NOTA es para el operario, o no va

Fak, 21/09/2026, mirando la nota de una hoja: *"esas notas son una mierda, no le aportan
nada util al operario, o sea cualquier cosa son"*. Lo que yo habia escrito ahi era mi
propia contabilidad: de que video sale la foto, a quien le pregunte que, que quedo pendiente
con el proveedor, como arme la hoja.

**Test de una nota: ¿esto le cambia algo al que esta parado al lado de la maquina?** Si no,
va a la bitacora o al PDF de pendientes, no a la hoja. Sirven: un limite, una advertencia,
un "no arranques si...", un "esto se hace entre dos". No sirven —y las frena el gate
`_gate_texto_para_el_operario()`— el numero de video, "pendiente de confirmar con X",
"filmado el ...", "lectura del ...", "lo agregamos nosotros", "BORRADOR". **`TBD` se puede
escribir, pero solo**: el por que va aparte (`no-pfd-no-ho.md` §5).

Lo mismo para los parametros: va el valor que rige (`Tiempo de vacio: 19 s`), no su
historia (`subido de 8 s el 10/09 porque...`).

## 2 sexies. La pantalla va en CASTELLANO, y el idioma no es del dia

Fak, 21/09/2026: *"hay que intentar que todas, dentro de lo posible, esten en español, no en
chino: cuando ya lo habiamos traducido me asegure de grabar todas las pantallas de frente"*.

Barridos los 5.335 fotogramas de la moldeadora: **ninguna pantalla existe solo en chino**.
Las 26 pantallas distintas tienen al menos una toma en castellano. Asi que si una hoja
muestra una pantalla en chino, es que no se busco bien.

**Y lo que cambia como se busca: el idioma NO es una propiedad del dia.** La barra de arriba
tiene las tres banderas (China / Reino Unido / Argentina) y se cambia en cualquier momento —
el 09/09 a las 08:50:22 la pantalla esta en chino y a las 08:50:27 ya esta en castellano; el
11/09 a las 11:29:40 en castellano y seis segundos despues en chino otra vez. Buscar "el dia
en que estaba traducido" no sirve: se mira cuadro por cuadro.

**Y el OCR no alcanza para encontrarlas.** En ese barrido, un fotograma con la pantalla en
castellano perfectamente legible dio CERO texto, ni agrandandolo al doble. Lo encontro el
barrido visual. El OCR ordena la busqueda; el que decide es el ojo.

## 3. La pantalla es la FOTO REAL enderezada, con el dato encima. Ni redibujada ni con IA

**Fak, 08/09/2026:** *"intenta poner la foto de la pantalla real y metele un edit y ponele encima
el dato que vos queres"* — despues de que yo entregara la pantalla de seguridad redibujada entera,
en castellano y prolija. El motivo: **el operario tiene adelante la pantalla en chino**. Un dibujo
en castellano que no se le parece no le sirve para encontrarla entre menus; la foto de la
pantalla que el ve, con el rotulo puesto encima, si.

Como se hace — los cuatro pasos, en orden:

1. **Elegir el fotograma** donde la pantalla se lee (`scripts/hotmelt/elegir_frame.py` ordena candidatos del
   mismo video por foco; el veredicto sale de MIRARLA).
2. **Enderezarla**: `Image.PERSPECTIVE` con los cuatro vertices del LCD. Una pantalla sacada
   de costado se rectifica; no se recorta y se deja en diagonal.
3. **Marcar sin tapar.** Lo que hay que mirar se resalta con banda semitransparente y un
   numero. **Ningun valor de la pantalla se cubre ni se retoca** — y el pie lo dice.
4. **El texto en castellano va AL COSTADO**, en banda blanca fuera del LCD, unido por el
   numero. Ahi entra a cuerpo legible sin robarle lugar a la pantalla.

Las alturas de las filas que se marcan se **miden sobre la imagen enderezada**, fila por
fila: la foto conserva distorsion y el rotulo y su casilla no quedan a la misma altura (en
la pantalla de seguridad de la HOTMELT se llevan 18 px). Con un paso fijo la banda le corta
el borde a la casilla del valor. Ejemplo completo: `scripts/hotmelt/pantalla_seguridad.py`.

**Sigue prohibido pasarla por un generador de imagenes.** El 03/09/2026 Fak propuso mejorarlas
con Gemini y borrarle la marca de agua: *"si los reinventa lo detectas y lo corregis poniendo
el texto correcto encima, pero va a quedar prolija"*. No se hace: un modelo generativo
**reinventa los digitos** —y un digito de temperatura equivocado en una hoja de planta es un
problema real—, y una marca de procedencia no se saca.

Lo que agregamos nosotros (una advertencia, una franja) va visiblemente separado y aclarado
en el pie: *"la franja es advertencia de esta hoja, no del HMI"*.

**Las pantallas redibujadas que ya estan en el deck de la HOTMELT** (`pantalla_hmi.py`,
`pantalla_fusor.py`, `pantalla_operacion.py`, `pantalla_parametros.py`,
`pantalla_limpieza.py`) son del criterio VIEJO y hay que rehacerlas con este.

---

## 4. Lo fijo del formulario I-IN-002.4-R01

Una hoja = una operacion. Bloques: cajetin · IMAGENES · DESCRIPCION DE LA OPERACION ·
CICLO DE CONTROL · ELEMENTOS DE SEGURIDAD · PLAN DE REACCION.

- **Resp.** solo `OP` / `OC` / `Insp.`  · **Registro** solo `Set up` o `-`, nunca "RC".
- Pasos: frases cortas, imperativas, una accion por renglon. Sin "BORRADOR" ni "pendiente".
- **Sin foto -> recuadro VACIO**, no una leyenda que diga que falta.
- Dato que no tengo -> **TBD** y avisar. Los pasos son instruccion de planta: sin documento
  fuente van TBD, no por analogia con otra pieza parecida.
- Los iconos de EPP se **extraen de una HO real** y se reusan; no se dibujan ni se buscan en
  internet. Y se identifican **abriendo el PNG**: el 03/09 el que yo llamaba "barbijo" era
  el mismo pictograma de anteojos con otro nombre de archivo.
- El EPP se deduce del **riesgo filmado** (superficie caliente, atrapamiento, corte, aire
  comprimido). Deducir EPP de un riesgo que se ve es correcto; inventar un dato de Barack, no.
- La numeracion la manda el **flujograma**, no yo. Ver `no-pfd-no-ho.md`.

---

## 5. Errores caros de esta tanda (no repetirlos)

1. **Juzgar la legibilidad en el zoom y no al tamaño impreso** (03/09/2026). Las 7 pantallas
   estaban a menos de la mitad del minimo y yo las habia mirado una por una. Lo que se mide
   es el cuerpo en cm sobre el papel. Gate 2.
2. **Declarar un umbral sin probarlo contra la poblacion** (03/09/2026). "45 % del bloque"
   reprobaba 13 de 17 hojas sanas. Un umbral se corre sobre todo el conjunto antes de fijarlo.
3. **Mezclar dos estados de la maquina en una hoja** (03/09/2026). La 20.4 tenia parametros
   del 26/08 y velocidades del 28/08. Una hoja se basa en **una** lectura; si hay dos fechas,
   se elige una y se dice cual.
4. **Comparar dos lecturas de distinto minuto y llamarlo contradiccion** (03/09/2026).
   Reporte dos campos de alarma en conflicto comparando un fotograma de las 11:04 con otro de
   las 12:33 del mismo dia — y arme una "prueba" encima. Antes de comparar, la hora de cada
   lectura al lado del valor. Memoria `dos_lecturas_del_mismo_dia_no_son_comparables`.
5. **Verificar el script en vez del archivo publicado** (03/09/2026). PowerPoint tenia el
   pptx abierto, el render salio de una version vieja y reporte 12 correcciones que no
   estaban. Se cierra PowerPoint, se regenera y se verifica **extrayendo el texto del archivo**.
6. **Dar por buena una foto por su nombre de archivo.** `h11_a_corte_diagonal.jpg` seguia
   llamandose asi despues de que el contenido se corrigiera a corte RECTO. El nombre no es el
   contenido: se abre.
7. **Un script que reordena imagenes no es idempotente.** Los indices apuntan al estado
   ANTERIOR; corriendolo dos veces apuntan a otra cosa. Cada hoja declara cuantas imagenes
   espera encontrar y aborta antes de escribir si no coinciden.

---

## 6. Enforcement

| Capa | Que | Donde |
|---|---|---|
| **Dura** | `hoja_proceso_check.py` sale con codigo 1 y la hoja no se entrega | `.claude/skills/hojas-de-proceso/scripts/hoja_proceso_check.py` |
| **Dura** | los umbrales viven **solo** en `hojalib.py`: el generador dibuja con los mismos numeros con los que el gate rechaza | `.claude/skills/hojas-de-proceso/scripts/hojalib.py` |
| **Regresion** | 25 casos, cada criterio en ROJO y en VERDE | `.claude/skills/hojas-de-proceso/scripts/hojalib_selftest.py` |
| **Dato** | la metrica de legibilidad viaja dentro del PNG, sobrevive al pptx | `hojalib.guardar_pantalla()` |
| **Dato** | de que video y que segundo salio cada foto, adentro del archivo | `fotodevideo.py leer` (sale 1 si alguna no lo dice) |
| **Dura** | una foto por paso · 2 a 4 pasos · las marcas de la foto = los pasos de la hoja | `_gate_una_foto_por_paso()` del generador |
| **Aviso** | una foto que llena menos del 80 % de su celda | el generador lo imprime al compilar |
| **Dura** | un rotulo con caracteres que la fuente no dibuja | `rotular.sin_glifo()` |
| **Dura** | una marca que cae sobre una zona lisa (al lado del boton, no encima) | `rotular.chequear_marcas()` |
| **Dura** | cocina interna en el texto de la hoja (Nº de video, pendientes, metodo) | `_gate_texto_para_el_operario()` del generador |
| **Medido** | donde esta cada pulsador, en vez de estimarlo | `medir_marca.py` / `--marca "color:verde|..."` |

```bash
py -3 .claude/skills/hojas-de-proceso/scripts/hojalib_selftest.py     # 25 casos
py -3 .claude/skills/hojas-de-proceso/scripts/fotodevideo.py leer <assets>/*.jpg  # procedencia
py -3 .claude/skills/hojas-de-proceso/scripts/hoja_proceso_check.py "<deck.pptx>" --spec <spec.py>
```

El **spec de cada maquina vive fuera del repo** (trae contraseñas de HMI y part numbers de
cliente). En el repo va solo lo generico: libreria, gate y selftest.

---

## 7. Antes de entregar

- [ ] `hojalib_selftest.py` en verde (25/25)
- [ ] `hoja_proceso_check.py` en verde sobre el deck
- [ ] **las laminas miradas una por una**, renderizadas — no el script, el archivo publicado
- [ ] las pantallas miradas **al ancho que van a tener impresas**, no ampliadas
- [ ] PowerPoint cerrado antes de generar, y el texto verificado sobre el archivo guardado
- [ ] si el archivo lo venia editando Fak: su texto **intacto**, verificado con diff
- [ ] `fotodevideo.py leer` en verde: **ninguna foto sin decir de que video salio**
- [ ] **ninguna foto repetida con dos nombres** (`md5sum *.jpg | sort | uniq -d` sobre el hash)
- [ ] cada hoja con 2 a 4 pasos, una foto por paso, y las partidas con su (HOJA n DE m)
- [ ] **cada foto rotulada, mirada a tamaño completo DESPUES del ultimo cambio de recorte**
- [ ] cada nota pasa el test: ¿le cambia algo al que esta al lado de la maquina?
- [ ] lo que falta filmar, en su lista aparte — **no se escribe por analogia**
- [ ] ningun `TBD` sin avisar, ninguna foto sin mirar, ningun numero sin fuente citada

---

Ver: `.claude/rules/no-pfd-no-ho.md` (cuando se hace una HO y quien numera) ·
`.claude/rules/git-deploy.md` (antes de decir listo) · `.claude/rules/core-prohibiciones.md` (§1, no
inventar) · skill `editar-video` (sacar material de video) · skill `leer-planos` (recortar
para que se lea) · memorias `pantalla_se_redibuja_no_se_mejora_con_ia`,
`dos_lecturas_del_mismo_dia_no_son_comparables`, `entregables_para_fak`.
