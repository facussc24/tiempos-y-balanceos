---
name: auditoria-cliente
description: Auditar AMFEs contra la NORMA (AIAG-VDA, IATF 16949) con rol de auditor externo de cliente, ANTES de entregar un lote. Distinto de /audit-amfe (que audita contra nuestras reglas destiladas): aca el auditor NO recibe las reglas del repo — audita con la fuente primaria, que es lo que el 21/08/2026 encontro en 20 minutos 7 hallazgos que 3 dias de trabajo no vieron. Acepta filtro de producto opcional (ej: "AMFE-HF-PAT", "ARMREST"). Deja marcador en .audit-cliente/ que habilita el export oficial (gate en _exportAmfeOficial.ts).
---

# Auditoría de cliente — revisar con el rol y la fuente de quien va a auditar

Origen: análisis del 22/08/2026 (aprobado por Fak). El cuello de botella no es el acceso a
la norma, es el ROL (autor vs. auditor) y el MOMENTO (redactando vs. lote terminado). Esta
auditoría rompe la correlación de puntos ciegos: el auditor trabaja con la NORMA, no con
nuestro destilado.

## Flujo (en orden, sin saltear)

### 1. Dump live

Dump de los AMFEs a auditar (filtro del argumento; sin argumento = los 8) desde Supabase
live al scratchpad, con script temporal patrón `verify-supabase-live.md` (`.env.local`).
Registrar el `updated_at` de cada documento — va al marcador del paso 5. El dump del mismo
turno es foto válida; uno viejo no.

### 2. UN subagente auditor (techo 5 respetado — acá es 1)

Lanzar 1 `Agent` (general-purpose) con este encuadre:

- **Rol**: auditor externo de cliente automotriz, auditoría de PFMEA contra AIAG-VDA FMEA
  1st Edition (2019) e IATF 16949. Su trabajo es encontrar lo que está MAL para el cliente,
  no confirmar lo que está bien ni reparar nada.
- **PROHIBIDO en su prompt**: leer `.claude/rules/`, `docs/GUIA_AMFE.md`, `CLAUDE.md`,
  `docs/LECCIONES_APRENDIDAS.md` o memorias del repo. Si los lee, hereda los puntos ciegos
  del autor y la auditoría no vale.
- **Fuentes** (lectura con método `docs/COMO_LEER_PDF.md`; base OneDrive
  `C:\Users\FacundoS-PC\BARACK ARGENTINA SRL\Ingeniería y Proyecto - General\INGENIERIA BARACK (NUNCA BORRAR)\4- MANUALES\`):
  - AIAG-VDA: `AMFE\FMEA-AMFE-VDA-AIAG\446076670-FMEA-AIAG-VDA-First-Edition-pdf.pdf`
  - IATF: `IATF\IATF16949-IATF-SIs-May-2022-ISO9001-Integrados.pdf`
  - SETEC (CC/SC pág. 129): `AMFE\MANUAL AMFE  R06 Julio 2020 Participante.pdf`
  - Mapa tema→página (lecturas dirigidas): `.sgc-cache/manuales/*.md` si existe
  - Los dumps del paso 1
- **Regla OneDrive**: lecturas puntuales de páginas; nada recursivo (`docs-empresa`).
- **Salida exigida**: tabla de hallazgos — documento, ubicación (OP/WE/causa), qué exige la
  norma, qué dice el AMFE, y **cita de capítulo/página**. Un hallazgo sin cita no es hallazgo.

### 3. Verificar cada hallazgo en la sesión principal

Los subagentes tienen ~40-50% de falsos positivos: releer la página citada del manual y el
dato real del documento antes de aceptar. Clasificar CONFIRMADO / FALSO POSITIVO. Ante la
duda, no es CONFIRMADO.

### 4. Trinquete — hallazgo confirmado → check ejecutable (skill `rule-enforcement-gate`)

En la MISMA sesión: cada CONFIRMADO sistematizable se convierte en check de
`scripts/_lib/amfeValidator.mjs` + caso real en `scripts/_verificarAprendizajeAmfe.mjs` +
test. Correcciones de DATOS en Supabase: confirmar con Fak antes (autonomy-contract);
CC/SC jamás se asignan solas.

### 5. Marcador

Escribir `.audit-cliente/<amfe_number>.json` (carpeta gitignoreada) por cada AMFE auditado:

```json
{ "fecha": "<ISO de hoy>", "updated_at_auditado": "<updated_at del paso 1>",
  "hallazgos": N, "confirmados": M }
```

Este marcador es lo que el gate de `_exportAmfeOficial.ts` exige (validez 7 días). Se
escribe DESPUÉS del paso 3, nunca antes: un marcador sin verificación es un gate mentido.

### 6. Reporte a Fak

Tabla de confirmados con cita de norma. Sin narrativa de proceso, sin falsos positivos
(esos se mencionan solo como conteo).

## Señales de que esto dejó de funcionar (abandonar a tiempo)

- La misma categoría de hallazgo aparece en 2 auditorías seguidas → el paso 4 no se está
  haciendo; arreglar el trinquete, no agregar corpus.
- Un tercero (Carlos, auditor de cliente) encuentra 2 veces algo normativo que este flujo
  no vio → revisar rol/fuentes del auditor.
- Los hallazgos caen a cero de golpe → sospechar contaminación del auditor (leyó las
  reglas, o corrió con contexto del autor), no perfección.
