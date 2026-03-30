---
description: Protección del botón de dev-login en LoginPage
globs:
  - components/auth/LoginPage.tsx
  - components/auth/**
---

# Regla: Botón de Dev-Login — NO TOCAR NUNCA

El componente de login tiene un botón "Acceso rápido (dev)" con borde naranja.
Este botón es CRÍTICO para verificación visual del proyecto.

## Reglas absolutas:
- NUNCA eliminar este botón
- NUNCA mover su lógica a otro archivo
- NUNCA cambiar su comportamiento
- NUNCA remover las variables de entorno VITE_AUTO_LOGIN_EMAIL / VITE_AUTO_LOGIN_PASSWORD
- Si refactorizás LoginPage o el sistema de auth, el botón DEBE sobrevivir intacto
- Si hacés una auditoría de código, este botón NO es código muerto — es infraestructura de desarrollo

## Cómo funciona:
- Lee credenciales de `import.meta.env.VITE_AUTO_LOGIN_EMAIL` y `import.meta.env.VITE_AUTO_LOGIN_PASSWORD`
- Si las variables existen, muestra el botón naranja
- Al click, completa credenciales y ejecuta login
- En producción aparece solo si `.env.production` tiene las variables configuradas
