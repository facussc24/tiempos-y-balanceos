---
description: Protección del botón de dev-login en LoginPage
paths:
  - "components/auth/**"
---

# Regla: Botón de Dev-Login — NO TOCAR NUNCA

El componente de login tiene un botón "Acceso rápido (dev)" con borde naranja.
Este botón es CRÍTICO para verificación visual del proyecto.

## Reglas absolutas:
- NUNCA eliminar este botón
- NUNCA mover su lógica a otro archivo
- NUNCA cambiar su comportamiento
- NUNCA remover las variables VITE_AUTO_LOGIN_EMAIL / VITE_AUTO_LOGIN_PASSWORD
  **de `.env.local`** (desarrollo). En CI/producción ver la excepción de abajo.
- Si refactorizás LoginPage o el sistema de auth, el botón DEBE sobrevivir intacto
- Si hacés una auditoría de código, este botón NO es código muerto — es infraestructura de desarrollo

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
