# Guia de Referencia: Plan de Control (CP)

> **Proposito**: Este documento es la referencia obligatoria que Claude Code debe leer ANTES de editar,
> generar o auditar cualquier Plan de Control del proyecto Barack Mercosul.
> Todas las reglas provienen del analisis de CPs reales de la planta (tapiceria automotriz VWA/PWA).

---

## 1. Reglas de Clasificacion CC/SC

La clasificacion de caracteristicas especiales SIEMPRE nace del AMFE vinculado, nunca se inventa directamente en el CP.

| Clasificacion | Criterio AMFE | Significado |
|---|---|---|
| **CC** (Critica) | Severidad 9-10 | Seguridad del usuario final o incumplimiento regulatorio |
| **SC** (Significativa) | Severidad 5-8 **Y** Ocurrencia >= 4 | Impacto funcional con frecuencia de falla relevante |
| *(vacio)* | Severidad 1-4, o Severidad 5-8 con Ocurrencia < 4 | Sin clasificacion especial |

### Distribucion tipica en piezas de tapiceria automotriz

- 80-90% de items: sin clasificacion (vacio)
- 10-15% de items: SC
- Menos del 5% de items: CC

### Ejemplos de CC en tapiceria

- Inflamabilidad del material (ensayo segun norma)
- Desprendimiento de componente en zona de airbag
- Toxicidad de materiales en contacto con pasajeros

### Ejemplos de SC en tapiceria

- Ajuste dimensional critico con alta frecuencia de desviacion
- Fuerza de adhesion de espuma con ocurrencia elevada
- Gramaje de tela fuera de rango recurrente

### Regla de codigo

El campo `specialCharClass` del `ControlPlanItem` se computa en el generador a partir de `severity` y `occurrence` del AMFE. No se permite asignar CC/SC manualmente sin respaldo del AMFE.

---

## 2. Columna Nro (characteristicNumber)

- Numerar secuencialmente dentro de cada grupo de operacion: 1, 2, 3...
- Reiniciar la numeracion al cambiar de operacion
- Formato: numero simple, sin prefijos (no usar "C-1" ni "P.01")
- Este numero es referencia cruzada con el AMFE y el plano

---

## 3. Columna Maquina/Dispositivo/Herramienta (machineDeviceTool)

Usar el nombre especifico del equipo segun la operacion. Nunca llenar con textos genericos.

| Operacion | Valores correctos | Valores INCORRECTOS |
|---|---|---|
| Recepcion | "N/A" o "Balanza electronica" | "Autoelevador", "Transpaleta" |
| Corte | "Mesa de corte automatica BM 149", "Maquina cortadora N. BMA 089/1" | "Cortadora" generico |
| Costura | "Maquina de coser" | "Equipo de costura" |
| Inyeccion | Nombre de maquina con numero (ej: "Inyectora N. XX") | "Maquina de inyeccion" generico |
| Inspeccion final | "N/A" o "Control visual" | "Puesto de inspeccion" |
| Embalaje | "N/A" | "Embaladora" |

### Reglas generales

- Siempre incluir numero de maquina cuando existe (ej: "BM 149", "BMA 089/1")
- "N/A" es valido cuando no se usa maquina/dispositivo en la operacion
- No inventar nombres de maquina; si no se conoce, dejar "TBD"

---

## 4. Especificaciones/Tolerancias (specification)

### Valores numericos del plano (siempre preferidos)

- Gramaje: "140 gr/m2 +/- 10%"
- Longitud: "2000 mm +/- 20 mm"
- Espesor: "0,8 +/- 0,1"
- Rangos: "min 2,0 - max 2,5"
- Temperatura: "180 C +/- 5 C"
- Fuerza: ">= 50 N"

### Valores cualitativos (solo cuando no hay dimensional)

- "Patron de Aspecto"
- "Blanco" (color)
- "Sin defectos visuales"
- "Conforme a pieza patron"
- "Identificacion completa (codigo, lote, fecha)"

### Cuando no se tiene el dato

- Usar: "TBD (pendiente de Ingenieria)"
- NUNCA inventar valores de tolerancia
- NUNCA dejar vacio sin explicacion

### Inferencia en codigo

El modulo `controlPlanDefaults.ts` (`inferSpecification`) usa keywords del AMFE para sugerir textos. Estos textos son puntos de partida; el usuario los ajusta con datos reales del plano.

---

## 5. Tecnica de Evaluacion/Medicion (evaluationTechnique)

Usar SIEMPRE instrumentos especificos. Nunca textos genericos como "Instrumento de medicion".

| Instrumento | Uso |
|---|---|
| Balanza electronica | Gramaje, peso de componentes |
| Cinta metrica | Longitudes mayores |
| Calibre / Calibre Vernier / Calibre digital | Espesores, diametros, cotas pequenas |
| Medidor de espesor | Espesores de materiales (telas, espumas) |
| Camara de flamabilidad | Ensayos de inflamabilidad |
| Certificado del proveedor | Recepcion de materia prima (propiedades no verificables en planta) |
| Patron de Aspecto / Mylar de control | Comparacion visual contra referencia aprobada |
| Pieza patron | Inspeccion visual de referencia |
| Dinamometro | Ensayos de fuerza, traccion, adhesion |
| Visual / Control visual | Inspeccion visual simple sin instrumento |
| Calibre de control | Verificacion dimensional con fixture dedicado |

