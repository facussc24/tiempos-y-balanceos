---
fecha_extraccion: 2026-05-26
fuente: Sensores_PIP_IA-20260326.xlsx (carpeta Liqin TP900)
agente: subagent análisis sensores xlsx (parte del panel de 4 agentes Liqin)
objetivo: Identificar sensores, alarmas y controles automáticos del PLC Siemens S7-1200 que pueden funcionar como controles detectivos para el Maestro AMFE PUR
hallazgos_clave:
  - 66 sensores listados (56 DI + 8 AI 4-20mA + 4 RTD PT100 + 5 reservas)
  - PLC Siemens S7-1200 CPU 6ES7215-1AG40-0XB0
  - 5 puntos de parada de emergencia distintos (Box, Main, BOX2, Shot, Plant)
  - SafeDoor signal doble canal (categoria PLd/PLe típico)
  - Zona Ex (ATEX) confirmada por barreras Zener en sensores cilindros (pág 113)
  - 4 FMs nuevos candidatos identificados: agitador parado, falla refrigeración chiller, derrame químico, sobrepresión bomba
---

# Análisis sensores.xlsx — Inyectora TP900 Liqin (PIP)

## 1. Resumen del archivo

- **Total sensores relevados:** 66
- **Categorías encontradas:**
  - **DI (Digital Input):** 56 sensores — botones, botones de emergencia, fines de carrera, feedback de relés, monitoreo de variadores
  - **AI (Analógica 4-20 mA):** 8 sensores — presiones, niveles y temperaturas de tanques/mixhead
  - **RTD (PT100):** 4 sensores — temperaturas de mixhead y agua de tanques
  - **Reservas:** 5 entradas marcadas "Reserve" (sin función asignada hoy)
- **Familias funcionales identificadas:**
  - Dosificación: pulsos de medidores POLY/ISO (flow pulse A/B)
  - Mezcla: mixhead (presión, temperatura, posición de cilindros eyectado/retraído)
  - Limpieza de boquilla (purga): "Clean" / "Mixhead" botón + sensores
  - Seguridad: ESTOP múltiples, Shot STOP, puertas, parada de plato/carrusel
  - Tanques POLY/ISO: nivel máximo, nivel analógico, temperatura, presión aire
  - Bombas POLY/ISO: presión, sobrepresión, corriente (sobrecarga)
  - Hidráulico: temperatura alta, nivel bajo, presión mínima, presión mezcla, corriente
  - Calefacción tanques POLY/ISO: feedback de corriente
  - Agitadores POLY/ISO: feedback de corriente
  - Variadores POLY/ISO: fault flag
  - Servicios: voltaje control, chiller running

## 2. Tabla de hallazgos relevantes para AMFE

