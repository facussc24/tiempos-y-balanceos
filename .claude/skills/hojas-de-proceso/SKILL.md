---
name: hojas-de-proceso
description: Criterios de imagen y armado de hojas de proceso / hojas de operaciones de Barack (formulario I-IN-002.4-R01), en PPTX o Excel. Usar cuando Fak pida armar, corregir o revisar hojas de proceso de una maquina o de una operacion, cuando haya que elegir o acomodar las fotos de una hoja, o cuando haya que redibujar una pantalla de HMI para que se lea impresa. Trae la libreria `hojalib`, el gate que rechaza la hoja que no cumple y su selftest. Complementa `no-pfd-no-ho.md` (que dice CUANDO se hace una HO y quien numera) y `editar-video` (de donde sale el material cuando la fuente son videos).
---

# Una hoja de proceso se lee de pie, al lado de la maquina, impresa en A4

> **El que decide si una hoja sirve no es como se ve en el monitor: es como se lee en el papel.**
> El 03/09/2026 Fak miro la lamina 3 de la HOTMELT y pregunto: *"en la filmina 3 un celular se
> ve mucho mas grande que una hoja con parametros, ¿que clase de criterio estas aplicando a
> las hojas de proceso?"*. Tenia razon, y al medir aparecio algo peor que esa lamina:
> **ninguna de las 7 pantallas del deck se leia impresa** — entre 2,3 y 4,5 pt, contra 7 que
> es lo mas chico que Barack pone en estos documentos. Yo las habia dado por buenas
> mirandolas ampliadas en la pantalla.

Dos causas, las dos ciegas de la misma forma:

- el repartidor de imagenes **maximizaba superficie total** y no sabia cual imagen importaba;
- yo juzgaba la legibilidad **en el zoom equivocado**.

Ninguna se arregla con buena voluntad. Las dos se arreglan con un numero.

---

## 0. LOS GATES (bloqueantes, en este orden)

### GATE 1 — antes de acomodar: ¿cual es la imagen PRINCIPAL de esta hoja?

Se contesta **por hoja y por escrito**, antes de tocar el layout: *la imagen que el paso
manda mirar o leer*. No la mas linda, no la que quedo mejor encuadrada.

Sin esta respuesta el reparto vuelve a ser geometrico, y el resultado ya se conoce: en 11 de
las 17 hojas de la HOTMELT las tres imagenes salieron **exactamente del mismo tamaño**.

En el spec de la maquina va como `principal=<indice>` y `leer=[<indices>]`.

### GATE 2 — antes de dibujar una pantalla: ¿a cuantos cm va a salir impresa?

```bash
py -3 .claude/skills/hojas-de-proceso/scripts/hojalib.py   # ver ancho_que_le_toca_cm
```

Lo contraintuitivo: **la imagen se acomoda por su ALTURA dentro del bloque**, asi que una
pantalla mas alta termina mas ANGOSTA impresa. Agrandar el dibujo la achica en el papel.

Del ancho salen los pixeles: `ancho_px <= cuerpo_px x ancho_cm / (7 x 0,0352778)`.
Si los campos no entran, **no se achica la letra: se sacan campos** — los que el paso no nombra.

### GATE 3 — antes de entregar: el chequeo, en verde

```bash
py -3 .claude/skills/hojas-de-proceso/scripts/hoja_proceso_check.py "<deck.pptx>" --spec <spec.py>
```

Sale con codigo 1 y no se entrega. `--jerarquia 20.2=0,20.4=0` sirve para chequear sin spec.

---

## 1. Los criterios, con su numero

| # | Criterio | Umbral | Por que ese numero |
|---|---|---|---|
| 1 | Una imagen **principal** por hoja | >= **45 %** de la superficie de foto de la hoja **y** >= **1,6x** la segunda | sobre la TINTA, no sobre el bloque: una foto vertical 9:16 a la altura completa ocupa 32 % y **no puede ocupar mas** |
| 2 | **Lo que hay que leer, se lee** | cuerpo impreso >= **7 pt** | es lo mas chico que Barack imprime en estas hojas (las referencias de EPP) |
| 3 | La principal no es una estampilla | >= **25 %** del bloque | piso absoluto, para que el criterio 1 no se cumpla achicando a las otras |
| 4 | **Lo ajeno no entra** | se recorta o se descarta | celulares de traductor, caras, gente de espaldas, piso vacio, cajas del fondo |
| 5 | **Cantidad** | **2 o 3** por hoja, nunca 4 | en A4, con 4 no se ve ninguna |
| 6 | Las pantallas **se redibujan** | — | ver §3 |

