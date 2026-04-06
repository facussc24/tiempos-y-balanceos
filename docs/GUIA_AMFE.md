# Guia de Referencia: AMFE (Analisis de Modo de Falla y Efecto)

> **Proposito**: Este documento es la referencia obligatoria que Claude Code debe leer ANTES de editar,
> generar o auditar cualquier documento AMFE del proyecto Barack Mercosul.
> Todas las reglas provienen del analisis de AMFEs reales de la planta (tapiceria automotriz VWA/PWA)
> y del estandar AIAG-VDA FMEA Handbook 1st Edition 2019.

---

## 1. Idioma

### Regla principal

- TODO el contenido del AMFE debe estar en espanol
- NUNCA poner traducciones en ingles entre parentesis

### Terminos tecnicos universales permitidos (sin traduccion)

Estos terminos son estandar de industria y se usan tal cual:

- **Poka-Yoke** (dispositivo anti-error)
- **FIFO** (metodo de gestion de inventario)
- **Set-up** — permitido solo como termino tecnico aislado, no entre parentesis

### Traducciones obligatorias

| Ingles entre parentesis (INCORRECTO) | Espanol correcto |
|---|---|
| (Scrap) | Descarte / Rechazo |
| (Set-up) / (Setup) | Puesta a punto |
| (Checklist) | Lista de verificacion |
| (CoC) | Certificado de calidad |
| (FAI) | Aprobacion de primera pieza |
| (SOS) | Hoja de operacion estandar |
| (First Piece Approval) | Aprobacion de primera pieza |
| (Sponge layer) | Capa de espuma |
| (Cold Weld) | Soldadura fria |
| (Read-through) | Transparencia / Marcado visible |
| (Angel hair) | Hilos sueltos / Rebaba de hilo |
| (Wrong Label) | Etiqueta incorrecta |
| (Loose assembly) | Ensamble flojo |
| (Wrinkle) | Arruga |
| (Trim) | Refilado |
| (Deburring) | Rebabado |
| (Rework) | Retrabajo |
| (Scrap rate) | Tasa de descarte |
| (Incoming inspection) | Inspeccion de recepcion |
| (Final inspection) | Inspeccion final |

### Regla para Claude Code

Al generar o editar texto de un AMFE, buscar cualquier patron de parentesis con texto en ingles y reemplazarlo por el equivalente espanol. Si no se encuentra en la tabla, traducir al espanol sin parentesis.

---

## 2. Roles de la Empresa

### Roles validos (usar exactamente estos nombres)

| Nombre completo | Area | Uso en AMFE |
|---|---|---|
| Carlos Baptista (Ingenieria) | Ingenieria de producto/proceso | Responsable de acciones de diseno/proceso |
| Manuel Meszaros (Calidad) | Calidad | Responsable de acciones de calidad/inspeccion |
| Marianna Vera (Produccion) | Produccion | Responsable de acciones de produccion |
| Cristina Rabago (Seguridad e Higiene) | SyH | Temas de seguridad ocupacional |
| Facundo Santoro | Mejora continua | Coordinacion general, mejora continua |

### Roles INVALIDOS (no usar nunca)

| Rol incorrecto | Por que esta mal | Usar en su lugar |
|---|---|---|
| "Ingenieria de Calidad" | No existe ese departamento en la empresa | "Calidad" o "Ingenieria" segun corresponda |
| "Ing. de Proceso" | Formato incorrecto | "Carlos Baptista (Ingenieria)" |
| "Depto. Calidad" | No se usa departamento, se usa persona | "Manuel Meszaros (Calidad)" |
| "Supervisor de Produccion" | Rol generico | "Marianna Vera (Produccion)" |
| "Responsable de Calidad" | Rol generico | "Manuel Meszaros (Calidad)" |

### Regla para el campo "Responsible" de acciones

Siempre usar el formato: **Nombre Apellido (Area)**. Si no se sabe quien corresponde, usar "TBD (Area)" donde Area es Ingenieria, Calidad o Produccion.

---

## 3. Nomenclatura de Operaciones

### Formato

- Siempre en **MAYUSCULAS**
- Patron: `CATEGORIA - DETALLE` (con guion rodeado de espacios)

### Ejemplos correctos

| Operacion | Notas |
|---|---|
| RECEPCIONAR MATERIA PRIMA | Recepcion de insumos |
| CORTE - CORTE CNC | Corte automatizado |
| CORTE - CORTE MANUAL | Corte manual |
| COSTURA - COSTURA CNC | Costura automatizada |
| COSTURA - COSTURA MANUAL | Costura manual |
| INYECCION - INYECCION PU | Inyeccion de poliuretano |
| ENSAMBLE - PEGADO DE ESPUMA | Proceso de ensamble |
| INSPECCION FINAL - CONTROL FINAL DE CALIDAD | Inspeccion final |
| EMBALAJE Y DESPACHO | Embalaje |
| ALMACENAMIENTO | Almacenamiento intermedio |

