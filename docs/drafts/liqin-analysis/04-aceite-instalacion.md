---
fecha_extraccion: 2026-05-26
fuentes:
  - Aceite recomendado_20260324220348_48_16.png (imagen Liqin)
  - Installation Instructions_安装说明.pdf (8 páginas, traducción del chino vía Google)
agente: subagent análisis aceite+install (parte del panel de 4 agentes Liqin)
objetivo: Identificar requisitos de instalación, mantenimiento (aceite) y verificaciones periódicas que aplican como controles preventivos del proceso
hallazgos_clave:
  - Aceite hidráulico Great Wall L-HM 46 (ISO 11158 L-HM, -25 a +200 °C, vida útil sin abrir 5 años)
  - Alarma temperatura aceite hidráulico 50-55 °C (manual TP900 línea 156, cross-ref)
  - 8 pasos de instalación con 6 verificaciones periódicas aplicables como control preventivo
  - 15 placas base de moldes en plataforma giratoria
  - Valla de protección obligatoria
  - Frecuencias de cambio de aceite + cantidad NO especificadas (TBD-Leo)
---

# Análisis aceite.png + install.pdf — Liqin TP900

## Parte 1: Aceite recomendado

### Datos extraídos de la imagen

| Campo | Valor |
|---|---|
| **Marca** | 长城润滑油 (Great Wall Lubricants) |
| **Modelo/código** | **L-HM 46** (también muestra HM 32 / 46 / 68 — el círculo está sobre HM 46, es el seleccionado) |
| **Tipo** | Aceite hidráulico antidesgaste (Antiwear Hydraulic Oil) |
| **Norma** | **ISO 11158 L-HM** (clasificación HM = aceite hidráulico con aditivos antidesgaste, antioxidantes y antiherrumbre) |
| **Rango de temperatura de uso** | **-25 °C a +200 °C** |
| **Presentaciones** | 3.5 kg / 16 kg / 170 kg (lata pequeña / balde / tambor) |
| **Vida útil** | "未开封5年" → **5 años sin abrir** |

### Datos NO extraídos
- Frecuencia de cambio: **NO especificada** en la imagen (es ficha de producto, no plan de mantenimiento)
- Cantidad de carga del depósito hidráulico de la inyectora: **NO especificada**
- Intervalo entre cambios totales / cambios parciales: **NO especificado**

### Cross-reference con el manual del HMI
El control de la máquina tiene **alarma de temperatura del aceite hidráulico a 50–55 °C** (manual TP900 línea 156). Esto confirma sistema hidráulico real, no eléctrico/servo puro.

### Aplicación AMFE

**Categoría:** Control PREVENTIVO de MANTENIMIENTO sobre el WE-3 (Inyectora PU con dosificadora A:B). No es control de proceso productivo, es prerrequisito del estado de la máquina.

| FM al que refuerza | Razón |
|---|---|
| **FM-7 Ciclo automático incompleto** | Aceite degradado / temperatura fuera de 50–55 °C / contaminación → fallo bomba hidráulica → ciclo se interrumpe mid-curado → pieza sin consolidar (SCRAP) |
| FM-5 Fuga PU | Indirecto: pérdida de presión hidráulica en clamp del molde → cierre deficiente → fuga |
| FM-6 Pieza fuera de posición | Indirecto: presión irregular del clamp → desalineación del molde durante el espumado |

**¿Genera FM nuevo?** NO de forma independiente. Refuerza FMs existentes vía la causa raíz "Falla del sistema hidráulico de la inyectora".

**Sugerencia para v4:**
- Agregar a WE-3 (Inyectora) una causa específica bajo FM-7: *"Aceite hidráulico degradado o fuera de temperatura"*
- Control preventivo asociado: *"Cambio de aceite hidráulico L-HM 46 según plan de mantenimiento Liqin"* — la **frecuencia exacta queda TBD-Leo**
- Control detectivo asociado: *"Alarma de temperatura aceite hidráulico en HMI (50–55 °C)"* — esto SÍ está documentado en el manual, NO es invento

