---
name: docs-empresa
description: >
  Mapa de documentos reales de Barack (servidor Y:, OneDrive, repo, docs-local) + cache
  local `.sgc-cache/`. Usar cuando se necesite un dato de: manual SGC, procedimientos
  P-xx, instructivos I-xx, 8D, alertas, informes tecnicos, specs de cliente, normas VW,
  manuales AIAG/VDA, biblias de defectos, HOs, auditorias; o cuando haya que buscar fotos
  o videos de una maquina, de una pieza o de un proceso (donde estan y con que se buscan).
  Reemplaza a NotebookLM (retirado 2026-07-23): acceso DIRECTO a originales + extractos
  cacheados con cita de fuente.
---

# docs-empresa — donde vive cada documento y como consultarlo

**Principio (decision Fak 2026-07-23):** Claude consulta los documentos ORIGINALES de la
empresa y mantiene `.sgc-cache/` (gitignoreado — repo publico) con extractos .md
grepeables. **El original SIEMPRE le gana al cache**: cada extracto lleva `fuente:` +
`extraido:` y para entregas se verifica contra el original (misma disciplina que
`verify-supabase-live.md`). Los 8 notebooks viejos de NotebookLM quedan en la nube de
Google: NO tocarlos, NO citarlos.

## Orden de consulta

1. `Grep` en `.sgc-cache/` (instantaneo) → si el extracto alcanza y no es entregable, usar citando fuente.
2. Original (tabla de abajo) → siempre para entregables o si el cache no tiene el tema.
3. Si la fuente no aparece en la tabla: buscar en el listado del folder padre y ACTUALIZAR esta skill.

## Mapa tema → fuente real (rutas verificadas 2026-07-23)

Raiz servidor: `//SERVER/compartido/BARACK/CALIDAD/DOCUMENTACION SGC/` (= `SGC_ROOT`; 114 entradas).

