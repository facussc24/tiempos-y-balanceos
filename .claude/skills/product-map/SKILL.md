---
name: product-map
description: Mapa completo de productos Barack Mercosul — familias (13 al 22/09/2026), part numbers, variantes, documentos por familia. Equipo APQP con nombres y roles. Roles validos para controles CP/HO. Usar cuando se trabaja con familias de producto, part numbers, cross-document, headers APQP, o asignacion de responsables.
user-invocable: false
---

# Productos — Mapa Completo

En Supabase (`product_families`, leido el 22/09/2026) hay **13 familias**: las 10 de producto de
las tablas de abajo y 3 **maestros de proceso** sin productos (15 Inyeccion Plastica, 16 Logistica
y Recepcion, 19 Inyeccion PUR in place). Antes de afirmar un conteo, leerlo live.

## VWA — Proyecto PATAGONIA

| Familia | Part Number | Docs | Master | Variantes |
|---------|------------|------|--------|-----------|
| Insert Patagonia | N 227 a N 403 | 4+3 | AMFE+CP+HO+PFD | [L0]: AMFE+CP+PFD (sin HO) |
| Armrest Door Panel | N 231 | 4 | AMFE+CP+HO+PFD | — |
| Top Roll | N 216 / N 256 / N 285 / N 315 | 4 | AMFE+CP+HO+PFD | — |
| Headrest Front | 2HC881901 RL1 | 4+9 | AMFE+CP+HO+PFD | [L1][L2][L3]: AMFE+CP+HO (sin PFD) |
| Headrest Rear Center | 2HC885900 RL1 | 4+9 | AMFE+CP+HO+PFD | [L1][L2][L3]: AMFE+CP+HO (sin PFD) |
| Headrest Rear Outer | 2HC885901 RL1 | 4+9 | AMFE+CP+HO+PFD | [L1][L2][L3]: AMFE+CP+HO (sin PFD) |
| IP PAD - Tapizado (familia 17) | 2HC.858.417.B FAM · .C GKK · .C GKN | ver Supabase | — | PL1 low / PL2-PL3 high |
| Armrest Rear Center (familia 18) | 2HC.885.081 RL1 | ver Supabase | — | — |

## PWA — Proyecto HILUX

| Familia | Part Number | Proyecto | Docs |
|---------|------------|----------|------|
| Telas Planas | 21-9463 | HILUX 581D | AMFE+CP+HO+PFD |
| Telas Termoformadas | 21-9640 | HILUX 582D | AMFE+CP+HO+PFD |

## Equipo APQP (datos correctos para headers)
- **Carlos Baptista** — Ingeniería (responsibleEngineer, approvedBy)
- **Manuel Meszaros** — Calidad
- **Facundo Santoro** — Realizador (preparedBy)
- **Marianna Vera** — Producción
- **Gonzalo Cal** — G.Cal (HO)
- **Cristina Rabago** — Seguridad e Higiene
- Core team CP: "Carlos Baptista (Ingeniería), Manuel Meszaros (Calidad), Marianna Vera (Producción)"

## Roles válidos para controles (CP reactionPlanOwner / HO qcItem.responsible)
- "Operador de producción" — autocontrol en estación
- "Líder de Producción" — verificaciones, liberación arranque
- "Inspector de Calidad" — controles especiales, recepción MP
- "Recepción de materiales" — inspección de entrada
- "Metrología" — mediciones con instrumentos calibrados
- "Laboratorio" — ensayos funcionales/materiales
- "Supervisor de Producción" — verificaciones periódicas
