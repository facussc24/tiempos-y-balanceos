# Plan · La ficha de configuración de cada pieza (tanda 13, ítem 1) — para el sí de Fak

Sábado 17/10/2026. Es un **plan**: no se implementó nada. Sale del informe A del equipo «fuera de la caja» del 15/10
(`20-informes\oportunidades\A_barack.md`, ítem 1) y de releer, solo leyendo, las fuentes de los cuatro casos verificados.
Camino por tamaño (`codigo-madre.md`): grande → este plan, el sí de Fak, worktree, revisor independiente.

---

## Síntesis para Fak (lo que hace falta leer)

**El problema.** Lo que se le escapa a Barack hacia el cliente casi nunca es un documento mal hecho: es que **dos
documentos de la misma pieza dicen cosas distintas**, o que se trabajó sobre una versión que no era la vigente. Cuatro
casos reales, todos del Insert y del IP PAD de Patagonia: la HO-990 dice adhesivo SikaMelt y la BOM y el AMFE dicen
Fenoclor; el ancho del rollo del Insert aparece con cuatro valores (1400, 1200, 1500 y 1150 mm); dos fichas técnicas dan
dos densidades de espuma (35 y 45 kg/m³); y VW vio en BeOn letras distintas de las nuestras (el 15/10 hubo que
reconstruirlo a mano).

**La propuesta, en tres pasos y en este orden:**
1. **(a) Qué está vigente**: una ficha por pieza con la letra vigente de cada documento (flujograma, AMFE, HO, BOM, ficha
   técnica, ficha de embalaje, IMDS) y **qué letra vio el cliente** (BeOn, PPAP, mail). La escriben los scripts que
   emiten; nadie la llena a mano.
2. **(b) Si los documentos dicen lo mismo**: un chequeo de solo lectura que compara, entre los documentos VIGENTES de la
   pieza, el adhesivo, el material, el ancho, la densidad, el hilo y las operaciones, y marca en rojo dónde no cierran
   **antes** de mandar. Sin (a) da avisos falsos (compararía contra versiones viejas: el error del 14/10).
3. **(c) Qué toca un cambio**: dado un cambio (una línea de BOM, un material), la lista de documentos de esa pieza que
   hay que tocar y el recordatorio del ECR (I-IN-003). Es el ECR/ECO que nombró Pedro (tanda 8).

**Qué le cambia:** se entera antes de mandar, y no por VW, Calidad o Carlos, de que la HO y la BOM no cierran; no
reconstruye a mano qué vio el cliente antes de cada BeOn; y cuando cambia algo, la lista de documentos sale sola.

**Lo que necesito de vos:**
1. **El sí a este plan**, para arrancar por el paso (a) con UNA pieza: el **Insert de Patagonia** (tiene tres de los
   cuatro casos).
2. **Dónde vive la ficha**. Recomiendo **el repo** (`data/configuracion/<pieza>.json`): queda el historial de cada cambio
   con fecha (git), y vos ya aceptaste que el repo público tenga datos de la empresa. La otra opción es la carpeta
   `DATOS` de la nube de Ingeniería (la ven los demás, sin historial). Elegí una; si no decís nada, va al repo.
3. Nada más: leer el servidor es libre por el contrato de autonomía, y escribir letras en los listados maestros sigue
   siendo con tu OK, como hoy (esta ficha los LEE, no los escribe).

---

## 1. Los cuatro casos, con su fuente (verificados en las memorias el 17/10; el estado de hoy lo dirá el paso b)

