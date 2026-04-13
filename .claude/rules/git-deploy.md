# Regla: Git Commit + Push + Build Verification — OBLIGATORIO

## Protocolo de deploy (CADA VEZ que se termina una tarea de codigo)

Despues de CADA tarea completada que modifique codigo:

1. **`npm run build`** — verificar que el build pasa LOCALMENTE antes de commitear
2. **`git add` + `git commit`** — commitear TODOS los archivos modificados/creados
3. **`git push origin main`** — pushear a GitHub
4. **Verificar CI** — `gh run list --limit 1` para confirmar que el workflow pase

## Checklist pre-commit

Antes de cada commit, verificar:
- [ ] Todas las dependencias importadas estan en package.json (`npm install <pkg>` si falta alguna)
- [ ] `npm run build` pasa sin errores
- [ ] Todos los archivos nuevos estan incluidos en `git add`
- [ ] No hay archivos sensibles (.env, credenciales) en el staging

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
