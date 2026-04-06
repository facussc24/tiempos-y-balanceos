# Barack Mercosul - Tiempos y Balanceos

App 100% web React 19 + TypeScript + Supabase para gestion de calidad automotriz
(AMFE VDA, Plan de Control AIAG, Hojas de Operaciones) y lean manufacturing
(balanceo de linea, simulador de flujo, kanban, heijunka, mix multi-modelo).
Multi-usuario con auth Supabase (email/password). Sin Tauri, sin Gemini.

## Protocolo de inicio de sesion

Al arrancar CADA sesion:
1. Leer `docs/LECCIONES_APRENDIDAS.md` — para no repetir errores
2. Leer `.claude/rules/` relevantes al modulo que se va a tocar
3. Si Fak menciona un producto, leer el AMFE/CP/HO/PFD de ese producto ANTES de hacer cambios
4. Si hay PDFs de referencia, leerlos con el metodo de `docs/COMO_LEER_PDF.md`

## Protocolo de fin de sesion — OBLIGATORIO, NO OPCIONAL

ANTES de decirle a Fak que terminaste, SIEMPRE:
1. Actualizar docs/LECCIONES_APRENDIDAS.md con errores cometidos y correcciones de Fak
2. Si descubriste algo nuevo: actualizar la guia correspondiente
3. Si creaste reglas nuevas: verificar que esten en `.claude/rules/`

Si no actualizas estos archivos, el proximo Claude va a cometer los mismos errores.
Esto NO es opcional. NO preguntar si Fak quiere que lo hagas. HACERLO.

## Comportamiento proactivo

Despues de CADA tarea completada:
- Si modificaste un AMFE: verificar que CP y HO del mismo producto esten alineados. Si no, REPORTAR.
- Si modificaste un CP: verificar que la HO refleje los cambios. Si no, REPORTAR.
- Si un cambio afecta a TODOS los productos (ej: formato de fechas, nombres de columnas): SUGERIR aplicarlo a los 8 productos, no esperar a que Fak lo pida.
- Si detectas inconsistencias entre documentos: reportarlas INMEDIATAMENTE.
- Si tenes dudas sobre un dato: poner TBD y avisar a Fak. NUNCA inventar.

## Control de revisiones

Los documentos APQP son "documentos vivos" segun IATF 16949:
- Cambios diarios se registran en audit trail (fecha + que cambio)
- Las revisiones mayores (A, B, C) solo cambian en hitos oficiales:
  - Rev A: Prelanzamiento
  - Rev B: PPAP aprobado / Produccion masiva
  - Rev C: Cambio de ingenieria mayor (ECN del cliente)
- Los cambios pequenos NO generan nueva revision — se acumulan en el borrador de trabajo

## Como interactuar con Fak

- Fak escribe en espanol informal con typos. Entender sin corregir.
- Fak NO es programador. Explicar decisiones tecnicas en lenguaje simple.
- NUNCA preguntar "queres que haga X?" — HACERLO y reportar.
- REFUERZO: Si te encontras a punto de escribir "queres que...?" o "lo hago?" — PARA. La respuesta es siempre SI. Hacelo y reporta que lo hiciste.
- NUNCA inventar datos numericos (pesos, tolerancias, temperaturas). Si no sabes: TBD.
- NUNCA inventar acciones de optimizacion en AMFEs (ver `.claude/rules/amfe-actions.md`).
- Si Fak te corrige: agregar a `docs/LECCIONES_APRENDIDAS.md` inmediatamente.
- Si detectas un problema: reportar sin esperar a que Fak pregunte.
- Si un cambio afecta multiples productos: sugerir verificar los demas.
- Evolucionar: despues de cada sesion, preguntarte "que puedo hacer mejor la proxima vez?" y documentarlo.

## Reglas de Negocio APQP (OBLIGATORIO — validadas por AIAG-VDA 2019 y AIAG CP 2024)