**Ojo con el criterio 1.** Primero lo escribi como *"45 % del bloque"* y **13 de 17 hojas lo
violaban sin tener nada malo**: era imposible de cumplir para cualquier foto vertical. Un
umbral se prueba contra la poblacion entera antes de declararlo, no contra el caso que lo
inspiro.

---

## 2. Como se dimensiona una pantalla para que entre legible

1. cuantas imagenes va a tener la hoja (2 o 3), y cual es la principal;
2. `hojalib.ancho_que_le_toca_cm(ancho_px, alto_px, n)` -> los cm reales;
3. `ancho_px_max = cuerpo_px x cm / (7 x 0,0352778)`;
4. si no entran los campos, **se sacan los que el paso no nombra** y se declaran en el pie
   de la imagen ("la pantalla real trae ademas ...");
5. al guardar, la metrica va **adentro del PNG**:
   `hojalib.guardar_pantalla(im, dst, cuerpo_px=30, que_es="...")`.

`cuerpo_px` es **la tipografia mas chica que el operario tiene que leer** — la de los
rotulos, no la de los titulos ni la de los valores grandes. Declararla mas grande de lo que
es hace pasar el gate y no arregla nada.

El dato viaja en un chunk de texto del PNG y no en un archivo al lado porque el gate lee las
imagenes **ya embebidas en el pptx**, donde no hay nombre de archivo que seguir.

---

## 3. Las pantallas se redibujan. No se fotografian, y NO se "mejoran" con IA

Una foto de HMI en chino, sacada a mano y en angulo, no sirve impresa: es la mitad del
problema de legibilidad. Se **redibuja** en castellano, con el mismo layout, para que el
operario reconozca la pantalla cuando la ve en la maquina.

**Prohibido pasarla por un generador de imagenes.** El 03/09/2026 Fak propuso mejorarlas con
Gemini y borrarle la marca de agua: *"si los reinventa lo detectas y lo corregis poniendo el
texto correcto encima, pero va a quedar prolija"*. No se hace, por dos motivos distintos:
un modelo generativo **reinventa los digitos** —y un digito de temperatura equivocado en una
hoja de planta es un problema real—, y una marca de procedencia no se saca. Redibujar da el
mismo resultado prolijo **y cada numero es el que dice la pantalla**.

Lo redibujado va **fiel aunque quede feo**. Lo que agregamos nosotros (una advertencia, una
franja roja) va visiblemente separado y aclarado en el pie.

---

## 4. Lo fijo del formulario I-IN-002.4-R01

Una hoja = una operacion. Bloques: cajetin · IMAGENES · DESCRIPCION DE LA OPERACION ·
CICLO DE CONTROL · ELEMENTOS DE SEGURIDAD · PLAN DE REACCION.

- **Resp.** solo `OP` / `OC` / `Insp.`  · **Registro** solo `Set up` o `-`, nunca "RC".
- Pasos: frases cortas, imperativas, una accion por renglon. Sin "BORRADOR" ni "pendiente".
- **Sin foto -> recuadro VACIO**, no una leyenda que diga que falta.
- Dato que no tengo -> **TBD** y avisar. Los pasos son instruccion de planta: sin documento
  fuente van TBD, no por analogia con otra pieza parecida.
- Los iconos de EPP se **extraen de una HO real** y se reusan; no se dibujan ni se buscan en
  internet. Y se identifican **abriendo el PNG**: el 03/09 el que yo llamaba "barbijo" era
  el mismo pictograma de anteojos con otro nombre de archivo.
- El EPP se deduce del **riesgo filmado** (superficie caliente, atrapamiento, corte, aire
  comprimido). Deducir EPP de un riesgo que se ve es correcto; inventar un dato de Barack, no.
- La numeracion la manda el **flujograma**, no yo. Ver `no-pfd-no-ho.md`.

---

## 5. Errores caros de esta tanda (no repetirlos)

