# Plan P55 — Los AMFE (y los documentos APQP) fuera de Supabase, en la nube de Ingeniería

Escrito el 10/10/2026 por el orquestador (Fable 5.1) mientras esperaba una decisión de Fak. Es un plan para su sí:
nada de esto está hecho salvo la etapa 0. Regla `codigo-madre.md`: cambio grande → investigación, plan en `docs/`,
síntesis corta a Fak, su sí, hija en sesión aparte, tests, revisor independiente.

## 0. Qué pidió Fak, con sus palabras

- 01/10/2026 08:56: *"tenemos que lograr que los AMFE no dependan de Supabase, te dije usemos la nube... no en local
  porque los AMFE son de ingeniería"*. Carpeta aprobada ese día:
  `BARACK ARGENTINA SRL\Ingeniería y Proyecto - General\INGENIERIA BARACK (NUNCA BORRAR)\1- GENERAL\AMFE\DATOS\`.
- 09/10/2026 16:55 (respuesta a P55): *"apruebo totalmente, es algo grave, quiero que estén en otro lugar, en la nube,
  así todos pueden hacer los AMFE"*. Prioridad alta entre las grandes.
- Lo que no dijo y decide el tamaño del trabajo: **quiénes son "todos" y con qué herramienta "hacen" un AMFE** (la app
  en el navegador, o Claude con los scripts del repo), y **si él edita AMFE dentro de la app o solo mira y exporta**.
  Son las dos preguntas abiertas del plan del 30/09 (`docs/auto-mejora/2026-09-30-automejora-10-frentes.md` §4).

### Las respuestas de Fak (10/10/2026 18:58, por el chat)

- **La app no cuenta**: *"no edito los AMFE dentro de la app, al pedo hice la app, ni siquiera la miro, solo te
  pido todo a vos; me da igual esa app"*. → La etapa 3 (la app con adaptador de archivos) **se cae**: no hay que
  migrar la app; cuando los scripts no dependan de Supabase, la app de los AMFE queda como está o se apaga.
- **"Que todos puedan hacer los AMFE" = que estén siempre los EDITABLES en el server, en la carpeta de
  Ingeniería, "solo eso"**. El editable de un AMFE en esta casa es el Excel del formulario (`I-AC-005`), no un JSON.
  → Entra una **etapa 1b**: el Excel editable de cada AMFE vive en la carpeta de Ingeniería del server (donde ya
  viven los maestros: memoria `gestion_ingenieria_es_el_maestro`) y se regenera cada vez que el AMFE cambia por
  script (`_exportAmfeOficial`, con el marcador de auditoría o `--sin-auditoria` para la copia editable interna);
  y la vuelta (alguien edita el Excel → el importador `reference_amfe_xlsx_importer` lo trae a los datos) se hace
  por fecha y hash, sin pisar. La copia JSON en la nube (etapa 1, en curso) sigue: es lo que leen los scripts en
  cualquier PC.
- **Etapa 1**: *"no sé, qué sé yo"* → la decido yo: va (ya está en curso en la hija 3, solo la mitad Supabase →
  archivos).
- **Aviso suyo para las skills**: *"la skill de AMFE y la del plan de control van muy relacionadas porque deben
  estar alineadas; muchas veces los detectivos [controles de detección] del AMFE no coinciden con los del plan de
  control, o los AMFE de hoy tienen controles medio inventados o genéricos; ahora estamos más cancheros con los
  planes de control... luego tenemos que arreglar esas skills"*. → Va como gate del plan P6 (controles del AMFE =
  controles del plan de control, en las dos direcciones) y como fila de la cola.

## 1. Qué hay hoy (medido el 10/10/2026, no de memoria)

| Pieza | Estado |
|---|---|
| Datos en Supabase | 898 filas en 19 tablas con datos (copia del 01/10): 20 AMFE, 10 planes de control, 8 HO, 9 PFD, 10 BOM, 16 proyectos de tiempos, 25 borradores, 491 productos, familias, catálogos. Los AMFE se guardaron por última vez el 23/09 (8) y el 01/10 (12): las dos fueron tandas por script. Las filas **no tienen `updated_by`**: desde los datos no se puede saber si Fak edita en la app |
| La app (GitHub Pages, estática) | 21 repositorios tipados (`utils/repositories/`) escriben SQL en dialecto SQLite contra una interfaz `DbAdapter` (`utils/database.ts`). En producción, `SupabaseAdapter` traduce ese SQL (`utils/db/sqlTranslate.ts`) y lo manda por RPC `exec_sql_read/write`. En los 3.329 tests corre `InMemoryAdapter`, un intérprete SQL propio (no SQLite). Un solo usuario (Fak). Locks entre usuarios en tabla (`document_locks`, TTL 2 min). El servicio de respaldo de la app es un stub: no hace nada |
| Scripts | 62 se conectan a Supabase, todos por dos librerías: `scripts/_lib/amfeIo.mjs` (leer/escribir, con guards y conteos derivados) y `_lib/supabaseSoloLectura.mjs` (la noche). Sin `.env.local` no funcionan: **la PC de Pedro, la de Carlos o la CATA no pueden ni leer un AMFE** |
| La nube (etapa 0) | Hecha el 01/10 con `scripts/_datosExportar.mjs`: un JSON por documento (`<tabla>/<id>.json`, `data` parseada, formato canónico), catálogos en un archivo por tabla, `_manifest.json` con sha256 y conteos; 898 de 898 verificados. **Nadie la regenera desde entonces**: los cambios del 02 al 10/10 no están. Solo lectura sobre Supabase, nunca borra |
| Historial de versiones de SharePoint en esa biblioteca | **Sin verificar** (la memoria lo dice desde el 01/10). Es lo que reemplazaría a git para la historia de cada AMFE |
| Supabase | Login de 1 usuario, RLS, RPC. Sin Storage, Realtime ni Edge Functions. Lo que dolió: pausa del plan free (21/09), backups vacíos 19 días sin error, JSON como TEXT (8 AMFE ilegibles el 06/04), esquema no reconstruible desde el repo, sin historia de cambios |

## 2. Mirá, creo que lo que querés es esto

"Así todos pueden hacer los AMFE" = **cualquier persona de Ingeniería, con su Claude en su PC y la biblioteca
sincronizada, puede leer, crear, corregir y exportar un AMFE sin claves de Supabase y sin pasar por la PC de Fak**,
y el AMFE queda en un lugar de la empresa (la biblioteca), no en un servicio de afuera que se puede pausar.

Eso lo dan las **etapas 1 y 2** (sincronización + scripts leyendo la nube) **sin tocar la app**: hoy un AMFE se crea y
se corrige por script (`_crearAmfe*.mjs`, `amfeAutoria.mjs`) y se exporta por script (`amfe-export-oficial`); la app lo
muestra. La app deja Supabase en la etapa 3, que es la grande y la que menos cambia lo que "todos" pueden hacer.

Si Fak contesta que él **edita** AMFE adentro de la app todos los días, la etapa 3 sube de prioridad; si solo mira y
exporta, puede esperar meses.

## 3. Opciones para la app (etapa 3), con lo que cuesta cada una

| | Qué es | A favor | En contra |
|---|---|---|---|
| **A** La app sigue en Supabase como COPIA; la nube manda | sync bidireccional por `updated_at` y sha256 (etapa 1) | lo más barato; si Supabase se pausa, la app para pero los datos están en la nube y los scripts siguen | Supabase no se apaga; sigue habiendo claves y un plan free que puede pausarse |
| **B** Adaptador de archivos en la app | `FilesAdapter` = el `InMemoryAdapter` de los tests + carga de los JSON de la carpeta al arrancar + escritura por documento al guardar, con la File System Access API del navegador (Chrome/Edge: un clic para elegir la carpeta la primera vez, el permiso se recuerda) | sin servidor, sin Supabase, la app sigue en GitHub Pages; los 21 repositorios no cambian; cada PC con la biblioteca sincronizada abre la misma carpeta | el intérprete SQL propio cubre lo que usan los tests, **no está medido** contra todo el SQL de producción; los locks entre usuarios se pierden (hoy hay un solo usuario); OneDrive puede tardar en sincronizar y dos PC pueden pisarse (regla: archivo más nuevo gana + copia de conflicto); solo Chrome/Edge |
| **C** Servidor local (Node) en cada PC que sirva la app y escriba en OneDrive | `localhost` | sin límites del navegador | una pieza más que instalar y mantener en cada PC; descartada salvo que B no alcance |
| **D** SharePoint / Graph API desde el navegador | la app habla con la biblioteca por Microsoft | sin sync local | alta de aplicación en Azure AD por IT de Barack; descartada por ahora |

Recomendación: **A ahora (es la etapa 1), B como etapa 3 si Fak edita en la app**, medida antes con la copia.

## 4. Etapas (cada una cerrada, probada y commiteada antes de la siguiente)

1. **Sincronización y escritura doble** (mediano; hija Opus; ~1 día). `scripts/_datosSincronizar.mjs`:
   Supabase → nube para las filas con `updated_at` más nuevo que el manifest; nube → Supabase para los archivos cuyo
   sha256 no coincide con el manifest (el más nuevo gana; si cambiaron los dos lados, no pisa: deja
   `<id>.conflicto-<fecha>.json` y avisa). `saveAmfe/saveCp/saveHo/savePfd` de `amfeIo.mjs` escriben también el archivo
   (write-through) cuando la carpeta está sincronizada. Corre en la noche (`nocturno.mjs`, solo lectura de Supabase +
   escritura de archivos; la escritura en Supabase desde la noche sigue prohibida: `api-claude.md`) y al cerrar sesión
   (`_cierreSesion.mjs`). Candados: nunca borra archivos ni filas; `--simular` por defecto; `--verificar` en verde
   después de cada corrida; un archivo a medio sincronizar (tamaño cambiando, `.tmp` al lado) no se lee.
2. **Los scripts leen la nube** (mediano; hija Opus). `readAmfe/listAmfes` y los `read*` de `amfeIo.mjs` leen primero el
   archivo (si la biblioteca está sincronizada) y Supabase de respaldo; `_exportAmfeOficial` igual. Con eso una PC sin
   `.env.local` lee, crea y exporta. 30 días con las dos fuentes y el sync reportando diferencias: tienen que ser cero.
3. **La app** (grande; hija Fable; con el sí de Fak y un revisor): opción B detrás de `VITE_DATA_BACKEND=files`, primero
   solo lectura (la app muestra lo de la nube) y después escritura. Antes, medir el hueco del `InMemoryAdapter` contra el
   SQL real de producción (registrar cada SQL que pasa por `sqlTranslate` un día de uso) y cerrarlo. Se prueba con una
   COPIA de la carpeta, nunca con la de verdad (`LECCIONES`: lo que construyo lo prueba otro, contra la carpeta falsa).
4. **Apagar Supabase**: 30 días en solo lectura; después Fak decide.

## 5. Lo que necesita a Fak (por el chat, tres renglones)

1. ¿Editás AMFE **adentro de la app**, o solo mirás y exportás? (decide si la etapa 3 va ahora o en meses)
2. "Todos": ¿quiénes, y con qué herramienta? (si es cada uno con su Claude, las etapas 1 y 2 alcanzan)
3. OK a la etapa 1: escribe archivos en `1- GENERAL\AMFE\DATOS\` de la biblioteca y filas en Supabase (las dos cosas
   que el contrato de autonomía marca preguntar).

## 6. Cómo se prueba y qué puede salir mal

- Sync: tests con carpeta temporal y un Supabase falso (las dos direcciones: cambio de un lado, del otro, de los dos);
  corrida real con `--simular`; después `--verificar`; la noche lo reporta en su resumen.
- OneDrive: Files On-Demand (un archivo deshidratado se hidrata antes de leer); sincronización en curso (no leer a
  medias); dos PC sobre el mismo AMFE (copia de conflicto, nunca pisar). Memorias `reference_onedrive_sync_colgado_como_detectarlo`,
  `reference_onedrive_files_on_demand_liberar_espacio`.
- Historial de versiones de SharePoint: verificarlo en la web antes de la etapa 2 (si no está activo, pedirlo a IT o
  dejar el historial en el manifest por fecha).
- La copia de la nube ya está vieja: la etapa 1 arranca con una exportación fresca y `--verificar` (898 → lo que haya hoy).
- Claves: ninguna va a la nube (el export ya se revisó sin claves); `_gateRepoPublico` sigue para el repo.

## 7. Revisión independiente por la API (Opus, 10/10 19:00, US$0,30; `.sgc-cache/sesion-2026-10-10/API_P55_revision_opus.md`)

Lo que cambia el diseño de la etapa 1 (se le pasó a la hija 3 el mismo día):

1. **La base del sync no puede ser `_manifest.json`** (un solo archivo que OneDrive sincroniza aparte de los
   documentos: la PC B puede recibir el manifest nuevo con el documento viejo y «ver un cambio» que no existe; y dos PC
   lo reescriben a la vez). La base vive **en cada PC, sin sincronizar** (TEMP o `.claude/state`), o adentro de cada
   documento (`_base_sha`).
2. **Hace falta un registro de borrados** (lápidas): sin eso, «nunca borra» resucita en Supabase un documento que se
   borró en la app.
3. **`updated_at` no decide qué es más nuevo**: `saveHo` y `savePfd` no lo tocan, la tabla no tiene trigger y es la
   hora de cada PC. Cambios por **hash de contenido de los dos lados**; `saveHo`/`savePfd` pasan a actualizarlo.
4. **El exportador de hoy pisa lo editado en la nube** (`escribirArchivos` escribe siempre que difiere): no escribir si
   el archivo cambió respecto de la base; dejar conflicto.
5. **Leer-modificar-guardar sin versión**: `saveAmfe` recibe el sha esperado y aborta si el actual es otro.
6. **Copias de conflicto de OneDrive (`<id>-PCNOMBRE.json`) y archivos deshidratados**: la corrida aborta, no los lee
   como «no existe». Lo del «.tmp al lado» no es como escribe OneDrive (lo de las escrituras propias sí: temporal +
   rename).
7. **Si Supabase se pausa, la escritura doble no puede dejar de escribir el archivo**: hoy `saveAmfe` falla en el
   UPDATE antes de escribir; el archivo se escribe igual y la diferencia se reporta. Y `.env.local` **nunca** va a la
   biblioteca (es la clave con permiso de escritura).
8. **Al subir de la nube a Supabase va solo `data`, por `saveAmfe`** (los contadores derivados se recalculan), nunca la
   fila entera del archivo.
9. **`drafts` y `document_locks` no se sincronizan en las dos direcciones; los catálogos en archivo único
   (`products.json`) chocan por el archivo entero**: una fila por archivo o solo bajada.
10. **Las tres pruebas obligatorias de la etapa 1**: idempotencia (guardar y sincronizar enseguida = 0 escrituras);
    no pisar lo ajeno (archivo cambiado en la carpeta + fila cambiada en el Supabase falso → no escribe, conflicto
    registrado; ilegible / deshidratado / copia `-PC` → aborta; Supabase con error o 0 filas → no toca la carpeta);
    falla parcial (Supabase bien y el archivo falla, y al revés → reportado y reparado en la corrida siguiente, sin
    archivos truncados ni manifest que describa lo que no está).
11. Sobre la etapa 3 (ya caída por la respuesta de Fak): el intérprete SQL propio era la peor base; la alternativa
    era SQLite real en el navegador (sql.js / wa-sqlite) o la app en solo lectura.

## 8. Fuentes

`utils/database.ts` (DbAdapter, InMemoryAdapter línea 1028, SupabaseAdapter 1733, getDatabase 2003) ·
`utils/db/sqlTranslate.ts` · `utils/repositories/index.ts` · `scripts/_lib/amfeIo.mjs` (saveAmfe 213) ·
`scripts/_datosExportar.mjs` · la copia en la nube y su `_manifest.json` (01/10) · memoria
`project_datos_amfe_en_la_nube` · plan 30/09 §4 · cola `docs/COLA_CAMBIOS_CODIGO.md` (P55) · skill `apqp-schema`.
