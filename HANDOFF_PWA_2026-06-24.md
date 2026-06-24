# HANDOFF — Sesión PWA Telas Planas Grampas — 2026-06-24

> Leé esto completo antes de hacer cualquier cosa. Contiene TODO el contexto de la sesión anterior.
> El trabajo quedó a mitad: el AMFE-3 Grampas está diseñado pero NO insertado en Supabase todavía.

---

## 1. Qué se estaba haciendo

Análisis de 12 Planes de Control (PDFs) de piezas blancas PWA para:
1. Agrupar las 12 piezas en 3 familias AMFE
2. Verificar cobertura PC→AMFE (qué falta en el AMFE)
3. Construir los AMFEs necesarios — **SOLO AMFE, no CP ni HO**

---

## 2. Los 3 grupos (APROBADOS por Fak)

| Grupo | Proceso | Códigos | AMFE base |
|---|---|---|---|
| **GRUPO 1 — APLIX** | troquelado aplix + pegado + costura overlock | 21-6621, 21-6567, 21-6699, 21-6757 | AMFE-1 (Supabase, existente) |
| **GRUPO 2 — GRAMPAS** | costura overlock + engrampado manual | 21-6756, 21-6758, 21-6766, 21-7467, 21-7763 | **AMFE-3 (PENDIENTE — construir)** |
| **GRUPO 3 — TNT** | corte sin costura ni sujeción | 21-7339, 21-7340, 21-7341 | AMFE-1 (subconjunto, agregar códigos) |

**AMFE-1 en Supabase:**
- id: `57011560-d4c1-4a8a-83f0-ed37a2bab1d5`
- amfe_number: `AMFE-1`
- applicable_parts: `21-9463` (otro proyecto, mismo proceso — agregar 6621/6567/6699/6757/7339/7340/7341)
- ops: 10 RECEPCION → 15 PREP CORTE → 20 CORTE → 25 MYLAR → 30 PREP KITS → 40 COSTURA → 50 TROQ REFUERZOS → 60 TROQ APLIX → 70 PEGADO APLIX → 80 CONTROL FINAL → 100/101/102 REPROCESOS → 110 EMBALAJE

---

## 3. Supabase

- Proyecto: `fbfsbbewmgoegjgnkkag`
- MCP server id: `a174b030-f4bf-4d80-a56f-a6a142cea470`
- **CRÍTICO:** columna `data` en `amfe_documents` es **TEXT**, no JSONB. Usar `data::jsonb` para queries y guardar como texto serializado en INSERT.
- 13 AMFEs presentes, datos intactos.

### Schema de amfe_documents
```sql
id TEXT, amfe_number TEXT, project_name TEXT, subject TEXT, client TEXT,
part_number TEXT, responsible TEXT, organization TEXT, status TEXT,
operation_count INT, cause_count INT, ap_h_count INT, ap_m_count INT,
coverage_percent FLOAT, start_date TEXT, last_revision_date TEXT,
revision_level TEXT, created_at TIMESTAMPTZ, updated_at TIMESTAMPTZ,
data TEXT, revisions TEXT, checksum TEXT
```

### Schema interno del JSON en `data`
```json
{
  "header": {
    "rev", "scope", "client", "revDate", "subject", "coreTeam": [],
    "location", "modelYear", "startDate", "amfeNumber", "approvedBy",
    "partNumber", "preparedBy", "reviewedBy", "companyName", "responsible",
    "customerName", "elaboratedBy", "organization", "plantApproval",
    "revisionLevel", "applicableParts", "confidentiality",
    "processResponsible", "responsibleEngineer"
  },
  "operations": [
    {
      "id", "name", "opNumber", "responsible",
      "workElements": [
        {
          "id", "name", "type" (Man/Machine/Material/Method/Measurement/Milieu),
          "functions": [
            {
              "id", "description", "requirements", "functionDescription",
              "failures": [
                {
                  "id", "ap", "description", "severity", "detection", "occurrence",
                  "effectLocal", "effectNextLevel", "effectEndUser",
                  "causes": [
                    {
                      "id", "ap", "cause", "description", "severity", "occurrence",
                      "detection", "specialChar" (CC/SC/""), "status", "apNew",
                      "filterCode", "targetDate", "_autoFilled", "actionTaken",
                      "responsible", "severityNew", "detectionNew", "observations",
                      "occurrenceNew", "_reclassSource", "actionPriority",
                      "completionDate", "detectionAction", "detectionControl",
                      "preventionAction", "preventionControl", "characteristicNumber"
                    }
                  ]
                }
              ]
            }
          ]
        }
      ],
      "operationName", "operationNumber", "productLocation",
      "machineDeviceTool", "operationFunction", "focusElementFunction"
    }
  ]
}
```

