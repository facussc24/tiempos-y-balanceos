---
name: flujogramas
description: Armar, corregir o revisar un flujograma de proceso de Barack (formulario I-IN-002/III) con el generador de `tools/flowchart/`. Usar cuando Fak pida hacer o corregir un flujograma, cuando haya que decidir la numeracion de un proceso, cuando haya que mirar un flujograma renderizado para revisarlo, o cuando el AMFE y el Plan de Control no cierren con el flujograma. Trae el criterio de numeracion, las convenciones de dibujo validadas por Fak, las trampas del motor y como se entrega. Complementa `no-pfd-no-ho.md` (que dice QUE se hace y quien manda la numeracion) y `amfe.md` §12.
---

# El flujograma manda la numeracion, y se juzga renderizado

Orden APQP: **flujograma → AMFE → Plan de Control**. La hoja de operaciones va detras de
los tres. Si no cierran, se reporta la tabla de divergencias y **se numera contra el
flujograma** — nunca al reves, aunque la HO sea mas nueva.

> Los flujogramas los hace esta sesion desde el **18/08/2026** (Fak: *"vos sos el que hace
> los flujogramas ahora, te lo habia dicho ya"*). No se le pasa un prompt para que los
> dibuje el. Regla: `no-pfd-no-ho.md`.

---

## 1. La numeracion — el criterio de la casa

### 1.1 Un solo decimal por sector

**Las sub-operaciones del mismo sector viven en la misma decena.** Fak, 08/09/2026,
mirando el 154 INSERT:

> *"dentro del mismo sector intentemos mantenernos en el mismo decimal. Pusiste el
> refilado y luego costura saltando de 10 en 10, y despues en el almacenado pusiste 51 ahi
> abajo, pero en el almacenado de corte lo saltaste 5. No esta manteniendo un solo criterio."*

Lo que estaba mal en la Rev.A: la mesa de corte repartida en **15 · 20 · 25 · 30** (tres
decenas para un sector) mientras la costura si respetaba el criterio con **50 · 51**.
Quedo **20 · 21 · 22 · 23**. Las decenas que se liberan quedan libres — no se rellenan.

| Sector | Decena | Ejemplo del 154 Rev.B |
|---|---|---|
| Recepcion | 10 | 10 recepcion |
| Mesa de corte | 20 | 20 preparacion · 21 cortar · 22 control mylar · 23 WIP |
| Costura | 50 | 50 costura CNC · 51 WIP |
| Troquelado | 60 | 60 troquelado · 61 WIP |
| Inyeccion | 70 | 70 inyeccion · 71 control de pieza inyectada · 72 WIP |
| Prearmado | 80 | 80 prearmado · 81 WIP |
| Adhesivado | 90 | 90 adhesivado · 91 inspeccion · 92 WIP · **93 reproceso** |
| Tapizado | 100 | 100 tapizado · 101 virolado · 102 refilado post-tapizado |
| Control final | 110 | 110 control final · 111 clasificacion y segregacion |
| Embalaje | 120 | 120 embalaje |

El **almacenamiento WIP de un sector lleva el numero de ese sector**, no una decena propia.
El mismo criterio manda sobre el reproceso: el reproceso de adhesivado es **93**, no 103 —
un 103 al lado de un 101 VIROLADO y un 102 REFILADO se lee como parte del tapizado.

⚠️ Convive con una convencion mas vieja (**centena + unidad**: 101, 102, 131) que viene de
la era del modulo PFD. Cuando la decena del sector alcanza, gana la decena del sector,
porque es la que deja leer a que sector pertenece el paso.

### 1.2 Un paso de proceso tiene su numero propio

Un control que hoy vive **adentro** de otra operacion —como paso de una HO o como work
element de medicion de un AMFE— y que en el proceso real es una parada con su criterio,
sale como operacion con numero propio. Fak, 08/09/2026, sobre el control de pieza
inyectada: *"¿que carajo deberia ser un paso de proceso eso, no? o sea con su numero
propio, eso pienso"*. Precedente: la OP 51 del flujograma 153.

### 1.3 Colisiones

Antes de emitir, cotejar **flujograma · AMFE · Plan de Control · HO** operacion por
operacion y mirar las **colisiones** (mismo numero, distinta operacion). Lo mide
`node scripts/_verificarNumeracion.mjs` contra
`scripts/_lib/numeracionPatagonia.data.json`, que hay que actualizar en la misma tanda
(`secuencia`, `secuenciaConfirmadaPor`, `nota`, `fuente`).

⚠️ En el **Armrest** se hizo al reves: el 153 Rev.B se alineo a la HO-971 y quedaron **11
colisiones abiertas** entre flujograma, AMFE y Plan de Control. No repetirlo.

### 1.4 Una operacion se saca cuando dos documentos la desmienten, no porque suene rara

Sacar un paso es cambiar el proceso. Fak dijo *"esa pieza no se refila mas me parece"* del
refilado pre-costura del Insert: eso sola no alcanza — lo que lo cerro fue que **la HO-215
no tiene ningun refilado antes de la costura** (su OP 40 es del sector Tapizado) **y el
AMFE 158 tampoco declara una OP 40**. Al reves tambien: antes de declarar que una operacion
"no la respalda nadie", **abrir la hoja de operaciones** — el 18/08 quedo escrito que la
OP 105 REFILADO POST-TAPIZADO existia solo en el Plan de Control, y era la OP 40 de la HO.

---

## 2. Las convenciones de dibujo (validadas por Fak)

- **Retrabajo = DOS rombos separados**, nunca uno solo que mezcle conformidad y retrabajo:
  `¿CONFORME?` y, solo por el NO, `¿SE PUEDE RETRABAJAR?`.
- **SCRAP como terminal LATERAL**, caja roja al costado, jamas un paso del flujo principal.
- **Nada de texto debajo de un terminal**: *"al scrap no hace falta aclararle nada"*. El
  detalle tecnico va al Plan de Control o al procedimiento, no al dibujo.
- El **traslado de vuelta al flujo** va separado del paso de reproceso, con su rotulo
  `REVERIFICAR (A OP. XX)`.
- **Conector circulo-letra** (A, B, C...) para la materia prima que entra en una operacion
  intermedia: circulo a la salida del WIP de MP y `VIENE DE (A)` en la operacion que la
  consume. Si entra en la operacion inmediata siguiente, flecha directa.
- Diagrama minimo: texto que repite lo que la figura ya dice, afuera.

---

## 3. Como se hace

```bash
node scripts/_flujograma.mjs --lista        # que claves hay
node scripts/_flujograma.mjs 154-INSERT     # uno
node scripts/_flujograma.mjs --todos        # la tanda entera
node scripts/_flujograma.mjs 154-INSERT --out <carpeta>
```

Datos en `tools/flowchart/data/<clave>.json`. El motor (`tools/flowchart/Flowchart.jsx` +
`entry.jsx`) lo bundlea esbuild, lo abre Chromium headless por Playwright y captura
`#pdf-content` a PNG. **Del generador sale el DIBUJO, no el contenido**: no agrega pasos.

### Contrato de datos

```js
header   = { title, documentCode, revision, date, revisionDate, preparedBy, reviewedBy,
             project, client, productsColumns }
products = [{ code, level, description, version }]
revisions= [{ rev, date, item, details, pswDate, modifiedBy }]
flow     = [{ stepId, type, description, labelCondition, labelDown, branchSide, branches,
              rework, incomingConnector, critical, criticalType, criticalColor }]
// type: operation | op-ins | transfer | storage | inspection | condition | terminal | connector
```

Se acostumbra dejar en el JSON claves `_doc`, `_cambio_revX`, `_nota_*` con la fuente de
cada decision: el JSON es donde queda escrito **por que** el flujograma dice lo que dice.

### Trampas del motor

1. **Un rombo dentro de `branchSide` va envuelto en `branchSide.sequence: [...]`.** Suelto,
   superpone los textos y no lo dibuja.
2. **`branches` acepta N columnas y se puede ANIDAR** — un nodo dentro de una rama puede
   llevar su propio `branches`. Asi se dibuja una **convergencia en dos etapas** (inyeccion
   se junta con espuma en el 80, y recien despues con costura en el 90), porque
   `BranchSplit` converge todas las ramas de un split de forma uniforme.
3. 🔴 **`tools/flowchart/tailwind.css` es un CSS PRE-COMPILADO que vive en el repo y NO se
   regenera en el build.** Una clase de Tailwind que no este en ese archivo **no existe**:
   el estilo queda en `auto` y el cambio no pasa nada — sin error, sin aviso. Paso el
   08/09/2026 con un `top-[13px]` que parecia aplicado y no lo estaba. Para un valor nuevo:
   **estilo inline** (`style={{ top: '13px' }}`), como ya lo hace el ancho de la rama lateral.
4. El layout lo calcula **flexbox de Chromium**, no el codigo. No hay forma de predecirlo
   leyendo el JSX: se mira el PNG.

---

## 4. Como se revisa — se mira el PNG, recortado y al 100%

**El entregable es el PNG/PDF renderizado, no el JSON ni el preview.** Y no alcanza con la
vista general: un numero montado sobre una linea o un conector tapado no se ven al 13% de
escala. Se recorta la zona **a resolucion completa** y se mira.

Zonas que ya fallaron y hay que mirar siempre:

- [ ] **Los numeros dentro de los triangulos WIP** — que esten en la banda ancha de arriba,
      sin tocar el borde superior ni los lados. (Geometria: el svg mide 40 px en una caja de
      48, escala 0,833; el borde de arriba cae a 10,7 px del tope y el vertice a 37,3.)
- [ ] **Los conectores y terminales laterales de un nodo CON descripcion** — la rama sale por
      encima del texto, y la descripcion pinta fondo blanco en `z-10` mientras la rama va en
      `-z-10`: si la linea es corta, el texto **tapa la figura**.
- [ ] Que las ramas converjan donde corresponde y los rombos no se pisen.
- [ ] Que el SCRAP quede lateral y sin texto debajo.
- [ ] Que la numeracion se lea por sector de arriba abajo, sin saltos de criterio.

El script ya chequea solo los **margenes** (que nada quede cortado) y lo reporta al final de
cada corrida. Eso no dice nada del contenido.

---

## 5. El documento y la entrega

Formulario oficial **I-IN-002/III**. El **numero del flujograma va en el NOMBRE DEL
ARCHIVO** (`FLUJOGRAMA_154-INSERT.pdf`), no en el cajetin: el campo "CODIGO DEL DOCUMENTO"
lleva el codigo del formulario. `FECHA DE EMISION` y `FECHA DE REVISION` son **dos campos
distintos**. **No existen** los campos "APROBADO POR" ni "RESPONSABLE DE AREA".

La **revision solo sube en un hito oficial** (prelanzamiento / PPAP / ECN) y la fila de
revisiones dice **textual que cambio**, operacion por operacion.

Entrega:

1. PNG → PDF a **150 DPI** (`pagina_pt = px * 72 / 150`), que es la convencion de los
   documentos hermanos del legajo. Con `fitz`: `new_page(w_pt, h_pt)` + `insert_image`.
2. El PDF va a la carpeta del legajo por tipo — para un PPAP, el casillero
   **`20- Flujograma de proceso`**. Ver `reference_donde_se_archiva_cada_entregable`.
3. Actualizar el **listado maestro** de Gestion Ingenieria
   (`8. Flujograma Sinóptico (I-IN-002III)\1. LISTADO DE FLUJOGRAMAS\Listado_Maestro_FLUJOGRMAS.xlsx`):
   columna M revision, N fecha. Tiene tablas y formulas — se edita por **Excel COM**, no con
   openpyxl. Antes de escribir, verificar que la fila es la del producto correcto.
4. Actualizar `scripts/_lib/numeracionPatagonia.data.json` y correr
   `node scripts/_verificarNumeracion.mjs`.

## Anti-patrones

❌ Juzgar el flujograma por el JSON o por la vista general del PNG.
❌ Alinear el flujograma a la HO. La HO es la que se renumera.
❌ Meter dos sectores en una decena, o un sector en tres.
❌ Agregar una operacion o un control que ningun documento ni Fak respalda.
❌ Asignar CC/SC. Las asigna Fak o el cliente (`core-prohibiciones.md` §2); en un flujograma
   nuevo se transcriben las que ya traia la revision anterior, sobre las mismas operaciones.
❌ Agregar una clase Tailwind nueva al JSX esperando que aplique.
