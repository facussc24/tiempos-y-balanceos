# Tanda 12 — las skills de entregable, una por una (17/10/2026)

Rama `claude/skills-1017` (worktree `.claude/worktrees/skills-1017`), sin push. Un commit por skill. Encargo E261017-0e91.

## Lo que se midio y como

- **Banco de casos con y sin skill**: `node scripts/_evalBanco.mjs --banco <skill> --runs 1`. Un banco por skill, con SOLO
  esa skill en el brazo «con» (`reglas: []`), asi la diferencia es la de la skill. **Una corrida por brazo** (lo que pidio
  el encargo para esta pasada): con una corrida, un caso puede dar vuelta de 0 a 100 entre dos corridas sin que cambie
  nada (paso en flujogramas y en pieza-nueva, en los dos brazos a la vez). Los informes estan en `docs/evals/banco-<skill>-2026-10-17-{antes,despues}.md`.
- **Prueba de disparo**: `_pruebaDisparoSkills.mjs` (Haiku, 200 mensajes reales de Fak) corrida desde el repo principal
  contra las skills del worktree, con el MISMO juego de mensajes y la misma fecha en todas las corridas, dos veces antes
  y dos despues para ver el ruido. Informes en `.sgc-cache/api/disparo-skills/tanda12-{base-a,base-b,despues-a,despues-b}/`.
- **Renglones y largo de la description**, medidos con `wc -l` y sobre el frontmatter, contra `main`.

## Hallazgo que cambia como se escriben las descriptions

Claude Code tiene un **tope de caracteres para la lista de skills** que ve cada sesion (leido en el binario 2.1.30x:
`SLASH_COMMAND_TOOL_CHAR_BUDGET`, por defecto 1 % de la ventana × 4 bytes por token ≈ 8.000 caracteres con 200.000
tokens). Cuando la lista no entra, **las skills que menos se usan quedan solo con su nombre**, sin description: el
17/10 en esta sesion les pasaba a `beon`, `planes-de-control`, `informe-tryout`, `injection-process`,
`lamina-de-proceso`, `novedades-claude` y `render-a-foto-real`. O sea que alargar una description para que dispare
**le saca la suya a otra**. Por eso ninguna description de esta tanda quedo mas larga que antes: las 9 sumaban
**4.811 caracteres y quedan en 3.987** (−824, −17 %). Ojo con el tamaño del problema: las descriptions de todas las
skills que ve esta PC suman unos 16.000 caracteres (las del repo, ~14.000), el doble del tope, asi que −824 dificilmente
alcanza para que `beon` o `planes-de-control` vuelvan a verse con su description; y si se ven en una sesion nueva no se
pudo medir desde aca (la lista la arma la sesion al arrancar, desde el checkout principal; la prueba de disparo le pasa
a Haiku todas las descriptions completas y no ve el tope). Lo que mueve la aguja es acortar todas o sacar de la lista las
que no se usan: va a «Lo que hace falta de Fak».

## Por skill

