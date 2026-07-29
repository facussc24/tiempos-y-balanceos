---
name: Git Sync al inicio de sesion
description: Fak trabaja desde UNA sola PC (FACU-PC) desde 2026-07-29 — la notebook vieja se rompio. El pull de arranque dejo de ser critico; el push al cerrar sigue siendo obligatorio.
type: feedback
---

**ACTUALIZADO 2026-07-29 — ya NO son 2 PCs.** Fak dixit: la otra notebook "ya no existe, la
rompi toda". Queda solo **`FACU-PC`** (usuario `facun`), con el unico clon en `C:\Dev\BarackMercosul`.

**Que cambia:** el `git pull` de arranque dejo de ser critico — no hay otra maquina que pueda
haber pusheado mientras tanto. No hace falta advertirle a Fak sobre sincronizar otra PC, ni
dejarle comandos para correr "en la otra maquina".

**Que NO cambia:** el `git push` al cerrar tareas de codigo sigue siendo **obligatorio**, pero por
otro motivo — Fak prueba en **GitHub Pages (produccion)** y el deploy corre en el push a `main`.
Sin push, prueba una version vieja. Ver regla `git-deploy.md`.

**Historico (por que existia esta memoria):** entre 2026-04-16 y 2026-07-29 Fak trabajaba desde
2 PCs en simultaneo y los cambios de una pisaban los de la otra. Ese riesgo ya no aplica.
