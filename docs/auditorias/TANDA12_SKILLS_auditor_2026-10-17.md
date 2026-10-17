# Auditoría de la tanda 12: las skills de entregable, una por una (17/10/2026)

**3 Importante, 5 Nit (3 con detalle y 2 contados), 1 Preexistente.** No hay nada que rompa el build ni los tests. Los
tres Importantes son: una afirmación falsa sobre lo que frena el validador, que quedó en la skill, en el test y en el
informe; un gate del plotter que da verde con una hoja mal armada; y la traba de BeOn, que dice «traba puesta» aunque no
haya trabado nada.

- Alcance: `main...ea561836`, los 11 commits de la rama `claude/skills-1017` (merge-base `411f200f`), en el worktree
  `.claude/worktrees/skills-1017`. Sin push, como se pidió.
- No toqué ningún archivo del repo, de Supabase, de Y:, de Outlook ni del arb. Todo lo que corrí escribió en el
  scratchpad de la sesión.
- **A mitad de la auditoría entró el commit `aefa34a7` (07:35:58)**. Lo hizo la sesión madre después del revisor-pedido.
  Va aparte, en la sección final. Las líneas de este informe se refieren a `ea561836`, salvo donde se aclara otra cosa.

## Checks

| Check | Estado | Detalle |
|---|---|---|
| TypeScript | OK | `npx tsc --noEmit` en el worktree: 0 errores |
| Tests nuevos y tocados | OK | `npx vitest run` de caratulaVacia, planControlLimpio, flujogramaCanon, beonTraba, skillsAmfeEjemplos y evalBanco: 6 archivos, 69 tests en verde |
| Tests vecinos | OK | flujogramaDatos, firmaIAGuard (3 archivos), firmaIASelftest y los del export oficial del AMFE: 7 archivos, 287 tests en verde |
| Selftest Python | OK | `python scripts/_planControlLimpio.py --selftest`: 12 de 12 ok, sale con 0 |
| ESLint | OK | eslint del principal sobre `traba.js`, `caratulaVacia.mjs`, `flujogramaCanon.mjs`, los tests nuevos y `_exportAmfeOficial.ts`: sale con 0 |
| CI | No aplica | La rama no se pushea. `candado.yml` instala Python 3.12 y openpyxl 3.1.5 (líneas 71 a 82), así que el selftest del plan de control corre ahí |
| Build | No corrido | El diff no toca ningún archivo del bundle: solo `.claude/`, `__tests__/`, `docs/`, `evals/` y `scripts/`. `flujogramaCanon.mjs` ahora importa `node:fs`, pero solo lo importan `scripts/_flujograma.mjs` y su test, y `node scripts/_flujograma.mjs --lista` anda |
| Git | OK con aviso | 11 commits sobre main. A las 07:34 aparecieron cambios sin commitear de la sesión madre, que se commitearon en `aefa34a7` (ver al final) |
| Frontmatter | OK | Las 9 descriptions están en un renglón. Ninguna es más larga que en main. `claude plugin validate .claude --strict` da verde |
| §9, sin firma de IA | OK | La rama no produce documentos de Barack. El DXF que escribe `acomodar_columnas.py` no dice Claude y `_sinFirmaIA.py` da 0. Trae la metadata `ezdxf`, igual que el DXF real del 15/10: es de antes |

## Hallazgos Importantes

- [Importante] TRUE BUG · `.claude/skills/amfe-domain/SKILL.md:18` (también `__tests__/scripts/skillsAmfeEjemplos.test.mjs:5-7`, la fila amfe-domain del informe en `docs/evals/TANDA12_SKILLS_2026-10-17.md:35` y el mensaje del commit `3e9823d6`) — dicen que `ENGLISH_RANDOM_TERMS` frena «S&R», y no es así: `scanForbidden('ausencia de S&R').forbidden` da `[]`, porque «s&r» no está en la lista (`core/amfe/forbiddenContent.data.json:40-57`); el test nuevo solo prueba «gap & flush» (línea 58), así que «S&R» puede volver a los ejemplos «Bien» de la skill sin que nada se ponga en rojo · respuesta: ____
  - Por qué importa: la próxima sesión que lea la skill va a creer que el validador frena «S&R» en un AMFE. Hoy no lo
    frena. Cambiar el ejemplo por «ruidos» está bien: es la traducción que decidió Fak para squeak & rattle (`_english`,
    línea 4 del mismo JSON). Lo que está mal es la frase que dice qué frena el gate.
  - Arreglo posible: corregir la frase en los tres lugares («S&R no está en la lista; se cambió por la traducción de
    Fak»). Sumar «s&r» a la lista es otra cosa: es un control nuevo y va medido contra los AMFE vivos (ver Preexistente).

