# Auditoria — tanda 1.5, hojas de proceso (EPP, revisor del PDF, skill) — 16/10/2026

Rama `claude/hojas-tanda15`, commits `85891255..59e4e4ff` (5): 7345ae89, 6e127ed9, 73fedf5a, b5de2ca9, 59e4e4ff.
Auditor final (Opus), solo lectura. No se tocó Supabase, Y:, Outlook ni mails; los PDF de `exports/` solo se leyeron
(las copias y recortes de prueba quedaron en la carpeta temporal de la sesión).

## Veredicto: APROBADO CON CONDICIONES

Lo pedido está hecho y probado en las dos direcciones. Corrí todo y está en verde: 66 tests de las cuatro suites (ninguno
salteado), los 5 selftests de Python, tsc con 0 errores y el build. Saqué cada chequeo nuevo de a uno y cada vez falló su
test en rojo, salvo el del ciclo copiado de otra hoja. Hay **dos TRUE BUG** de código:

1. **Condición dura (antes del merge):** `_imprimir.py` ya no imprime un AMFE (H1).
2. **Condición a decidir:** el nivel de `CICLO_LLENO` sale del tamaño del papel y no del formato (H2). Una HO de Excel
   en una página A3 da ROJO, cuando la decisión escrita dice AVISO para la HO de Excel.

También hay tres datos de texto que no se reproducen (D1 a D3) y que conviene corregir antes de que lleguen a Fak.

## Checks del protocolo

| Check | Estado | Detalle |
|---|---|---|
| TypeScript | OK | `npx tsc --noEmit` → 0 errores |
| Build | OK | `npm run build` → `✓ built in 47.85s` (solo el aviso de siempre: algunas partes del paquete pasan de 500 kB) |
| Git local | OK | `git status -s` vacío antes de este informe; ahora queda sin commitear este archivo (la memoria del auditor, en `.claude/agent-memory/`, está en `.gitignore`) |
| GitHub sync | OK (por diseño) | 5 commits sin pushear: el encargo dice "sin push". No es CRITICO. Main avanzó (9e6c36d9) sin tocar ninguno de los archivos de la tanda |
| CI | OK (main) | último run: `completed success main 9e6c36d9`. La rama no se ve porque no se pusheó |
| Dependencias | OK | `npm ls --depth=0` sin UNMET, ERR ni missing |
| Tests pedidos | OK | `npx vitest run revisarPaqueteHO hojasEppDeclarado tbdImpresion imprimirTemporal --pool=threads` → `Test Files 4 passed, Tests 66 passed`, 0 salteados; revisarPaqueteHO corrió sus 47 (busca `exports/` del checkout principal) |
| Tests de skills (por la partición) | OK | guardianes, disparoSkills, paqueteEquipo, paquetePersona, claudeAreaInstalar, mejorasPublicar → `6 passed, 367 passed` |
| Selftests Python | OK | gates_selftest 29/0 · gates_v3_selftest 28/0 · hoja_a3_fotos_selftest 23/0 · hojalib_selftest 38/0 · redaccion_selftest 71/0 |

## TRUE BUG

### H1 — `_imprimir.py` frena la impresión de un AMFE (regresión, bloquea el merge)

El commit 73fedf5a y el docstring de `exigir_sin_rojos()` dicen: *"Un PDF sin ninguna hoja de proceso (flujograma, AMFE)
pasa sin revisar"*. El test lo prueba solo con un flujograma.

- Evidencia:
  ```
  python scripts/_imprimir.py "exports/RECLAMO_AGUJAS_PWA_20261009/AMFE 157 - TELAS_HILUX - Rev.A.pdf" --a3 --seco
  → REVISOR DE HOJAS: 9 defecto(s) ROJO ...; no se puede imprimir  (PORTADA, PALABRA_PROHIBIDA "PRELIMINAR",
    CORTADA, SIN_HO, LOGO_VIEJO, PLAN_NO_ESTANDAR)   EXIT=1
  exigir_sin_rojos("exports/ARMREST_DP_SEMI_PU_20261005/revision/AMFE AMFE-ARM-PAT.pdf") → 23 ROJO, SystemExit(1)
  ```
- Causa: `Pagina._tipo()` (que ya estaba) marca como HO cualquier renglón que empiece con "Hoja de operaciones". En el
  AMFE 157, p.3, una celda de control dice "Hoja de operaciones del puesto". También marca como CAMINO cualquier página
  que contenga "camino de inspeccion" (AMFE-ARM-PAT p.9: "camino de inspeccion, 100%"). Con **una** página así,
  `exigir_sin_rojos` revisa el PDF entero, y las demás páginas del AMFE dan PORTADA y CORTADA en ROJO.