| Skill | Renglones | Description | Banco (con / sin, despues) | Disparo (acierto/faltante/de mas, base → despues) | Gate | De que leccion |
|---|---|---|---|---|---|---|
| hojas-de-proceso | 394 → 394 | 746 → 603 | 3/3 con · 0/3 sin (igual antes) | 5/1/8 y 5/1/8 → 5/1/6 y 4/2/5 | ninguno nuevo: todas sus lecciones ya frenan en `_revisarPaqueteHO.py` (ARMADO_DISTINTO, PIEZA_SIN_ACLARAR, CICLO_LLENO…); se corrigio `reference/enforcement.md`, que decia "a ojo" para lo que ya mide | 07/10 y 13/10 |
| planes-de-control | 303 → 311 | 632 → 539 | 3/3 con · 2/3 sin (igual antes: dos casos los contesta bien un modelo sin la skill; solo «la D sola» discrimina) | 0/0/8 y 0/0/9 → 0/0/9 y 0/0/8 | **`scripts/_planControlLimpio.py`**: la D sola, una marca por celda; `--rearmado` sin amarillo ni notas; `--definitivo` sin TBD/CONFLICTO; selftest + `planControlLimpio.test.mjs` | 15/10 |
| flujogramas | 433 → 447 | 424 → 408 | 3/3 con · 1/3 sin (antes 2/3 con: el caso del historial daba 0 % con la skill y ahora 100 %) | 0/2/1 y 0/2/1 → 0/2/2 y 0/2/1 | **aviso `historial-confiesa`** en `flujogramaCanon.mjs` (chequeo 11 bis) + la regla en §5 | 02 y 09/10 |
| amfe-export-oficial | 117 → 126 | 379 → 354 | 3/3 con · 0/3 sin (antes 1/3 sin) | 0/2/0 y 0/2/0 → 0/2/0 y 0/2/1 | **`scripts/_lib/caratulaVacia.mjs`** en `_exportAmfeOficial.ts`: un rotulo de la caratula sin valor en el ARCHIVO releido da FALLO; 9 de 9 AMFE exportados lo pasan | 25/06 (origen de la skill) y 03-08/09 |
| amfe-domain | 145 → 156 | 490 → 434 | 2/2 con · 0/2 sin (antes 1/2 con) | 0/0/4 y 0/0/2 → 0/0/3 y 0/0/1 | **`skillsAmfeEjemplos.test.mjs`**: lo que la skill da como BIEN pasa `scanForbidden`; el ejemplo canonico decia «Gap & Flush fuera de spec» (frenado por `ENGLISH_RANDOM_TERMS`) y «S&R» (la lista no tiene la sigla: no la ve) | 19 y 23/08 (amfe.md §17.2) |
| amfe-cookbook | 189 → 196 | 326 → 314 | 2/2 con · 0/2 sin (antes 1/2 sin) | 0/0/1 y 0/0/1 → 0/0/0 y 0/0/1 | ninguno ejecutable: la regla del 02/10 (de la vecina, el lugar; nunca el metodo) escrita donde se propaga; son scripts sueltos | 02/10 |
| pieza-nueva-flujograma-amfe | 290 → 291 | 431 → 392 | 2/3 con · 1/3 sin (igual antes; el que falla es el del mail, ver abajo) | 0/1/1 y 0/1/0 → 0/1/1 y 0/1/1 | ninguno nuevo: `TOPE_PALABRAS` ya existia y tenia test; entra a la tabla de la skill | 02 y 09/10 |
| plotter-aol | 296 → 302 | 720 → 554 | 3/3 con · 1/3 sin (igual antes) | 1/0/1 y 0/1/1 → 0/1/0 y 1/0/0 | **en `acomodar_columnas.py`**: frena si el origen trae algo que no sea polilinea (un agujero se perdia en silencio) y relee el DXF (2N contornos, ≥ 25 mm reales); frena tambien si el origen no trae exactamente 4 piezas (un contorno de mas pisaba una pieza, lo encontro el auditor); probado con el DXF real del 15/10 y con `acomodar_columnas_selftest.py` (4 casos ROJO/VERDE con DXF sinteticos; fuera de `npm test` porque el CI no instala ezdxf ni shapely) | 15/10 (columnas, 25 mm) y "lo que falta no se ve" |
| beon | 241 → 248 | 663 → 389 | 2/2 con · 0/2 sin (igual antes) | 0/0/1 y 0/0/0 → 0/0/0 y 0/0/0 | **`.claude/skills/beon/traba.js`** + `beonTraba.test.mjs`: la traba de lectura deja de ser un parrafo | §0 de la skill (emitir vale como firma) |

Disparo global: **49 % y 49 % antes, 49 % y 48 % despues** (igual dentro del ruido). Vecinas: arb-operar 5 y 6 aciertos → 9 y 7;
apqp-legajo de mas 2 y 2 → 3 y 4; explicar-mejor 32 y 32 → 31 y 35. Con 0 a 6 mensajes reales por skill, ±1 es ruido.
Ninguna skill pasa de 500 renglones (la mas larga, flujogramas, 447): no se partio ninguna.