- [Importante] ROBUSTNESS · `.claude/skills/plotter-aol/scripts/acomodar_columnas.py:11-20` y `:55-57` — el gate nuevo solo mira si el origen trae entidades que no son LWPOLYLINE; una polilínea cerrada de más (un agujero dibujado como polilínea, un marco) pisa sin aviso `pz[(tipo, mano)]` en la línea 20, y la relectura cuenta los 2N contornos que el script escribió, no las 4 piezas distintas del origen, así que la hoja mal armada sale en verde · respuesta: ____
  - Caso medido. Al DXF real `exports/INSERT_OREJITA_COSTURA_20261015/INSERT PATAGONIA - 4 PIEZAS ... 2026-10-15.dxf` le
    agregué un cuadrado cerrado de 10 × 10 mm adentro de la delantera derecha. La salida fue al scratchpad.
  - Con DEL: «guardado (releido: 10 contornos, separacion minima 25.00 mm)», sale con 0 y el agujero se perdió.
  - Con TRA: «TRA: 10 piezas, hoja 652.1 ... 25.00 mm», sale con 0. La columna izquierda quedó hecha de 5 cuadrados
    de 10 mm: el cuadrado pisó `("TRA","IZQ")`. Con el origen sano la hoja mide 1293,1 mm.
  - Con un CIRCLE, en cambio, frena bien: «ABORTADO: el origen trae CIRCLE», sale con 1.
  - La skill (§5 y la línea 52) pide que un agujero sea un CIRCLE. Pero el gate nació para «lo que falta no se ve», y
    un DXF de otra fuente puede traer el agujero como polilínea. Arreglo: exigir exactamente 4 LWPOLYLINE y 4 claves
    distintas antes de armar la hoja. El selftest que entró en `aefa34a7` no tiene este caso.

- [Importante] ROBUSTNESS · `.claude/skills/beon/traba.js:17-30` — si en la página no existen `formSubmit` ni `formSubmit2` (un marco equivocado, la página a medio cargar o funciones que se definen después), la traba no envuelve nada y devuelve igual «traba puesta», y la skill (`beon/SKILL.md:219`) manda leer ese texto como confirmación: es un control que falla abierto en silencio (REVIEW.md, punto 9) en el portal donde «Emision de Informe» vale como firma · respuesta: ____
  - Caso medido, con el archivo de la rama sobre ventanas simuladas:
    - Una ventana con solo `confirm` devuelve «traba puesta» y `typeof w.formSubmit` da `undefined`.
    - Si `formSubmit` se define después de pegar la traba, `formSubmit('sendReport')` corre.
  - `beonTraba.test.mjs` no tiene un caso sin esas funciones. Arreglo: si no envolvió ninguna, devolver algo como
    «SIN TRABA: no encontre formSubmit/formSubmit2» y sumar ese caso al test.

## Nits (tope de 3; los otros 2 se cuentan abajo)

- [Nit] ROBUSTNESS · `scripts/_lib/flujogramaCanon.mjs:25` y `:34` — el comentario pone como ejemplo la Rev.B real del 160, y ese texto real da 0 avisos: en `git show 58f2fa33^:tools/flowchart/data/160-UPPER-TRIM-PANEL.json` la fila dice «OP 32 SE INTEGRA A LA OP 31 (REPASO DE ADHESIVO). OP 71 Y 72 PASAN A LA OP 70…», sin la palabra reproceso; el caso AVISO del test (`flujogramaCanon.test.mjs:229`) es ese mismo texto con «(REPROCESOS)» agregado; y como el patrón no exige inicio de palabra, también avisa de más con «INTEGRIDAD», «INTEGRAL» y «PASACABLES» · respuesta: ____
  - La skill lo dice bien: `flujogramas/SKILL.md`, §5, «no ve una integracion que no nombra la palabra reproceso».
    El informe de `aefa34a7` dice lo contrario: «las frases de la Rev.B del 160 si», en su línea 107.
  - Avisos de más medidos: «SE AGREGA CONTROL DE INTEGRIDAD DE COSTURA EN EL REPROCESO (63).», «SE AGREGA REPROCESO DE
    INSPECCION INTEGRAL (95).» y «SE AGREGA PASACABLES; REPROCESO DE COSTURA (63).». Es solo un aviso: no frena nada.

