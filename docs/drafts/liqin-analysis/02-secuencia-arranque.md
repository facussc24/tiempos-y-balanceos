---
fecha_extraccion: 2026-05-26
fuente: Secuencia_Arranque_PIP_IA-20260326.docx (carpeta Liqin TP900)
agente: subagent análisis secuencia arranque docx (parte del panel de 4 agentes Liqin)
objetivo: Identificar pasos del arranque que revelen modos de falla nuevos, controles preventivos del proceso, riesgos de seguridad
hallazgos_clave:
  - 9 fases cronológicas (FASE 0 a FASE 8) deducidas de 14 diagramas eléctricos PLC
  - FASE 1 verificación seguridad serie con módulo ES-FA-9AA (3 E-STOPs + 2 puertas + relé K01)
  - FASE 4 es la más larga (calentamiento POLY/ISO hasta setpoint HMI)
  - Zona ATEX confirmada por barreras Zener CSB519-EX22 / CSB536-EX (pág 113)
  - Wire-break detection en AI 4-20 mA (<3.6 mA = falla cable)
  - Variadores SINAMICS G120 controlan bombas POLY/ISO (referencia AQW0/AQW1)
---

# Análisis secuencia.docx — Arranque inyectora TP900 Liqin

## 1. Resumen del archivo

- **Origen:** Documento elaborado por ingeniería eléctrica de Liqin (Zhangjiagang Liqin), deducido del análisis de 14 diagramas eléctricos del PLC Siemens S7-1200 CPU 6ES7215-1AG40-0XB0 con 5 módulos de expansión. No es el programa Ladder real, son tiempos estimados a partir de los planos.
- **Estructura:** 9 fases cronológicas (FASE 0 a FASE 8) + 7 observaciones técnicas finales.
- **Fases:**
  - FASE 0 Energización (interruptores principales F31, F01/F02; 380 VAC → 24 VDC)
  - FASE 1 Verificación de seguridad (3 E-STOPs + 2 puertas, módulo ES-FA-9AA, relé K01)
  - FASE 2 CPU en RUN (PLC + 5 módulos expansión, monitoreo Control Voltage E33)
  - FASE 3 Verificación de precondiciones de proceso (niveles, presiones, posición cilindro mixhead, temperatura aceite hidráulico)
  - FASE 4 Calentamiento de materiales (contactores POLY y ISO heating, válvulas agua, RTD PT100, hasta setpoint HMI)
  - FASE 5 Arranque de motores principales (hidráulico 5.5 kW, bombas POLY/ISO 5.5 kW con variadores, agitadores)
  - FASE 6 Planta giratoria y chiller (motor 3 kW, sensores E56/E57 posición plato, confirmación chiller E34)
  - FASE 7 Máquina lista (luz verde, selección auto/manual desde caja de botones)
  - FASE 8 Ciclo de inyección (Shot Button E1.3, válvulas K21A/K22A, flowmeters POLY/ISO, presiones mixhead AI4-AI7, fin de ciclo E0.7 o E1.5)

## 2. Tabla de hallazgos relevantes para AMFE

