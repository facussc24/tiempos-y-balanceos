# Barack Mercosul - Tiempos y Balanceos

App web React 19 + TypeScript + Supabase para gestion de calidad automotriz
(**AMFE VDA + Plan de Control AIAG**) y lean manufacturing (balanceo de linea,
simulador de flujo, mix multi-modelo, calculadora de medios). Auth Supabase, pero
**la usa un solo usuario (Fak)** — no hay edicion concurrente, asi que nada que
dependa de locks entre usuarios es critico (aclarado por Fak el 2026-08-07; antes
esto decia "multi-usuario" y me hizo sobredimensionar un bug).
PFDs y Hojas de Operaciones NO se hacen aca (regla `no-pfd-no-ho.md`);
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
5. **Tarea de Barack terminada: el entregable a su carpeta por tipo de la biblioteca de
   Ingenieria y la carpeta de la tarea ARCHIVADA** (`node scripts/_escritorio.mjs --archivar`,
   regla `escritorio-tareas.md`). **En el Escritorio no queda nada mio**: ni el entregable, ni
   notas, ni archivos sueltos. "Te lo deje en el Escritorio" NO es entregar.

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
| `techo-agentes.md` | **Maximo 5 subagentes. `Workflow` deshabilitado.** Enforced por hook + settings |
| `no-pfd-no-ho.md` | PFD/HO no se hacen aca |
| `autonomy-contract.md` | Matriz de autonomia |
| `git-deploy.md` | Build + commit + push al cerrar tareas |
| `consumos-entregables.md` | Tablas de consumo / cargas arb: validador + checklist canonico |
| `verify-before-close.md` | Verificar build/diff/archivo generado antes de decir "listo" |

| Con `paths:` (cargan al tocar) | Ambito |
|---|---|
| `amfe.md` | modules/amfe, core/amfe, scripts *.mjs, utils/seed — regla APQP consolidada |
| `control-plan.md` | modules/controlPlan |
| `database.md` + `verify-supabase-live.md` | repositorios, scripts, persistencia |
| `exports.md` | archivos *export* |
| `testing.md` | __tests__ |
| `dev-login.md` | components/auth — boton dev-login: NO TOCAR NUNCA |
| `cad-3d.md` | archivos .step/.stl/.glb, `.venv-cad`, skill cad-design — 2 gates 3D |
| `dxf-entregable.md` | `*.dxf` / `*.plt` — **el juez de un DXF es AutoCAD, no ezdxf** (`scripts/_validarDxf.py`); y si la ruta pasa 259 caracteres el doble click de Windows no abre |
| `escritorio-tareas.md` | `_escritorio.mjs` + su hook — cola de tareas: cuándo se cierra y cómo se archiva (el hook la recuerda al tocar el Escritorio) |
| `lecciones-consolidacion.md` | `docs/LECCIONES_APRENDIDAS.md` — ciclo de vida de una lección: cómo entra, cómo se gradúa y la pasada de consolidación al llegar al aviso de 26 KB |

**Skills** (on-demand): `apqp-schema` (schema JSONB Supabase), `product-map` (8 familias,
part numbers, equipo APQP), `amfe-domain` (conocimiento AMFE profundo), `amfe-cookbook`
(recetas de gaps), `injection-process` (inyeccion plastica/PU, maestros 15/16/17),
`supabase-safety` (protocolo backup/dry-run/restore), `amfe-export-oficial`,
`verificacion-consumos` (checklist + validador de tablas de consumo/arb),
`carga-arb` (ciclo completo de un cambio de BOM en el arb: tabla de carga → validacion contra
el export post-carga → PDF de difusion formato Leo con `scripts/_pdfBomArb.py` → cuerpo del mail),
`docs-empresa` (mapa tema→documento real + caché `.sgc-cache/`),
`leer-planos` (sacar peso calculado / cantidad / material / norma de la lista de materiales
embebida en un plano de cliente, con `scripts/_leerPlano.py`), `rule-enforcement-gate`
(toda regla nueva con check debe nacer con enforcement), `audit-amfe`, `auditoria-cliente`
(auditar un lote contra la NORMA con rol de auditor de cliente ANTES de entregar — deja el
marcador `.audit-cliente/` que exige el export oficial; regla amfe.md §18), `backup`, `fix-amfe-gaps`,
`cad-design` (diseño/modificación 3D-CAD: librería `cadlib` + CLIs con --help para medir STEP,
registrar ICP, verificar colisión y entregar; UN intérprete: `.venv-cad` Py3.12; los 2 GATES
pre-modelado/pre-entrega — hook `cad-guard.sh` los recuerda 1×/h; enforcement duro:
`export_deliverables.py` no entrega sin evidencia en manifest.json),
`autocad-verificar` (correr AutoCAD 2026 headless con `accoreconsole` para auditar/normalizar un
DXF antes de entregarlo — el juez es AutoCAD, no ezdxf; enforcement duro: `entregar_dxf()` en
`scripts/_validarDxf.py` no copia al destino si AutoCAD no lo abrio limpio).

**Arquitectura de roles (decision Fak 2026-08-09):** los skills SON el sistema de
roles — cargan solo al usarse. NO crear agentes-rol por dominio ni proyectos
separados (multi-agente ≈ 15x tokens); subagentes solo para trabajo batch/paralelo,
techo 5. `docs/LECCIONES_APRENDIDAS.md`: gate en el hook (aviso 26 KB, tope 28 KB
con corte en linea completa); al aviso se CONSOLIDA — fusionar lecciones del mismo
patron y graduar a regla/memoria/archivo (regla `lecciones-consolidacion.md`) — nunca comprimir
a fragmentos ni pelear bytes.

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
scripts/                    _backup, _restore, _auditAll, _readiness, _lib/ (+ archive/ de one-shots)
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

## Documentos de la empresa

NotebookLM fue RETIRADO (decision Fak 2026-07-23). El conocimiento se consulta DIRECTO
de las fuentes reales (servidor Y:, OneDrive 4-MANUALES, docs/ del repo, docs-local/) y
del cache local `.sgc-cache/` (gitignoreado, extractos con fuente+fecha). Routing y
protocolo de refresh: skill `docs-empresa`. El original SIEMPRE le gana al cache.