### Clasificación CC/SC (CORREGIDA — la regla anterior era incorrecta)
- **CC (Crítica):** SOLO Severidad 9-10 O requerimiento legal/seguridad del cliente. Benchmark: 1-5% de items.
- **SC (Significativa):** SOLO si el cliente la designó con símbolo, O equipo multidisciplinario demuestra impacto en función primaria (típicamente S=7-8 en puntos de fijación, dimensiones de ensamble críticas). Benchmark: 10-15%.
- **Estándar (sin clasificación):** TODO lo demás. Benchmark: 80-90% de items.
- **PROHIBIDO:** SC = S≥5 AND O≥4 — esa regla infla las clasificaciones y genera no conformidades en auditoría IATF.

### Calibración de Severidad para piezas de cabina interior (Insert, Armrest, Top Roll, Headrest)
- **S=9-10:** Flamabilidad, emisiones VOC, interferencia airbag, bordes filosos expuestos al habitáculo.
- **S=7-8:** Falla de encastre severa que para línea VW, desprendimiento en campo (clips rotos).
- **S=5-6:** Arrugas masivas, delaminación, costura torcida, Squeak & Rattle, retrabajo offline.
- **S=3-4:** Hilo suelto, mancha limpiable, retrabajo in-station.

### Filtrado AMFE→CP→HO
- **AMFE→CP:** Todo pasa al CP, pero AP=L se agrupa en líneas genéricas por operación. AP=H/M y CC/SC van como línea individual.
- **CP→HO:** SOLO pasan los controles que el operario ejecuta en su estación. Controles de laboratorio, metrología especializada y auditoría NO van en la HO.
- **Los responsables en CP y HO deben coincidir para el mismo control.**

### Idioma y formato
- TODO en español, CERO textos en inglés entre paréntesis.
- Plan de reacción: usar referencias SGC (P-09/I, P-10/I, P-14).

### Guías detalladas (leer antes de modificar módulos APQP)
- `docs/GUIA_PLAN_DE_CONTROL.md`
- `docs/GUIA_AMFE.md`
- `docs/GUIA_HOJA_DE_OPERACIONES.md`
- `docs/GUIA_PFD.md`
- `docs/ERRORES_CONCEPTUALES_APQP.md` — errores graves ya detectados, NO repetirlos.
- `docs/LECCIONES_APRENDIDAS.md` — historial de errores, leer al inicio de cada sesion.
- `docs/ARQUITECTURA_CAMPOS_HEREDADOS.md` — campos heredados vs locales en CP/HO.
- `docs/COMO_LEER_PDF.md` — metodos para leer PDFs de referencia.

## Reglas Críticas — NO ROMPER

### 1. NUNCA usar datos mock/placeholder
- Todo dato que se muestre, exporte o teste DEBE venir de Supabase real.
- Si una función de export necesita datos, debe reusar los mismos hooks/repositories que ya funcionan en la UI.
- Si un seed script carga datos, debe verificar que no existan antes de insertar (upsert o check-then-insert).
- PROHIBIDO: strings como "datos reales generados", "placeholder", "TODO: cargar datos".

### 2. NUNCA crear duplicados en Supabase
- Antes de insertar familias, documentos o members: query primero si ya existen.
- Las 8 familias canónicas son: Insert Patagonia, Armrest Door Panel Patagonia, Top Roll Patagonia, Headrest Front/Rear Center/Rear Outer Patagonia, Telas Planas PWA, Telas Termoformadas PWA.
- Si un seed/migration crea más de 8 familias, algo está mal — abortar y reportar.
- Nombres de cliente: "VWA" (no "Volkswagen Argentina", no "095 VOLKSWAGEN").

### 3. Export Excel: xlsx-js-style para AMFE/CP, ExcelJS para HO
- AMFE y CP: SOLO xlsx-js-style (`XLSX.utils.book_new()`).
- HO: SOLO ExcelJS (necesita imágenes: logo + pictogramas PPE).
- PROHIBIDO mezclar librerías en el mismo export.
- Paquete APQP: Portada + Flujograma + AMFE + CP en xlsx-js-style. HO se exporta individualmente.

### 4. Reusar antes de crear
- Buscar si ya existe una función que haga lo mismo antes de crear una nueva.
- Los exports individuales ya funcionan — el paquete APQP debe llamarlos, no reimplementar.
- Los hooks de Supabase (useAmfe, usePlanControl, etc.) ya funcionan — reusar.

