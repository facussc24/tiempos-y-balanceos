# Migracion PFD -> Flowchart — Reporte

- Fecha     : 2026-04-10T17:15:55.277Z
- Modo      : DRY-RUN
- Total PFD : 7
- Migrados  : 7
- Skipped   : 0
- Warnings  : 2

## Documentos migrados

| Source PFD ID | linkedAmfeProject | project | nodes | productCodes | amfeMatched |
|---------------|-------------------|---------|-------|--------------|-------------|
| 94b2481a-a9c4-45e8-9b36-69743a233310 | PWA/TELAS_PLANAS | Telas Planas | 30 | 0 | no |
| 689c06c6-144a-4a13-bc78-f121d9d940ac | VWA/PATAGONIA/HEADREST_REAR_OUT | Apoyacabezas Trasero Lateral - Patagonia VW | 22 | 1 | yes |
| pfd-ippads-trim-asm-upr-wrapping | VWA/PATAGONIA/IP_PADS | IP PAD | 29 | 3 | yes |
| 80616391-37ba-4b0a-b23b-6802c98fcd60 | PWA/TELAS_TERMOFORMADAS | TELAS TERMOFORMADAS 582D | 29 | 0 | no |
| c51fc067-1431-47d0-b206-dc9ec029c7a2 | VWA/PATAGONIA/HEADREST_FRONT | Apoyacabezas Delantero - Patagonia VW | 23 | 1 | yes |
| 73a17ed0-964b-407e-8485-fd1bfd16b9f0 | VWA/PATAGONIA/HEADREST_REAR_CEN | Apoyacabezas Trasero Central - Patagonia VW | 22 | 1 | yes |
| efa71449-10a0-43f8-a6b7-5edf078f37eb | VWA/PATAGONIA/TOP_ROLL | TOP ROLL PATAGONIA | 25 | 1 | yes |

## Warnings

- **94b2481a-a9c4-45e8-9b36-69743a233310** (PWA/TELAS_PLANAS): No se encontro AMFE que matchee con project_name. productCodes quedara vacio.
- **80616391-37ba-4b0a-b23b-6802c98fcd60** (PWA/TELAS_TERMOFORMADAS): No se encontro AMFE que matchee con project_name. productCodes quedara vacio.

## Detalle por documento migrado

### PWA/TELAS_PLANAS

- **Source PFD id**: 94b2481a-a9c4-45e8-9b36-69743a233310
- **New Flowchart id**: 5ad43156-d57c-4b92-8227-ab700d8e0123
- **Header**: {"title":"Flujograma de Proceso — Telas Planas","documentCode":"FLJ-21-9463","revision":"A","date":"2026-03-14","preparedBy":"Facundo Santoro","reviewedBy":"Manuel Meszaros","project":"Telas Planas","client":"PWA"}
- **productCodes (0)**:
- **nodes (30)**:
  - [storage] OP 10 — RECEPCION DE MATERIA PRIMA
  - [storage] 10a — ALMACENADO EN SECTOR DE RECEPCION DE MATERIA PRIMA PENDIENTE DE CONTROL
  - [inspection] 10b — INSPECCION DE MATERIA PRIMA
  - [condition] 10c — MATERIAL CONFORME?
  - [transfer] 10d — TRASLADO: MATERIAL APROBADO A ALMACEN TEMPORAL (FIFO)
  - [storage] 10e — ALMACENADO EN SECTOR DE RECEPCION DE MATERIA PRIMA CONTROLADA E IDENTIFICADA
  - [transfer] 10f — TRASLADO: TELAS A SECTOR DE MESA DE CORTE
  - [operation] OP 15 — PREPARACION DE CORTE
  - [operation] OP 20 — CORTE
  - [inspection] OP 25 — CONTROL CON MYLAR
  - [condition] 25a — PRODUCTO CONFORME?
  - [operation] OP 30 — PREPARACION DE KITS
  - [storage] 30a — EMBOLSADO WIP: PIEZAS CORTADAS EN BOLSA CON ETIQUETA WIP (REFERENCIA + CANTIDAD)
  - [transfer] 30b — TRASLADO: KITS DE COMPONENTES A SECTOR DE BLANCO
  - [transfer] 50a — TRASLADO: MATERIAL APLIX Y REFUERZOS A SECTOR DE TROQUELADO
  - [operation] OP 50 — TROQUELADO DE REFUERZOS
  - [operation] OP 60 — TROQUELADO DE APLIX
  - [transfer] 60a — TRASLADO: APLIX A SECTOR DE BLANCO
  - [operation] OP 40 — COSTURA
  - [condition] 40a — LLEVA OVERLOCK?
  - [operation] OP 70 — PEGADO DE DOTS
  - [inspection] OP 80 — CONTROL FINAL DE CALIDAD
  - [condition] 80a — PRODUCTO CONFORME?
  - [operation] OP 90 — CLASIFICACION Y SEGREGACION DE PRODUCTO NO CONFORME
  - [operation] OP 100 — REPROCESO: ELIMINACION DE HILO SOBRANTE
  - [operation] OP 101 — REPROCESO: REUBICACION DE APLIX
  - [operation] OP 102 — REPROCESO: CORRECCION DE COSTURA DESVIADA / FLOJA
  - [operation] OP 110 — EMBALAJE
  - [transfer] 110a — TRASLADO A SECTOR DE PRODUCTO TERMINADO
  - [storage] 110b — ALMACENAMIENTO: PRODUCTO TERMINADO (FIFO)