- Medido sobre otros PDF que no son hojas: los 3 planes de control de `PC_APC_PATAGONIA_20261015`, el AMFE 174 Rev.B, las
  BOM (67 páginas) y los flujogramas en partes (45) salen todos PORTADA y pasan. Fallan los dos AMFE de arriba.
- Consecuencia: para imprimir esos AMFE queda solo `--aunque-tenga-rojos`, que según su propia ayuda es "solo si Fak lo
  pidió para ese archivo".
- El arreglo lo decide la sesión principal. Por ejemplo: que el `_tipo` exija el sello o el cajetín del formulario
  y no un renglón suelto, o que la puerta mire solo las páginas HO o CAMINO. Lo que se elija, con su test en rojo
  (estos dos AMFE) y en verde.

### H2 — `CICLO_LLENO`: el nivel sale del papel, no del formato (contradice la decisión escrita)

El docstring de `chequear_ciclo` dice: ROJO en el A3 de una foto por paso (el formato de Ingeniería) y AVISO en la HO A4
de Excel, porque vaciarla "es una pregunta abierta a Fak". El código decide con `papel(p) == 'A3'`.

- Evidencia, con la misma plantilla de Excel (Form I-IN-002.4-R01, "HO - 971", G.Cal, 10/03/2026) en los dos tamaños:
  - `IMPRESION_0710_V3/3_HOJAS_DE_PROCESO_A4_v6.pdf`, página de 842x595: p.1 a p.9 → `CICLO_LLENO AVISO`.
  - `hojas-por-pieza-14-10/HO 971 - APB DE PUERTA - HOJAS DE PROCESO (todas).pdf`, todas las páginas de 1191x842: p.2,
    3, 4, 5, 6, 7, 8, 10, 17 y 18 (HO de Excel, ops 40 a 110) → `CICLO_LLENO ROJO`. Lo comprobé mirando la p.2
    renderizada. Las p.12 y 13 son de Pablo (A3 de Ingeniería) y ahí el ROJO sí corresponde.
- La pregunta abierta a Fak queda decidida por el tamaño de la página del PDF. El mismo hueco existe al revés: una hoja
  A4 del generador de la IMG (Ingeniería) con el ciclo lleno daría solo AVISO. Eso no apareció en lo medido.
- No hace que se marque de menos (marca de más), por eso no lo pongo como bloqueante. Hace falta discriminar por
  formato (la huella del armado ya separa el Excel del A3 de Ingeniería) o que Fak diga que vale ROJO para todo.

## Datos de texto que no se reproducen (TRUE, menores: texto, no código)

- **D1 — "100 de 114 páginas del paquete del 07/10 lo traen lleno"** (docstring de `chequear_ciclo`, línea 922, y la
  nota `PENDIENTE - barrido...md`). Medido con el mismo revisor sobre `3_HOJAS_DE_PROCESO_A4_v6.pdf`: **74** páginas con
  renglones escritos, 38 con el ciclo vacío (miré p.56 y p.72 renderizadas: vacías de verdad) y 2 sin el bloque
  (p.47 y 48). La decisión AVISO no cambia, pero el número no sale de ninguna medición del repo.
- **D2 — "14 rojos en 10 PDF"** (nota PENDIENTE, sobre `hojas-grampas-a3` + `hojas-gamboa-corregidas-14-10`). Medido:
  `--carpeta ... --carpeta ... --solo-rojo` → **6 ROJO en 4 PDF** (de 11). La lista que la nota manda a buscar "en el
  informe del auditor" está al final de este informe.
- **D3 — "captura del plan del viernes 17"** (sección de fuentes del borrador del mail). El 17/10/2026 es sábado y el
  viernes es el 16. No va en el cuerpo del mail. No lo pude confirmar contra la captura.

## ROBUSTNESS

- **R1 — El ciclo copiado de otra hoja no tiene test.** Saqué cada chequeo de a uno (copia en la carpeta temporal, con
  `REVISAR_PAQUETE_SCRIPT`). Cada uno de los nueve hace fallar su test en rojo; `chequear_ciclo_copiado` no:
  `Tests 28 passed`. El encargo pide "lleno con texto de otra hoja" con una hoja real en rojo y una en verde. Además
  agrupa 60 con 60.1 y 60.2 como "otra operación": hoy da AVISO en A4 (21 páginas de v6), pero en A3 sería ROJO.
