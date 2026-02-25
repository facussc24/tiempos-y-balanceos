# Estado del Proyecto — Barack Mercosul

**Fecha:** 2026-02-21

---

## Arquitectura

| Capa | Tecnologia | Notas |
|------|-----------|-------|
| Desktop runtime | Tauri 2.x | Plugins: sql, fs, dialog, shell |
| Frontend | React 19.2 + TypeScript 5.8 | Vite 6, lazy loading por modulo |
| Persistencia local | SQLite (tauri-plugin-sql) | WAL mode, busy_timeout=5000 |
| Persistencia red | Filesystem (tauri_smart_save) | Locks, atomic writes, backup rotation |
| AI | Gemini API (flash-lite + flash) | Cache in-memory, circuit breaker |
| Styling | TailwindCSS 3.4 | - |
| Testing | Vitest 4.x + jsdom | @testing-library/react |

### Modelo de datos

**Documento-relacional hibrido:** Los documentos complejos (AMFE con 5 niveles de anidamiento, HO con sheets/steps) se almacenan como JSON en columna `data`, con metadatos extraidos en columnas indexadas para queries rapidas.

**11 tablas SQLite:** projects, amfe_documents, amfe_library_operations, cp_documents, ho_documents, pfd_documents, drafts, settings, plant_config, ui_state, recent_projects

**8 repositorios tipados** en `utils/repositories/` — toda operacion de datos pasa por ellos.

**InMemoryAdapter** para modo web/dev cuando Tauri no esta disponible.

---

## Modulos y Estado

| Modulo | Directorio | Estado | AI | Tests |
|--------|-----------|--------|-----|-------|
| AMFE VDA | `modules/amfe/` | Completo | Sugerencias + Chat Copilot | 313+ |
| Plan de Control | `modules/controlPlan/` | Completo | Sugerencias + Chat + Cross-validation | 95+ |
| Diagrama de Flujo (PFD) | `modules/pfd/` | Completo | - | 60+ |
| Hojas de Operaciones | `modules/hojaOperaciones/` | Completo | - | 130+ |
| Balanceo de Linea | `modules/balancing/` + `core/` | Completo | - | 500+ |
| Mix Multi-Modelo | `modules/mix/` | Completo | - | - |
| Simulador de Flujo | `modules/flow-simulator/` | Completo | - | - |
| Heijunka | `modules/heijunka/` | Completo | - | - |
| Kanban | `modules/kanban/` | Completo | - | - |
| Dashboard | `modules/dashboard/` | Completo | - | - |
| Backlog Logistico | `modules/logistics-backlog/` | Completo | - | - |

### Funcionalidades transversales

| Feature | Estado | Notas |
|---------|--------|-------|
| Auto-save (SQLite drafts) | Completo | Reemplaza 4 bases IndexedDB |
| Guardado formal (filesystem) | Completo | Smart save con conflictos |
| Undo/Redo | Completo | Snapshots en memoria |
| Session locks | Completo | BroadcastChannel + localStorage |
| Export Excel | Completo | xlsx-js-style |
| Export PDF | Completo | html2pdf.js, base64 assets |
| Gemini AI | Completo | 7 campos AMFE, 5 campos CP, 2 copilots |
| Circuit breaker (AI) | Completo | 3 fallos → 60s cooldown |
| Help panel | Completo | Escalas VDA, atajos, flujo |
| Cross-validation CP↔AMFE | Completo | 5 validadores |

---

## Metricas

| Metrica | Valor |
|---------|-------|
| Archivos TypeScript | 513 |
| Lineas de codigo | ~122,500 |
| Archivos de test | 166 |
| Tests individuales | 2,362 |
| Test suites pasando | 166 |
| Tests fallando | 0 |
| Custom hooks | 18 |
| Repositorios SQLite | 8 |
| Tablas SQLite | 11 (incl. pfd_documents) |

---

## Deuda tecnica conocida

1. **4 `as any`** en repositorios — Casteos legitimos de `JSON.parse()` en columnas JSON. Podrían tiparse con runtime validation (zod/valibot).
2. **3 TODOs/FIXMEs menores** — Dispersos en codebase, ninguno critico.
3. **Data migration script** — Al hacer deploy a produccion, necesita un script que migre datos existentes de los archivos JSON del servidor a SQLite.
4. **Indices adicionales** — Agregar indices en columnas frecuentemente filtradas segun metricas de uso real.

---

## Ultimo hito completado

**Migracion a SQLite (2026-02-21):** Eliminacion de IndexedDB y JSON-filesystem para persistencia local. 10 tablas, 8 repositorios, InMemoryAdapter para fallback. 0 errores de compilacion, 2368 tests pasando.