| # | Paso / Item del archivo | Qué se hace | Aplicación para AMFE | FM relacionado |
|---|---|---|---|---|
| 1 | FASE 1: verificación serie de E60 + E0.6 + E61 + E46/E47 + relé K01 | Módulo ES-FA-9AA chequea 3 E-STOPs y 2 puertas. Si alguno falla, NO se energiza línea de potencia L02 | **Control preventivo de FM-8** (riesgo operario) | FM-8 |
| 2 | Obs. técnica: "Fase 1 irreversible sin Reset manual. Operador debe desbloquear E-STOP y pulsar E32 (Button Reset)" | Procedimiento de rearme post-emergencia | **Control preventivo de FM-8** | FM-8 |
| 3 | FASE 3: E62/E63 niveles MAX POLY/ISO, AI2/AI3 nivel analógico, E64/E65 presión aire BAJA, E35 nivel aceite hidráulico BAJO | PLC bloquea arranque si niveles/presión fuera de rango | **Control preventivo de FM-5 y FM-2** | FM-5, FM-2 |
| 4 | FASE 3: E50/E51 cilindro mixhead eyectado/retraído en posición | PLC verifica posición del cilindro mixhead antes de habilitar inyección | **Control preventivo de FM-5** (fuga) y **FM-2** (huecos) | FM-5, FM-2 |
| 5 | FASE 4: contactores KM76/KM78 (POLY/ISO heating) + válvulas K25A/K26A (agua) + RTD PT100 PT1A-PT4A | Sistema calienta POLY e ISO hasta setpoint configurado en HMI antes de continuar | **Control preventivo de FM-4 y FM-1** | FM-4, FM-1, FM-LEG |
| 6 | Obs. técnica: "Fase 4 es la más larga en arranque en frío. Setpoints RTD deben estar correctamente configurados en HMI para evitar arranques prematuros con material insuficientemente calentado" | Riesgo explícito de arranque prematuro = material frío | **FM NUEVO sugerido** | NUEVO + FM-4, FM-1 |
| 7 | FASE 5: bombas POLY/ISO con variadores de frecuencia, referencia por AQW0/AQW1 | Variadores controlan velocidad de bombas (= caudal A:B = ratio mezcla) | **Control preventivo de FM-LEG, FM-1, FM-4** | FM-LEG, FM-1, FM-4 |
| 8 | Obs. técnica: "Verificar rampas de aceleración P1120/P1121 en SINAMICS G120" | Rampas afectan el comportamiento al arranque del shot | **Parámetro → CP** | FM-2 (causa) |
| 9 | FASE 5: KM65/KM66 agitadores POLY/ISO 0.75 kW | Agitadores mantienen mezcla homogénea en los tanques antes de bombear | **Control preventivo de FM-3 y FM-4** | FM-3, FM-4 |
| 10 | FASE 5: E66/E67 POLY/ISO Pump OverPressure (protección) | Sensor de sobrepresión en bombas, protección eléctrica | **Control detectivo de FM-5 y FM-7** | FM-5, FM-7 |
| 11 | FASE 6: KM80 motor planta giratoria + E56/E57 sensores posición + E34 chiller | Plato rotativo debe estar en posición inicial. Chiller debe estar corriendo | **Control preventivo de FM-6 y FM-7** | FM-6, FM-7 |
| 12 | FASE 7: DQ a.3 luz verde ON | Indicador visual de "máquina lista" | **Control preventivo de FM-7** | FM-7 |
| 13 | FASE 8: Shot Button E1.3 → K21A (hyd. pressure valve) → K22A (shot valve) | Disparo automático de inyección con válvulas controladas por PLC | **Control preventivo de FM-LEG, FM-1, FM-2** | varios |
| 14 | FASE 8: E0.0/E0.1 Poly Meter (pulsos caudal A/B), E0.2/E0.3 ISO Meter | Flowmeters miden el caudal real de POLY e ISO en cada disparo | **Control detectivo de FM-LEG, FM-1, FM-4, FM-2** | FM-LEG, FM-1, FM-4, FM-2 |
| 15 | FASE 8: AI4/AI5 presión mixhead POLY/ISO, AI6/AI7 presión bomba POLY/ISO | Monitoreo continuo de presiones durante el shot | **Control detectivo de FM-5 y FM-2** | FM-5, FM-2 |
| 16 | FASE 8: E0.7 Shot STOP + E1.5 Sensor Shot | Dos vías para cerrar el ciclo: por tiempo/posición o por sensor de fin de inyección | **Control preventivo de FM-7** (redundancia) | FM-7 |
| 17 | FASE 8: E14/E15 Oil cylinder open monitor (Clean/Shot) | Monitoreo de cilindros de aceite (clean shot vs production shot) | **Control preventivo de FM-3** | FM-3 |
| 18 | Obs. técnica: Módulo barrera Zener CSB519-EX22 / CSB536-EX (sensores en zona ATEX) | Sensores en zona potencialmente explosiva, requieren instrumentos ATEX | **Riesgo de seguridad NUEVO**: zona ATEX | FM-8 ampliado o NUEVO |
| 19 | Obs. técnica: AI 4-20 mA con wire-break detection (<3.6 mA) | Detección de cable cortado/transmisor caído en sensores analógicos | **Control detectivo del sistema**: detecta fallas de instrumentos | FM-7 |
| 20 | Obs. técnica modo automático vs manual (E1.1 vs caja botones) | Auto: ciclo se repite hasta STOP. Manual: cada función se activa individualmente | **Control preventivo de FM-7** | FM-7 |

