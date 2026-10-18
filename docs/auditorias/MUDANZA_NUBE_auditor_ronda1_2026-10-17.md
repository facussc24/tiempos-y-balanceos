# Auditoría de la rama `claude/mudanza-nube-1017`, ronda 1 (17/10/2026)

## Reporte de auditoría — 17/10/2026, 23:40

### Resultado: FALLO · 3 Importante, 3 Nit (y 3 más), 2 Preexistente

La rama compila, arma la build y pasa todos sus tests. Las tres Importante no rompen nada que ya ande:
- la primera hace que el código del repo vuelva a encontrar el asistente por área que está en cuarentena;
- la segunda es una exención nueva del detector de firma que no tiene test;
- la tercera es un renglón que falta en el informe.

Lo que se revisó: los 8 commits de `main..HEAD`. Eran 7 al pedir la auditoría; el 8.º, `6c1f9532`, entró a las 23:30, en medio
de la revisión, y también está auditado.

| Check | Estado | Detalle |
|---|---|---|
| TypeScript | OK | 0 errores (`npx tsc --noEmit`). Corrió antes de `6c1f9532`, que solo cambia un `.mjs` que no entra en la build, una skill y el informe |
| Build | OK | `npm run build`: «built in 1m 46s» (solo el aviso de siempre por el tamaño de los archivos). Mismo comentario sobre `6c1f9532` |
| Git local | OK | worktree limpio; 8 commits sobre `main` (`2da5783a`) |
| GitHub sync | OK (a propósito) | la rama no está subida: la funde la sesión que lanzó la mudanza. No es CRÍTICO |
| CI | sin verificar para la rama | `candado.yml` completed success en `2da5783a` (la base de la rama = main); `deploy.yml` completed success en `411f200f`. La rama no corrió CI |
| Tests de lo tocado | OK | 12 archivos, 1.028 tests: `nubeCarpetas`, `mailsSoloNube`, `nubeOrden`, `firmaIAGuard`, `instalarMiPc`, `mailsPcCalidad`, `claudeAreaMails`, `claudeAreaInstalar`, `claudeAreaVigia`, `paquete`, `paqueteEquipo`, `nubeRutas`. Además 3 archivos y 49 tests de `pedidosPendientes`, `viernesPlanificacion` y `programita`. `programita` se volvió a correr después de `6c1f9532`: 18 OK |
| Hook | OK | `bash .claude/hooks/cerebro-guard.test.sh`: «OK — 17 casos» |
| `_nubeMudar.mjs` en seco | OK | «No queda nada por mover: todas las carpetas del canon estan en su lugar nuevo», sale con 0 |
| Dependencias | OK | `npm ls --depth=0`: 0 UNMET/ERR/missing |
| Escrituras prohibidas (punto 6) | OK | en las líneas que agrega el diff en `scripts/`, `tools/`, `.claude/` y `CLAUDE.md` no hay nada que escriba en Supabase, arb, `Y:`, Outlook ni `OneDrive - BARACK` |

## Hallazgos Importante

### I1 · [Importante · robustez] El código de la rama vuelve a encontrar el asistente por área en cuarentena, y el informe dice lo contrario
- **Dónde:**
  - `scripts/_paquete.mjs:115` (`RUTAS_NUBE.area_vieja`, recorrida en `:524`; la base, `:114`, va aparte más abajo);
  - `tools/claude-area/hola/Instalar Claude (doble clic).cmd:10`;
  - `tools/claude-area/sync_area.ps1:83,85,442` (`$AREA_NUBE` → `$NOMBRES_AREA` → la carpeta recordada);
  - `tools/claude-area/mails_area.mjs:80` (`AREA_VIEJA_TRAMOS`, que usa `carpetaDeMails` en `:448`).
- **Qué pasa:** con el código de main, el `_CUARENTENA_CLAUDE POR AREA` NO se encontraba. Desde la cuarentena del 06/10, main
  buscaba solo «CLAUDE POR AREA»: `buscarCarpetaEnBiblioteca` compara el nombre exacto, el `.cmd` probaba `..\CLAUDE POR AREA`
  y `carpetaDeMails` exigía la base `claude por area`. La rama agrega el nombre en cuarentena (en la raíz y adentro de
  `9- VIEJO (no usar)`) a la lista de los programas que la **usan**, no solo a la del canon de la mudanza.