| Tema | Fuente original | Cache |
|---|---|---|
| Manual de calidad MC-00..MC-10 | `SGC_ROOT/SISTEMA/SISTEMA SGC/Manual del SGC/` (.doc, multi-rev: usar letra MAYOR) | `sgc/` |
| Procedimientos P-01..P-21 | `SGC_ROOT/SISTEMA/SISTEMA SGC/Procedimientos/` (idem multi-rev; ignorar "- copia", `~$`, `Obsoletos/`) | `sgc/` |
| Instructivos, formularios, catalogo SGC | `SGC_ROOT/SISTEMA/SISTEMA SGC/Instructivos|Formularios/` + `Catalogo SGC.xlsx` | `sgc/` |
| Biblias de defectos (APB/Inserto/IP Patagonia) | `SGC_ROOT/SISTEMA/SISTEMA SGC/Biblia de defectos *.pptx` | `specs-cliente/` |
| Organigramas | `SGC_ROOT/ORGANIGRAMAS/` + `Organigrama_Calidad_v9.pptx` | `sgc/` |
| 8D | `SGC_ROOT/8D/` | `8d/` |
| Alertas de calidad / NC / acciones correctivas | `SGC_ROOT/Alertas de calidad/`, `Acciones correctivas/`, `Acciones de mejora/` | `8d/` |
| Informes tecnicos / laboratorio / ensayos | `SGC_ROOT/INFORMES TECNICOS/`, `INFORMES DE LABORATORIO INTERNO/`, `Informes de ensayos/`, `Desvio de producto-proceso/` | `informes/` |
| Auditorias (producto/proceso/clientes/TUV) | `SGC_ROOT/AUDITORIA DE PRODUCTO/`, `AUDITORIAS DE PROCESO/`, `AUDITORÍAS DE CLIENTES/`, `Auditoria TUV/` | `operaciones/` |
| Ayudas visuales / evaluaciones tecnicas | `SGC_ROOT/Ayuda Visual/`, `Evaluaciones Tecnicas/` | `operaciones/` |
| Normas VW (24 PDF: TL/PV/VW; VOC, PPAP) | `SGC_ROOT/PPAP CLIENTES/VW/VW427-1LA_K-PATAGONIA/Normas/` | leer directo (PDF) |
| APQP cerrado + PPAP por pieza | `SGC_ROOT/PPAP CLIENTES/<CLIENTE>/<PROGRAMA>/<PIEZA>/` (34 subcarpetas AIAG) | leer directo |
| Legajos de proyecto VIVOS (I-PY-001) | `Y:\Ingenieria\Documentacion Gestion Ingenieria\Proyecto\<cliente>\<programa>\<pieza>\` (memoria `project_legajo_proyecto_barack`) | leer directo |
| Manuales oficiales (SETEC 2020 = AIAG-VDA publicado: tabla AP p116-118, P1-P3 p101-111, CC/SC p129; VDA, MSA, IMDS, Formel Q, IATF). ⚠️ El PDF de `AMFE\FMEA-AMFE-VDA-AIAG\` es un BORRADOR de 2017, no el manual 2019 | OneDrive: `C:\Users\FacundoS-PC\BARACK ARGENTINA SRL\Ingeniería y Proyecto - General\INGENIERIA BARACK (NUNCA BORRAR)\4- MANUALES\` — ojo que hay **dos** carpetas de Barack sincronizadas y la buena es `- General` (memoria `reference_onedrive_dos_carpetas_barack`) | leer directo (PDF; escaneados → memoria `reference_leer_pdfs_escaneados`) |
| Guias internas APQP/AMFE/CP/Gate3 | `docs/` del repo (GUIA_AMFE, GUIA_PLAN_DE_CONTROL, GUIA_GATE3...) | ya es local |
| Docs Patagonia curados (36) | `docs-local/` (junction a OneDrive, creado y verificado el 11/09/2026: trae `INDEX.md`, `normas-vw/`, `projects/`, `shared/`; como se rehace si se rompe: memoria `reference_docs_local_onedrive_junction`) | leer directo |
| ERP arb (BOMs, insumos) | `.arb-cache/` + skill `verificacion-consumos` | ya cacheado |
| APQP vivos (AMFE/CP) | Supabase live (UNICA verdad — `verify-supabase-live.md`) | NO cachear |

## Fotos y videos de una máquina, una pieza o un proceso — dónde están y con qué se buscan

La regla `video-maquina.md` trae el detalle, pero carga sola recién al tocar un video: cuando Fak pide **buscar**
uno (02/10/2026: *"busca le vide de cmaibo de molde en la amquina d eip core"*; 01/10: *"la foto de la pieza
entnera ? no esta en ningun lado del server?"*) no está en el contexto. Lo que hace falta para buscar, acá:

**Dónde viven** (biblioteca de Ingeniería, la ve todo el equipo; verificado en disco el 10/10/2026):

```
~\BARACK ARGENTINA SRL\Ingeniería y Proyecto - General\INGENIERIA BARACK (NUNCA BORRAR)\5- VIDEOS Y FOTOS\
    1- CLIENTES\<CLIENTE>\<PROYECTO>\<PIEZA o MAQUINA>\     (ej. NOVAX\TOP ROLL\MAQUINA MOLDEADORA IMG)
    2- SECTORES\<SECTOR>\
    2. FOTOS DE PIEZAS FONDO BLANCO\<CLIENTE>\<PIEZA>\
    3- INSTITUCIONAL\<AAAA-MM-DD - tema>\
