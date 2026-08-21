---
description: Reglas del modulo AMFE — severidades, CC/SC, funciones VDA, work elements, controles, placeholders, scripts y schema
paths:
  - "modules/amfe/**"
  - "core/amfe/**"
  - "utils/seed/**"
  - "scripts/**/*mfe*.mjs"
  - "scripts/**/*MFE*.mjs"
  - "scripts/_lib/**"
  - "scripts/_auditAll.mjs"
  - "scripts/_auditWePlaceholdersAndAllocation.mjs"
  - "scripts/_auditInventos*.mjs"
  - "scripts/_auditTextQuality.mjs"
  - "scripts/_auditStructureV2.mjs"
  - "scripts/_auditarArbolNuevo.mjs"
  - "scripts/_readiness.mjs"
  - "scripts/_healWeNameByCrossRef.mjs"
  - "scripts/_generarListadoMaestro.mjs"
  - "scripts/_importListadoMaestro.mjs"
  - "scripts/_regenerar*.ts"
  - "scripts/_oficializarRevision.ts"
  - "scripts/_export*.ts"
---

# AMFE VDA — Regla consolidada

> Detalle profundo (ejemplos extensos, vectores de test, SQL de auditoria, calibraciones caso por caso): skill **`amfe-domain`**.
> OPs de inyeccion (plastica o PU): skill **`injection-process`**.
> Recetas para completar gaps: skill **`amfe-cookbook`**. Guia de autoria: `docs/GUIA_AMFE.md`.
> Historial de incidentes que originaron estas reglas: `docs/_archive/INCIDENTES_REGLAS_AMFE.md`.

## 1. Severidades calibradas — piezas de cabina interior

| Rango | Aplica a | Ejemplos |
|-------|----------|----------|
| S=9-10 | Flamabilidad, emisiones VOC, interferencia airbag, bordes filosos | TL 1010 VW, REACH |
| S=7-8 | Falla de encastre severa que para linea VW, desprendimiento en campo | Clips rotos, deformacion estructural |
| S=5-6 | Arrugas masivas, delaminacion, costura torcida, ruidos en el uso, retrabajo offline | Burbuja en termoformado |
| S=3-4 | Cosmetico menor, hilo suelto, mancha limpiable, retrabajo in-station | Color desparejo con luz rasante |

**Efecto legal/aduanero → S>=7 obligatorio.** Si algun efecto (local/next/endUser) menciona incumplimiento legal, retencion aduanera, declaracion de origen, multa o sancion legal: TODAS las causas de ese failure van S>=7 (multa/retencion=7, para linea cliente=8, recall/judicial=9, dano a personas=9-10). Enforcement: check `CAUSE_LEGAL_COMPLIANCE_UNDERCALIBRATED` (CRITICAL) en `scripts/_lib/amfeValidator.mjs`. No confundir con menciones genericas de "legal" sin consecuencia.

**Corte = SCRAP, no retrabajo.** En OPs de CORTE/TROQUELADO el material mal cortado no tiene vuelta atras: `effectLocal` = "Scrap del material mal cortado", NUNCA "retrabajo". Retrabajo es valido en costura (descoser), inyeccion plastica (corte de rebabas), tapizado (reposicionar funda). Inyeccion PU fuera de spec = scrap. Check `CUTTING_EFFECT_REWORK_SUSPECT` (WARNING).

## 2. Clasificacion de Caracteristicas Especiales (manual oficial AIAG-VDA 2019, pag 129)

Decision Fak 2026-05-22: "el manual es la ley". Criterio oficial, no reglas mas estrictas:

| Simbolo | Codigo | Criterio | Accion |
|---|---|---|---|
| ▽ | **CC** Critica | S = 9/10 | Controles especiales + Plan de Control |
| SC | **SC** Significativa | S = 5-8 **Y** O >= 4 | Controles especiales + Plan de Control |
| OS | Seguridad del Operador | S = 5-8 Y O >= 4 (efecto en planta) | Acciones de seguridad |
| HI | Alto Impacto | S = 5-8 Y O >= 4 (efecto en planta) | Enfasis |

- Flamabilidad TL 1010, VW 50180 (VOC) y EU 2000/53/EG (ELV) generan **CC obligatoria** por requerimiento legal (independiente de S/O).
- NUNCA asignar CC/SC/OS/HI sin verificar S/O previo. Si falta O: dejar "Estandar".
- **Asignar o cambiar CC/SC requiere autorizacion explicita de Fak** (autonomy-contract).
- Simbolos propios del cliente se traducen a simbologia Barack via tabla de correlacion.
- `specialChar` valores validos: `"CC"`, `"SC"`, `""`. Override manual tiene prioridad sobre calculo automatico.