### Ejemplos incorrectos

| Incorrecto | Correccion |
|---|---|
| "Recepcion materia prima" | "RECEPCIONAR MATERIA PRIMA" |
| "Costura" | "COSTURA - COSTURA CNC" o "COSTURA - COSTURA MANUAL" |
| "Inspeccion" | "INSPECCION FINAL - CONTROL FINAL DE CALIDAD" |
| "corte cnc" | "CORTE - CORTE CNC" |

---

## 4. Modos de Falla

### Principio: lenguaje de planta, no academico

Redactar los modos de falla describiendo lo que el operador VE o DETECTA, no la causa tecnica subyacente.

### Ejemplos correctos

| Modo de falla | Operacion tipica |
|---|---|
| Costura saltada | Costura |
| Arruga en vinilo | Costura, Inyeccion |
| Pieza sin identificacion | Embalaje, Inspeccion |
| Tela con mancha | Recepcion, Corte |
| Medida fuera de tolerancia | Corte, Inyeccion |
| Despegue de espuma | Ensamble |
| Material contaminado | Recepcion |
| Hilo suelto / rebaba de hilo | Costura |
| Pieza deformada | Inyeccion |
| Falta de componente | Ensamble |
| Color fuera de tono | Recepcion, Inspeccion |
| Etiqueta incorrecta | Embalaje |
| Gramaje fuera de rango | Recepcion |
| Puntada floja | Costura |
| Quemado superficial | Inyeccion |

### Ejemplos INCORRECTOS (jerga academica)

| Incorrecto | Por que esta mal |
|---|---|
| "Degradacion superficial por fatiga termomecanica" | Nadie en planta habla asi |
| "Falla por fluencia del polimero" | Causa tecnica, no lo que se ve |
| "Defecto tribologico en interfaz de contacto" | Ininteligible para el operador |
| "Discontinuidad en la union termoplastica" | Usar "Soldadura fria" o "Despegue" |

### Regla para Claude Code

Al generar modos de falla, usar vocabulario de maximo 5 palabras simples. Si el texto resultante requiere un diccionario tecnico para entenderse, simplificarlo.

---

## 5. Controles de Prevencion/Deteccion

### Vocabulario de planta (usar estos textos)

#### Controles de Prevencion

| Control | Contexto |
|---|---|
| Ayudas Visuales y Instruccion de Proceso | Control documental en puesto |
| Plan de Mantenimiento Preventivo | Mantenimiento de maquinas |
| Puesta a punto al inicio de turno | Verificacion de arranque |
| Aprobacion de primera pieza | Validacion antes de produccion serie |
| Capacitacion del operador | Prevencion por entrenamiento |
| FIFO en almacen | Control de vencimiento de materiales |
| Verificacion de parametros de set-up | Parametros de maquina |
| Programa CNC validado | Prevencion en corte/costura automatica |
| Especificacion de materia prima al proveedor | Control en origen |
| Poka-Yoke (descripcion especifica) | Dispositivo anti-error fisico |

#### Controles de Deteccion

| Control | Contexto |
|---|---|
| Inspeccion visual 100% | Inspeccion total |
| Control dimensional por muestreo con calibre | Dimensional periodico |
| Autocontrol del operador | El operador verifica su trabajo |
| Auditoria de producto | Control periodico por calidad |
| Verificacion contra patron de aspecto | Comparacion visual |
| Ensayo de laboratorio | Ensayos destructivos/no destructivos |
| Verificacion de certificado del proveedor | Recepcion |
| Control de peso con balanza | Gramaje/peso |
| Inspeccion en proceso por calidad | Ronda de inspector |

### Textos PROHIBIDOS

| Incorrecto | Por que esta mal |
|---|---|
| "Analisis modal de fallas potenciales" | Eso es el AMFE mismo, no un control |
| "Implementacion de sistema de gestion de calidad" | Demasiado abstracto |
| "Supervision continua del proceso" | No es medible ni especifico |
| "Control estadistico avanzado" | Especificar: CEP, carta X-R, etc. |

---

## 6. Clasificacion AP (Action Priority)

### Tabla AIAG-VDA FMEA Handbook 1st Edition 2019

El AP se calcula como funcion de Severidad (S), Ocurrencia (O) y Deteccion (D) segun la tabla implementada en `modules/amfe/apTable.ts`.

### Resumen de reglas (de apRule en apTable.ts)