```

Además hay dos carpetas de herramientas (`_HERRAMIENTAS\` y `_HERRAMIENTAS - buscador de fotogramas\`). En las tres
carpetas de máquina de `NOVAX\TOP ROLL\`, en la raíz van solo los originales, con el nombre
`AAAA-MM-DD - lo que se ve (IMG_xxxx).MOV`; las transcripciones, los fotogramas y los casos están adentro de
`.claude\`, y hay un `_INDICE - que hay en cada video.txt` para leer de corrido. **En el resto de la biblioteca el
nombre NO dice lo que se ve** (medido el 10/10/2026: 188 de 14.571 archivos tienen ese formato): ahí se busca por la
CARPETA (cliente, proyecto, pieza o máquina) y se mira si la carpeta trae un `INDICE` en `.txt` (el de `EDGE FOLDING`
dice de qué va cada video).

**Con qué se busca, en este orden** (los tres solo leen; medidos el 10/10/2026):

| Paso | Comando | Qué da |
|---|---|---|
| 1. Lo que ya está archivado | `node scripts/_videoBiblioteca.mjs --indice` (menos de 1 s; filtrar la salida con `grep -i "<palabra>"`) | un renglón por CLAVE (el `IMG_xxxx`, o el nombre del archivo si no tiene), con la ruta del primero que encontró: 14.507 renglones para 14.571 archivos ese día. **Si dos archivos de carpetas distintas se llaman igual, sale uno solo** (64 tapados, 19 videos): encontrada la carpeta, se lista con `ls` de un nivel |
| 2. Lo que está sin archivar | `node scripts/_materialAfuera.mjs` (de 15 a 30 s; `--buscar <palabra>` solo MARCA carpetas, no recorta) | todo lo que hay fuera de la biblioteca (Escritorio y `_EN ESPERA`, Descargas, adjuntos, `C:\Dev\_telefono`), carpeta por carpeta. Los zip los nombra y no los abre: hay que mirarlos |
| 3. El servidor | `node scripts/_catalogoServidor.mjs --buscar "palabras"` | nombres y fechas de los archivos del servidor al día del listado (decir esa fecha); el del 01/10/2026 tiene 284 videos y 9.542 fotos |

- **La palabra se busca sin tilde y por su raíz**: en esta consola `grep -i "inyección"` da 0 y `grep -i "inyecci"`
  da 14. Y con las palabras de planta y el nombre de la máquina o la pieza, no con las mías.
- **«No hay foto ni video de X» se dice recién después de los TRES pasos**, mirando las carpetas con videos o zip
  aunque su nombre no diga la palabra (01/10/2026: el video de la prensa estaba en una carpeta de tarea que no decía
  «hot press», y las fotos adentro de un zip). **Y se dice qué NO se miró**: ningún programa recorre el resto de la
  biblioteca de Ingeniería (por ejemplo `1- GENERAL\TAREAS CERRADAS\`, donde también hay fotos), y el paso 1 no ve
  otras extensiones que mov, mp4, m4v, jpg, png y heic.
- **Si piden los videos para alguien que edita, son los ORIGINALES completos**, no un recorte (Fak, 07/10/2026:
  *"lso videos origngiales videos sin editar"*). Un archivo de más de ~20 MB no va adjunto: va el link de OneDrive
  (`mail-envio.md`).
- **Antes de bajar algo del celular se cruza contra la biblioteca**: `scripts/video/tel_indice.ps1` arma el índice
  del teléfono y `node scripts/_videoBiblioteca.mjs --cruzar <indice.tsv>` dice qué ya está. El `(IMG_xxxx)` del
  nombre es lo que permite cruzar. Sin ese cruce el guardián no deja copiar.
- **El original no se borra nunca** para hacer lugar: se sube y se deja «solo en línea» (`attrib +U -P`).
- `--indice-maquinas` no es una búsqueda: ESCRIBE el índice de texto adentro de la biblioteca.
- Abrir un video lo baja entero de la nube: para ver qué hay alcanza el nombre, o la transcripción y los
  fotogramas de `.claude\`.

## Lo relevado el 01/10/2026 (proyecto "Claudes por área") — usarlo antes de ir al servidor

| Qué | Dónde (todo en `.sgc-cache/`, extraído del SERVIDOR el 01/10/2026) |
|---|---|
| SGC vigente en texto: 20 procedimientos, 13 del manual, instructivos de las 9 áreas (Calidad 58, Logística 8, Mantenimiento 6, Ingeniería 6, Dirección 3, Compras 2, Producción 1, Proyecto 1, RRHH 1) | `sgc-servidor-20261001/<AREA>/` — más nuevo que `sgc/` (julio) |
| Descripciones de puesto vigentes (49, `F-NN`) | `sgc-funciones/` (de `Manual de funciones\MANUAL DE FUNCIONES JUNIO 2026\`) |
| Dónde se guarda cada registro y cuánto tiempo (anexo P-16/I, junio 2021, por área) | `sgc-servidor-20261001/Control de los registros/` — una ruta de 2021 puede no existir hoy |
| Catálogos (lista maestra con la revisión vigente) y organigramas (enero 2023) | `empresa-extracted/catalogos-20261001/` |
| **"¿Dónde está X?" sin el servidor**: nombres y fechas de 114.054 archivos de `DOCUMENTACION SGC`, 29.469 de `Y:\Ingenieria` (6 niveles), `Y:\PRODUCCION`, `Y:\Supply Chain`, `Z:\LOGISTICA` | `node scripts/_catalogoServidor.mjs --buscar "palabras"` (catálogo en `catalogo-servidor/*.tsv`; decir siempre la fecha del listado) |
| Fichas por área (qué hace cada área, preguntas típicas con cita, huecos), puestos, mapa de rutas del servidor, dónde vive cada dato | `claude-por-area/*.md` |

Tres trampas vistas ese día: (1) la copia en PDF de la nube `3- SISTEMA DE CALIDAD SGC BARACK` está **atrás del servidor**
(P-05 B/C, P-12 D/E, P-21 E/F; 20 puestos contra 49) — no se cita desde ahí; (2) dentro de `DOCUMENTACION SGC` hay una
carpeta `BRASIL` con otra copia del sistema: la vigente es `SISTEMA\SISTEMA SGC\`; (3) lo vigente lo dice el **catálogo**
(`Catalogo SGC.xlsx`), no solo la letra mayor del nombre del archivo. Las BOM y los consumos viven en el arb, no en la nube.

## Reglas de acceso — NO romper

- **OneDrive / docs-local: PROHIBIDO `du`/`find -r`/`grep -r`** (Files On-Demand hidrata y
  llena el SSD — incidente 2026-05-13). Solo `ls` superficial de UN nivel y `Read` puntual.
- Servidor `//SERVER/...`: listar por niveles (no recursivo ciego); es SMB, no hidrata,
  pero el arbol es enorme.
- `.doc` legacy → extraer con Word COM (`scripts/_extraerSgc.ps1`); `.docx` tambien via COM
  (uniforme). PDFs escaneados → PyMuPDF + Read (memoria `reference_leer_pdfs_escaneados`).
- Escribir/mover en el servidor `Y:` = confirmar con Fak antes, y solo lo oficial en el lugar que el SGC ya tiene (`autonomy-contract.md` §D y §F). En OneDrive, el entregable propio va a su carpeta por tipo de la biblioteca de Ingeniería al cerrar la tarea (`CLAUDE.md`, fin de sesión §5).

## Cache `.sgc-cache/` — protocolo

- Estructura: `sgc/` `8d/` `informes/` `specs-cliente/` `operaciones/` + `INDEX.md` (1 linea
  por extracto: titulo | fuente | fecha extraccion). GITIGNOREADO (datos de empresa).
- Cada extracto .md empieza con frontmatter: `fuente:` (ruta original completa), `rev:`
  (letra/numero del archivo), `extraido:` (fecha). Sin eso, el extracto es invalido.
- **Multi-rev**: los originales guardan varias revisiones juntas (`P-18 Formacion D/E/F.doc`) —
  extraer SIEMPRE la letra MAYOR (regla canonica "Rev = numero/letra MAYOR").
- **Refresh**: al necesitar un tema, si el extracto tiene >30 dias o la duda es critica →
  re-listar el folder original y comparar rev. Refresh integral "cada tanto" (pedido de Fak;
  automatizarlo con cron/schedule queda para otra sesion).
- Extraccion: `scripts/_extraerSgc.ps1` (Word COM → txt → md con frontmatter). Correr por
  carpeta, no todo el arbol de una.