**Normas por cliente:** flamabilidad VW = TL 1010; Toyota/PWA = norma propia (NO TL 1010). NUNCA extrapolar normas de un cliente a otro.

## 3. Efectos VDA — 3 niveles obligatorios

Todo modo de falla DEBE tener `effectLocal`, `effectNextLevel` y `effectEndUser` completos. NUNCA dejar un nivel vacio.

## 4. Prioridad de Accion (AP)

- AP se calcula SOLO con la tabla oficial: `calculateAP(s,o,d)` de `modules/amfe/apTable.ts`. PROHIBIDA la formula `S*O*D > umbral` (en .mjs: copiar la tabla lookup, ver GUIA_AMFE seccion 6).
- **AP=H sin accion definida** → autocompletar `optimizationAction` con el placeholder literal `Pendiente definicion equipo APQP`. Autorizado por Fak 2026-04-20 como default; un AP=H sin accion NI placeholder es bloqueo IATF. Enforcement: check `CAUSE_APH_EMPTY_NO_PLACEHOLDER` (CRITICAL).
- El placeholder **NO requiere** responsable ni dueDate (decision Fak 2026-05-17): es estado valido que senala tarea pendiente al equipo humano. NO flaggear como issue.
- NUNCA sobrescribir una accion ya definida (chequear que el texto contenga "pendiente definicion" antes de reemplazar). AP=M/L sin accion: dejar vacio.
- **Alcance del placeholder: SOLO** `optimizationAction`/`preventionAction`/`detectionAction` en causas AP=H. NO usarlo en `WE.name`, funciones ni controles (ver seccion 7).

## 5. Acciones de optimizacion — NUNCA INVENTAR

- Las acciones SOLO las define el equipo APQP humano (Carlos Baptista, Manuel Meszaros, Facundo Santoro).
- Claude SI puede: copiar acciones dictadas textualmente, eliminar confirmadas incorrectas, mover entre campos.
- Claude NUNCA: inventar acciones, copiarlas entre productos asumiendo que aplican, generar genericas ("Capacitar al operario", "Mejorar instruccion"), autocompletar campos de optimizacion (salvo placeholder AP=H, seccion 4).
- Si un prompt pide "completar acciones faltantes": RECHAZAR y explicar esta regla. (Incidente 2026-03-30: 408 acciones inventadas, todas eliminadas.)

## 6. Controles — NUNCA inventar equipos, tecnicas ni frecuencias

Aplica a `preventionControl`, `detectionControl`, `controlMethod`, `evaluationTechnique`, `sampleFrequency`, `machineDeviceTool`, `reactionPlan`.

**Cuenta como inventar:** equipos que Barack no tiene (hielo seco, ultrasonido para MEDIR — en Barack el ultrasonido SUELDA), frecuencias arbitrarias ("cada 2 horas", "cada N piezas") sin respaldo en hoja de operacion oficial, espanolismos peninsulares (flexometro→cinta metrica, ordenador→computadora, coger→agarrar; terminos tecnicos universales como calibre/micrometro/vernier son OK).

| Situacion | Accion correcta |
|-----------|-----------------|
| Falta dato y AP=H | `Pendiente definicion equipo APQP` |
| Falta dato y AP=M/L | Dejar vacio |
| Equipo conocido, frecuencia no | Equipo + "frecuencia TBD" |
| Solo se sabe que es visual | "Inspeccion visual 100%" |
| Recepcion de MP | "Verificacion segun P-14" |
| Proceso productivo | "Autocontrol segun P-09/I" |

**Frecuencias reales Barack (costura, muestra patron):** inicio de turno + tras paradas >1 hora. Otras OPs: verificar hoja de operacion, no generalizar.

**Enforcement ejecutable:** fuente unica `core/amfe/forbiddenContent.data.json` → `scanForbidden()` en `scripts/_lib/forbiddenContent.mjs`. Checks: `FORBIDDEN_VOCABULARY` (CRITICAL, bloquea --apply), `CLAUDE_PHRASE` (WARNING). Para ampliar listas: editar SOLO el .data.json.