- **R2 — El barrido pendiente cubre una parte chica del servidor.** `--carpeta` lista solo `.pdf`. En el catálogo
  local del servidor (`.sgc-cache/catalogo-servidor/DOCUMENTACION_SGC_20261001.tsv`, una foto del 01/10, no el estado
  de hoy), bajo HOJAS DE OPERACIONES y sin OBSOLETO ni HISTORICO, hay 174 `.xlsx`, 55 `.xls`, 14 `.pptx` y 38 `.pdf`.
  La nota promete "todas las hojas emitidas" y no avisa que las de Excel y PowerPoint no entran.
- **R3 — La regla de EPP de la HO-990 es más amplia que su cita.** Fak, 14/10: *"en **ese sector** no hace falta
  gafas"*. La regla marca ROJO los anteojos en **toda** página con HO 990, de cualquier sector. Desde el 01/10 el número
  es por pieza, así que la HO 990 junta recepción, corte, costura, inyección, espuma y embalaje. Hoy no hay ningún falso
  medido. Conviene que Fak confirme el alcance antes de que salga una hoja de la 990 con riesgo real en los ojos.
- **R4 — El reconocedor de iconos no ve juegos que no sean los de la casa.** HO-985 (v6 p.49) tiene anteojos en su
  recuadro (lo comprobé en el recorte) y `iconos_epp` devuelve `['?', '?']` (dos tiras de 4 iconos): no hay AVISO. La
  regla ROJA para la IMG sí funciona: en una copia de la OP 30 IMG con el icono de anteojos agregado da
  `ROJO lleva anteojos y en el sector IMG no se usan`. Esa rama no tiene caso en rojo en el test.
- **R5 — La referencia A4 del ARMADO no la aprobó Fak.** El encargo pide "la última hoja aprobada por Fak de ese tipo".
  El canon lo admite: *"no consta una aprobacion puntual de Fak de esa pagina"*. Además el verde `armado_verde_excel_a4`
  compara v6 p.1 contra su propia huella, así que no prueba nada. Hay verdes que sí prueban: v6 p.62 y las HO-971 de
  Excel en A3 (p.1 y 2 del PDF por pieza), que no invierten ninguna relación. El "tipo" es el tamaño de papel (mismo
  problema que H2).
- **R6 — `HERRAMENTAL_SIN_MARCAR` cuenta por página, no por paso.** El canon dice `minimo_en_un_paso: 3` y el docstring
  "un paso que lista 3 herramientas". El código junta todo el texto de la descripción. Todos los aciertos medidos son el
  mismo paso de 5 herramientas, sin falsos. Con 3 herramientas en pasos distintos daría ROJO de más. La tira se
  reconoce por "imagen ancha y blanca": el logo (77x38, proporción 2,0) no pasa por tira, pero cualquier imagen ancha
  sobre blanco sí pasaría.
- **R7 — `PLAN_DEL_PLAN_DE_CONTROL` mira debajo de la banda en todo el ancho.** En la HO de Excel A4 las celdas del ciclo
  quedan debajo de la banda del plan: un "P-14" en el ciclo daría ROJO. No hubo falsos en lo medido (v6, depurado, A3 v6
  y los PDF por pieza: los únicos aciertos son los 11 de la HO-990 Rev.A).
- **R8 — `CANTIDAD_ILEGIBLE` no ve:** `X4` (mayúscula), `Grampas ×4`, `Clip x 3`, `1x4` (probado con
  `cantidades_con_por`). Sí ve el caso de Fak (`×4`, `×3 + 4`, `(x4)`). Es una elección para no marcar "2 pisos × 15";
  lo dejo anotado.
- **R9 — Menores.** La evidencia de `CICLO_LLENO` muestra los 3 primeros renglones en el orden del PDF, no en el de
  lectura (HO 971 p.2 dice `"- | - | -"` y la hoja tiene características escritas). `EPP_HOTMELT` sigue definido sin uso
  en `generar_hojas_hotmelt.py:101`, y el test de "sin set por defecto" busca solo `EPP_STD`. La regla
  `hojas-proceso.md` 23 sigue diciendo que el control automático de la palabra rara "existe solo en el generador del hot
  melt", y la skill `imprimir` paso 3 dice "no el armado": los dos quedaron viejos con esta tanda. `_pdfPorPieza.py` va a
  salir con 1 mientras los caminos de Pablo sigan con "×": es lo esperado, pero conviene saberlo.
