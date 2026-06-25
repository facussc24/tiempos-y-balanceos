# Auditoria Plan de Control Maestro de Inyeccion - 2026-04-10

**Auditor:** cp-auditor (subagente Claude)
**Documento auditado:** `cp_documents` id `81b60cdd-1296-4821-a348-a8e3c2433b0d`
**Numero de CP:** `CP-MAESTRO-INY-001`
**AMFE fuente:** `4a5fa0d1-46ee-4d6b-b699-2cbaeb14602c` (AMFE-MAESTRO-INY-001)
**Familia:** id 15 - Proceso de Inyeccion Plastica
**Item count:** 16 (6 OP10 + 5 OP20 + 5 OP30)
**Fecha auditoria:** 2026-04-10
**Modo:** read-only (script `scripts/_auditCpInjectionMaster.mjs`, sin modificar Supabase)

---

## Resumen ejecutivo

| Severidad | Conteo |
|---|---|
| TRUE BUG (bloqueante o regla AIAG explicita) | **8** |
| ROBUSTNESS (mejora pero no bloquea uso) | **7** |
| FALSE POSITIVE (criterio dudoso, descartado) | 0 |

**Veredicto:** El CP maestro **NO esta listo** para usar como referencia tal como esta. Hay 8 fixes obligatorios antes de propagar a familias hijas, principalmente:

1. Tres filas AP=L genericas violan la regla AIAG CP 2024 (prevention con `evaluationTechnique` lleno).
2. Once items "manuales" (los 11 controles de la GUIA seccion 10) **no tienen `amfeCauseIds` ni `amfeFailureId`**: son huerfanos del AMFE, lo cual rompe la trazabilidad y la cobertura de modos de falla.
3. Cobertura del AMFE muy baja: solo 4 de 43 modos de falla del AMFE estan vinculados a items del CP (9.3%).
4. Falta el control E9 Flamabilidad (opcional segun guia, pero el maestro deberia listarlo como TBD/condicional para no perderlo en variantes).

Despues de aplicar los 8 fixes obligatorios el CP estara listo. La cobertura baja es ROBUSTNESS y refleja una calibracion conservadora del AMFE maestro (ver Seccion F).

---

## A. Integridad del documento

| Check | Resultado |
|---|---|
| A1 `typeof data === 'string'` | OK (TEXT) |
| A1 `JSON.parse(data)` retorna objeto con `header` + `items` | OK |
| A2 `items.length === 16` | OK (16 == col `item_count`) |
| A3 link `family_documents` existe | OK (id=107, family_id=15, module='cp', is_master=1, document_id correcto) |
| A4 duplicados por `cp_number` | 1 unico |
| A4 duplicados de master en family 15 module=cp | 1 unico |
| `linked_amfe_id` columna | OK (`4a5fa0d1-...`) |

**Resultado A:** Sin bugs. El documento se persiste correctamente como TEXT, parseable, item_count consistente, link unico.

---

## B. Header

```jsonc
{
  "controlPlanNumber": "CP-MAESTRO-INY-001",
  "phase": "preLaunch",
  "partName": "Proceso de Inyeccion Plastica - Maestro",
  "applicableParts": "Aplicable a todas las piezas inyectadas termoplasticas en BARACK MERCOSUL",
  "organization": "BARACK MERCOSUL",
  "responsible": "Carlos Baptista",
  "approvedBy": "Carlos Baptista",
  "plantApproval": "Gonzalo Cal",
  "coreTeam": "Carlos Baptista (Ingenieria), Manuel Meszaros (Calidad), Marianna Vera (Produccion)",
  "customerApproval": "",
  "linkedAmfeProject": "MAESTRO/INYECCION_PLASTICA"
}
```

| Check | Resultado |
|---|---|
| B1 `approvedBy` y `plantApproval` ambos no vacios | OK ("Carlos Baptista" / "Gonzalo Cal") |
| B1 `approvedBy != plantApproval` | OK (personas distintas) |
| B2 `customerApproval` campo unico | OK (presente, vacio - se firmara cuando aplique) |
| B3 coreTeam con Carlos+Manuel+Marianna | OK |
| B4 partName y applicableParts | OK (alcance amplio explicito) |
| B7 ambos approvers no vacios (no bloquea) | OK |