**Correccion de un invento detectado:** NO corregir solo — confirmar con Fak (opciones: placeholder / vaciar / Fak dicta). Sincronizar AMFE→CP→HO. Backup antes.

**Jerarquia de prevencion:** poka-yoke tecnico (O=2-3) > sensor con interlock (O=3-4) > instruccion + dossier (O=4-5) > autocontrol/capacitacion (O=6-8, nunca como unico control). PROHIBIDO "Falta de capacitacion" como CAUSA (los operarios SIEMPRE estan capacitados, IATF); la causa real es defecto de proceso/metodo/sistema. "Capacitacion" si puede ser control preventivo conductual.

## 7. WE.name y funciones — placeholder es ULTIMO recurso

Antes de poner placeholder en un campo, agotar EN ORDEN: (1) cross-reference Supabase live con misma OP type en otros AMFEs (costura→ARM-PAT/INS-PAT; iny PU→"Inyectora de PUR"; recepcion→"Autoelevador"); (2) mismo producto (maestro o variante hermana); (3) AMFEs canonicos gold: AMFE-ARM-PAT (recepcion/costura/inyeccion/tapizado), AMFE-INS-PAT (corte/troquelado/embalaje), AMFE-1 (mylar/APLIX/embalaje PWA); (4) cache `.sgc-cache/operaciones/` (skill `docs-empresa`); (5) HOs preliminares en `docs-local/projects/`; (6) preguntar a Fak (tabla con 1 pregunta concreta por celda); (7) `TBD` (corto, NO la frase larga); (8) omitir el WE si la M no aplica al paso — moviendo sus failures al primer WE valido (no perder S/O/D).

`WE.name` es placeholder INVALIDO si: matchea `/^proceso\s+op\s+\d*$/i`; es etiqueta 6M generica (lista canonica `GENERIC_LABELS` en `core/amfe/genericLabels.ts` + `scripts/_lib/genericLabels.mjs`, comparar con normalize NFD+lowercase+trim — NUNCA regex parcial); es el `type` traducido; o contiene "Op N" con N distinto al opNumber actual (residuo de renumeracion).

## 8. Los 3 niveles de Funcion (AIAG-VDA 2019 Step 3)

| Nivel | Campo | Pregunta que responde | Cambia por OP? |
|---|---|---|---|
| 1 Item | `focusElementFunction` | Que entrega la pieza al cliente/usuario | NO — identica en todas las OPs |
| 2 Paso | `operationFunction` | Que hace ESTA operacion (verbo+objetivo+criterio) | SI |
| 3 WE | `function.description` | Que aporta este recurso 4M al paso | SI (por WE) |

- `focusElementFunction`: 3 perspectivas separadas con " / ": `Funcion Interna: ... / Funcion del Cliente: ... / Funcion del Usuario Final: ...`
- Los 3 niveles DEBEN ser distintos. Si `operationFunction` == `focusElementFunction` literal → vaciar operationFunction (el equipo define la especifica). Si `function.description` == WE.name o type traducido → placeholder copiado, corregir.
- El export imprime los 3 en columnas adyacentes: duplicados se ven inmediatamente.
- Ejemplos de redaccion y patrones: skill `amfe-domain`.

## 9. Work Elements — reglas estructurales

- **1M por linea**: cada WE es UN solo item de las 6M. PROHIBIDO "Material: Tela / Hilos / Refuerzos" (cada material en su propia fila con su cadena funcion→falla→causa).
- **Material 6M en OPs de proceso = solo INDIRECTOS** (adhesivo, grasa, solvente, concentracion lavado). Materiales directos (tela, hilo, sustrato) van en OP 10 Recepcion. Clips, film, etiquetas = componentes → WE tipo Man (riesgo de error humano). Cuchillas/troqueles = Machine.
- **Mesa/fixtures = Machine** (AIAG-VDA lista "inspection devices, fixtures" como Machine). NO mover mesas a Environment ni eliminarlas.
- **Roles canonicos Man — EXACTAMENTE 4**: `Operador de Produccion` (rutina, ~85%), `Operador de Calidad` (liberacion 1ra pieza/setup), `Inspector de Calidad` (auditorias, laboratorio, dimensional dedicado), `Lider de Produccion` (paro de linea). NUNCA variantes ("Costurera", "Operador de corte", "Lider de equipo"). Si al renombrar se duplica un WE Man en la OP: fusionar failures, no duplicar.
- **Pistola etiquetadora** = OP60 PRECINTO (espumado PU). En EMBALAJE se usa **Etiquetadora impresora**. No confundir.
- **6M completo (los 6 con >=1 WE) SOLO es obligatorio en inyeccion plastica** (skill injection-process). Otras OPs tienen los WEs que el proceso real requiere.
- "Remito", "Almacenamiento WIP" y transporte interno NO son operaciones de proceso con AMFE propio.
- Categorizacion pragmatica aceptada: (a) causas de accion del operador sobre un equipo con operador dedicado quedan en el WE Machine del equipo; (b) "Instruccion de trabajo incompleta" queda en WE Man. No usar estas excepciones para copy-paste perezoso.

