# Preguntas para Leonardo — Maestro Inyección PUR in place

**Contexto:** Estamos armando el AMFE Maestro para el proceso de Inyección PUR in place (foam-in-place) aplicado a los 3 Apoyacabezas Patagonia (HF-PAT, HRC-PAT, HRO-PAT) — proyecto VW427/1LA_K, cliente PWA/Woodbridge.

Leonardo conoce el proceso a fondo. Estas preguntas surgen del análisis de:
- HO-968 APC DELANTERO Rev A (AMAROK)
- Imágenes oficiales VW del proceso (4 pasos + funda tri-capa)
- Presentación proveedor Woodbridge "Production Cover Issues" (28 slides)
- AMFEs actuales en Supabase de los 3 Headrest

**Cómo usar este documento:** Cada bloque tiene preguntas numeradas. Leonardo puede responder al lado de cada una (o sobre el papel impreso). Las que queden sin respuesta quedarán como **TBD** en el AMFE.

---

## A — Alcance y mapeo del proceso

**A1.** La HO-968 del APC Delantero (AMAROK) describe el proceso PUR in place en 6 pasos (OP 50 enfundado → OP 51 inserción varilla → OP 52 precinto → OP 60 carga molde → OP 61 cierre + boquilla → OP 62 inyección automática). **¿En Patagonia (VW427/1LA_K) el proceso es idéntico, o tiene cambios respecto al Amarok?**

**A2.** ¿Sólo los 3 Headrest Patagonia llevan este proceso, o algún otro producto del proyecto también?

---

## B — Numeración de OPs en los AMFE actuales (incidente 2026-04-20)

**B1.** En **HF-PAT** (delantero), el AMFE en Supabase hoy tiene **OP 63 = INYECCIÓN DE PU**, pero la HO oficial preliminar Rev A dice **OP 62**. ¿Cuál es la correcta? ¿Hay que renumerar el AMFE para que matchee con la HO?

**B2.** En **HRC-PAT** (rear center) y **HRO-PAT** (rear outer), el AMFE en Supabase hoy tiene:
- OP 50 = INYECCIÓN DE PU (1 work element solo, muy poco)
- OP 60 = ENFUNDADO (vacío)

Es decir, el enfundado aparece **después** de la inyección, lo cual contradice el proceso lógico (primero se enfunda, después se inyecta). En HF-PAT está al revés (enfundado OP 50, inyección OP 62-63). **¿En HRC y HRO el proceso real es diferente al HF, o es un error de captura en el AMFE?**

---

## C — Equipos y máquina del ciclo PU

**C1.** ¿Es un carrusel automático con varios moldes? **¿Cuántos moldes tiene el carrusel?**

**C2.** **Marca y modelo de la dosificadora/inyectora PU** (Cannon, Krauss-Maffei, Hennecke, otra). Lo necesitamos para el Work Element Machine (NO inventar nombres).

**C3.** ¿Hay alguna calibración programada de la dosificadora? Frecuencia documentada (sin valor numérico inventado — preguntamos qué dice la hoja de mantenimiento real).

**C4.** ¿La máquina tiene PLC con alarmas para parámetros fuera de rango (ratio, temperatura molde, presión)?

---

## D — Defectos del PPT proveedor Woodbridge — validar relevancia para Patagonia

El proveedor Woodbridge documenta 5 defectos producto típicos del proceso FIP. Necesitamos saber cuáles aplican y con qué frecuencia en Patagonia:

**D1. Decoupling** (desunión entre capas funda / espuma / sustrato) — **¿Se ha visto en Patagonia o Amarok?**

**D2. Voids** (huecos internos en la espuma) — ¿Recurrente o esporádico?

**D3. Contamination** (partículas extrañas en espuma) — ¿Existe? ¿Toca alguna norma VW (TL 1010, VOC, emisiones)?

**D4. Hard spots** (zonas duras por mal mezclado) — ¿Detectado?

**D5. Foam leaking** (fuga de PU del molde) — ¿Qué porcentaje del scrap del sector viene de fugas? (cualitativo está bien)

**D6.** ¿Hay defectos típicos en Patagonia que NO están en el PPT Woodbridge y debemos incluir? (ej: defectos específicos de los moldes Barack, o problemas con MP que no tenían en WFC)

---

## E — Severidades, CC y SC

**E1.** ¿Algún defecto del proceso PU toca **norma legal o de seguridad** del cliente VW?
- Flamabilidad TL 1010
- Emisiones VOC
- REACH / sustancias prohibidas
- Interferencia con airbag

**E2.** ¿El cliente (PWA / VW) **designó símbolos CC o SC** para el proceso PU en el PPAP oficial? ¿Tenemos el PPAP a mano?

**E3.** ¿Algún FM que en nuestro juicio debería ser CC o SC aunque el cliente no lo haya marcado?

---

## F — Controles del proceso (preventivos y detectivos)

Esto es lo más importante porque hoy todos están en TBD en el AMFE. Sin esto el AMFE no se puede aprobar.

