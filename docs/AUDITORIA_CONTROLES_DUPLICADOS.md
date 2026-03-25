# Auditoria: Controles de Calidad Duplicados en HO

Fecha: 2026-03-25

## Resumen

- **Total QCs duplicados eliminados**: 147
- **HOs afectadas**: 8
- **Criterio de duplicado**: misma `characteristic` Y mismo `controlMethod` en la misma sheet
- **Regla**: se conserva la primera ocurrencia, se eliminan las subsiguientes

## Detalle por HO

### CP-ARMREST-001
- HO ID: `fd9dc5bc...`
- Duplicados eliminados: **18**

#### 10 - RECEPCIONAR MATERIA PRIMA
- QCs antes: 19 | despues: 15 | eliminados: 4

| # | Caracteristica | Metodo control |
|---|---|---|
| 1 | Material / pieza golpeada o danada durante transpo | Instruccion de Trabajo de Recepcion que  |
| 2 | Material con especificacion erronea (dimensiones,  | Instrucción de recepción de material |
| 3 | Contaminacion / suciedad en la materia prima | Instruccion de Trabajo de Recepcion que  |
| 4 | Falta de documentacion o trazabilidad | Instruccion de Trabajo de Recepcion que  |

#### 15 - CORTE DE COMPONENTES - PREPARACION DE CORTE
- QCs antes: 6 | despues: 5 | eliminados: 1

| # | Caracteristica | Metodo control |
|---|---|---|
| 1 | Contaminacion / suciedad en la materia prima | Instrucción de proceso de corte |

#### 50 - COSTURA - COSTURA UNION
- QCs antes: 15 | despues: 10 | eliminados: 5

| # | Caracteristica | Metodo control |
|---|---|---|
| 1 | Costura descosida o debil | Instrucción de proceso de costura |
| 2 | Costura descosida o debil | Instrucción de proceso de costura |
| 3 | Costura desviada o fuera de especificacion | Instrucción de proceso de costura |
| 4 | Costura salteada | Visual |
| 5 | Costura salteada | Visual |

#### 51 - COSTURA - COSTURA DOBLE
- QCs antes: 21 | despues: 18 | eliminados: 3

| # | Caracteristica | Metodo control |
|---|---|---|
| 1 | Costura descosida o debil | Instrucción de proceso de costura |
| 2 | Costura descosida o debil | Instrucción de proceso de costura |
| 3 | Costura desviada o fuera de especificacion | Instrucción de proceso de costura |

#### 60 - INYECCION PLASTICA - INYECCION DE PIEZAS PLASTICAS
- QCs antes: 15 | despues: 14 | eliminados: 1

| # | Caracteristica | Metodo control |
|---|---|---|
| 1 | Omitir la operacion de inspeccion dimensional de c | Hoja de parámetros de inyección |

#### 80 - ADHESIVADO - ADHESIVAR PIEZAS
- QCs antes: 6 | despues: 5 | eliminados: 1

| # | Caracteristica | Metodo control |
|---|---|---|
| 1 | Adhesion insuficiente o fuera de especificacion | Instrucción de proceso de adhesivado |

#### 81 - ADHESIVADO - INSPECCIONAR PIEZA ADHESIVADA
- QCs antes: 6 | despues: 5 | eliminados: 1

| # | Caracteristica | Metodo control |
|---|---|---|
| 1 | Adhesion insuficiente o fuera de especificacion | Instrucción de inspección |

#### 101 - CLASIFICACION Y SEGREGACION DE PRODUCTO NO CONFORME
- QCs antes: 5 | despues: 4 | eliminados: 1

| # | Caracteristica | Metodo control |
|---|---|---|
| 1 | Pieza No Conforme (NC) es clasificada como Conform | Hojas de operaciones / ayudas visuales |

#### 103 - REPROCESO: FALTA DE ADHESIVO
- QCs antes: 14 | despues: 13 | eliminados: 1

| # | Caracteristica | Metodo control |
|---|---|---|
| 1 | Mezcla de producto No Conforme (NC) con producto C | Instrucciones de proceso y ayudas visual |

### CP-HR-FRONT-L0
- HO ID: `5233c6b6...`
- Duplicados eliminados: **1**

#### 10 - Recepcion
- QCs antes: 15 | despues: 14 | eliminados: 1

| # | Caracteristica | Metodo control |
|---|---|---|
| 1 | Color | P-10/I. Recepcion de materiales. P-14. |

### CP-HR-REAR_CEN-L0
- HO ID: `2503aeb5...`
- Duplicados eliminados: **1**

#### 10 - Recepcion
- QCs antes: 15 | despues: 14 | eliminados: 1

| # | Caracteristica | Metodo control |
|---|---|---|
| 1 | Color | P-10/I. Recepcion de materiales. P-14. |

### CP-HR-REAR_OUT-L0
- HO ID: `04e76a66...`
- Duplicados eliminados: **1**

#### 10 - Recepcion
- QCs antes: 15 | despues: 14 | eliminados: 1

| # | Caracteristica | Metodo control |
|---|---|---|
| 1 | Color | P-10/I. Recepcion de materiales. P-14. |

### CP-INSERT-001
- HO ID: `18dc1704...`
- Duplicados eliminados: **116**

#### 10 - RECEPCIÓN DE MATERIA PRIMA
- QCs antes: 44 | despues: 28 | eliminados: 16

| # | Caracteristica | Metodo control |
|---|---|---|
| 1 | Mala estiba y embalaje inadecuado | Medios de embalaje validados |
| 2 | Manipulación incorrecta en tránsito | Existencia de instrucciones de trabajo q |
| 3 | Falta de inspección visual al recibir | Instrucción de Trabajo de Recepción que  |
| 4 | Almacenaje inadecuado en transporte (sin proteccio | Procedimientos de Logística sobre estiba |
| 5 | Procesos administrativos deficientes | El sistema [ARB] obliga a registrar lote |
| 6 | No se utiliza el sistema ARB | Procedimiento Operacional Estándar que e |
| 7 | Proveedor sin sistema robusto de trazabilidad | Auditorías de Sistema y Requisitos que v |
| 8 | Error en la orden de compra o ficha técnica | Revisión de Ingeniería de la Ficha Técni |
| 9 | Proveedor no respeta tolerancias | Requisitos Contractuales de Calidad y Au |
| 10 | Almacenaje inadecuado en transporte (sin proteccio | Procedimientos de Logística sobre estiba |
| 11 | Ambiente sucio en planta del proveedor | N/A |
| 12 | Material / pieza golpeada o dañada durante transpo | Instrucción de Trabajo de Recepción que  |
| 13 | Material / pieza golpeada o dañada durante transpo | Instrucción de Trabajo de Recepción que  |
| 14 | Falta de documentación o trazabilidad | Instrucción de Trabajo de Recepción que  |
| 15 | Material con especificación errónea (dimensiones,  | Instrucción de recepción de material |
| 16 | Contaminación / suciedad en la materia prima | Instrucción de Trabajo de Recepción que  |

#### 15 - CORTE DE COMPONENTES - Preparación de corte
- QCs antes: 9 | despues: 5 | eliminados: 4

| # | Caracteristica | Metodo control |
|---|---|---|
| 1 | Error del operario al medir con la regla metálica. | Medición de la primera capa usando la re |
| 2 | Falta de inspección al llegar | Instrucción de Trabajo |
| 3 | Ambiente sucio en planta del proveedor | N/A |
| 4 | Contaminación / suciedad en la materia prima | Instrucción de proceso de corte |

#### 20 - CORTE DE COMPONENTES - Cortar componentes
- QCs antes: 14 | despues: 10 | eliminados: 4

| # | Caracteristica | Metodo control |
|---|---|---|
| 1 | Falla en la máquina de corte | Instructivo para colocar correctamente t |
| 2 | Falta de verificación del código de material antes | Orden Automática del Sistema: El sistema |
| 3 | Error en identificación del material | Etiquetado Estándar (Logística): Procedi |
| 4 | Desgaste de la cuchilla de corte. | Cambio de cuchillas por calendario u hor |

#### 25 - CORTE DE COMPONENTES - Control con mylar
- QCs antes: 3 | despues: 2 | eliminados: 1

| # | Caracteristica | Metodo control |
|---|---|---|
| 1 | Operador de producción omite la tarea de verificac | Instrucción/Lista de verificación de Pue |

#### 30 - CORTE DE COMPONENTES - Almacenamiento WIP
- QCs antes: 9 | despues: 6 | eliminados: 3

| # | Caracteristica | Metodo control |
|---|---|---|
| 1 | El Operador no realiza el conteo/verificación comp | Existencia de documentación de proceso p |
| 2 | Mano de Obra no realiza la verificación visual con | La Orden de Producción (OP) se encuentra |
| 3 | El Operador (Mano de Obra) no sigue el procedimien | Instrucción o procedimiento (Mano de Obr |

#### 40 - COSTURA - Refilado
- QCs antes: 9 | despues: 6 | eliminados: 3

| # | Caracteristica | Metodo control |
|---|---|---|
| 1 | Operador posiciona el corte en la refiladora fuera | Ayudas Visuales y Instrucción de Proceso |
| 2 | Operador posiciona el corte en la refiladora fuera | Ayudas Visuales y Instrucción de Proceso |
| 3 | Cuchilla desafilada / desgastada, resultando en re | Mantenimiento Preventivo |

#### 50 - COSTURA - Costura CNC
- QCs antes: 45 | despues: 23 | eliminados: 22

| # | Caracteristica | Metodo control |
|---|---|---|
| 1 | Mano de Obra: Colocación de material dentro de la  | Hoja de Proceso / Ayudas Visuales |
| 2 | Máquina: Pérdida de presión de aire | Control preventivo del Filtro de Aire |
| 3 | Método: Falta de definición de topes físicos o guí | La máquina cuenta con topes físicos - Ho |
| 4 | Mano de Obra: El operador instaló incorrectamente  | Hoja de Operaciones / Ayudas Visuales |
| 5 | Máquina: Falla en el sistema de Tensión Electrónic | Mantenimiento Preventivo Planificado |
| 6 | Materiales: Aguja inadecuada para el grosor del ma | Hoja de proceso indica que aguja se debe |
| 7 | Método: El procedimiento de instalación/ajuste de  | Hoja de Operaciones |
| 8 | Mano de Obra: El operador ingresa el código manual | Plan de Control / Puesta a Punto (Puesta |
| 9 | Máquina (Software): Fallo de la interfaz HMI o sof | Mantenimiento Preventivo |
| 10 | Máquina (Sensor): El sensor que debería validar la | Plan de Limpieza / Mantenimiento (Limpie |
| 11 | Método: El procedimiento de set-up no exige una ve | Hoja de Proceso |
| 12 | Mano de Obra: El operador (o personal de mantenimi | Ayudas Visuales |
| 13 | Máquina: Fallo en los indicadores de mantenimiento | Mantenimiento Preventivo |
| 14 | Materiales: El aceite/lubricante utilizado no es e | Gestión de Proveedores y Especificación  |
| 15 | Método: El procedimiento de mantenimiento preventi | Instructivo General de Mantenimiento (I- |
| 16 | Falla en el sensor de detección de plantilla o suc | Plan de Control / Puesta a Punto (Puesta |
| 17 | Ruptura o Enredo del Hilo (Superior o Inferior) O  | Plan de Control / Puesta a Punto (Puesta |
| 18 | Ruptura o Enredo del Hilo (Superior o Inferior) O  | Plan de Control / Puesta a Punto (Puesta |
| 19 | Ruptura o Enredo del Hilo (Superior o Inferior) O  | Instrucción de proceso de costura |
| 20 | Patrón de costura (programa) cargado no coincide c | Instrucción de proceso de costura |
| 21 | Fallo o Degradación del Componente de la Máquina d | Instrucción de proceso de costura |
| 22 | Fallo o Degradación del Componente de la Máquina d | Instrucción de proceso de costura |

#### 60 - TROQUELADO - Troquelado de espuma
- QCs antes: 12 | despues: 8 | eliminados: 4

| # | Caracteristica | Metodo control |
|---|---|---|
| 1 | Operario selecciona material incorrecto | La instrucción de proceso y la lista de  |
| 2 | Operario no alinea la pieza con la referencia visu | Marcas visuales para posicionado |
| 3 | Operario selecciona troquel equivocado | Identificación correcta de troqueles y c |
| 4 | Desgaste o daño del utillaje/troquel | Mantenimiento Preventivo y Predictivo de |

#### 61 - TROQUELADO - Almacenamiento WIP
- QCs antes: 9 | despues: 6 | eliminados: 3

| # | Caracteristica | Metodo control |
|---|---|---|
| 1 | El Operador no realiza el conteo/verificación comp | Existencia de documentación de proceso p |
| 2 | Mano de Obra no realiza la verificación visual con | La Orden de Producción (OP) se encuentra |
| 3 | El Operador (Mano de Obra) no sigue el procedimien | Instrucción o procedimiento (Mano de Obr |

#### 70 - INYECCIÓN PLÁSTICA - Inyección de piezas plásticas
- QCs antes: 24 | despues: 14 | eliminados: 10

| # | Caracteristica | Metodo control |
|---|---|---|
| 1 | Presión de Inyección fuera de especificación | Monitoreo automático de presión y manten |
| 2 | Temperatura de fusión del material demasiado baja | Programa de Mantenimiento y Calibración  |
| 3 | Operador omite la verificación dimensional de la c | Lista de Verificación (Lista de verifica |
| 4 | Instrucción de trabajo ambigua sobre la frecuencia | Las Hojas de Proceso describen el método |
| 5 | Fuerza de Cierre insuficiente | Mantenimiento Preventivo (MP) programado |
| 6 | Molde o cavidad contaminada con material residual | Procedimiento de limpieza y purga estand |
| 7 | Parámetros de Inyección configurados incorrectamen | Instrucción de Puesta a punto Estandariz |
| 8 | Mantenimiento Preventivo y Calibración de Sensores | Mantenimiento Preventivo del molde para  |
| 9 | Omitir la operación de inspección dimensional de c | Hoja de parámetros de inyección |
| 10 | Rebaba Excesiva / Exceso de Material | Monitoreo automático de presión y manten |

#### 71 - INYECCIÓN PLÁSTICA - Almacenamiento WIP
- QCs antes: 9 | despues: 6 | eliminados: 3

| # | Caracteristica | Metodo control |
|---|---|---|
| 1 | El Operador no realiza el conteo/verificación comp | Existencia de documentación de proceso p |
| 2 | Mano de Obra no realiza la verificación visual con | La Orden de Producción (OP) se encuentra |
| 3 | El Operador (Mano de Obra) no sigue el procedimien | - |

#### 80 - PREARMADO DE ESPUMA
- QCs antes: 6 | despues: 4 | eliminados: 2

| # | Caracteristica | Metodo control |
|---|---|---|
| 1 | Error del operario / Incorrecta alineación del sep | Ayudas Visuales: Piezas patrón y Hoja de |
| 2 | Error del operario / Burbujas en el adhesivo del s | 1- Piezas patrón de referencia, 2- Hoja  |

#### 81 - PREARMADO - Almacenamiento WIP
- QCs antes: 9 | despues: 6 | eliminados: 3

| # | Caracteristica | Metodo control |
|---|---|---|
| 1 | El Operador no realiza el conteo/verificación comp | Existencia de documentación de proceso p |
| 2 | Mano de Obra no realiza la verificación visual con | La Orden de Producción (OP) se encuentra |
| 3 | El Operador (Mano de Obra) no sigue el procedimien | Instrucción o procedimiento (Mano de Obr |

#### 90 - ADHESIVADO - Adhesivar piezas
- QCs antes: 9 | despues: 5 | eliminados: 4

| # | Caracteristica | Metodo control |
|---|---|---|
| 1 | Uso de adhesivo o reticulante vencido/degradado (M | Puesta a punto de lanzamiento: Verificac |
| 2 | Proporción de mezcla incorrecta | Hoja de proceso detalla como realizar la |
| 3 | Exceso o falta de adhesivo | Instrucciones de proceso: Documento está |
| 4 | Adhesión insuficiente o fuera de especificación | Instrucción de proceso de adhesivado |

#### 91 - ADHESIVADO - Inspeccionar pieza adhesivada
- QCs antes: 9 | despues: 5 | eliminados: 4

| # | Caracteristica | Metodo control |
|---|---|---|
| 1 | Uso de adhesivo o reticulante vencido/degradado (M | Puesta a punto de lanzamiento: Verificac |
| 2 | Proporción de mezcla incorrecta | Hoja de proceso detalla como realizar la |
| 3 | Exceso o falta de adhesivo | Instrucciones de proceso: Documento está |
| 4 | Adhesión insuficiente o fuera de especificación | Instrucción de inspección |

#### 92 - ADHESIVADO - Almacenamiento WIP
- QCs antes: 9 | despues: 6 | eliminados: 3

| # | Caracteristica | Metodo control |
|---|---|---|
| 1 | El Operador no realiza el conteo/verificación comp | Existencia de documentación de proceso p |
| 2 | Mano de Obra no realiza la verificación visual con | - |
| 3 | El Operador (Mano de Obra) no sigue el procedimien | Instrucción de trabajo |

#### 100 - TAPIZADO SEMIAUTOMÁTICO
- QCs antes: 17 | despues: 13 | eliminados: 4

| # | Caracteristica | Metodo control |
|---|---|---|
| 1 | Error del operario | Sensor de proximidad: Incorporado a la m |
| 2 | Error del operario | Diseño del producto: Piquetes y zonas de |
| 3 | Falla de la máquina | Mantenimiento preventivo |
| 4 | Tiempos de ciclo no verificados al inicio de turno | Puesta a punto de lanzamiento obligatori |

#### 103 - REPROCESO: FALTA DE ADHESIVO
- QCs antes: 12 | despues: 7 | eliminados: 5

| # | Caracteristica | Metodo control |
|---|---|---|
| 1 | Omisión por fatiga o distracción: El operador olvi | Instrucciones de proceso y ayudas visual |
| 2 | Instrucción deficiente: La Hoja de Operación Están | La hoja de instrucción detalla el método |
| 3 | La herramienta manual no carga suficiente adhesivo | La pistola de adhesivado evita que se se |
| 4 | Sobre-procesamiento: El operador aplica "doble cap | La instrucción detalla que no se debe ap |
| 5 | No existe una plantilla o máscara de protección pa | Instrucciones de proceso detallan donde  |

#### 105 - REFILADO DE PIEZA
- QCs antes: 13 | despues: 8 | eliminados: 5

| # | Caracteristica | Metodo control |
|---|---|---|
| 1 | Operador no sigue la referencia de la pieza patrón | Pieza patrón disponible junto al puesto  |
| 2 | Cutter desafilado que produce corte irregular o ra | Procedimiento de cambio de cuchilla cada |
| 3 | Operador aplica presión excesiva o desvía el cutte | Ayudas visuales con zona de corte demarc |
| 4 | Manipulación incorrecta de la pieza sobre la mesa  | Superficie de mesa protegida. Instrucció |
| 5 | Refilado incompleto o con exceso de material sobra | Ayudas visuales con zona de corte demarc |

#### 110 - INSPECCIÓN DE LA PIEZA TERMINADA
- QCs antes: 14 | despues: 10 | eliminados: 4

| # | Caracteristica | Metodo control |
|---|---|---|
| 1 | Falta / ausencia de adhesivo | Hojas de operaciones / ayudas visuales |
| 2 | Omisión o error en la ejecución de la verificación | Lista de Verificación (Lista de verifica |
| 3 | Inspector omite la verificación visual completa de | Lista de verificación de inspección con  |
| 4 | Inspector omite la verificación de costura y borde | Imagen de referencia de costura OK/NOK d |

#### 111 - CLASIFICACIÓN Y SEGREGACIÓN DE PRODUCTO NO CONFORME
- QCs antes: 20 | despues: 12 | eliminados: 8

| # | Caracteristica | Metodo control |
|---|---|---|
| 1 | Contenedores OK/NC no están claramente diferenciad | Instrucción Visual |
| 2 | Instrucción de Trabajo del puesto de Clasificación | Instrucción Visual |
| 3 | Operador coloca Pieza NC en contenedor OK por erro | Instrucción Visual |
| 4 | Operador coloca piezas NC en OK por error de distr | Instrucción Visual |
| 5 | Contenedores no están físicamente separados / El p | Instrucción Visual |
| 6 | Operador omite el paso de identificación | Instrucción Visual |
| 7 | Insumos de identificación no disponibles (No hay e | - |
| 8 | El procedimiento de segregación no requiere la col | Instrucción Visual |

#### 120 - EMBALAJE
- QCs antes: 8 | despues: 7 | eliminados: 1

| # | Caracteristica | Metodo control |
|---|---|---|
| 1 | Mal posicionamiento / Sin separadores | Uso de separadores, bandejas o estructur |

### PWA/TELAS_PLANAS
- HO ID: `a0889567...`
- Duplicados eliminados: **2**

#### 20 - Corte por maquina de pieza Central
- QCs antes: 3 | despues: 2 | eliminados: 1

| # | Caracteristica | Metodo control |
|---|---|---|
| 1 | Material fuera de especificacion requerida | Puesta a punto de la maquina de corte au |

#### 10d - Colocado de Aplix
- QCs antes: 2 | despues: 1 | eliminados: 1

| # | Caracteristica | Metodo control |
|---|---|---|
| 1 | Orificios fuera de posicion / Error del operario | Puesta a punto de la maquina / Capacitac |

### PWA/TELAS_TERMOFORMADAS
- HO ID: `b013e2e0...`
- Duplicados eliminados: **2**

#### 20 - Corte por maquina automatica segun dimensional
- QCs antes: 3 | despues: 1 | eliminados: 2

| # | Caracteristica | Metodo control |
|---|---|---|
| 1 | Programacion equivocada de la maquina de corte aut | Puesta a punto de la maquina de corte au |
| 2 | Programacion equivocada de la maquina de corte aut | Puesta a punto de la maquina de corte au |

### VWA/PATAGONIA/TOP_ROLL
- HO ID: `a7201817...`
- Duplicados eliminados: **6**

#### 5 - RECEPCIONAR MATERIA PRIMA
- QCs antes: 24 | despues: 22 | eliminados: 2

| # | Caracteristica | Metodo control |
|---|---|---|
| 1 | Material con especificación errónea (dimensiones,  | Control dimensional por muestreo y revis |
| 2 | Contaminación / suciedad en la materia prima | Inspeccion visual de estado del material |

#### 10 - INYECCIÓN DE PIEZAS PLÁSTICAS
- QCs antes: 19 | despues: 18 | eliminados: 1

| # | Caracteristica | Metodo control |
|---|---|---|
| 1 | Contaminación / suciedad en la materia prima | Inspeccion visual de material y revision |

#### 20 - ADHESIVADO HOT MELT
- QCs antes: 11 | despues: 9 | eliminados: 2

| # | Caracteristica | Metodo control |
|---|---|---|
| 1 | Adhesión deficiente del vinilo en la pieza plástic | Inspeccion visual de adhesion y ausencia |
| 2 | Adhesión deficiente del vinilo en la pieza plástic | Inspeccion visual de adhesion y ausencia |

#### 50 - EDGE FOLDING
- QCs antes: 6 | despues: 5 | eliminados: 1

| # | Caracteristica | Metodo control |
|---|---|---|
| 1 | Adherencia del material en zona de plegado | Verificacion de temperatura con pirometr |
