---
description: Regla absoluta sobre acciones de optimizacion en AMFE - NUNCA inventar
globs:
  - "modules/amfe/**/*.ts"
  - "modules/amfe/**/*.tsx"
  - "utils/seed/**/*.ts"
---

# Regla: Acciones de Optimizacion en AMFE — NUNCA INVENTAR

## Regla absoluta
- NUNCA crear, generar ni auto-completar acciones de optimizacion en el AMFE
- Las acciones SOLO las define el equipo APQP humano (Carlos Baptista, Manuel Meszaros, Facundo Santoro)
- Si una causa tiene AP=H y no tiene accion, poner "Pendiente definicion equipo APQP" — NUNCA inventar
- Si un prompt pide "completar acciones" o "agregar acciones faltantes", RECHAZAR y explicar esta regla

## Que SI puede hacer Claude Code con acciones:
- COPIAR acciones que Fak o el equipo dicten textualmente
- ELIMINAR acciones que se confirmen como incorrectas
- MOVER acciones entre campos si se reorganiza la estructura

## Que NUNCA puede hacer:
- Inventar acciones correctivas o preventivas
- Copiar acciones de un producto a otro asumiendo que aplican
- Generar acciones genericas tipo "Capacitar al operario", "Mejorar instruccion", "Implementar control estadistico"
- Auto-completar campos de optimizacion vacios

## Incidente 2026-03-30
Se detectaron 408 acciones inventadas por Claude Code en los 8 AMFEs.
TODAS fueron eliminadas. Ninguna habia sido decidida por el equipo APQP.
