---
description: Protección del botón de dev-login en LoginPage
paths:
  - "components/auth/**"
---

# El botón de dev-login no se toca

`components/auth/LoginPage.tsx` tiene un botón "Acceso rápido (dev)" con borde naranja. **Ya se
borró tres veces en auditorías de código**, siempre por la misma razón: parece código muerto y no
lo es — es como se verifica visualmente la app sin tipear credenciales en cada arranque.

El botón, su lógica, su comportamiento y las variables `VITE_AUTO_LOGIN_EMAIL` /
`VITE_AUTO_LOGIN_PASSWORD` **de `.env.local`** se quedan como están, también al refactorizar
LoginPage o el sistema de auth. En CI/producción, ver la excepción de abajo.

## Cómo funciona:
- Lee credenciales de `import.meta.env.VITE_AUTO_LOGIN_EMAIL` y `import.meta.env.VITE_AUTO_LOGIN_PASSWORD`
- Si las variables existen, muestra el botón naranja
- Al click, completa credenciales y ejecuta login

## EXCEPCIÓN DE PRODUCCIÓN — decisión delegada por Fak, 2026-07-30

El botón es **solo de desarrollo**. Las dos variables NO van al build de producción.

**Por qué:** Vite inlinea todo `import.meta.env.VITE_*` como literal dentro del bundle,
y el bundle se publica en GitHub Pages, que es público. Verificado bajando
`assets/index-C8NUY4aA.js`: el email y la contraseña de la cuenta de Supabase estaban
escritos en texto plano y pasados a la función de login. Cualquiera podía entrar a la
base de calidad.

**Consecuencia aceptada:** en producción el botón naranja NO aparece (la condición de
`LoginPage.tsx:127` queda falsa sin las variables). Fak entra con email y contraseña
normales, que su navegador tiene guardados. En local no cambia nada.

**Lo que sigue prohibido:** editar el botón o su lógica en `components/auth/LoginPage.tsx`
—el fix se hizo enteramente en `.github/workflows/deploy.yml`— y volver a agregar
`VITE_AUTO_LOGIN_EMAIL` / `VITE_AUTO_LOGIN_PASSWORD` al `env:` de cualquier workflow.

**ENFORCEMENT:** `scripts/_gateRepoPublico.mjs` CHECK-1, job `repo-publico` de
`deploy.yml`, bloqueante y sin secretos. `--selftest` lo prueba roto a sí mismo.