### VWA/PATAGONIA/HEADREST_REAR_OUT

- **Source PFD id**: 689c06c6-144a-4a13-bc78-f121d9d940ac
- **New Flowchart id**: b4b4ffe4-a51f-4d0e-82e5-b29d1048390f
- **Header**: {"title":"Flujograma de Proceso — Apoyacabezas Trasero Lateral - Patagonia VW","documentCode":"FLJ-2HC.885.901","revision":"A","date":"2026-03-31","preparedBy":"Facundo Santoro","reviewedBy":"Manuel Meszaros","project":"Apoyacabezas Trasero Lateral - Patagonia VW","client":"VWA"}
- **productCodes (1)**:
  - `Apoyacabezas Trasero Lateral L0, L1, L2, L3`
- **nodes (22)**:
  - [storage] 10 — RECEPCION DE MATERIA PRIMA
  - [inspection] - — INSPECCION DE MATERIA PRIMA
  - [storage] - — ALMACENADO EN SECTOR DE RECEPCION DE MATERIA PRIMA CONTROLADA E IDENTIFICADA
  - [transfer] - — TRASLADO: VINILOS / TELAS A SECTOR DE MESA DE CORTE
  - [operation] 20 — CORTE DEL VINILO / TELA (FUNDA)
  - [operation] - — PREPARACION DE KITS DE COMPONENTES DE COSTURA
  - [transfer] - — TRASLADO: KITS DE COMPONENTES DE COSTURA A SECTOR DE COSTURA
  - [operation] 30 — COSTURA UNION ENTRE PANELES
  - [operation] 35 — COSTURA VISTA (APLICA SOLO A L1 RENNES BLACK, L2 ANDINO GRAY, L3 DARK SLATE — NO
  - [transfer] - — TRASLADO: FUNDAS COSIDAS APROBADAS A AREA DE INYECCION
  - [operation] 50 — INYECCION PUR - APOYACABEZAS
  - [operation] - — CURADO Y ESTABILIZACION DE ESPUMA
  - [transfer] - — TRASLADO: MATERIAL APROBADO A ALMACEN TEMPORAL (FIFO)
  - [inspection] 60 — CONTROL FINAL DE CALIDAD
  - [condition] - — PRODUCTO CONFORME?
  - [operation] 100 — CLASIFICACION Y SEGREGACION DE PRODUCTO NO CONFORME
  - [operation] 110 — REPROCESO: ELIMINACION DE HILO SOBRANTE
  - [operation] 111 — REPROCESO: PUNTADA FLOJA
  - [operation] 112 — REPROCESO: ELIMINACION DE ARRUGAS EN HORNO
  - [operation] 70 — EMBALAJE Y ETIQUETADO DE PRODUCTO TERMINADO
  - [storage] - — ALMACENAMIENTO: PRODUCTO TERMINADO (FIFO)
  - [transfer] - — TRASLADO A SECTOR DE PRODUCTO TERMINADO

### VWA/PATAGONIA/IP_PADS

- **Source PFD id**: pfd-ippads-trim-asm-upr-wrapping
- **New Flowchart id**: 6f475ce3-0bae-4394-9d5c-bf6480146337
- **Header**: {"title":"Flujograma de Proceso — IP PAD","documentCode":"FLJ-2HC.858.417.B FAM","revision":"A","date":"2026-04-06","preparedBy":"Facundo Santoro","reviewedBy":"Manuel Meszaros","project":"IP PAD","client":"VWA"}
- **productCodes (3)**:
  - `L1: 2HC.858.417.B FAM (Low Version)`
  - `L2: 2HC.858.417.C GKK (High Version)`
  - `L3: 2HC.858.417.C GKN (High Version)`
- **nodes (29)**:
  - [storage] OP 10 — RECEPCION DE MATERIA PRIMA
  - [condition] - — MATERIAL CONFORME?
  - [storage] - — ALMACENAMIENTO DE MATERIA PRIMA
  - [transfer] - — TRASLADO: MATERIAL A SECTOR DE INYECCION
  - [operation] OP 20 — INYECCION
  - [storage] - — ALMACENAMIENTO EN MEDIOS WIP
  - [transfer] - — TRASLADO: VINILO A SECTOR DE CORTE
  - [operation] OP 30 — CORTE
  - [transfer] - — TRASLADO: PIEZAS CORTADAS A SECTOR DE COSTURA
  - [operation] OP 40 — COSTURA
  - [storage] - — ALMACENAMIENTO EN MEDIOS WIP
  - [transfer] - — TRASLADO: ESPUMA A SECTOR DE TROQUELADO
  - [operation] OP 50 — TROQUELADO DE ESPUMAS
  - [storage] - — ALMACENAMIENTO EN MEDIOS WIP
  - [operation] OP 60 — ENSAMBLE SUSTRATO + ESPUMA
  - [transfer] - — TRASLADO: MATERIAL ADHESIVO DESDE ALMACEN MP
  - [operation] OP 70 — ADHESIVADO
  - [inspection] - — CONTROL DE CALIDAD
  - [condition] - — PRODUCTO CONFORME?
  - [operation] OP 80 — ALINEACION DE COSTURA (PRE-FIXING)
  - [operation] OP 90 — WRAPPING + EDGE FOLDING
  - [operation] OP 100 — SOLDADURA CON ULTRASONIDO
  - [operation] OP 110 — TERMINACION
  - [inspection] OP 120 — CONTROL FINAL DE CALIDAD
  - [condition] - — PRODUCTO CONFORME?
  - [operation] - — CLASIFICACION Y SEGREGACION DE PRODUCTO NO CONFORME
  - [transfer] - — TRASLADO: PRODUCTO APROBADO A SECTOR DE EMBALAJE
  - [operation] OP 130 — EMBALAJE DE PRODUCTO TERMINADO
  - [storage] - — ALMACENAMIENTO DE PRODUCTO TERMINADO

### PWA/TELAS_TERMOFORMADAS

- **Source PFD id**: 80616391-37ba-4b0a-b23b-6802c98fcd60
- **New Flowchart id**: 470aa4b9-5941-478d-bdd5-5aa94fd89bfa
- **Header**: {"title":"Flujograma de Proceso — TELAS TERMOFORMADAS 582D","documentCode":"FLJ-21-9640 / 21-9641 / 21-9642 / 21-9643","revision":"A","date":"2026-03-14","preparedBy":"Facundo Santoro","reviewedBy":"Manuel Meszaros","project":"TELAS TERMOFORMADAS 582D","client":"PWA"}
- **productCodes (0)**:
- **nodes (29)**:
  - [storage] 10 — RECEPCION DE MATERIA PRIMA
  - [inspection] - — INSPECCION DE MATERIA PRIMA
  - [condition] - — MATERIAL CONFORME?
  - [storage] - — ALMACENADO EN SECTOR DE MATERIA PRIMA APROBADA
  - [transfer] - — TRASLADO: MATERIAL A SECTOR DE CORTE
  - [operation] 15 — PREPARACION DE CORTE
  - [operation] 20 — CORTE DE COMPONENTES
  - [inspection] 25 — CONTROL CON MYLAR
  - [condition] - — PIEZA CONFORME?
  - [operation] 30 — PREPARACION DE KITS DE COMPONENTES
  - [transfer] - — TRASLADO: KITS A SECTOR DE TERMOFORMADO
  - [operation] 40 — TERMOFORMADO DE TELAS
  - [transfer] - — TRASLADO: TELAS TERMOFORMADAS A SECTOR DE CORTE LASER
  - [operation] 50 — CORTE LASER DE TELAS TERMOFORMADAS
  - [transfer] - — TRASLADO: PIEZAS A SECTOR DE TROQUELADO
  - [operation] 60 — TROQUELADO DE REFUERZOS
  - [operation] 70 — TROQUELADO DE APLIX
  - [transfer] - — TRASLADO: COMPONENTES A SECTOR DE COSTURA
  - [operation] 80 — COSTURA DE REFUERZOS
  - [operation] 90 — APLICACION DE APLIX
  - [transfer] - — TRASLADO: PIEZAS A SECTOR DE CONTROL FINAL
  - [inspection] 100 — CONTROL FINAL DE CALIDAD
  - [condition] - — PRODUCTO CONFORME?
  - [operation] 101 — REPROCESO: ELIMINACION DE HILO SOBRANTE
  - [operation] 102 — REPROCESO: REUBICACION DE APLIX
  - [operation] 103 — REPROCESO: CORRECCION DE COSTURA DESVIADA/FLOJA
  - [operation] 105 — CLASIFICACION Y SEGREGACION DE PRODUCTO NO CONFORME
  - [operation] 110 — EMBALAJE Y ETIQUETADO DE PRODUCTO TERMINADO
  - [storage] 120 — ALMACENAMIENTO PRODUCTO TERMINADO

### VWA/PATAGONIA/HEADREST_FRONT

- **Source PFD id**: c51fc067-1431-47d0-b206-dc9ec029c7a2
- **New Flowchart id**: f538348f-f3aa-428f-a0d7-6fca6d359b5a
- **Header**: {"title":"Flujograma de Proceso — Apoyacabezas Delantero - Patagonia VW","documentCode":"FLJ-2HC.881.901","revision":"A","date":"2026-03-31","preparedBy":"Facundo Santoro","reviewedBy":"Manuel Meszaros","project":"Apoyacabezas Delantero - Patagonia VW","client":"VWA"}
- **productCodes (1)**:
  - `Apoyacabezas Delantero L0 (PVC), L1 (Fabric/PVC), L2 (Leather/PVC), L3 (Leather/PVC)`
- **nodes (23)**:
  - [storage] 10 — RECEPCION DE MATERIA PRIMA
  - [inspection] - — INSPECCION DE MATERIA PRIMA
  - [storage] - — ALMACENADO EN SECTOR DE RECEPCION DE MATERIA PRIMA CONTROLADA E IDENTIFICADA
  - [transfer] - — TRASLADO: VINILOS / TELAS A SECTOR DE MESA DE CORTE
  - [operation] 20 — CORTE DEL VINILO / TELA (FUNDA)
  - [operation] - — PREPARACION DE KITS DE COMPONENTES DE COSTURA
  - [transfer] - — TRASLADO: KITS DE COMPONENTES DE COSTURA A SECTOR DE COSTURA
  - [operation] 30 — COSTURA UNION ENTRE PANELES
  - [operation] 35 — COSTURA VISTA (APLICA SOLO A L1 RENNES BLACK, L2 ANDINO GRAY, L3 DARK SLATE — NO
  - [transfer] - — TRASLADO: FUNDAS COSIDAS APROBADAS A AREA DE INYECCION
  - [operation] 50 — ENSAMBLE DE VARILLA + EPP
  - [operation] 60 — INYECCION PUR - APOYACABEZAS
  - [operation] - — CURADO Y ESTABILIZACION DE ESPUMA
  - [transfer] - — TRASLADO: MATERIAL APROBADO A ALMACEN TEMPORAL (FIFO)
  - [inspection] 70 — CONTROL FINAL DE CALIDAD
  - [condition] - — PRODUCTO CONFORME?
  - [operation] 100 — CLASIFICACION Y SEGREGACION DE PRODUCTO NO CONFORME
  - [operation] 110 — REPROCESO: ELIMINACION DE HILO SOBRANTE
  - [operation] 111 — REPROCESO: PUNTADA FLOJA
  - [operation] 112 — REPROCESO: ELIMINACION DE ARRUGAS EN HORNO
  - [operation] 80 — EMBALAJE Y ETIQUETADO DE PRODUCTO TERMINADO
  - [storage] - — ALMACENAMIENTO: PRODUCTO TERMINADO (FIFO)
  - [transfer] - — TRASLADO A SECTOR DE PRODUCTO TERMINADO

### VWA/PATAGONIA/HEADREST_REAR_CEN

- **Source PFD id**: 73a17ed0-964b-407e-8485-fd1bfd16b9f0
- **New Flowchart id**: e5b0684a-7a5a-4c41-a9e4-5f6a05e89030
- **Header**: {"title":"Flujograma de Proceso — Apoyacabezas Trasero Central - Patagonia VW","documentCode":"FLJ-2HC.885.900","revision":"A","date":"2026-03-31","preparedBy":"Facundo Santoro","reviewedBy":"Manuel Meszaros","project":"Apoyacabezas Trasero Central - Patagonia VW","client":"VWA"}
- **productCodes (1)**:
  - `Apoyacabezas Trasero Central L0, L1, L2, L3`
- **nodes (22)**:
  - [storage] 10 — RECEPCION DE MATERIA PRIMA
  - [inspection] - — INSPECCION DE MATERIA PRIMA
  - [storage] - — ALMACENADO EN SECTOR DE RECEPCION DE MATERIA PRIMA CONTROLADA E IDENTIFICADA
  - [transfer] - — TRASLADO: VINILOS / TELAS A SECTOR DE MESA DE CORTE
  - [operation] 20 — CORTE DEL VINILO / TELA (FUNDA)
  - [operation] - — PREPARACION DE KITS DE COMPONENTES DE COSTURA
  - [transfer] - — TRASLADO: KITS DE COMPONENTES DE COSTURA A SECTOR DE COSTURA
  - [operation] 30 — COSTURA UNION ENTRE PANELES
  - [operation] 35 — COSTURA VISTA (APLICA SOLO A L1 RENNES BLACK, L2 ANDINO GRAY, L3 DARK SLATE — NO
  - [transfer] - — TRASLADO: FUNDAS COSIDAS APROBADAS A AREA DE INYECCION
  - [operation] 50 — INYECCION PUR - APOYACABEZAS
  - [operation] - — CURADO Y ESTABILIZACION DE ESPUMA
  - [transfer] - — TRASLADO: MATERIAL APROBADO A ALMACEN TEMPORAL (FIFO)
  - [inspection] 60 — CONTROL FINAL DE CALIDAD
  - [condition] - — PRODUCTO CONFORME?
  - [operation] 100 — CLASIFICACION Y SEGREGACION DE PRODUCTO NO CONFORME
  - [operation] 110 — REPROCESO: ELIMINACION DE HILO SOBRANTE
  - [operation] 111 — REPROCESO: PUNTADA FLOJA
  - [operation] 112 — REPROCESO: ELIMINACION DE ARRUGAS EN HORNO
  - [operation] 70 — EMBALAJE Y ETIQUETADO DE PRODUCTO TERMINADO
  - [storage] - — ALMACENAMIENTO: PRODUCTO TERMINADO (FIFO)
  - [transfer] - — TRASLADO A SECTOR DE PRODUCTO TERMINADO

### VWA/PATAGONIA/TOP_ROLL

- **Source PFD id**: efa71449-10a0-43f8-a6b7-5edf078f37eb
- **New Flowchart id**: 686ed5b8-3ffc-48f0-a873-bc4ed3920791
- **Header**: {"title":"Flujograma de Proceso — TOP ROLL PATAGONIA","documentCode":"FLJ-N 216 / N 256 / N 285 / N 315","revision":"01","date":"2026-03-31","preparedBy":"Facundo Santoro","reviewedBy":"Manuel Meszaros","project":"TOP ROLL PATAGONIA","client":"VWA"}
- **productCodes (1)**:
  - `N 216, N 256`
- **nodes (25)**:
  - [storage] 5 — RECEPCION DE MATERIA PRIMA
  - [storage] - — ALMACENADO EN SECTOR DE RECEPCION DE MATERIA PRIMA PENDIENTE DE CONTROL
  - [inspection] - — INSPECCION DE MATERIA PRIMA
  - [condition] - — MATERIAL CONFORME?
  - [storage] - — ALMACENADO EN SECTOR DE RECEPCION DE MATERIA PRIMA CONTROLADA E IDENTIFICADA
  - [transfer] - — TRASLADO DE MATERIA PRIMA AL SECTOR DE INYECCION
  - [operation] 10 — INYECCION DE PIEZA PLASTICA
  - [condition] - — PRODUCTO CONFORME?
  - [operation] 20 — ADHESIVADO HOT MELT
  - [condition] - — PRODUCTO CONFORME?
  - [operation] 30 — TERMOFORMADO
  - [condition] - — PRODUCTO CONFORME?
  - [operation] 40 — CORTE FINAL
  - [condition] - — PRODUCTO CONFORME?
  - [operation] 50 — DOBLADO DE BORDES
  - [condition] - — PRODUCTO CONFORME?
  - [operation] 60 — SOLDADO DE REFUERZOS INTERNOS
  - [condition] - — PRODUCTO CONFORME?
  - [operation] 70 — SOLDADO DE TWEETER
  - [inspection] - — CONTROL FINAL DE CALIDAD
  - [condition] - — PRODUCTO CONFORME?
  - [transfer] - — TRASLADO DE PIEZAS AL SECTOR DE PRODUCTO TERMINADO
  - [operation] 90 — EMBALAJE Y ETIQUETADO DE PRODUCTO TERMINADO
  - [inspection] - — CONTROL DE LAS CANTIDADES DE DESPACHO
  - [storage] - — ALMACENADO EN SECTOR DE PRODUCTO TERMINADO
