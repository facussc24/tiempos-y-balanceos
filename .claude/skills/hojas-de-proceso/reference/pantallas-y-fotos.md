# hojas-de-proceso / reference — §2 a §2 sexies y §3 — dimensionar una pantalla, sacar la foto del video, rotular, medir una marca, la nota y la pantalla real enderezada

Parte del skill `hojas-de-proceso` (se partio el 16/10/2026, tanda 1.5 del plan del sistema, porque el
SKILL.md tenia 779 renglones). Los gates, la lista de §7 y los errores de §7 bis siguen en `SKILL.md`:
esto se lee cuando el trabajo llega a esta parte, no en vez de aquellos.

---

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

La biblioteca de fotogramas de la maquina (`<MAQUINA>\.claude\fotogramas de cada video\`,
memoria `reference_videos_y_fotos_de_maquina_donde_van`) muestrea **un cuadro
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
cosas, no podemos fallar en algo tan obvio"*. Mirar no es medir.

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
"filmado el ...", "lectura del ...", "lo agregamos nosotros", "BORRADOR". **Y desde el
24/09/2026 tampoco `TBD`** en la descripcion: lo que no se sabe se escribe generico con lo que
hay, y el por que va a la lista de pendientes (ver §4).

Lo mismo para los parametros: va el valor que rige (`Tiempo de vacio: 19 s`), no su
historia (`subido de 8 s el 10/09 porque...`).

**Tampoco va en la nota como LEI yo la foto** (Fak, 01/10/2026, hoja de engrampado del IP Pad):
habia puesto *"Una grampa que quedo hundida en el vinilo se cuenta igual"* — era mi duda al
contar grampas en el video, no una instruccion. *"Esa nota eliminala, no hace falta."* Si la
foto ya numera cada grampa, la nota dice eso y nada mas; la duda de conteo se resuelve antes
(con Fak o con la pieza) y no llega a la hoja.

## 2 sexies. La pantalla va en CASTELLANO, y el idioma no es del dia

Fak, 21/09/2026: *"hay que intentar que todas, dentro de lo posible, esten en español, no en
chino: cuando ya lo habiamos traducido me asegure de grabar todas las pantallas de frente"*.

En la moldeadora ninguna pantalla existe solo en chino: si una hoja muestra una en chino, no se
busco bien. **El idioma de la pantalla no es del dia**: se cambia en cualquier momento con las
banderas de la barra de arriba, asi que se busca cuadro por cuadro.

**Y el OCR no alcanza para encontrarlas.** En el barrido de la moldeadora, un fotograma con la pantalla en
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

**No se pasa por un generador de imagenes: reinventa los digitos, y una marca de procedencia
no se saca.**

Lo que agregamos nosotros (una advertencia, una franja) va visiblemente separado y aclarado
en el pie: *"la franja es advertencia de esta hoja, no del HMI"*.

**Las pantallas redibujadas que ya estan en el deck de la HOTMELT** (`pantalla_hmi.py`,
`pantalla_fusor.py`, `pantalla_operacion.py`, `pantalla_parametros.py`,
`pantalla_limpieza.py`) son del criterio VIEJO y hay que rehacerlas con este.