### 5. Verificación obligatoria
- Después de cualquier seed/migration: contar familias (debe ser 8), contar documentos, verificar 0 duplicados.
- Después de cualquier export: abrir el archivo y verificar que tiene datos reales.
- TypeScript: `npx tsc --noEmit` sin errores.
- Tests: `npx vitest run --testPathPattern="módulo-afectado"`.

## Supabase — Estructura de Datos APQP (MAPA OBLIGATORIO)

### Tablas principales de documentos

Todos los documentos APQP guardan sus datos en una columna `data` de tipo JSONB. La estructura es:

```
amfe_documents    → data: { header: {...}, operations: [...] }
cp_documents      → data: { header: {...}, items: [...] }
ho_documents      → data: { header: {...}, sheets: [...] }
pfd_documents     → data: { header: {...}, steps: [...] }
```

### Estructura JSON del AMFE (amfe_documents.data)

```jsonc
{
  "header": {
    "companyName", "scope", "partNumber", "applicableParts",
    "responsibleEngineer", "coreTeam", "preparedBy", "approvedBy",
    "amfeDate", "revisionLevel", "revisionDate"
  },
  "operations": [
    {
      "id": "uuid",
      "operationNumber": "10",      // STRING, ordenar con parseInt()
      "operationName": "RECEPCION DE MATERIA PRIMA",
      "linkedPfdStepId": "uuid",
      "workElements": [
        {
          "id": "uuid",
          "description": "...",
          "functions": [
            {
              "id": "uuid",
              "description": "...",
              "failures": [
                {
                  "id": "uuid",
                  "description": "modo de falla",
                  "effectLocal": "...",
                  "effectNextLevel": "...",    // OBLIGATORIO (3 niveles VDA)
                  "effectEndUser": "...",      // OBLIGATORIO
                  "causes": [
                    {
                      "id": "uuid",
                      "description": "causa",
                      "severity": 7,           // 1-10
                      "occurrence": 4,         // 1-10
                      "detection": 6,          // 1-10
                      "actionPriority": "M",   // "H", "M", "L"
                      "preventionControl": "...",
                      "detectionControl": "...",
                      "preventionAction": "...",  // OBLIGATORIO si AP=H
                      "detectionAction": "...",
                      "responsible": "Carlos Baptista (Ingeniería)",
                      "targetDate": "2026-07-01",
                      "status": "Pendiente"
                    }
                  ]
                }
              ]
            }
          ]
        }
      ]
    }
  ]
}
```

### Estructura JSON del Plan de Control (cp_documents.data)

```jsonc
{
  "header": {
    "partName", "partNumber", "applicableParts",
    "companyName", "customerName",
    "coreTeam": "Carlos Baptista (Ingeniería), Manuel Meszaros (Calidad), Marianna Vera (Producción)",
    "preparedBy": "Facundo Santoro",
    "approvedBy": "Carlos Baptista",
    "customerApproval": "",         // Campo ÚNICO (no separar ing/cal)
    "revisionLevel", "revisionDate"
  },
  "items": [
    {
      "id": "uuid",
      "processStepNumber": "10",    // STRING, ordenar con parseInt()
      "processStepName": "RECEPCION DE MATERIA PRIMA",
      "machineTool": "N/A",         // NUNCA poner "Visual" acá — eso es método
      "characteristic": "Flamabilidad del material",
      "classification": "CC",       // "CC", "SC", o "" (vacío = estándar)
      "specification": "Según TL 1010 VW",  // NUNCA "Conforme a especificación" genérico
      "evaluationTechnique": "Certificado de laboratorio",
      "sampleSize": "1 muestra",
      "sampleFrequency": "Por entrega",
      "controlMethod": "Inspección documental de certificado",
      "reactionPlanOwner": "Inspector de Calidad",  // SIEMPRE rol, nunca nombre de persona
      "reactionPlan": "Segregar lote, notificar s/ P-09/I",
      "amfeCauseIds": ["uuid"],     // Vínculo con causas del AMFE
      "linkedAmfeOperationId": "uuid"
    }
  ]
}
```

### Estructura JSON de Hoja de Operaciones (ho_documents.data)