---

## 4. TAREA PENDIENTE PRINCIPAL: Construir AMFE-3 Grampas

### Header del AMFE-3
```
amfeNumber: AMFE-3
subject: "Proceso de fabricación - Telas Planas con sujeción por Grampas"
client/customerName: PWA
applicableParts: "21-6756, 21-6758, 21-6766, 21-7467, 21-7763"
partNumber: "21-6756 / 21-6758 / 21-6766 / 21-7467 / 21-7763"
project_name: "PWA/HILUX/TELAS_PLANAS_GRAMPAS"
responsible: Carlos Baptista (copiar de AMFE-1)
coreTeam: [Carlos Baptista (Ingenieria), Manuel Meszaros (Calidad), Marianna Vera (Produccion)]
organization/companyName: BARACK MERCOSUL
location: PLANTA HURLINGHAM
revisionLevel: A
startDate / revDate: 2026-06-24
approvedBy / plantApproval: Gonzalo Cal
preparedBy: Facundo Santoro
```

### Operaciones del AMFE-3 (flujo según PCs)

```
OP10  RECEPCION DE MATERIA PRIMA
OP15  PREPARACION DE CORTE
OP20  CORTE
OP25  CONTROL CON MYLAR
OP40  COSTURA (overlock ZOJE)
OP50  COLOCADO DE GRAMPAS  ← OPERACIÓN NUEVA, NO está en AMFE-1
OP80  CONTROL FINAL DE CALIDAD
OP100 REPROCESO: ELIMINACION DE HILO SOBRANTE
OP101 REPROCESO: CORRECCION DE COSTURA DESVIADA/FLOJA
OP102 REPROCESO: CORRECCION DE GRAMPAS FALTANTES/MAL COLOCADAS  ← nuevo
OP110 EMBALAJE
```

---

## 5. Data completa de los 5 PCs del Grupo Grampas

### PC 21-6756 — ENCOSTO TRASEIRO 100% C/APB (punzonado 100gr)
**Recepción:**
- Tela Punzonado Blanco 100gr: peso 100gr/m2 ±10% (balanza electrónica), ancho 2000±20mm (MC406), color blanco (visual/patrón), flamabilidad **D <100mm/min CC** (cámara MC184)
- Hilo 150/1: tipo poliester texturizado, color BLANCO(51), N°métrico 150/1, 100% poliester
- Hilo 120: tipo poliester fibra cortada 120, color BLANCO, N°métrico 40/2, 100% Spun Poliester
- **Grampas (material entrante):** ancho 11,9±1mm (vernier MC413), alto 6±0,5mm (vernier MC413)

**OP15 Prep corte:** tendido 30 capas, medición largo (regla MC334), control apilado (alineación pilones). Máquina BMA 089/1.

**OP20 Corte (Manual, BMA 089):** 30 capas, cuchilla mín 4mm (vernier), **24 orificios ∅4±0,5mm** (patrón/visual), control forma Mylar = **NO HAY**.

**OP30 Costura Overlock ZOJE:** aguja N°16/18, hilo 120 (40/2) + hilo 150/1 texturizado, aspecto costura fuerte sin arrugas (visual/muestra patrón).

**OP35 Colocado de grampas (MANUAL):** 3 grampas/orificio, ayuda visual/pieza patrón, **72 grampas total**. Autocontrol 100%/lote + 1 pieza inspector. Inicio turno y tras intervención/parada >1H.

**OP40 Inspección final:** aspecto posición cantidad grampas (72 total), inspector calidad.

**OP50 Embalaje:** identificación código (ARB), cantidad por medio = 25, final de turno.

**Test Lay-Out (anual, 5 piezas, laboratorio):** Cota 1=735±3mm, Cota 2=1349±3mm, Cota 3=24 orificios ∅4±0,5mm.

---

### PC 21-6758 — ENCOSTO TRASEIRO 100% S/APB (punzonado 100gr)
Igual a 6756 excepto:
- Mylar = **MC384** (tiene Mylar)
- **21 orificios ∅4±0,5mm**
- **63 grampas total** (3 por orificio × 21)

---

### PC 21-6766 — TELA ASSENTO TRASEIRO 40% (punzonado 100gr)
Igual a 6756 excepto:
- Mylar = **MC370**
- **21 orificios ∅4±0,5mm**
- **54 grampas total** (3 por orificio × 18)

---

### PC 21-7467 — TELA BIFELT 140 ASSENTO DIANTEIRO TOY (punzonado 140gr)
Diferencias respecto a 6756:
- **Tela 140gr** (no 100gr), peso 140gr/m2 ±10%
- Mylar = **MC385**
- **12 orificios ∅4±0,5mm + 2 orificios ∅8mm** (total 14 orificios)
- **24 grampas total**

