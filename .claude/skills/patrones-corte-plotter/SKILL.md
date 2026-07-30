---
name: patrones-corte-plotter
description: Patrones de corte 2D en DXF y PLT/HPGL para mesa de corte y plotter — leer un DXF crudo y cerrar el contorno, mover los puntos de anclaje (cruces X) y los piquetes, generar el PLT, y demostrar con numeros que el cambio salio exacto. Usar cuando Fak pase un .dxf o .plt de un patron, pida mover/corregir puntos de alineacion, hable de tizada, mesa de corte, plotter, mylar o troquel, o pida comparar el patron de una mano contra el de la otra. Incluye los 3 gates que evitan los errores caros (aplomo, marco de referencia, verificacion ritual).
---

# patrones-corte-plotter — mover puntos sin equivocarse

> **Causa raiz de los errores caros en este trabajo:** razonar con "izquierda/derecha"
> sin anclarlo a la geometria, y mover puntos sobre un patron que esta girado en el
> archivo. Los dos se detectan con una medicion de 3 segundos. Ninguno se detecta mirando.

## 0. LOS 3 GATES (bloqueantes, en este orden)

**GATE 1 — APLOMO (posicion 0 de la pieza).** Antes de mover NADA:
`gate_aplomo(C)`. La pieza apoyada sobre una mesa toca en 2 puntos: los del
envolvente convexo **inferior**. La recta entre esos 2 puntos es el datum, la
posicion 0, y **todo movimiento se mide desde ahi**.
- `OK` (< 0.10 grados): mover en coordenadas del archivo.
- `TOLERABLE` (< 0.60): mover igual, pero **documentar el angulo y el error** que mete.
- `CHUECO`: NO mover en coordenadas del archivo. Rotar los deltas con
  `a_marco_pieza(dx, dy, angulo)`, o enderezar el patron primero.

NO ajustar una recta por minimos cuadrados al borde inferior: ese borde suele ser
curvo y el ajuste devuelve la curvatura, no el giro. Son cosas distintas y dan
numeros distintos.

**GATE 2 — DIRECCION: EL CHEQUEO FRENA, NO DECIDE.**
Cuando el usuario dice "moveme el punto 4,5 a la derecha", eso es un **dato**, no una
hipotesis a validar. Si `tabla_4_combinaciones()` da alarma (punto a menos de 3 mm del
filo; rango sano 5 a 17 mm), la unica accion correcta es **mostrarle la tabla y
preguntar**. **Jamas invertirle la direccion por cuenta propia.**

> Esto ya rompio un patron (30/07/2026): la alarma sonaba, yo la interpretE como
> "leyo mal la direccion" y aplique lo contrario de lo que me habian dicho. La alarma
> tenia razon en el numero y yo estaba equivocado en la conclusion.

**Por que la alarma puede ser un falso positivo — la regla de negocio:** el punto ancla
la pieza en el armado, asi que la pieza (y la costura) se corre en **sentido contrario**
al punto. **Para que la costura vaya a la izquierda, el punto va a la derecha.** Que el
punto se acerque al filo puede ser exactamente lo buscado, no un error.

Lo que si hay que reportar es la **consecuencia fisica medida**, sin opinar sobre la
direccion: distancia del centro al filo, y **cuantos de los 4 extremos de la cruz quedan
fuera del contorno** (si alguno sale, la X impresa se corta contra el borde y pierde una
punta). Si en ese punto va un agujero, poco material al borde puede desgarrar.

Contexto de marcos, para leer bien la geometria (no para decidir por el usuario):
la pieza se corta **del reves**, asi que el archivo de corte es el espejo horizontal de
la pieza vista de frente — vertical igual, horizontal invertido. Y el patron de la mano
izquierda es el espejo del de la derecha (el espejo de mano y el de corte se cancelan:
**un solo mirror**). NUNCA razonar con "izquierda/derecha" a secas para identificar una
cruz: anclar a la **anatomia** con `punta_fina(C)`, el extremo alto y el borde de los
piquetes.