## 10. Contenido antes que nombres — verificar antes de clasificar, renumerar o propagar

- NO confiar en el nombre de la OP: leer 1-2 fallas del WE antes de clasificar su tipo, reportar hallazgos o correr syncs ("INYECCION" en el nombre puede ser plastica, PU o rotulo erroneo).
- **Antes de renumerar/reagrupar/reasignar OPs**: leer contenido completo de cada OP afectada (WE.type, WE.name, function.description, failure.description); verificar coherencia semantica keyword↔OP (costura en OP CORTE = MISALLOCATED, bloquea); reportar tabla diff a Fak antes de aplicar; el conteo de WEs NO valida coherencia.
- Workflow obligatorio: `_auditWePlaceholdersAndAllocation.mjs` (pre) → resolver gaps → renumerar → re-auditar → verificar que CRITICAL no aumento. Tras renumerar, limpiar `WE.name` con numeros de OP viejos.
- Tabla keyword→OP valida completa: skill `amfe-domain`.

## 11. Redaccion — parametros, lenguaje y vocabulario

- **Parametros numericos van al CP, NO al AMFE**: `failure.description` describe el FENOMENO generico ("Ancho de costura fuera de tolerancia"), el valor exacto (5±1mm, 80-120°C) vive en `cp.specification`. Si aparece `X±Y mm`/`N°C` en un description: copy-paste del CP, limpiar.
- **Aplica igual a los CONTROLES** (`preventionControl` / `detectionControl`): va **metodo + instrumento + frecuencia + de que documento sale el criterio**, NUNCA el valor. Bien: `"Calibre digital, 3% del lote por entrega (P-10/I, plan de recepcion 1064)"`. Mal: `"...(P-10/I). Cotas: diametro 90 mm"`. La frecuencia de muestreo y los codigos de norma/procedimiento SI van. Fundamento (16/08/2026, contra el manual AMFE de `4- MANUALES` y el instructivo I-AC-005): el formulario oficial de AMFE de Barack **no tiene** columna de especificacion ni tolerancia y el de Plan de Control si; el AMFE no se distribuye y el Plan de Control si; del AMFE al CP viajan las **acciones recomendadas**, no las especificaciones. Medido: 98,4% de los controles de los 17 AMFE no lleva numero. **Como llegan los datos a Calidad entonces: por el Plan de Control**; el AMFE aporta DONDE FALTA CONTROL. Enforcement: check `CONTROL_CON_VALOR` (WARNING) en `scripts/_lib/amfeValidator.mjs`. Citas textuales: `_DECISION donde van los valores` en la carpeta de la tarea — no va al repo porque cita el instructivo interno y un manual con copyright de terceros.
- **Lenguaje simple, max 8-10 palabras por campo**: causa = que salio mal en 3-5 palabras ("Dosificacion corta"); control = que se hace ("Dossier + alarmas en panel"); sin parentesis aclaratorios, sin sinonimos rebuscados ("husillo"→"tornillo"). Si Fak no la dijo, no la uses.
- **Vocabulario Claude prohibido** (reemplazar): "Inspeccion Humana..."→"Autocontrol con [instrumento]"; "Instruccion de Trabajo (IT) visual"→"Hoja de operacion"; "Implementar/Establecer..."→verbo concreto; "(checklist)"→"Set up"; "por parte del operador o supervisor"→"operador"; "galga"→"calibre". Senales: mayusculas en terminos comunes, sigla entre parentesis repetida, verbos abstractos, frases >60 chars.
- **"SCRAP" se queda** (no traducir a "DESCARTE"). Terminos tecnicos de industria (KLT, PPAP) OK. Fak es autoridad final sobre referencias externas.
- TODO en espanol argentino, CERO ingles entre parentesis.
- Valores numericos (pesos, tolerancias, temperaturas): NUNCA confirmar ni inventar sin OK de Fak. Duda = TBD.