```jsonc
{
  "header": {
    "documentNumber": "I-IN-002.4-R01",
    "partDescription", "hoNumber": "HO-10",  // Formato "HO-{opNumber}"
    "preparedBy": "Facundo Santoro",
    "approvedBy": "Carlos Baptista"
  },
  "sheets": [
    {
      "id": "uuid",
      "hoNumber": "HO-10",
      "operationNumber": "10",
      "operationName": "RECEPCION DE MATERIA PRIMA",
      "linkedCpOperationNumber": "10",
      "steps": [                    // Pasos TWI (Training Within Industry)
        {
          "id": "uuid",
          "stepNumber": 1,
          "description": "Verificar documentación del proveedor",
          "keyPoints": [            // Puntos clave ★
            { "text": "Comparar remito con orden de compra", "symbol": "★" }
          ],
          "reasons": ["Asegurar trazabilidad del lote"]
        }
      ],
      "qcItems": [                  // Ciclo de control (viene del CP)
        {
          "id": "uuid",
          "cpItemId": "uuid",       // Vínculo 1:1 con CP item
          "characteristic": "Flamabilidad",
          "controlMethod": "Certificado de laboratorio",
          "frequency": "Por entrega",
          "responsible": "Inspector de Calidad",  // DEBE coincidir con CP
          "specification": "Según TL 1010 VW",
          "reactionPlan": "Segregar lote s/ P-09/I"
        }
      ],
      "ppe": ["anteojos", "guantes", "zapatos"],  // EPP por operación
      "visualAids": []
    }
  ]
}
```

### Estructura JSON del PFD (pfd_documents.data)

```jsonc
{
  "header": { "partName", "partNumber", "companyName" },
  "steps": [
    {
      "id": "uuid",
      "stepNumber": "10",
      "name": "RECEPCION DE MATERIA PRIMA",
      "type": "operation",  // "operation", "inspection", "transport", "storage", "decision"
      "linkedAmfeOperationId": "uuid"
    }
  ]
}
```

### Tablas de soporte

```
products                    → id, nombre, descripcion, part_number
product_families            → id, name, description, linea_code, linea_name, active
product_family_members      → family_id, product_id, is_primary (M:N)
customer_lines              → id, name, customer_id
```

### Cómo actualizar datos en Supabase eficientemente

Para actualizar campos DENTRO del JSON `data`, usar el patrón:

```javascript
// 1. Leer el documento completo
const { data: doc } = await supabase
  .from('cp_documents')
  .select('id, data')
  .eq('id', docId)
  .single();

// 2. Modificar el objeto JavaScript
const updatedData = { ...doc.data };
updatedData.items = updatedData.items.map(item => {
  if (item.processStepNumber === '10') {
    return { ...item, reactionPlanOwner: 'Inspector de Calidad' };
  }
  return item;
});

// 3. Guardar el documento completo
await supabase
  .from('cp_documents')
  .update({ data: updatedData })
  .eq('id', docId);
```

Para documentos grandes (>100KB), usar `updateDocDirect()` del helper si existe.

## Productos — Mapa Completo (8 familias, 62 documentos)

### VWA — Proyecto PATAGONIA

| Familia | Part Number | Docs | Master | Variantes |
|---------|------------|------|--------|-----------|
| Insert Patagonia | N 227 a N 403 | 4+3 | AMFE+CP+HO+PFD | [L0]: AMFE+CP+PFD (sin HO) |
| Armrest Door Panel | N 231 | 4 | AMFE+CP+HO+PFD | — |
| Top Roll | N 216 / N 256 / N 285 / N 315 | 4 | AMFE+CP+HO+PFD | — |
| Headrest Front | 2HC881901 RL1 | 4+9 | AMFE+CP+HO+PFD | [L1][L2][L3]: AMFE+CP+HO (sin PFD) |
| Headrest Rear Center | 2HC885900 RL1 | 4+9 | AMFE+CP+HO+PFD | [L1][L2][L3]: AMFE+CP+HO (sin PFD) |
| Headrest Rear Outer | 2HC885901 RL1 | 4+9 | AMFE+CP+HO+PFD | [L1][L2][L3]: AMFE+CP+HO (sin PFD) |

