# Preguntas para Leonardo — Maestro Inyección PUR in place (v2)

**Contexto:** Maestro AMFE para el proceso de Inyección PUR in place (foam-in-place) aplicado a los 3 Apoyacabezas Patagonia (HF-PAT, HRC-PAT, HRO-PAT) — proyecto VW427/1LA_K, cliente PWA/Woodbridge.

**Fuentes ya consultadas:**
- HO-968 APC DELANTERO Rev A (AMAROK) — 6 pasos del proceso
- Imágenes oficiales VW (4 pasos foam-in-place + funda tri-capa)
- PPT proveedor Woodbridge "Apresentaçao defeitos de capas 3" — 28 slides defectos
- Plano VW (3 normas legales: TL 1010 / VW 50180 / EU 2000/53/EG)
- Manual AMFE AIAG-VDA SETEC pag 129 (criterios CC/SC/OS/HI)
- AMFEs actuales HF-PAT / HRC-PAT / HRO-PAT en Supabase

**Lo que Fak ya respondió (no preguntar a Leonardo):**
- Cliente NO marcó CC/SC adicionales en QTR
- No hay PPAP oficial aún (etapa preliminar/prelanzamiento)
- Solo los 3 Headrest Patagonia llevan este proceso
- Cuántos moldes / cuántos operarios → NO van en AMFE
- Maestro NO se alinea con HO (Fak hace HOs manuales fuera del software)
- Parámetros numéricos → NO van en AMFE, van en CP futuro
- EPP confirmado obvio: ropa de trabajo + zapatos seguridad + protectores auditivos. EPP químico → preguntar a Leo abajo

---

## 🔥 BLOQUE F — Controles preventivos y detectivos (CRÍTICO — sin esto el AMFE no cierra)

**F1.** Para evitar **FUGAS de PU** (FM-5): ¿qué controles preventivos hay hoy?
- ¿Sensor de presión en el molde?
- ¿Verificación visual obligatoria del sello vinilo/varilla antes de cerrar?
- ¿Inspección visual al cerrar molde (operario)?

**F2.** Para **MEZCLA INCORRECTA iso/poliol** (causa de FM-1, FM-3, FM-4, FM-LEG):
- ¿La máquina alarma si el ratio sale de rango?
- ¿Hay calibración periódica de la dosificadora? ¿Cada cuánto está documentada?
- ¿Se pesa muestra de cada componente al arranque de turno?

**F3.** Para **TEMPERATURA de molde** (causa de FM-1, FM-7):
- ¿Termómetro con alarma del PLC?
- ¿Registro de temperatura por turno?
- ¿Visualización en panel del operario?

**F4.** Al **DESMOLDEO** (control detectivo de todos los FMs producto):
- ¿Inspección visual 100% del operario?
- ¿Test de dureza Shore por muestreo?
- ¿Ensayo destructivo (corte transversal) periódico?

**F5.** Frecuencia real del **autocontrol del operario**:
- ¿Inicio de turno + cada N piezas?
- ¿Continuo durante el ciclo automático?
- ¿Algo documentado en hoja de operación?

---

## 🟡 BLOQUE D — Defectos del PPT proveedor (validar relevancia)

**D1. Delaminación** (las capas se despegan) — ¿se ha visto en Patagonia o Amarok? ¿Frecuencia aproximada?

**D2. Huecos en la espuma** — ¿problema recurrente o esporádico?

**D3. Contaminación con partículas** — ¿toca alguna norma adicional VW (VOC, REACH)? ¿Hay ensayo VOC por lote?

**D4. Zonas duras (hard spots)** — ¿se ha detectado en Barack?

**D5. Fugas de PU durante inyección** — ¿qué porcentaje de scrap del sector viene de fugas?

**D6.** ¿Hay defectos típicos en Patagonia que NO están en el PPT Woodbridge y debamos incluir en el AMFE?

---

## 🟢 BLOQUE C — Equipos y máquina

**C1. Marca y modelo de la dosificadora/inyectora PU** (Cannon? Krauss-Maffei? Hennecke? otra?). Necesario para el WE Machine.

**C2.** ¿La máquina tiene PLC con alarmas para parámetros fuera de rango (ratio, temperatura, presión)?

**C3.** ¿Hay calibración programada de la dosificadora? Frecuencia documentada según hoja de mantenimiento.

---

## 🟢 BLOQUE G — Operario y EPP químico

**G1. ¿Qué EPP químico adicional al básico se exige en el sector PU?**
- Respirador con filtro orgánico?
- Antiparras?
- Guantes térmicos / químicos?
- Delantal químico?
- Ducha lavaojos cercana?

**G2. ¿Hay protocolo escrito para emergencia (cómo y cuándo usar el botón STOP rojo)?**

**G3. ¿Existe procedimiento SGC específico del proceso PU? Si sí, ¿qué código tiene (P-09/I, P-14, otro)?**
- Lo necesitamos para el plan de reacción del CP futuro.

---

## 🟡 BLOQUE I — Reprocesos

**I1.** Una pieza con PU defectuoso ¿se puede retrabajar o **siempre va a SCRAP**?

**I2.** ¿Hay alguna pieza recuperable? (ej: desmontar funda y rehacer enfundado + nueva inyección)

**I3.** Los reprocesos OP 80 (hilo sobrante), OP 81 (puntada floja), OP 82 (arrugas en horno) — ¿son del proceso de **costura post-inyección** o específicos del PU?

---

## 🟢 BLOQUE J — Historial del cliente

**J1.** ¿Hay 8D, alertas o no conformidades históricas de PWA/VW sobre el proceso PU en Patagonia o Amarok?

**J2.** ¿Hay informes técnicos / causa raíz documentados que cubran este proceso?

---

## 💰 BLOQUE K — Parámetros del proceso (para Plan de Control futuro, NO AMFE)

Estos NO van en el AMFE, pero los aprovechamos a tirarle a Leonardo en la misma reunión para el CP.

**K1.** Ratio Iso/Poliol — valor nominal + tolerancia
**K2.** Temperatura de los componentes (poliol e isocianato) — rango operativo
**K3.** Temperatura de molde — rango operativo
**K4.** Tiempos del ciclo: crema / colada / gel / demolde / curado total
**K5.** Presión de inyección — rango operativo
**K6.** Peso shot (gramos por pieza) — nominal + tolerancia

---

## 🟢 BLOQUE A — Confirmar alcance (rápido)

**A1.** El proceso PU de Patagonia (VW427/1LA_K) ¿es idéntico al del Amarok (HO-968) o tiene cambios?

---

## L — Observaciones libres de Leonardo

(Espacio para que Leonardo agregue lo que considere relevante)

---

**Total:** ~20 preguntas efectivas (versus 50 de la v1). Si Leonardo tiene 30-45 min, alcanza bien.

**Fecha:** 2026-05-22
**Estado:** v2 — limpia de preguntas que Fak ya respondió. Lista para reunión con Leonardo.
**Próximo paso:** Una vez respondidas, actualizar `MAESTRO_PU_IN_PLACE_DRAFT.md` (v4) y aplicar a Supabase con `PLAN_APLICACION_MAESTRO_PU.md`.
