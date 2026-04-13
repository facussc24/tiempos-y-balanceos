# Guia Tecnica: Proceso de Inyeccion Plastica

Conocimiento base validado por el gerente experto en inyeccion (2026-04-10).
Esta guia alimenta el AMFE Maestro de Inyeccion y el CP Maestro de Inyeccion.

---

## 1. Recepcion de materia prima

### 1.1 Verificacion de certificado del proveedor
- Al llegar el lote: revisar el **certificado del proveedor** para confirmar que el material coincide con lo que el cliente certifico.
- Si el certificado no coincide: segregar lote y notificar segun procedimiento P-09/I o P-14.
- **Responsable**: Recepcion de materiales / Inspector de Calidad.

### 1.2 Materiales esperados
- Pellet virgen (esta planta NO usa molido / material reciclado — registrar esta exclusion como control preventivo).
- Identificacion clara de bolson/octabin: tipo de material, color, lote del proveedor, fecha.

### 1.3 Falla tipica en recepcion
- Material entregado diferente al especificado (error de proveedor o contaminacion).
- Certificado faltante o no legible.

---

## 2. Presecado de material

### 2.1 Cuando se requiere presecado
Materiales **higroscopicos** absorben humedad del ambiente y deben secarse antes de inyectar:

| Material | Temperatura | Tiempo |
|---|---|---|
| ABS | 80 C | 2-4 horas |
| Policarbonato (PC) | 120 C | 2-4 horas |
| PA (Nylon) | 80 C | 2-6 horas |
| PET | 120-150 C | 4-6 horas |
| PP, PE | NO requieren secado | N/A |

### 2.2 Equipo
- **Tolva secadora / deshumidificador** que alimenta a la tolba normal de la maquina.
- Si el material es higroscopico: la tolva secadora es obligatoria. Si no: se alimenta la tolba directamente.

### 2.3 Fallas tipicas
- Temperatura de secadora desajustada o fuera de rango.
- Tiempo de secado insuficiente (material cargado a la maquina antes de completar el ciclo).
- Humedad residual en el pellet → defectos en la pieza inyectada (ampollas, rafagas plateadas, quemado interno).

### 2.4 Control
- Verificacion de la temperatura y tiempo de secado al inicio de cada turno o al cambiar de lote.
- Registro en ficha de proceso.

---

## 3. Alimentacion de la maquina

### 3.1 Sistema de aspiracion
- Una **aspiradora** succiona el material desde el bolson al pie de la maquina hacia la tolba de la inyectora.
- Filtros en la aspiradora previenen el ingreso de particulas al sistema.
- Verificar: alimentacion y presion de aire de la aspiradora antes de arranque.

### 3.2 Bolson al pie de la maquina
- El bolson se coloca al pie de la maquina para su utilizacion continua.
- Verificacion visual de cantidad al inicio de turno.

### 3.3 Fallas tipicas
- Aspirador tapado por filtro sucio.
- Presion de aire baja.
- Alimentacion intermitente → pieza incompleta por falta de material en la tolba.
- Contaminacion por particulas si el filtro falla.

---

## 4. Refrigeracion del tornillo

### 4.1 Zona critica: la garganta / boca de alimentacion
- Hay un **sistema de refrigeracion con agua** en la zona donde el material ingresa al tornillo (primera zona).
- Esta zona DEBE estar siempre refrigerada.
- Si la refrigeracion falla: el material se funde antes de tiempo en la boca y forma una **pasta** que impide que baje el pellet desde la tolba.

### 4.2 Falla tipica
- **Boca de alimentacion atascada por pasta de material.**
- Causa: refrigeracion de garganta fallando (bomba de agua, obstruccion en el circuito, perdida de caudal).

### 4.3 Control
- Verificacion de flujo de agua y temperatura de garganta al arranque de maquina.
- Monitoreo en el panel de la inyectora durante produccion.

---

## 5. Setup inicial y parametrizacion

### 5.1 Setup al arranque de produccion
- El operador **chequea que todos los parametros sean correctos** al iniciar el turno o al arrancar un nuevo molde:
  - Temperaturas por zona del tornillo.
  - Velocidad y presion de inyeccion.
  - Tiempo de compactacion (segunda presion).
  - Tiempo de enfriamiento.
  - Fuerza de cierre.
  - Refrigeracion del molde y del tornillo.

