---
fecha_extraccion: 2026-05-26
fuente: Manual_TP900_ES.docx (8.8 MB, traducción del chino, fabricante Zhangjiagang Liqin)
agente: subagent análisis manual TP900 ES (parte del panel de 4 agentes Liqin)
objetivo: Identificar alarmas, defectos típicos, procedimientos de seguridad y controles documentados oficialmente
hallazgos_clave:
  - 90% del contenido crítico está en screenshots (no extraíble sin OCR)
  - Manual cubre secciones 5.4.1 a 5.4.5 (operación, arranque, prueba, automático, alarmas)
  - 5 botones de paro de emergencia distintos (armario eléctrico, mezcla, consola, caja botones, prensa)
  - Alarmas HMI con parada automática: desviación caudal, desviación presión, tiempo presurización
  - Temperatura aceite hidráulico 50-55°C es límite de alarma
  - Manual NO documenta EPP químico (sigue TBD-Leo)
  - Modo automático requiere 3 preselecciones simultáneas (inyección húmeda + modo automático + cabezal mezclador)
  - 2 niveles de usuario en HMI con contraseña: manager / gong
---

# Análisis manual_es.docx — Manual TP900 Liqin

## 1. Resumen del manual

- **Archivo:** `manual_es.docx`, 8.8 MB, 377 párrafos detectados por python-docx pero solo ~12 KB de texto útil (227 nodos de texto extraídos del XML)
- **Estructura:** documento muy parco en texto. El 90% del peso son screenshots del HMI TP900/TP1200 (44 imágenes PNG, varias >700 KB)
- **Idioma:** traducción del chino (autor: 张家港力勤机械有限公司 / Zhangjiagang Strength & Industrious Machinery Co., Ltd). Sintaxis rara en varias frases ("se permite abrir el cabezal mezclador", "el cabezal mezclador entra en modo de trabajo"). Algunas partículas chinas quedaron sin traducir (`。` al final de varias frases)
- **Secciones que SÍ están en texto plano (legibles sin OCR):**
  - **5.4** Instrucciones de operación del equipo
  - **5.4.1** Uso del operador TP1200/TP900 (descripción de pantallas HMI, botones, iconos)
  - **5.4.2** Arranque y parada de la máquina
  - **5.4.3** Operación de prueba individual y manual
  - **5.4.4** Operación de inyección automática
  - **5.4.5** Alarmas de fallo y respuestas
- **Secciones AUSENTES o solo en imagen:**
  - Tabla de códigos de alarma con su descripción (el doc menciona "pantalla de alarmas" pero el listado real está en screenshots)
  - Tabla de defectos típicos de PU foam-in-place
  - EPP requerido (NO aparece en el texto extraíble)
  - Mantenimiento preventivo (NO aparece)
  - Procedimiento de purga (NO aparece como sección)
  - Procedimiento de paro de emergencia detallado

## 2. Lista de alarmas / códigos de error encontrados

El manual NO entrega la tabla de códigos en texto plano (está en screenshots). Reconstruido vía sensores.xlsx + secuencia.docx:

| Señal PLC | Condición / Alarma | Acción automática | FM Barack |
|---|---|---|---|
| E60 | Main ESTOP presionado | Parada total inmediata, relé K01 cae | FM-8 |
| E0.6 | Box ESTOP caja operador presionado | Parada total | FM-8 |
| E61 | BOX2 ESTOP presionado | Parada total | FM-8 |
| E46 / E47 | SafeDoor signal 1/2 — puerta seguridad abierta | Bloquea arranque del plato giratorio + bloquea inyección | FM-8 + FM-7 |
| E62 / E63 | POLY/ISO Tank MAX-LEVEL — nivel máximo de tanque | Bloquea carga | FM-5 indirecto |
| E64 / E65 | POLY/ISO AirPressure LOW — presión de aire baja en tanque | Bloquea arranque de bomba | FM-2, FM-4 |
| E66 / E67 | POLY/ISO Pump OverPressure — sobrepresión en bomba | Para bomba | FM-5, FM-LEG |
| E31 | Hydraulic Oil Temperature High | Alarma + parada inyección | FM-7 |
| E35 | Hydraulic Oil LEVEL LOW | Bloquea arranque motor hidráulico | FM-7 |
| E36 | Hydraulic Min Pressure | Bloquea inyección | FM-2, FM-5, FM-7 |
| E27 / E30 | POLY / ISO Inverter Fault — falla variador de bomba | Para bomba | FM-2, FM-4, FM-7 |
| E50 / E51 | Mixhead cilindro NO en posición | Bloquea inyección | FM-5, FM-7 |
| E14 / E15 | Oil Cylinder Open monitor (clean/shot) — cilindro no abrió | Bloquea ciclo | FM-7 |
| Desviación de caudal (HMI) | "alarma cuando el caudal supera la desviación durante la pulverización, con parada de la pulverización" | Para pulverización automáticamente | FM-2, FM-4, FM-LEG |
| Desviación de presión (HMI) | "alarma cuando la presión supera la desviación durante la pulverización, con parada de la pulverización" | Para pulverización automáticamente | FM-2, FM-5 |
| Tiempo máximo de presurización hidráulica | "150 bar. Alarma por exceso" | Alarma | FM-7 |
| Temperatura aceite hidráulico 50-55 °C | "alarma cuando el valor real supera el límite" | Alarma | FM-7 |
| Cilindros mixhead (zona Ex) | Barreras Zener ATEX (pág 113) | Protección intrínseca | FM-8 (riesgo explosión) |
| Wire-break detection | "Un valor menor a 3.6 mA en cualquier canal indica rotura de cable" | Alarma falla sensor | Control detectivo general |
| Borrar visualización de fallos | Botón manual que NO resuelve el fallo, solo limpia el texto en HMI | — | Procedimental, ver Sección 11 |

**Frase clave del manual sobre alarmas (cita literal):** "El programa adoptará automáticamente las medidas de protección correspondientes según la categoría del fallo".

## 3. Defectos típicos PU según el manual

**No hay tabla de defectos PU en el texto extraíble.** El manual es 100% operativo (cómo usar la máquina), no es enciclopédico (qué defectos pueden aparecer).

Vínculo indirecto:
| Concepto del manual | FM Barack | Vínculo |
|---|---|---|
| "Establecer desviación de caudal: alarma cuando el caudal supera la desviación" | FM-2, FM-LEG | Si el caudal sale de rango → mezcla A:B desbalanceada → huecos o no cura |
| "Establecer densidad: POL=1.03, ISO=1.22" | FM-LEG, FM-4 | Densidades especificadas del manual; si el material está fuera, cálculo de ratio sale mal |
| "Establecer proporción: 40-62" (POLY:ISO) | FM-LEG | Manual fija rango de proporción configurable |
| "Tiempo de mantenimiento de presión: después de completar la inyección" | FM-7 | Si el tiempo es corto → curado incompleto |
| "Boquilla Tiempo de compensación: -0.089 segundos" | FM-3, FM-5 | Compensación de cierre de boquilla |

## 4. EPP requerido según el manual

**El manual NO menciona EPP explícitamente en el texto extraíble.** El TBD del draft v3 Bloque G sigue **abierto** después de leer el manual.

**Pista indirecta:** la mención de "zona Ex" / "zona potencialmente explosiva" sugiere que el ambiente puede tener atmósfera con gases. Esto refuerza la necesidad de respirador y ventilación forzada pero NO lo confirma textualmente.

**Acción:** No resolver el TBD desde este manual. Mantener como Bloque G TBD-Leo en el draft v4.

## 5. Procedimientos de seguridad relevantes para FM-8

El manual confirma y refuerza FM-8. Los puntos de parada de emergencia son **5** (NO uno solo):

**Cita literal:** "Los paros de emergencia incluyen: paro de emergencia del armario eléctrico de la máquina de espuma, paro de emergencia del armario de mezcla, paro de emergencia de la consola de operación, paro de emergencia de la caja de botones de inyección (el robot está energizado, restablecimiento del paro de emergencia) y paro de emergencia de la prensa."

**Implicaciones para FM-8:**
1. Hay **5 botones STOP distintos**. El operario tiene que saber **cuál usar según la situación**.
2. El reset NO es automático: "Restablecer la puerta de seguridad y restablecer los fallos" requiere acción manual del operario después de cada parada.
3. El plato giratorio NO arranca si la barrera de luz está obstruida o la puerta está abierta. Cita: "Si la puerta de seguridad está abierta o la barrera de luz está obstruida, el indicador de restablecimiento de la barrera de luz parpadeará".
4. Hay **barrera de luz fotoeléctrica** además de puerta física — doble protección.