### Prohibido

- "Instrumento de medicion" (generico, no aporta informacion)
- "Herramienta de inspeccion" (generico)
- "Equipo de laboratorio" (especificar cual)

---

## 6. Frecuencias (sampleFrequency)

Usar las frecuencias exactas del estandar de planta. No inventar combinaciones.

| Frecuencia | Contexto de uso |
|---|---|
| "Inicio de turno y despues de cada intervencion mecanica o parada de mas de 1H" | Controles de set-up en maquinas |
| "Por entrega" | Recepcion de materiales |
| "Por lote" | Controles por lote de produccion |
| "Por turno" | Controles rutinarios de turno |
| "100%" | Inspeccion al 100% (items CC, AP=H) |
| "Inicio de turno" | Verificacion de arranque |
| "Cada contenedor" / "Cada caja" | Controles de embalaje |
| "Auditoria de Producto" | Controles periodicos de calidad |

### Prohibido

- "Cada pieza" generico sin contexto (usar "100%" si es inspeccion total)
- "Cada hora" sin justificacion tecnica
- "Continuo" (no es medible)
- "Aleatorio" (no es frecuencia definida)

---

## 7. Plan de Reaccion ante Descontrol (reactionPlan)

SIEMPRE referenciar procedimientos SGC de la empresa. Nunca usar textos genericos inventados.

### Formatos validos (copiar textual)

| Texto del Plan de Reaccion | Contexto |
|---|---|
| "Segun P-09/I." | Procedimiento de produccion/operador |
| "Segun P-10/I." | Procedimiento de recepcion/inspeccion |
| "Segun P-14." / "Segun P-14/I." | Procedimiento de no conformidad/calidad |
| "Autocontrol. Operador de produccion. Segun P-09/I." | Autocontrol operativo |
| "Recepcion de materiales. P-14." | Descontrol en recepcion |
| "P-10/I. Auditor de recepcion. P-14." | Recepcion con escalamiento |

### Prohibido

- "Detener linea. Segregar producto sospechoso. Escalar a Gerencia de Calidad."
- Cualquier texto narrativo largo que no referencie un procedimiento SGC
- "Informar al supervisor" sin referencia a procedimiento
- "Rechazar lote" sin referencia a P-14

### Nota sobre controlPlanDefaults.ts

El codigo actual en `controlPlanDefaults.ts` genera textos genericos como fallback (ej: "Detener linea. Escalar a Gerencia. Segregar producto."). Estos son sugerencias iniciales que el usuario DEBE reemplazar con las referencias SGC correspondientes antes de aprobar el CP.

---

## 8. Idioma

- TODO el contenido del CP debe estar en espanol
- CERO textos en ingles entre parentesis
- Excepcion unica: numeros de parte, nombres de maquina, marcas comerciales

### Traducciones obligatorias

| Incorrecto | Correcto |
|---|---|
| (Checklist) | Lista de verificacion |
| (Set-up) | Puesta a punto |
| (Scrap) | Descarte / Rechazo |
| (First Piece Approval) | Aprobacion de primera pieza |
| (SPC) | CEP (Control Estadistico de Proceso) |
| (Gage R&R) | Estudio R&R / Repetibilidad y Reproducibilidad |

---

## 9. Ejemplos Reales (formato correcto)

### Ejemplo 1: Item de Recepcion

| Campo | Valor |
|---|---|
| Nro. Parte/Proceso | 10 |
| Descripcion Proceso | RECEPCION DE MATERIA PRIMA |
| Maquina/Dispositivo | N/A |
| Nro. | 1 |
| Producto | Gramaje de tela |
| Proceso | Verificacion de certificado |
| Clasif. Caract. Esp. | *(vacio)* |
| Espec./Tolerancia | 140 gr/m2 +/- 10% |
| Tecnica Evaluacion | Certificado del proveedor |
| Tamano Muestra | 1 certificado |
| Frecuencia | Por entrega |
| Metodo Control | Verificacion de certificado vs especificacion |
| Plan Reaccion | P-10/I. Auditor de recepcion. P-14. |
| Responsable Reaccion | Auditor de Recepcion |

### Ejemplo 2: Item de Costura

| Campo | Valor |
|---|---|
| Nro. Parte/Proceso | 30 |
| Descripcion Proceso | COSTURA - COSTURA CNC |
| Maquina/Dispositivo | Maquina de coser |
| Nro. | 1 |
| Producto | Costura continua sin saltos |
| Proceso | Tension de hilo |
| Clasif. Caract. Esp. | *(vacio)* |
| Espec./Tolerancia | Costura continua segun especificacion |
| Tecnica Evaluacion | Visual |
| Tamano Muestra | 1 pieza |
| Frecuencia | Inicio de turno y despues de cada intervencion mecanica o parada de mas de 1H |
| Metodo Control | Autocontrol del operador |
| Plan Reaccion | Autocontrol. Operador de produccion. Segun P-09/I. |
| Responsable Reaccion | Operador de Produccion |

