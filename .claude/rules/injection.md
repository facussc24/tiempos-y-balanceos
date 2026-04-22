# Regla: Inyeccion de Plastico

Carga contextual automatica cuando se tocan archivos relacionados con inyeccion, el maestro de inyeccion, o productos con operaciones de inyeccion.

## Referencia principal
Leer `docs/GUIA_INYECCION.md` antes de editar cualquier AMFE, CP o HO de inyeccion. El conocimiento tecnico validado por el gerente esta ahi.

## Maestro de Inyeccion en Supabase
- **family_id**: 15
- **family.name**: "Proceso de Inyeccion Plastica"
- **AMFE master document_id**: `4a5fa0d1-46ee-4d6b-b699-2cbaeb14602c`
- **amfe_number**: AMFE-MAESTRO-INY-001
- **CP master document_id**: `81b60cdd-1296-4821-a348-a8e3c2433b0d`
- **cp_number**: CP-MAESTRO-INY-001
- **Operaciones**: OP 20 (Inyeccion) + OP 30 (Control Dimensional + Corte Colada)
- **NOTA**: OP 10 (Recepcion) fue movida al Maestro de Logistica y Recepcion (family 16)

## Maestro de Logistica y Recepcion en Supabase
- **family_id**: 16
- **family.name**: "Proceso de Logistica y Recepcion"
- **AMFE master document_id**: `ef327ae0-c147-4716-ba22-601cedf5b3d1`
- **amfe_number**: AMFE-MAESTRO-LOG-REC-001
- **CP master document_id**: `34943c75-b9ad-4284-8dd6-d491d1dccf95`
- **cp_number**: CP-MAESTRO-LOG-REC-001
- **Operaciones**: OP 10 (Recepcion y Preparacion de Materia Prima)
- **Justificacion**: AIAG CP 2024 "Procesos Interdependientes" — recepcion es transversal a multiples procesos

## 6M obligatorio para operacion de INYECCION

Cada operacion de inyeccion DEBE tener los 6 Work Elements (1M por linea — NO agrupar):

| M | Work Element tipico | Ejemplo de function |
|---|---|---|
| **Machine** | Inyectora (zonas temperatura, tornillo, fuerza cierre, refrigeracion) | Conformar pieza plastica segun especs |
| **Material** | Indirectos: colorante concentrado, desmoldante (si aplica). NO pellet directo (va en recepcion OP 10) | Tenir pieza segun color especificado |
| **Method** | Dossier de parametros, procedimiento de arranque, procedimiento de cambio de molde | Aplicar parametros validados al ciclo |
| **Man** | Verificacion de parametros al arranque, verificacion visual 100% | Validar conformidad pieza antes de liberar |
| **Measurement** | Termometros/pirometros, calibre, balanza para dosificacion | Medir cumplimiento vs especificacion |
| **Environment** | Aire comprimido filtrado, temperatura ambiente de planta | Mantener condiciones estables para ciclo |

## Defectos tipicos de inyeccion (modos de falla validados por el gerente)

1. **Falta de llenado (pieza incompleta)** — presion/volumen insuficiente, venteo obstruido
2. **Rebabas (flashes)** — fuerza de cierre insuficiente, linea de junta danada, parametros desajustados
3. **Orificios tapados** — molde sucio, canales de refrigeracion obstruidos
4. **Quemaduras** — temperatura excesiva, venteo insuficiente
5. **Chupados (rechupes / sink marks)** — compactacion insuficiente, tiempo de segunda presion bajo
6. **Pieza deformada** — enfriamiento insuficiente, refrigeracion fallando
7. **Flash** (marca visible) — fuerza cierre, molde danado
8. **Dimensional NOK** — contraccion, temperatura molde, humedad del material
9. **Color/apariencia NOK** — mezcla incorrecta de colorante, temperatura baja de fusion
10. **Desprendimiento** — adhesion inadecuada en multi-material

## Retrabajos tipificados (NO usar "Retrabajo fuera del puesto" generico)