**Aporte a causas FM-8:**
- Causa 1 actual "Instructivo de emergencia incompleto" → REFORZADA: el manual menciona 5 ESTOPs distintos pero NO documenta CUÁL usar en CUÁL situación.
- Causa 2 "Botón STOP fuera de alcance" → MATIZAR: hay 5 botones, al menos uno debe estar al alcance del operario en cada estación.
- **Causa nueva sugerida:** "Operario no sabe que el reset requiere acción manual en cada parada".

**Frase corta clave (<15 palabras):** "En caso de emergencia, presione cualquier botón de emergencia y la máquina se detendrá inmediatamente."

## 6. Tabla maestra de hallazgos para AMFE

| # | Sección manual | Hallazgo concreto | Aplicación AMFE | FM relacionado |
|---|---|---|---|---|
| H-1 | 5.4.5 Alarmas | El manual delega TODA detección en el PLC + HMI (pantalla de alarmas) | Control detectivo principal = "Alarmas HMI TP900 con parada automática de pulverización" | FM-2, FM-4, FM-7, FM-LEG |
| H-2 | 5.4.5 Alarmas | "no presione fácilmente el botón 'Borrar fallo'. Primero, verifique la visualización del fallo" | Procedural — refuerza la causa de FM-7 "Operario interviene durante el curado" | FM-7 |
| H-3 | 5.4.1 / parámetros básicos | Existen alarmas por **desviación de caudal** y **desviación de presión** con parada automática | Control detectivo robusto → permite bajar D en FM-2 y FM-4 a 3-4 si la alarma está activa | FM-2, FM-4 |
| H-4 | 5.4.1 / parámetros componentes | Densidad POL=1.03 ISO=1.22 + proporción 40-62 + caudal alta presión 200-400 g/s | Datos para Plan de Control, NO para AMFE | (PC, no AMFE) |
| H-5 | 5.4.2 Arranque | 5 botones de paro de emergencia distintos | Refuerza FM-8: agrega causa "operario no sabe cuál STOP usar" | FM-8 |
| H-6 | 5.4.2 | Puerta de seguridad + barrera de luz fotoeléctrica con interlock | Control preventivo robusto para FM-8 | FM-8 |
| H-7 | 5.4.4 Inyección automática | Modo automático requiere **3 preselecciones simultáneas** (inyección húmeda + modo automático + cabezal mezclador) | Posible causa de FM-7: si una preselección falla, el ciclo no se completa | FM-7 |
| H-8 | secuencia.docx FASE 4 | Calentamiento de materiales con RTD PT100, debe alcanzar setpoint antes de inyectar | Control preventivo de FM-4 (zonas duras por temperatura) | FM-4 |
| H-9 | secuencia.docx FASE 8 | Flujómetros miden caudal POLY/ISO en tiempo real (E0.0-E0.3, pulsos A/B) | Control detectivo de FM-LEG (ratio fuera de spec) | FM-LEG |
| H-10 | sensores.xlsx | Sensor cilindro mixhead "eyectado en posición" y "retraído en posición" (E50/E51) | Control preventivo de FM-5 | FM-5 |
| H-11 | secuencia.docx Obs. técnicas | "wire-break detection" 4-20 mA: valores <3.6 mA = rotura de cable | Sub-control detectivo: la propia falla del sensor se detecta automáticamente | FMs 2/4/7 |
| H-12 | 5.4.4 Inyección automática | "El plato giratorio parpadea rápido indica que ya ha sido iniciado y está esperando que transcurra el tiempo de intervalo para volver a arrancar" | Posible causa de FM-7 | FM-7 |
| H-13 | sensores.xlsx | Sensores en zona ATEX/Ex con barreras Zener (pág 113) | Refuerza atmósfera potencialmente explosiva | FM-8 + posible FM nuevo |

## 7. FMs nuevos sugeridos (basados en el manual)

