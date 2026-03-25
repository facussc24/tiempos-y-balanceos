# Reporte Nocturno Consolidado — 2026-03-22

## 1. Resumen Ejecutivo

El proyecto Barack Mercosul esta en buen estado general. TypeScript compila sin errores, 99%+ de tests pasan, y los datos en Supabase son consistentes (8 familias, 62 docs, 0 duplicados, 0 huerfanos). Los hallazgos principales son: (1) 48% de las causas AP=H estan sobre-clasificadas segun la tabla AIAG-VDA 2019 pero todas tienen acciones correctivas, (2) 3 archivos de scripts tienen credenciales hardcodeadas trackeadas en git, y (3) el bundle tiene 5 chunks >500KB dominados por librerias de Excel.

## 2. Issues Criticos

### 2.1 Credenciales hardcodeadas en git (Seguridad)
- **Archivos**: `scripts/seed-family-inserto.mjs`, `exports/generate-apqp-package-insert.mjs`
- **Credenciales expuestas**: password `Barack2024!`, email `admin@barack.com`, Supabase anon key
- **Riesgo**: Password vieja visible en historial de git publico
- **Accion**: Migrar scripts a usar `supabaseHelper.mjs`, cambiar password si sigue activa

### 2.2 Boton "Acceso rapido" visible en produccion (Seguridad)
- `LoginPage.tsx:145` usa `import.meta.env.VITE_AUTO_LOGIN_EMAIL` en vez de `import.meta.env.DEV`
- Si `.env.production` tiene esa variable, el boton aparece en produccion
- **Cualquier visitante puede auto-login como admin**
- **Accion**: Agregar `import.meta.env.DEV &&` como guard

### 2.3 Frecuencias time-based residuales en CP-TOPROLL-001 (Datos)
- El CP-TOPROLL-001 aun contiene "cada hora" y "cada 2 horas" en su data JSON
- Deberia ser event-based como el resto de los CPs
- **Accion**: Actualizar en proxima sesion de edicion

## 3. Issues Menores

### 3.1 AP=H infladas (48.4%)
- 147 de 304 causas AP=H deberian ser AP=M segun AIAG-VDA 2019
- Todas tienen acciones correctivas (100% compliance)
- Solo 2 con severidad baja (S=4) — impacto minimo
- **No corregir automaticamente** — esperar revision formal del equipo de calidad

### 3.2 Tests fallando (3-4 de 4027)
- FormatosApp y ManualesApp: texto "Inicio" duplicado (Breadcrumb + boton)
- Performance: threshold de 20ms demasiado ajustado
- **Fix simple**: cambiar `getByText` a `getAllByText[0]` y subir threshold

### 3.3 Dependencias no usadas (3)
- `@tanstack/react-virtual`, `simscript`, `@types/uuid`
- **Accion**: Remover de package.json

### 3.4 Warnings de build
- Circular dependency: `pfdNormalize.ts` ↔ `pfdTypes.ts`
- 6 modulos con mixed dynamic/static imports
- No afectan funcionalidad pero pueden causar orden de ejecucion impredecible

## 4. Metricas

### Tests
| Metrica | Valor |
|---------|-------|
| Test files | 259 (255 pass, 3-4 fail, 1 skip) |
| Tests | 4,027 (4,014+ pass, 3-5 fail, 8 skip) |
| Pass rate | 99.9% |
| Duracion | ~250s |

### TypeScript
| Metrica | Valor |
|---------|-------|
| Errores | 0 |
| Warnings | 0 |
| Version | 5.8.2 |

### Bundle
| Metrica | Valor |
|---------|-------|
| Total JS (minified) | ~6.2 MB |
| Total JS (gzip) | ~1.9 MB |
| Total CSS | 175 KB (27 KB gzip) |
| Chunks > 500KB | 5 |
| Mayor chunk | exceljs.min.js (940 KB) |
| Build time | 1m 56s |

### Datos Supabase
| Metrica | Valor |
|---------|-------|
| Familias | 8 (correcto) |
| Documentos APQP | 62 (correcto) |
| Family members | 33 |
| Duplicados | 0 |
| Huerfanos | 0 |
| CP con freq time-based | 1 (CP-TOPROLL-001) |

### AMFE AP=H
| Metrica | Valor |
|---------|-------|
| Total causas | 1,112 |
| Causas AP=H | 304 |
| AP=H correctas | 157 (51.6%) |
| AP=H infladas | 147 (48.4%) |
| AP=H sin accion | 0 (100% compliance) |
| AP=H con S<=4 | 2 |

### Seguridad
| Metrica | Valor |
|---------|-------|
| `Barack2024` en src/ | 0 |
| `admin@barack` en src/ | 0 |
| `service_role` en src/ | 0 |
| Credenciales en scripts trackeados | 3 archivos |
| Boton auto-login en produccion | SI (falta guard DEV) |
| .env.production en .gitignore | SI |

### Codigo
| Metrica | Valor |
|---------|-------|
| Deps no usadas | 3 |
| Componentes huerfanos | 0 |
| Exports sin uso | 0 |

## 5. Acciones Recomendadas (Priorizadas)

### Prioridad Alta
1. **Seguridad**: Corregir `LoginPage.tsx:145` — agregar `import.meta.env.DEV &&` para ocultar "Acceso rapido" en produccion
2. **Seguridad**: Migrar `seed-family-inserto.mjs` y `generate-apqp-package-insert.mjs` a `supabaseHelper.mjs` — eliminar credenciales hardcodeadas
3. **Seguridad**: Verificar si password `Barack2024!` sigue activa — cambiarla si es asi
4. **Datos**: Actualizar frecuencias de CP-TOPROLL-001 a event-based

### Prioridad Media
5. **Tests**: Corregir 3-4 tests fallando (texto duplicado "Inicio", threshold performance)
6. **Deps**: Remover `@tanstack/react-virtual`, `simscript`, `@types/uuid` de package.json
7. **AMFE**: Informar al equipo de calidad sobre 147 causas AP=H infladas para revision formal

### Prioridad Baja
8. **Bundle**: Evaluar lazy loading de ExcelJS/xlsx-js-style (solo al exportar)
9. **Build**: Resolver circular dependency pfdNormalize ↔ pfdTypes

## Reportes Individuales

- [AUDITORIA_APH_NOCTURNA.md](AUDITORIA_APH_NOCTURNA.md) — Tarea 1
- [REPORTE_TESTS_NOCTURNO.md](REPORTE_TESTS_NOCTURNO.md) — Tarea 2
- [REPORTE_TYPESCRIPT_NOCTURNO.md](REPORTE_TYPESCRIPT_NOCTURNO.md) — Tarea 3
- [REPORTE_CODIGO_MUERTO.md](REPORTE_CODIGO_MUERTO.md) — Tarea 4
- [REPORTE_DATOS_NOCTURNO.md](REPORTE_DATOS_NOCTURNO.md) — Tarea 5
- [REPORTE_SEGURIDAD_NOCTURNO.md](REPORTE_SEGURIDAD_NOCTURNO.md) — Tarea 6
- [REPORTE_BUNDLE_NOCTURNO.md](REPORTE_BUNDLE_NOCTURNO.md) — Tarea 7
