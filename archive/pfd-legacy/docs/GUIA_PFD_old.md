# Guia para crear y mantener Flujogramas de Proceso (PFD)

Referencia basada en el flujograma oficial del Armrest Patagonia y las reglas de `.claude/rules/pfd.md`.

## Simbologia AIAG

| Simbolo | Tipo | Descripcion |
|---------|------|-------------|
| Circulo | Operacion | Proceso que transforma el producto |
| Flecha | Transporte | Movimiento entre sectores |
| Triangulo invertido | Almacenamiento | Stock WIP o producto terminado |
| Cuadrado | Inspeccion | Control de calidad |
| Rombo | Decision | PRODUCTO CONFORME? / MATERIAL CONFORME? |

## Convenciones de nombres

### Operaciones de proceso
- Usar nombres descriptivos en espanol: "INYECCION DE INSERT", "COSTURA DE TAPIZADO", "TERMOFORMADO"
- NUNCA usar nombres en ingles (EDGE FOLDING, TRIMMING, etc.)
- NUNCA inventar operaciones que no existen en el AMFE

### Transportes
- Formato: "TRASLADO: [que] A SECTOR DE [destino]"
- Ejemplo: "TRASLADO: PIEZAS INYECTADAS A SECTOR DE COSTURA"

### Almacenamiento
- WIP: "ALMACENAMIENTO EN MEDIOS WIP"
- Producto terminado: "ALMACENAMIENTO DE PRODUCTO TERMINADO"

### Decisiones (rombos NG path)
- "PRODUCTO CONFORME?" — para inspecciones en proceso
- "MATERIAL CONFORME?" — para recepcion de materia prima
- NUNCA usar "ESTA OK LA PIEZA?" ni variantes informales

### Segregacion
- "CLASIFICACION Y SEGREGACION DE PRODUCTO NO CONFORME"

### Control final
- "CONTROL FINAL DE CALIDAD"
- NUNCA usar "INSPECCION FINAL" ni variantes

### Embalaje
- "EMBALAJE Y ETIQUETADO DE PRODUCTO TERMINADO"

## Header del PFD

| Campo | Valor correcto |
|-------|---------------|
| Empresa | "BARACK MERCOSUL" (mayusculas) |
| Cliente VW | "VWA" |
| Cliente Toyota | "PWA" |
| Software | NUNCA aparece — no poner |
| Equipo | Completo, sin truncar |

## Coherencia cruzada

La regla mas importante del PFD: los nombres y numeros de operacion deben ser **IDENTICOS** en los 4 documentos:

| PFD | AMFE | CP | HO |
|-----|------|----|----|
| Step 10: RECEPCION DE MATERIA PRIMA | Op 10: RECEPCION DE MATERIA PRIMA | PSN 10: RECEPCION DE MATERIA PRIMA | HO-10: RECEPCION DE MATERIA PRIMA |
| Step 20: INYECCION DE INSERT | Op 20: INYECCION DE INSERT | PSN 20: INYECCION DE INSERT | HO-20: INYECCION DE INSERT |

Si un nombre difiere entre documentos, es un error que hay que corregir.

## Lo que NUNCA hacer

- Copiar PFD de un producto a otro sin adaptarlo al proceso real
- Poner numeros sueltos o "$1" en textos
- Inventar operaciones que no existen en el AMFE
- Usar ingles en nombres de operaciones
- Truncar el campo Equipo