- **R10 — Lo que va a Fak sin imprimir no pasa por ningún control automático.** El commit 73fedf5a dice "sea de quien
  sea" y el encargo (3) pide "todo lo que sale a Fak". La puerta está solo en `_imprimir.py` y `_pdfPorPieza.py`. Un PDF
  que se le muestra a Fak, o que se sube al servidor, depende del renglón de §7 de la skill (texto, no control): no lo
  llaman los generadores ni los scripts de subida (`_subirHojasTopRollHotmelt.py` y `_reemplazarHotmeltServidor.py`,
  que son de una sola vez, del 01 y 02/10). No bloquea.

## FALSE POSITIVE / descartados (los miré y no son hallazgo)

- **Cambio de los tests VERDE viejos.** No es un afloje. Las A3 p.1, 2 y 4 dan **solo** `PIEZA_SIN_ACLARAR` (fusor,
  volante cromado, desbobinador, guiador: detecciones nuevas y reales) y ningún código viejo. Las A4 p.1 y 2 dan solo
  `CICLO_LLENO AVISO`, y p.3, 62 y 63 quedan en cero. La cobertura A3 pasó a `VERDES15` (11 páginas en cero). Se pierde
  un poco: las p.1, 2 y 4 ya no vigilan los chequeos viejos. Se podrían mantener filtrando el código nuevo.
- `HERRAMENTAL_SIN_MARCAR` en el HO-971 OP 93 "corregido" del 14/10: es real. No tiene tira (la única imagen ancha es el
  logo) y el paso nombra las 5 herramientas. El Top Roll OP 50 corregido sí tiene tira (438x69) y pasa.
- `epp=None` en `scripts/apc/_pcApcPatagonia.py`: es el inserto de **EPP** (polipropileno expandido) del plan de control,
  no protección personal.
- Commits sin pushear: el encargo dice sin push.

## Pieza 1 — EPP por defecto (verificado)

- `grep` de `EPP_STD`, `get("epp", ...)` y `setdefault("epp"` fuera de `scripts/img/_one-shots`: no queda ninguno. Las
  únicas apariciones son comentarios y el test. Quedan en `_one-shots/actualizar_deck.py` y
  `actualizar_hojas_multifoto.py`, fuera de alcance como pidió el encargo.
- `_gate_epp_declarado` corre antes de `add_slide` en los 7 caminos (img, insert, p21 via `g`, hotmelt A4, hotmelt A3,
  `hoja_a3_fotos` via `base`, `hoja_pptx`). `generar_hojas_img_a3` pasa `h.get("epp")` y frena en `hoja_a3_fotos`.
- Especificaciones: IMG 7/7 con epp, v3 17/17, cambio de molde 10/10, P21 14/14, embossing 7/7. `hojas_spec` (v2) tiene
  17 hojas **sin** epp, y el insert tampoco declara: frenan, como dice el commit y quiere el encargo.
- Test 13/13: en rojo cada generador frena antes de dibujar. En verde solo se prueba el gate suelto, no `hoja()` con epp
  (está dicho en el test).

## Pieza 2 — falsos positivos de los chequeos nuevos (`--json` sobre los PDF pedidos y carpetas recientes)

Cuatro corridas `--json`: **v6** = `IMPRESION_0710_V3/3_HOJAS_DE_PROCESO_A4_v6.pdf`; **A3 v6** = `4_HOJAS_DE_PROCESO_A3_v6.pdf`;
**por pieza** = los 3 PDF de `hojas-por-pieza-14-10`; **carpetas** = `--carpeta` sobre `hojas-img-a3`, `hojas-grampas-a3`,
`hojas-hotmelt-13-10`, `hojas-gamboa-corregidas-14-10`, `HO971_UNIFICADA` y `hojas-hotmelt-alarma53`. Conteos sacados con
`node -e` sobre los JSON (R = ROJO, A = AVISO).