## Lo que encontraron los gates nuevos en archivos reales

- **Plan de control de los APC del 15/10** (`exports/PC_APC_PATAGONIA_20261015/... propuesta de Ingenieria 15-10-2026.xls`):
  `_planControlLimpio.py` da 3 ROJO, uno por hoja: la fila 3.0 «Flamabilidad y emisiones del conjunto» lleva «D / D» en una
  celda (dos caracteristicas en una fila). No se toco el archivo. La version con correcciones de la Rev 0 da ROJO como
  corresponde (33 `D/TLD`, 18 celdas con varias marcas, amarillo en toda la tabla).

## Que skills entraron (listadas antes de empezar)

- **De la lista del encargo**: hojas-de-proceso, flujogramas, planes-de-control, plotter-aol, beon.
- **De AMFE**, buscadas en `.claude/skills` por nombre y description: amfe-export-oficial, amfe-domain, amfe-cookbook y
  pieza-nueva-flujograma-amfe (entraron). **Afuera**: `apqp-schema` (el esquema JSON de Supabase: no es de entregable y
  esta tanda no toca Supabase), `supabase-safety` (protocolo de escritura, idem) e `injection-process` (las operaciones
  de inyeccion de un AMFE: es de AMFE y no se llego; queda para la proxima pasada). `audit-amfe`, `auditoria-cliente` y
  `fix-amfe-gaps` son comandos, no skills.
- **Mails**: no hay skill (ver abajo).
- **Afuera por el encargo**: cad-design e impresion-3d-bambu (tanda 11). Tampoco entraron las demas de entregable que el
  encargo no nombra (informe-tryout, lamina-de-proceso, imds, imprimir, ppap-motherson, carga-arb, editar-video…).

## Skill que no quedo terminada

- **amfe-cookbook — falta su gate.** Lo que Fak corrigio el 02/10 (de la pieza vecina se toma el lugar, nunca el
  metodo) entro como parrafo, que es lo que el encargo pedia no hacer. No hay un punto unico donde ponerle un freno: la
  propagacion "Parcial" la hacen scripts sueltos con `runWithValidation`. Lo que falta: un chequeo dentro de
  `runWithValidation` o del validador que avise cuando una causa recibe un control o una herramienta copiada de otro AMFE
  (comparando contra el AMFE de origen). Es un cambio mediano en un gate que usan todos los scripts de AMFE: va con su
  plan corto y su auditor, en una sesion de codigo.

## Lo que hace falta de Fak

1. **La hora del banco de casos** (ya pedida en la tanda 9): sirve tambien para calibrar el juez, que en esta tanda bajo
   respuestas correctas en dos casos (abajo).
2. **El ancho del plotter AOL**: ¿lo leemos del panel de la maquina (*config → machine*) o hay un dato en el manual que
   no estamos viendo? LECCIONES 15/10 dice que esta en el manual; la skill y la memoria dicen que el manual solo trae
   ejemplos. Lo que conteste va a la skill y a la memoria.
3. **La lista de skills con tope**: con las descriptions al doble del tope, decidir si se sacan de la lista las skills que
   no se usan (o se acortan todas). Es un cambio del sistema: va con su plan.
4. **El plan de control de los APC del 15/10**: la fila 3.0 lleva dos caracteristicas («flamabilidad y emisiones del
   conjunto», «D / D»). Si ese plan sale a Calidad, se parte en dos filas.

## Lo que no se hizo y por que

- **Skill de mails**: no existe (es la regla `mail-envio.md`, con `paths:`). Convertirla en skill es el P61 de la tanda 10,
  grande; no entra aca. Evidencia para ese trabajo: el banco `mail` de la tanda 9 tiene 3 de 5 casos en 67 %.
- **Roles Man como gate**: `amfe.md` §9 pide exactamente 4 roles y el validador no lo frena; medir cuantos AMFE vivos lo
  rompen pide leer Supabase, que esta tanda no toca. Quedo escrito en amfe-domain como regla sin gate.
