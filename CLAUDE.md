# Barack Mercosul - Tiempos y Balanceos

App web React 19 + TypeScript + Supabase para gestion de calidad automotriz
(**AMFE VDA + Plan de Control AIAG**) y lean manufacturing (balanceo de linea,
simulador de flujo, mix multi-modelo, calculadora de medios). Multi-usuario con
auth Supabase. PFDs y Hojas de Operaciones NO se hacen aca (regla `no-pfd-no-ho.md`);
sus documentos en Supabase son referencia historica de solo lectura.

## Protocolo de inicio de sesion

1. Leer `docs/LECCIONES_APRENDIDAS.md` (destilado corto de lecciones vigentes).
2. Si Fak menciona un producto: leer su AMFE/CP en Supabase live ANTES de hacer cambios.
3. PDFs de referencia: leerlos con el metodo de `docs/COMO_LEER_PDF.md`.

## Protocolo de fin de sesion — OBLIGATORIO, NO OPCIONAL

1. Actualizar `docs/LECCIONES_APRENDIDAS.md` con errores cometidos y correcciones de Fak.
2. Si tocaste datos Supabase: `node scripts/_backup.mjs` (snapshot preventivo).
3. Lanzar agente `auditor` al cerrar tareas de codigo.
4. Tareas de codigo: `npm run build` OK → commit → push (regla `git-deploy.md`).

NO preguntar si Fak quiere que lo hagas. HACERLO.

## Como interactuar con Fak

- Fak escribe en espanol informal con typos. Entender sin corregir.
- Fak NO es programador. Explicar decisiones tecnicas en lenguaje simple.
- NUNCA preguntar "queres que haga X?" — HACERLO y reportar. Si estas por escribir
  "queres que...?" o "lo hago?": PARA, la respuesta es siempre SI.
- Si Fak dice "decidi vos": decidir con mejor practica y explicar brevemente por que.
  NO devolverle la pregunta.
- Si Fak te corrige: registrarlo en LECCIONES_APRENDIDAS inmediatamente.
- Si detectas un problema o inconsistencia: reportar sin esperar a que pregunte.
- Si un cambio afecta multiples productos: sugerir aplicarlo/verificarlos todos.
- Ante duda de datos: TBD y avisar. NUNCA inventar (regla `core-prohibiciones.md`).
- Contrato de autonomia (que hago solo vs que requiere OK): `.claude/rules/autonomy-contract.md`.

## Reglas criticas — NO ROMPER

1. **Nada de datos mock/placeholder**: todo dato mostrado/exportado/testeado viene de
   Supabase real, via los mismos hooks/repositories que usa la UI.
2. **Cero duplicados en Supabase**: query antes de insertar. Las familias canonicas de
   producto son 8; si un seed crea mas, abortar y reportar. Cliente = "VWA"/"PWA".
3. **Export Excel**: AMFE y CP solo `xlsx-js-style`; HO (legacy) solo `ExcelJS`.
   Export AMFE oficial via node (skill `amfe-export-oficial`), no desde la app.
4. **Reusar antes de crear**: los exports individuales, hooks y repositorios ya
   funcionan — llamarlos, no reimplementar.
5. **Verificacion obligatoria**: tras seed/migracion contar familias (8) y duplicados (0);
   tras export abrir el archivo; `npx tsc --noEmit` y tests del modulo afectado.
6. Documentos APQP son "documentos vivos" (IATF): cambios diarios van al audit trail;
   revisiones mayores (A/B/C) solo en hitos oficiales (prelanzamiento/PPAP/ECN).

## Reglas contextuales (.claude/rules/) — carga automatica

| Siempre cargadas | Contenido |
|---|---|
| `core-prohibiciones.md` | No inventar, CC/SC solo Fak, TBD, Supabase live, espanol AR |
| `no-pfd-no-ho.md` | PFD/HO no se hacen aca |
| `autonomy-contract.md` | Matriz de autonomia |
| `git-deploy.md` | Build + commit + push al cerrar tareas |