### 5.2 Parametrizacion para producto nuevo
- En un **lanzamiento**, se parametriza la temperatura, velocidad, presion segun la pieza.
- Los valores quedan registrados en el **dossier de parametros de proceso** (documento validado por el equipo APQP).
- Cada producto tiene su propio dossier.

### 5.3 Falla tipica
- Parametros cargados de otro producto por error (setup incorrecto).
- Valores fuera del rango validado.
- Dossier desactualizado.

### 5.4 Zonas de temperatura
- Cada zona del tornillo se setea segun el tipo de material.
- El perfil tipico va subiendo de temperatura desde la tolba hacia la boquilla, respetando el rango del proveedor del material.

---

## 6. Mantenimiento de moldes

### 6.1 Mantenimiento preventivo
- **Frecuencia**: cada X cantidad de golpes u horas de trabajo (lo que ocurra primero).
- **Componentes a revisar**:
  - Bujes
  - Columnas
  - Expulsores
  - Engranes (si aplica)
  - Canales de refrigeracion (obstruccion por oxido o sarro)
  - Linea de junta (desgaste, deformacion)
- Registro en ficha de mantenimiento por molde.

### 6.2 Mantenimiento correctivo
- Al detectarse desgaste anormal, rotura visible o defecto en la pieza que no se corrige por ajuste de parametros.
- Molde fuera de linea hasta reparacion.

### 6.3 Procedimiento de limpieza al bajar el molde
Cada vez que se baja un molde despues de una produccion (por cambio de molde, por alcanzar la cantidad de golpes, o al final del ciclo productivo):

1. Limpieza **sobre la superficie externa** del molde.
2. Limpieza **interna** (cavidades).
3. Soplado de los **conductos de refrigeracion** con aire comprimido para que no quede agua dentro (previene oxidacion).
4. Revision visual: si se observa alguna rotura, desgaste marcado, dano en inserto, etc. → reportar.
5. **Lubricacion** del molde en ambas caras antes de bajarlo al almacen de moldes.

### 6.4 Superficie del molde antes de montaje
- Antes de colocar el molde en la maquina: la superficie debe estar **libre de suciedad, golpes y rebabas**.
- La inyectora es **magnetica** (sujecion magnetica del molde): una superficie sucia impide el anclaje correcto.

---

## 7. Control de pieza inyectada

### 7.1 Defectos visuales a verificar

| Defecto | Descripcion | Como se detecta |
|---|---|---|
| **Falta de llenado** | Pieza incompleta, puede faltar un pedazo o haber hueco | Inspeccion visual 100% del operador |
| **Rebabas (flashing)** | Material sobrante en linea de junta | Inspeccion visual + calibre de referencia |
| **Orificios tapados** | Agujeros o venteos no se formaron correctamente | Inspeccion visual |
| **Quemaduras** | Marcas oscuras por sobrecalentamiento o mala venteo | Inspeccion visual |
| **Quemada / flash** | Marca visible que se percibe a simple vista | Inspeccion visual |
| **Chupados (sink marks)** | Hundimientos superficiales por contraccion | Inspeccion visual + muestra referencia |
| **Pieza deformada** | Alabeo, distorsion geometrica | Comparacion con muestra maestra |
| **Dimensional NOK** | Fuera de tolerancia en medida critica | **Calibre** / gauge de control |

### 7.2 Instrumental
- Debe haber un **calibre** (gauge) para control dimensional de la pieza.
- Inspeccion visual 100% del operador en el puesto.

### 7.3 Retiro de colada (runner)
- Despues de la inyeccion: el operador corta la colada (sistema de alimentacion) manualmente o con dispositivo.
- Control de que el corte quede limpio y no deje bebedero visible en la pieza final.

---

## 8. Excluyentes especificos de esta planta

- **No usar molido / material reciclado** — solo pellet virgen.
- Esta regla reduce el riesgo de contaminacion en la materia prima. Registrar como control de prevencion.

---

## 9. Mapeo 6M para el AMFE

Cuando se construye el AMFE de operacion de inyeccion (OP 20 o equivalente), los Work Elements DEBEN cubrir los 6M con un item por linea (regla AIAG-VDA 2019):

### Machine (Maquina)
- **Inyectora** — zonas de temperatura, tornillo, fuerza de cierre, sistema de refrigeracion del molde, sistema de refrigeracion del tornillo/garganta
- **Molde** — linea de junta, canales de refrigeracion, sistema de expulsion, inserto/macho