- **Un caso del banco con juez no confiable**: «el mail a Calidad con copia» (pieza-nueva) dio 0 % tres veces con
  respuestas que frenaban, avisaban la copia y proponian el mail corto. Se ajusto el criterio una vez y siguio igual: queda
  para la hora de calibracion del banco con Fak. Otro criterio (pieza nueva desde hermanos, flujogramas) se corrigio tras un
  falso FAIL porque pedia un retrabajo que la skill manda preguntar.
- **El ancho del plotter**: LECCIONES 15/10 dice que «el ancho del plotter esta en el manual»; la skill y la memoria
  `reference_plotter_aol_corte_insert` dicen que el manual solo trae ejemplos y que el area se mide en el panel. No se
  resolvio: va a la lista de Fak.
- **La regla `hojas-proceso.md` punto 23** dice que el control de la pieza rara existe solo en el generador del hot melt;
  desde el 16/10 tambien lo mide `_revisarPaqueteHO.py`. Es una regla, no una skill: no se toco.
- **La otra mitad de la leccion 15/10 de planes de control** (generar el plan releyendo flujograma, AMFE y fichas de
  embalaje JUSTO antes) no tiene gate: `_planControlLimpio.py` mira el archivo, no de que versiones salio.
- **La ventana de 40 caracteres** del patron `reproceso-sacado` (flujogramas) no tiene fuente: se eligio para que
  «REPROCESO DE ADHESIVADO (93). ELIMINACION DE OP. 40» (154 Rev.B) no avise y una fila que nombra los reprocesos sacados si; la Rev.B textual del 160 («71 y 72 a la 70») no avisa porque no dice la palabra. Se
  mide contra el corpus: 0 avisos en los 9 flujogramas del generador.
- **Mensajes de commit con un numero mal**: en los commits de hojas (dice 593, es 603), planes (527 → 539) y flujogramas
  (405; el siguiente commit lo deja en 408) el largo de la description se escribio antes de medirlo. Los numeros buenos son
  los de esta tabla.
- **Limites conocidos de `_planControlLimpio.py`** (auditor): en un `.xlsx` ve solo el amarillo puro (`FFFF00`), no el
  indexado ni el claro; si arriba de la tabla hay otra celda que dice «CLASIF», toma esa columna; «SC/CC» con barra queda
  como aviso, no como dos marcas. Los `.xls` reales de Calidad los lee bien (las cifras de arriba las reprodujo el auditor).
- **«S&R» no esta en `ENGLISH_RANDOM_TERMS`** (lista del validador del AMFE): agregarla es cambiar un gate y pide medir
  cuantos AMFE vivos la tienen (Supabase). Va a la lista de Fak.
- **Metodo del banco** (auditor): el «antes» de amfe-domain y de pieza-nueva corrio con parte del cambio ya escrito (lo
  que no tocaba los casos), y el «despues» de flujogramas, amfe-cookbook, amfe-export-oficial y beon corrio antes del
  ultimo retoque de la description (solo palabras). No cambia ninguna conclusion.

## Rondas de revision

1. **revisor-pedido** (4 importantes): test del gate del plotter, amfe-cookbook declarada sin gate, lista de skills que
   entraron y no, y lo que hace falta de Fak. Aplicado (commit `aefa34a7`).
2. **auditor Opus** (`docs/auditorias/TANDA12_SKILLS_auditor_2026-10-17.md`; 3 importantes): «S&R» mal atribuido al gate,
   un contorno de mas pisaba una pieza en `acomodar_columnas.py`, y la traba de BeOn decia «traba puesta» sin nada que
   trabar. Aplicado, con sus casos ROJO en los tests; tambien los detalles (verbos con tilde e «INTEGRIDAD» en el aviso del
   historial, el Excel con la caratula incompleta queda renombrado «NO ENTREGAR», un criterio contradictorio del banco).
   Despues de la segunda ronda no se pidio otra revision completa: lo nuevo es solo el diff de estas correcciones.
