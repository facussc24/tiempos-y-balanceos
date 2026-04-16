---
name: Git Sync 2 PCs Obligatorio
description: SIEMPRE git pull al inicio de sesion — Fak trabaja desde 2 PCs simultaneamente
type: feedback
---

SIEMPRE sincronizar git al inicio de cada sesion antes de tocar cualquier archivo.

**Why:** Fak trabaja desde 2 PCs en simultaneo (a partir de 2026-04-16). Sin sync, los cambios de una PC pisan los de la otra, generando conflictos y perdida de trabajo.

**How to apply:** Al arrancar cada sesion:
1. `git fetch origin && git status` en BarackMercosul
2. Si hay cambios remotos: `git pull origin main`
3. Si hay cambios locales sin commit: `git stash` → pull → `git stash pop`
4. Si hay conflictos: REPORTAR a Fak, NO resolver solo
5. NUNCA empezar a editar archivos sin haber verificado el sync