**F1.** Para evitar **FUGAS DE PU** durante inyección, ¿qué controles preventivos existen hoy?
- ¿Hay verificación visual del sello vinilo/varilla antes de cerrar el molde?
- ¿Sensor de presión en el molde que detenga el ciclo si hay fuga?
- ¿Inspección visual del operario al cerrar?

**F2.** Para evitar **MEZCLA INCORRECTA iso/poliol**, ¿qué controles hay?
- ¿La máquina alarma si ratio sale de rango?
- ¿Calibración periódica de la dosificadora? Frecuencia real (la que dice la hoja de mantenimiento, no inventada)
- ¿Pesado de muestras de cada componente periódicamente?

**F3.** Para **TEMPERATURA DE MOLDE**, ¿qué hay?
- ¿Termómetro con alarma del PLC?
- ¿Visualización en panel?
- ¿Registro de temperatura por turno?

**F4.** Al **DESMOLDEO**, ¿qué controles detectivos hay?
- ¿Inspección visual 100% del operario?
- ¿Test de dureza por muestreo?
- ¿Inspección dimensional?
- ¿Ensayo destructivo periódico (corte transversal)?

**F5.** Frecuencia real del autocontrol del operario: ¿inicio de turno + cada N piezas? ¿Continuo durante el ciclo automático? (No queremos inventar "cada 2 horas")

---

## G — Operación, operario, EPP

**G1.** ¿Cuántos operarios trabajan en el sector PU? ¿Roles distintos (carga / descarga / control)?

**G2.** EPP requerido para el sector — confirmá cuáles:
- Respirador con filtro orgánico
- Antiparras
- Guantes térmicos / químicos
- Delantal químico
- ¿Hay ducha lavaojos cercana?

**G3.** ¿Hay protocolo escrito para emergencia (cómo y cuándo usar el botón STOP rojo)?

**G4.** ¿Existe procedimiento SGC específico del proceso PU? Si sí, **¿qué código tiene? (P-09/I, P-14, otro)** — lo necesitamos para los planes de reacción del CP.

---

## H — Control final post-PU (OP 70)

Hoy en el AMFE la OP 70 está vacía / genérica. Necesitamos llenarla.

**H1.** ¿Qué se controla específicamente en piezas con PU en el control final?
- Test de dureza (durómetro Shore)?
- Inspección visual de espuma a través de costuras?
- Verificación geométrica con plantilla?
- Peso de pieza?

**H2.** ¿Hay ensayos periódicos (no 100%) tipo laboratorio? Ej: corte transversal de una pieza por lote para verificar consolidación interna.

---

## I — Reprocesos (OP 80/81/82 — hoy todas vacías en HF-PAT)

**I1.** Una pieza con PU defectuoso, ¿se puede retrabajar o **siempre va a SCRAP**?

**I2.** ¿Hay alguna pieza recuperable? Ej: desmontar funda dañada y rehacer enfundado + nueva inyección.

**I3.** Los reprocesos OP 80 (hilo sobrante), OP 81 (puntada floja), OP 82 (arrugas en horno) — ¿son reprocesos del **proceso de costura** que se hacen post-inyección, o son específicos del PU?

---

## J — Historial y normas del cliente

**J1.** ¿Hay **8D, alertas o no conformidades históricas** de PWA / VW sobre el proceso PU en Patagonia o Amarok que debamos incorporar al AMFE? (Hay 13 fuentes en el notebook NLM "problemas-alertas-8d")

**J2.** ¿Hay **informes técnicos / causa raíz** documentados que cubran este proceso? (Hay 26 fuentes en NLM "informes-tecnicos")

**J3.** ¿Conocemos la **biblia de defectos visuales VW** que aplica a piezas con PU? ¿Algún criterio de aceptación visual específico?

---

## K — Parámetros del proceso (para el Plan de Control, NO para el AMFE)

Estos NO van en el AMFE (regla Barack), pero los necesitaremos cuando armemos el **Plan de Control**. Anotarlos ahora ahorra un viaje.

**K1.** Ratio Iso/Poliol — valor nominal + tolerancia.

**K2.** Temperatura de los componentes (poliol y isocianato) — rango operativo.

**K3.** Temperatura de molde — rango operativo.

**K4.** Tiempos del ciclo:
- Tiempo de crema (start de reacción)
- Tiempo de colada / inyección
- Tiempo de gel
- Tiempo de demolde / curado total

**K5.** Presión de inyección — rango operativo.

**K6.** Peso shot (gramos por pieza) — nominal + tolerancia.

---

## L — Observaciones libres de Leonardo

(Espacio para que Leonardo agregue lo que considere relevante y nosotros no preguntamos)

---

**Fecha:** 2026-05-22
**Estado:** Lista preliminar v1 — completar con Leonardo
**Próximo paso:** Una vez respondidas, actualizar el draft del Maestro PU (`MAESTRO_PU_IN_PLACE_DRAFT.md`) y aplicar a Supabase.