**GATE 3 — VERIFICACION RITUAL.** No se entrega nada sin estos dos bloques impresos:
- *Lo que SI se movio*: los 4 extremos de la cruz uno por uno con dX/dY a 4 decimales
  (tienen que ser identicos entre si y exactamente el delta pedido), centro antes→despues,
  distancia al filo antes→despues, `dentro=True`, y los 2 brazos midiendo 6.000.
- *Lo que NO se movio*: contorno con **desviacion maxima = 0.000000 mm**, piquetes con
  movimiento 0.000000, y misma cantidad de entidades. Si el contorno no da 0.000000, algo
  se rompio.

## 1. Entorno

| Que | Comando |
|---|---|
| Interprete (unico) | `C:\Dev\BarackMercosul\.venv-cad\Scripts\python.exe` |
| Librerias | `ezdxf` (DXF), `matplotlib` backend `Agg` (imagenes) |
| Libreria propia | `scripts/patronlib.py` — importar desde ahi, no reescribir |

El PLT se escribe a mano: es texto plano HPGL, no hace falta libreria.

## 2. Formato de los archivos

**DXF**: R2018, `$INSUNITS=4` (mm), `$MEASUREMENT=1`.
- capa `CORTE` (color 7): UNA LWPOLYLINE cerrada = el contorno de corte.
- capa `MARCAS` (color 1): LINEs sueltas.
  - **cruz X** = 2 LINEs de 6.0 mm a ±45 grados cruzadas = 1 punto de anclaje.
  - **piquete** = 1 LINE de 5.0 mm perpendicular al borde, hacia adentro.

**PLT (HPGL)**: `IN;` → `SP1;` contorno (lo unico que corta, un solo `PD` cerrando al
primer punto) → `SP2;` marcas (un `PU/PD/PU` por segmento) → `PU;SP0;`.
Escala **40 unidades por mm**. Saltos de linea **CRLF**.
Trasladar **todo junto** (contorno + marcas) al origen con el minimo comun: si se
trasladan por separado, las marcas se desalinean.

Lo que este en otras capas (basura de layer 0, cajas auxiliares, textos) **no entra al
PLT**: `escribir_plt()` toma solo CORTE + MARCAS. El DXF sin embargo la conserva — avisarlo.

## 3. Flujo para mover un punto

1. `leer(path)` → `doc, C, cruces, piquetes`. Las cruces vienen ordenadas por Y:
   `cruces[0]` = BAJA, `cruces[1]` = ALTA.
2. **GATE 1** `gate_aplomo(C)`.
3. Identificar la cruz por **anatomia**, no por el nombre del archivo: `punta_fina(C)`
   mas la posicion relativa de cada cruz. El nombre del archivo puede mentir; la
   geometria no.
4. **GATE 2** `tabla_4_combinaciones(cruz, C, dx, dy)`.
5. `mover_cruz(cruz, dx, dy)` — traslada los **brazos existentes**. Nunca reconstruir
   la cruz desde el centro nuevo: trasladando los brazos, el largo de 6.000 se conserva
   por construccion.
6. `doc.saveas(nuevo)` — el `doc` viene vivo de `leer()`, asi que todo lo que no se toco
   queda **byte a byte igual**. No reconstruir el DXF desde cero.
7. `escribir_plt()` desde el archivo nuevo.
8. **GATE 3** y una imagen de comparacion.

## 4. Rotar e identificar el PLT

**Rotar** (para aprovechar el ancho del rollo): `rotar90(pts)` — antihorario `(x,y)→(-y,x)`.
Rotar el **contorno y TODAS las marcas juntos**, y despues `trasladar_al_origen()` con el
mismo minimo comun. Rotar no deforma, y eso hay que **demostrarlo**: perimetro identico y
distancia de cada cruz al filo identica al noveno decimal. Si cambia, se roto mal.