### Material
- **Colorante masterbatch** (si aplica, material indirecto)
- **Desmoldante** (si aplica)
- NO incluir el pellet directo — ese va en OP 10 Recepcion como material directo de entrada

### Method (Metodo)
- **Dossier de parametros de proceso**
- **Procedimiento de arranque de fabricacion inyeccion**
- **Procedimiento de cambio de molde**
- **Procedimiento de limpieza de molde al bajarlo**

### Man (Mano de obra)
- **Verificacion del operador al setup** (chequeo de parametros contra dossier)
- **Inspeccion visual 100% del operador** en el puesto

### Measurement (Medicion)
- **Calibre / gauge** para dimensional
- **Termometros / pirometros** para zonas de temperatura
- **Manometros** para presion de inyeccion

### Environment (Medio ambiente)
- **Aire comprimido filtrado** (para aspirador, sopletado de molde)
- **Temperatura ambiente de planta** (afecta enfriamiento y contraccion)

---

## 10. Mapeo a Plan de Control

El CP Maestro de Inyeccion debe tener al menos estos controles:

| # | Que se controla | Como se controla | Frecuencia | Responsable |
|---|---|---|---|---|
| 1 | Certificado del proveedor | Inspeccion documental | Por lote | Recepcion de materiales |
| 2 | Temperatura de tolva secadora | Lectura de panel | Al arranque + cada turno | Operador |
| 3 | Tiempo de secado del pellet | Cronometraje / registro | Por carga | Operador |
| 4 | Flujo de refrigeracion del tornillo (garganta) | Verificacion manual + panel | Al arranque | Operador |
| 5 | Parametros de proceso vs dossier | Comparacion con dossier | Al arranque + cambio de lote | Operador / Lider de Produccion |
| 6 | Fuerza de cierre de la inyectora | Lectura de panel | Al arranque | Operador |
| 7 | Inspeccion visual de pieza (defectos tipicos) | Autocontrol 100% | Cada pieza | Operador |
| 8 | Dimensional de pieza | Calibre / gauge | TBD (muestreo por lote) | Operador / Metrologia |
| 9 | Flamabilidad del material (si cliente lo requiere) | Certificado de laboratorio | Por lote | Laboratorio |
| 10 | Limpieza de molde antes de bajarlo | Inspeccion visual + check list | Al bajar molde | Operador / Lider |
| 11 | Lubricacion de molde antes de bajarlo | Inspeccion visual | Al bajar molde | Operador |
| 12 | Mantenimiento preventivo de molde | Registro de golpes/horas vs plan | Por contador | Mantenimiento |
| 13 | Filtro de aspiradora | Inspeccion visual + soplado | Al arranque | Operador |

Valores numericos (frecuencias exactas, tolerancias, tiempos) — dejar como TBD y confirmar con Fak o el equipo APQP.

---

## 11. Glosario

- **Dossier de parametros de proceso**: documento con los parametros validados para un producto especifico (temperatura por zona, presion, tiempo de ciclo, velocidad, etc).
- **Golpes**: cada ciclo de inyeccion (apertura + cierre + inyeccion + expulsion). Se usa para medir la vida util de un molde.
- **Linea de junta (parting line)**: zona donde se encuentran las dos mitades del molde. Zona critica para rebabas.
- **Boquilla**: punto de salida del material desde el tornillo hacia el molde.
- **Garganta**: primera zona del tornillo, donde el material entra como pellet solido. Zona refrigerada con agua.
- **Colada (runner)**: sistema de canales que distribuye el material fundido dentro del molde hasta las cavidades.
- **Punto de inyeccion (gate)**: orificio por donde el material fundido entra a la cavidad.
- **Flash**: marca visual de rebaba o linea de junta marcada en la pieza.
- **Rechupes (sink marks)**: hundimientos superficiales por contraccion desigual.
- **Inserto / macho**: pieza movil del molde que forma cavidades internas.
- **Expulsores**: pernos que empujan la pieza fuera de la cavidad al abrir el molde.

---

## 12. Fuente

Conocimiento transmitido por el gerente experto en inyeccion, sesion del 2026-04-10.
Incorporado al AMFE Maestro de Inyeccion (`AMFE-MAESTRO-INY-001`) y al CP Maestro pendiente.

Cualquier valor numerico (temperatura exacta, presion exacta, tiempo exacto) que no este en rangos validados en esta guia requiere confirmacion explicita de Fak antes de usarlo en AMFE/CP.