## 12. Familias y variantes

- UN solo AMFE por familia si el proceso es identico (4 colores del mismo headrest = 1 AMFE con todos los PN en `applicableParts`). Formato canonico de applicableParts para variantes L0-L3 (PN con puntos, sufijos .A/.B/.C, codigo color 3 letras, material): skill `amfe-domain`.
- OPs condicionales por variante: "(Aplica solo a PN X, Y, Z)" en el nombre — NUNCA documentos separados.
- **Headrest Front vs Rear NO tienen el mismo proceso, pero LOS DOS ENFUNDAN ANTES DE ESPUMAR.** HF: inserto **EPP** + varilla, 16 OPs. HRC/HRO: **solo varilla**, 14 OPs. Esa diferencia es real y no se alinea. Lo que NO difiere es el orden: en los tres el PU se inyecta **adentro de la funda ya montada** y la pieza sale terminada del molde — HF `50 enfundado / 51 varilla / 61 carga al molde / 63 PU`; HRC-HRO `50 varilla / 60 enfundado / 70 PU`. Fak 18/08/2026: *"es imposible que se inyecte sin la funda, se saldria todo el material"*, *"lo tengo 100% claro"*. ⚠️ Hasta esa fecha esta regla decia que los traseros iban "directo a PU": **era falso**, y los AMFE 153/155 tenian el tramo invertido (corregido con `scripts/_corregirOrdenApoyacabezasTraseros.mjs`). La regla se habia redactado describiendo esos mismos AMFE, asi que heredo su error — **una regla que solo describe lo que dice un documento no lo valida**, y encima prohibia tocarlo, que es lo que lo mantuvo vivo. Enforcement: check `PU_ANTES_DE_ENFUNDADO` (CRITICAL) en `scripts/_lib/amfeValidator.mjs`. SI alinear severidades de fallas comunes mal calibradas.
- **Maestros vs familias** (panel "Libreria de AMFEs Maestros"): fundacion = familia SIN productos (memberCount=0); familia = CON productos. No mezclar. El AMFE maestro NO se alinea con HOs (aplica a muchas HOs de varios productos); el AMFE de producto adopta la numeracion real de su HO fisica.
- Numeracion de OPs: lineal de 10 en 10 sin saltos; EMBALAJE siempre la ULTIMA; reprocesos justo antes (80/82 si embalaje=90); inspeccion final antes de reprocesos; sub-ops del mismo sector = misma decena (11, 35, 82).

## 13. Escalas O y D

| O | Significado | | D | Significado |
|---|---|---|---|---|
| 10 | Falla inevitable, sin control | | 10 | Sin deteccion |
| 8-9 | Frecuente (5-10% produccion) | | 8-9 | Solo se detecta en campo |
| 6-7 | Ocasional (1-2/semana) | | 6-7 | Visual por lote |
| 4-5 | Infrecuente (1/mes) | | 4-5 | 100% visual + dimensional |
| 2-3 | Rara (1-2/ano) | | 2-3 | Poka-yoke / automatica |
| 1 | Remota, nunca ocurrio | | 1 | Sensor con interlock |

## 14. Schema y scripts .mjs — OBLIGATORIO

- **Campos alias — usar AMBOS nombres** (TS usa unos, export Excel otros): `op.opNumber↔operationNumber`, `op.name↔operationName`, `fn.description↔functionDescription`, `cause.cause↔description`, `cause.ap↔actionPriority`. `saveAmfe()` en `scripts/_lib/amfeIo.mjs` llama `syncFieldAliases()` + `syncLegacyFmFields()` automaticamente; si escribis con `.update()` crudo, correrlos a mano.
- **Campos legacy fm.\*** (severity/occurrence/detection/controles/specialChar/ap a nivel failure): deprecados pero exports los leen — si `cause[].X` tiene valor, `fm.X` = max de las causas, no vacio.
- `WE.name` (NO "description"), `WE.type` ∈ {Machine, Man, Method, Material, Measurement, Environment}. Al crear/modificar datos usar SIEMPRE `failure.causes[]`, nunca los 13 campos @deprecated del failure.
- **Gate pre-commit**: todo script .mjs que toque `amfe_documents.data` usa `runWithValidation()` de `scripts/_lib/dryRunGuard.mjs` (dry-run → review → --apply). Bloquea si introduce criticos nuevos: `FIELD_ALIAS_DESYNC`, `FM_LEGACY_EMPTY_BUT_CAUSE_HAS_VALUE`, `CAUSE_APH_EMPTY_NO_PLACEHOLDER`, `FORBIDDEN_VOCABULARY`, `CAUSE_LEGAL_COMPLIANCE_UNDERCALIBRATED`, causas sin S/O/D, failures sin causas. Override `{allowNewCritical:true}` solo con OK de Fak.
- Protocolo completo de seguridad Supabase (backup, restore, verificacion JSONB): skill `supabase-safety`.

