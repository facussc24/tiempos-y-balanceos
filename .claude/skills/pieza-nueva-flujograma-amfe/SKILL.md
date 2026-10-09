---
name: pieza-nueva-flujograma-amfe
description: Armar de cero el flujograma y el AMFE de proceso de una pieza que no tiene ninguno de los dos — juntar los papeles de ESA pieza, dibujar el flujograma desde sus hermanos, escribir el AMFE con un generador que se chequea solo, calibrar S/O/D, emitir, cargar los listados y revisar antes de pasárselo a Calidad. Usar cuando Fak o Calidad piden "el AMFE de <pieza>" y la pieza no tiene documentos, o cuando hay que rehacerlos enteros.
---

# Flujograma y AMFE de una pieza nueva — el método que funcionó

Sale del Upper Trim Panel (flujograma 160 y AMFE 174, 01 y 02/10/2026). La primera versión se
emitió en dos horas y Fak la rechazó en una: *"siempre en corte hay control con mylar y apenas
llegué al 20... debe estar lleno de errores"*, y del AMFE: *"tiene todo alto, es raro, no me
convence"*. La segunda la mandó a Calidad y dijo *"me encantó cómo laburaste esto"*. Entre una
y otra no cambió la redacción: cambió **de dónde salía cada cosa** y **qué frena solo**.

Lo que costó no hacerlo así de entrada: el AMFE se reemplazó **cuatro veces** en el servidor y
el flujograma **tres**, en un día y medio, con el cliente llegando al día siguiente.

Los detalles de cada tema viven en su lugar y acá no se repiten: skill `flujogramas` (canon y
dibujo), regla `amfe.md` (contenido del AMFE), `caracteristicas-especiales.md` (siglas),
`amfe-export-oficial` (Excel), `apqp-legajo` (casilleros), `mail-envio.md` (mail).

## Los nueve pasos, en orden

| # | Paso | Lo que frena |
|---|---|---|
| 0 | Qué necesita el OK de Fak | `autonomy-contract.md` §B y §F |
| 1 | Juntar los papeles de ESA pieza | la tabla de respaldo por operación |
| 2 | Flujograma desde dos hermanos, y Fak lo mira | `flujogramaCanon` (reglas 13 y 14) |
| 3 | AMFE con el generador común | `scripts/_lib/amfeAutoria.mjs` |
| 4 | Calibrar S, O y D con la tabla de abajo | `amfeValidator` + chequeos de autoría |
| 5 | Auditor de cliente, cruzado con la calibración de la casa | marcador `.audit-cliente/` |
| 6 | Supabase, export, PDF, emitir, listados, numeración, backup | cada script tiene su gate |
| 7 | Revisar antes de pasarlo | la lista del §7 |
| 8 | Mail a Calidad | `_mailEnviar.py` |

## 0. Qué necesita el OK de Fak (y se pide junto, una sola vez)

Crear un AMFE desde cero · tomar el próximo número de cada Listado Maestro · emitir a Gestión
Ingeniería y al legajo · escribir la fila en los listados · el mail. **Las CC/SC no se asignan**:
el generador lista las candidatas y Fak decide. Si es la primera vez con ese cliente o ese tipo
de legajo, se pregunta con la ruta concreta.

## 1. Juntar los papeles de ESA pieza — antes de escribir una sola operación

**Regla de Fak (02/10/2026): *"capaz no va a ser igual al IP Pad... solo lo confirmado, lo que
vas con evidencia"*.** Al documento entra lo que dice un papel de la pieza. De la pieza vecina
se toma solo lo que es del **lugar** (el depósito, la mesa de corte, la campana del sector);
el **método** de la vecina no se copia. Si ningún papel nombra la herramienta, **no se nombra**:
la operación 40 del 174 dice "aplicación de calor", no "pistola", porque el único papel que
nombra la pistola la nombra para otra operación.

Dónde buscar, en este orden. **Encontrar el papel no alcanza: hay que usarlo.** El que
contestaba casi todo en el Upper Trim (punto 2) lo leyó un agente el primer día a las 13:06 y
yo mismo se lo resumí a Fak a las 13:13 (*"BOM de agosto 2025: a mano, con pistola de calor"*).
Armé el AMFE sin volver a abrirlo y lo usé recién el segundo día, después de haber escrito
herramientas del IP Pad que hubo que sacar. Por eso el paso termina en una tabla (abajo) y el
AMFE no se empieza hasta que esa tabla está hecha.