**Identificar el patron adentro del archivo** (pieza + mano + fecha), para que nadie corte a
ciegas:
- `ubicar_texto(lineas, C, marcas, ...)` busca un lugar dentro de la pieza que respete un
  margen al contorno y a **todas** las marcas existentes. Usa un campo de holguras con numpy;
  la version por fuerza bruta no termina sobre un contorno de cientos de vertices.
- `bloque_texto(lineas, x, y, altura)` genera el texto como **trazos** (fuente de un solo
  trazo, A-Z 0-9 y algunos signos). A proposito **no** se usa el comando `LB` de HPGL: con
  trazos son los mismos `PU/PD` que el resto del archivo, no depende de que el plotter tenga
  fuente, y se puede **verificar geometricamente** donde cae cada punto.
- La fuente **no inventa glifos**: un caracter que no tiene, lo saltea.
- Colocar el texto en el marco ORIGINAL (la pieza es ancha y hay lugar) y **despues** rotar
  todo junto: queda alineado con la pieza sin volver a resolver la ubicacion.
- Verificar siempre, sobre los trazos reales: todos los puntos `dentro()`, distancia minima al
  contorno y distancia minima a las marcas.

El texto va en **pluma 2**, igual que las marcas — la pluma 1 es lo unico que corta.

## 5. Corregir la costura — lazo cerrado, NO espejo

> **El patron no es un objeto geometrico: es una compensacion de lo que tira la maquina.**
> Cada mano se comporta distinto, asi que la correccion de una **no es el espejo** de la otra.
> Espejar seria copiarle a una mano un error que la otra no tiene. Caso real (30/07/2026): las
> dos manos necesitaban correcciones de **signo opuesto**. La simetria entre manos es un
> **chequeo**, nunca el objetivo.

**EL PUNTO Y LA COSTURA VAN AL REVES: para SUBIR la costura hay que BAJAR los puntos.**
El punto baja en el patron → la pieza queda empujada hacia arriba → la costura se va con ella →
la medida costura-borde sube. `costuralib.py` ya lleva ese signo (constante `SIGNO = -1`).

> Error real del 30/07/2026: puse el signo al reves y entregue los patrones invertidos. Causa:
> lei "21 mm en el arranque contra 18-19 mm en la punta" como un ANTES/DESPUES, cuando son DOS
> LUGARES DE LA MISMA PIEZA. **Antes de derivar un signo de unos numeros, verificar que sean un
> antes/despues y no dos posiciones.** Lo agarro Fak preguntando "entendes que para subir la
> costura hay que bajar los puntos?".

El ciclo es: medir la pieza real → comparar contra spec → mover el punto → cortar → medir de
nuevo. `costuralib.py` hace la parte de calculo:

- La pieza se ancla por sus DOS cruces. Mover **una sola** la hace **pivotear** sobre la otra:
  correccion en **cuña**, maxima en la cruz que movés y cero en la otra. Mover **las dos** es una
  **traslacion**: correccion **pareja**. El criterio NO es "grande vs chico" — es la **forma del
  error**: si una punta esta bien y la otra corrida, va una sola cruz.
- `delta_medida()` / `simular()` predicen cuanto cambia la medida en cada estacion.
  `resolver()` hace el inverso por minimos cuadrados: que delta deja todo lo mas cerca del objetivo.
- **Factor k** (cuanto del movimiento del punto llega a la costura): no es 1, el armado se come
  parte. **NO estimarlo comparando una mano contra la otra** — son piezas que pasan por la maquina
  distinto (misma razon por la que no se pueden espejar), asi que esa comparacion no mide el
  efecto del punto. Estimarlo con un ANTES/DESPUES de la MISMA pieza. Mientras no se tenga,
  **dimensionar el paso para k=1,0**: quedarse corto es seguro y se itera; pasarse no.
  Y **reportar el abanico de resultados** para el rango de k, no un solo numero.
- Definir **estaciones fijas** (posiciones concretas a lo largo de la costura) para que las
  mediciones sean comparables entre iteraciones y entre manos.