## 15. Validaciones pre-guardado (amfeValidation.ts)

A1 S/O/D parciales; A2 AP=H sin accion; A3 failure sin causas; A4 causa sin controles; A5 efectos 3-niveles incompletos; A6 CC con S<9 (exentos: flamabilidad/VOC/airbag/legal/seguridad); A7 SC con S<7. Todas warning en draft, bloqueo en approved (A7 siempre warning).

## 16. Auditor proactivo

`node scripts/_auditAll.mjs` (o `--summary`) — correr antes de cada entrega PPAP, tras importar AMFE, y al cerrar tareas de datos. Chequea estructura VDA, alias desync, fm legacy, export-critical, headers, metadata. NO chequea CC/SC ni acciones (solo humanos). Si sale limpio (0 criticos) el dataset es publicable.

## 17. AMFE nuevo — lo que ya nos costo caro (checklist de autoria)

Destilado de la tanda Patagonia (14-21/08/2026) y de la auditoria externa contra AIAG-VDA/IATF.
Cada punto operativo tiene su gate ejecutable ya cargado; esto es para no llegar al gate.

**El documento lo firma Fak y lo lee el cliente:**
1. **El log de REVISIONES cuenta que cambio del PROCESO, nunca como se redacto.** Prohibido:
   traduccion, ortografia, "replicado del AMFE de X", "(decision Fak)", "para no pisar la
   costura". Un error propio se corrige en silencio. Gate duro: `scanRevisionMeta()` en
   `_exportAmfeOficial.ts` — con una de esas frases el AMFE **no se exporta**.
2. **Vocabulario = el de los mails de Barack** (`.mail-cache`, ~1.500 mails). Ni ingles random
   (gap & flush, squeak & rattle, fit & finish, checklist) ni castellano de diccionario que
   nadie usa (enrase, chirridos, golpeteos). Gate: `ENGLISH_RANDOM_TERMS` (CRITICAL).
   **Excepcion que SI se respeta:** nombres de pieza y material como figuran en la BOM y los
   planos del cliente (`VARILLA POLE HEADREST 2HC.881.937`, `ARMREST DOOR PANEL`) — esos son
   su identidad, traducirlos rompe la trazabilidad.
3. Nada de andamiaje interno adentro del documento: `data._meta` del importador, nombres
   propios pegados a un TBD, disparadores de reuniones internas ("ASAICHI"), ids de la app.

**Coherencia que un auditor mira primero:**
4. **AP SOLO de `calculateAP`.** Gate `CAUSE_AP_MISMATCH` (CRITICAL). El 21/08 habia 54 causas
   fuera de tabla — y el fixture de nuestros propios tests tambien.
5. **Al DETALLAR una fila, la CC/SC viaja con ella.** Cuando la OP 10 paso de un renglon
   generico a un renglon por material, la CC quedo en la fila vieja y las 63 filas nuevas con
   S>=9 se quedaron sin ninguna. Aviso: `CAUSE_S9_SIN_CC` (WARNING — **asignarla es de Fak**).
   Al terminar, borrar la fila generica: duplica cobertura y es donde se esconde la CC.
6. `header.revDate` = fecha de la ultima fila de revisiones. La caratula no puede
   contradecirse sola.
7. **Un control por CAUSA.** Si las N causas de un WE tienen el control identico palabra por
   palabra, casi seguro no ataca a todas (calibrar caudalimetros no previene contaminacion
   REACH). Y un control que dice solo "Visual" esta incompleto — pero completarlo a "100%"
   sin saber el alcance real es peor: eso se pregunta, no se rellena.
8. Causas de "error humano" no existen (§6, gate `CAUSE_CAPACITACION`). Muchas ya traen la
   causa real adentro: *"...por ausencia de guia visual"* — esa es la causa; el operario
   desatento sobra.