| Con `paths:` (cargan al tocar) | Ambito |
|---|---|
| `amfe.md` | modules/amfe, core/amfe, scripts *.mjs, utils/seed — regla APQP consolidada |
| `control-plan.md` | modules/controlPlan |
| `database.md` + `verify-supabase-live.md` | repositorios, scripts, persistencia |
| `exports.md` | archivos *export* |
| `testing.md` | __tests__ |
| `dev-login.md` | components/auth — boton dev-login: NO TOCAR NUNCA |

**Skills** (on-demand): `apqp-schema` (schema JSONB Supabase), `product-map` (8 familias,
part numbers, equipo APQP), `amfe-domain` (conocimiento AMFE profundo), `amfe-cookbook`
(recetas de gaps), `injection-process` (inyeccion plastica/PU, maestros 15/16/17),
`supabase-safety` (protocolo backup/dry-run/restore), `amfe-export-oficial`,
`notebooklm-routing` (que notebook consultar), `notebooklm-manager`, `rule-enforcement-gate`
(toda regla nueva con check debe nacer con enforcement), `audit-amfe`, `backup`, `fix-amfe-gaps`.

## Stack y comandos

React 19.2 + TypeScript 5.8 + Vite 6 · Supabase (auth+DB) · Vitest 4 + testing-library ·
TailwindCSS 3.4 · xlsx-js-style / ExcelJS / html2pdf.js · Recharts · @dnd-kit.

```bash
npm run dev          # Vite dev server (localhost:3000)
npx vitest run       # tests (durante desarrollo: --testPathPattern=<modulo>)
npm run build        # build de produccion — OBLIGATORIO antes de push
npx tsc --noEmit     # chequeo de tipos
node scripts/_auditAll.mjs --summary   # salud de los AMFEs en Supabase
```

## Estructura del proyecto (codigo en la RAIZ, no en src/)

```
App.tsx / AppRouter.tsx     Entry + routing lazy
types.ts, types/            Barrel de tipos por dominio
components/                 auth, ui, modals, layout, charts, navigation, landing
core/                       balancing/ (SALBP, COMSOAL...), inheritance/ (maestro→variante), amfe/
hooks/                      useLineBalancing, useProjectPersistence, ...
modules/                    amfe/ (+ controlPlan tab), controlPlan/, family/, balancing/,
                            dashboard/, registry/, mix/, flow-simulator/, eightD/, flowchart/
utils/repositories/         17 repositorios tipados — UNICO acceso a datos
scripts/                    _backup, _restore, _auditAll, _autoHeal, _lib/ (+ archive/ de one-shots)
__tests__/                  suite Vitest completa
docs/                       guias APQP + LECCIONES_APRENDIDAS + _archive/
```

- Path alias `@/*` → raiz. Modulos lazy con `React.lazy()` + `Suspense`.
- NO hardcodear API keys (`VITE_*`). `logger.ts` en vez de console.log. NO `as any` ni `@ts-ignore`.
- Familias de producto (herencia maestro→variante): tablas `product_families`,
  `family_documents`, `family_change_proposals`; motor en `core/inheritance/`.
  Detalle de schema: skill `apqp-schema`.

## Calidad

- Nivel senior: leer el codigo completo antes de editar; verificar antes de afirmar.
- Subagentes tienen ~40-50% falsos positivos en audits — verificar manualmente antes de aplicar.
- En deep audits autonomos: clasificar TRUE BUG > ROBUSTNESS > FALSE POSITIVE; ante la duda NO aplicar el fix; correr tests tras cada batch.

## Auth y deploy

- Dev: boton "Acceso rapido (dev)" (borde naranja) con `VITE_AUTO_LOGIN_EMAIL/PASSWORD` — protegido por regla `dev-login.md`.
- Produccion: https://facussc24.github.io/tiempos-y-balanceos/ — deploy manual `npm run build && npx gh-pages -d dist` (repo publico facussc24/tiempos-y-balanceos).

## NotebookLM

Base de conocimiento Barack (8 notebooks: APQP, SGC, auditorias, 8D, informes tecnicos,
specs de cliente, operaciones de planta, Claude Code). Antes de consultar: skill
`notebooklm-routing` (que notebook, como preguntar, limite 50 queries/dia).
