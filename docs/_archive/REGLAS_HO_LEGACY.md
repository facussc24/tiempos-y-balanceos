---
description: Reglas del modulo Hoja de Operaciones
globs:
  - "modules/hojaOperaciones/**/*.ts"
  - "modules/hojaOperaciones/**/*.tsx"
---

# Hoja de Operaciones (HO)

## UI
- Navy theme (reemplazo de amber en todas las vistas)
- ISO safety pictograms: 6 PPE icons en `src/assets/ppe/`
- 3-row header: logo Barack, form number I-IN-002.4-R01
- Metadata en header (Realizo/Aprobo/Fecha/Rev)
- Hazards eliminados de UI y PDF (la empresa no los usa)

## Datos
- `HoSheet`, `HoStep`, `HoVisualAid`, `HoPpe` en hojaOperacionesTypes.ts
- Step numbers y visual aid orders pueden tener NaN si hay data corrupta
- Usar `.filter(Number.isFinite)` antes de `Math.max(...spread)`

## PPE
- Catalogo reducido de 11 a 6 items con `iconFile` field
- ppeBase64.ts: imagenes base64 para PDF export
- HoPpeSelector: checkboxes con iconos SVG

## Exports
- PDF async con base64-embedded logo y PPE images
- Excel con row heights calculadas por contenido (String() cast obligatorio)

## Reglas de Contenido

### Filtrado CP → HO
- HO solo recibe controles del CP que ejecuta el operario en su estacion.
- Controles de laboratorio, metrologia y auditoria NO van en la HO.

### Responsables
- El responsable del `qcItem` en HO DEBE coincidir con el responsable del CP item vinculado.

### Duplicados
- NUNCA duplicar controles en el ciclo de control de la misma sheet.
- Un control = una linea en `qcItems`.

### Familias
- UN solo set de HOs por familia de producto si el proceso es identico.

### EPP
- EPP debe ser coherente con el tipo de operacion:
  - Inyeccion: respirador + delantal + guantes termicos
  - Costura: proteccion auditiva + anteojos
  - Corte: guantes anticorte + anteojos
  - Embalaje: zapatos de seguridad + guantes