- [Nit] ROBUSTNESS · `scripts/_planControlLimpio.py:34`, `:74`, `:84-85`, `:88-90` — tres bordes que dan verde o se quedan en aviso; los planes reales `.xls` los lee bien · respuesta: ____
  - En un `.xlsx`, el amarillo con color indexado (`Color(indexed=13)`) o el amarillo claro `FFFF99` no salen como
    AMARILLO con `--rearmado`: sale con 0. El camino `.xls` sí resuelve el índice.
  - El encabezado es la primera celda que dice «CLASIF» en orden de lectura. Una leyenda «CLASIFICACION: D = critica»
    en A1 corre la columna, y un `D/TLD` en G7 da verde.
  - «SC/CC» en una sola celda queda como SIGLA_RARA, que es aviso, y no como VARIAS_MARCAS.
  - Sobre los dos planes del 15/10 reproduje lo que dice el informe:
    - La Rev 0 con correcciones da 33 D_TLD y 18 VARIAS_MARCAS, y sale con 1.
    - La propuesta da 3 ROJO por «D\nD» en la fila 3.0 «Flamabilidad y emisiones del conjunto»: `PC CENTRAL !G202`,
      `PC LATERAL )!G201` y `PC DELANTERO!G201`.

- [Nit] Método · `docs/evals/TANDA12_SKILLS_2026-10-17.md:7-10` y la tabla «Por skill» — dos «antes» no son la skill de main y dos «después» corrieron antes de la última escritura de la description; no cambia ninguna conclusión, porque ningún caso del banco prueba esas partes, pero la tabla los presenta como antes y después del cambio · respuesta: ____
  - Las horas salen del `.jsonl` de la sesión `304d8b4b`:
    - amfe-domain: el §1 se editó a las 06:36:22 y su «antes» se lanzó a las 06:39:54.
    - pieza-nueva: la fila de TOPE_PALABRAS se editó a las 06:38:35 y su «antes» se lanzó a las 06:39:54.
    - flujogramas: el banco «después» se lanzó a las 06:35:09 y la description se tocó a las 06:37:24.
    - amfe-cookbook: el banco «después» se lanzó a las 06:42:46 y la description se tocó a las 06:44:50.
  - La prueba de disparo «después» (06:52-06:53) sí corrió contra el texto commiteado en `ea561836`.

**Y 2 nits más, que se cuentan sin detalle:**

1. `scripts/_exportAmfeOficial.ts:238-244`: con el FALLO de la carátula, el `.xlsx` queda en la carpeta con el nombre
   final. Pasa lo mismo con los FALLO de la línea 229 en adelante, que son de antes. En cambio, el paso 1 (línea 192)
   pide que el archivo falte cuando la generación falla.
2. `evals/banco/flujogramas/no-se-alinea-a-la-ho/graders/criterio.md:10`: la frase se contradice. Marca como INCORRECTA
   la respuesta que «propone cambiar la HO sin decir que eso se hace con el OK de Fak» y en el mismo renglón agrega «si
   lo dice, mejor, pero no es obligatorio». El juez puede ir para cualquiera de los dos lados.

## Preexistente

- [Preexistente] `core/amfe/forbiddenContent.data.json:40-57` — `ENGLISH_RANDOM_TERMS` no tiene «s&r» aunque el `_english` del mismo archivo (línea 4) fija squeak & rattle → ruidos y `scripts/_auditStructureV2.mjs:112` sí lo lista; scripts archivados escribieron «sin ruidos S&R» en el FEF del IP PAD (`scripts/_archive/fixIpPadFocusAndMaterial.mjs:25`). Cuántos AMFE vivos lo tienen no lo medí: esta auditoría no lee Supabase · respuesta: ____

## Descartados: lo revisé y no es falla

- **Las «deleciones» en `docs/COLA_CAMBIOS_CODIGO.md` y `docs/LECCIONES_APRENDIDAS.md`.** Aparecen en el
  `git diff main..HEAD` de dos puntos porque main avanzó después del merge-base (`67749aa3` y `2ef847b1`). Con
  `main...HEAD` no aparecen: la rama no las tocó.
