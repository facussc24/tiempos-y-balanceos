---
name: docs-empresa
description: >
  Mapa de documentos reales de Barack (servidor Y:, OneDrive, repo, docs-local) + cache
  local `.sgc-cache/`. Usar cuando se necesite un dato de: manual SGC, procedimientos
  P-xx, instructivos I-xx, 8D, alertas, informes tecnicos, specs de cliente, normas VW,
  manuales AIAG/VDA, biblias de defectos, HOs, auditorias. Reemplaza a NotebookLM
  (retirado 2026-07-23): acceso DIRECTO a originales + extractos cacheados con cita de fuente.
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
| Manuales oficiales (AIAG-VDA FMEA 2019, SETEC p129 CC/SC, VDA, MSA, IMDS, Formel Q, IATF) | OneDrive `4- MANUALES\` — esta PC (`facun`): `C:\Users\facun\BARACK ARGENTINA SRL\Ingeniería y Proyecto - INGENIERIA BARACK (NUNCA BORRAR)\4- MANUALES\`; PC `FacundoS-PC`: `...\Ingeniería y Proyecto - General\INGENIERIA BARACK (NUNCA BORRAR)\4- MANUALES\` | leer directo (PDF; escaneados → memoria `reference_leer_pdfs_escaneados`) |
| Guias internas APQP/AMFE/CP/Gate3 | `docs/` del repo (GUIA_AMFE, GUIA_PLAN_DE_CONTROL, GUIA_GATE3...) | ya es local |
| Docs Patagonia curados (36) | `docs-local/` (junction OneDrive; en ESTA PC el junction NO esta creado — setup one-time en memoria `reference_docs_local_onedrive_junction`) | leer directo |
| ERP arb (BOMs, insumos) | `.arb-cache/` + skill `verificacion-consumos` | ya cacheado |
| APQP vivos (AMFE/CP) | Supabase live (UNICA verdad — `verify-supabase-live.md`) | NO cachear |

## Reglas de acceso — NO romper

- **OneDrive / docs-local: PROHIBIDO `du`/`find -r`/`grep -r`** (Files On-Demand hidrata y
  llena el SSD — incidente 2026-05-13). Solo `ls` superficial de UN nivel y `Read` puntual.
- Servidor `//SERVER/...`: listar por niveles (no recursivo ciego); es SMB, no hidrata,
  pero el arbol es enorme.
- `.doc` legacy → extraer con Word COM (`scripts/_extraerSgc.ps1`); `.docx` tambien via COM
  (uniforme). PDFs escaneados → PyMuPDF + Read (memoria `reference_leer_pdfs_escaneados`).
- Escribir/mover archivos EN el servidor u OneDrive = confirmar con Fak antes (autonomy-contract).

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