| # | Pieza | Qué dice cada documento | Fuente |
|---|---|---|---|
| 1 | Insert Patagonia | **HO-990**: adhesivado hot melt **SikaMelt 140-160 °C**. **BOM y AMFE**: **Fenoclor**. | memoria `project_ppap_novax_tapizadas_puerta` (relevamiento del PPAP Novax, 11/09/2026) |
| 2 | Insert Patagonia | Ancho de rollo: **FT141 1400 mm**; la copia que circuló por mail **1200**; Marcelo pidió **1,5 m** (dic-2025); las tizadas `INSERT 26-1-26` usan **115 cm** (`<WIDTH>115.0000</WIDTH>` en el MRK). | memoria `project_boms_patagonia_procesos` (renglones 102 a 110) |
| 3 | Insert Patagonia (espuma) | **FT141: PU 35 kg/m³**; **FT149: 45 kg/m³**. | resumen de la charla del 13/10 (`20-informes\charlas\semana_09.md:25`, sesión `e2acfaf9`): es un resumen, **hay que abrir las dos FT para confirmarlo** |
| 4 | IP PAD y apoyacabezas | Lo que vio VW en BeOn contra lo nuestro (15/10): flujograma 157 IP PAD, VW **Rev A** (emitido 14/10) y nosotros **C** (unificado en **B** ese día); flujograma 152, VW «preliminar» y nosotros **B** (pasado a **A** ese día); BOM de apoyacabezas, VW «v. B» y nosotros BOM004 **Rev A**; la HO-985 que tiene VW dice **6 en 25** y la corregida (**4 en 16**) sigue Rev A. | memoria `project_beon_revisiones_patagonia` y `exports/BEON_REVISIONES_20261015/NUESTRO_LADO.md` |

Y uno que **no** tiene que marcar (la otra dirección de la prueba): la costura del APB de puerta, «6 en 25 contra
4 en 16» entre la HO 971 y la especificación de costura, ya corregida el 14/10 (memoria
`reference_valores_costura_patagonia_confirmados`). El paso (b) tiene que dar verde ahí entre los documentos internos,
y el (a) decir aparte qué copia vieja tiene el cliente.

## 2. Lo que ya existe y se reusa (no se crea otro)