---

### PC 21-7763 — TELA ASSENTO DIANTEIRO LH (punzonado 140gr)
Diferencias respecto a 6756:
- **Tela 140gr**, Mylar = **MC362**
- **12 orificios ∅4±0,5mm + 2 orificios ∅8mm**
- **21 grampas total**

---

## 6. Reglas Barack que DEBEN respetarse al construir el AMFE

1. **NO INVENTAR controles/equipos/frecuencias** — usar SOLO lo que dice el PC arriba.
2. **Flamabilidad = CC, S=10** (D <100mm/min, cámara MC184) — siempre CC en recepción.
3. **AP=H sin acción → placeholder** `"Pendiente definicion equipo APQP"`.
4. **Funciones en 3 niveles** (sistema/subsistema/componente) como en AMFE-1.
5. **No copiar failures de pegado-aplix** para grampas — la falla es diferente (posición/cantidad grampas, no integridad magnética).
6. **Grampas-specific failures a contemplar** (derivadas del control del PC):
   - "Grampas en cantidad incorrecta" (falta o exceso)
   - "Grampas mal posicionadas (orificio incorrecto)"
   - "Grampa floja / mal cerrada"
   Estas son derivables del control "Aspecto posición y cantidad — 3 grampas/orificio s/ayuda visual". NO se están inventando controles; se está derivando la falla de lo que el PC controla.
7. **Usar AMFE-1 como plantilla** para las ops compartidas (recepción, costura, control final, embalaje) — copiar estructura y adaptar contenido.
8. **data column = TEXT** — serializar todo el JSON como string en el INSERT.

---

## 7. Análisis de cobertura completado (para referencia)

### Lo que YA cubre AMFE-1 (para los 3 grupos):
✅ OP10 Recepción tela (peso/ancho/color/flamabilidad CC/hilos)
✅ OP15 Prep corte / tendido 30 capas
✅ OP20 Corte + orificios + cuchilla
✅ OP25 Control Mylar
✅ OP40 Costura overlock (ZOJE)
✅ OP80 Control final
✅ OP110 Embalaje

### Lo que FALTA en AMFE-1 (gaps identificados):
❌ **GRAMPAS completo** — toda la operación OP35 + material grampa en recepción + control final grampas (Grupo 2, 5 piezas) → requiere AMFE-3
⚠️ **Costura RECTA JUKI** para refuerzo airbag en 21-6567 y 21-6699 — está la falla del airbag en OP40 overlock de AMFE-1 pero no como operación recta separada. Menor — puede resolverse agregando workElement en OP40 de AMFE-1.

---

## 8. Cómo seguir (próximos pasos concretos)

### Paso A — AMFE-3 Grampas (prioridad)
1. Leer AMFE-1 completo de Supabase como plantilla estructural:
   ```sql
   SELECT data FROM amfe_documents WHERE amfe_number='AMFE-1';
   ```
2. Construir JSON del AMFE-3 con las ops del punto 5 arriba + reglas del punto 6.
3. Generar UUIDs para todos los ids (op, workElement, function, failure, cause).
4. INSERT en amfe_documents (ver schema en punto 3).
5. Verificar con COUNT y query de ops.

### Paso B — AMFE-1 actualización (después del A)
- Agregar al `applicableParts` de AMFE-1: `21-6621, 21-6567, 21-6699, 21-6757, 21-7339, 21-7340, 21-7341`
- Agregar en recepción el control diferencial tela 140gr (para los TNT que lo tienen si aplica)
- Evaluar si agregar costura recta JUKI como workElement en OP40 para 6567/6699

### Paso C — Backup
```bash
cd C:\...\dev\BarackMercosul && node scripts/_backup.mjs
```

---

## 9. PDFs disponibles

Los PDFs de los 11 PCs están en la nueva PC (verificar ruta):
- `PC 21-6621.pdf`, `PC 21-6699-6567.pdf`, `PC 21-6756.pdf`, `PC 21-6757.pdf`
- `PC 21-6758.pdf`, `PC 21-6766.pdf`, `PC 21-7339.pdf`, `PC 21-7340.pdf`
- `PC 21-7341.pdf`, `PC 21-7467.pdf`, `PC 21-7763.pdf`

> NOTA: El handoff tiene toda la data extraída de los PCs. No necesitás re-leer los PDFs si los pasos de arriba son suficientes. Los PDFs son la fuente original si necesitás verificar algo específico.

---

*Generado automáticamente al cierre de sesión — 2026-06-24*