### FM-NUEVO-A — Ratio iso/poliol fuera de spec por fallo del flujómetro
- **Origen del manual:** "alarma cuando el caudal supera la desviación durante la pulverización, con parada de la pulverización"
- **Justificación:** distinto de FM-LEG (que es por lote de material o mezcla mal hecha). Este es por **falla del instrumento de medición en línea** (flujómetro POLY o ISO atascado / desviado)
- **Severidad sugerida:** 9 (mismo que FM-LEG porque genera ratio iso/poliol incorrecto que cae en VW 50180/TL 1010)
- **Clasificación:** CC (legal)
- **Control preventivo derivado del manual:** "Calibración del flujómetro según parámetro equivalente: POL1=1, ISO1=1"
- **Control detectivo derivado del manual:** "Alarma automática de desviación de caudal con parada de pulverización"

### FM-NUEVO-B — Ambiente con atmósfera explosiva (gases de isocianato)
- **Origen del manual:** zona Ex con barreras Zener en sensores de cilindros (pág 113)
- **Justificación:** distinto de FM-8 (riesgo mecánico del operario). Este es **riesgo químico/explosivo** del ambiente
- **Severidad sugerida:** 9-10 (explosión + inhalación de gases)
- **Clasificación:** OS si O>=4
- **TBD:** confirmar con Leonardo si Barack tiene ventilación forzada + sensores de gas instalados

## 8. Controles preventivos identificados (del manual)

| Control preventivo | Fuente manual | FM |
|---|---|---|
| Verificación de E-STOPs en posición levantada antes de arrancar | 5.4.2 | FM-8 |
| Restablecimiento de puerta de seguridad antes de arrancar | 5.4.2 | FM-8 |
| Calentamiento de tanques hasta setpoint (PLC bloquea inyección) | secuencia FASE 4 | FM-4 |
| Calibración de flujómetros (POL1=1, ISO1=1) | 5.4.1 pantalla parámetros componentes | FM-LEG, FM-2, FM-4 |
| Configuración de densidad correcta en HMI (POL=1.03, ISO=1.22) | 5.4.1 | FM-LEG |
| Sensor cilindro mixhead en posición antes de inyectar | E50/E51 sensores | FM-5 |
| Sensor de presión mínima hidráulica antes de inyectar | E36 | FM-2, FM-5 |
| Tiempo de establecimiento de presión (5 seg en prueba, 3 seg en auto) | 5.4.3 / 5.4.4 | FM-7 |
| Tiempo de mantenimiento de presión después de la inyección | 5.4.1 parámetros básicos | FM-7 |
| Modo "Circulación de temperatura de material" entre ciclos | 5.4.1 botones preseleccionados | FM-3, FM-4 |
| Modo "Circulación de fin de semana" para mantener material activo durante paradas largas | 5.4.1 | FM-3, FM-4 |
| RFID identification del molde (lectura durante producción) | 5.4.1 "Identificación RFID: el modo de escritura escribe el número del molde en la tarjeta" | FM-6 |
| Tiempo de intervalo de inicio del molde configurable | 5.4.1 parámetros formula | FM-7 |
| 2 niveles de usuario con contraseña distinta (manager / gong) | 5.4.1 | Control de acceso a parámetros — FM-LEG, FM-7 |

## 9. Controles detectivos identificados (del manual)

| Control detectivo | Fuente manual | FM |
|---|---|---|
| Alarma HMI por desviación de caudal con parada automática de pulverización | 5.4.1 | FM-LEG, FM-2, FM-4 |
| Alarma HMI por desviación de presión con parada automática | 5.4.1 | FM-2, FM-5, FM-7 |
| Pantalla de registros de inyección (histórico por ciclo) | 5.4.1 | Trazabilidad — todos los FMs |
| Alarma de temperatura aceite hidráulico (50-55 °C límite) | 5.4.1 | FM-7 |
| Alarma por tiempo máximo de presurización excedido | 5.4.1 | FM-7 |
| Wire-break detection sensores 4-20 mA (<3.6 mA = falla cable) | secuencia obs. técnicas | FMs 2/4/7 |
| Zumbador audible + marca parpadeante en HMI al ocurrir fallo | 5.4.5 | Todos los FMs detectables |
| Sensores RTD PT100 en mixhead POLY e ISO | sensores.xlsx IW96 IW100 | FM-4 |
| Sensores 4-20 mA presión mixhead POLY/ISO | sensores.xlsx AI4 AI5 | FM-5, FM-2 |
| Sensores 4-20 mA presión bombas POLY/ISO | sensores.xlsx AI6 AI7 | FM-2, FM-LEG |
| Sensores de nivel max en tanques (E62/E63) | sensores.xlsx | Prevención sobrellenado |
| Sensores ATEX en zona Ex con barreras Zener | secuencia pág 113 | FM-NUEVO-B |