| Severidad | Condicion | AP |
|---|---|---|
| S = 1 | Siempre | L |
| S = 2-3 | O >= 8 Y D >= 5 | M |
| S = 2-3 | Resto | L |
| S = 4-6 | O >= 8 Y D >= 5 | H |
| S = 4-6 | O >= 8 Y D <= 4 | M |
| S = 4-6 | O = 6-7 Y D >= 2 | M |
| S = 4-6 | O = 4-5 Y D >= 7 | M |
| S = 4-6 | Resto | L |
| S = 7-8 | O >= 8 | H |
| S = 7-8 | O = 6-7 Y D >= 2 | H |
| S = 7-8 | O = 4-5 Y D >= 7 | H |
| S = 7-8 | O = 4-5 Y D <= 6 | M |
| S = 7-8 | O = 2-3 Y D >= 5 | M |
| S = 7-8 | Resto | L |
| S = 9-10 | O >= 6 | H |
| S = 9-10 | O = 4-5 Y D >= 2 | H |
| S = 9-10 | O = 2-3 Y D >= 7 | H |
| S = 9-10 | O = 2-3 Y D = 5-6 | M |
| S = 9-10 | Resto | L |

### Acciones requeridas segun AP

| AP | Accion requerida |
|---|---|
| **H** (High) | Accion **obligatoria**. Debe tener fecha objetivo y responsable asignado. |
| **M** (Medium) | Evaluacion de accion recomendada. Documentar decision de actuar o no. |
| **L** (Low) | No requiere accion. Monitoreo normal. |

### Regla para Claude Code

- Nunca modificar manualmente el AP; se calcula automaticamente con `calculateAP(s, o, d)`
- Si AP=H y no hay accion recomendada con fecha y responsable, es un error de contenido
- La funcion retorna `''` (vacio) si los inputs son invalidos (NaN, fuera de rango)

---

## 7. Ratings S/O/D: Guia de Asignacion

### Severidad (S) - Impacto en el cliente/usuario final

| Rating | Significado | Ejemplo en tapiceria |
|---|---|---|
| 10 | Peligro sin aviso previo | Pieza se desprende en zona de airbag |
| 9 | Peligro con aviso previo / Incumplimiento regulatorio | Material no pasa ensayo de inflamabilidad |
| 8 | Perdida de funcion principal | Apoyacabezas no ajusta en altura |
| 7 | Degradacion de funcion principal | Fuerza de retencion reducida |
| 6 | Perdida de funcion secundaria | Sistema de fijacion no encaja |
| 5 | Degradacion de funcion secundaria | Ruido en mecanismo de ajuste |
| 4 | Defecto notable, cliente insatisfecho | Arruga visible en zona expuesta |
| 3 | Defecto menor, algunos clientes lo notan | Leve diferencia de tono |
| 2 | Defecto muy menor, cliente exigente lo nota | Marca minima no visible en uso normal |
| 1 | Sin efecto | No perceptible |

### Ocurrencia (O) - Frecuencia estimada de la causa

| Rating | Significado |
|---|---|
| 10 | Muy alta: falla inevitable sin control |
| 8-9 | Alta: falla frecuente |
| 6-7 | Moderada: falla ocasional |
| 4-5 | Baja: falla infrecuente |
| 2-3 | Muy baja: falla rara |
| 1 | Extremadamente baja: falla eliminada por diseno |

### Deteccion (D) - Capacidad de detectar antes de llegar al cliente

| Rating | Significado |
|---|---|
| 10 | No se puede detectar / Sin control de deteccion |
| 8-9 | Deteccion improbable |
| 6-7 | Deteccion moderada (muestreo, visual esporadico) |
| 4-5 | Alta probabilidad de deteccion (inspeccion sistematica) |
| 2-3 | Muy alta deteccion (100% automatica o Poka-Yoke) |
| 1 | Deteccion garantizada (prevencion por diseno) |

---

## 8. Estructura del AMFE en Codigo

El modelo de datos AMFE sigue la estructura jerarquica AIAG-VDA:

```
AmfeDocument
  └── operations[] (AmfeOperation)
        ├── operationName: string (MAYUSCULAS, patron CATEGORIA - DETALLE)
        ├── operationNumber: string
        └── workElements[] (AmfeWorkElement)
              ├── name: string
              └── functions[] (AmfeFunction)
                    ├── functionDescription: string
                    └── failures[] (AmfeFailure)
                          ├── description: string (modo de falla)
                          ├── effect: string
                          ├── severity: number (1-10)
                          └── causes[] (AmfeCause)
                                ├── cause: string
                                ├── occurrence: number (1-10)
                                ├── preventionControl: string
                                ├── detectionControl: string
                                ├── detection: number (1-10)
                                ├── ap: 'H' | 'M' | 'L' | ''
                                └── recommendedAction: string
```

### Relacion con Plan de Control

- Cada `AmfeCause` puede generar una fila de **proceso** en el CP (preventionControl -> controlMethod)
- Cada `AmfeFailure` puede generar una fila de **producto** en el CP (detectionControl -> evaluationTechnique)
- El generador esta en `modules/controlPlan/controlPlanGenerator.ts`

