# Síntesis: Inyecciones como Semielaborados — Patagonia vs Amarok PA2

**Fecha de investigación:** 22/09/2026  
**Contexto:** Gonzalo Cal (Gerente de Planta) pidió verificar si en Patagonia (VW427) las inyecciones están cargadas como semielaborados en ARB, tal como se hace en Amarok PA2.  
**Fuente de datos:** ERP ARB → `.arb-cache/relaciones_plano.csv`, `.arb-cache/articulos.csv`

---

## HALLAZGO PRINCIPAL

**Patagonia NO tiene las inyecciones como semielaborados. Amarok PA2 SÍ.**

Los 53 productos de Patagonia tienen el plástico y los químicos de inyección/espumado cargados **directo en nivel 0** (estructura plana), mezclados con todos los demás insumos del producto terminado.

En contraste, Amarok PA2 usa el semielaborado `INY-APB0005-V1` que agrupa plástico + químicos en **nivel 1**, permitiendo almacenar, planificar y costear la inyección por separado.

**Lo más grave:** Ya se crearon 17 códigos `INY-` para Patagonia en el maestro de artículos, pero **nunca se vincularon** en las relaciones de producción. Están colgados.

---

## EJEMPLO CONCRETO: AMAROK PA2 (MODELO CORRECTO ✅)

Producto Terminado: `2H6863761B IYO` (Tapa Consola Trendline Amarok PA2)

```
2H6863761B IYO  (PT — Nivel 0)
│
├── INY-APB0005-V1          "TAPA INYECTADA AMAROK PA2"        1 UN    ← SEMIELABORADO
│   ├── 2H0863766D          "CUBIERTA EXTERIOR PLASTICA"       1 UN
│   ├── ISOPLUS 1394        "ISOCIANATO"                       0,040 KG
│   ├── POLIPLUS FF629      "POLIOL"                           0,080 KG
│   ├── DISSACOL HR         "DESMOLDANTE"                      0,000926 BI
│   └── PD270               "LIMPIA CABEZAL"                   0,160 KG
│
├── [Adhesivos, etiquetas, vinilo — insumos de tapizado]
└── ...
```

CSV de evidencia (`relaciones_plano.csv`):
```csv
2H6863761B IYO,0,2H6863761B IYO,INY-APB0005-V1,TAPA INYECTADA AMAROK PA2,UN,"1,00000000",INY,INY
2H6863761B IYO,1,INY-APB0005-V1,2H0863766D,CUBIERTA EXTERIOR PLASTICA APB CENTRAL V,UN,"1,00000000",,
2H6863761B IYO,1,INY-APB0005-V1,DISSACOL HR,DESMOLDANTE DISSACOL HR 20 LT,BI,"0,00092600",,
2H6863761B IYO,1,INY-APB0005-V1,ISOPLUS 1394,ISOSCIANATO APB CENTRAL VW AMAROK,KG,"0,04000000",,
2H6863761B IYO,1,INY-APB0005-V1,PD270,LIMPIA CABEZAL MAQ ESPUMADO PD270,KG,"0,16000000",,
2H6863761B IYO,1,INY-APB0005-V1,POLIPLUS FF629,POLIOL APB CENTRAL VW AMAROK,KG,"0,08000000",,
```

Las 3 variantes (`IYO` Trendline, `OIO` Highline, `SMC` Comfortline) comparten el mismo `INY-APB0005-V1`.

---

## EJEMPLO CONCRETO: PATAGONIA (ESTADO ACTUAL ❌)

Producto: `N 231` (Armrest Puerta Delantero Izquierdo)