## 10. Parámetros para Plan de Control (NO al AMFE)

| Parámetro | Valor según manual | Comentario |
|---|---|---|
| Densidad POLY | 1.03 g/cm³ | Configurable en HMI, dato del proveedor |
| Densidad ISO | 1.22 g/cm³ | Configurable en HMI |
| Proporción POLY:ISO | 40-62 (POLY=100/ISO en %) | Rango configurable HMI |
| Caudal alta presión | 200-400 g/s | Rango HMI |
| Temperatura aceite hidráulico | 50-55 °C límite alarma | Hardcoded |
| Tiempo max presurización hidráulica | hasta alcanzar 150 bar (configurable) | Alarma por exceso |
| Tiempo establecimiento presión (prueba) | 5 segundos | Recomendación manual |
| Tiempo establecimiento presión (auto) | 3 segundos | Recomendación manual |
| Frecuencia plato giratorio | 20-50 Hz | Configurable HMI |
| Boquilla tiempo compensación | -0.089 segundos | Valor por defecto manual |
| Número de fórmula | 1-500 | Capacidad HMI |
| Equivalente flujómetro | POL1=1, ISO1=1 | Calibración |
| PLC | Siemens S7-1200 CPU 6ES7215-1AG40-0XB0 | Referencia equipo |
| Módulo seguridad | ES-FA-9AA | Referencia equipo |

## 11. Contradicciones con el draft v3

| Asumido en draft v3 | Manual dice | Estado |
|---|---|---|
| WE-7 = "balanza / cronómetro / termómetro" | Dosificación es por **flujómetros electrónicos**, no balanza | CONTRADICCIÓN — actualizar WE-7 |
| FM-7 Causa 2: "Operario interviene durante el curado" | Manual lo refuerza: "no presione fácilmente el botón 'Borrar fallo'" | CONFIRMA causa |
| FM-LEG Causa 2 sin control preventivo definido | Manual entrega control directo: **alarma automática de desviación de caudal con parada de pulverización** | RESUELVE TBD Bloque F |
| FM-7 Causa 3: "Falla del PLC o temporizador del ciclo" sin control | Manual: el PLC tiene **wire-break detection 4-20 mA** + alarmas internas | RESUELVE TBD Bloque F |
| FM-8 Causa 2: "Botón STOP fuera del alcance inmediato" | Manual dice que hay 5 botones — al menos uno siempre cerca | MATIZAR causa |
| WE-8 Environment: "Ventilación de gases" | Manual menciona zona ATEX pero NO menciona ventilación como provisión de la máquina | GAP — ventilación es responsabilidad de la planta |
| Draft asume operario puede intervenir entre ciclos | Manual: "esperar que transcurra el tiempo de intervalo" — el plato es automático | MATIZAR — agregar como sub-causa de FM-7 |
| EPP químico TBD | Manual NO entrega lista de EPP | TBD-Leo sigue abierto |

## 12. Citas literales clave (todas <15 palabras)

1. Modo automático (refuerzo FM-7): "el cabezal mezclador entra en modo de trabajo"
2. Alarmas detectivas (control FM-LEG/FM-2): "alarma cuando el caudal supera la desviación"
3. Emergencia (FM-8): "presione cualquier botón de emergencia y la máquina se detendrá"
4. Verificación E-STOPs (preventivo FM-8): "todos los botones de parada de emergencia deben estar en posición levantada"
5. No intervenir en automático (FM-7): "no presione fácilmente el botón 'Borrar fallo'"
6. Verificar antes de resetear (FM-7): "verifique la visualización del fallo, analice la causa"
7. Densidades (PC, no AMFE): "POL=1.03, ISO=1.22"
8. Proporción (PC): "Establecer proporción: (40-62)"
9. Barrera de luz (preventivo FM-8): "barrera de luz está obstruida, el indicador parpadeará"
10. Acceso PLC (control parámetros): "Usuario: manager / Usuario: gong"