- **Caso medido** (`cuarentena_casos.mjs` en el scratchpad: HOME de mentira, el módulo de main contra el de la rama):

  | Layout | main | rama |
  |---|---|---|
  | `_CUARENTENA_CLAUDE POR AREA` en la raíz: `_paquete buscarNube(home,'area')` | null | la encuentra |
  | adentro de `9- VIEJO`: `_paquete buscarNube(home,'area')` | null | la encuentra |
  | `.cmd` de hola puesto en `0- INSTALAR…`, con el área en cuarentena como hermana (en la raíz y en `9- VIEJO`) | «No encuentro el instalador» (sale 1) | abre el `Instalar.cmd` en cuarentena (sale 0) |

  Contra la biblioteca real (solo lee), el `_paquete.mjs` de la rama da
  `buscarNube(home,'area')` = `…\ASISTENTE INGENIERIA\9- VIEJO (no usar)\_CUARENTENA_CLAUDE POR AREA\1- PUBLICADO`. Al fundir,
  `tools/claude-area/armar_publicable.mjs --publicar` sin `--nube` (`:248`) publica ahí; con main frena con «no veo la nube».
- **La base va aparte, como pregunta y no como regresión.** `Base Claude Ingenieria` no cambió de nombre con la cuarentena: main
  la encontraba en la raíz (medido) y la rama la sigue encontrando adentro de `9- VIEJO`, que es lo que dice el commit
  `cc6ed66a`. La consecuencia es que en la biblioteca real `buscarNube(home,'ingenieria')` da
  `…\9- VIEJO (no usar)\Base Claude Ingenieria`, y `node scripts/_paquete.mjs --publicar` (el proyecto por defecto es
  `ingenieria`, `:99`) publica adentro de `9- VIEJO (no usar)`. ¿Es el destino que se quiere?
- **Hoy está latente en las PC:**
  - El `.cmd` que está en la nube, en `9- VIEJO\0- INSTALAR…`, es la versión vieja (`grep -c _CUARENTENA_` = 0). Los programas
    que corren en otras PC son los viejos y no llegan a la carpeta en cuarentena.
  - Si se republica o se reinstala el paquete del área, vuelve a andar. Hay además un efecto lateral: la guarda de
    `tools/claude-area/mails_solo/subir_mails.ps1:68`, la que evita subir dos veces, solo mira `CLAUDE POR AREA` en la raíz.
    Con la tarea del área de vuelta y la de `mails_solo`, subirían las dos.
- **El informe y el test dicen otra cosa:**
  - `docs/MUDANZA_NUBE_2026-10-17.md:125` dice que esas PC «dejan de encontrar su carpeta». Para el área ya no la encontraban
    desde el 06/10, y el código nuevo SÍ la encuentra.
  - `:150` («`mails_equipo.py` escribiría sus mails en `9- VIEJO…`») solo es cierto con el `_paquete.mjs` de esta rama. Con el
    de una PC vieja, `buscarNube` da null en `9- VIEJO` (medido arriba).
  - `__tests__/scripts/claudeAreaInstalar.test.mjs:3020` llama «hoy… ENCUENTRA el instalador» a un caso que main no pasa.
- **Qué decidir:** si es a propósito, decirlo en el informe (fila 125 y renglón 150) y en el nombre del caso del test. Si no,
  sacar los nombres `_CUARENTENA_…` de las listas de los programas que la usan y dejarlos solo en el canon de la mudanza.
