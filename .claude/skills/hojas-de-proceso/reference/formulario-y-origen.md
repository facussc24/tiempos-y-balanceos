# hojas-de-proceso / reference — §4 y §5 — lo fijo del formulario I-IN-002.4-R01 y de donde sale cada gate

Parte del skill `hojas-de-proceso` (se partio el 16/10/2026, tanda 1.5 del plan del sistema, porque el
SKILL.md tenia 779 renglones). Los gates, la lista de §7 y los errores de §7 bis siguen en `SKILL.md`:
esto se lee cuando el trabajo llega a esta parte, no en vez de aquellos.

---

## 4. Lo fijo del formulario I-IN-002.4-R01

Una hoja = una operacion. Bloques: cajetin · IMAGENES · DESCRIPCION DE LA OPERACION ·
CICLO DE CONTROL · ELEMENTOS DE SEGURIDAD · PLAN DE REACCION.

- **Portada** (Fak, 23/09/2026, corrigiendola a mano antes de mandarla a aprobar, *"la imagen
  queda mejor ahi centrada"* y *"asi las aplicas para las proximas"*): la foto de la maquina va
  **centrada vertical en el alto libre**, no pegada arriba; y **Realizó / Aprobó = F. Santoro /
  C. Baptista**: las hojas de proceso de Ingenieria las aprueba Carlos Baptista. Lo cumplen
  `portada()` de `scripts/img/generar_hojas_img.py` y de `scripts/hotmelt/hoja_pptx.py`.
- **Resp.** solo `OP` / `OC` / `Insp.`  · **Registro** solo `Set up` o `-`, nunca "RC".
- Pasos: frases cortas, en infinitivo (canon 4.4), una accion por renglon. Sin "BORRADOR" ni "pendiente",
  **ni "PRELIMINAR"** (orden de Carlos Baptista, Fak 07/10/2026 14:46; ver §7 bis, E5).
- **Sin foto -> recuadro VACIO**, no una leyenda que diga que falta.
- **Ni un TBD en la descripcion** (pasos, notas, parametros, pies, plan de reaccion) —
  Fak, 24/09/2026: *"no puede haber ni 1 TBD... el TBD del numero de hoja si, pero que sea
  una hoja de proceso sin TBD en las descripciones... toda la informacion disponible para
  conseguirlo"*. Lo que no se sabe se escribe **generico con lo que hay** (*"colocar la pieza
  bien apoyada, con la zona del logo debajo del molde"*, *"los valores de la foto son de
  referencia del proveedor"*), **sin inventar un valor** ni copiar un paso de otra pieza; el
  hueco va a la lista de pendientes y al mail, no a la hoja. El TBD queda solo en el cajetin
  (N° de operacion, HO, sector). Lo frena `redaccion.revisar_tbd()` dentro de `gate_redaccion`.
- Los iconos de EPP se **extraen de una HO real** y se reusan; no se dibujan ni se buscan en
  internet. Y se identifican **abriendo el PNG**: el 03/09 el que yo llamaba "barbijo" era
  el mismo pictograma de anteojos con otro nombre de archivo.
- El EPP se deduce del **riesgo filmado** (superficie caliente, atrapamiento, corte, aire
  comprimido). Deducir EPP de un riesgo que se ve es correcto; inventar un dato de Barack, no.
- La numeracion la manda el **flujograma**, no yo. Ver `no-pfd-no-ho.md`.

---

## 5. De donde sale cada gate

Cada gate de arriba nacio de una hoja que Fak devolvio. Los casos, con fecha y cita, estan en
`reference/casos.md`: se leen para entender por que un gate esta donde esta, no para aplicarlo.

De la tanda del 03/09 quedan tres reglas que no estan en otra seccion:

- Una hoja se basa en **una** lectura de la maquina: si hay dos fechas, se elige una y se dice
  cual. Dos lecturas de distinto minuto no se comparan como contradiccion sin poner la hora al
  lado de cada valor (memoria `dos_lecturas_del_mismo_dia_no_son_comparables`).
- Una foto no se da por buena por su nombre de archivo: se abre.
- Un script que reordena imagenes no es idempotente: cada hoja declara cuantas imagenes espera
  encontrar y aborta antes de escribir si no coinciden.