---

## 9. Errores Comunes a Evitar

### En contenido

| Error | Correccion |
|---|---|
| Poner S=9 a todo | Solo S=9-10 para seguridad/regulatorio |
| Poner O=1 a todo | O=1 solo si la causa esta eliminada por diseno |
| Poner D=1 a todo | D=1 solo si hay prevencion absoluta (Poka-Yoke infalible) |
| AP=H sin accion | Error critico: AP=H requiere accion obligatoria |
| Copiar el mismo texto de control en prevencion y deteccion | Son controles diferentes: prevencion evita la causa, deteccion encuentra la falla |
| Modo de falla = causa | Son cosas distintas: falla es lo que se ve, causa es por que ocurre |

### En formato

| Error | Correccion |
|---|---|
| Operaciones en minusculas | SIEMPRE MAYUSCULAS |
| Texto en ingles entre parentesis | Traducir al espanol |
| Roles inventados | Usar lista de roles validos (Seccion 2) |
| AP calculado manualmente | Usar `calculateAP(s, o, d)` de apTable.ts |

---

## 11. Work Elements — Regla 1M por linea

### Regla AIAG-VDA 2019: UN solo elemento por fila

El estandar AIAG-VDA FMEA Handbook 1st Edition 2019 exige que cada Work Element sea UN SOLO item de las categorias 4M/6M (Material, Maquina, Metodo, Mano de obra, Medio ambiente, Medicion). Agrupar multiples items en un solo Work Element destruye el hilo digital del AMFE porque cada item tiene funciones y causas de falla distintas.

**Reglas:**
- Cada Work Element DEBE ser UN SOLO item de las 4M/6M
- PROHIBIDO agrupar multiples items en un solo WE: "Material: Tela / Hilos / Refuerzos" es INCORRECTO
- Cada material/maquina/etc. va en su propia fila con su propia cadena de funcion → falla → causa

**Ejemplo correcto:**

| Work Element | Funcion | Fallas |
|---|---|---|
| WE 1: "Material: Tela termoformable" | Proveer cobertura estetica | Fallas propias de la tela (manchas, gramaje, etc.) |
| WE 2: "Material: Hilo de costura" | Unir piezas cosidas | Fallas propias del hilo (rotura, color incorrecto, etc.) |
| WE 3: "Material: Refuerzos" | Proveer rigidez estructural | Fallas propias del refuerzo (deformacion, espesor, etc.) |

**Ejemplo INCORRECTO:**

| Work Element | Problema |
|---|---|
| "Material: Tela / Hilo / Refuerzos" | Destruye el hilo digital: cada material tiene funciones y fallas distintas |

### Materiales Directos vs Indirectos en operaciones de proceso

En operaciones de proceso (NO recepcion), la categoria "Material" de las 4M/6M se refiere tipicamente a **materiales INDIRECTOS** (aceite, grasa, pegamento, concentracion de lavado). El estandar ASUME que los materiales directos (tela, hilo, sustrato) llegan correctos del proveedor.

**Los riesgos de materiales directos se evaluan en:**
- **OP 10 Recepcion de Materia Prima** — inspeccion de entrada
- **DFMEA** (AMFE de Diseno, no de Proceso)

**Solo listar materiales directos como WE en una estacion de proceso cuando:**
- Existe riesgo de que el operador cargue material equivocado (color equivocado, tipo de hilo incorrecto)
- El material puede danarse/contaminarse durante manipuleo en esa estacion
- Historial de problemas recurrentes con proveedor en inspeccion de entrada

---

## 12. Checklist Rapido para Revision de AMFE

Antes de dar por terminado un AMFE, verificar:

- [ ] Todas las operaciones estan en MAYUSCULAS con formato CATEGORIA - DETALLE
- [ ] Todo el texto esta en espanol, sin parentesis en ingles
- [ ] Roles usan nombres reales de la empresa (Seccion 2)
- [ ] Modos de falla usan lenguaje de planta (Seccion 4)
- [ ] Controles usan vocabulario de planta (Seccion 5)
- [ ] S/O/D estan en rango 1-10 para todas las causas
- [ ] AP se calcula automaticamente (no hay AP manuales)
- [ ] Todo AP=H tiene accion recomendada con fecha y responsable
- [ ] No hay causas con S, O o D en blanco
- [ ] Severidad 9-10 solo se usa para seguridad/regulatorio
- [ ] Prevencion y deteccion son controles diferentes en cada causa
- [ ] Modo de falla != causa (son conceptos distintos)
- [ ] Cada Work Element es UN SOLO item (no agrupaciones de materiales/maquinas)
- [ ] Materiales directos en ops de proceso solo si hay riesgo de interaccion
- [ ] Cross-validation PFD <-> AMFE pasa sin errores
