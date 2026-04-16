---
name: Verificar completitud 6M al importar AMFEs
description: Al importar/cargar un AMFE desde Excel, verificar que cada operación tenga múltiples WEs (6M). No asumir que datos importados están completos.
type: feedback
---

NUNCA asumir que un AMFE importado desde Excel tiene estructura 6M completa.

**Why:** El IP PAD fue importado con 1 solo WE por operación (Mano de Obra). Le faltaban Machine, Material, Method, Measurement. Esto causó columnas vacías en el export y una estructura VDA incompleta. Se perdieron horas detectando y corrigiendo.

**How to apply:**
- Al cargar un AMFE nuevo: verificar que cada OP tenga mínimo 2-3 WEs de diferentes tipos 6M
- Si solo hay 1 WE por OP: reportar inmediatamente como incompleto
- Usar el flujograma como fuente de datos para máquinas y materiales por operación
- Los tipos 6M relevantes por tipo de operación:
  - Recepción: Material, Method, Measurement, Man
  - Inyección: Machine, Material, Method, Man
  - Corte/Costura: Machine, Material, Method
  - Control calidad: Method, Measurement
  - Embalaje: Material, Method
- Script de referencia: `scripts/fixIpPad6M.mjs`
