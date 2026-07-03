# Historial de incidentes que originaron las reglas AMFE/APQP

> Archivado 2026-07-03 al consolidar `.claude/rules/` (las 8 reglas amfe-* se fusionaron en `amfe.md`).
> Este archivo conserva la narrativa historica; la regla operativa vigente vive en `.claude/rules/amfe.md`.
> Los textos completos originales estan en git history (pre commit de consolidacion 2026-07-03).

| Fecha | Incidente | Regla resultante |
|---|---|---|
| 2026-03-30 | 408 acciones de optimizacion inventadas por Claude en los 8 AMFEs; ninguna decidida por el equipo APQP. Todas eliminadas. | NUNCA inventar acciones (amfe.md §5) |
| 2026-04-06 | 8 AMFEs ilegibles por double-serialization JSONB (`JSON.stringify` en `.update`). 56 causas con AP incorrecto por usar formula S*O*D (item S=10 quedo M). | database.md; AP solo tabla oficial |
| 2026-04-08 | Scripts .mjs usaron nombres de campo incorrectos (description vs name, operationNumber sin opNumber) y rompieron el export Excel completo. | Aliases obligatorios (amfe.md §14) |
| 2026-04-12 | `operationFunction` no se propago de maestro a variantes en 3 Headrest; quedo vacio. | 3 niveles de funcion |
| 2026-04-13 | FlowchartApp importo `html-to-image` sin `npm install`; 3 deploys consecutivos fallidos. | git-deploy.md (build antes de push) |
| 2026-04-20 | (a) Export PFD destruido en produccion por Tailwind arbitrary values sin test local. (b) Sync indebido del maestro inyeccion plastica a 3 Headrest (no tienen inyeccion plastica, solo PU): OP 40 rotulada "INYECCION DE SUSTRATO" con fallas de costura. (c) Auditoria detecto 49 causas AP=H sin accion; Fak autorizo placeholder "Pendiente definicion equipo APQP" como default. | Verificar contenido antes de clasificar (amfe.md §10); placeholder AP=H (§4) |
| 2026-04-21 | "CLASIFICACION Y SEGREGACION" eliminada como OP separada (implicita en control final) en 4 AMFEs + 7 PFDs. OP 45 "Colocado de Clips" eliminada de Telas Planas (no lleva clips; usa APLIX y ganchos). | Estructura de OPs |
| 2026-04-22 | (a) Export OP80 Telas Planas con celdas vacias: 35 failures con `fm.severity=""` mientras `cause[].severity` tenia valor. (b) Columna "Funcion del Elemento" vacia en Top Roll: 148 gaps de alias desync en 7 AMFEs. Ambos resueltos con syncLegacyFmFields/syncFieldAliases + checks del validator. | fm legacy + aliases (amfe.md §14) |
| 2026-04-27 | 22 controles inventados en Top Roll y otros: "hielo seco" (Barack no usa), "medicion por ultrasonido cada 2 horas" (el ultrasonido suelda, no mide), "flexometro" (espanolismo), "rotacion de inspectores cada 2 horas". | NUNCA inventar controles (amfe.md §6) |
| 2026-05-04 | Falso positivo: se reporto OP 72 "faltante" en un PFD leyendo un dump de `tmp/` pre-patch. La OP habia sido eliminada ese mismo dia en Supabase. | verify-supabase-live.md |
| 2026-05-08 | AMFE 150: (a) las 10 OPs con `operationFunction` copiado literal de `focusElementFunction` (2 columnas identicas en Excel); (b) WEs con `function.description` = etiqueta 6M generica ("Metodo de Fabricacion"). Una regex parcial no lo detecto → leccion: lista canonica + normalize, no regex parcial. | 3 niveles (amfe.md §8); GENERIC_LABELS (§7) |
| 2026-05-14 | Renumeracion de 14 OPs en AMFE-HF-PAT sin leer contenido WE-por-WE: quedaron "Proceso Op 10" como WE.name, fallas de costura en OP CORTE, "Maquina" generica, y numeros viejos dentro de WE.name. Luego, el fix masivo puso "Pendiente definicion equipo APQP" en 30 WEs sin cross-reference — 23 tenian nombre real recuperable de otros AMFEs ("Autoelevador", "Maquina de coser industrial", "Inyectora de poliuretano"). Fak: "tenes que tener criterio, busca info en otros AMFEs antes de inventar placeholder". | Leer contenido antes de renumerar (amfe.md §10); placeholder ultimo recurso (§7) |
| 2026-05-17 | Sesion soft-snacking-elephant: (a) 9 causas AP=H sin accion en AMFE 150 → fix + check CAUSE_APH_EMPTY; (b) "Pais de origen ausente" con S=5 pese a efecto legal aduanero → S=7 + check legal-compliance; (c) 85 WEs Man renombrados a los 4 roles canonicos; (d) "Pistola etiquetadora" en EMBALAJE corregida a "Etiquetadora impresora" (2 casos); (e) corte=scrap (Fak: "si se corta mal no hay vuelta atras"); (f) parametros numericos movidos del AMFE al CP (2 fallas); (g) vocabulario Claude limpiado (15 controles); (h) confirmado Mesa/fixtures=Machine por AIAG-VDA; (i) decision: PFDs no se hacen mas aca; (j) placeholder AP=H no requiere responsable/dueDate. | amfe.md §§1,4,9,11; no-pfd-no-ho.md |
| 2026-05-22 | (a) Decision "el manual es la ley": criterio CC/SC alineado al manual AIAG-VDA 2019 pag 129 (deprecada la prohibicion previa de SC=S>=5∧O>=4). (b) Decision: HOs se hacen manuales fuera del software. | amfe.md §2; no-pfd-no-ho.md |
| 2026-06-25 | Deprecada la regla de sincronizacion 2 PCs ("solo vamos a laburar en esta"). Protocolo git fetch/pull de inicio eliminado. | (regla two-pc-sync borrada) |
| 2026-06-26 | Candado anti-invento ejecutable: `core/amfe/forbiddenContent.data.json` + `scanForbidden()` + checks FORBIDDEN_VOCABULARY (CRITICAL) / CLAUDE_PHRASE (WARNING) enganchados a runWithValidation. Linea base: 0 criticos, 16 warnings legacy. | Enforcement (amfe.md §6) |

## Notas de contexto conservadas

- **AMFEs canonicos "gold standard"**: AMFE-ARM-PAT (recepcion, costura, inyeccion plastica+PU, tapizado), AMFE-INS-PAT (corte, troquelado, embalaje), AMFE-1 Telas Planas (mylar, APLIX, embalaje PWA).
- **Manual oficial**: AIAG-VDA Handbook 2019, traduccion SETEC, pag 129 Apendice D (tabla CC/SC/OS/HI). Ver memoria `reference_manual_amfe_setec`.
- **Ejemplo canonico de numeracion** (APB Trasero Central / AMFE 150): 10 RECEPCION, 11 CONTROL MP, 20 CORTE, 30 KITS, 40 COSTURA UNION, 50 INYECCION PUR, 60 TAPIZADO, 70 CONTROL FINAL, 80/82 REPROCESOS, 90 EMBALAJE.
- Los TODOs de validaciones pendientes que vivian en las reglas (checks 3.A1-3.A3 de funciones en `_auditAll.mjs`, checks WE_GENERIC_PLACEHOLDER/FN_GENERIC_PLACEHOLDER) quedaron implementados via `_auditWePlaceholdersAndAllocation.mjs` y el candado anti-invento; si falta alguno, es mejora a proponer, no regla.
