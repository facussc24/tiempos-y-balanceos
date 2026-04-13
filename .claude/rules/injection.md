# Regla: Inyeccion de Plastico

Carga contextual automatica cuando se tocan archivos relacionados con inyeccion, el maestro de inyeccion, o productos con operaciones de inyeccion.

## Referencia principal
Leer `docs/GUIA_INYECCION.md` antes de editar cualquier AMFE, CP o HO de inyeccion. El conocimiento tecnico validado por el gerente esta ahi.

## Maestro de Inyeccion en Supabase
- **family_id**: 15
- **family.name**: "Proceso de Inyeccion Plastica"
- **AMFE master document_id**: `4a5fa0d1-46ee-4d6b-b699-2cbaeb14602c`
- **amfe_number**: AMFE-MAESTRO-INY-001
- CP master document_id: TBD (crear en Fase 5)

## 6M obligatorio para operacion de INYECCION

Cada operacion de inyeccion DEBE tener los 6 Work Elements (1M por linea — NO agrupar):

| M | Work Element tipico | Ejemplo de function |
|---|---|---|
| **Machine** | Inyectora (zonas temperatura, tornillo, fuerza cierre, refrigeracion) | Conformar pieza plastica segun especs |
| **Material** | Indirectos: colorante masterbatch, desmoldante (si aplica). NO pellet directo (va en recepcion OP 10) | Teñir pieza segun color especificado |
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

## Operaciones esperadas en un proceso completo de inyeccion

- **OP 10: RECEPCION DE MATERIA PRIMA (o PREPARACION Y SECADO)** — certificado proveedor, secado de higroscopicos (ABS/PC a 80-120 C, 2-4 h), carga de tolva
- **OP 20: INYECCION** — ciclo de inyeccion, zonas de temperatura, refrigeracion del tornillo
- **OP 30: CONTROL DIMENSIONAL / DESMOLDEO / CORTE DE COLADA** — retiro manual de colada, control visual de operador, calibre
- **OP 40: MANTENIMIENTO PREVENTIVO DE MOLDE (condicional)** — por golpes u horas de trabajo, limpieza interna/externa, lubricacion, revision de bujes/expulsores/columnas

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

## Familias con operacion de inyeccion (productos Patagonia)

- **IP PAD** (familia IP PAD) — OP 20 INYECCION (PP+EPDM para PL0, luego tapizado PVC para PL1-PL3)
- **Top Roll** (familia Top Roll Patagonia) — OP con inyeccion (verificar numero exacto por variante)
- **Insert Patagonia** (familia Insert) — OP con inyeccion plastica
- **Armrest Door Panel** (familia Armrest) — verificar si tiene inyeccion propia o usa componente inyectado externo
- **Headrest Front/Rear Center/Rear Outer** — verificar si tienen componente plastico inyectado propio

Cuando se modifica el AMFE Maestro de Inyeccion, estos 5 AMFEs DEBEN recibir alertas cross-family via `cross_doc_checks`.

## Valores numericos
NUNCA inventar temperaturas exactas, presiones, tiempos de ciclo. Usar rangos del gerente (80-120 C, 2-4 h). Si falta un dato: **TBD** y preguntar a Fak.

## Acciones de optimizacion
Ver `.claude/rules/amfe-actions.md`. NUNCA inventar acciones. Solo Fak y el equipo APQP las definen.

## Clasificacion CC/SC
Ver `.claude/rules/amfe.md`. NO asignar CC ni SC sin autorizacion explicita de Fak (feedback memory).