ROBUSTNESS B-R1: `responsible` esta poblado con "Carlos Baptista" (mismo que approvedBy). El campo "Revisado" deberia ser otra persona distinta del aprobador (regla `.claude/rules/control-plan.md` linea 63: "approvedBy y el campo Revisado NUNCA pueden ser la misma persona"). Verificar si `responsible` mapea a Realizado/Revisado. Si responsible == Revisado, hay que cambiar a Manuel Meszaros o Facundo Santoro.

**Resultado B:** Sin bugs bloqueantes. 1 ROBUSTNESS sobre el campo `responsible`.

---

## C. Validaciones de items (16 items)

### Tabla resumen por regla

Convencion: ✓ pasa, ✗ FALLA, n/a no aplica.

| # | OP | Tipo | C1 mach | C2 comp | C3 spec | C4 evtech | C5 ctrl | C6 owner | C7 plan | C8 cls | C9 PSN | C10 mix |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | 10 | Proceso M | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| 2 | 10 | Proceso L generic | ✓ | ✓ | ROB | **✗ C4** | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| 3 | 10 | Proceso manual | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| 4 | 10 | Proceso manual | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| 5 | 10 | Proceso manual | ROB | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| 6 | 10 | Producto M | ✓ | ✓ | **ROB** | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| 7 | 20 | Proceso L generic | ✓ | ✓ | ROB | **✗ C4** | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| 8 | 20 | Proceso manual | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| 9 | 20 | Proceso manual | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| 10 | 20 | Proceso manual | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| 11 | 20 | Proceso manual | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| 12 | 30 | Proceso L generic | ROB | ✓ | ROB | **✗ C4** | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| 13 | 30 | Proceso manual | ROB | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| 14 | 30 | Proceso manual | ROB | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| 15 | 30 | Producto manual | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| 16 | 30 | Producto manual | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |

### Hallazgos detallados

**TRUE BUG #1, #2, #3 (regla C4 / B4 - AIAG CP 2024):**
Items 2, 7 y 12 son las filas genericas AP=L (Fase 3.5 del generador). Tienen `processCharacteristic = "Autocontrol visual general"` (es decir son filas de PREVENCION) y al mismo tiempo `evaluationTechnique = "Inspeccion visual"`. Esto viola la regla AIAG-VDA 2024 que el propio script enuncia (lineas 12, 98, 109): en filas de prevencion `evaluationTechnique` debe estar VACIO. Ademas, `"Inspeccion visual"` esta en `VAGUE_TECHNIQUES` de `cpPreSaveValidation.ts` (linea 16), entonces tambien dispara la regla B4 como warning.

Fix: en `controlPlanGenerator.ts` la Fase 3.5 deberia setear `evaluationTechnique = ""`. El mismo bug debe estar en el generator real que produce los CPs de variantes - revisar `controlPlanGenerator.ts:Fase 3.5`.

Para el script puntual: `_fixCpInjectionMasterAp4Generic.mjs` debe actualizar items 2/7/12 setteando `evaluationTechnique = ""`. Como en filas de prevencion `controlMethod` ya tiene el control ("Autocontrol del operador segun instruccion de trabajo") la fila sigue cumpliendo C5.

**TRUE BUG #4 (cobertura AMFE - reglas C/D combinadas):**
Items 3, 4, 5, 8, 9, 10, 11, 13, 14, 15, 16 (los 11 controles "manuales" agregados a partir de la GUIA seccion 10) tienen `amfeCauseIds: []` y `amfeFailureId: undefined`. Son huerfanos del AMFE. Esto:
- Rompe la trazabilidad inversa: cualquier UI que muestre "que controles cubren este modo de falla" no los va a encontrar.
- Mete a estos items en el grupo de "filas sin link" del CP (validateFailureCoverage los ignora).
- Afecta a TODOS los items que cubren defectos reales del AMFE: por ejemplo el control de "Flujo de refrigeracion del tornillo" (item 8) deberia estar linkeado al modo de falla "Boca de alimentacion del tornillo atascada por pasta de material..." y a sus causas. Lo mismo para "Dimensional de pieza" (item 15) → modo "Dimensional NOK".

Fix: asignar `amfeCauseIds` y `amfeFailureId` a los items manuales mapeando por keyword/operacion. Esto puede automatizarse con un script post-creacion porque los nombres de los modos de falla del AMFE son explicitos.

**TRUE BUG #5 (regla C9 — falsa alarma, ver false positive abajo):**
N/A. PSN ya es solo numero. No hay bug C9.

