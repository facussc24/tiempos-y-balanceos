---
name: Usar skills proactivamente
description: Usar baseline-ui y otras skills disponibles automaticamente al crear UI, no esperar a que Fak lo pida
type: feedback
---

Cuando creo componentes UI, USAR las skills disponibles automaticamente:
- `baseline-ui` despues de crear UI para verificar calidad
- `simplify` despues de terminar codigo para review
- Cualquier otra skill relevante al contexto

**Why:** Fak espera que use todas las herramientas disponibles sin que tenga que pedirlas. Si tengo skills instaladas, usarlas. No preguntar "queres que use X?" — usarla.

**How to apply:** Al terminar de crear componentes UI, invocar `baseline-ui`. Al terminar codigo largo, invocar `simplify`. Hacerlo AUTOMATICAMENTE.