| Código | Dónde dio | Mirado | Veredicto |
|---|---|---|---|
| CICLO_LLENO | v6: 95 A (74 páginas con renglones + 21 de ciclo copiado); A3 v6: 9 R (Pablo: HO-992 50/60, HO-971 93, HO-990 80, HO-986 40.1/40.2); por pieza: 27 R; carpetas: 4 R | v6 p.1 y 2, HO 971 p.2 renderizadas | Reales según canon 1.1/1.2; el nivel de las HO de Excel en A3 es H2 |
| PIEZA_SIN_ACLARAR | v6: 1 A; A3 v6: 5 R / 7 A; por pieza: 2 R / 8 A; carpetas: 7 R / 19 A | evidencias: fusor, volante cromado, acumulador(es), desbobinador, guiador, sonotrodo, expulsor(es), atemperador, enrollador | Reales (palabra sin paréntesis la primera vez); el recuadro en la foto no se mide |
| EPP_NO_DEL_SECTOR | por pieza (HO-990 Rev.A): 11 R | iconos reconocidos: `['ropa','calzado','guantes','anteojos','auditiva']` | Reales con la cita; alcance R3; falso negativo R4 |
| HERRAMENTAL_SIN_MARCAR | A3 v6: 3 R; por pieza: 2 R; carpetas: 4 R | todos el mismo paso de 5 herramientas; tira detectada en la versión "con tira" y en la corregida | Reales |
| PLAN_DEL_PLAN_DE_CONTROL | por pieza (HO-990 Rev.A): 11 R | texto "1. Segregar ... P-13 ... P-14" debajo de la banda | Reales |
| TEXTO_TACHADO | por pieza (HO-990 Rev.A): 11 R | recorte a 200 dpi: la línea cruza "3. No reiniciar la producción..." | Real |
| CANTIDAD_ILEGIBLE | A3 v6: 6 R (caminos, "×"); carpetas: 2 R (camino del Top Roll, "×"); v6: 1 R (p.49, 6,6 pt) | p.49 renderizada: "SI DETECTA 3 PIEZAS..." a 6,6 pt en una A4 vertical | Reales (regla `hojas-proceso.md` 2: 7 pt impresos) |
| CAMINO_ANEXO | A3 v6: 6 A; carpetas: 2 A | — | Como se decidió |
| ARMADO_DISTINTO | por pieza (HO-990 Rev.A): 11 R | huella: ciclo a la izquierda del plan (0,388 contra 0,5) | Real; 0 en v6, A3 v6 y carpetas |

## Pieza 3 — la puerta de salida

- `_imprimir.py` pasa `--paginas` por `tbdImpresion.paginas_a_revisar` (la lectura de Ghostscript, con "3-" hasta el
  final) y le da al revisor la lista explícita: el bug de "3-" no entra.
- `_pdfPorPieza.py`: escribe el PDF y sale con 1 si hay un ROJO.
- Lo que va a Fak sin imprimir: R10. Bug H1, arriba.

## Pieza 4 — la skill partida

- 625 renglones con texto en el SKILL.md viejo. 621 están tal cual en `SKILL.md` + `reference/*.md`. Los 4 que faltan son
  el cartel de arriba, reescrito, y su contenido sigue: los selftests, el TBD, "§7 bis ... fila por fila sobre el PDF"
  (SKILL.md:58), "de otro autor" (SKILL.md:52) y §3 bis (SKILL.md:34). "Ningún renglón se perdió" es cierto en
  contenido, no en texto exacto.
- Los punteros resuelven: §1, §1 bis y §1 ter (criterios-de-foto), §2 a §2 sexies y §3 (pantallas-y-fotos), §3 bis
  (guardado-y-numero), §4 y §5 (formulario-y-origen), §6 (enforcement), §7, §7 bis, GATE 0.8 y "b bis" (SKILL.md:316).
  La tabla de la línea 36 dice dónde quedó cada uno. SKILL.md: 394 renglones.

## Pieza 5 — `--carpeta` y el borrador del mail

- `pdfs_de_carpeta` saltea OBSOLETO, HISTORICO y las carpetas "_" (test en verde). Un PDF que no abre no corta el barrido
  (`NO SE PUDO ABRIR`, sale 2). Límite: solo PDF (R2).
- El mail no nombra a Claude ni a una IA. Cada frase del cuerpo tiene su fuente en la sección de abajo (mail de Nicolás
  del 13/10 16:08, Carlos 13/10 12:32 y 15:06, el pedido de Fak). El archivo dice "NO ENVIADO", y en los 5 commits no hay
  ningún envío ni llamada a Outlook.

## Lo que no pude verificar

- Las citas de los mails (Nicolás 06/10 y 13/10, Carlos 13/10). El encargo excluye los mails, y la memoria que se cita
  como fuente (`project_hojas_proceso_patagonia_que_falta`) no está en el repo. Que Nicolás sea "Calidad" sale del plan
  del sistema §7 punto 3, que tampoco tengo.