| Tipo de retrabajo | Cuando aplica |
|---|---|
| **Scrap (chatarra)** | Rebabas graves no recuperables, dimensional fuera de tolerancia, quemaduras criticas |
| **Retrabajo in-station** | Corte de colada (runner), limpieza superficial leve |
| **Retrabajo laboratorio** | Verificacion dimensional con instrumento calibrado |
| **Ajuste de parametros** | Correccion del dossier, reset de zona, re-calibracion |
| **Cambio de molde** | Molde con dano estructural requiere intervencion fuera de linea |

## Jerarquia de controles de prevencion

Cuando asignes `preventionControl`, priorizar en este orden:

1. **Poka-yoke tecnico** — dispositivo fisico que impide el error (mejor, justifica O=2-3)
2. **Sensor con interlock** — detiene la maquina si el parametro sale de rango (O=3-4)
3. **Instruccion tecnica + dossier** — parametros escritos y validados (O=4-5)
4. **Autocontrol + capacitacion** — verificacion humana (O=6-8, requiere controles tecnicos complementarios)

NUNCA "Capacitacion" como unico prevention control. PROHIBIDO "Falta de capacitacion" como causa (ver `.claude/rules/amfe.md`).

## Controles de deteccion diferenciados (NO todos "Autocontrol visual 100%")

| Tipo de defecto | Metodo de deteccion correcto |
|---|---|
| Dimensional | Calibre, medicion con instrumento calibrado |
| Rebabas/flashes | Inspeccion visual 100% + calibre de referencia |
| Quemaduras | Inspeccion visual con muestra patron de defectos |
| Color/apariencia | Comparacion con muestra maestra bajo luz controlada |
| Humedad (secado insuficiente) | Control de temperatura/tiempo de tolva secadora en arranque |
| Flamabilidad | Certificado de laboratorio por lote (TL 1010 VW u otras) |
| Material contaminado | Certificado de proveedor + filtro en aspiradora |

## Operaciones en el Maestro de Inyeccion (family 15)

- **OP 20: INYECCION DE TERMOPLASTICO** — ciclo de inyeccion, zonas de temperatura, refrigeracion del tornillo
- **OP 30: CONTROL DIMENSIONAL POST-INYECCION Y CORTE DE COLADA** — retiro manual de colada, control visual de operador, calibre

**NOTA:** La recepcion de materia prima esta en el Maestro de Logistica (family 16). El mantenimiento de molde es condicional y se documenta por producto.

## Materiales higroscopicos (requieren presecado)

- **ABS** — 80 C, 2-4 h
- **Policarbonato (PC)** — 120 C, 2-4 h
- **PA (Nylon)** — 80 C, 2-6 h
- **PET** — 120-150 C, 4-6 h
- **PP, PE** — NO requieren secado (no higroscopicos)

Si el proceso usa higroscopico, OBLIGATORIO tener WE "Tolba secadora" en OP 10 con modo de falla "Secado insuficiente / humedad residual".

## Refrigeracion del tornillo

Zona critica: la primera zona donde ingresa el material al tornillo (garganta / boca). SIEMPRE refrigerada con agua. Si no: el material funde antes de tiempo y forma una pasta que no deja bajar el pellet.

Modo de falla tipico: "Boca de alimentacion atascada por pasta de material" — causa: "Refrigeracion de garganta fallando".

## Mantenimiento de molde

- **Preventivo**: por cantidad de golpes O por horas de trabajo (lo primero que ocurra)
- **Correctivo**: cuando se detectan defectos estructurales
- **Limpieza al bajar molde**: interna (soplete a canales de refrigeracion para sacar agua) + externa (superficies) + lubricacion ambas caras
- **Superficie magnetica de la inyectora**: el molde debe bajar con superficies libres de suciedad, golpes y rebabas

## Familias con operacion de inyeccion - CORREGIDO 2026-04-20

**IMPORTANTE**: Hay 2 tipos de inyeccion distintos. NO confundir. NO sincronizar entre si.

### Familias con INYECCION PLASTICA (termoplastico) - maestro family 15
Materiales: PP, ABS, PC, PA, EPDM, PET. Inyectora de plastico, molde metalico, ciclo corto.