**Lo que el punto NO puede arreglar:** si dos estaciones tienen normales parecidas, responden casi
igual a cualquier movimiento del punto — entonces una diferencia entre ellas es **irreducible por
punto** y sale del CONTORNO (o del armado), no del anclaje. Calcular la sensibilidad ANTES de
prometer una correccion: puede no existir ningun delta que satisfaga todas las estaciones.

## 6. Comparar las dos manos

`comparar_par(C_der, X_der, C_izq, X_izq)` espeja la izquierda al marco de la derecha
y devuelve:
- `espejo_exacto`: si los contornos son espejo exacto (desviacion < 0.05 mm). Si lo son,
  **la unica asimetria posible esta en los puntos**, y eso vuelve el diagnostico trivial.
- `residuos` por cruz y `uniforme`: si la dispersion entre las 2 cruces es < 1.5 mm, un
  **corrimiento unico de las 2 cruces** corrige el par; si no, no hay corrimiento uniforme
  que lo arregle y el pedido hay que repensarlo.

Esto sirve para **identificar de que par de archivos habla el usuario** cuando lo dice de
memoria: si pide "mover las 2 cruces N mm para lograr simetria", el par correcto es el que
da `uniforme = True` con un corrimiento cercano a N. Los otros pares quedan descartados por
geometria, sin preguntar.

## 7. Nomenclatura y versiones

El riesgo mas caro del proyecto es **que se corte un archivo viejo**.
- Nombre: `Patron_<FAMILIA>_<PIEZA>_<MANO>_<AAAA-MM-DD>.dxf` — fecha ISO para que ordene
  cronologicamente sola, mismo nombre base para el `.plt`.
- **El "que cambio" NO va en el nombre**: va en la bitacora que vive al lado. Los sufijos
  descriptivos generan nombres largos, inconsistentes, y colisiones entre archivos de
  distinto contenido con el mismo nombre.
- Separar `DXF\` y `PLT\`; todo lo reemplazado a `obsoleto\` en el mismo momento en que
  se genera el reemplazo. Si dos archivos de contenido distinto quedarian con el mismo
  nombre al archivarse, prefijar — nunca dejar que uno pise al otro.
- Al entregar: decir tamano 1:1, posicion de las cruces, y **que archivo reemplaza**.

## 8. Imagenes de control

matplotlib con backend `Agg`. Paleta fija del proyecto:
`#1f4e8a` azul = contorno · `#c0392b` rojo = marcas y piquetes · `#888888` gris punteado
= estado ANTES · `#1e8449` verde = estado DESPUES · flecha verde = vector de desplazamiento.
`ax.set_aspect('equal')` **siempre**.

Layout que funciona: una fila por pieza, vista completa a la izquierda y **un zoom por
cada punto movido** a la derecha. Un solo zoom deja la otra cruz sin evidencia — mostrar
todas. En el titulo de cada zoom, antes → despues con numeros.

**Mirar la imagen antes de entregarla.** Es la unica forma de detectar que se movio la
cruz equivocada.

## 9. Lecciones caras

1. **El aplomo primero.** Mover puntos sobre un patron girado manda el movimiento en
   diagonal. Se mide en 3 segundos y no se ve a ojo.
2. **La distancia al filo es el detector de errores de direccion.** Un punto que queda a
   menos de 3 mm del borde casi nunca es lo que el usuario quiso.
3. **Medir punto-a-segmento, nunca punto-a-vertice**: contra vertices da falsos "esta afuera".
4. **La geometria le gana al nombre del archivo** para identificar una pieza, pero **el dato
   del usuario le gana a todo**: si dice que es otra pieza, se rehace el analisis sobre esa,
   no se defiende el propio.
5. **Suavizar/limpiar el contorno va ANTES de validar puntos**, nunca despues: el suavizado
   mueve el borde y le corre la referencia a todo lo ya medido.
6. La costura y el agujero estan **acoplados por el mismo punto**: al mover el punto para
   corregir la costura, el agujero queda corrido. Avisarlo siempre.