### Ejemplo 3: Item de Inspeccion Final

| Campo | Valor |
|---|---|
| Nro. Parte/Proceso | 50 |
| Descripcion Proceso | INSPECCION FINAL - CONTROL FINAL DE CALIDAD |
| Maquina/Dispositivo | N/A |
| Nro. | 1 |
| Producto | Aspecto visual general |
| Proceso | *(vacio)* |
| Clasif. Caract. Esp. | *(vacio)* |
| Espec./Tolerancia | Patron de Aspecto |
| Tecnica Evaluacion | Pieza patron |
| Tamano Muestra | 100% |
| Frecuencia | 100% |
| Metodo Control | Inspeccion visual contra patron |
| Plan Reaccion | Segun P-14/I. |
| Responsable Reaccion | Inspector de Calidad |

### Ejemplo 4: Item CC (Inflamabilidad)

| Campo | Valor |
|---|---|
| Nro. Parte/Proceso | 10 |
| Descripcion Proceso | RECEPCION DE MATERIA PRIMA |
| Maquina/Dispositivo | N/A |
| Nro. | 2 |
| Producto | Inflamabilidad de tela |
| Proceso | Verificacion de ensayo |
| Clasif. Caract. Esp. | **CC** |
| Espec./Tolerancia | Velocidad de combustion <= 100 mm/min (segun FMVSS 302) |
| Tecnica Evaluacion | Camara de flamabilidad / Certificado del proveedor |
| Tamano Muestra | 1 probeta / 1 certificado |
| Frecuencia | Por entrega |
| Metodo Control | Certificado de ensayo del proveedor. Validacion interna periodica. |
| Plan Reaccion | P-10/I. Auditor de recepcion. P-14. |
| Responsable Reaccion | Auditor de Recepcion |

---

## 10. Campos del Modelo de Datos (referencia rapida)

Los campos del `ControlPlanItem` en `controlPlanTypes.ts`:

| Campo codigo | Columna CP | Notas |
|---|---|---|
| processStepNumber | Nro. Parte/Proceso | Del PFD |
| processDescription | Descripcion Proceso/Operacion | En MAYUSCULAS |
| machineDeviceTool | Maquina/Dispositivo/Herram. | Seccion 3 de esta guia |
| characteristicNumber | Nro. | Seccion 2 de esta guia |
| productCharacteristic | Producto | Lo que se mide en la pieza |
| processCharacteristic | Proceso | Variable del proceso |
| specialCharClass | Clasif. Caract. Esp. | CC, SC o vacio (Seccion 1) |
| specification | Espec./Tolerancia | Seccion 4 de esta guia |
| evaluationTechnique | Tecnica Evaluacion/Medicion | Seccion 5 de esta guia |
| sampleSize | Tamano Muestra | Cantidad a inspeccionar |
| sampleFrequency | Frecuencia | Seccion 6 de esta guia |
| controlMethod | Metodo Control | Como se controla |
| reactionPlan | Plan Reaccion | Seccion 7 de esta guia |
| reactionPlanOwner | Responsable Reaccion | Persona/rol en piso |
| controlProcedure | Procedimiento/IT | Referencia a procedimiento SGC |

---

## 11. Procedimientos SGC Referenciados

| Procedimiento | Nombre | Uso en CP |
|---|---|---|
| P-05 | Control de documentos y registros | Referencia documental |
| P-08 | Identificacion y rastreabilidad del producto | Trazabilidad, etiquetado |
| P-09 | Control del proceso | Controles operativos |
| P-09/I (P-09.1) | Reaccion ante no conformidad del proceso | Plan de reaccion en produccion |
| P-10 | Inspeccion y ensayo | Controles de recepcion e inspeccion |
| P-10/I | Instruccion de inspeccion | Plan de reaccion en recepcion |
| P-13 | Control del producto no conforme | Manejo de producto NC |
| P-14 / P-14/I | No conformidad / calidad | Escalamiento de descontrol |

---

## Checklist Rapido para Revision de CP

Antes de dar por terminado un CP, verificar:

- [ ] Todas las clasificaciones CC/SC tienen respaldo en el AMFE vinculado
- [ ] Distribucion CC/SC es coherente (no hay 50% de items como CC)
- [ ] characteristicNumber reinicia en cada operacion
- [ ] machineDeviceTool usa nombres especificos, no genericos
- [ ] specification tiene valores del plano o "TBD", nunca inventados
- [ ] evaluationTechnique usa instrumentos de la lista, nunca genericos
- [ ] sampleFrequency usa frecuencias de la lista de planta
- [ ] reactionPlan referencia procedimientos SGC (P-09/I, P-10/I, P-14)
- [ ] reactionPlanOwner tiene persona/rol concreto, no departamento
- [ ] Todo el texto esta en espanol, sin traducciones en ingles entre parentesis
- [ ] Items CC tienen control 100% o frecuencia reforzada
- [ ] Cross-validation V1-V5 pasa sin errores
