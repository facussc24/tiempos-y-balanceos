# Auditoría final — tanda 8 (automatización de Barack para Pedro) — 17/10/2026

Camino mediano. Solo lectura y corridas; no se editó código ni archivos de la nube. Rama
`claude/automatizacion-pedro-1017`, commits `21c79b2e` y `799b7e20` sobre `336864f7`.

## Resultado: FALLO · 5 Importante, 5 Nit, 0 Preexistente

Ojo con las versiones: la sesión siguió corrigiendo mientras yo auditaba. A las 13:02 cambiaron `cola.md`, el
borrador y el doc de la tarea; lo que ya quedó bien está en «Corregido durante la auditoría» y no se cuenta como
hallazgo. Lo de abajo está medido sobre la versión de las 13:02 (md5 de `cola.md` `451decaf…`, borrador `56983f7b…`,
relevamiento `913cf03d…`).

| Check | Estado | Detalle |
|---|---|---|
| `node --check` script y test | OK | los dos con exit 0 |
| Test (vitest, desde el principal con `--root`) | OK | 23 de 23 en verde, 7,5 s |
| Test sin python | OK | con python fuera del PATH: 1 en rojo («spawnSync python ENOENT»), 22 en verde; no se saltea |
| Mutantes del test | FALLO | sobreviven 9 de 12 (hallazgo 5) |
| 1. `_mails.py` solo con `--buscar` / `--ver` | OK en el código, flojo en el test | ningún camino esquiva `llamarMails()`; la lista exacta frena las abreviaturas de argparse |
| 2. `--out` no pisa la cola | FALLO parcial | frena mayúsculas, ruta relativa, `\\?\` y barra final; pisa con `::$DATA` y con un enlace duro (Nit 1) |
| 3. Clave por asunto, remitente o id | parcial | el asunto se tapa; el remitente no (Nit 2); el id no se puede alcanzar (falso positivo) |
| 4. `_sinFirmaIA.py` sobre los tres archivos | OK | 0 bloqueantes en los tres; con «Claude» o «Anthropic» metido en una copia da BLOQUEANTE (el detector puede dar rojo) |
| 5. Números de `cola.md` | FALLO | 2 siguen mal (hallazgos 1 y 2); 2 ya se corrigieron solos |
| 6. Borrador a Pedro | FALLO | VERDE en `_vozFak` (468 caracteres), Carlos en CC, sin cadencia, sin nombrar al asistente; pero nombra a Manuel y no lo lleva (hallazgo 3) |
| Relevamiento de la nube | OK | regenerado hoy con el mismo código a una carpeta temporal: **byte a byte igual** al de la nube (116 s) |
| Git | FALLO | `docs/AUTOMATIZACION_PEDRO_TAREA_VIERNES.md` modificado y sin commitear (hallazgo 4); la rama no tiene remoto (la funde la madre) |
| CI | sin verificar | el test nuevo no corrió nunca en CI: la rama no se subió. Lo medido es `candado.yml` completed success en `336864f7` (la base de la rama) y `deploy.yml` sin rojo |
| Build / tsc | no aplica | no se tocó la app |

## Hallazgos Importantes (TRUE BUG)

1. **[Importante] `cola.md`, candidato 3 — «81 archivos exportados del arb con fecha (44 de relaciones y 37 guardados
   antes de un cambio)»: son 79.** A las 12:41 decía 84, que eran los 84 `.csv` de `.arb-cache/` (archivos de carga
   `carga_` / `alta_` / `sustituir_` / `unidad_` armados para subir al arb, no exportaciones): `find -name "*.txt"`
   distingue mayúsculas y no ve ningún `.TXT`. La corrección de las 13:02 sigue contando de más: en `pre-cambio/` hay 37
   archivos, pero 2 no son exportaciones del arb: `21-7339_antes.json` (sin fecha) y
   `Generador_codigos_20260915_pre-bolsa520.xlsx` (la planilla generadora de códigos). Medido: 44 `RELACIONES_*.TXT` en
   `.arb-cache/` + 35 `.TXT` en `pre-cambio/` (32 RELACIONES, 2 ARTICULO, 1 INSUMOS) = **79**. Si se cuentan solo las de
   relaciones, que son las que lee la historia de una línea, son **76**: es lo que lista `candidatos_relaciones()` de
   `scripts/_lib/arbRelaciones.py` (sin el `C:\tmp\RELACIONES.TXT` vivo), y cuadra con los 74 de la fila HOY-19f del
   10/10 más los 2 del 13/10 (`pre-hilo`, `post-hilo`). Respuesta: ____

2. **[Importante] `cola.md`, «Cuánto tiempo dedicarle» — «cinco veces que Facundo tuvo que avisar que ya había entrado al
   portal de VW (13/10 y 14/10)»: no sale de la charla.** En `f84cc7f0…jsonl` Fak avisa que entró **6 veces**: 13/10
   19:40Z (IMDS: la sesión siguió con «Uso el menú Functions… Sigo solo con IMDS»), 20:04Z (VW); 14/10 12:34Z (IMDS),
   12:49Z (VW: «Ya estás adentro de BeOn»), 14:07Z (IMDS) y 17:08Z («creo que ya inicie en ambos»). Al portal de VW
   fueron **3** (20:04, 12:49 y 17:08). Ninguna cuenta da 5. `ESTADO.txt` no trae el número. Va 3 (portal de VW) o 6
   (cualquier portal), con la cuenta que se use. Respuesta: ____

3. **[Importante] Borrador `2026-10-17 - mail a Pedro.md`, renglones 4 y 13 — dice «con Manuel» y Manuel no va en el
   mail.** `mail-envio.md`, «Quién va en el mail», regla 1 (Fak: *«si mencionás a alguien debe estar en el mail»*): el
   CC tiene que llevar a Manuel Meszaros además de Carlos. Esto se va a repetir cada quince días: el paso 5 del prompt
   de la tarea (`docs/AUTOMATIZACION_PEDRO_TAREA_VIERNES.md:63`) fija `CC: Carlos Baptista` y no dice que se sume en
   copia a quien se nombre en el cuerpo. Respuesta: ____

4. **[Importante] `docs/AUTOMATIZACION_PEDRO_TAREA_VIERNES.md` commiteado en `799b7e20` (renglones 38-39 y 56) — las
   fechas de la guarda están mal, y el arreglo quedó sin commitear.** El 17/10/2026 es sábado (medido con `date`), y el
   24/10 y el 31/10 también lo son: el cron `0 9 * * 5` nunca corre esos días. Con la guarda de 14 días, el viernes
   30/10 (13 días) no escribía y el primer borrador automático salía el **06/11**, no el 31/10. En el disco (13:02,
   ` M` en `git status`) ya está corregido: guarda de 12 días, 23/10 no, 30/10 sí, después uno cada dos viernes
   (revisado: 7 días < 12, 14 ≥ 12, y nunca dos viernes seguidos). Falta commitearlo; hoy GitHub tiene la versión
   equivocada. Respuesta: ____

## Hallazgo Importante (ROBUSTNESS)

5. **[Importante] `__tests__/scripts/automatizacionCandidatos.test.mjs:142-160 y 238-244` — el test no sostiene las
   dos promesas del script: 9 de 12 mutantes peligrosos pasan en verde.** Mutantes armados en el scratchpad (el
   archivo auditado no se tocó), con la config del repo (`--testTimeout 30000`, sin archivos en paralelo) y un
   control sin cambios que da verde:

   | Mutante (un cambio en `scripts/_automatizacionCandidatos.mjs`) | Qué deja pasar | Test |
   |---|---|---|
   | `:173` la opción permitida en cualquier lugar (`args.some(...)` en vez de `args[0]`) | `--sync --buscar x`: `_mails.py` corre `sync()` primero (main, renglones 1570-1575) y abre Outlook | **verde** |
   | `:177` sumar `'--sy'` a la lista de extras | argparse lo completa a `--sync` (medido: `--buscar x --sy` da `sync=True`; `--buscar x --sel` corre el selftest real) | **verde** |
   | `:177` sumar `'--' + 'nuevos'` | `--nuevos` abre Outlook y agrega al cache; el test del código fuente solo busca el texto literal | **verde** |
   | `:290` leer con `spawnSync` directo, sin `llamarMails()` | se va el control entero; el de punta a punta solo mira qué se pidió | **verde** |
   | `:181` `shell: true` | los términos y los ids pasan por la consola | **verde** |
   | `:279` guarda sin `toLowerCase()` | `--out COLA.MD` pisa la cola en Windows | **verde** |
   | `:279` guarda contra `path.resolve(rutaCola)` en vez del nombre | `--out` a la cola real con `--cola` apuntando a otra | **verde** |
   | `:238` asunto sin `taparClaves` | una clave en el asunto llega a la nube | **verde** |
   | `:176` extras desde el índice 2 | poco peligro real: argparse rechaza una opción como valor de `--buscar` / `--ver` | verde |
   | quitar el patrón `api key / token / clave` · cita sin `sinMarcaDelAsistente` · sin `excluir_carpetas` | — | rojo (los tres mueren) |

   El código de hoy está bien en todos esos puntos (la lista de extras es exacta, la guarda baja a minúsculas, el asunto
   se tapa), pero nada frena que se afloje. Faltan casos que deban frenar: `--buscar x --sy`, `--sync --buscar x`,
   `--buscar x --nuevos` (o, mejor, recorrer todas las opciones de `ap.add_argument` de `_mails.py` y sus abreviaturas);
   `--out` con otra mayúscula y con `--cola` distinta; una clave en el asunto; y que `main` lea por `llamarMails`
   (por ejemplo, un `_mails.py` falso que conteste algo al `--sy` y el test exija que no se lo llame). Respuesta: ____

## Nits (ROBUSTNESS)

1. **[Nit] `scripts/_automatizacionCandidatos.mjs:279` — la guarda de `--out` mira solo el nombre.** Medido en una cola
   falsa del scratchpad: `--out "<carpeta>\cola.md::$DATA"` **pisó la cola** (exit 0), y un enlace duro `propuesta.md`
   a la cola también; `cola.md ` (espacio al final) y `cola.md.` no la pisan pero dejan un archivo aparte con ese nombre
   raro en la carpeta. El enlace simbólico no se pudo armar en esta PC (EPERM). La tarea del viernes usa un `--out`
   fijo, así que solo pasa con un `--out` mal escrito. Arreglo chico: comparar por identidad (`fs.realpathSync` de la
   carpeta más el nombre sin puntos ni espacios al final, rechazar `:` en el nombre y, si el archivo existe, comparar
   `ino` y `dev` con los de la cola). Respuesta: ____

2. **[Nit] `scripts/_automatizacionCandidatos.mjs:238` — el remitente (y el id) salen sin `taparClaves` ni
   `sinMarcaDelAsistente`.** Con una fila armada a mano: remitente `Anthropic Team` o `Claude` sale tal cual en el
   relevamiento, y una clave puesta como remitente sale con 17 letras de la parte secreta (`_mails.py` corta el
   remitente en 30). El cache **tiene** dos mails de remitente «Anthropic» y «Anthropic Team» (10/04 y 24/06/2026, en
   castellano); hoy ninguno toca un tema del canon (medido con `contieneTermino`), pero uno que diga «a mano» o
   «demora» en la ventana nombraría al proveedor en la nube. El paso 6 de la tarea lo agarra con `_sinFirmaIA.py`,
   pero recién cuando el archivo ya está escrito en la nube. Arreglo de un renglón: pasar `c.de` por las dos funciones
   (y sumar `anthropic` a `excluir_remitentes`). Respuesta: ____

3. **[Nit] `scripts/_automatizacionCandidatos.mjs:124-125 y 37-42` — se corta en 217 ANTES de tapar, y hay formas de
   clave que no se tapan.** Medido con textos armados: una clave que cae en el corte deja solo el prefijo
   (`sk-ant-api0…`, no es secreto), pero un `token: …` que cae ahí deja hasta 11 letras del valor (`token: K9fK9f…`);
   una clave partida en dos renglones deja pasar entera la segunda mitad si ese renglón es el que nombra el tema; y
   `contraseña:`, `password:`, `Bearer …`, `ghp_…` y `AKIA…` no se tapan. En los mails reales no pasa: 28 mails que
   juntan «contraseña / clave / password / sk-ant / usuario» con un tema dan 0 citas con algo que parezca un secreto
   (medido sin imprimir nada); la del mail de Pedro del 09/10 tampoco lleva la clave. Arreglo: tapar antes de cortar y
   usar el patrón de `scripts/_lib/permisoGuard.mjs:161`, que ya cubre esas formas. Respuesta: ____

Y 2 nits más (el tope de REVIEW.md es 3; quedan medidos, a pedido).

## Corregido durante la auditoría (verificado, no se cuenta)

- **Devoluciones de VW**: a las 12:41 decía 15 (13 el 05/08). `_mails.py --buscar Rueckgabe` da 18; 2 son de 2024
  («Modification Resolution»). En 2026 son **16**: 1 el 16/06, **14** el 05/08 y 1 el 22/08, cada una con su número de
  informe distinto (`empbOid` …198, …201-203, …205-214 el 05/08). La versión de las 13:02 dice 16: bien.
- **Citas del 21/09 y 22/09**: a las 12:41 estaban «arregladas» (tildes, signos de apertura, «omoento» → «momento»);
  a las 13:02 son textuales y coinciden letra por letra con la fila HOY-19f de `docs/COLA_CAMBIOS_CODIGO.md:149`.

## Los números de `cola.md` contra su fuente

| Número | Fuente medida | Veredicto |
|---|---|---|
| 16 devoluciones (1 + 14 + 1) | `_mails.py --buscar Rueckgabe` y `--ver` de cada una | OK (corregido) |
| 32 puntos de la del 22/08 | `--ver nube:c681880c0e89` | OK |
| 8 minutos (14:34 a 14:42) | `f84cc7f0`: pedido de Fak 17:34:57Z, cierre 17:42:37Z = 7 min 40 s; el cierre dice «Vista de los anexos» | OK. Hubo un intento anterior a las 17:30Z que frenó el modo automático; el número es el del pedido, como dice el texto |
| 37 minutos (09:52 a 10:29) | `113d3683`: 12:52:44Z a 13:29:43Z | OK como reloj, pero adentro hay ~10 min sin trabajo (cierre del pedido 5 a las 13:15:53Z, la pregunta del IMDS a las 13:25:46Z): trabajado ≈ 23 + 4 = 27 min. Le juega en contra a la propuesta, no a favor |
| 18 informes | mismo registro («los 17 de siempre más el cerrado») | OK |
| 116 días sin mails del 060/26 | `--buscar "060/26" --desde 2026-06-24` = 0; último del 23/06 15:22; 23/06 → 17/10 = 116 | OK. `--buscar 737D` da 20 posteriores y ninguno nombra el 060/26. Salvedad: la 21-9689, que estaba entre los planos del 060/26, tiene mails el 27/08 y el 28/08 («cambios cliente», con los cambios 098/26 y 100/26); no se puede saber por mail si el 060/26 quedó adentro de esos |
| Citas del 22/06 y 23/06 | `--ver` de los dos mails | OK, textuales |
| Formato de ECR de Toyota Boshoku, 26/06 | `--ver nube:214852eb730e` (de guillermo.lopez@toyota-boshoku.com) | OK |
| ECR 51 a 55, 11/05, leído el 27/07 | memoria `reference_circuito_cambios_ecr_eco_barack.md` | OK |
| 81 exportaciones del arb | conteo de `.arb-cache/` y `pre-cambio/` | **MAL: 79** (hallazgo 1) |
| unas 2 horas (13/10 17:05-17:48; 14/10 09:30-10:05 y 14:00-14:45) | `ESTADO.txt` + `f84cc7f0` (la carga terminó 14:42) | OK: 43 + 35 + ~43 = ~121 min |
| cinco veces | `f84cc7f0` | **MAL: 3 al portal de VW, 6 en total** (hallazgo 2) |
| 23:31, 77 de 77 | memoria `reference_impresora_3d_fak.md` | OK (las «3 horas» no las medí) |
| 12 informes y 36 casilleros | 12 × 3 | OK la cuenta |
| 240 GB y 1,4 de 7,7 GB (15/10) · «ya se lo mostré» / «ya lo sabe» (15/10) | — | sin verificar (no estaban en la lista del pedido) |

## Falsos positivos descartados

- **El id como camino de una clave**: los ids los arma `_mails.py` (EntryID en hexadecimal o `nube:<hex>`); un mail no
  puede meter texto ahí.
- **«`--buscar` / `--ver` abren Outlook»**: no. Los dos pasan por `_unificar()` (cache local y nube del equipo) y
  ninguno llama a `_outlook()` (`scripts/_mails.py:616-677`).
- **«Las abreviaturas de argparse se cuelan»**: el código las frena: `llamarMails` rechaza cualquier `--x` que no esté
  en la lista exacta. Lo flojo es el test (hallazgo 5), no el código.
- **«El script no arranca con la ruta corta de Windows (`FACUND~1`)»**: lo sospeché por un rojo en mis mutantes;
  medido, `--help` sale bien con las cuatro grafías (normal, minúsculas, ruta corta, ruta larga). El rojo era el tope
  de 5 s de vitest sin la config del repo.
- **Términos del canon sin tilde («a pulmon», «llevar mas tiempo») contra una búsqueda que distingue tildes**: con
  tilde dan 0 en todo el cache; no hay caso que se pierda.

## Cómo se midió (para repetirlo)

Todo en el scratchpad de la sesión (`…\scratchpad\aud8\`): `probar_out.mjs` (variantes de `--out` contra una cola
falsa), `sondas_claves.mjs` (funciones exportadas con textos armados), `sonda_secretos_reales.mjs` (los 28 mails reales,
sin imprimir valores), `armar_mutantes.mjs` + `mut/` (12 mutantes y el control; `node_modules` enlazado al del
principal mientras corrían, el enlace ya se sacó) y `leer_charla.mjs` (registros `.jsonl`). La corrida real del script fue con `--out` al scratchpad; leyó la
cola de la nube sin escribirla.
