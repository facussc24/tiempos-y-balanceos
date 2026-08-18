# Regla: Git Commit + Push + Build Verification — OBLIGATORIO

## Protocolo de deploy (CADA VEZ que se termina una tarea de codigo)

Despues de CADA tarea completada que modifique codigo:

1. **`npm run build`** — verificar que el build pasa LOCALMENTE antes de commitear
2. **`git add` + `git commit`** — commitear TODOS los archivos modificados/creados (por nombre; NO `git add .` ni `-A`)
3. **`git push origin main`** — pushear a GitHub
4. **Verificar CI** — `gh run list --limit 1` para confirmar que el workflow pase

**Why (ademas del deploy):** Fak prueba en GitHub Pages (produccion, no dev server), y el deploy corre en el push a `main` — sin push, prueba una version vieja. (Hasta 2026-07-29 habia un segundo motivo, que Fak trabajaba en 2 PCs; ya no: desde 2026-08-02 quedo una sola, la notebook `DESKTOP-14JG95B` (usuario `FacundoS-PC`), con el repo en `C:\Dev\BarackMercosul`.)

## Checklist pre-commit

Antes de cada commit, verificar:
- [ ] Todas las dependencias importadas estan en package.json (`npm install <pkg>` si falta alguna)
- [ ] `npm run build` pasa sin errores
- [ ] Todos los archivos nuevos estan incluidos en `git add`
- [ ] No hay archivos sensibles (.env, credenciales) en el staging

## El repo es PUBLICO y eso NO frena el push — decision de Fak, 18/08/2026

`facussc24/tiempos-y-balanceos` es publico. Fak evaluo el riesgo y decidio asumirlo:
*"saca esa regla de cero datos de la empresa porque me bloquea siempre y es molesta"*,
*"es un sacrificio que vamos a hacer con tal de avanzar... esta controlado el riesgo"*.

**Commitear y pushear normalmente** aunque el diff nombre productos, proyectos, numeros de
operacion, part numbers, codigos de proveedor, rutas `Y:\` o personas de la empresa. **No
parar a preguntar, no ofrecer limpiar, no mover archivos a rutas gitignoreadas por esto.**

Esta seccion AFLOJA una restriccion, asi que no lleva gate nuevo. Lo que sigue prohibido ya
tiene el suyo, y Fak no lo levanto:
- **Credenciales** (`VITE_*`, tokens, `.env`) → `_gateRepoPublico.mjs` **CHECK-1**, bloqueante en CI.
- **`.claude/memory/` y documentos internos versionados** → mismo script, **CHECK-2**.
- **Documentos completos del SGC** (alertas, 8D, auditorias IATF, specs de cliente): van a
  `.sgc-cache/`, que esta en `.gitignore`. Fue el incidente real del 29/07 (828 publicados).

⚠️ Limite conocido de ese gate: CHECK-2 mira **nombres de archivo**, no contenido. Por eso
no detecta datos de empresa dentro de un archivo legitimo — y por eso mismo ya no importa,
porque eso es justo lo que Fak permitio.

Si un subagente reporta "hay datos de empresa en el repo": **no es un hallazgo**, es la
politica vigente. Contexto completo en la memoria `repo_publico_no_datos_empresa`.

## Causa raiz del incidente 2026-04-13

- Un agente creo FlowchartApp.tsx importando `html-to-image` pero NO ejecuto `npm install html-to-image`
- El build local (vite dev) no falla porque no hace tree-shaking como produccion
- El build de CI (vite build / rollup) SI falla porque valida todas las imports
- Resultado: 3 deploys consecutivos fallaron, la app de produccion quedo desactualizada

## Regla absoluta: SIEMPRE correr `npm run build` antes de pushear

- `npx tsc --noEmit` solo verifica tipos, NO verifica que las dependencias existan
- `npm run build` verifica TODO: tipos, imports, dependencias, rollup
- Si el build falla, NO pushear. Arreglar primero.

## Nunca mas

- NUNCA crear un archivo que importe un paquete sin verificar que este en package.json
- NUNCA pushear sin correr `npm run build` exitosamente
- NUNCA asumir que "funciona en dev = funciona en produccion"