| # | Sensor / Item del archivo | Qué detecta o controla | Aplicación para AMFE | FM relacionado |
|---|---|---|---|---|
| 1 | E0.0 / E0.1 Poly Meter flow pulse A/B | Pulsos del caudalímetro de POLIOL | Control detectivo: si pulsos no coinciden con setpoint → mezcla mal dosificada | FM-LEG, FM-2, FM-4 |
| 2 | E0.2 / E0.3 ISO Meter flow pulse A/B | Pulsos del caudalímetro de ISOCIANATO | Control detectivo: pulsos confirman dosificación real ISO | FM-LEG, FM-2, FM-4 |
| 3 | E0.6 Box ESTOP | Botón parada emergencia en caja | Control de seguridad operario | FM-8 |
| 4 | E0.7 Shot STOP | Detiene la inyección | Control detectivo + parada de ciclo | FM-7, FM-8 |
| 5 | E1.0 Select Wet Shot | Selector modo "shot húmedo" | Selección de modo de proceso | FM-7 (ciclo) |
| 6 | E1.1 Select Auto Mode | Selector modo automático | Discrimina automático vs manual | FM-7 (causa: "Máquina sale del modo automático") |
| 7 | E1.2 / E54 Button Clean/Mixhead | Botón de limpieza/purga del mixhead | Control preventivo de FM-3 (purga entre ciclos) | FM-3 |
| 8 | E1.3 Shot Button | Botón de disparo de inyección | Operativo (no FM directo) | — |
| 9 | E1.4 Sensor Clean | Sensor que confirma posición de limpieza | Control detectivo: confirma purga ejecutada | FM-3 |
| 10 | E1.5 Sensor Shot | Sensor de inyección en curso | Control detectivo: confirma disparo | FM-7 |
| 11 | E20 Current Hydraulic | Feedback de sobrecarga hidráulica | Control detectivo de falla equipo | NUEVO (falla maquina) |
| 12 | E21 / E22 Current Poly Pump / ISO Pump | Sobrecarga bombas dosificadoras | Control detectivo: bomba con anomalía → riesgo mezcla incorrecta | FM-LEG, FM-2, FM-4 |
| 13 | E23 / E24 Current Poly Agitator / ISO Agitator | Sobrecarga agitadores de tanque | Control detectivo: agitador parado → componente decantado / mal homogeneizado | FM-LEG, FM-4 |
| 14 | E25 / E26 Current ISO Heating / Poly Heating | Sobrecarga calefacción tanques | Control detectivo: si calefacción falla → temp componentes fuera de rango | FM-4 |
| 15 | E27 / E30 Poly Inverter Fault / ISO Inverter Fault | Falla del variador de frecuencia | Control detectivo: variador en fault → dosificación irregular | FM-LEG, FM-2 |
| 16 | E31 Hydraulic Oil Temperature High | Aceite hidráulico sobre temperatura | Control detectivo + posible parada → ciclo incompleto | FM-7 |
| 17 | E32 Button Reset | Reset de fallas | Operativo (no FM directo) | — |
| 18 | E33 Control Voltage Monitoring | Monitor de tensión de control | Detección de corte energía / caída tensión | FM-7 (causa: "Corte de energía") |
| 19 | E34 Chiller Running flag | Flag chiller en marcha | Control preventivo: refrigeración del proceso | NUEVO (falla refrigeración) |
| 20 | E35 Hydraulic Oil LEVEL LOW | Nivel bajo aceite hidráulico | Control detectivo + parada | FM-7 (falla equipo) |
| 21 | E36 / E37 Hydraulic Min/Mix Pressure | Presión mínima y de mezcla hidráulica | Control detectivo: presión baja → mala fuerza de cierre / mala mezcla | FM-5 (fuga), FM-2 (huecos) |
| 22 | E45 Plant Stop Button | Botón paro del carrusel | Control de seguridad | FM-8 |
| 23 | E46 / E47 SafeDoor signal 1 / 2 | Sensores puertas de seguridad | Control preventivo: máquina no inyecta con puerta abierta | FM-8 |
| 24 | E50 / E51 Mixhead Air Cylinder ejected/retracted in place | Confirmación posición mixhead | Control detectivo: confirma que la boquilla llegó/volvió de la bolsa | FM-5 (causa: "Boquilla queda fuera de la bolsa") |
| 25 | E52 / E53 Cleaning Cylinder ejected/retracted into place | Confirmación posición cilindro de limpieza | Control detectivo: confirma purga | FM-3 |
| 26 | E55 / E56 / E57 Button/Sensor plant start / stop | Arranque/parada del carrusel | Control de ciclo automático | FM-7 |
| 27 | E60 / E61 Main ESTOP / BOX2 ESTOP | Paros emergencia generales | Control de seguridad operario | FM-8 |
| 28 | E62 / E63 Poly/ISO Tank MAX-LEVEL | Sensor nivel máximo digital de tanques | Control preventivo: evita derrame en recarga | NUEVO (derrame químico) |
| 29 | E64 / E65 Poly/ISO AirPressure LOW | Presión aire baja en línea de presurización tanque | Control detectivo: sin presión aire → dosificación incorrecta | FM-LEG, FM-2 |
| 30 | E66 / E67 Poly/ISO Pump OverPressure | Sobrepresión en bomba dosificadora | Control detectivo + parada | FM-5 (fuga por sobrepresión), falla equipo |
| 31 | E14 / E15 Clean / Shot Oil Cylinder Open monitor | Monitoreo cilindros hidráulicos en posición abierta | Control detectivo del ciclo hidráulico | FM-7 |
| 32 | AI 0 / AI 1 Poly/ISO Tank Temperature | Temperatura tanque (4-20 mA, lectura continua) | Control detectivo continuo + setpoint | FM-4 (zonas duras por temp fuera rango) |
| 33 | AI 2 / AI 3 Poly/ISO Tank LEVEL | Nivel tanque analógico (continuo) | Control preventivo: gestiona recarga + evita aspiración aire | FM-2 (huecos por aire en línea) |
| 34 | AI 4 / AI 5 Poly/ISO Mixhead Pressure | Presión en mixhead durante disparo | Control detectivo crítico: presión confirma mezcla a alta P | FM-2, FM-4, FM-LEG |
| 35 | AI 6 / AI 7 Poly/ISO Pump Pressure | Presión bomba (continua) | Control detectivo: confirma curva de dosificación | FM-LEG, FM-2 |
| 36 | IW96 / IW100 Poly/ISO Mixhead Temperature (PT100) | Temperatura mezcla en mixhead | Control detectivo crítico: temp mezcla = reactividad PU | FM-4, FM-7 |
| 37 | IW104 / IW108 Poly/ISO Tank Water Temperature (PT100) | Temperatura agua del tanque (camisa) | Control detectivo + setpoint climatización | FM-4 |

