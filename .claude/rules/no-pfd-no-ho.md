# Flujogramas SI (desde 18/08/2026, con el generador del repo) · HO solo a pedido · el MODULO de la app sigue muerto

## 🔴 Cambio del 18/08/2026 — los flujogramas los hago YO

Fak, textual: *"vos sos el que hace los flujogramas ahora, te lo habia dicho ya"*, *"te pase el
codigo de los flujogramas... ahora vos debes integrarlo y testearlo"*, *"no necesito prompts,
vos mismo los corregis"*, *"si, corregi todas las reglas porque si los vas a hacer vos al final".*

Es la **segunda vez** que lo pide. La primera no la tome y le devolvi un prompt para que los
dibujara el — mal. **No volver a ofrecer un prompt de flujograma: hacerlo.**

**Como se hacen:** `node scripts/_flujograma.mjs --lista` para ver cuales hay,
`node scripts/_flujograma.mjs <clave>` para uno, `--todos` para la tanda entera, y
`--out <carpeta>` para elegir el destino (por defecto `tools/flowchart/.build/`).
No lleva `--apply`: genera un PNG, no escribe en Supabase ni en el servidor. Motor en
`tools/flowchart/` (extraido del generador de Claude Design), datos en
`tools/flowchart/data/*.json`, render con Playwright + Chromium headless -> PNG.
Detalle del contrato de datos: memoria `flujogramas_barack_numeracion`.

**Lo que NO cambio:** el **modulo PFD de la app** sigue podado y no se resucita (decision
2026-05-17, sigue vigente). Los flujogramas no son una pantalla del software: son un
entregable que se genera por script. `pfd_documents` en Supabase queda como referencia
historica de solo lectura.

## Hojas de operaciones (HO) — a pedido explicito, nunca por cuenta propia

- Decision original 2026-05-22: *"las hago yo manuales"*. **Aclarado 2026-08-13** (HO-986 APB
  Trasero Central): cuando Fak lo pide, las HO **si se arman aca** — en Excel, sobre el
  formulario oficial del SGC `I-IN-002.4-R01`, una pestaña por operacion. Ya paso con la
  HO 118 (05/06) y la HO-985 IP PAD (02/07). Lo prohibido sigue siendo **ofrecerlas por
  cuenta propia**. Enforcement: hook `ho-numeracion-guard.sh`.
- Los pasos de una HO son instruccion de planta: sin documento fuente van **TBD**. No se
  redactan por analogia con otra pieza "parecida" (`core-prohibiciones` §1). El listado
  maestro (`3- LISTADO\Listado hojas de proceso.xlsx` + hoja oculta `_CONTEXTO_CLAUDE`) manda
  la numeracion de HO y se actualiza en la misma tanda.
- `ho_documents` y `hoRepository`: referencia historica, capa de lectura. Los tipos
  (`pfdTypes.ts`, `hojaOperacionesTypes.ts`) quedan para leer historicos.

## La numeracion la manda el FLUJOGRAMA

Orden APQP: **flujograma → AMFE → Plan de Control**. Antes de armar una HO o alinear un AMFE,
cotejar las tres fuentes operacion por operacion; si no cierran, reportar la tabla de
divergencias y numerar contra el flujograma.

Mirar las **COLISIONES** (mismo numero, distinta operacion): en el APB Trasero Central el 80
era "reproceso" en el flujograma y "test de lay out" en el Plan de Control, y los dos
documentos iban al BeOn.

Enforcement: `node scripts/_verificarNumeracion.mjs` compara los AMFE de Supabase live contra
la secuencia del flujograma (esperados en `scripts/_lib/numeracionPatagonia.data.json`).

## Relacion AMFE ↔ HO (para entender)

El AMFE de PRODUCTO se alinea con la HO oficial de Fak (numeracion real). El AMFE MAESTRO no
se alinea con HOs (aplica a muchas).

## Anti-patrones

❌ **Pasarle a Fak un prompt para que dibuje un flujograma** — los hago yo.
❌ Resucitar el modulo PFD dentro de la app.
❌ Ofrecer una HO por cuenta propia, o pedir datos para llenar sus campos.
❌ Inventar una operacion que ningun documento ni persona respalda: el 18/08 el generador
   agrego dos controles que nadie decidio. **Del generador sale el DIBUJO, no el contenido.**