## 3. FMs nuevos sugeridos

### NUEVO-1 — Arranque de producción sin alcanzar setpoint de temperatura (arranque prematuro)
- **Origen:** FASE 4 + obs. técnica que advierte explícitamente "los setpoints de RTD deben estar correctamente configurados en la HMI para evitar arranques prematuros con material insuficientemente calentado"
- **Efectos:** material frío = reactividad alterada = zonas duras (FM-4), delaminación (FM-1)
- **Severidad propuesta:** S=6
- **Notar:** podría ser causa adicional del FM-4 y FM-1 en lugar de FM separado

### NUEVO-2 — Plato del carrusel sin indexar correctamente al inicio (mal alineación molde-mixhead)
- **Origen:** FASE 6 verifica E56/E57 (sensores plant start/plant stop)
- **Efectos:** fuga (FM-5) + pieza descentrada (FM-6)
- **Severidad propuesta:** S=6 — alineado con FM-6

### NUEVO-3 — Falla de variador POLY o ISO con bomba operativa (ratio desincronizado)
- **Origen:** FASE 5 — los variadores reciben referencia por AQW0/AQW1 pero los feedbacks E27/E30 son lazo cerrado solo a nivel de corriente, no de caudal. El caudal real se mide después en FASE 8 (flowmeters E0.0-E0.3), o sea durante el shot, ya tarde.
- **Efectos:** ratio iso/poliol fuera de spec = FM-LEG, FM-1, FM-4, FM-2
- **Severidad propuesta:** ya cubierta por FM-LEG (S=9). Sumarla como causa nueva del FM-LEG

### NUEVO-4 (potencial) — Atmósfera explosiva por vapores POLY/ISO (riesgo operario)
- **Origen:** obs. técnica menciona barreras Zener CSB519-EX22 / CSB536-EX para sensores en zona Ex
- **Severidad propuesta:** S=9 (riesgo de incendio/inhalación, CC OS)
- **TBD:** confirmar con Leonardo si Barack tiene ventilación forzada + sensores de gas

## 4. Controles preventivos del proceso (extraídos de la secuencia)

**FM-LEG (incumplimiento legal):**
- Medición de caudal POLY/ISO con flowmeters en cada shot (E0.0-E0.3)
- Monitoreo continuo de presión mixhead (AI4/AI5)
- Control automático de temperatura tanques con RTD PT100 (FASE 4)

**FM-1 (delaminación):**
- Setpoints HMI de temperatura POLY/ISO/agua tanques (FASE 4)
- Sincronización automática de variadores POLY/ISO via AQW0/AQW1
- Sensores RTD PT100 mixhead (PT1A/PT3A)

**FM-2 (huecos):**
- Sensor presión bombas POLY/ISO (AI6/AI7)
- Sensor presión aire bajo (E64/E65) — bloquea arranque si presión baja
- Sensor nivel aceite hidráulico (E35) y presión hidráulica mínima (E36)
- Verificación posición cilindro mixhead E50/E51 antes del shot

**FM-3 (contaminación):**
- Agitadores POLY/ISO funcionando (KM65/KM66) durante toda la producción
- Monitoreo cilindro de cleaning shot entre ciclos (E14/E15)

**FM-4 (zonas duras):**
- Setpoints temperatura HMI (mismo que FM-1)
- Sincronización variadores (mismo que FM-1)

**FM-5 (fuga PU):**
- Verificación posición cilindro mixhead E50/E51 antes del shot
- Sensor OverPressure bombas E66/E67 (corta ciclo si sobrepresión)
- Monitoreo presión mixhead durante shot (AI4/AI5) — caída brusca = fuga

**FM-6 (pieza fuera de posición):**
- Sensores posición plato rotativo E56/E57 (FASE 6)
- Verificación chiller corriendo (E34)

**FM-7 (ciclo incompleto):**
- Doble vía de cierre de ciclo: E0.7 Shot STOP por tiempo + E1.5 Sensor Shot por detección física
- Wire-break detection en AI 4-20 mA (<3.6 mA = falla transmisor)
- Módulo de seguridad ES-FA-9AA (FASE 1) detiene todo si relé K01 cae