- **La description de hojas-de-proceso con «Canon: `...`».** No pasa el YAML estricto (`BLOCK_AS_IMPLICIT_KEY`). Lo
  probé con `claude -p` en una carpeta del scratchpad: una skill con «... Canon: `docs/X.md`.» aparece completa en la
  lista. Además, en main ya hay tres así: amfe-export-oficial, explicar-mejor y rule-enforcement-gate. El validador
  solo no alcanzaba como prueba, porque también deja pasar `description: [roto`.
- **El informe dice 4.811 → 4.020 y yo medí 4.807 → 4.016.** La diferencia son las comillas de plotter-aol y beon,
  que el informe cuenta (2 + 2). La resta, −791, da igual por los dos caminos.
- **El test de la traba corre el archivo sin los comentarios.** javascript_tool evalúa como un script que devuelve el
  último valor: en la sesión `03292ba3` del 23/09, `const t=...; [ ... ]` devolvió el arreglo y `await` arriba de
  todo anduvo. Un eval indirecto del archivo entero, con los comentarios, devuelve «traba puesta» y traba `save`. Pegarlo
  tal cual anda.
- **`buttonConfirm` y `buttonConfirmOk` no son inventados.** Están en `beon/SKILL.md` de main, líneas 150 y 151
  (§7, borrar un anexo).
- **«Juez no confiable» en el caso del mail de pieza-nueva.** En
  `evals/results/banco-pieza-nueva-flujograma-amfe-2026-10-17-despues.json`, la respuesta con la skill no manda el
  mail, avisa que Carlos y Manuel tienen que ir en copia y propone el mail corto. Cumple los 3 puntos del criterio y el
  juez votó FAIL ×3. Lo que dice el informe se sostiene.
- **El criterio del caso «pieza nueva desde hermanos», que se corrigió.** En `...flujogramas-...-despues-1.json` el
  criterio pedía «su retrabajo», y `flujogramas/SKILL.md:303` manda preguntar. El FAIL era falso y la corrección está
  justificada.

## El informe de la tanda, número por número (contra `ea561836`)

| Qué dice | Fuente | Estado |
|---|---|---|
| Renglones de las 9 skills (394→394 … 241→248) | `git show main:` y HEAD | Coinciden los 9 |
| Descriptions (746→603, 632→539, 424→408, 379→375, 490→434, 326→308, 431→392, 720→554, 663→407) | Renglón crudo, comillas incluidas | Coinciden las 9. Ninguna es más larga que en main |
| Banco con/sin, después y antes, las 9 filas | `docs/evals/banco-*-antes.md` y `-despues.md` | Coinciden todas |
| Disparo acertó/faltante/de más, las 9 filas; global 49/49 → 49/48; arb-operar 5 y 6 → 9 y 7; apqp-legajo 2 y 2 → 3 y 4; explicar-mejor 32 y 32 → 31 y 35 | `.sgc-cache/api/disparo-skills/tanda12-{base-a,base-b,despues-a,despues-b}/2026-10-17.md` | Coinciden todos |
| Tope de la lista de skills: `SLASH_COMMAND_TOOL_CHAR_BUDGET`, 1 % × 4 × 200.000 ≈ 8.000 | Binario `~/.local/bin/claude.exe` | Confirmado: `Pur=0.01`, `Vun=4`, `Mur=200000`. Además, `skillListingMaxDescChars` vale 1536 por defecto |
| El 17/10 quedaban sin description beon, planes-de-control, informe-tryout, injection-process, lamina-de-proceso, novedades-claude y render-a-foto-real | `skill_listing` del `.jsonl` de la madre, 09:05 UTC | Confirmado: las 7 figuran solo con el nombre |
| Plan de control: Rev 0 con 33 D/TLD y 18 celdas con varias marcas; propuesta con 3 ROJO | Corrido sobre los `.xls` del 15/10 | Confirmado |
| Carátula: 9 de 9 AMFE exportados llenos | `rotulosVacios` sobre los 9 `.xlsx` de `exports/` | Confirmado |
| Plotter: 1380,4 × 1187,1 y 1293,1 × 1284,6, con 25,00 mm | Corrido sobre el DXF del 15/10 | Confirmado. «Con un agujero agregado, frena» vale para un CIRCLE, no para una polilínea (Importante 2) |
| historial-confiesa: 0 avisos en los 9 flujogramas del generador | Test y `tools/flowchart/data`, que tiene 9 | Confirmado |