## Parte 2: Instrucciones de instalación

### Estructura del documento
- **8 páginas totales** (corto)
- Página 1: portada "Instrucciones de instalación del equipo de espumado PIP — Zhangjiagang Liqin Machinery Co., Ltd."
- Página 2: diagrama de disposición (layout)
- Página 3: **única página con texto** — 8 pasos de instalación
- Páginas 4–8: fotos de referencia (sin texto)
- **Traducción del chino vía Google Translate** ("Machine Translated by Google" en cada página)

### Texto literal de los 8 pasos (página 3)

1. Colocar el equipo principal (máquina de espumado de alta presión, plataforma giratoria, columnas) según el diagrama
2. Ajustar la plataforma giratoria nivelada y fijarla al suelo con pernos químicos
3. Instalar y fijar las **15 placas base de moldes** y accesorios en la plataforma giratoria
4. Instalar la tubería que conecta la máquina de espumado con el cabezal de mezcla
5. Fijar el bastidor de la bomba de alimentación y conectar con mangueras flexibles al tanque de material
6. Colocar el enfriador y conectarlo a la máquina de espumado con tuberías
7. Instalar la valla de protección
8. Conectar los cables eléctricos

### Requisitos de instalación críticos

| # | Requisito | Si NO se cumple | FM relacionado |
|---|---|---|---|
| 1 | Plataforma giratoria **nivelada y fijada con pernos químicos** al suelo | Vibración / desalineación del molde durante giro → fuga de mezcla, pieza descentrada | **FM-5 Fuga PU**, **FM-6 Fuera de posición** |
| 2 | **15 placas base** correctamente fijadas a la plataforma giratoria | Molde mal calzado → mezcla escapa entre placa y molde | **FM-5 Fuga PU** |
| 3 | Tuberías de mezcla A:B correctamente conectadas al cabezal | Fuga de poliol/isocianato fuera del molde + riesgo químico | **FM-5 Fuga PU**, **FM-8 Riesgo operario** |
| 4 | Bomba de alimentación con manguera flexible al tanque (sin tensión mecánica) | Pérdida de cebado → dosificación A:B incorrecta | **FM-1 Delaminación**, **FM-2 Huecos**, **FM-4 Zonas duras** |
| 5 | **Enfriador conectado** a la máquina | Aceite hidráulico se calienta sobre 55 °C → alarma + bomba ineficaz → ciclo interrumpido | **FM-7 Ciclo incompleto** |
| 6 | **Valla de protección** instalada antes de operar | Operario expuesto a partes móviles del carrusel | **FM-8 Riesgo operario** (refuerza el OS) |
| 7 | Cables eléctricos conectados según diagrama | Suministro eléctrico incorrecto → arranque incompleto / corte mid-ciclo | **FM-7 Ciclo incompleto** |

### Riesgos durante la instalación (one-time, NO van al AMFE recurrente)

El documento es muy escueto — no enumera explícitamente riesgos. Lo único deducible:
- Manipulación de equipo pesado (plataforma giratoria, máquina alta presión)
- Trabajo con pernos químicos (epoxi de fijación al suelo)
- Conexiones eléctricas

Estos son **one-time** durante puesta en marcha. NO van al AMFE de proceso recurrente.

### Verificaciones post-instalación aplicables como control PREVENTIVO del proceso recurrente

| # | Verificación | FM al que aplica |
|---|---|---|
| V1 | **Nivelación de plataforma giratoria** (verificación periódica con nivel) | FM-5, FM-6 |
| V2 | **Estado de pernos químicos** de fijación al suelo (inspección visual periódica) | FM-5, FM-6 |
| V3 | **Anclaje de las 15 placas base** (chequeo periódico de apriete) | FM-5, FM-6 |
| V4 | **Estado de mangueras flexibles** poliol/isocianato (inspección visual por fugas o deterioro) | FM-5, FM-8 |
| V5 | **Funcionamiento del enfriador** (temperatura aceite hidráulico estable en pantalla HMI) | FM-7 |
| V6 | **Integridad de la valla de protección** (interlock de seguridad funcional) | FM-8 |