```
N 231  (PT — Nivel 0)
│
├── 22020541                "MG47-BK1066 ABS"                  0,140 KG   ← SUELTO
├── ISO-PLUS 1355           "COMPONENTE PARA POLIURETANO"      0,043 KG   ← SUELTO
├── POLI-PLUSFF636          "COMPONENTE PARA POLIURETANO"      0,077 KG   ← SUELTO
├── DISSACOL HR             "DESMOLDANTE"                      0,000926 BI ← SUELTO
├── VIN-SKM-001             "Vinilo PVC"                       0,091 MT2
├── 427ADH002ADH01          "HB FULLER CQ-7080-5"             0,048 KG
├── DK/1840400              "GRAMPA DK 84-04"                  21 UN
├── FX284-E0PTO             "Hilo unión Negro"                 0,000544 KG
├── FX483TK-E0PTO           "HILO JET BLACK"                   0,000351 KG
├── ET-SATO-100X60          "ETIQUETA 100X60"                  0,0555 UNI
└── ET-SATO-50X20           "ETIQUETA 50X20"                   2 UN
```

Todo en nivel 0 — no se puede separar inyección de tapizado.

---

## LOS 53 PRODUCTOS DE PATAGONIA AFECTADOS

### Top Roll (4 productos) — Plástico: `22020541` ABS 0,178 kg + `CYCOLACDL100` PC/ABS 0,267 kg
- `N 216` (FL), `N 256` (FR), `N 285` (RL), `N 315` (RR)
- INY- existente sin vincular: `INY-TRL0001-V1` a `INY-TRL0009-V1`

### Armrest Puerta (4 productos) — Plástico: `22020541` ABS 0,140 kg + ISO+POLI PU
- `N 231` (FL), `N 267` (FR), `N 297` (RL), `N 328` (RR)
- INY- existente sin vincular: `INY-APB0001-V1` a `INY-APB0004-V1`

### Insert Puerta (16 productos) — Plástico: `22020541` ABS 0,265 kg
- `N 227` (FL L0), `N 389` a `N 403` (4 puertas x 4 niveles L0/L1/L2/L3)
- INY- existente sin vincular: `INY-INS0001-V1` a `INY-INS0004-V1`

### IP PAD (3 productos) — Plástico: `22022222` PC+ABS
- `2HC858417B FAM`, `2HC858417C GKK`, `2HC858417C GKN`
- INY- existente sin vincular: (no hay, faltaría crear)

### IP Decor Trim PA2 (6 productos) — Plástico: `22022222` PC+ABS 0,064-0,076 kg
- `2HT857115 DEC/HOA/YZM` (LH), `2HT857116 DEC/HOA/YZM` (RH)
- INY- existente sin vincular: `INY-2HT-115`, `INY-2HT-116` (tienen BOM propia pero no están enlazados)

### Armrest Trasero Central (1 producto) — Plástico: marcos comprados + ISO+POLI PU
- `2HC885081 RL1`

### Headrest Delantero (4 productos) — Armazón + ISO+POLI PU
- `2HC881901 RL1`, `2HC881901A GFV`, `2HC881901B GEV`, `2HC881901C EFG`

### Headrest Trasero Central (4 productos) — Armazón + ISO+POLI PU
- `2HC885900 RL1`, `2HC885900A EIF`, `2HC885900B SIY`, `2HC885900C SIY`

### Headrest Trasero Lateral (4 productos) — Armazón + ISO+POLI PU
- `2HC885901 RL1`, `2HC885901A GFU`, `2HC885901B GEQ`, `2HC885901C DZS`

### Insonos/Ductos (7 productos) — Thinsulate + ductos
- `MP8137`, `MP8146`, `MP8147`, `MP8148`, `MP8149`, `MP8150`, `MP8151`

---

## LOS 17 CÓDIGOS INY- HUÉRFANOS (creados pero sin vincular)

