# Inventario BOM real del servidor — ultimas versiones

Generado 2026-04-29 a partir de busqueda en `\\SERVER\compartido\BARACK\CALIDAD\DOCUMENTACION SGC\PPAP CLIENTES`.
Excluye carpetas OBSOLETO / ANTIGUO / SUPERADO y archivos temp `~$`.

## VW Patagonia — VW427-1LA_K-PATAGONIA (proyecto activo)

| Familia | Archivo | Path |
|---|---|---|
| Armrest Rear | `PATAGONIA_ARMREST REAR_BOM Barack_V5_20260331.xlsx` | `VW/VW427-1LA_K-PATAGONIA/Armrest Rear/1-APQP/7-Lista de materiales preliminares/01_BOM MATERIAL/` |
| Headrest | `PATAGONIA_HEADREST SET_BOM Barack_V3_20260311.xlsx` | `VW/VW427-1LA_K-PATAGONIA/Headrest/APQP/7-Lista de materiales preliminares/01_BOM MATERIAL/` |
| IP PAD | `PATAGONIA_IP PAD_BOM Barack_V3_20260409.xlsx` | `VW/VW427-1LA_K-PATAGONIA/IP PADs/APQP/7-Lista de materiales/1_BOM/` |

Estructuras producto (referencia secundaria — no son los BOMs principales):
- `Estructura Producto_Armrest_Patagonia_02 Rev. A.xlsx` (Armrest)
- `Estructura Producto_Headrest_Patagonia_01 Rev. A.xlsx` (Headrest)
- `PATAGONIA_PLATE ASM-IP CTR OTLT AIR_Sinóptico Producto_V1_20251229.xlsx` (IP PAD)

## VW TAOS PA

| Familia | Archivo | Path |
|---|---|---|
| Molduras IP | `BOM - TAOS PA.xlsx` | `VW/TAOS PA/Molduras IP Taos PA/APQP/7-Lista de materiales preliminares/` |

## PWA

| Familia | Archivo | Path |
|---|---|---|
| Toyota Telas Planas (581D) | `Listado de materiales.xlsx` | `PWA/1- TOYOTA_TELAS_ PLANAS_581D/APQP/7-Lista de materiales/` |
| Toyota Telas Termoformadas (582D) | `TOYOTA_TELAS_TERMOFORMADAS_582D_BOM Barack_Preliminar .xlsx` | `PWA/2-TOYOTA_TELAS_TERMOFORMADAS_582D/APQP/7-Lista de materiales/` |
| Toyota 737 RR1 MHV | `TOYOTA_737_RR1_MHV_BOM Barack_Preliminar .xlsx` | `PWA/3- TOYOTA_737_RR1_MHV/APQP/7-Lista de materiales/` |
| GM BSUV Espumas | `BOM Espuma PWA GM BSUV.xlsx` | `PWA/GM BSUV/Espumas/BOM/` |
| GM BSUV Estructura APB — Alambres Forrados | `BOM Alambres forrados.xlsx` | `PWA/GM BSUV/ESTRUCTURA APB CENTRAL/7-Lista de materiales preliminares OK/Alambres Forrados/` |
| GM BSUV Estructura APB | `BOM Estructura APB PWA BSUV.xlsx` | `PWA/GM BSUV/ESTRUCTURA APB CENTRAL/7-Lista de materiales preliminares OK/Estructura/` |
| METALSUR | `BOM MATERIALES METALSUR.xlsx` | `PWA/METALSUR/` |

## NOVAX

| Familia | Archivo | Path | Notas |
|---|---|---|---|
| Tapizadas Puerta | `BOM DOOR PANEL - ONLY MATERIAL. Rev.11.xlsx` | `NOVAX/Tapizadas puerta/14-Especificaciones de Materiales/01- BOM/00- BOM MATERIAL/` | Rev.11 = ultima (Rev.00 a Rev.11 disponibles). Contiene 6 BOMs en sheets: BOM FRONT TOP ROLL, BOM REAR TOP ROLL, BOM FRONT INSERT, BOM RR INSERT, BOM FRONT ARMREST, BOM REAR ARMREST + Resumen Proveedores |

## COZZUOL / VENTALUM (proyectos secundarios)

| Familia | Archivo | Path |
|---|---|---|
| Upper Trim Panel | `BOM UPPER TRIM PANEL.xlsx` | `COZZUOL/00- Upper Trimming/UPPER TRIM PANEL COZZUOL/02- BOM/` |
| Film para estribo H60 Nissan | `BOM FILM PARA ESTRIBO H60.xlsx` | `PROYECTOS/Cozzuol/VENTALUM/17101364 - Film para estribo H60 Nissan/01 - BOM Materiales/` |
| Cinta bifaz 3M GPT0520F | `BOM CINTA BIFAZ 5X37.xlsx` | `PROYECTOS/Cozzuol/VENTALUM/17500311 - Cinta bifaz 3M GPT0520F/01 - BOM Materiales/` |
| Numeration plate RT8008 GR | `BOM NUMERATION PLATE GR.xlsx` | `PROYECTOS/Cozzuol/VENTALUM/17500323 - Numeration plate RT8008 GR/01-Boms/` |

## NISSAN-RENAULT

| Familia | Archivo | Path |
|---|---|---|
| H60A Chip-PTR Black Out | `BOMS CHIPPING 3 CODIGOS.xlsx` | `NISSAN-RENAULT/H60A Chip-PTR - BLACK OUT/Proyecto/7-Lista de materiales preliminares/01-Boms/` |

## IRAUTO (carpeta REVISADO/2019 — verificar si vigente)

| Familia | Archivo | Path |
|---|---|---|
| Espumas Tarek | `LISTADO DE MATERIALES IRAUTO.xlsx` | `IRAUTO/REVISADO/2019/Carpeta de Proyecto IRAUTO ESPUMAS TAREK/7 - Lista de Materiales/` |

---

## Resumen para el importador

**Total BOMs activos a cargar**: ~14 productos distintos
**Formatos confirmados**:
- **NOVAX** (1 archivo Excel = 6 productos): multi-sheet, multi-nivel (Nivel 1/2/3), 2 secciones por sheet (codigo cliente + descomposicion Barack)
- **VW Patagonia** (3 archivos): formato Barack V3-V5, formato a confirmar con inspector
- **PWA Toyota** (3 archivos): formato `Listado de materiales` con columnas Cod.Int / Cod.Prov / Descripcion / Consumo / Unidad / Proveedor (segun reporte original del agente)
- **GM BSUV / METALSUR / COZZUOL / NISSAN-RENAULT** (~6 archivos): formatos por confirmar

**Estrategia de carga**:
1. Inspector individual con `_inspectBomExcel.mjs` para confirmar formato real de cada archivo
2. Parser por cliente (NOVAX, VW, PWA, COZZUOL, otros) — agentes paralelos
3. Generar JSON intermedio antes de cargar a Supabase (dry-run)
4. Cargar a `bom_documents` con familyId vinculado a `product_families`