**Importante:** Frecuencias de V1–V6 NO están en el PDF. Quedan como **TBD-Leo** — no inventarlas.

## Parte 3: Tabla consolidada de hallazgos

| # | Fuente | Hallazgo | Aplicación AMFE | FM relacionado |
|---|---|---|---|---|
| 1 | aceite.png | Aceite hidráulico Great Wall L-HM 46, ISO 11158, rango –25/+200 °C | Refuerza WE-3 con causa "aceite degradado" | FM-7 |
| 2 | aceite.png | Vida útil sin abrir 5 años | Dato logístico, no AMFE | – |
| 3 | aceite.png | Sin frecuencia de cambio especificada | Quedar TBD-Leo | FM-7 |
| 4 | manual_text.txt línea 156 (cross-ref) | Alarma temperatura aceite hidráulico 50–55 °C en HMI | Control detectivo documentado | FM-7 |
| 5 | install.pdf p.3 paso 2 | Plataforma giratoria nivelada + pernos químicos | Control preventivo periódico | FM-5, FM-6 |
| 6 | install.pdf p.3 paso 3 | 15 placas base fijadas | Control preventivo periódico | FM-5 |
| 7 | install.pdf p.3 paso 6 | Enfriador conectado a máquina | Refuerza control de FM-7 | FM-7 |
| 8 | install.pdf p.3 paso 7 | Valla de protección obligatoria | Control preventivo OS | FM-8 |
| 9 | install.pdf p.3 paso 5 | Mangueras flexibles bomba-tanque | Inspección visual fugas | FM-5, FM-8 |
| 10 | install.pdf (negativo) | NO menciona: ventilación de gases, temperatura ambiente, suelo nivelado más allá de la plataforma, suministro eléctrico (voltaje/fase) | Gap: WE-8 (Environment) sigue sin sustento documental | – |

## Parte 4: FMs nuevos sugeridos

**Ninguno nuevo.** Los 9 FMs actuales cubren todos los hallazgos extraídos. Lo que SÍ se sugiere:

- **Reforzar FM-7** (ciclo incompleto) con causa nueva: *"Sistema hidráulico de la inyectora degradado (aceite, enfriador, presión)"*
- **Reforzar FM-8** (riesgo operario) con causa nueva: *"Valla de protección o interlock de seguridad inoperativo"*

Ambos son causas adicionales bajo FMs existentes — no son FMs nuevos.

## Parte 5: Contradicciones y TBD

### Sin contradicciones encontradas entre los dos archivos.

### TBD identificados (todos para Leonardo)

1. **Frecuencia de cambio de aceite hidráulico L-HM 46** — la imagen NO la dice
2. **Cantidad de carga del depósito hidráulico** (litros)
3. **Frecuencia de las verificaciones V1–V6** (nivelación, pernos, placas, mangueras, enfriador, valla)
4. **Procedimiento de control post-fuga de PU** (no está en install.pdf — es un plan de reacción de FM-5)
5. **Voltaje y fase eléctrica requerida** — install.pdf paso 8 solo dice "conectar cables eléctricos", sin spec
6. **Requisitos de ventilación de gases** — install.pdf NO los menciona pese a que el WE-8 (Environment) del draft los lista
7. **Temperatura ambiente requerida** — install.pdf NO la menciona
8. **Plan de mantenimiento preventivo Liqin** completo (debe existir en otro doc del fabricante; no está en estos dos archivos)

### Limitación de fuente
El install.pdf es **corto y traducido automáticamente del chino por Google**. Es un manual de instalación de alto nivel, NO un manual técnico de mantenimiento. Para los TBDs 1–8, hay que pedir a Liqin el manual de mantenimiento técnico o consultar con Leonardo si Barack tiene el doc completo en otra carpeta.