- Que el mail no salió. Outlook no se toca: solo consta el encabezado del archivo y que el código no manda nada.
- La prueba de disparo de la skill (94 contra 97 de 200): usa la API.
- El barrido del servidor Y: (no accesible) y el recuadro con el nombre dentro de la foto (son píxeles).

## Lista de ROJO del 16/10 sobre las dos carpetas de la nota PENDIENTE (para corregir D2)

`python scripts/_revisarPaqueteHO.py --carpeta exports/hojas-grampas-a3 --carpeta exports/hojas-gamboa-corregidas-14-10 --solo-rojo`
→ `RESUMEN: 6 ROJO, 0 AVISO`:

| PDF | Página | Código |
|---|---|---|
| HO-971 - OP 93 ENGRAMPADO - APB DE PUERTA DELANTERO.pdf | 1 | HERRAMENTAL_SIN_MARCAR |
| HO-971 - OP 93 ENGRAMPADO - APB DE PUERTA TRASERO.pdf | 1 | HERRAMENTAL_SIN_MARCAR |
| HO-990 - OP 120 EMBALAJE - INSERTO DELANTERO.pdf | 2 | CORTADA, PLAN_NO_ESTANDAR |
| HO-990 - OP 120 EMBALAJE - INSERTO TRASERO.pdf | 2 | CORTADA, PLAN_NO_ESTANDAR |

Las tres hojas de grampas aprobadas el 13/10, las dos de espuma y el Top Roll OP 50 corregidos salen sin defectos. La
soldadura OP 60 corregida da solo un AVISO (sonotrodo).

## Acciones requeridas

1. **H1 (antes del merge):** que la puerta de `_imprimir.py` deje pasar un AMFE. Test en rojo con el AMFE 157 Rev.A
   y el AMFE-ARM-PAT, y en verde con una hoja real.
2. **H2:** decidir el nivel de `CICLO_LLENO` por formato y no por papel, o que Fak diga que vale ROJO también para las HO
   de Excel en A3.
3. **D1 y D2:** corregir "100 de 114" (son 74) en `_revisarPaqueteHO.py:922` y en la nota, y "14 rojos en 10 PDF" (son
   6 en 4). **D3:** revisar la fecha "viernes 17".
4. **R1 y R2:** agregar un test (rojo y verde) del ciclo copiado, y avisar en la nota que el barrido no cubre las HO
   `.xls`, `.xlsx` ni `.pptx`.

---

## Arreglos aplicados después de esta auditoría (sesión de la tanda 1.5, 16/10/2026 ≈ 23:15)

| Hallazgo | Qué se hizo | Prueba |
|---|---|---|
| `_imprimir.py` frenaba un AMFE (9 y 23 ROJO) | `Pagina._tipo`: «HOJA DE OPERACIONES» cuenta solo como título (el renglón entero) y el camino de inspección solo si su título está arriba (20 % superior de la página) | el AMFE 157 pasa la puerta y llega a armar el archivo de impresión en seco; test nuevo en «la puerta de salida» (`amfe`) |
| Ciclo lleno ROJO/AVISO por tamaño de página | Ahora por formato: ROJO solo en el A3 de una foto por paso (carteles «REF. n»); la HO de Excel (A4 o A3) y la HO-990 Rev.A son AVISO | HO 971 de Excel en A3: AVISO; engrampado de Pablo del 01/10: ROJO; el mismo corregido el 14/10: sin defecto |
| «100 de 114» | Corregido a 74 de 114 (recontado con `cuerpo_ciclo`) en el revisor y en la nota del barrido | — |
| «14 rojos en 10 PDF» | Corregido a 6 en 4 (con las carpetas «_» salteadas) | — |
| «viernes 17» | La fuente dice ahora «carpeta viernes-17-plan-sistema de la nube» | — |
| Ciclo copiado sin test | Test con un par real (op 50 y op 60.2 del paquete del 07/10: «texto de otra hoja») y el contrario (60 y 60.2, misma operación partida: no lo es). Se ajustó la regla: compara la decena, no el número entero | 73/73 en las cuatro suites |
| El barrido lee solo PDF | Escrito en la nota del barrido: los Excel y PowerPoint se pasan antes a PDF en una carpeta de trabajo | — |

Ruido conocido: `imprimirTemporal.test.mjs` tuvo dos fallas por tiempo con cuatro suites en paralelo (19 s por test); solo y en la segunda corrida conjunta, 4/4. `_imprimir.py` ahora tarda más porque corre el revisor (unos 0,3 s por página de hoja).
