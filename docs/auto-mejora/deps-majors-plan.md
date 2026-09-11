# Plan de saltos MAYORES de dependencias (escrito 11/09/2026, no ejecutado)

Estado al 11/09/2026 (despues del commit de menores de la Ola C6): `npm outdated` deja estos saltos
de version mayor. Ninguno se hace "de paso": cada uno tiene breaking changes declarados y se hace
**uno por sesion, en rama, con la suite completa** (`npm run build` + `npx vitest run` +
`npx tsc --noEmit`, y una pasada visual de la app en `npm run dev` para los que tocan render).

Regla del repo que aplica: `git-deploy.md` (build local antes de push) y `autonomy-contract.md` C
("cambiar dependencias: confirmar antes") — cada salto se le anuncia a Fak en una linea antes de
tocarlo, y si algo no cierra se vuelve con `git checkout package.json package-lock.json && npm ci`.

## Bug conocido de npm en esta PC

`npm update` y `npm install vitest@4.1` fallan con `Cannot read properties of null (reading
'edgesOut')` (arborist `#loadPeerSet`, npm 10 / node 22.20). Salida: instalar por grupos chicos, y
para vitest `--legacy-peer-deps`. **Con `--legacy-peer-deps` npm NO instala peers**: recharts pide
`react-is` como peer y quedo afuera del arbol (el build rompio con "Rollup failed to resolve import
react-is"). Por eso `react-is` esta declarado explicito en `package.json` desde el 11/09. Cualquier
salto mayor que use `--legacy-peer-deps` tiene que terminar con `npm run build` verde y `npm ls`
sin `missing`.

## Orden propuesto (del mas seguro al que mas toca)

| # | Salto | Actual → latest | Por que en este orden | Que mirar |
|---|---|---|---|---|
| 1 | **Vitest 5** + `@vitest/coverage-v8` 5 | 4.1.11 → 5.0.0 | Solo tests; si rompe, no toca la app. Vitest 5 pide Vite 7+ (verificar en su changelog antes: si es asi, va DESPUES del #2) | `vitest.config.ts` (`pool: 'threads'`, memoria `vitest_forks_roto_notebook`), `environment: jsdom`, los 277 archivos de test |
| 2 | **Vite 8** + `@vitejs/plugin-react` 6 + `esbuild` 0.28 | 6.4.3 → 8.3.0 / 5.2.0 → 6.1.1 | Motor de build y dev server. Vite 7 ya subio el Node minimo (20.19+/22.12+: esta PC tiene 22.20, OK) y cambio `build.target` default; Vite 8 trae Rolldown en vez de Rollup: `build.rollupOptions.output.manualChunks` y `chunkSizeWarningLimit` de `vite.config.ts` pueden cambiar de nombre | `vite.config.ts`, el `base` de GitHub Pages, el `deploy.yml`, tamaño y nombres de chunks en `dist/`, `npm run dev` con dev-login |
| 3 | **ESLint 10** + `@eslint/js` 10 + `globals` 17 + `eslint-plugin-react-refresh` 0.5 (+ `typescript-eslint` cuando saque soporte de ESLint 10) | 9.39.5 → 10.10.0 | Solo lint; ESLint 10 saca reglas deprecadas y cambia defaults de flat config | `eslint.config.js`, `npx eslint .` en cero antes y despues (comparar conteo de avisos) |
| 4 | **jsdom 29**, **uuid 14**, **lucide-react 1.x**, **html2pdf.js 0.14** | 27.4 → 29.1 / 13 → 14 / 0.554 → 1.45 / 0.10.3 → 0.14 | Chicos e independientes; uno por commit. lucide 1.x renombro iconos: grep de cada icono importado contra la lista nueva. html2pdf 0.14 cambia opciones de `html2canvas`/`jsPDF`: probar el export PDF que usa Fak (AMFE/CP) abriendo el archivo | imports de `lucide-react` en `components/` y `modules/`, `utils/pdf*` |
| 5 | **Tailwind 4** | 3.4.19 → 4.3.3 | Cambia la configuracion entera (`tailwind.config.js` → CSS `@theme`, `postcss` → `@tailwindcss/vite`), y el `tailwind.css` pre-compilado de `tools/flowchart/` (skill `flujogramas` §3) es un consumidor aparte que NO se toca en el mismo salto | `tailwind.config.js`, `postcss.config.js`, `index.css`, clases con `!important`/`@apply`; pasada visual de cada modulo |
| 6 | **TypeScript 7** | 5.8.3 → 7.0.2 | El compilador nuevo (Go): mas rapido pero con reglas mas estrictas por default y cambios en `tsconfig` (`module`, `moduleResolution`); `typescript-eslint` tiene que soportarlo primero | `tsconfig.json`, `npx tsc --noEmit` en cero, y que `typescript-eslint` no se caiga |

Lo que NO se sube: `react`/`react-dom` (ya en 19.3, sin mayor pendiente), `@supabase/supabase-js`
(2.116, sin mayor), `xlsx-js-style`/`exceljs` (reglas del repo: AMFE y CP solo `xlsx-js-style`, HO
solo `ExcelJS`; sin mayor pendiente).

## Checklist por salto

1. Rama `deps/<paquete>-<mayor>`; leer el changelog/migration guide del paquete (no de memoria).
2. `npm install <pkg>@<version>` (por grupos chicos si npm falla) → `npm ls` sin `missing`.
3. `npm run build` → `npx tsc --noEmit` → `npx vitest run` (los 4200) → `npm run dev` y mirar lo
   que ese paquete toca.
4. Commit de `package.json` + `package-lock.json` + los archivos de config que cambiaron, por ruta.
5. Push y CI verde (leido por API: `git-deploy.md` paso 4).
