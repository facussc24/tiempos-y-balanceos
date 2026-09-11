# Regla: build + commit + push al cerrar una tarea de codigo

## Protocolo de deploy (cada vez que se termina una tarea de codigo)

1. **`npm run build`** — el build de produccion pasa LOCALMENTE antes de commitear. `npx tsc --noEmit`
   no alcanza: verifica tipos, no que las dependencias existan ni que rollup resuelva las imports
   (3 deploys rotos por un paquete sin instalar: memoria `incidente_deploy_html_to_image_2026-04-13`).
   Si el build falla, no se pushea: se arregla primero.
2. **`git add` + `git commit`** — todos los archivos modificados/creados, por nombre (no `git add .`
   ni `-A`: suele haber otra sesion con archivos sin commitear en el mismo repo).
3. **`git push origin main`**.
4. **Verificar CI** — `gh` no tiene login en esta PC (memoria `gh_cli_sin_login_ci_por_api`); el
   ultimo run se lee por API y se mira `status` / `conclusion`:
   ```bash
   curl -s "https://api.github.com/repos/facussc24/tiempos-y-balanceos/actions/runs?per_page=1"
   ```

**Por que:** Fak prueba en GitHub Pages (produccion, no dev server), y el deploy corre en el push a
`main`: sin push, prueba una version vieja.

## Antes de decir "listo"

- `npm run build` pasa (paso 1). Si rompe, arreglarlo antes de cerrar: no pasarselo a Fak para que pruebe.
- `git diff --stat`: solo cambiaron archivos del scope.
- Tarea visual (PDF export, UI): probarla local con preview/browser antes del push, para que Fak no
  descubra el bug en produccion.
- Tarea que toca Supabase/datos: releer el modelo/schema real; no inventar nombres de tablas/columnas.
- Entregable archivo (xlsx/pdf/pptx): abrirlo y mirarlo antes de entregar (`consumos-entregables.md` §3;
  lo frena el hook Stop `cierre-guard.sh`, chequeo 4).

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

⚠️ Limite conocido de ese gate: CHECK-2 mira **nombres de archivo** y CHECK-3 busca por contenido
solo los secretos de planta que tiene listados (contraseñas de HMI y similares). Ninguno detecta
datos de empresa dentro de un archivo legitimo — y eso es justo lo que Fak permitio.

Si un subagente reporta "hay datos de empresa en el repo": **no es un hallazgo**, es la
politica vigente. Contexto completo en la memoria `repo_publico_no_datos_empresa`.