**FM-8 (riesgo operario):**
- Módulo de seguridad ES-FA-9AA con 3 E-STOPs en serie (E60, E0.6, E61) + 2 puertas (E46/E47)
- Procedimiento de rearme con E32 (Button Reset) — acción deliberada post-emergencia
- Relé K01 con contacto 7B14 habilita potencia L02 a todos los motores (sin K01 = sin movimiento)
- Bloqueo de arranque si cualquier precondición FASE 3 falla

## 5. Riesgos de seguridad del operario en arranque/parada (refuerzo de FM-8)

La secuencia confirma que el sistema STOP está bien implementado a nivel eléctrico:
- 3 E-STOPs en serie (no en paralelo) — cualquiera dispara la parada
- 2 sensores de puerta independientes
- Módulo de seguridad certificado ES-FA-9AA (no un relé convencional)
- Rearme manual obligatorio (no rearme automático tras quitar emergencia)
- Sin K01 energizado, ningún motor puede arrancar (corte de potencia, no solo de control)

**Implicancia para FM-8:** las causas actuales 2 y 3 ("Botón STOP fuera del alcance" / "Señalética de emergencia no visible") siguen siendo válidas como causas del SISTEMA. Hay que agregar como control preventivo el módulo ES-FA-9AA y el procedimiento de rearme via E32.

**Nueva causa potencial para FM-8 (zona ATEX):** "Atmósfera con vapores ISO/POLY sin ventilación forzada adecuada en arranque" — la secuencia no menciona ventilación forzada como parte del arranque, pero la máquina tiene zona ATEX. Confirmar con Leonardo.

## 6. Parámetros para Plan de Control (NO al AMFE)

- Setpoint de temperatura POLY tanque (RTD PT2A en IW104)
- Setpoint de temperatura ISO tanque (RTD PT4A en IW108)
- Setpoint de temperatura mixhead POLY (RTD PT1A en IW96)
- Setpoint de temperatura mixhead ISO (RTD PT3A en IW100)
- Referencia de velocidad variador POLY (salida analógica AQW0)
- Referencia de velocidad variador ISO (salida analógica AQW1)
- Rampa de aceleración variadores SINAMICS G120 — parámetros P1120 / P1121
- Límite mínimo de presión hidráulica (E36)
- Límite mínimo de presión aire bombas POLY/ISO (E64/E65)
- Caudal POLY esperado por shot (E0.0/E0.1 pulsos)
- Caudal ISO esperado por shot (E0.2/E0.3 pulsos)
- Presión nominal mixhead POLY/ISO durante shot (AI4/AI5)
- Presión nominal bombas POLY/ISO durante shot (AI6/AI7)
- Tiempo de shot / posición fin (E0.7 Shot STOP)
- Posición plato rotativo start/stop (E56/E57)
- Límite wire-break sensores analógicos (<3.6 mA = falla)

## 7. Contradicciones / TBD para v4

1. **WE-7 v3 dice "balanza de dosificación"** — la secuencia confirma que la dosificación es por flowmeters electrónicos (E0.0-E0.3) y variadores (AQW0/AQW1), NO por balanza física. CONTRADICCIÓN: actualizar WE-7 a "flujómetros POLY/ISO".
2. **Chiller (E34) no está en el AMFE maestro v3.** Si el curado de la pieza depende del chiller (FASE 6), agregar al WE-4 Molde como subsistema "Chiller de refrigeración".
3. **Motor de planta giratoria (KM80) y sensores E56/E57** sugieren molde carrusel automático — el maestro v3 ya lo refleja en WE-4 ("carrusel automático").
4. **Zona ATEX:** confirmar con Leonardo si Barack tiene la máquina instalada con clasificación de área peligrosa y ventilación forzada.
5. **Rampas de variador (P1120/P1121):** parámetro de tuning que Leonardo debería confirmar si está validado en arranque.
6. **Verificación humana pre-arranque:** el doc describe lo que verifica el PLC, pero no menciona checklist humano pre-arranque del operador. Si Barack tiene checklist documentado, listarlo como control preventivo adicional. Confirmar con Leonardo.