- **IP PAD** (familia IP PAD) — OP 20 INYECCION (PP+EPDM para PL0, luego tapizado PVC para PL1-PL3)
- **Top Roll Patagonia** (familia Top Roll) — OP 10 INYECCION DE PIEZA PLASTICA
- **Insert Patagonia** (familia Insert) — OP 70 INYECCION DE PIEZAS PLASTICAS
- **Armrest Door Panel** (familia Armrest) — OP 60 INYECCION DE PIEZAS PLASTICAS (carrier plastico)

### Familias con INYECCION PU (espuma poliuretano) - maestro pendiente crear
Proceso distinto: mezcla quimica Poliol+Isocianato, reaccion en molde, tiempo de curado 180+ seg, EPP completo (respirador, delantal, guantes termicos).

- **Armrest Door Panel** — OP 70 INYECCION PU (respaldo de armrest sobre carrier)
- **Headrest Front/Rear Center/Rear Outer** — OP ESPUMADO (PU foam en molde con sustrato)

### Familias SIN inyeccion
- Telas Planas PWA
- Telas Termoformadas PWA

## Incidente 2026-04-20

El script `syncArmrestHeadrestFromInjectionMaster.mjs` propago indebidamente el maestro de INYECCION PLASTICA (family 15) a los 3 Headrest. Los Headrest NO tienen inyeccion plastica, solo PU. La operacion OP 40 de los 3 Headrest quedo rotulada como "INYECCION DE SUSTRATO" con 11 WEs de termoplastico. Fue corregida manualmente 2026-04-20:
- Rename OP 40 -> "COSTURA 2DA ETAPA"
- Reset workElements a []
- Equipo APQP debe completar segun PPAP oficial Rev.1 (AMFE - Apoyacabezas*.xlsx)

## Proxima accion pendiente

Crear maestro INYECCION PU separado para propagar a Armrest OP 70 + Headrest OP ESPUMADO. Estructura base:
- Material: Poliol (componente A), Isocianato (componente B)
- Machine: Inyectora PU con controlador de dosificacion
- Method: relacion Poliol/Iso, tiempo de crema, tiempo de colada, temperatura de molde, presion
- Man: verificacion de parametros arranque + cada N piezas
- Measurement: balanza de dosificacion, cronometro curado, termometro molde
- Environment: ventilacion adecuada (gases), temperatura ambiente controlada

## Cuando un AMFE se sincroniza con el maestro de inyeccion plastica

Antes de correr cualquier sync script hacia una familia, VERIFICAR que el proceso real del producto sea termoplastico leyendo las fallas/causas de la operacion correspondiente. Si dice "costura", "espumado", "PU", "poliol" -> NO es inyeccion plastica.

## Valores numericos
NUNCA inventar temperaturas exactas, presiones, tiempos de ciclo. Usar rangos del gerente (80-120 C, 2-4 h). Si falta un dato: **TBD** y preguntar a Fak.

## Acciones de optimizacion
Ver `.claude/rules/amfe-actions.md`. NUNCA inventar acciones. Solo Fak y el equipo APQP las definen.

## Clasificacion CC/SC
Ver `.claude/rules/amfe.md`. NO asignar CC ni SC sin autorizacion explicita de Fak (feedback memory).

## 6M — no siempre son 6 WEs completos

La regla "6M completo obligatorio (todos los M con al menos 1 WE)" aplica **SOLO a inyeccion plastica** (por dossier tecnico del gerente). Extrapolarla a otras operaciones es incorrecto.

- **Regla universal (todas las operaciones):** 1M por linea. NO agrupar materiales/maquinas ("Material: Tela / Hilos" es incorrecto).
- **Regla especifica inyeccion plastica:** requiere los 6 M completos.
- **Otras operaciones** (costura, ensamble, troquelado, espumado PU, embalaje, recepcion): tienen los WEs que el proceso real requiere. Si faltan, verificar con Fak/equipo si corresponde agregar, NO asumir.

**Incidente 2026-04-20:** flaggeé "OP 50 Headrest tiene 1 WE - 6M incompleto" como bug. No era bug — esa operacion es costura, no inyeccion. Antes de reportar "6M incompleto" como hallazgo, confirmar que la operacion es de inyeccion plastica leyendo el contenido real del WE y las fallas.