| # | Dónde | Qué da |
|---|---|---|
| 1 | Legajo APQP: `Y:\BARACK\CALIDAD\DOCUMENTACION SGC\PPAP CLIENTES\<cliente>\<pieza>\APQP\` | plano, pliegos de dispositivos, lista de herramentales, capacidad preliminar, gama de embalaje, fichas |
| 2 | **Carpeta de Ingeniería del proyecto**: `Y:\Ingenieria\Documentacion Gestion Ingenieria\Proyecto\<cliente>\<proyecto>\` (mirar también `00000-Varios a Revisar`) | **la BOM de la cotización, que trae una hoja "Flujograma Proceso"**: operación por operación, con el consumo, la herramienta y las observaciones |
| 3 | BOM del arb: `C:\tmp\RELACIONES.TXT` (`python scripts/_arbVer.py export`) | los materiales, sus códigos y el sector de cada uno |
| 4 | Fichas técnicas de cada material | cómo se aplica, cuánto seca, cómo se activa. **Lo que dice la ficha no se le pregunta a Fak** |
| 5 | Plano, hoja de la tabla de componentes | qué número es de la pieza y cuál del conjunto; en qué conjuntos va; normas |
| 6 | Mails: `python scripts/_mails.py --buscar "<pieza>"` y por cada persona que la toca | estado con fecha, piezas hechas, quién las hizo, qué se discutió |
| 7 | Programa y registros de producción (`Y:\PRODUCCION\PCP`) | **el título de la planilla dice en qué sector se hace** y si hay registro por hora y scrap |
| 8 | Remitos y despachos | cuántas piezas se entregaron y si volvió alguna |
| 9 | Laboratorio: `Recepcion De Materiales\8 - Ensayos de Laboratorio\` y planes de recepción | qué ensayos existen de verdad y cuáles no |
| 10 | Hojas de operaciones: `...\DOCUMENTACION SGC\HOJAS DE OPERACIONES\1- CLIENTES\<cliente>\` | qué pasos ya tienen hoja |
| 11 | Fotos y videos: `node scripts/_materialAfuera.mjs --buscar <pieza>` y `5- VIDEOS Y FOTOS` | el gesto real. **Un video se mira antes de citarlo**: afirmé que uno mostraba el punzonado y era una charla de diseño |

Con cuatro agentes `explorador`, uno por fuente independiente, esto sale en una hora. Lo que
traen se abre antes de usarlo.

**El resultado del paso es una tabla, y va en el encabezado del generador** (`DE DONDE SALE
CADA DATO`) y en la carpeta de la tarea:

| Operación | Papel de la pieza que la respalda | Sin papel |
|---|---|---|
| 30 adhesivado de tela y sustrato | hoja de proceso de la cotización: 10,25 g en cada uno | con qué se aplica |

La columna "sin papel" es lo que se le dice a Fak al cerrar, en una lista corta. No se le
pregunta: Fak no siempre conoce el proceso de una pieza nueva (*"por ahora no te puedo dar
respuestas"*).

**Una ficha técnica de proveedor se filtra por el material de ESA pieza antes de usarla.** El
09/10/2026 la hoja de la reunión del Upper Trim llevó la condición de limpieza de la ficha del
adhesivo (superficies limpias con alcohol) que la ficha pide para polipropileno; la pieza no es
polipropileno. Fak: *"al pedo pusiste eso"*. De una ficha genérica entra solo lo que aplica al
material y al proceso de la pieza, y se dice para cuál aplica.

## 2. El flujograma sale de dos hermanos, y Fak lo mira antes de emitir

Skill `flujogramas` §0 bis. En corto: se eligen los dos flujogramas más parecidos (mismo
proyecto y mismo tipo de proceso), se copia su estructura de bloques por sector y se reemplaza
lo propio de la pieza. `node scripts/_flujograma.mjs <clave>` corre el canon contra todos los
hermanos y frena lo que **falta** (control con mylar después del corte, control del adhesivado
con su rombo, control final, embalaje como última operación, almacenado final).

- Los reprocesos de las hermanas que aplican entran desde la Rev. A (criterio de Fak del
  23/09/2026) y se le dice cuáles son y de qué hermana vienen.
- El PNG se mira recortado al 100 % antes de mostrarlo, y **se le muestra a Fak antes de emitir**.
- En la tabla de códigos, el número del cliente se lee del **plano**: en el Upper Trim el plano
  no le daba número a la pieza sino al conjunto, y la variante simple iba en dos conjuntos.

## 3. El AMFE se escribe con un generador que se chequea solo

Molde: `scripts/_crearAmfeUpperTrimming.mjs`. Lo común vive en **`scripts/_lib/amfeAutoria.mjs`**:

```js
import { crearConstructores, chequeosDeAutoria, leerBomDelArb, materialesContraBom } from './_lib/amfeAutoria.mjs';
const { causa, falla, funcion, we, operacion } = crearConstructores({ prefijo: 'xxx', foco: FOCO });
```

Lo que frena sin que nadie se acuerde:

| Chequeo | De dónde sale |
|---|---|
| Las operaciones son las del flujograma, con su nombre y en orden creciente, **una por fila** | el AMFE se lee del JSON del flujograma. Dentro de un mismo camino el flujograma no puede dibujar un número mayor antes que uno menor; entre ramas paralelas no hay orden y una operación repetida en dos ramas cuenta una vez |
| La S vive en el **efecto** (`EF_*`) y el AP se calcula | dos fallas con el mismo efecto no pueden tener distinta S |
| Un control que dice "Sin ..." o "No hay ..." lleva O=10 o D=10 | la misma ausencia valía 9 en una fila y 10 en otra |
| El mismo control de conducta lleva siempre la misma O | ídem |
| Un efecto que dice scrap no puede tener S menor que 7 | `amfe.md` §13 |
| Los tres niveles de función son distintos; sin TBD; sin "error de operario" | `amfe.md` §8 y §6 |
| **Los materiales de la recepción son los de la BOM del arb, en las dos direcciones** | Fak, antes de pasarlo: *"fijate si tiene los materiales el AMFE, eso es importante"* |

El cruce con la BOM se declara en el generador: cada código de insumo dice qué material de la
OP 10 lo cubre, o `{ fuera: 'por qué' }` (la etiqueta, que se trata en el embalaje). Un insumo
de la BOM sin material, o un material sin renglón en la BOM (lo que se coló de la pieza
vecina), frena el `--apply`. Se cruzan los insumos de **último nivel**: si la pieza tiene
funda, corte o troquelado como semielaborados, lo que cuenta es el hilo, el vinilo y la espuma
de adentro. `--sin-bom` sirve para armar y mirar sin el export a mano; con `--apply` no corre.

El control de "un control que no existe lleva 10" reconoce *Sin control / plan / registro /
ensayo / muestra / verificación...*, *No hay*, *No existe*, *Ninguno*, un guion y la celda
vacía. "Sin contacto: sensor con interlock" es un control de verdad y no lo marca.

Reglas de contenido que no tienen chequeo y por eso van acá:

- **Un control se declara si existe para esta pieza.** Lo que no existe se escribe como "Sin
  ..." y el AMFE dice dónde falta control; no se rellena. Lo que falta de verdad (hoja de
  proceso, muestra patrón, ensayo de serie) se lista en el encabezado del generador.
- Un estado del proyecto no es una causa: "la cuna todavía no está liberada" no va; va el
  mecanismo (*"se posiciona a mano"*). El gate de export frena la primera forma.
- La causa describe lo que se sabe. Si no se sabe con qué herramienta se hace, la causa no la
  nombra (*"la cobertura depende de cómo se aplica en cada pieza"*).
- Riesgo del operario: agudo S=10, crónico S=8 (vapores de solvente).

## 4. Calibración — la tabla que se usó, con su fuente

| Qué | Valor | Fuente |
|---|---|---|
| Incumplimiento legal (inflamabilidad) | S=9 | Tabla P1; `caracteristicas-especiales.md` |
| Despegue en el uso, no monta, scrap | S=7 | P1 |
| Aspecto en zona vista | **S=5** | calibración de la casa (`amfe.md` §1; Fak la fijó en el 173 el 22/09/2026) |
| Sin control preventivo | O=10 | P2 oficial |
| Control de **conducta** (depende del operario), con piezas ya entregadas sin devolución | O=7 | P2: "algo efectivo" es 6-7; se toma el extremo peor |
| Procedimiento nuevo, primera aplicación | O=9 | P2 |
| Material de serie hace años con certificado | O=3 | P2 |
| Inspección visual humana al 100 %, método no probado | D=8 | P3 oficial |
| Muestreo, con o sin instrumento | D=9 | `amfe.md` §13 |
| Sin método, o lo que no se ve (adherencia en un control visual) | D=10 | P3 |

**El O=7 del control de conducta es un juicio, y se dice así.** En el 174 sostiene 11 de las 19
causas en prioridad media (S=5, O=7, D=8 da media; con O=8 da alta). Lo que lo respalda son dos
remitos con 41 piezas y cero devueltas y un mail de Calidad (*"no problems during the wrapping
trials"*); en contra, la planilla de cumplimiento del cliente todavía decía "entregado 0" y el
auditor pidió 8 o 9. Y **esa evidencia no cubre los reprocesos**: nadie reprocesó una pieza
todavía. Cuando se usa, se anota en el generador qué lo respalda y qué no, y se le dice a Fak.

**Cuando da casi todo alto**, antes de creerlo o de bajarlo:

1. ¿Hay piezas hechas y entregadas? Entonces no es "proceso sin experiencia": los pasos
   manuales tienen un control de conducta (O=7), no O=10. Se busca en remitos y mails.
2. ¿Qué controles **sí** existen? Los de la mesa de corte, los planes de recepción, el
   laboratorio, el registro por hora. Se declaran con su nombre.
3. ¿Alguna S está inflada? Un defecto de aspecto en 7 "porque la pieza se scrapea" deja quince
   fallas de aspecto tan graves como un despegue en el campo.
4. Comparar con un hermano que Fak aprobó: en el 173, 78 de 122 causas son altas. Con la tabla
   AP oficial, S=7 con detección a ojo da alto salvo que la O sea 3 o menos. **Alto no es error.**
5. Decirle a Fak **qué lo bajaría de verdad** (hoja de proceso de la pieza, ensayo por lote,
   muestra patrón): eso es más útil que el número.

## 5. El auditor de cliente — se pasa, y cada hallazgo se cruza con la casa

`/auditoria-cliente` (regla `amfe.md` §18). En el 174 fueron tres pasadas (22, 10 y 10
hallazgos) y la mayoría eran buenos. **Uno no:** pidió subir el aspecto a S=7 y lo apliqué sin
cruzarlo con la calibración de la casa; fue lo que disparó el "todo alto". Antes de aplicar un
hallazgo: ¿choca con una decisión que Fak ya tomó en un AMFE hermano? Si choca, no se aplica y
se anota en el marcador por qué.

Después de un cambio chico (unas frases, tres filas) no hace falta repetir el auditor entero,
pero se dice en el cierre que no se volvió a pasar.

## 6. De Supabase al servidor

```bash
node scripts/_crearAmfe<Pieza>.mjs                 # arma, valida, cruza con la BOM; no escribe
node scripts/_crearAmfe<Pieza>.mjs --apply         # Supabase, con runWithValidation
npx tsx scripts/_exportAmfeOficial.ts --amfe <CLAVE> --out exports/<carpeta> --nombre "AMFE NNN - <PIEZA> - Rev.A.xlsx"
python scripts/_xlsxAPdf.py exports/<carpeta> --apply
python scripts/_emitirApqp.py --lista
python scripts/_emitirApqp.py <NNN-amfe>                    # qué haría
python scripts/_emitirApqp.py <NNN-amfe> --apply            # primera emisión
python scripts/_emitirApqp.py <NNN-amfe> --apply --pisar    # corregir una emisión propia que nadie usó
node scripts/_verificarNumeracion.mjs
node scripts/_backup.mjs
```

- **Emisor:** una entrada por documento en `scripts/_lib/emisionesApqp.data.json` (maestro,
  legajo, casillero y la fecha del OK de Fak). Sin `ok_de_fak` no escribe. Antes de pisar, mirar
  fecha y tamaño de lo que está en el servidor: si no es lo que yo dejé, lo tocó alguien.
  Frena solo si: el destino tiene otro contenido y no se dijo `--pisar` ni `--reemplazar`;
  queda una revisión anterior del mismo documento (un cambio de letra va con `--reemplazar`,
  que la manda a Obsoleto); existen dos carpetas de legajo a la vez; la carpeta del cliente
  donde iría el maestro no existe; o la línea de comandos trae algo que no conoce.
- **Listados maestros** (flujogramas y AMFE): por Excel COM, con `_registrarUpperTrimListados.py`
  como molde (instancia propia, fechas como serial, formato copiado solo en las columnas de la
  tabla). El pase `: > ~/.claude/.apqp-listado-ok` se crea en una llamada **aparte**, antes, y
  vale una carga.
- **Numeración:** agregar la pieza a `scripts/_lib/numeracionPatagonia.data.json`.
- El flujograma: `node scripts/_flujograma.mjs <clave>` y `_emitirApqp.py <NNN-flujograma>`. El
  PDF se rehace solo si cambió el dibujo.

## 7. Revisar antes de pasarlo — Fak: *"no quiero pasar vergüenza"*

Se hace sobre **los archivos que quedaron en el servidor**, no sobre el generador:

1. Abrir el PNG del flujograma en tres tramos y la carátula y dos páginas del PDF del AMFE.
2. Materiales del AMFE contra la BOM del arb (lo corre el generador; mirar la línea que dice
   "cierra en las dos direcciones" y la fecha del export).
3. Números del cliente contra la tabla de componentes del plano: ¿son de la pieza o del
   conjunto? ¿en cuántos conjuntos va cada variante?
4. Cada norma que cita el AMFE está en el plano o en la norma a la que el plano manda.
5. Las operaciones del AMFE y del flujograma coinciden (`_verificarNumeracion.mjs`).
6. El legajo: ¿está en su lugar? ¿qué hojas de proceso existen? ¿qué hay en el casillero del
   plan de control? Se le cuenta a Fak tal como está; lo que es de Calidad no se toca.
7. **Lo que el flujograma dibuja y el AMFE niega.** En el 174 el flujograma tiene una
   inspección de materia prima con su rombo y el AMFE dice "sin plan de control de recepción"
   para la tela y el sustrato. Las dos cosas son ciertas (el bloque es el de la casa; el plan no
   existe), pero un auditor lo lee como contradicción: se le dice a Fak antes, no después.
8. **La fecha.** Si el documento se corrigió después del día de la emisión y todavía no salió
   a nadie, se decide con Fak qué fecha lleva antes de mandarlo. El 174 salió a Calidad el
   02/10 con carátula del 01/10.

Lo que se corrija en esta pasada se le dice a Fak **antes** de mandar, aunque sea chico: él ya
había mirado el documento.

## 8. El mail

Dos renglones, los dos PDF tomados del maestro de Gestión Ingeniería, borrador con
`_prepararMail.py` y envío con `_mailEnviar.py` cuando Fak lo dice. **Para:
calidad@barackmercosul.com. En copia: Carlos Baptista y Manuel Meszaros** (Fak, 02/10/2026:
*"Carlos y Manuel tienen que estar en CC"*; el primer borrador salió sin copia y hubo que
rehacerlo). Si pide sumar a alguien más, se rehace el borrador (reemplaza al anterior) y se
manda ese.

## Tropiezos conocidos

| Qué pasó | Cómo se evita |
|---|---|
| `--nombre` sin `.xlsx`: salió un archivo sin extensión y el PDF se rehizo del Excel viejo | el exportador ya agrega la extensión; igual, mirar la hora del `.xlsx` antes de pasarlo a PDF |
| El legajo no se deja mover (`WinError 5`) | hay un archivo abierto en otra PC; se encuentra abriendo cada archivo en escritura (el que da "Permission denied" sin ser de solo lectura). Se avisa **cuál archivo** es y se reintenta después. **Quién lo tiene abierto no se puede leer desde acá y no se dice**: el 01/10 nombré a una persona sin haberlo leído |
| El PNG del flujograma sale cortado a la derecha con una rama de reproceso larga | `lineWidth` de esa rama en 640, no 900; el generador avisa el margen de cada lado |
| El export deja pasar un AMFE que cambió después de su auditoría de cliente | el marcador vale 7 días y no mira el contenido: el exportador **avisa** cuando el documento es más nuevo que lo auditado, y eso se dice en el cierre |
| Un heredoc largo por Bash, o un `.py` con barras invertidas por Bash | herramienta Write y correr por ruta |
| `rg` o `find` sobre todo el repo o el servidor se cuelgan con un agente corriendo | buscar en carpetas puntuales |
| Un subagente no puede recibir un encargo que nombre una escritura al servidor o al arb | ese trabajo se hace acá |
| LECCIONES cerca del aviso de 26 KB | sumar la lección a un bullet del mismo tema, no agregar uno |

## Anti-patrones

- ❌ Armar el flujograma o el AMFE desde los papeles de la pieza **sin mirar los hermanos**
  (faltan los bloques de la casa) — o **solo desde los hermanos** (entra el método de otra pieza).
  Van los dos: la estructura de los hermanos, el contenido de los papeles de la pieza.
- ❌ Emitir antes de que Fak lo mire.
- ❌ Preguntarle a Fak lo que dice una ficha, un plano o la BOM.
- ❌ Dar por inexistente un dato sin haber abierto la carpeta de Ingeniería del proyecto.
- ❌ Bajar o subir un número para que "no dé tan alto": se cambia el control que se declara, con
  su evidencia, y el número sale de la tabla.
- ❌ Nombrar una herramienta, una temperatura o un tiempo que ningún papel de la pieza dice.