**TRUE BUG #6 (item 6 — `specification` para fila de producto OP10):**
Item 6 tiene `productCharacteristic = "Material entregado no corresponde al especificado en la orden de compra"` con `specification = "Conforme a pieza patron y plano del producto"`. Para una fila de RECEPCION de materia prima esto no tiene sentido - no hay "pieza patron" ni "plano" para un pellet. La especificacion correcta deberia referir a la orden de compra o al certificado del proveedor (ej: "Etiqueta del bolson, certificado y orden de compra coincidentes en tipo, color y lote"). Ademas, B4 advierte en el spec generico ("Conforme a..." es uno de los GENERIC_SPECS).

Fix: cambiar `specification` del item 6 a algo concreto referido a OC/certificado.

**TRUE BUG #7 (item 5 — sensibilidad contradictoria con item 1):**
Item 5 (manual) y item 1 (proceso M del AMFE) cubren ambos "Certificado del proveedor" en OP 10. El item 1 viene de la unica causa AP=M del AMFE (id `9e60e40c-...`, sev=7) con `reactionPlanOwner = "Inspector de Calidad"`. El item 5 (manual) tiene `severity=8` y `reactionPlanOwner = "Recepcion de Materiales"`. Hay duplicacion semantica con duenos distintos para el mismo control. Ademas el item 1 dice `sampleSize="1 pieza" sampleFreq="Cada lote"` (que no tiene sentido para un certificado documental — no se inspecciona "1 pieza", se inspecciona "1 documento") mientras el item 5 dice `"1 documento" / "Por lote recibido"`.

Fix: dedupe item 1 vs item 5. Conservar item 5 (que tiene sample correcto y owner correcto), y borrar item 1 traspasando su `amfeCauseIds`/`amfeFailureId` al item 5. Asi item 5 queda linkeado al AMFE y no hay duplicacion.

**TRUE BUG #8 (regla C7 implicita / reactionPlan en item 6 — referencia P-14 ya esta, pero la frase es generica del template):**
Item 6 tiene `reactionPlan = "Contener producto sospechoso, verificar ultimas piezas, corregir proceso s/ P-14."`. La frase "verificar ultimas piezas / corregir proceso" no aplica a recepcion de MP - en recepcion la accion correcta es "Segregar lote, notificar a Calidad y proveedor s/ P-14, escalar segun severidad". Lo mismo para item 1. Esto viene de `inferReactionPlan(7, 'recepcion')` en el script, que mete el mismo template para producto y proceso. Es bug del generator, no manual.

Fix: `inferReactionPlan` cuando categoria='recepcion' deberia decir "Segregar lote, notificar a proveedor y Calidad, evaluar reposicion s/ P-14" en vez del template generico de produccion.

### ROBUSTNESS items detalle

ROB-R1 (item 5/13/14): `machineDeviceTool` valores como "Estacion de recepcion de materiales", "Estacion de mantenimiento de molde", "Plan de mantenimiento de molde" son ubicaciones/documentos, no equipos fisicos. La regla `.claude/rules/control-plan.md` linea 49 dice "Solo maquina, herramienta o dispositivo fisico". No es bloqueante (la regla acepta "dispositivo") pero podria afinarse: "Tolva secadora", "Inyectora", "Calibre dimensional", "Pulmon de mantenimiento de moldes / Sala de utiles", etc.

ROB-R2 (item 12): `machineDeviceTool = "Mesa / banco de control post-inyeccion"` es razonable pero el WE de la operacion 30 en el AMFE es "Mesa / banco de control post-inyeccion" (matchea, OK) — es ROBUSTNESS porque el item es la fila AP=L generica con "Autocontrol visual general", no tiene sentido tener machine "Mesa de control" ya que no se controla con la mesa. Mas correcto: `"Estacion del operador (autocontrol visual)"`.

ROB-R3 (item 6 spec generica): ya cubierto en TRUE BUG #6.

ROB-R4 (item 2 spec generica): la fila AP=L generica tiene `specification = "Segun instruccion de trabajo / HO de la operacion"`. No es estrictamente generica (referencia HO concreta) pero podria mejorarse a "Segun cartilla de defectos tipicos en HO-10".

ROB-R5: items 3,4 (Tolva secadora) tienen `componentMaterial = "Pellet higroscopico (ABS / PC / PA / PET)"`. Esto repite material directo en operaciones de secado/preparacion, lo cual es correcto porque OP 10 incluye recepcion+secado. OK.