### PWA — Proyecto HILUX

| Familia | Part Number | Proyecto | Docs |
|---------|------------|----------|------|
| Telas Planas | 21-9463 | HILUX 581D | AMFE+CP+HO+PFD |
| Telas Termoformadas | 21-9640 | HILUX 582D | AMFE+CP+HO+PFD |

### Equipo APQP (datos correctos para headers)
- **Carlos Baptista** — Ingeniería (responsibleEngineer, approvedBy)
- **Manuel Meszaros** — Calidad
- **Facundo Santoro** — Realizador (preparedBy)
- **Marianna Vera** — Producción
- **Gonzalo Cal** — G.Cal (HO)
- **Cristina Rabago** — Seguridad e Higiene
- Core team CP: "Carlos Baptista (Ingeniería), Manuel Meszaros (Calidad), Marianna Vera (Producción)"

### Roles válidos para controles (CP reactionPlanOwner / HO qcItem.responsible)
- "Operador de producción" — autocontrol en estación
- "Líder de Producción" — verificaciones, liberación arranque
- "Inspector de Calidad" — controles especiales, recepción MP
- "Recepción de materiales" — inspección de entrada
- "Metrología" — mediciones con instrumentos calibrados
- "Laboratorio" — ensayos funcionales/materiales
- "Supervisor de Producción" — verificaciones periódicas

## Reglas contextuales (.claude/rules/)

Reglas que se cargan automaticamente al tocar archivos del modulo correspondiente:

| Archivo | Globs | Contenido |
|---------|-------|-----------|
| `amfe.md` | `modules/amfe/**` | Severidades calibradas, CC/SC, efectos 3 niveles VDA, familias |
| `control-plan.md` | `modules/controlPlan/**` | Cross-validation, filtrado AMFE→CP, responsables, familias |
| `hoja-operaciones.md` | `modules/hojaOperaciones/**` | Filtrado CP→HO, EPP coherente, duplicados, familias |
| `exports.md` | `modules/**/export*.ts` | Ordenamiento numerico, librerias por modulo, columnas |
| `testing.md` | `__tests__/**` | React 19 gotchas, mocks, datos de test |
| `database.md` | `utils/repositories/**` | Repositorios tipados, Supabase, race conditions |

## Stack

| Capa         | Tecnologia                                          |
|--------------|-----------------------------------------------------|
| Runtime      | React 19.2, TypeScript 5.8, Vite 6                  |
| Auth + DB    | Supabase (@supabase/supabase-js) + SQLite (sql.js)  |
| Testing      | Vitest 4.x + @testing-library/react + jsdom         |
| Styling      | TailwindCSS 3.4                                     |
| Export       | xlsx-js-style (AMFE/CP), ExcelJS (HO), html2pdf.js  |
| Charts       | Recharts 3.4                                        |
| DnD          | @dnd-kit/core                                       |

## Comandos

```bash
npm run dev          # Vite dev server (localhost:3000)
npx vitest run       # Correr todos los tests
npx vitest run --coverage  # Tests con coverage (v8)
npm run build        # Build de produccion
npx tsc --noEmit     # Chequeo de tipos
```

## Estructura del proyecto