- respuesta: arreglado (`41e06577`). **Cerrado** en la ronda 2:
  - `_paquete.mjs`, `sync_area.ps1`, el `.cmd` de hola y sus tests quedaron iguales a main (`git diff main HEAD` vacío).
  - Contra la biblioteca real, `buscarNube` da null para `area` y para `ingenieria`: no publica en `9- VIEJO`.
  - `mails_area.mjs` acepta solo «CLAUDE POR AREA», con el caso ROJO en `claudeAreaMails.test.mjs:995`.
  - El informe ya no tiene el renglón 150, y corrigió la fila de las PC en cuarentena.
  - Quedan textos que describen lo revertido (ronda 2, Nit 2).

### I2 · [Importante · robustez] La exención nueva del detector de firma no tiene test y no está anclada a la biblioteca
- **Dónde:** `scripts/_lib/firmaIA.data.json:30`, la entrada `\ASISTENTE INGENIERIA\5- FACUNDO (memoria y configuracion)\` y su
  gemela con `/`. La leen `rutaExcluida()` (`scripts/_lib/firmaIA.mjs:33`) y `ruta_excluida()` (`scripts/_lib/firmaIA.py:99`),
  y con ella `_sinFirmaIA.py` saltea la carpeta entera.
- **Qué pasa:** la comparación es «contiene» (`includes` / `in`), sin la biblioteca adelante. Exime esa carpeta en cualquier
  lugar del disco o del servidor.
- **Caso medido:**

  | Ruta | `rutaExcluida()`, rama | `rutaExcluida()`, main |
  |---|---|---|
  | `Y:\BARACK\ASISTENTE INGENIERIA\5- FACUNDO (memoria y configuracion)\x.docx` | true | false |
  | `C:\Users\x\Desktop\ASISTENTE INGENIERIA\5- FACUNDO (memoria y configuracion)\x.docx` | true | false |

  Para la de `Y:`, Python también da `ruta_excluida()` = True.
- **Los tests:** los gemelos rojos nuevos (`__tests__/scripts/firmaIAGuard.test.mjs`, filas de los renglones ~357-360) prueban
  la regex del guardián (`guardianes.mjs`), no este canon. `rutas_excluidas` no tiene ningún test, ni que frene ni que deje pasar.
- **Lo que sí está medido en vivo** es el verde: `_sinFirmaIA.py` sobre la carpeta única da 649 bloqueantes con el canon de
  main y 10 con el de la rama.
- REVIEW §1: es un control que afloja sin test en las dos direcciones. El mismo hueco con `\Claude Fak\` es viejo (ver P1).
- respuesta: arreglado (`41e06577`). **Cerrado** en la ronda 2:
  - La entrada ahora lleva adelante `proyecto - general\` (y su gemela con `/`).
  - El test (`nubeCarpetas.test.mjs:163`) prueba Node y Python en las dos direcciones: `Y:` y Escritorio frenan, la carpeta
    real pasa.
  - Simulado con las rutas de Linux del CI, Python da lo mismo.
  - El resto que queda (una copia de la biblioteca entera en otro disco) va como residuo de P1.

### I3 · [Importante · aviso que falta] El informe no dice qué toman solas las sesiones abiertas (REVIEW §10)
- **Dónde:** `docs/MUDANZA_NUBE_2026-10-17.md`; `grep -i "sesiones abiertas|reabr"` da 0 coincidencias.
- **Qué pasa:** la rama toca:
  - `CLAUDE.md` y tres reglas (`nube-ingenieria`, `api-claude`, `video-maquina`): hay que reabrir las sesiones;
  - un hook (`cerebro-guard.sh`) y un guardián con su canon (`guardianes.mjs`, `firmaIA.data.json`): los toman solas, una vez
    en main.

  El §1 del informe dice «fundir la rama en main… alcanza», pero no dice que una sesión abierta sigue con el `CLAUDE.md` viejo,
  que todavía nombra `FACUNDO\` para los pedidos.
- **Arreglo:** un renglón en el informe o en el mensaje de cierre al fundir (`mejora-implementada.md` §2).
- respuesta: arreglado. **Cerrado**: `docs/MUDANZA_NUBE_2026-10-17.md:118-120` dice qué toman solas (hook, aviso de pedidos,
  guardián) y que `CLAUDE.md` y las tres reglas piden reabrir la sesión.

## Hallazgos Nit (tope 3; y 3 más)

- **[Nit · robustez] `scripts/_nubeMudar.mjs`.** Un error a mitad deja todo recuperable y re-ejecutable, pero puede perder la
  evidencia:
  - `:138`: `contar(f.destino)` está fuera del `try`. Si tira después del `rename`, la carpeta queda movida, sin verificar y sin
    fila en el registro, y la próxima corrida la toma como `ya_movida`.
  - `:199-203`: cada `--aplicar` arma el registro de cero y lo escribe con el mismo nombre del día. Una segunda corrida el mismo
    día pisa la primera, con las `diferencias` de un freno.
  - `:203`: si `guardar()` no puede escribir, solo avisa y sigue moviendo.
  - `main()` con `--aplicar` no tiene test. Por eso llegó a un commit `rutaSalida('nube_mudanza_….json')`, que tira porque
    `rutaSalida` solo acepta `.md`: nació en `43d4eb3c` (`:172`) y siguió en `cae5a418` y `a1770f2a` (`:200`). La mudanza de las
    22:50 corrió con la copia de trabajo, arreglada en `0d00e4ab` a las 22:54.

  respuesta: arreglado en parte. **Cerrado** en tres de los cuatro puntos:
  - `contar` quedó adentro de un `try`.
  - Un registro del mismo día no se pisa: lleva la hora.
  - Sin registro no se mueve nada.

  **Abierto:** `main()` con `--aplicar` sigue sin test, y los `guardar()` del bucle (`:218`, `:229`) ya no tienen `try` (ronda
  2, Nit 3).
- **[Nit · robustez] Paridad embebida ↔ canon que falta en un programa que viaja solo.** `tools/instalar_mi_pc/instalar_mi_pc.ps1:69`
  lleva adentro `ASISTENTE INGENIERIA\5- FACUNDO (memoria y configuracion)` (clave `facundo`).
  `__tests__/scripts/instalarMiPc.test.mjs:258` lo prueba con `LUGARES_DE_LA_MEMORIA` escrito a mano, no contra
  `nubeCarpetas.data.json`: si el canon cambia, el test sigue verde y el instalador queda distinto. La clave `area_vieja` del
  mismo `.ps1` sí se compara (`:220`). respuesta: arreglado. **Cerrado**: `instalarMiPc.test.mjs:259-263` lee la clave
  `facundo` de `nubeCarpetas.data.json` y comprueba que el `.ps1` lleve esa ruta.
- **[Nit · informe] El desglose de los 10 bloqueantes no es el que da el detector.** `docs/MUDANZA_NUBE_2026-10-17.md:143-146`
  dice «7 PEDIDO… y el LEEME largo de la memoria». `python scripts/_sinFirmaIA.py "<…>\ASISTENTE INGENIERIA" --sin-avisos`,
  corrido desde la rama, da:
  - 8 PEDIDO en `6- PEDIDOS…`;
  - el archivo de las mejoras de Carlos;
  - el LEEME de `1- INSTALAR` (`C:\ClaudeBarack`).

  Son 10 en total, como dice el informe, pero el LEEME de la memoria no aparece: con la rama queda exento (I2). Con el detector de
  main, la misma carpeta da 649, y eso vale mientras no se funda. respuesta: arreglado. **Cerrado**:
  - El informe (`:151-157`) dice 8 PEDIDO, las mejoras de Carlos y el LEEME de `1- INSTALAR`.
  - Vuelto a correr el 18/10: son 10, con ese desglose.
  - Las rutas largas (`:61`) también quedaron corregidas.
  - Los otros dos nits siguen **abiertos**: `LEEME_CARPETA.txt` no tiene test y `temasCanon.data.json:3` sigue citando
    `Claude Fak`.
- y 3 nits más:
  - `:61` dice 6.513 rutas de más de 260 caracteres; medidas ahora son 6.458 (14.932 entradas). La más larga en SharePoint sí da
    361.
  - `tools/instalar_mi_pc/LEEME_CARPETA.txt` hoy arranca con los renglones del destino 1 de `nubeOrden.data.json`, pero ningún
    test lo ata.
  - `scripts/_lib/temasCanon.data.json:3` todavía cita `Claude Fak\viernes-17…` en su `_fuente`.

## Hallazgos Preexistentes (no se le cargan a la rama)

- **P1 · [Preexistente] `scripts/_lib/guardianes.mjs:537` (`FIRMA_EXENTOS_RE`).** Tiene dos huecos, y la alternativa nueva los
  hereda tal cual. Medido con `firmaIaEnEscritura` de la rama contra la de main:
  - un `..` después de la carpeta exenta sale de ella:
    `mkdir -p "<bib>/ASISTENTE INGENIERIA/5- FACUNDO (memoria y configuracion)/../1- INSTALAR (doble clic)/Claude nuevo"` pasa;
    con `Claude Fak/../…`, main hace lo mismo;
  - una ruta de `Y:` que lleva el nombre de la biblioteca en el medio también pasa (main, igual con `Claude Fak`).

  Los gemelos rojos nuevos cubren la hermana `1- INSTALAR` y `Y:` sin la biblioteca, que frenan bien. No cubren estos dos casos.
  respuesta: sin tocar. **Abierto** (es preexistente). En la ronda 2 se suma el resto del canon: ver el informe de la
  ronda 2, P1.
- **P2 · [Preexistente] `main:scripts/_nube.mjs:445`.** Mientras no se funda, un `--subir --aplicar` hecho a mano desde main
  vuelve a crear `Claude Fak` en la raíz (`mkdirSync(NUBE)`) y arma ahí una segunda copia de la memoria. La salida temprana de
  `:291` vale solo para `--bajar` y `--sincronizar`. Lo que dice el §1 del informe («nada de eso… vuelve a crear una carpeta
  vieja») es cierto para la tarea y los hooks de la tabla. Falta un renglón: «no correr `--subir` desde main hasta fundir».
  respuesta: sin tocar. **Abierto**: en el informe, `grep -- --subir` da 0. Vale hasta que se funda la rama.

## Respuesta a los siete puntos del encargo

1. **Ninguna resolución crea una carpeta en un lugar viejo:** se cumple en la rama.
   - `resolverCarpeta`, `resolver_carpeta`, los tres publicadores, `_nube.mjs`, `carpetaDeMails` y los `.ps1` devuelven una ruta
     vieja solo si existe. Si no hay ninguna, devuelven la nueva; `carpetaDeMails`, además, solo si ya está `4- MAILS DEL EQUIPO`.
   - Hay una excepción documentada: `carpetaBuzon` (`_paquete.mjs`) y `Resolver-Buzon` (`sync_area.ps1`) cuelgan el buzón del
     área vieja solo si en la biblioteca no está `ASISTENTE INGENIERIA`. En la biblioteca real está.
   - Lo único que crea en un lugar viejo es main antes de fundir (P2). Lo que crea en `9- VIEJO` es el I1.
2. **Paridad:** está probada contra el canon en cada programa que viaja solo menos uno (Nit 2: clave `facundo` de
   `instalar_mi_pc.ps1`). Los probados:
   - `cerebro-guard.sh` (`nubeCarpetas.test.mjs:153`);
   - `mails_area.mjs` (`claudeAreaMails.test.mjs:973`);
   - `_paquete.mjs` (`paquete.test.mjs:2085`);
   - `sync_area.ps1` (`claudeAreaInstalar.test.mjs:2798`);
   - `ensayo_pc_nueva.sh` (`:2977`) y el `.cmd`, este por comportamiento con los nombres del canon;
   - `mails_pc` (`mailsPcCalidad.test.mjs:580`);
   - `mails_solo` (`mailsSoloNube.test.mjs:42`);
   - `instalar_mi_pc.ps1`, clave `area_vieja` (`instalarMiPc.test.mjs:220`).
3. **`FIRMA_EXENTOS_RE`:** no exime más que la de `Claude Fak`, que sigue al lado (la ruta nueva se agrega, no la reemplaza).
   - Frenan: la hermana con sufijo, `9- VIEJO`, `2- EQUIPO`, `Y:` sin la biblioteca, y dos rutas en un comando con una sola
     exenta.
   - Los huecos que hereda son viejos (P1).
   - Lo que sí afloja sin test es la entrada gemela en `firmaIA.data.json` (I2).
4. **`_nubeMudar.mjs`:**
   - Re-ejecutable: probado. En seco da «no queda nada por mover».
   - Recuperable: con un freno, la carpeta queda en su lugar o ya movida, y la próxima corrida sigue desde ahí.
   - `comparar()` no tiene un falso verde realista para un `rename`: compara ruta y tamaño archivo por archivo, más la cantidad de
     carpetas, y deja afuera solo los archivos de sistema de OneDrive.
   - Lo que puede perder es la evidencia (Nit 1).
5. **El informe contra el código y el registro:**
   - La tabla coincide exacto con `exports/explicaciones/nube_mudanza_2026-10-17.json`:
     - las 10 filas `ok: true` con `sin_subir_antes: 0` y `origen_sigue: false`;
     - los totales: 12.628 archivos, 2.283 carpetas, 9.277.907.132 bytes;
     - los LEEME: 6 «creado» y 2 «agregado arriba».
   - Otros datos que verifiqué:
     - la ruta más larga en SharePoint da 361;
     - el simulado es de las 22:53;
     - la salud de Carlos es del 16/10 14:02;
     - la salida temprana de `_nube.mjs --sincronizar` en main;
     - el aviso de pedidos, `_mails.py` y `cerebro-guard` con el código de main;
     - el guardián de firma de main frena la ruta nueva.
   - No se sostienen: la fila 125 y el renglón 150 (I1), el desglose de los bloqueantes (Nit 3) y el aviso de las sesiones
     abiertas, que falta (I3).
6. **Supabase, arb, `Y:`, Outlook, nube personal:** limpio. Ver la tabla de checks.
7. **Tests:** todos en verde (tabla de checks).

## Verificado como arreglado durante la auditoría
- `scripts/_programita.mjs:186-188` (commit `6c1f9532`, lo marcó el revisor-pedido). Armaba a mano `…\Claude Fak\_ESTADO.json`,
  que ya no existe (`ls` da «No such file»), y el panel de las PC quedaba vacío sin avisar (`leerEstadoNube(null)` = `[]`). Ahora
  usa `buscarNube(homedir(), {})`, que da `…\5- FACUNDO (memoria y configuracion)\_ESTADO.json` (existe, 22:52). `programita.test`:
  18 OK.
- En el mismo commit, la hora del fallo de Outlook. El informe dice ahora «desde las 12:37», y el `mails.log` lo confirma (a las
  10:37 decía «outlook_cerrado»). También quedó arreglada la skill `novedades-claude`.

## Descartado (no es falla)
- Mayúsculas o barras invertidas distintas en `5- FACUNDO…`: en Windows es la misma carpeta.
- `_mails.py` no duplica la carpeta cuando la encuentran la búsqueda nueva y la vieja. Medido con el layout viejo: una sola ruta.
- `vigia.mjs` importa `scripts/_lib/nubeRutas.mjs`, pero no viaja en el paquete: corre solo en el repo.

## Acciones requeridas
1. I1: decidir si el código del repo tiene que volver a encontrar el área en cuarentena. Según lo que se decida, corregir la
   fila 125 y el renglón 150 del informe y el nombre del caso del `.cmd`, o sacar los nombres en cuarentena de las listas de uso.
   Aparte, confirmar que `_paquete.mjs --publicar` (la base) tiene que ir a `9- VIEJO (no usar)`.
2. I2: anclar la entrada nueva de `firmaIA.data.json` (que lleve la biblioteca adelante) y agregar un caso que frene (`Y:` y
   Escritorio) y uno que pase (la carpeta real).
3. I3: un renglón sobre las sesiones abiertas (reabrir por `CLAUDE.md` y las reglas; el hook y el guardián los toman solos una vez
   en main).
4. P2: un renglón en el §1 del informe: «no correr `_nube.mjs --subir` desde main hasta fundir».