ROB-R6 (sample sizes manuales): items 3-16 mezclan unidades incoherentes ("1 lectura", "1 lote", "1 documento", "1 ciclo", "1 inspeccion", "1 registro"). Funcionalmente correcto pero el campo `sampleSize` por convencion AIAG es numerico/cantidad de piezas. Podria normalizarse a `sampleSize="1"` y mover el contexto a `sampleFrequency`. No bloqueante.

ROB-R7 (item 15 TBD explicito): `sampleSize = "TBD - muestreo por lote (pendiente definir con Metrologia)"`. Esto es lo correcto segun la guia de inyeccion, pero al ir TBD el item ya no se podra propagar a familias hijas sin update. Marcar como issue para Fak.

---

## D. Cross-validation CP vs AMFE

| Check | Resultado |
|---|---|
| D1 referencias `amfeCauseIds`/`amfeFailureId` validas | OK (0 IDs invalidos) |
| D1 items sin link con AMFE (manuales) | **11/16 (68%)** — TRUE BUG #4 |
| D2 causas AP=H/M del AMFE no cubiertas | 0 (la unica AP=M esta cubierta por items 1 y 6) |
| D3 consistencia CC/SC | trivial (no hay CC ni SC) |
| D4 reactionPlanOwner obligatorio | 16/16 OK |
| D5 4M alignment machineDeviceTool vs WE | 3 nombres en CP no matchean ningun WE Machine: "Estacion de recepcion de materiales", "Calibre / gauge dimensional", "Estacion de control de calidad". ROBUSTNESS — los 3 son razonables como descripcion de equipo en recepcion/control, pero no son los nombres exactos de los WE Machine del AMFE. Ver ROB-R1. |
| D6 sample consistency | OK (las 2 filas AP=M tienen "1 pieza/Cada lote", AP=L tienen "1 pieza por lote/Cada lote", manuales tienen tamanos especificos por tipo de control). Item 16 tiene "100% / Cada pieza" coherente con autocontrol. |
| D7 cobertura de modos de falla AMFE | **4/43 (9.3%)** — ver tabla |

### D7. Cobertura por modo de falla (43 total, 4 cubiertos)

Las 4 failures del AMFE cubiertas son las que vienen via `amfeFailureId` de los items 1, 2, 6, 7 y 12. Quedan **39 modos de falla SIN cobertura aparente**. Sin embargo, esta cifra es enganosa: los 11 items "manuales" (3-5, 8-11, 13-16) cubren conceptualmente muchos de esos modos, lo que pasa es que no estan linkeados explicitamente. Ejemplos de matches obvios que requieren linkear:

| AMFE failure (uncovered) | CP item manual que la cubre |
|---|---|
| OP10 "Tiempo de secado insuficiente" | Item 4 "Tiempo de secado del pellet" |
| OP10 "Lectura de temperatura de secado incorrecta" | Item 3 "Temperatura de tolva secadora" |
| OP10 "Certificado del proveedor faltante, ilegible o no conforme" | Item 5 "Certificado del proveedor del lote" |
| OP20 "Boca de alimentacion del tornillo atascada por pasta..." | Item 8 "Flujo de refrigeracion del tornillo (garganta)" |
| OP20 "Parametros de otro producto cargados por error en la inyectora" | Item 9 "Parametros de proceso vs dossier del producto" |
| OP20 "Dossier desactualizado..." | Item 9 |
| OP20 "Pasos criticos del procedimiento de arranque omitidos" | Item 9 |
| OP20 "Lectura incorrecta por instrumento descalibrado" | Item 8 (parcial), o requiere control de calibracion (no esta en GUIA seccion 10) |
| OP20 "Aire comprimido contaminado..." | Item 11 "Filtro de aspiradora" (parcial — falta filtro de aire) |
| OP20 "Linea de junta del molde desgastada..." | Item 14 "Mantenimiento preventivo de molde" |
| OP20 "Canales de refrigeracion del molde obstruidos" | Item 13 "Limpieza de molde al bajarlo" + item 14 |
| OP20 "Expulsores rotos o desgastados" | Item 14 |
| OP20 "Orificios de venteo del molde tapados" | Item 13 + item 14 |
| OP20 "Insertos o machos del molde danados" | Item 14 |
| OP20 "Rebabas (flashes) en pieza inyectada" | Item 16 "Inspeccion visual 100% defectos tipicos" |
| OP20 "Pieza deformada" | Item 16 + item 15 (dimensional) |
| OP20 "Quemaduras en pieza inyectada" | Item 16 |
| OP20 "Chupados (rechupes / sink marks)" | Item 16 |
| OP20 "Dimensional NOK" | Item 15 "Dimensional de pieza inyectada" |
| OP20 "Color no conforme" | Item 16 (parcial — el pattern board cubre apariencia, color especifico no) |
| OP20 "Peso NOK" | NO COBERTO — falta item de balanza/peso |
| OP20 "Rayas / marcas en la superficie de la pieza" | Item 16 |
| OP30 "Calibre danado o desgastado" | NO COBERTO — falta item de control de calibracion del calibre (gestion de equipos de medicion) |
| OP30 "Pattern board desactualizado" | NO COBERTO — falta item de control de pattern board |
| OP30 "Iluminacion insuficiente" | NO COBERTO — falta item de control de iluminacion del puesto |
| OP30 "Pieza OK marcada con etiqueta incorrecta" | NO COBERTO — falta item de control de trazabilidad/etiquetado |