## 3. FMs nuevos candidatos

### FM-NUEVO-A — Falla de agitador de tanque (POLY o ISO) → componente decantado / mal homogeneizado
- **Por qué este sensor lo revela:** E23 / E24 (corriente de agitadores). Si el agitador está parado y el operario no lo nota, el componente puede decantar y la dosificación entrega producto fuera de especificación.
- **Severidad propuesta:** 6-7. Afecta directamente a FM-LEG (composición química incorrecta) y FM-4 (zonas duras).
- **Recomendación:** evaluar si se agrega como FM independiente o como causa adicional de FM-LEG/FM-4.

### FM-NUEVO-B — Falla de refrigeración (chiller) → temperatura del proceso fuera de control
- **Por qué este sensor lo revela:** E34 (chiller running flag) y E31 (Hydraulic Oil Temp High).
- **Severidad propuesta:** 5-6. Es causa raíz de FM-4 y FM-7 más que FM independiente.

### FM-NUEVO-C — Derrame de químico por sobrellenado de tanque en recarga
- **Por qué este sensor lo revela:** E62 / E63 (MAX-LEVEL digital) + AI 2 / AI 3 (nivel analógico).
- **Severidad propuesta:** 7-8 si hay riesgo de exposición al operario (peligro químico - isocianato es irritante respiratorio severo).

### FM-NUEVO-D — Sobrepresión en bomba dosificadora → fuga catastrófica
- **Por qué este sensor lo revela:** E66 / E67 (Pump OverPressure) son interlocks de seguridad.
- **Severidad propuesta:** 7. Va más allá del FM-5 actual (fuga "menor" del molde, S=4).

## 4. Controles detectivos concretos (refuerza Bloque F de preguntas Leonardo)

**FM-LEG (composición PU fuera de norma):**
- Caudalímetros POLY+ISO (E0.0-E0.3) → confirman ratio A:B
- Presión mixhead (AI 4, AI 5) → confirma mezcla a alta presión
- Temperatura mixhead PT100 (IW96, IW100) → confirma reactividad
- Corriente bombas (E21, E22) → detecta dosificación anómala
- Variadores fault (E27, E30) → detecta fallo de regulación

**FM-2 (huecos en espuma):**
- Presión mixhead (AI 4, AI 5) → presión baja = mezcla mal aireada o caudal insuficiente
- Pulsos caudalímetro vs setpoint → detecta peso shot insuficiente
- AirPressure LOW tanques (E64, E65) → causa de mala presurización