```
/                       Raiz del proyecto (NO hay carpeta src/ principal)
  App.tsx               Entry point
  AppRouter.tsx         Routing con lazy loading
  types.ts              Tipos compartidos (~1500 lineas)
  config.ts             Configuracion global
  index.tsx             React root

  components/           UI reutilizable
    auth/               AuthProvider, LoginPage (Supabase auth)
    ui/                 Componentes base (Button, Input, Modal, etc.)
    modals/             ConfirmModal, ExportModal, etc.
    layout/             AppShell, Sidebar, Header
    charts/             Wrappers de Recharts
    navigation/         DropdownNav, Breadcrumbs
    landing/            Landing page components

  core/                 Motores de calculo
    balancing/          Algoritmos de balanceo (SALBP-1, SALBP-2, COMSOAL, etc.)
    inheritance/        Herencia maestro→variante (familias de producto)
      documentInheritance.ts   Clonado maestro→variante (UUID regen)
      overrideTracker.ts       Diff variante vs maestro
      changePropagation.ts     Propagacion cambios maestro→variantes

  hooks/                Custom hooks (useLineBalancing, useProjectPersistence, etc.)

  modules/              Modulos de negocio
    amfe/               AMFE VDA + validacion cruzada con PFD
    controlPlan/        Plan de Control AIAG + cross-validation + link HO
    hojaOperaciones/    Hojas de operaciones (TWI, EPP, navy theme) + link CP
    pfd/                Diagrama de Flujo (cyan theme, ASME symbols) + link AMFE
    family/             Familias de producto (herencia, proposals)
    balancing/          UI de balanceo de línea
    dashboard/          Dashboard ejecutivo
    (mix, flow-simulator, heijunka, kanban, logistics-backlog)

  utils/
    repositories/       9 repositorios tipados (CRUD)
    supabaseClient.ts   Singleton Supabase client
    pfdAmfeLinkValidation.ts   Validacion cruzada PFD ↔ AMFE
    hoCpLinkValidation.ts      Validacion cruzada HO ↔ CP
    crossDocumentAlerts.ts     Alertas cascada APQP

  __tests__/            460+ archivos de test
```

## Estandares de calidad

### Mentalidad
- Nivel senior obligatorio. Verificar antes de editar. Leer el codigo completo.
- Subagentes no son infalibles (~40-50% false positives en audits). Verificar manualmente.
- Cada fix debe mejorar legibilidad. NO fixes cosméticos.
- Correr tests después de cada batch de cambios.

### Modo autónomo (deep audits)
- Trabajar sin parar hasta agotar el contexto.
- Usar subagentes para escaneo de archivos.
- Priorizar: PFD, AMFE, HO, Plan de Control, core/balancing.
- Clasificar: TRUE BUG > ROBUSTNESS > FALSE POSITIVE.
- Ante la duda, NO aplicar el fix.

### Reglas de codigo
- Usar repositorios para acceso a datos, nunca SQLite directo.
- NO hardcodear API keys. Usar `VITE_*`.
- Usar `logger.ts` en vez de `console.log`.
- NO usar `as any` ni `@ts-ignore`.
- Modulos lazy-loaded con `React.lazy()` + `Suspense`.

### Testing
- Framework: Vitest con globals habilitados.
- Durante desarrollo: `npx vitest run --testPathPattern=<módulo>`.
- Tests generales solo antes del commit final.

### Path aliases
- `@/*` mapea a la raiz del proyecto.

## Auth & Multi-usuario

- Supabase auth con email/password.
- Dev mode: botón "Entrar como admin (dev)" con `VITE_AUTO_LOGIN_EMAIL` / `VITE_AUTO_LOGIN_PASSWORD`.

## Validaciones cruzadas APQP

- PFD ↔ AMFE: `pfdAmfeLinkValidation.ts`
- HO ↔ CP: `hoCpLinkValidation.ts`
- CP interna: `cpCrossValidation.ts` (V1-V8)
- Cascada: `crossDocumentAlerts.ts` (PFD→AMFE→CP→HO)

## Familias de Producto (Herencia Maestro→Variante)

### Tablas
- `product_families` — Familias
- `product_family_members` — Productos en familia (M:N, uno `is_primary`)
- `family_documents` — Docs a familias (`is_master`, modulo)
- `family_document_overrides` — Cambios de variante vs maestro
- `family_change_proposals` — Propuestas maestro→variante (pending/auto_applied/accepted/rejected)

### Flujo
1. Clonado: `documentInheritance.ts` clona maestro→variante regenerando UUIDs.
2. Override: Al guardar variante, `triggerOverrideTracking` diffs vs maestro.
3. Propagación: Al guardar maestro, `triggerChangePropagation` genera proposals.
4. UI: `ChangeProposalPanel` muestra proposals pendientes.

## Produccion (GitHub Pages)

- URL: https://facussc24.github.io/tiempos-y-balanceos/
- Repo: https://github.com/facussc24/tiempos-y-balanceos (publico)
- Deploy: `npm run build && npx gh-pages -d dist`