**Causas reales sin cobertura del CP** (despues de mapear los manuales): aproximadamente 6-8 modos de falla. Los demas se cubren conceptualmente con los items manuales pero requieren `amfeCauseIds`/`amfeFailureId` explicitos.

**Acciones D7:**
1. (BUG #4) Linkear los 11 items manuales a sus failureIds correspondientes.
2. (ROB) Agregar 4-6 items extras al CP para cubrir modos no cubiertos: Peso NOK, Calibracion del calibre, Pattern board, Iluminacion del puesto, Etiquetado/trazabilidad, Filtro de aire comprimido (separado del filtro de aspiradora).

---

## E. Cobertura de los 13 controles obligatorios (GUIA_INYECCION seccion 10)

| # | Control obligatorio | Esta en CP | Item(s) | OP |
|---|---|---|---|---|
| E1 | Certificado del proveedor | SI (2x) | items 1, 5 | 10 |
| E2 | Temperatura de tolva secadora | SI | item 3 | 10 |
| E3 | Tiempo de secado del pellet | SI | item 4 | 10 |
| E4 | Flujo de refrigeracion del tornillo / garganta | SI | item 8 | 20 |
| E5 | Parametros de proceso vs dossier | SI (3x) | items 9, 13 (limpieza tiene dossier), 14 | 20, 30 |
| E6 | Fuerza de cierre de la inyectora | SI | item 10 | 20 |
| E7 | Inspeccion visual de pieza (defectos tipicos) | SI | items 7, 12, 16 | 20, 30 |
| E8 | Dimensional con calibre | SI | item 15 | 30 |
| E9 | **Flamabilidad del material** | **NO** | — | — |
| E10 | Limpieza de molde antes de bajarlo | SI | item 13 | 30 |
| E11 | Lubricacion de molde | SI | item 13 (combinado con limpieza) | 30 |
| E12 | Mantenimiento preventivo de molde | SI | items 13, 14 | 30 |
| E13 | Filtro de aspiradora | SI | item 11 | 20 |

**Cobertura: 12/13 (92%)**

**Falta E9 Flamabilidad.** La guia dice "opcional, solo si cliente lo requiere", pero al ser un CP MAESTRO deberia listarse como item condicional (con `sampleSize="Por lote"`, `sampleFrequency="Cuando aplique"`, `specification="Norma de flamabilidad del cliente (TL 1010 VW para VWA u otra)"`, `controlMethod="Certificado de laboratorio"`, `reactionPlanOwner="Laboratorio"`, `controlProcedure="Segun P-10/I."`). Si no esta en el maestro, los CPs hijos pueden omitirlo y quedar fuera de cumplimiento para piezas de cabina interior VW.

---

## F. Observaciones sobre calibracion del AMFE maestro (NO bugs del CP)

Estas son observaciones para Fak sobre el AMFE maestro de inyeccion. NO son bugs del CP en si, sino consecuencias de un AMFE conservador.

**Stats AMFE actual:**
- 65 causas totales
- 0 AP=H
- 1 AP=M (la unica)
- 64 AP=L

Esto es muy plano. Ningun proceso de inyeccion plastica deberia tener 0 AP=H si tiene un solo modo de falla critico. Posibles ajustes a discutir con Fak:

**F1.** "Dimensional NOK en pieza inyectada" (impide montaje en cliente VW):
- Actual: probablemente S=6, O=4, D=6 (AP=L)
- Sugerido: S=7-8 (falla de encastre que para linea VW, ver `.claude/rules/amfe.md` linea 10), O=4-5, D=4 → AP=M

**F2.** "Humedad residual en pellet" (causa delaminacion / ampollas / rafagas plateadas):
- Actual: probablemente O=2 (baja)
- Sugerido: O=3-4 — la frecuencia con que ocurre cuando no hay control estricto de tolva secadora es alta, especialmente en arranques o cambios de turno.

**F3.** "Boca de alimentacion atascada por pasta de material" (refrigeracion garganta fallando):
- Actual: probablemente D=6 (deteccion moderada)
- Sugerido: D=8 — no hay sensor automatico de flujo de agua en la garganta segun la guia, solo verificacion manual al arranque. Una falla de bomba media-produccion no se detecta hasta que aparece la pasta.

**F4.** "Falta de llenado (pieza incompleta)":
- Actual: probablemente AP=L
- Sugerido: revisar — si el cliente VW tiene tolerancia 0% para piezas incompletas (es defecto visual obvio que se detecta facil), AP=L puede ser correcto. Pero si la deteccion depende del autocontrol del operador (D=6-7), y la severidad para el cliente es 6-7, deberia ser AP=M.

**F5.** "Quemaduras en pieza inyectada":
- Actual: probablemente AP=L
- Sugerido: si la pieza es visible en el habitaculo (parte de IP, armrest, top roll), S=6 ("cosmetico mayor / retrabajo offline") y O=4-5 → puede ser AP=M.

Si Fak aprueba estos ajustes, varias causas pasarian de AP=L a AP=M, generando filas individuales en el CP en vez de quedar agrupadas en las 3 filas genericas (items 2, 7, 12). Eso aumentaria automaticamente la trazabilidad y resolveria parte del problema de cobertura del Seccion D.

---

## Lista priorizada de bugs a fixear

### Bloqueantes (TRUE BUG)

1. **C4-1 / Items 2, 7, 12 (AP=L genericas) violan AIAG CP 2024.** Setear `evaluationTechnique = ""` en filas de prevencion. Fix tambien aplica al generator (`controlPlanGenerator.ts:Fase 3.5`) — repetir el bug en CPs futuros si no se arregla en codigo. 3 items afectados.

2. **D7 / Cobertura AMFE en items manuales.** Asignar `amfeCauseIds` y `amfeFailureId` a los 11 items manuales (3, 4, 5, 8, 9, 10, 11, 13, 14, 15, 16). Mapeo sugerido en tabla D7.

3. **Item 6 / `specification` incorrecta.** Cambiar de "Conforme a pieza patron y plano del producto" a "Etiqueta del bolson, certificado del proveedor y orden de compra coincidentes en tipo, color, lote y fecha".

4. **Items 1 y 5 / dedup certificado del proveedor.** Conservar item 5, mover su `amfeCauseIds`/`amfeFailureId` desde item 1, y eliminar item 1. Resultado: 15 items.

5. **Item 6 y item 1 / `reactionPlan` template equivocado para recepcion.** Cambiar plantilla `inferReactionPlan(_, 'recepcion')` a "Segregar lote, notificar a proveedor y Calidad, evaluar reposicion s/ P-14". Bug del generator.

6. **E9 / Falta control de Flamabilidad.** Agregar item condicional al CP maestro (ver Seccion E para template).

7. **Item 15 / `sampleSize` y `sampleFrequency` con TBD explicito.** Definir muestreo con Metrologia antes de usar el CP en familias hijas. (Bloqueante porque no se puede propagar como esta.)

8. **Item 1 / `sampleSize` incoherente.** Si se mantiene el item 1 (no se hace dedup con item 5), corregir `"1 pieza"` por `"1 documento"` ya que es certificado. Si se aplica el fix #4, este desaparece.

### No bloqueantes (ROBUSTNESS)

R1. Header `responsible` = approvedBy (Carlos Baptista). Cambiar a Manuel Meszaros o Facundo Santoro si `responsible` mapea a "Revisado".

R2. ItemS 5, 13, 14: `machineDeviceTool` con descripciones genericas ("Estacion de recepcion de materiales", "Estacion de mantenimiento de molde", "Plan de mantenimiento de molde"). Mejorar a equipos fisicos.

R3. Item 12: `machineDeviceTool = "Mesa / banco de control post-inyeccion"` para fila de autocontrol. Cambiar a "Estacion del operador" o "Puesto de autocontrol".

R4. Items 3, 4, 5, 8-11, 13-16: normalizar `sampleSize` a numero ("1") y mover unidad a `sampleFrequency`.

R5. Item 11: el nombre del control "Filtro de aspiradora" es correcto pero no cubre el filtro del aire comprimido. Considerar agregar control separado para "Calidad de aire comprimido" (cubre causa OP20 "Aire comprimido contaminado con agua o aceite").

R6. Agregar items para cubrir modos de falla huerfanos:
- "Peso de pieza inyectada" (balanza) cubre "Peso NOK"
- "Verificacion de calibracion del calibre" (programa de gestion de equipos de medicion)
- "Verificacion de pattern board" (vigencia del documento)
- "Iluminacion del puesto de control"
- "Etiquetado y trazabilidad de pieza"

R7. Discutir con Fak la calibracion del AMFE maestro (Seccion F) para que mas modos de falla pasen a AP=M y se generen filas individuales en el CP.

---

## Recomendaciones no bloqueantes

1. **Test unitario:** crear un test en `__tests__/controlPlan/cpInjectionMaster.test.ts` que cargue este CP desde JSON local (no Supabase) y verifique las 7 reglas B + las 11 D + la cobertura de los 13 controles obligatorios. Asi cualquier regeneracion futura se valida automaticamente.

2. **Fix del generator:** la regla C4 (filas de prevencion sin `evaluationTechnique`) debe estar en `controlPlanGenerator.ts:Fase 3.5` directamente. Hoy el script `createInjectionCpMaster.mjs` la viola en su Fase 3.5. Si el bug esta en el .mjs (no en el .ts del generator real), igualmente vale la pena agregar la verificacion en el generator del modulo para evitar que un CP futuro generado desde la UI tenga el mismo problema.

3. **Auditoria de gendoc post-creacion:** crear `scripts/_validateCpMaster.mjs` reusable que corra contra cualquier CP maestro recien creado y verifique cobertura de la tabla AMFE→failure y los 13 controles GUIA. Generaliza este script de auditoria.

4. **Linkeo automatico AMFE causes en items manuales:** los items que se agregan manualmente desde una guia (no desde el AMFE) deberian recibir un mapeo por keyword sobre los failure descriptions del AMFE. El script de creacion podria incluir esa pasada automatica.

5. **Documentar en `docs/LECCIONES_APRENDIDAS.md`:**
   - "Items manuales en CP maestro deben recibir `amfeCauseIds` por keyword o quedan huerfanos del AMFE"
   - "Filas AP=L genericas deben tener `evaluationTechnique = ""` (regla AIAG CP 2024)"
   - "Plantilla `inferReactionPlan` para recepcion debe ser segregacion+notificacion al proveedor, no template de produccion"

---

## Conclusion

El CP Maestro de Inyeccion esta **estructuralmente bien creado** (integridad, header, link a familia, no duplicados) pero **necesita 8 fixes obligatorios antes de propagarse**. Los fixes mas importantes son:

1. Corregir las 3 filas AP=L genericas (regla AIAG CP 2024).
2. Linkear los 11 items manuales al AMFE (`amfeCauseIds`).
3. Resolver dedup de certificado del proveedor (items 1 vs 5).
4. Agregar item condicional de Flamabilidad.
5. Definir muestreo del control dimensional con Metrologia.

La cobertura de los 13 controles obligatorios de la GUIA es 12/13 (92%) — solo falta Flamabilidad. La cobertura aparente del AMFE es baja (4/43 modos de falla = 9.3%) pero subiria a ~30/43 (70%) si se linkean los items manuales correctamente.

La calibracion conservadora del AMFE maestro (0 H, 1 M, 64 L) es ROBUSTNESS para discutir con Fak en proxima sesion: ajustando 4-5 causas a AP=M se mejoraria la trazabilidad del CP automaticamente.

**Veredicto: NO listo. Aplicar los 8 fixes bloqueantes, regenerar item_count, re-correr cpPreSaveValidation y cpCrossValidation, y despues si listo.**