**FM-3 (contaminación):**
- Sensor Clean (E1.4) + Cleaning Cylinder ejected/retracted (E52, E53) → confirman ejecución de purga entre ciclos
- El archivo CONFIRMA que la purga es una secuencia automatizada con feedback

**FM-4 (zonas duras):**
- PT100 mixhead (IW96, IW100) → temperatura componentes
- PT100 agua tanques (IW104, IW108) → climatización camisa
- Tank Temperature (AI 0, AI 1) → temp componente en tanque
- Corriente calefacción (E25, E26) → calefacción funcionando

**FM-5 (fuga PU del molde):**
- Mixhead Air Cylinder ejected in place (E50) → confirma boquilla dentro de la bolsa antes del disparo
- Mixhead retracted in place (E51) → confirma retiro post-disparo

**FM-6 (fuera de posición):**
- Sensor plant start/stop (E56, E57) → posición del carrusel
- No hay sensor directo de posición de pieza dentro del molde

**FM-7 (ciclo incompleto):**
- Select Auto Mode (E1.1) → discrimina automático vs intervenido
- Control Voltage Monitoring (E33) → detecta caída de tensión
- Hydraulic Oil Temperature High (E31), Min Pressure (E36), LEVEL LOW (E35) → fallas que abortan ciclo
- Shot Oil Cylinder Open monitor (E15), Clean Oil Cylinder Open monitor (E14) → confirman posiciones del ciclo

**FM-8 (riesgo operario):**
- Box ESTOP (E0.6), Main ESTOP (E60), BOX2 ESTOP (E61), Shot STOP (E0.7), Plant Stop Button (E45) → **5 ubicaciones físicas de paro de emergencia**, no solo una
- SafeDoor signal 1 y 2 (E46, E47) → puertas de seguridad con doble canal

## 5. Parámetros para Plan de Control (NO al AMFE)

- Ratio Poliol:Isocianato (vía conteo pulsos E0.0-E0.3)
- Presión mixhead POLY e ISO (rango operativo definido por AI 4/AI 5)
- Presión bomba POLY e ISO (AI 6/AI 7)
- Temperatura componentes en tanque (AI 0/AI 1)
- Temperatura mezcla en mixhead (IW96/IW100)
- Temperatura camisa agua tanque (IW104/IW108)
- Nivel mínimo de tanque para producción + nivel máximo para corte recarga (AI 2/AI 3 + E62/E63)
- Presión mínima hidráulica (E36)
- Presión mezcla hidráulica (E37)
- Temperatura aceite hidráulico (umbral E31)
- Nivel mínimo aceite hidráulico (E35)
- Presión aire línea presurización tanques (E64/E65 umbrales)
- Presión sobrecarga bombas (E66/E67 umbrales)
- Tiempo de ciclo (implícito en la secuencia de sensores E50→E15→...→E51)

## 6. Contradicciones / TBD para v4

1. **5 botones STOP confirmados** (Box, Main, Box2, Shot, Plant). El draft v3 FM-8 causa 2 "Botón STOP fuera del alcance" requiere reformulación.
2. **Purga del mixhead es automatizada con feedback** (E1.4, E52, E53, E54). El control detectivo de FM-3 puede dejar de ser TBD.
3. **No hay sensor de "ciclo automático interrumpido por operario"** explícito. La causa 2 de FM-7 ("Operario interviene durante curado") queda sin control detectivo directo.
4. **No hay sensor de "posición de pieza/funda/varilla dentro del molde"**. FM-5 causa 5 ("Clamps de fijación mal cerrados") y FM-6 causas 1-4 (varilla/bolsita/vinilo mal colocados) dependen de verificación visual del operario.
5. **Reservas E40-E44**: 5 entradas digitales libres → futuros sensores planificados?
6. **"Wet Shot" (E1.0)** sugiere que la máquina puede operar también en otro modo (¿"dry shot"?). Confirmar con Leonardo.
