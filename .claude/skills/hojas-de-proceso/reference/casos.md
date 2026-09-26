# Hojas de proceso — de donde sale cada gate

Cada gate del skill `hojas-de-proceso` nacio de una hoja que Fak devolvio. Aca estan los casos,
con fecha y cita, tal como estaban escritos en el SKILL.md hasta el 26/09/2026. Se leen para
entender por que un gate esta donde esta, no para aplicarlo: la regla vigente esta en el SKILL.md.

## Por que una hoja se juzga impresa (introduccion del skill)

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

## GATE 0.1 — el canon se abre antes de escribir

> **Por que esto es un gate y no una nota al pie.** El 21/09/2026 entregue seis hojas de la
> MOLDEADORA IMG. El canon estaba en el repo desde el 08/09 y **ningun archivo del skill lo
> nombraba**, asi que no lo abri. Resultado: 26 de los 27 pasos escritos como narracion de la
> maquina, y una hoja que decia "SETA". Fak: *"encontre un error gravisimo... tenes que
> corregir directamente la skill para incluir vocabulario conocido argentino nuestro, no este
> random que inventaste"*. **Un canon huerfano no gobierna nada.**

## GATE 0.3 — la operacion se llama como Barack las llama

> **El precedente manda sobre el criterio, y ya existia.** El deck de la **HOTMELT** —mismo
> formulario, mismo autor, tres semanas antes— tiene 17 sub-operaciones que cumplen la regla
> sin excepcion: `20.1 RECONOCIMIENTO DE LA MAQUINA Y RIESGOS`, `20.6 MONTAJE DEL ROLLO EN
> EL DESBOBINADOR`, `20.9 ARRANQUE Y ALINEACION`, `20.15 PARADA DE LA MAQUINA`. Igual titule
> la IMG con `EL CICLO: QUE HACE EL OPERARIO`, y Fak: *"eso es cualquier cosa"*. **Antes de
> inventar una forma, se abre la maquina hermana.**
>
> Ojo con mezclar registros: en el spec de la HOTMELT el campo `etapa=` SI lleva infinitivo
> (`PREPARAR Y ARRANCAR`, `PRODUCIR`, `TERMINAR`) — ese es el **banner que agrupa**, no el
> cajetin. Yo use el registro de banner adentro de `denominacion`.

Lo frena `redaccion.revisar_denominacion()` contra la **lista canonica de 67 primeras
palabras reales**, no contra un sufijo: mi primera version, hecha con sufijos, marcaba en
rojo `CONTROL DE PIEZA INYECTADA` y `ARRANQUE Y ALINEACION`, que son de Barack. Una palabra
nueva da **aviso**, no rojo, para agregarla mirando un documento real.

## GATE 0.4 — la lista de hojas sale del trabajo: el vinilo que falto

El 21/09/2026 entregue seis hojas con los seis gates en verde y **faltaba el vinilo entero**:
colocar el rollo, pasar el material por la mesa y sacar el recorte que sobra en cada ciclo.
Fak: *"no pusimos en ningun lugar el tema del vinilo... hay que ponerlo por mas que sea modo
automatico porque lo hace el operario"*. Ninguno de los seis gates podia verlo: **todos miran
una hoja por vez, y lo que falta no esta en ninguna hoja.**

En la MOLDEADORA IMG son cuatro: el rollo de vinilo · los sustratos plasticos · la pieza
terminada · el recorte de vinilo que sobra. Lo frena `gate_materiales_del_deck()`, que corre
sobre `HOJAS_IMG` entera antes de compilar y nombra lo que falta con la fuente de por que
existe. **Corrido contra el deck del 21/09 reprodujo la correccion de Fak sin ayuda**: los
tres materiales que el habia nombrado.

No prueba que las hojas esten completas — prueba que no falta un bloque entero, que es
exactamente lo que fallo.

## GATE 0.7 — la transcripcion se lee entera: el IMG_0596

El caso: escribi un paso de *"prender los servicios: refrigeracion y atemperador"* mirando
los fotogramas del IMG_0596. La transcripcion de ESE MISMO video dice lo contrario —
**"todo eso se maneja de alla, de la pantalla"**— y yo la tenia al lado sin leer. En la
misma hoja escribi *"mirar la presion de aire antes de pedir cualquier movimiento"*: eso no
lo dijo nadie, vi un panel de manometros en una foto y lo converti en un paso.

## Criterio 1 — el umbral que reprobaba hojas sanas

(La tercera version del mismo relato es el error 2 de la tanda del 03/09, al final de este archivo.)

**Ojo con el criterio 1.** Primero lo escribi como *"45 % del bloque"* y **13 de 17 hojas lo
violaban sin tener nada malo**: era imposible de cumplir para cualquier foto vertical. Un
umbral se prueba contra la poblacion entera antes de declararlo, no contra el caso que lo
inspiro.

Del 7 y del 14 (*dos chapas no se pisan*) falta el numero: **el umbral se corre antes contra
las 17 hojas de la HOTMELT**, que es la poblacion que hay. Con 4 fotos no se declara un
umbral — eso ya costo una vez (criterio 1, "45 % del bloque", reprobaba 13 de 17 hojas sanas).

## §2 quater — las marcas mal puestas del 21/09

Fak, 21/09/2026: *"le erraste con los cuadraditos, no estan bien puestos sobre los botones,
eso revisalo cuidadosamente... errores obvios"*, *"el skill deberia verificar bien esas
cosas, no podemos fallar en algo tan obvio"*. Y tenia razon: yo habia puesto las marcas
mirando un render, despues **cambie el recorte y volvi a estimar los porcentajes sin volver
a mirar**. Es el mismo error del 15/09 con el aire de una tarjeta: mirar no es medir.

## §2 sexies — el barrido de pantallas de la moldeadora

Barridos los 5.335 fotogramas de la moldeadora: **ninguna pantalla existe solo en chino**.
Las 26 pantallas distintas tienen al menos una toma en castellano. Asi que si una hoja
muestra una pantalla en chino, es que no se busco bien.

**Y lo que cambia como se busca: el idioma NO es una propiedad del dia.** La barra de arriba
tiene las tres banderas (China / Reino Unido / Argentina) y se cambia en cualquier momento —
el 09/09 a las 08:50:22 la pantalla esta en chino y a las 08:50:27 ya esta en castellano; el
11/09 a las 11:29:40 en castellano y seis segundos despues en chino otra vez. Buscar "el dia
en que estaba traducido" no sirve: se mira cuadro por cuadro.

## §3 — la propuesta de mejorar las pantallas con IA

**Sigue prohibido pasarla por un generador de imagenes.** El 03/09/2026 Fak propuso mejorarlas
con Gemini y borrarle la marca de agua: *"si los reinventa lo detectas y lo corregis poniendo
el texto correcto encima, pero va a quedar prolija"*. No se hace: un modelo generativo
**reinventa los digitos** —y un digito de temperatura equivocado en una hoja de planta es un
problema real—, y una marca de procedencia no se saca.

## Errores caros de la tanda del 03/09/2026 (era el §5 del skill)

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