| Código | Descripción | Familia |
|--------|-------------|---------|
| `INY-APB0001-V1` | Armrest Del. Derecho | Armrest Puerta |
| `INY-APB0002-V1` | Armrest Del. Izquierdo | Armrest Puerta |
| `INY-APB0003-V1` | Armrest Tras. Derecho | Armrest Puerta |
| `INY-APB0004-V1` | Armrest Tras. Izquierdo | Armrest Puerta |
| `INY-INS0001-V1` | Insert Del. Derecho | Insert Puerta |
| `INY-INS0002-V1` | Insert Del. Izquierdo | Insert Puerta |
| `INY-INS0003-V1` | Insert Tras. Derecho | Insert Puerta |
| `INY-INS0004-V1` | Insert Tras. Izquierdo | Insert Puerta |
| `INY-TRL0001-V1` | Top Roll Del. Derecho | Top Roll |
| `INY-TRL0002-V1` | Top Roll Del. Der. Refuerzo | Top Roll |
| `INY-TRL0003-V1` | Top Roll Del. Izquierdo | Top Roll |
| `INY-TRL0004-V1` | Top Roll Del. Izq. Refuerzo | Top Roll |
| `INY-TRL0005-V1` | Top Roll Tras. Derecho | Top Roll |
| `INY-TRL0006-V1` | Top Roll Tras. Der. Tweeter | Top Roll |
| `INY-TRL0007-V1` | Top Roll Tras. Izquierdo | Top Roll |
| `INY-TRL0008-V1` | Top Roll Tras. Izq. Tweeter | Top Roll |
| `INY-TRL0009-V1` | Top Roll Tras. Izq. Refuerzo | Top Roll |

Además: `INY-2HT-115` e `INY-2HT-116` (IP Decor Trim) tienen BOM propia con `22022222` PC+ABS pero no están enlazados a los PT.

---

## QUÉ PRODUCTOS DEL ERP SÍ USAN SEMIELABORADO INY- (referencia)

| Producto | INY- | Cliente |
|----------|------|---------|
| `2H6863761B CSY/ICE/SMC` | `INY-2H6-761B` | Amarok PA1 |
| `2H6863761B IYO/OIO`, `2HT863761 SMC` | `INY-APB0005-V1` | Amarok PA2 |
| `4055`, `4111-4114` | `INY-411` | Mirgor (Hilux) |
| `58905-KK040-23/26/27/C5/C8` | `INY-58905-xx` | Toyota Hilux |

---

## REGLA DE ORO DEL SEMIELABORADO EN ARB

Un semielaborado existe en **ambos maestros** del ERP:
- En `ARTICULO.TXT` → porque Barack lo **fabrica** en planta
- En `INSUMOS.TXT` → porque se **consume** en la BOM de otro producto

| Tipo | ARTICULO | INSUMOS |
|------|:--------:|:-------:|
| Producto Terminado | ✅ | ❌ |
| Materia Prima Comprada | ❌ | ✅ |
| **Semielaborado** | **✅** | **✅** |

Prefijos canónicos: `INY-` (inyección), `COR-` (corte), `COS-` (costura), `TRO-` (troquelado), `FUN-` (fundas), `N xxx - SM` (semiterminados Top Roll).

---

## ACCIÓN REQUERIDA

Reestructurar las BOMs de Patagonia en ARB:
1. Vincular los `INY-` existentes como componentes de nivel 0 de cada PT
2. Mover el plástico (granza `22020541`, `CYCOLACDL100`, `22022222`) y los químicos PU (ISO-PLUS, POLI-PLUS, DISSACOL) desde nivel 0 del PT hacia nivel 1 dentro del `INY-` correspondiente
3. Modelo a replicar: `INY-APB0005-V1` en Amarok PA2
4. Para IP PAD, Armrest Central y Headrests: crear los `INY-` faltantes en el maestro de artículos antes de vincular

---

## NOTA TÉCNICA

En Amarok PA2, el proceso bajo `INY-APB0005-V1` es en realidad **espumado PU** (la cáscara plástica `2H0863766D` llega preformada). En cambio, Mirgor e Hilux sí inyectan desde pellet ABS virgen (`CYC-MG47-BK4500`). En Patagonia, los Top Roll, Armrest e Insert sí consumen granza ABS (`22020541`) para inyección real.