1. **Juzgar la legibilidad en el zoom y no al tamaño impreso** (03/09/2026). Las 7 pantallas
   estaban a menos de la mitad del minimo y yo las habia mirado una por una. Lo que se mide
   es el cuerpo en cm sobre el papel. Gate 2.
2. **Declarar un umbral sin probarlo contra la poblacion** (03/09/2026). "45 % del bloque"
   reprobaba 13 de 17 hojas sanas. Un umbral se corre sobre todo el conjunto antes de fijarlo.
3. **Mezclar dos estados de la maquina en una hoja** (03/09/2026). La 20.4 tenia parametros
   del 26/08 y velocidades del 28/08. Una hoja se basa en **una** lectura; si hay dos fechas,
   se elige una y se dice cual.
4. **Comparar dos lecturas de distinto minuto y llamarlo contradiccion** (03/09/2026).
   Reporte dos campos de alarma en conflicto comparando un fotograma de las 11:04 con otro de
   las 12:33 del mismo dia — y arme una "prueba" encima. Antes de comparar, la hora de cada
   lectura al lado del valor. Memoria `dos_lecturas_del_mismo_dia_no_son_comparables`.
5. **Verificar el script en vez del archivo publicado** (03/09/2026). PowerPoint tenia el
   pptx abierto, el render salio de una version vieja y reporte 12 correcciones que no
   estaban. Se cierra PowerPoint, se regenera y se verifica **extrayendo el texto del archivo**.
6. **Dar por buena una foto por su nombre de archivo.** `h11_a_corte_diagonal.jpg` seguia
   llamandose asi despues de que el contenido se corrigiera a corte RECTO. El nombre no es el
   contenido: se abre.
7. **Un script que reordena imagenes no es idempotente.** Los indices apuntan al estado
   ANTERIOR; corriendolo dos veces apuntan a otra cosa. Cada hoja declara cuantas imagenes
   espera encontrar y aborta antes de escribir si no coinciden.

---

## 6. Enforcement

| Capa | Que | Donde |
|---|---|---|
| **Dura** | `hoja_proceso_check.py` sale con codigo 1 y la hoja no se entrega | `scripts/hoja_proceso_check.py` |
| **Dura** | los umbrales viven **solo** en `hojalib.py`: el generador dibuja con los mismos numeros con los que el gate rechaza | `scripts/hojalib.py` |
| **Regresion** | 12 casos, cada criterio en ROJO y en VERDE | `scripts/hojalib_selftest.py` |
| **Dato** | la metrica de legibilidad viaja dentro del PNG, sobrevive al pptx | `hojalib.guardar_pantalla()` |

```bash
py -3 .claude/skills/hojas-de-proceso/scripts/hojalib_selftest.py     # 12 casos
py -3 .claude/skills/hojas-de-proceso/scripts/hoja_proceso_check.py "<deck.pptx>" --spec <spec.py>
```

El **spec de cada maquina vive fuera del repo** (trae contraseñas de HMI y part numbers de
cliente). En el repo va solo lo generico: libreria, gate y selftest.

---

## 7. Antes de entregar

- [ ] `hojalib_selftest.py` en verde (12/12)
- [ ] `hoja_proceso_check.py` en verde sobre el deck
- [ ] **las laminas miradas una por una**, renderizadas — no el script, el archivo publicado
- [ ] las pantallas miradas **al ancho que van a tener impresas**, no ampliadas
- [ ] PowerPoint cerrado antes de generar, y el texto verificado sobre el archivo guardado
- [ ] si el archivo lo venia editando Fak: su texto **intacto**, verificado con diff
- [ ] ningun `TBD` sin avisar, ninguna foto sin mirar, ningun numero sin fuente citada

---

Ver: `.claude/rules/no-pfd-no-ho.md` (cuando se hace una HO y quien numera) ·
`.claude/rules/verify-before-close.md` · `.claude/rules/core-prohibiciones.md` (§1, no
inventar) · skill `editar-video` (sacar material de video) · skill `leer-planos` (recortar
para que se lea) · memorias `pantalla_se_redibuja_no_se_mejora_con_ia`,
`dos_lecturas_del_mismo_dia_no_son_comparables`, `entregables_para_fak`.