## Las skills: de dónde sale cada agregado

Lo agregado tiene fuente en todos los casos, salvo la frase de «S&R» (Importante 1):

- hojas-de-proceso: los códigos de `enforcement.md` existen en `_revisarPaqueteHO.py` (ARMADO_DISTINTO, CICLO_LLENO,
  PIEZA_SIN_ACLARAR, CANTIDAD_ILEGIBLE).
- planes-de-control: §5, puntos 3 a 6, y LECCIONES 15/10.
- flujogramas: LECCIONES 09/10, línea 94.
- amfe-domain: los 4 roles salen de `amfe.md:207`, el reparto de `healingEngine.mjs:50-52` y las traducciones de
  `_english`.
- amfe-cookbook: la memoria `feedback_al_documento_entra_lo_que_dice_un_papel_de_esa_pieza`, con la cita de Fak del 02/10.
- pieza-nueva: `TOPE_PALABRAS` y la medición 172/173/174, en `amfeAutoria.mjs:158-163`.
- plotter-aol: la regla de las columnas del 15/10, que ya estaba en la skill.
- beon: lo que ya decía el §10 de main, más `buttonConfirm`, que sale del §7 de main.

Ninguna cambia lo que la skill dice del proceso de Barack.

## Los casos del banco contra la skill

Revisé los 23 casos nuevos. Son 24 si se cuenta `evals/export-amfe-dispara`, que ya existía y entra al banco de
amfe-export-oficial.

- **Coinciden con la skill o con la regla que citan:** hojas-de-proceso (3), planes-de-control (3), flujogramas (3),
  amfe-export-oficial (2), amfe-domain (2), amfe-cookbook (2), pieza-nueva (3), plotter-aol (3) y beon (2).
- **Números que verifiqué en la skill:** S=5 del aspecto en zona vista y O=7 del control de conducta (pieza-nueva,
  líneas 165 y 167); los 0,5-1 mm en el fieltro y el mail del 27/01 (plotter); Aceptar(4) y el BTV (beon, líneas 96 a
  103); placeholders confirmados el 21/04 y regla dura 7 (cookbook); casilleros de firma vacíos y Gonzalo Cal solo en
  `plantApproval` (export, líneas 50 a 63).
- **El único problema** es el criterio que se contradice en «no se alinea a la HO» (Nit contado número 2).

## Lo que entró a mitad de la auditoría: `aefa34a7` (07:35:58, «lo que marcó el revisor-pedido»)

- **`acomodar_columnas_selftest.py`.** Lo corrí: 4 casos, 0 fallan. Escribe solo en un temporal. No cubre la polilínea
  de más (Importante 2), y no hay forma de hacer rojo el gate de relectura sin tocar el script.
- **Descriptions.** Medidas sobre el HEAD nuevo:
  - export pasa de 375 a 354, beon de 407 a 389 y cookbook de 308 a 314.
  - Las tres siguen por debajo de main (379, 663 y 326).
  - El total queda en 4.811 → 3.987 (−824, −17 %), como dice el informe nuevo.
  - Las descriptions del repo suman 13.952 caracteres, cerca de los «~14.000» del informe.
  - La prueba de disparo «después» se midió antes de este cambio: no mide estas tres descriptions.
- **Dos cosas del informe nuevo que no cierran:**
  - La fila plotter-aol sigue diciendo «296 → 300» renglones y el archivo ahora tiene 302.
  - La línea 107 dice que las frases de la Rev.B del 160 sí avisan, y el texto real no avisa (Nit 1).
- **planes-de-control.** «propuesta limpia» pasó a «propuesta rearmada». Es solo el texto.
- **Sobre esta punta (`aefa34a7`) los tests siguen en verde.** Los 6 archivos de vitest de la tabla de checks dan 69 de
  69 y el `--selftest` del plan de control da «todo verde». `aefa34a7` no toca ninguna entrada de esos tests.

## Lo que no verifiqué

- Cuántos AMFE vivos tienen «S&R», y cuántos headers vivos dejarían en FALLO el gate de la carátula: las dos cosas piden
  leer Supabase, y esta auditoría no lo toca.
- La traba de BeOn en el portal real: sin acceso, igual que en la tanda.
- `npm run build` y la suite completa: el cambio no toca el bundle (ver Checks).