| Pieza de la casa | Qué hace hoy | Qué aporta a la ficha |
|---|---|---|
| `scripts/_verificarNumeracion.mjs` + `numeracionPatagonia.data.json` | compara los números de operación de los AMFE (Supabase) contra el flujograma | la parte «operaciones» del paso (b) |
| `scripts/_lib/amfeAutoria.mjs` (`leerBomDelArb`, `parsearBom`) | cruza los materiales de la recepción del AMFE con la BOM del arb en las dos direcciones | la parte «materiales» del paso (b) |
| `scripts/_lib/planControlAmfe.mjs` (gate 8) | compara los controles del plan de control con el AMFE | queda como está (el plan de control es de Calidad) |
| `tools/flowchart/data/*.json` | los datos de cada flujograma, con su revisión | letra vigente del flujograma (paso a) |
| Skill `beon` + `exports/BEON_REVISIONES_20261015/` | lee los informes de BeOn; el 15/10 se hizo la tabla a mano | «qué letra vio el cliente» (paso a) |
| Listados maestros (flujogramas, AMFE, hojas de proceso) | la letra liberada de cada documento | letra vigente; **solo lectura** (registro compartido) |
| `scripts/_observaciones.mjs` (ítem 5 de esta tanda) | lo que le marcaron a cada tipo de documento | un renglón más del «antes de mandar» |
| **Artemis** (`Y:\Ingenieria\...\20 - Desarrollo Interno\`, «Matriz interactiva de productos» v0.4) | según el informe D del 15/10, una matriz de productos con agentes propios | **no se abrió** (esta corrida no tocaba Y:): es el **paso 0**. Si ya resuelve (a), se usa en vez de construirlo |

## 3. El diseño

### Paso 0 · Antes de construir (media hora, solo lectura)
Abrir Artemis y ver qué guarda por producto. Si ya tiene la letra vigente por documento, el paso (a) la lee de ahí.

### Paso (a) · La ficha de una pieza (mediano: toca los scripts que emiten)
Un archivo por pieza (`data/configuracion/<clave>.json`, o en `DATOS` si Fak lo elige):
```
{ "pieza": { "clave": "insert-patagonia", "nombre": "...", "proyecto": "VW427 Patagonia", "codigos": [...] },
  "documentos": [ { "tipo": "flujograma|amfe|ho|bom|ft|embalaje|imds", "numero": "154", "letra": "D",
                    "fecha": "AAAA-MM-DD", "maestro": "<ruta en Gestion Ingenieria>",
                    "cliente": [ { "letra": "A", "donde": "BeOn informe N" | "PPAP" | "mail", "fecha": "...", "fuente": "..." } ] } ],
  "atributos": [ { "atributo": "adhesivo", "valor": "Fenoclor", "documento": "bom:BOM00x", "fuente": "RELACIONES 2026-10-13" } ] }
```
- **Quién escribe**: el script que emite cada documento agrega su renglón (generador de flujogramas, export oficial del
  AMFE, generador de hojas, carga del arb). Nadie la llena a mano; la primera carga de la pieza piloto se hace leyendo
  los listados maestros y BeOn, y se le muestra a Fak.
- **Prueba**: con el Insert cargado, contestar «qué letra del flujograma 154 vio el cliente» sin abrir otro archivo
  (para el Insert el cliente directo es Novax: va por su PPAP, no por el BeOn de Barack, según `NUESTRO_LADO.md`); y con
  el IP PAD, «qué letra del flujograma 157 vio VW» (Rev A, emitido el 14/10).

### Paso (b) · ¿Dicen lo mismo? (grande; solo lectura)
Para cada atributo, el valor que dice cada documento VIGENTE de la pieza, y rojo donde no cierran. Los extractores, de
a uno y empezando por los que ya existen: materiales y operaciones (reusan los de la tabla de arriba), después HO
(texto de la hoja), FT (texto del PDF; las escaneadas, por la API con el ítem 14 de esta tanda) y tizadas (el ancho del
MRK). Cada valor lleva su fuente y su fecha.
- **Trampa medida**: la BOM se compara contra un export del arb que tiene fecha. En esta PC el cache dice 15/09
  (`.arb-cache/refresh.json`) y el último export es `C:\tmp\RELACIONES.TXT` del 13/10. **La ficha dice siempre de qué
  fecha es la BOM que comparó**; con un export de más de una semana avisa antes de dar verde.
- **Falsos positivos**: convenciones de la casa (materiales «por fórmula», el código interno hasta que el proveedor da el
  suyo). Cada uno que aparezca se pregunta una vez y queda escrito como excepción con su fuente, no se esconde.
- **Prueba (respuesta conocida)**: con el Insert, los casos 1, 2 y 3 dan **rojo**; la costura del APB de puerta (ya
  corregida) da **verde**; y el caso 4 sale en el paso (a) como «el cliente tiene otra letra».

### Paso (c) · ¿Qué toca un cambio? (mediano)
Dado un atributo que cambia (por ejemplo el adhesivo del Insert), la lista de documentos vigentes de esa pieza que lo
nombran y el recordatorio del circuito de la casa: ECR (I-IN-003.1, registro `Tracking`), firmas de las 4 gerencias y,
si el cliente lo pide, PPAP. Esta pieza **solo lista**: la firma de un ECR es de otras gerencias.
- **Prueba**: el cambio de espuma del Insert del 09/10, contra lo que se tocó de verdad ese día.

## 4. Riesgos y lo que no hace

- Escribir letras en los listados maestros **sigue siendo con el OK de Fak**: la ficha los lee.
- El AMFE vigente se lee **de Supabase live**, no de un respaldo (`verify-supabase-live.md`).
- Un aviso que suena siempre se deja de leer: el paso (b) se prueba con los 4 casos rojos Y con piezas que dan verde
  antes de ponerlo en el «antes de mandar».
- No reemplaza a Calidad ni al ECR: avisa y lista.

## 5. Orden, tamaño y costo

| Fase | Qué | Tamaño | Prueba |
|---|---|---|---|
| 0 | Leer Artemis | chico, solo lectura | qué guarda por producto |
| a | Ficha del Insert + renglón en los scripts que emiten | mediano (plan corto + auditor) | la letra que vio VW sin abrir otro archivo |
| b | Chequeo de coherencia, extractores de a uno | grande (worktree + revisor independiente) | casos 1-3 rojos, costura del APB verde |
| c | Qué toca un cambio | mediano | el cambio de espuma del 09/10 |

Las fases (a) y (c) son las dos piezas de la cola de automatización de Pedro (tanda 8); se muestran con su antes y
después: «cuántas diferencias encontró el cliente o Calidad» contra «cuántas encontró el chequeo antes de emitir».
